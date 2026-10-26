// Online leaderboard: reads the top scores per map and posts a finished shift, through
// Supabase's REST API (data/leaderboard.js), into the 3D game's own table (`scores_3d`,
// supabase/001_3d.sql). Ported from the original's src/game/leaderboard.js. Ranked by score: CSAT x the Shift Policies'
// multiplier (`score` is worked out by the database; `mods` lists
// the policies, empty for a clean shift). Every call resolves to
// { ok, ... } instead of throwing, so the screens can just show a message when offline.

import { LEADERBOARD as LB } from '../../data/leaderboard.js';
import { account } from './account.js';

const base = () => `${LB.url}/rest/v1/${LB.table}`;

async function call(path, opts = {}) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), LB.timeout);
  try {
    const res = await fetch(base() + path, {
      ...opts,
      signal: ctl.signal,
      headers: { apikey: LB.key, 'Content-Type': 'application/json', ...opts.headers },
    });
    if (!res.ok) return { ok: false, status: res.status };
    return { ok: true, res };
  } catch {
    return { ok: false, status: 0 };
  } finally {
    clearTimeout(t);
  }
}

// Trims a typed name to something safe to store: printable characters only. The Hangul
// fillers count as letters but show as blanks, so they go too (the database refuses them,
// supabase/010_security.sql).
export function cleanName(name) {
  return String(name ?? '')
    .replace(/[^\p{L}\p{N} ._\-'!?]|[\u115f\u1160\u3164\uffa0]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, LB.nameMax);
}

// Board filters: 'clean' = only shifts without policies (or Hardcore), 'hardcore' = only
// Hardcore shifts (their mods include "hardcore"), anything else = every shift.
const filterQ = (filter) => (filter === 'clean' || filter === true ? '&mods=eq.' : filter === 'hardcore' ? '&mods=like.*hardcore*' : '');

// Top scores on one map: [{ name, character, seconds, csat, won, mods, mult, score }].
export async function topScores(map, filter = '') {
  const q = `?select=name,character,seconds,csat,won,mods,mult,score&map=eq.${encodeURIComponent(map)}${filterQ(filter)}&order=score.desc,seconds.desc&limit=${LB.top}`;
  let r = await call(q);
  if (!r.ok && !r.status) r = await call(q); // no answer: one more try (a slow phone signal)
  if (!r.ok) return r;
  return { ok: true, rows: await r.res.json() };
}

// A player's best score on one map and its place on the board, for when they're outside
// the top rows: { ok, best: { score, seconds, won, character, mods, mult } | null, rank }.
export async function myRank(map, name, filter = '') {
  const m = `map=eq.${encodeURIComponent(map)}${filterQ(filter)}`;
  const r = await call(`?select=character,seconds,csat,won,mods,mult,score&${m}&name=eq.${encodeURIComponent(name)}&order=score.desc,seconds.desc&limit=1`);
  if (!r.ok) return r;
  const best = (await r.res.json())[0] ?? null;
  if (!best) return { ok: true, best: null, rank: null };
  const c = await call(`?select=id&${m}&score=gt.${Number(best.score) || 0}`, { method: 'HEAD', headers: { Prefer: 'count=exact' } });
  const above = c.ok ? Number(c.res.headers.get('content-range')?.split('/')[1]) : NaN;
  return { ok: true, best, rank: Number.isFinite(above) ? above + 1 : null };
}

// Posts a shift for the signed-in player and returns its rank on that map's board
// (1 = top). The database fills in the player's name from their account.
export async function postScore(row) {
  const r = await account.rest(LB.table, { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(row) });
  if (!r.ok) return r;
  const score = Math.round(row.csat * (row.mult ?? 1));
  const c = await call(`?select=id&map=eq.${encodeURIComponent(row.map)}&score=gt.${score}`, {
    method: 'HEAD',
    headers: { Prefer: 'count=exact' },
  });
  const total = c.ok ? Number(c.res.headers.get('content-range')?.split('/')[1]) : NaN;
  return { ok: true, rank: Number.isFinite(total) ? total + 1 : null };
}

// A player's public 3D profile by leaderboard name (player_profile_3d in
// supabase/001_3d.sql), or null when no player has that name or the player is banned.
export async function playerProfile(name) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), LB.timeout);
  try {
    const res = await fetch(`${LB.url}/rest/v1/rpc/${LB.profile}`, {
      method: 'POST',
      signal: ctl.signal,
      headers: { apikey: LB.key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_name: name }),
    });
    if (!res.ok) return { ok: false, status: res.status };
    return { ok: true, profile: await res.json() };
  } catch {
    return { ok: false, status: 0 };
  } finally {
    clearTimeout(t);
  }
}
