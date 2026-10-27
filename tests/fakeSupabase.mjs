// A pretend Supabase for the online tests: answers the requests src/net/ makes (guest
// sign-up, token refresh, players, scores_3d, saves_3d and player_profile_3d) from memory,
// with the same rules as supabase/001_3d.sql where the game can notice them (names are
// unique ignoring case, a score needs a name and takes it from the account, the board is
// ranked by score). Nothing here reaches the real project.

import { LEADERBOARD } from '../data/leaderboard.js';

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
// A token the game can read (it only decodes the middle part; nothing checks signatures here).
export const token = (sub, { guest = true, email = '' } = {}) => ({
  access_token: `${b64({ alg: 'none' })}.${b64({ sub, is_anonymous: guest, email, exp: Math.floor(Date.now() / 1000) + 3600 })}.sig`,
  refresh_token: `refresh-${sub}`,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
});

export class FakeSupabase {
  constructor() {
    this.players = []; // { user_id, name }
    this.scores = []; // rows of scores_3d
    this.saves = new Map(); // user_id -> { data, updated_at }
    this.signups = 0;
    this.offline = false;
    this.signupError = null; // { status, msg }: guest sign-ups are refused
    this.seq = 0;
  }

  // Routes every request to the project's address on `page` to this fake.
  async attach(page) {
    await page.route(`${LEADERBOARD.url}/**`, (route) => this.handle(route));
  }

  addScore(name, row) {
    const user = this.players.find((p) => p.name === name) ?? { user_id: `seed-${++this.seq}`, name };
    if (!this.players.includes(user)) this.players.push(user);
    this.scores.push({ id: ++this.seq, user_id: user.user_id, name, character: 'Tier 1 Tech', seconds: 300, csat: 0, won: false, mods: '', mult: 1, version: 'seed', created_at: new Date().toISOString(), ...row, score: Math.round(row.csat * (row.mult ?? 1)) });
  }

  async handle(route) {
    const req = route.request();
    const cors = {
      'access-control-allow-origin': '*',
      'access-control-allow-headers': '*',
      'access-control-allow-methods': 'GET, POST, PATCH, HEAD, OPTIONS',
      'access-control-expose-headers': 'content-range',
    };
    if (this.offline) return route.abort();
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    const url = new URL(req.url());
    const auth = req.headers().authorization?.split(' ')[1];
    const uid = auth ? JSON.parse(Buffer.from(auth.split('.')[1], 'base64url').toString()).sub : null;
    const body = req.postData() ? JSON.parse(req.postData()) : null;
    const reply = (status, json, headers = {}) =>
      route.fulfill({ status, headers: { ...cors, 'content-type': 'application/json', ...headers }, body: json === undefined ? '' : JSON.stringify(json) });
    const q = url.searchParams;
    const path = url.pathname;

    if (path === '/auth/v1/signup') {
      if (this.signupError) return reply(this.signupError.status, { code: this.signupError.status, msg: this.signupError.msg });
      this.signups++;
      return reply(200, token(`guest-${++this.seq}`));
    }
    if (path === '/auth/v1/token') return reply(200, token(body.refresh_token.replace('refresh-', '')));
    if (path === '/auth/v1/logout') return reply(204);

    if (path === '/rest/v1/players') {
      const mine = this.players.find((p) => p.user_id === uid);
      if (req.method() === 'GET') return reply(200, mine ? [{ name: mine.name }] : []);
      if (this.players.some((p) => p !== mine && p.name.toLowerCase() === body.name.toLowerCase())) return reply(409, { code: '23505' });
      if (req.method() === 'POST') this.players.push({ user_id: uid, name: body.name });
      else {
        mine.name = body.name;
        for (const s of this.scores) if (s.user_id === uid) s.name = body.name;
      }
      return reply(201);
    }

    if (path === `/rest/v1/${LEADERBOARD.table}`) {
      if (req.method() === 'POST') {
        const p = this.players.find((x) => x.user_id === uid);
        if (!p) return reply(400, { message: 'Pick a leaderboard name first.' });
        this.scores.push({ ...body, id: ++this.seq, user_id: uid, name: p.name, score: Math.round(body.csat * body.mult), created_at: new Date().toISOString() });
        return reply(201);
      }
      let rows = this.scores.filter((s) => s.map === q.get('map')?.replace('eq.', ''));
      if (q.get('mods') === 'eq.') rows = rows.filter((s) => s.mods === '');
      if (q.get('mods')?.startsWith('like.')) rows = rows.filter((s) => s.mods.includes('hardcore'));
      if (q.get('name')) rows = rows.filter((s) => s.name === q.get('name').replace('eq.', ''));
      if (q.get('score')) rows = rows.filter((s) => s.score > Number(q.get('score').replace('gt.', '')));
      rows.sort((a, b) => b.score - a.score || b.seconds - a.seconds);
      if (req.method() === 'HEAD') return reply(200, undefined, { 'content-range': `*/${rows.length}` });
      return reply(200, rows.slice(0, Number(q.get('limit')) || 1000));
    }

    if (path === `/rest/v1/${LEADERBOARD.saves}`) {
      if (!uid) return reply(401, {});
      const at = new Date(Date.now() + ++this.seq).toISOString();
      if (req.method() === 'GET') {
        const s = this.saves.get(uid);
        return reply(200, s ? [s] : []);
      }
      if (req.method() === 'PATCH') {
        const s = this.saves.get(uid);
        if (!s || s.updated_at !== q.get('updated_at')?.replace('eq.', '')) return reply(200, []);
      }
      const row = { data: body.data, updated_at: at };
      this.saves.set(uid, row);
      return reply(201, [row]);
    }

    if (path === `/rest/v1/rpc/${LEADERBOARD.profile}`) {
      const p = this.players.find((x) => x.name.toLowerCase() === body.p_name.toLowerCase());
      if (!p) return reply(200, null);
      const mine = this.scores.filter((s) => s.user_id === p.user_id);
      const maps = [...new Set(mine.map((s) => s.map))];
      return reply(200, {
        name: p.name,
        since: '2026-10-20T12:00:00Z',
        posted: mine.length,
        wins: mine.filter((s) => s.won).length,
        favourite: mine[0]?.character ?? null,
        best: maps.map((map) => {
          const on = mine.filter((s) => s.map === map);
          return { map, csat: Math.max(...on.map((s) => s.csat)), score: Math.max(...on.map((s) => s.score)), clean: null, seconds: Math.max(...on.map((s) => s.seconds)), won: on.some((s) => s.won) };
        }),
        shifts: this.saves.get(p.user_id)?.data.shifts ?? null,
        achievements: Object.keys(this.saves.get(p.user_id)?.data.achievements ?? {}),
      });
    }
    return reply(404, {});
  }
}
