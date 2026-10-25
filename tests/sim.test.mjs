// The simulation on its own, in Node: movement, furniture collision, the fixed tick.

import { Sim } from '../src/sim/game.js';
import { CHARACTERS } from '../data/player.js';
import { FOOT } from '../src/sim/player.js';
import { assert } from './harness.mjs';

const STEP = 1 / 60;
const run = (sim, seconds, axis) => {
  for (let i = 0; i < Math.round(seconds / STEP); i++) sim.tick(STEP, axis);
};

export const tests = [
  ['the tech starts off the furniture', () => {
    const sim = new Sim();
    assert(!sim.floor.blocked(sim.player.x, sim.player.y + FOOT), 'started inside a cubicle');
  }],
  ['the tech walks at their speed', () => {
    const sim = new Sim();
    sim.floor.solid = false;
    const x0 = sim.player.x;
    run(sim, 1, { x: 1, y: 0 });
    const moved = sim.player.x - x0;
    assert(Math.abs(moved - CHARACTERS.tier1.speed) < 0.5, `moved ${moved} px in 1 s`);
    assert(sim.player.facing > 1.5 && sim.player.facing < 1.6, 'faces right');
  }],
  ['cubicle rows block the feet', () => {
    const sim = new Sim();
    // Find a cubicle row and walk into it from below.
    let rect = null;
    for (let cx = 0; cx < 10 && !rect; cx++) rect = sim.floor.solidRects(cx, 0)[0];
    assert(rect, 'no cubicle row found');
    const p = sim.player;
    p.x = rect[0] + rect[2] / 2;
    p.y = rect[1] + rect[3] + 30 - FOOT;
    run(sim, 3, { x: 0, y: -1 });
    assert(!sim.floor.blocked(p.x, p.y + FOOT), 'feet ended inside the row');
    assert(p.y + FOOT >= rect[1] + rect[3], `walked through the row (feet at ${p.y + FOOT}, row ends ${rect[1] + rect[3]})`);
  }],
  ['the layout is the same every time', () => {
    const a = new Sim().floor.solidRects(3, -2);
    const b = new Sim().floor.solidRects(3, -2);
    assert(JSON.stringify(a) === JSON.stringify(b), 'layout differs');
  }],
];

// --- Milestone 2: the horde ----------------------------------------------------------

const insideView = (sim, x, y) => {
  // Inside the (headless, rectangular) view around the player?
  const v = sim.view;
  const p = sim.player;
  return x > p.x - v.left && x < p.x + v.right && y > p.y - v.top && y < p.y + v.bottom;
};

tests.push(
  ['users spawn off screen and close in', () => {
    const sim = new Sim();
    sim.player.god = true;
    run(sim, 1 / 60, { x: 0, y: 0 });
    const pool = sim.enemies;
    assert(pool.count >= 10, `only ${pool.count} users after the first tick`);
    for (let i = 0; i < pool.count; i++) {
      const e = pool.items[i];
      assert(!insideView(sim, e.x, e.y), `user spawned on screen at ${e.x}, ${e.y}`);
    }
    const dist = () => {
      let d = 0;
      for (let i = 0; i < pool.count; i++) d += Math.hypot(pool.items[i].x - sim.player.x, pool.items[i].y - sim.player.y);
      return d / pool.count;
    };
    const d0 = dist();
    run(sim, 3, { x: 0, y: 0 });
    assert(dist() < d0 - 50, 'users did not close in');
  }],
  ['spawn points follow a trapezoid view', () => {
    const sim = new Sim();
    // A 3D-style view: the far (top) edge wider and farther than the near one.
    sim.setView([-300, 250, 300, 250, 520, -420, -520, -420]);
    for (let a = 0; a < Math.PI * 2; a += 0.1) {
      const pt = sim.spawner.ringPoint(sim, a);
      const r = Math.hypot(pt.x - sim.player.x, pt.y - sim.player.y);
      const up = Math.sin(a) < -0.9; // toward the far edge
      const down = Math.sin(a) > 0.9;
      if (up) assert(r > 420, `spawn ${r.toFixed(0)} px away toward the far edge`);
      if (down) assert(r > 250 && r < 400, `spawn ${r.toFixed(0)} px away toward the near edge`);
    }
  }],
  ['users touching the tech drain sanity, and burnout restarts the shift', () => {
    const sim = new Sim();
    const banners = [];
    sim.banner = (t) => banners.push(t);
    run(sim, 60, { x: 0, y: 0 });
    assert(banners.includes('BURNED OUT'), 'never burned out standing still for a minute');
    assert(sim.time < 60, 'the shift did not restart');
  }],
  ['users go round cubicle rows instead of through them', () => {
    const sim = new Sim();
    sim.player.god = true;
    run(sim, 20, { x: 0, y: 0 });
    const pool = sim.enemies;
    let inside = 0;
    for (let i = 0; i < pool.count; i++) {
      const e = pool.items[i];
      if (e.life < 0 && sim.floor.blocked(e.x, e.y + e.foot)) inside++;
    }
    assert(inside === 0, `${inside} users stood inside furniture`);
  }],
  ['Reply-All Randy splits into three when closed', async () => {
    const sim = new Sim();
    const { spawnEnemy, killEnemy } = await import('../src/sim/enemies.js');
    sim.enemies.clear();
    const e = spawnEnemy(sim, 'randy', 300, 300);
    killEnemy(sim, e, null);
    sim.enemies.compact();
    let small = 0;
    for (let i = 0; i < sim.enemies.count; i++) if (sim.enemies.items[i].def.sprite === 'randy_small') small++;
    assert(small === 3, `${small} replies`);
  }],
  ['a thousand users tick in under 2 ms', () => {
    const sim = new Sim();
    sim.player.god = true;
    sim.debugSkip(900);
    sim.debugSpawn(1000);
    const t = performance.now();
    run(sim, 2, { x: 0.5, y: 0.2 });
    const ms = (performance.now() - t) / 120;
    assert(ms < 2, `${ms.toFixed(2)} ms per tick with ${sim.enemies.count} users`);
  }],
);
