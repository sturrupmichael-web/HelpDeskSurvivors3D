// The simulation on its own, in Node: movement, furniture collision, the fixed tick.

import { Sim } from '../src/sim/game.js';
import { CHARACTERS } from '../data/player.js';
import { FOOT } from '../src/sim/player.js';
import { assert } from './harness.mjs';
import { WEAPONS } from '../data/weapons.js';
import { createWeapon, weaponReady } from '../src/sim/weapons/index.js';
import { spawnEnemy } from '../src/sim/enemies.js';

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
    sim.player.weapons.length = 0; // unarmed, so the users get through
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
  ['a thousand users and six tools tick in under 2 ms', () => {
    const sim = new Sim();
    sim.player.god = true;
    while (sim.debugAddWeapon());
    sim.debugSkip(900);
    sim.debugSpawn(1000);
    const t = performance.now();
    run(sim, 2, { x: 0.5, y: 0.2 });
    const ms = (performance.now() - t) / 120;
    assert(ms < 2, `${ms.toFixed(2)} ms per tick with ${sim.enemies.count} users`);
  }],
);

// Milestone 3: tools.
const still = { x: 0, y: 0 };
// A bare floor with only the given tool and a ring of users the spawner won't add to.
function arena(id, users = 24, radius = 60) {
  const sim = new Sim();
  sim.floor.solid = false;
  sim.player.god = true;
  sim.spawner.update = () => {};
  sim.enemies.clear();
  sim.player.weapons = id ? [createWeapon(id, 0)] : [];
  const p = sim.player;
  for (let i = 0; i < users; i++) {
    const a = (i / users) * Math.PI * 2;
    const r = radius + (i % 3) * 25;
    spawnEnemy(sim, 'pam', p.x + Math.cos(a) * r, p.y + Math.sin(a) * r, 3);
  }
  return sim;
}

tests.push(
  ['the starter tool closes users', () => {
    const sim = new Sim();
    sim.player.god = true;
    assert(sim.player.weapons[0]?.id === CHARACTERS.tier1.starter, 'no starter tool');
    run(sim, 20, still);
    assert(sim.kills > 0 && sim.player.weapons[0].damageDone > 0, `${sim.kills} users closed`);
  }],
  ['every ported tool hits users', () => {
    const ids = Object.keys(WEAPONS).filter(weaponReady);
    assert(ids.length >= 10, `only ${ids.length} tools ready`);
    for (const id of ids) {
      const sim = arena(id);
      run(sim, 6, still);
      assert(sim.player.weapons[0].damageDone > 0, `${id} did no damage`);
    }
  }],
  ['projectiles expire and go back to the pool', () => {
    const sim = arena('autoClose', 0);
    run(sim, 1, still); // fires the way the tech faces, at nobody
    assert(sim.projectiles.count > 0, 'nothing fired');
    sim.player.weapons.length = 0;
    run(sim, WEAPONS.autoClose.levels[0].life + 0.1, still);
    assert(sim.projectiles.count === 0, `${sim.projectiles.count} projectiles left`);
  }],
  ['KB Articles fly out their range and come back', () => {
    const sim = arena('kbArticle', 0);
    const p = sim.player;
    let far = 0;
    let fired = false;
    for (let i = 0; i < 60 * 2.8; i++) {
      sim.tick(STEP, still);
      const o = sim.projectiles.items[0];
      if (sim.projectiles.count) {
        fired = true;
        far = Math.max(far, Math.hypot(o.x - p.x, o.y - p.y));
      }
    }
    const range = WEAPONS.kbArticle.levels[0].range;
    assert(fired, 'never thrown');
    assert(Math.abs(far - range) < 15, `flew ${far.toFixed(0)} px for a ${range} px range`);
    assert(sim.projectiles.count === 0, 'did not come back');
  }],
  ['the shockwave knocks users back', () => {
    // The same crowd with and without the tool, just after the first pulse (at 0.5 s).
    const avg = (sim) => {
      let d = 0;
      for (let i = 0; i < sim.enemies.count; i++) d += Math.hypot(sim.enemies.items[i].x - sim.player.x, sim.enemies.items[i].y - sim.player.y);
      return d / sim.enemies.count;
    };
    const armed = arena('reboot', 8, 30);
    const bare = arena(null, 8, 30);
    run(armed, 0.8, still);
    run(bare, 0.8, still);
    assert(avg(armed) > avg(bare) + 5, `users ${avg(armed).toFixed(0)} px away, ${avg(bare).toFixed(0)} without the tool`);
  }],
);
