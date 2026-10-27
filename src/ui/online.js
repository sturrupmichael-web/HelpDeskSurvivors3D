// The online screens: the leaderboard (title, B), the Account screen (title, U), player
// profiles, the "which progress do you keep?" choice, and the post row on the end-of-shift
// summary. Ported from the original's src/ui/screens/leaderboard.js, src/ui/account.js and
// src/ui/profile.js: the same wording, filters and keys. They render into the Menus overlay
// (`m` is the Menus); the post row renders into the summary. The network code is in
// src/net/. Everything a player typed (names, tech names on scores) is escaped.

import { icon } from './icons.js';
import { fmtTime } from './hud.js';
import { account } from '../net/account.js';
import { cleanName, postScore, topScores, myRank, playerProfile } from '../net/leaderboard.js';
import { LEADERBOARD } from '../../data/leaderboard.js';
import { MAPS, MAP_ORDER } from '../../data/maps.js';
import { POLICIES } from '../../data/policies.js';
import { ACHIEVEMENTS } from '../../data/achievements.js';
import { CHARACTERS } from '../../data/player.js';
import { modsString, parseMods, fmtMult } from '../sim/policies.js';
import { VERSION } from '../version.js';

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
const num = (n) => (Number.isFinite(Number(n)) ? Number(n).toLocaleString() : '—');
const PAY = (n) => `<span class="pay">$${n.toLocaleString()}</span>`;
const MAP_KEYS = { Digit1: 0, Digit2: 1, Digit3: 2, Digit4: 3, Digit5: 4, Numpad1: 0, Numpad2: 1, Numpad3: 2, Numpad4: 3, Numpad5: 4 };

// Text boxes: the page's key handling skips keys typed into them (src/engine/input.js), so
// each box handles its own Enter and Esc.
function onBoxKeys(input, enter, escape = () => input.blur()) {
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      enter();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      escape();
    }
  });
}

// The account's name goes in the save, so the leaderboard can find your rows. It can come
// from the 2D game, for a player who signed in there first.
function rememberName(meta, name) {
  if (meta.data.playerName === name) return;
  meta.data.playerName = name;
  meta.save();
}

// --- Leaderboard ------------------------------------------------------------------------

// Filter: '' (every shift), 'clean' (no policies) or 'hardcore', remembered while the page
// is open.
let filter = '';

// The policies on a row, as small icons. Names show on hover, or on a tap (phones can't hover).
function modsCell(row) {
  const all = parseMods(row.mods);
  const ids = all.filter((id) => id !== 'hardcore');
  const hc = all.includes('hardcore') ? '<b class="hc-tag">HC</b>' : '';
  if (!ids.length) return hc || '<span class="tiny">—</span>';
  const names = ids.map((id) => (id === 'reorg' ? 'Reorg bonus' : POLICIES[id].name)).join(', ');
  const label = `${names} (${fmtMult(Number(row.mult) || 1)})`;
  return `${hc}<span class="mods" title="${label}" data-label="${label}">${ids
    .map((id) => (id === 'reorg' ? '🎲' : icon(POLICIES[id].icon, 14)))
    .join('')}</span>`;
}

// Top scores (CSAT x Shift Policies) per map, one map at a time (1-5 or the swipeable map
// row), optionally only shifts without policies (C) or only Hardcore shifts (H, tagged HC).
// Each row is rank, player (with tech, time and policies underneath) and score, so it fits
// a phone. Your own row is highlighted; when you're not in the top rows, your best rank
// shows below. Tapping a row opens that player's profile.
export function leaderboard(m, mapId = m.meta.data.map) {
  const me = m.meta.data.playerName;
  const again = () => leaderboard(m, mapId);
  const tabs = MAP_ORDER.map(
    (id, i) => `<button class="tab ${id === mapId ? 'selected' : ''}" data-map="${id}">${MAPS[id].name} <kbd>${i + 1}</kbd></button>`,
  ).join('');
  const setFilter = (f) => {
    filter = filter === f ? '' : f;
    m.sfx('click');
    again();
  };
  const back = () => {
    m.sfx('click');
    m.title();
  };
  const retry = () => {
    m.sfx('click');
    again();
  };
  m.show(
    `<div class="panel wide board" tabindex="-1">
      <h2>LEADERBOARD</h2>
      <p class="sub">Top ${LEADERBOARD.top} per map in 3D. Score = CSAT x the shift's policies (x2 for Hardcore). Tap a player for their profile.</p>
      <div class="board-maps">${tabs}</div>
      <div class="board-filters">
        <button class="board-clean ${filter === 'clean' ? 'on' : ''}" data-filter="clean" aria-pressed="${filter === 'clean'}"><span class="switch"></span>No policies only <kbd>C</kbd></button>
        <button class="board-clean ${filter === 'hardcore' ? 'on' : ''}" data-filter="hardcore" aria-pressed="${filter === 'hardcore'}"><span class="switch"></span>Hardcore only <kbd>H</kbd></button>
      </div>
      <div class="board-body"><p class="board-msg">Loading…</p></div>
      <button class="back" data-act="back">Back <kbd>Esc</kbd></button>
    </div>`,
    (code) => {
      if (MAP_KEYS[code] !== undefined) {
        m.sfx('click');
        leaderboard(m, MAP_ORDER[MAP_KEYS[code]]);
      } else if (code === 'ArrowRight' || code === 'ArrowLeft') {
        const at = MAP_ORDER.indexOf(mapId) + (code === 'ArrowRight' ? 1 : -1);
        m.sfx('click');
        leaderboard(m, MAP_ORDER[(at + MAP_ORDER.length) % MAP_ORDER.length]);
      } else if (code === 'KeyC') setFilter('clean');
      else if (code === 'KeyH') setFilter('hardcore');
      else if (code === 'KeyR' && m.el.querySelector('.board-retry')) retry();
      else if (code === 'Escape' || code === 'Enter') back();
      else return false;
    },
    again,
  );
  m.el.querySelector('.board-maps .selected')?.scrollIntoView({ block: 'nearest', inline: 'center' });
  m.bind('.tab[data-map]', (i, el) => {
    m.sfx('click');
    leaderboard(m, el.dataset.map);
  });
  m.bind('[data-filter]', (i, el) => setFilter(el.dataset.filter));
  m.bind('[data-act=back]', back);
  const body = m.el.querySelector('.board-body');
  const row = (r, rank, mine) => `<tr data-name="${esc(r.name)}"${mine ? ' class="me"' : ''}>
      <td class="rank">${rank ?? '—'}</td>
      <td class="player"><button class="name-link" data-name="${esc(r.name)}">${esc(r.name)}</button>${mine ? ' <b class="you">YOU</b>' : ''}
        <small>${esc(r.character)} · ${fmtTime(Number(r.seconds) || 0)}${r.won ? ' <b class="ok">✓</b>' : ''}</small></td>
      <td class="score">${num(r.score ?? r.csat)}${parseMods(r.mods).length ? `<small>${modsCell(r)}</small>` : ''}</td>
    </tr>`;
  const live = () => m.el.querySelector('.board-body') === body; // false once the screen has changed
  topScores(mapId, filter).then(async (r) => {
    if (!live()) return;
    if (!r.ok) {
      // Say why, so a player can tell us: no answer at all (offline, a blocked site, too
      // slow) or the server refusing (its status code).
      const why = r.status ? `The leaderboard server answered with error ${r.status}.` : 'No answer from the leaderboard server. Your network or a content blocker may be stopping it.';
      body.innerHTML = `<p class="board-msg">Couldn't reach the leaderboard. ${why}</p><button class="board-retry" data-act="retry">Try again <kbd>R</kbd></button>`;
      body.querySelector('[data-act=retry]').addEventListener('click', retry);
      return;
    }
    const inTop = !!me && r.rows.some((x) => x.name === me);
    if (!r.rows.length) body.innerHTML = '<p class="board-msg">No scores on this map yet. Be the first.</p>';
    else
      body.innerHTML = `<table class="stats board-table">
        <tr class="head"><td>#</td><td>Player</td><td>Score</td></tr>
        ${r.rows.map((x, i) => row(x, i + 1, !!me && x.name === me)).join('')}
      </table>`;
    // Not in the top rows: look up this player's best on the map and add it under the table.
    if (me && !inTop) {
      const mine = await myRank(mapId, me, filter);
      if (!live() || !mine.ok || !mine.best) return wire();
      const table = body.querySelector('.board-table');
      const html = `<tr class="gap"><td colspan="3">⋯</td></tr>${row({ ...mine.best, name: me }, mine.rank, true)}`;
      if (table) table.insertAdjacentHTML('beforeend', html);
      else body.innerHTML = `<table class="stats board-table">${html}</table>`;
    }
    wire();
  });
  // The whole row opens the profile, so it's an easy tap target (the name stays a button
  // for keyboard and controller). Tapping the policy icons shows their names instead.
  function wire() {
    body.querySelectorAll('tr[data-name]').forEach((tr) =>
      tr.addEventListener('click', () => {
        m.sfx('click');
        profile(m, tr.dataset.name, again);
      }),
    );
    body.querySelectorAll('.mods').forEach((el) =>
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        el.classList.toggle('named');
        if (el.classList.contains('named')) {
          el.dataset.icons = el.innerHTML;
          el.textContent = el.dataset.label;
        } else el.innerHTML = el.dataset.icons;
      }),
    );
  }
}

// --- Profiles ---------------------------------------------------------------------------

function profileBody(m, p) {
  const since = new Date(p.since);
  const ch = Object.keys(CHARACTERS).find((id) => CHARACTERS[id].name === p.favourite);
  const got = new Set(Array.isArray(p.achievements) ? p.achievements : []);
  const ach = ACHIEVEMENTS.filter((a) => got.has(a.id));
  const best = (Array.isArray(p.best) ? p.best : []).filter((b) => MAPS[b.map]).sort((a, b) => MAP_ORDER.indexOf(a.map) - MAP_ORDER.indexOf(b.map));
  return `
    <p class="sub">On the 3D leaderboard since ${Number.isNaN(since.getTime()) ? '—' : since.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}</p>
    <div class="profile-top">
      ${p.favourite ? `<div class="title-char">${ch ? m.techImg(ch) : ''}
        <div><div class="tools-head">FAVOURITE TECHNICIAN</div><div class="card-name">${esc(p.favourite)}</div></div></div>` : ''}
      <table class="stats">
        <tr><td>Shifts worked</td><td>${num(p.shifts)}</td></tr>
        <tr><td>Scores posted</td><td>${num(p.posted)}</td></tr>
        <tr><td>Shifts survived (posted)</td><td>${num(p.wins)}</td></tr>
      </table>
    </div>
    <h3>BEST SHIFTS</h3>
    ${best.length
      ? `<table class="stats profile-best">
          <tr class="head"><td>Map</td><td>Best score</td><td>Best clean</td><td>Longest</td></tr>
          ${best.map((b) => `<tr><td>${MAPS[b.map].name}</td><td>${num(b.score ?? b.csat)}</td><td>${b.clean == null ? '—' : num(b.clean)}</td><td>${fmtTime(Number(b.seconds) || 0)}${b.won ? ' <b class="ok">✓</b>' : ''}</td></tr>`).join('')}
        </table>`
      : '<p class="board-msg">No 3D scores posted yet.</p>'}
    <h3>ACHIEVEMENTS · ${ach.length} / ${ACHIEVEMENTS.length}</h3>
    ${ach.length
      ? `<div class="profile-ach">${ach.map((a) => `<span class="profile-badge" title="${a.desc}">${icon(a.icon, 20)}${a.name}</span>`).join('')}</div>`
      : `<p class="board-msg">${p.shifts == null ? 'Achievements show up once this player\'s 3D progress is backed up.' : 'None unlocked yet.'}</p>`}`;
}

// A player's public profile (opened from the leaderboard, or My profile on Account).
export function profile(m, name, back) {
  const leave = () => {
    m.sfx('click');
    back();
  };
  m.show(
    `<div class="panel wide board profile" tabindex="-1">
      <h2>${esc(name)}</h2>
      <div class="profile-body"><p class="board-msg">Loading…</p></div>
      <button class="back" data-act="back">Back <kbd>Esc</kbd></button>
    </div>`,
    (code) => {
      if (code === 'Escape' || code === 'Enter') leave();
      else return false;
    },
  );
  m.bind('[data-act=back]', leave);
  const el = m.el.querySelector('.profile-body');
  playerProfile(name).then((r) => {
    if (m.el.querySelector('.profile-body') !== el) return; // screen changed meanwhile
    if (!r.ok) el.innerHTML = '<p class="board-msg">Couldn\'t load this profile. Check your connection and try again.</p>';
    else if (!r.profile) el.innerHTML = '<p class="board-msg">No profile for this name.</p>';
    else el.innerHTML = profileBody(m, r.profile);
  });
}

// --- Account ----------------------------------------------------------------------------

function syncLine(cloud) {
  if (cloud.status === 'synced') return 'Progress backed up to your account.';
  if (cloud.status === 'syncing') return 'Backing up your progress…';
  if (cloud.status === 'offline') return "Couldn't reach the server. Your progress will back up next time.";
  if (cloud.status === 'conflict') return 'Waiting for you to pick which progress to keep.';
  return '';
}

// What the title's Account tile says under its name.
export const accountKind = () => (!account.user ? 'Not signed in' : account.user.guest ? 'Guest' : 'Google');

// Guest or Google, the leaderboard name (and a box to change it), whether progress is
// backed up, Sign in with Google, My profile and Sign out. `cloud` is the CloudSave.
export async function accountScreen(m, cloud, back = () => m.title()) {
  const u = account.user;
  const name = u ? await account.name() : undefined;
  if (name) rememberName(m.meta, name);
  const again = () => accountScreen(m, cloud, back);
  const nameText = name ? `<b>${esc(name)}</b>` : name === null ? '<i>couldn\'t check</i>' : '<i>none yet</i>';
  const kind = !u
    ? `<p>You're playing without an account. Your progress is saved in this browser only.</p>
       <p class="tiny">A guest account is made for you the first time you post a score. Already play the 2D game with Google? Sign in with the same account to keep your name.</p>`
    : u.guest
      ? `<p><b>Guest account</b> · Leaderboard name: ${nameText}</p>
         <p>Your name and progress are tied to this browser. Sign in with Google to keep them safe and play on other devices.</p>`
      : `<p>Signed in with Google${u.email ? ` as <b>${esc(u.email)}</b>` : ''}</p>
         <p>Leaderboard name: ${nameText}</p>`;
  const leave = () => {
    m.sfx('click');
    back();
  };
  m.show(
    `<div class="panel account" tabindex="-1">
      <h2>ACCOUNT</h2>
      ${kind}
      ${u ? `<p class="sync-line">${syncLine(cloud)}</p>` : ''}
      ${account.lastError ? `<p class="sign-in-error">Google sign-in didn't finish: ${esc(account.lastError)}</p>` : ''}
      ${!u || u.guest ? '<button class="primary google" data-act="google">Sign in with Google <kbd>G</kbd></button>' : ''}
      ${u ? `<div class="name-row"><input type="text" class="board-name" maxlength="${LEADERBOARD.nameMax}" placeholder="New leaderboard name" autocomplete="off" spellcheck="false">
        <button data-act="rename">${name ? 'Change name' : 'Claim name'}</button></div><p class="board-msg"></p>` : ''}
      ${name ? '<button class="wide-btn" data-act="profile">My profile</button>' : ''}
      ${u && !u.guest ? '<button class="wide-btn" data-act="signout">Sign out on this device</button>' : ''}
      <button class="back" data-act="back">Back <kbd>Esc</kbd></button>
      <p class="tiny">The same account as the 2D game. We store your leaderboard name, your progress and, if you use Google, your email address. Nothing else.</p>
    </div>`,
    (code) => {
      if (code === 'Escape') leave();
      else if (code === 'KeyG' && (!u || u.guest)) google();
      else return false;
    },
  );
  const msg = m.el.querySelector('.board-msg');
  const google = async () => {
    m.sfx('click');
    const btn = m.el.querySelector('[data-act=google]');
    btn.disabled = true;
    btn.textContent = 'Opening Google…';
    const r = await account.google();
    if (!r.ok) {
      btn.disabled = false;
      btn.innerHTML = 'Sign in with Google <kbd>G</kbd>';
      if (msg) msg.textContent = "Couldn't reach Google sign-in. Try again in a minute.";
    }
  };
  const rename = async () => {
    const input = m.el.querySelector('.board-name');
    const n = cleanName(input.value);
    if (!n) return (msg.textContent = 'Type a name first.');
    msg.textContent = 'Saving…';
    const r = await account.setName(n);
    if (r.ok) {
      m.meta.data.playerName = n;
      m.meta.save();
      again();
    } else msg.textContent = r.taken ? 'Someone already has that name. Try another.' : "Couldn't reach the server. Try again.";
  };
  const box = m.el.querySelector('.board-name');
  if (box) onBoxKeys(box, rename);
  m.bind('[data-act]', (i, el) => {
    const act = el.dataset.act;
    if (act === 'back') leave();
    else if (act === 'google') google();
    else if (act === 'rename') rename();
    else if (act === 'profile') {
      m.sfx('click');
      profile(m, name, again);
    } else if (act === 'signout') {
      m.sfx('click');
      account.signOut();
      cloud.reset();
      again();
    }
  });
}

// Both this device and the account have progress the other doesn't: the player picks.
export function conflictScreen(m, local, cloud, choose) {
  const card = (side, title, s) => `<button class="card save-pick" data-side="${side}">
      <div class="card-name">${title}</div>
      <div>${plural(s.shifts, 'shift')} · ${s.wins} survived</div>
      <div>${PAY(s.pay)} Overtime Pay</div>
      <div>${plural(s.characters, 'character')} · ${plural(s.achievements, 'achievement')}</div>
    </button>`;
  const pick = (side) => {
    m.sfx('click');
    choose(side);
    m.title();
  };
  m.show(
    `<div class="panel account" tabindex="-1">
      <h2>WHICH PROGRESS DO YOU KEEP?</h2>
      <p>This device and your account both have progress. Pick one; the other is replaced.</p>
      <div class="save-picks">${card('local', 'This device', local)}${card('cloud', 'Your account', cloud)}</div>
    </div>`,
    () => true, // must pick one
  );
  m.bind('.save-pick', (i, el) => pick(el.dataset.side));
}

// --- Posting a shift --------------------------------------------------------------------

// What to tell the player when claiming a name or posting failed: no answer at all, or the
// server's own reason (a database check like "Too many scores right now", a refused guest
// sign-up), so a failure can be told apart from a bad connection.
function failText(r, what) {
  if (!r.status) return `Couldn't reach the leaderboard. Check your connection (or a content blocker) and try again.`;
  if (r.status === 429) return 'Too many tries from this network. Wait a minute and try again.';
  return `${what} (error ${r.status}${r.reason ? `: ${r.reason}` : ''}). Try again.`;
}

// The leaderboard row on the end-of-shift summary, drawn into `root`. `s` is sim.over and
// `meta` the save (for the name last typed). Returns the post() handler, for the P key.
export function boardPost(root, s, meta) {
  let posted = false;
  let name;
  const draw = () => {
    root.innerHTML = name
      ? `<span class="posting-as">Posting as <b>${esc(name)}</b></span>
         <button data-act="post">Post to Leaderboard <kbd>P</kbd></button><span class="board-msg"></span>`
      : `<input type="text" class="board-name" maxlength="${LEADERBOARD.nameMax}" placeholder="Pick a leaderboard name" value="${esc(meta.data.playerName ?? '')}" autocomplete="off" spellcheck="false">
         <button data-act="post">Post to Leaderboard <kbd>P</kbd></button><span class="board-msg"></span>`;
    root.querySelector('[data-act=post]').addEventListener('click', post);
    const input = root.querySelector('.board-name');
    if (input) onBoxKeys(input, post);
  };
  const post = async () => {
    const btn = root.querySelector('[data-act=post]');
    const msg = root.querySelector('.board-msg');
    if (posted || btn.disabled) return;
    const input = root.querySelector('.board-name');
    btn.disabled = true;
    if (input) {
      const n = cleanName(input.value);
      if (!n) {
        btn.disabled = false;
        msg.textContent = 'Type a name first.';
        setTimeout(() => input.focus(), 50);
        return;
      }
      input.value = n;
      input.disabled = true;
      input.blur();
      msg.textContent = 'Claiming your name…';
      const c = await account.setName(n);
      if (!c.ok) {
        btn.disabled = input.disabled = false;
        msg.textContent = c.taken ? 'Someone already has that name. Try another.' : failText(c, "The leaderboard couldn't save your name");
        return;
      }
      meta.data.playerName = n;
      meta.save();
    }
    msg.textContent = 'Posting…';
    const r = await postScore({
      map: s.map, character: s.character, seconds: Math.round(s.time), csat: s.csat, won: s.won, version: VERSION,
      mods: modsString({ ids: s.policies ?? [], reorg: s.reorg, hardcore: s.hardcore }), mult: s.policyMult ?? 1,
    });
    if (r.ok) {
      posted = true;
      msg.innerHTML = r.rank ? `Posted! You're <b>#${r.rank}</b> on the ${esc(s.mapName)} board.` : 'Posted!';
    } else {
      btn.disabled = false;
      msg.textContent = failText(r, "The leaderboard didn't accept that score");
    }
  };
  draw();
  if (account.user) {
    account.name().then((n) => {
      if (n) rememberName(meta, n);
      if (n && !posted && root.isConnected) {
        name = n;
        draw();
      }
    });
  }
  return post;
}
