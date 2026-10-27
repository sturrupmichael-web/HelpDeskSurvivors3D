// Doom Mode (doom/): it boots to the title, a shift can be finished in badge order, users
// wake up and fight, and the exit leads to the tally. Uses doom.tick() to step the game,
// since headless browsers don't run animation frames on their own.

import { assert } from './harness.mjs';

export const browser = true;
export const pages = ['doom/dev.html', 'doom/index.html'];

// Walks the map as a flood fill, picking up badges and opening the doors they unlock,
// and reports what it couldn't reach.
const REACH = `(() => {
  const L = doom.level, g = doom.game;
  const keys = new Set();
  const start = L.idx(L.col(g.player.x), L.col(g.player.z));
  const keyAt = {};
  for (const p of g.pickups) if (p.def.key) keyAt[L.idx(L.col(p.x), L.col(p.z))] = p.def.key;
  const lo = (j) => { const c = L.cells[j]; if (c.kind === 'lift') return L.lifts[L.liftOf[j]].low; if (c.kind === 'door') return L.doors[L.doorOf[j]].floor; return L.floor[j]; };
  const hi = (j) => { const c = L.cells[j]; if (c.kind === 'lift') return L.lifts[L.liftOf[j]].high; return lo(j); };
  const ceil = (j) => { const c = L.cells[j]; if (c.kind === 'door') return L.doors[L.doorOf[j]].top; return L.cells[j].kind==='lift' ? 99 : L.ceil[j]; };
  let seen, order = [];
  for (let pass = 0; pass < 5; pass++) {
    seen = new Uint8Array(L.cells.length); const q = [start]; seen[start] = 1;
    while (q.length) { const j = q.pop(); if (keyAt[j] && !keys.has(keyAt[j])) { keys.add(keyAt[j]); order.push(keyAt[j]); }
      const c = j % L.w, r = (j / L.w) | 0;
      for (const [dc, dr] of [[1,0],[-1,0],[0,1],[0,-1]]) { const k = L.idx(c+dc, r+dr); const ck = L.cells[k]; if (!ck || seen[k] || ck.kind === 'wall') continue;
        if (ck.kind === 'door') { const d = L.doors[L.doorOf[k]]; if (d.key && !keys.has(d.key)) continue; }
        if (lo(k) > hi(j) + 0.75 && hi(k) > hi(j) + 0.75) { if (!(L.cells[j].kind==='lift' && hi(k) <= hi(j)+0.75)) continue; }
        if (ceil(k) - Math.max(lo(k), hi(j)) < 1.75 && ceil(k) - hi(k) < 1.75) continue;
        seen[k] = 1; q.push(k); } }
  }
  const exitNear = []; for (let j = 0; j < L.cells.length; j++) if (L.cells[j].def?.exit) { const c=j%L.w, r=(j/L.w)|0; exitNear.push([[1,0],[-1,0],[0,1],[0,-1]].some(([dc,dr]) => L.inside(c+dc,r+dr) && seen[L.idx(c+dc,r+dr)])); }
  const secrets = L.secrets.map(s => s.cells.some(j => seen[j]));
  const items = g.pickups.filter(p => !seen[L.idx(L.col(p.x), L.col(p.z))]).map(p => p.id + '@' + L.col(p.x) + ',' + L.col(p.z));
  const mons = g.actors.filter(a => a.counts && !seen[L.idx(L.col(a.x), L.col(a.z))]).map(a => a.type + '@' + L.col(a.x) + ',' + L.col(a.z));
  return JSON.stringify({ order, exit: exitNear, secrets, unreachableItems: items, unreachableMonsters: mons });
})()`;

export const tests = [
  ['boots to the title with no errors', async (page) => {
    await page.evaluate(() => doom.tick(10));
    assert(await page.evaluate(() => doom.mode) === 'title', 'not on the title screen');
    assert(page.errors.length === 0, page.errors.join('\n'));
  }],
  ['the level can be finished: every badge, item, user, secret and the exit can be reached', async (page) => {
    const r = JSON.parse(await page.evaluate(REACH));
    assert(r.order.join() === 'blue,yellow,red', `badges found in order ${r.order}`);
    assert(r.exit.every(Boolean), 'the exit switch is out of reach');
    assert(r.secrets.every(Boolean), 'a secret is out of reach');
    assert(r.unreachableItems.length === 0, `unreachable items: ${r.unreachableItems}`);
    assert(r.unreachableMonsters.length === 0, `unreachable users: ${r.unreachableMonsters}`);
  }],
  ['harder skills bring more users', async (page) => {
    const counts = await page.evaluate(() => [3, 4].map((s) => { doom.start(s); return doom.game.stats.totalKills; }));
    assert(counts[0] > 30 && counts[1] > counts[0], `kills to make: ${counts}`);
  }],
  ['gunfire wakes users, and they come and hurt you', async (page) => {
    const r = await page.evaluate(() => {
      doom.start(3);
      const g = doom.game;
      g.player.x = 36 * 2 + 1;
      g.player.z = 40 * 2 + 1;
      g.noise(20);
      doom.tick(300);
      return { awake: g.actors.filter((a) => a.monster && a.state !== 'idle').length, health: g.player.health };
    });
    assert(r.awake > 0, 'nobody woke up');
    assert(r.health < 100, 'nobody hurt the player');
  }],
  ['users you hurt die and count as kills', async (page) => {
    const r = await page.evaluate(() => {
      doom.start(3);
      const g = doom.game;
      const pam = g.actors.find((a) => a.type === 'pam');
      g.damageActor(pam, 999, g.player);
      doom.tick(30);
      return { dead: pam.dead, kills: g.stats.kills };
    });
    assert(r.dead && r.kills === 1, JSON.stringify(r));
  }],
  ['the exit switch leads to the tally, then back to the title', async (page) => {
    const r = await page.evaluate(() => {
      doom.start(3);
      const g = doom.game;
      g.player.x = 74 * 2 + 1;
      g.player.z = 47 * 2 + 1;
      g.player.yaw = -Math.PI / 2; // facing east, at the switch
      g.use();
      doom.tick(60);
      const mode = doom.mode;
      doom.input.queue.push('use');
      doom.tick(1);
      doom.input.queue.push('use');
      doom.tick(1);
      return { mode, after: doom.mode };
    });
    assert(r.mode === 'tally' && r.after === 'title', JSON.stringify(r));
    assert(page.errors.length === 0, page.errors.join('\n'));
  }],
];
