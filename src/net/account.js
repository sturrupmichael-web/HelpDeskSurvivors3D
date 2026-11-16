// Player accounts through Supabase Auth's REST API (no library), ported from the original's
// src/game/account.js. The same accounts as the 2D game. Two kinds:
//  - guest: made automatically the first time someone posts a score. Works on this
//    browser only.
//  - Google: a guest that tapped "Sign in with Google" (the guest is upgraded in place,
//    keeping its name and save), or someone signing in on another device.
// Google accounts are shared with the rest of michaelsturrup.com: they live under SITE_KEY,
// the slot the main page's "Sign in with Google" writes, so signing in anywhere on the site
// signs in here too (and signing out here signs out everywhere). Guests belong to this game
// and stay under KEY. The session is read fresh before each use, since another page may have
// refreshed it (Supabase hands out a new refresh token each time and the old one stops
// working). See docs/site-sign-in.md in the sturrupmichael-web.github.io repo.
// Every call resolves to { ok, ... } instead of throwing, so screens can just show a
// message when offline.

import { LEADERBOARD as LB } from '../../data/leaderboard.js';

const KEY = 'helpdesk-survivors-3d.auth.v1';
export const SITE_KEY = 'michaelsturrup.auth.v1';
let memory = null; // the session when storage is blocked
let cachedName = null; // leaderboard name, once fetched (undefined = none claimed yet)
let cachedFor = null; // whose name cachedName is

function read(key) {
  try {
    const s = JSON.parse(localStorage.getItem(key));
    return s?.user?.id && s.access_token ? s : null;
  } catch {
    return null;
  }
}

// The Google account signed in on the site if there is one, else this game's guest.
// { access_token, refresh_token, expires_at (s), user: { id, email, guest } }
function load() {
  let s = null;
  try {
    const site = read(SITE_KEY);
    s = site && !site.user.guest ? site : read(KEY);
    // Before the site-wide sign-in, Google accounts were kept under KEY too: move them over.
    if (s && !s.user.guest && s !== site) {
      localStorage.setItem(SITE_KEY, JSON.stringify(s));
      localStorage.removeItem(KEY);
    }
  } catch {
    return memory;
  }
  return s ?? memory;
}

let session = load();

function store(s) {
  const was = session;
  session = s;
  memory = s;
  if (s?.user.id !== cachedFor) cachedName = null;
  try {
    if (s && !s.user.guest) {
      localStorage.setItem(SITE_KEY, JSON.stringify(s));
      localStorage.removeItem(KEY); // a linked guest is this Google account now
    } else if (s) {
      localStorage.setItem(KEY, JSON.stringify(s));
    } else {
      localStorage.removeItem(was && !was.user.guest ? SITE_KEY : KEY);
    }
  } catch {
    // Storage blocked: the account lasts for this page only.
  }
}

// Pick up whatever another page of the site did since: a sign-in, sign-out or refresh.
function sync() {
  const s = load();
  if (s?.user.id !== session?.user.id) cachedName = null;
  session = s;
}

// The user's id, email and guest flag come from the access token itself.
function fromTokens(t) {
  try {
    const claims = JSON.parse(atob(t.access_token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return {
      access_token: t.access_token,
      refresh_token: t.refresh_token,
      expires_at: Number(t.expires_at) || claims.exp,
      user: { id: claims.sub, email: claims.email || '', guest: !!claims.is_anonymous },
    };
  } catch {
    return null;
  }
}

async function request(url, opts = {}) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), LB.timeout);
  try {
    const res = await fetch(url, {
      ...opts,
      signal: ctl.signal,
      headers: { apikey: LB.key, 'Content-Type': 'application/json', ...opts.headers },
    });
    const body = res.status === 204 ? null : await res.json().catch(() => null);
    return res.ok ? { ok: true, status: res.status, body, res } : { ok: false, status: res.status, body };
  } catch {
    return { ok: false, status: 0 };
  } finally {
    clearTimeout(t);
  }
}

// Which Google sign-in this tab started ('link' or 'sign-in'), kept across the trip to
// Google. sessionStorage can be blocked (a sandboxed frame): then it's just forgotten.
const tab = {
  get() {
    try {
      return sessionStorage.getItem('hs3d-google');
    } catch {
      return null;
    }
  },
  set(v) {
    try {
      if (v) sessionStorage.setItem('hs3d-google', v);
      else sessionStorage.removeItem('hs3d-google');
    } catch {
      // Blocked: a guest that comes back linked just shows as signed in.
    }
  },
};

// Where Google sends the player back to: this page, without any #tokens.
const returnUrl = () => location.origin + location.pathname;

// Why a request failed, in the server's own words when it gave any (Supabase Auth says
// `msg`, the database `message`), so the screens can tell the player.
const reason = (r) => String(r.body?.msg ?? r.body?.message ?? r.body?.error_description ?? '').slice(0, 160);

export const account = {
  lastError: '', // why the last Google sign-in didn't finish, shown on the Account screen
  lastFail: null, // { status, reason } of the last failed guest sign-up or name claim
  get user() {
    sync();
    return session?.user ?? null;
  },

  // Called once at startup. Picks up the tokens Supabase puts in the address after a
  // Google sign-in. Returns 'signed-in', 'linked' (a guest became a Google account),
  // 'error' or null.
  async init() {
    const params = new URLSearchParams(location.hash.slice(1) || location.search.slice(1));
    const pending = tab.get();
    if (!params.has('access_token') && !params.has('error')) return null;
    history.replaceState(null, '', returnUrl()); // don't leave tokens in the address bar
    tab.set(null);
    if (params.has('error')) {
      // That Google account already has a player: sign in to it instead of linking.
      if (params.get('error_code') !== 'identity_already_exists') {
        this.lastError = (params.get('error_description') || params.get('error_code') || params.get('error')).slice(0, 160);
        return 'error';
      }
      this.googleSignIn();
      return 'redirect';
    }
    const s = fromTokens(Object.fromEntries(params));
    if (!s) {
      this.lastError = "The sign-in came back in a form the game didn't understand.";
      return 'error';
    }
    store(s);
    return pending === 'link' ? 'linked' : 'signed-in';
  },

  // A valid session, refreshing it or (with makeGuest) creating a guest when needed.
  async ensure(makeGuest = false) {
    sync();
    if (session && session.expires_at - 60 > Date.now() / 1000) return true;
    if (session) {
      const r = await request(`${LB.url}/auth/v1/token?grant_type=refresh_token`, {
        method: 'POST',
        body: JSON.stringify({ refresh_token: session.refresh_token }),
      });
      if (r.ok && fromTokens(r.body)) {
        const keep = cachedName;
        store(fromTokens(r.body));
        cachedName = keep;
        return true;
      }
      if (r.status === 0) return false; // offline: keep the session for later
      // Refused. Another page of the site may have refreshed it a moment ago: use theirs.
      const tried = session.refresh_token;
      sync();
      if (session && session.refresh_token !== tried) return session.expires_at - 60 > Date.now() / 1000;
      if (session) store(null); // revoked or expired for good
    }
    if (!makeGuest) return false;
    const r = await request(`${LB.url}/auth/v1/signup`, { method: 'POST', body: '{}' });
    if (!r.ok || !fromTokens(r.body)) {
      this.lastFail = { status: r.status, reason: reason(r) };
      return false;
    }
    store(fromTokens(r.body));
    cachedName = undefined; // brand new: no name yet
    cachedFor = session.user.id;
    return true;
  },

  // Calls the database REST API as this player.
  async rest(path, opts = {}) {
    if (!(await this.ensure())) return { ok: false, status: 401 };
    return request(`${LB.url}/rest/v1/${path}`, {
      ...opts,
      headers: { Authorization: `Bearer ${session.access_token}`, ...opts.headers },
    });
  },

  // The player's leaderboard name: a string, undefined when none is claimed, or null
  // when it couldn't be checked.
  async name() {
    sync();
    if (cachedName !== null) return cachedName;
    if (!session) return undefined;
    const r = await this.rest('players?select=name');
    if (!r.ok) return null;
    cachedName = r.body[0]?.name;
    cachedFor = session?.user.id ?? null;
    return cachedName;
  },

  // Claims or changes the leaderboard name. { ok } or { ok: false, taken: true }.
  async setName(newName) {
    this.lastFail = null;
    if (!(await this.ensure(true))) return { ok: false, ...this.lastFail };
    const had = await this.name();
    if (had === null) return { ok: false };
    const r = had
      ? await this.rest(`players?user_id=eq.${session.user.id}`, { method: 'PATCH', body: JSON.stringify({ name: newName }) })
      : await this.rest('players', { method: 'POST', body: JSON.stringify({ name: newName }) });
    if (r.status === 409) return { ok: false, taken: true };
    if (!r.ok) return { ok: false, status: r.status, reason: reason(r) };
    cachedName = newName;
    cachedFor = session.user.id;
    return { ok: true };
  },

  // "Sign in with Google". A guest is upgraded in place (same name, same save); anyone
  // else signs in. Both leave the page and come back through init().
  async google() {
    sync();
    if (session?.user.guest && (await this.ensure())) {
      const q = new URLSearchParams({ provider: 'google', redirect_to: returnUrl(), skip_http_redirect: 'true' });
      const r = await request(`${LB.url}/auth/v1/user/identities/authorize?${q}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!r.ok || !r.body?.url) return { ok: false };
      tab.set('link');
      location.assign(r.body.url);
      return { ok: true };
    }
    this.googleSignIn();
    return { ok: true };
  },

  googleSignIn() {
    tab.set('sign-in');
    location.assign(`${LB.url}/auth/v1/authorize?${new URLSearchParams({ provider: 'google', redirect_to: returnUrl() })}`);
  },

  // Signs out here and on the rest of the site (a Google account is shared). Progress stays
  // on the device; it just stops syncing.
  async signOut() {
    sync();
    if (session) request(`${LB.url}/auth/v1/logout`, { method: 'POST', headers: { Authorization: `Bearer ${session.access_token}` } });
    store(null);
  },
};
