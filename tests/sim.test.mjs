// The simulation on its own, in Node: movement, furniture collision, the fixed tick.

import { Sim } from '../src/sim/game.js';
import { CHARACTERS } from '../data/player.js';
import { FOOT, hurtPlayer } from '../src/sim/player.js';
import { assert } from './harness.mjs';
import { WEAPONS } from '../data/weapons.js';
import { createWeapon, weaponReady } from '../src/sim/weapons/index.js';
import { spawnEnemy, damageEnemy } from '../src/sim/enemies.js';
import { ENEMIES } from '../data/enemies.js';
import { Meta, memoryStore, upgradeSave } from '../src/sim/meta.js';
import { POLICY_ORDER, POLICIES } from '../data/policies.js';
import { combinePolicies, modsString } from '../src/sim/policies.js';
import { MAP_ORDER } from '../data/maps.js';
import { dropTicket } from '../src/sim/pickups.js';
import { readFileSync } from 'node:fs';

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
  ['users touching the tech drain sanity, and burnout ends the shift with its stats', () => {
    const sim = new Sim();
    sim.player.weapons.length = 0; // unarmed, so the users get through
    run(sim, 60, { x: 0, y: 0 });
    assert(sim.over && !sim.over.won, 'never burned out standing still for a minute');
    const t = sim.time;
    run(sim, 1, { x: 1, y: 0 });
    assert(sim.time === t && sim.player.x === sim.player.px, 'the floor kept moving after burnout');
    assert(sim.over.time === t && sim.over.level >= 1 && Array.isArray(sim.over.tools), 'stats are missing');
    sim.newRun();
    assert(!sim.over && sim.time === 0 && sim.player.hp === sim.player.maxHp, 'restart did not reset');
  }],
  ['pausing freezes the floor and resuming carries on', () => {
    const sim = arena(null, 20);
    run(sim, 0.5, still);
    sim.pause();
    const t = sim.time;
    const x = sim.player.x;
    run(sim, 2, { x: 1, y: 0 });
    assert(sim.time === t && sim.player.x === x, 'moved while paused');
    sim.resume();
    run(sim, 0.5, { x: 1, y: 0 });
    assert(sim.time > t && sim.player.x > x, 'did not resume');
  }],
  ['closing users builds a CSAT streak, and getting hurt breaks it', () => {
    const sim = arena(null, 0);
    for (let i = 0; i < 30; i++) sim.score.onKill();
    assert(sim.score.mult === 2 && sim.score.csat > 30 && sim.kills === 30, `x${sim.score.mult}, ${sim.score.csat} CSAT`);
    sim.player.god = false;
    hurtPlayer(sim, 1);
    assert(sim.score.streak === 0 && sim.score.mult === 1 && sim.score.bestStreak === 30, 'streak survived a hit');
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

// Milestone 4: Closed Tickets, level-ups, chests.
tests.push(
  ['closed users drop tickets, and walking over them gives XP', async () => {
    const { killEnemy } = await import('../src/sim/enemies.js');
    const sim = arena(null, 1, 60);
    const e = sim.enemies.items[0];
    killEnemy(sim, e, null);
    assert(sim.tickets.count === 1 && sim.tickets.items[0].value === e.def.xp, 'no ticket for the closed user');
    const xp0 = sim.player.xp;
    run(sim, 2, { x: 1, y: 0 }); // the user was straight to the right
    assert(sim.tickets.count === 0, 'ticket not collected');
    assert(sim.player.xp > xp0, 'no XP');
  }],
  ['a level-up freezes the floor until a card is picked', () => {
    const sim = arena(null, 10, 150);
    sim.debugLevelUp();
    run(sim, STEP, still);
    assert(sim.choices?.length === 4, `${sim.choices?.length} cards`);
    const t = sim.time;
    run(sim, 1, still);
    assert(sim.time === t, 'the floor kept moving');
    const card = sim.choices.find((c) => c.kind === 'weapon' && c.level === 1) ?? sim.choices[0];
    sim.choose(card);
    assert(!sim.choices && sim.player.level === 2, 'cards still up');
    if (card.kind === 'weapon') assert(sim.player.weapons.some((w) => w.id === card.id), 'tool not added');
    run(sim, 0.5, still);
    assert(sim.time > t, 'the floor did not resume');
  }],
  ['level-up cards only offer tools that are ported', async () => {
    const { rollChoices } = await import('../src/sim/upgrades.js');
    const sim = arena(null, 0);
    for (let i = 0; i < 300; i++) {
      for (const c of rollChoices(sim)) if (c.kind === 'weapon') assert(weaponReady(c.id), `offered ${c.id}`);
    }
  }],
  ['a chest evolves a maxed tool with its passive, otherwise gives upgrades', () => {
    const sim = arena('reboot', 0);
    sim.openChest();
    assert(sim.chest && !sim.chest.evolved && sim.chest.upgrades.length >= 1, 'no upgrades from a plain chest');
    sim.closeChest();
    sim.debugEvolveKit();
    sim.openChest();
    assert(sim.chest.evolved, 'nothing evolved');
    assert(sim.player.weapons.some((w) => w.def.evolved), 'no evolved tool');
  }],
  ['Extended Warranty brings the tech back from burnout once', () => {
    const sim = arena(null, 0);
    sim.player.god = false;
    sim.player.warranty = 1;
    sim.player.hp = 0;
    run(sim, STEP, still);
    assert(sim.player.hp > 0 && sim.player.warranty === 0 && !sim.over, 'no comeback');
    sim.player.hp = 0;
    run(sim, STEP, still);
    assert(sim.over, 'came back twice');
  }],
);

// The rest of the horde (M7).
const countOf = (sim, id) => {
  let n = 0;
  for (let i = 0; i < sim.enemies.count; i++) if (!sim.enemies.items[i].dead && sim.enemies.items[i].def === ENEMIES[id]) n++;
  return n;
};
tests.push(
  ['a Phish Clicker releases Malware', () => {
    const sim = arena(null, 0);
    const p = sim.player;
    spawnEnemy(sim, 'phish', p.x + 200, p.y);
    run(sim, 6, still);
    assert(countOf(sim, 'malware') >= 2, `${countOf(sim, 'malware')} malware`);
  }],
  ['a Printer Jammer drops paper jams that slow the tech', () => {
    const sim = arena(null, 0);
    const p = sim.player;
    const e = spawnEnemy(sim, 'jammer', p.x + 300, p.y);
    e.t0 = 0;
    run(sim, STEP * 2, still);
    assert(sim.zones.pool.count === 1, `${sim.zones.pool.count} zones`);
    const z = sim.zones.pool.items[0];
    p.x = z.x;
    p.y = z.y - FOOT;
    run(sim, STEP * 2, still);
    assert(p.slow < 1, `slow ${p.slow}`);
  }],
  ['a VIP speeds up the users around them', () => {
    const sim = arena(null, 0);
    const p = sim.player;
    const vip = spawnEnemy(sim, 'vip', p.x + 400, p.y);
    const near = spawnEnemy(sim, 'pam', vip.x + 30, vip.y);
    const far = spawnEnemy(sim, 'pam', p.x - 400, p.y);
    run(sim, STEP, still);
    assert(near.buff > 1 && far.buff === 1, `buffs ${near.buff} ${far.buff}`);
  }],
  ['Badge Brenda slows the tech while she is close', () => {
    const sim = arena(null, 0);
    const p = sim.player;
    spawnEnemy(sim, 'brenda', p.x + 30, p.y);
    run(sim, STEP * 2, still);
    assert(p.slow < 1, `slow ${p.slow}`);
  }],
);

// --- Milestone 8: bosses and clocking out ----------------------------------------------

import { EVENTS } from '../data/waves.js';

// A boss fight on a bare floor: the boss `d` px to the right, and nothing else spawning.
function bossArena(id, d = 200) {
  const sim = arena(null, 0);
  const p = sim.player;
  const e = spawnEnemy(sim, id, p.x + d, p.y);
  sim.setBoss(e);
  return [sim, e];
}

tests.push(
  ['the Major Incident turns up at 10:00 and the Executive at 20:00', () => {
    const sim = new Sim();
    sim.player.god = true;
    for (const id of ['incident', 'executive']) {
      const ev = EVENTS.find((e) => e.boss === id);
      sim.spawner.nextEvent = EVENTS.indexOf(ev);
      sim.time = ev.t - 0.01;
      run(sim, STEP * 3, still);
      assert(sim.bossAlive() && sim.boss.def === ENEMIES[id], `no ${id} at ${ev.t}`);
      sim.boss.dead = true;
    }
  }],
  ['the Major Incident rings with a gap to stand in, and calls in status updates', () => {
    const [sim, e] = bossArena('incident');
    e.ai.ringIn = 0;
    e.ai.minionsIn = 0;
    run(sim, STEP, still);
    assert(e.ai.state === 1, `state ${e.ai.state}`);
    const gap = e.ai.gapAngle;
    run(sim, e.params.ringTelegraph + STEP * 2, still);
    const bl = sim.hazards.bullets;
    assert(bl.count > 10, `${bl.count} phones`);
    const half = (e.params.ringGap * Math.PI) / e.params.ringBullets;
    for (let i = 0; i < bl.count; i++) {
      let rel = Math.atan2(bl.items[i].vy, bl.items[i].vx) - gap;
      rel -= Math.round(rel / (Math.PI * 2)) * Math.PI * 2;
      assert(Math.abs(rel) >= half - 1e-6, `a phone flew through the gap (${rel.toFixed(2)})`);
    }
    assert(countOf(sim, 'status_update') >= e.params.minionCount, `${countOf(sim, 'status_update')} status updates`);
  }],
  ['a ringing phone hurts the tech', () => {
    const [sim] = bossArena('incident', 400);
    const p = sim.player;
    p.god = false;
    sim.hazards.bullet(p.x - 30, p.y, 0, 100, 10, 'hazard_phone');
    run(sim, 0.5, still);
    assert(p.hp < p.maxHp, `sanity ${p.hp}`);
    assert(sim.hazards.bullets.count === 0, 'the phone kept flying');
  }],
  ['at half health the Major Incident goes SEV 0', () => {
    const banners = [];
    const [sim, e] = bossArena('incident');
    sim.banner = (t) => banners.push(t);
    e.hp = e.maxHp * 0.49;
    run(sim, STEP, still);
    assert(e.angry && sim.bossPhase2, 'not enraged');
    assert(banners.includes('SEV 0'), banners.join());
  }],
  ['a non-final boss drops a Change Approved chest', () => {
    const [sim, e] = bossArena('incident');
    damageEnemy(sim, e, e.hp + 1, null, 0, 0, 0);
    assert(!sim.bossAlive(), 'still alive');
    let chests = 0;
    for (let i = 0; i < sim.items.count; i++) if (sim.items.items[i].id === 'chest') chests++;
    assert(chests === 1, `${chests} chests`);
    assert(!sim.victoryT, 'the Incident ended the shift');
  }],
  ['the Executive escalates through its phases', () => {
    const banners = [];
    const [sim, e] = bossArena('executive');
    sim.banner = (t) => banners.push(t);
    e.hp = e.maxHp * 0.6;
    run(sim, STEP, still);
    assert(e.ai.phase === 1 && banners.includes('ESCALATED'), `phase ${e.ai.phase} ${banners}`);
    e.hp = e.maxHp * 0.3;
    run(sim, STEP, still);
    assert(e.ai.phase === 2 && sim.bossPhase2 && banners.includes('FINAL PHASE'), `phase ${e.ai.phase} ${banners}`);
  }],
  ['the Executive charges down its lane and its meetings go off', () => {
    const [sim, e] = bossArena('executive', 150);
    const p = sim.player;
    p.god = false;
    // Charge: locked on to the tech, so standing still gets you hit.
    e.ai.attackIn = 0;
    e.params = { ...e.params, attacks: [['charge']] };
    run(sim, STEP, still);
    assert(e.ai.state === 1, `state ${e.ai.state}`);
    run(sim, e.params.charge.telegraph + e.params.charge.time, still);
    assert(p.hp < p.maxHp, 'the charge missed a tech standing still');
    // Calendar Tetris: a 5 x 5 checkerboard of meetings round the tech.
    p.hp = p.maxHp;
    p.invuln = 0;
    sim.hazards.clear();
    e.ai.state = 0;
    e.ai.attackIn = 0;
    e.ai.lastAttack = '';
    e.params = { ...e.params, attacks: [['calendar']] };
    run(sim, STEP, still);
    const c = e.params.calendar;
    assert(sim.hazards.bombs.count === c.size * c.size, `${sim.hazards.bombs.count} meetings`);
    run(sim, c.delay2 + STEP * 2, still);
    assert(sim.hazards.bombs.count === 0, 'meetings left over');
    assert(p.hp < p.maxHp, 'standing in a meeting did no harm');
  }],
  ['closing the Executive clocks you out', () => {
    const [sim, e] = bossArena('executive');
    const p = sim.player;
    for (let i = 0; i < 30; i++) spawnEnemy(sim, 'pam', p.x - 100, p.y + i);
    sim.time = 1250;
    damageEnemy(sim, e, e.hp + 1, null, 0, 0, 0);
    assert(sim.victoryT > 0 && sim.spawner.stopped, 'the shift did not end');
    run(sim, STEP * 2, still);
    assert(sim.enemies.count === 0, `${sim.enemies.count} users still on the floor`);
    assert(!sim.over, 'the summary came up straight away');
    run(sim, 4, still);
    assert(sim.over?.won === true, 'not won');
  }],
);

// Progression: the save, Overtime Pay, the shop, techs and their perks.
tests.push(
  ['a shift pays Overtime Pay into the save, with records', () => {
    const store = memoryStore();
    const sim = new Sim({}, new Meta(store));
    sim.floor.solid = false;
    sim.player.god = true;
    sim.player.xpNeed = Infinity; // no level-up cards to stop the clock
    run(sim, 125, { x: 0, y: 0 });
    sim.player.god = false;
    sim.player.hp = -1;
    sim.tick(STEP, { x: 0, y: 0 });
    const o = sim.over;
    assert(o && !o.won, 'no burnout');
    assert(o.pay >= 24 && o.balance === o.pay, `paid ${o.pay}, balance ${o.balance}`); // 12 per minute and more
    assert(o.records.includes('time'), 'no time record');
    assert(o.review.rating && o.review.lines.length === 3, 'no review');
    assert(o.timeline.points.length > 20, 'no timeline');
    // It's in the store: a new Meta from it sees the same save.
    const again = new Meta(store);
    assert(again.data.pay === o.pay && again.data.shifts === 1, 'not saved');
    assert(again.data.achievements.first_shift, 'no Onboarding Complete');
  }],
  ['the shop and hiring spend pay, and the next shift uses them', () => {
    const meta = new Meta();
    meta.data.pay = 1000;
    assert(meta.buy('chair') && meta.level('chair') === 1 && meta.data.pay === 940, 'chair');
    assert(!meta.unlock('cloud'), 'hired a $3,000 tech for $940');
    assert(meta.unlock('desktop') && meta.data.selected === 'desktop' && meta.data.pay === 640, 'desktop');
    const sim = new Sim({}, meta);
    assert(sim.charId === 'desktop' && sim.player.maxHp === 100, `maxHp ${sim.player.maxHp}`); // 90 + chair
  }],
  ['map-win unlocks wait for their map, and each win opens the next map', () => {
    const meta = new Meta();
    assert(meta.mapUnlocked('office') && !meta.mapUnlocked('server'), 'maps');
    assert(!meta.selectMap('server') && meta.data.map === 'office', 'picked a locked map');
    // What a Server Room win unlocks waits for it.
    assert(!meta.itemUnlocked('tools', 'replyAll') && !meta.itemUnlocked('characters', 'neteng'), 'Server Room unlocks open early');
    const r = meta.finishShift({ won: true, map: 'office', time: 1250, kills: 5000, csat: 90000, tools: [] });
    assert(r.newMap === 'server' && meta.mapUnlocked('server') && meta.selectMap('server'), `office win opened ${r.newMap}`);
    const r2 = meta.finishShift({ won: true, map: 'server', time: 1250, kills: 5000, csat: 90000, tools: [] });
    assert(r2.newMap === 'callcenter' && meta.itemUnlocked('tools', 'replyAll') && r2.newUnlocks.some((u) => u.id === 'neteng'), 'server win');
  }],
  ['the IT Director starts with Delegate and earns more', () => {
    const sim = new Sim({}, new Meta());
    sim.meta.data.unlocked.push('director');
    sim.newRun('director');
    assert(sim.player.weapons.map((w) => w.id).join() === 'outOfOffice,delegate', sim.player.weapons.map((w) => w.id).join());
    const plain = new Meta().finishShift({ won: false, map: 'office', time: 600, kills: 0, csat: 0, tools: [] }).pay;
    const boss = new Meta().finishShift({ won: false, map: 'office', time: 600, kills: 0, csat: 0, tools: [], payMult: 1.25 }).pay;
    assert(boss === Math.floor(plain * 1.25), `${boss} vs ${plain}`);
  }],
  ['the Cloud Engineer gets stronger every minute', () => {
    const sim = new Sim();
    sim.newRun('cloudEng');
    const d0 = sim.player.stats.damage;
    sim.player.god = true;
    sim.spawner.stopped = true;
    run(sim, 121, { x: 0, y: 0 });
    assert(Math.abs(sim.player.stats.damage - d0 - 0.04) < 1e-9, `${d0} -> ${sim.player.stats.damage}`);
  }],
  ['the Security Manager phishing test stuns users on screen', () => {
    const sim = new Sim();
    sim.newRun('secmgr');
    sim.player.god = true;
    sim.debugClear();
    const e = spawnEnemy(sim, 'pam', sim.player.x + 100, sim.player.y);
    sim.perkT.phishTest = 59.99;
    sim.tick(STEP, { x: 0, y: 0 });
    assert(e.stun > 0.5, `stun ${e.stun}`);
  }],
  ['an old or broken save is cleaned up', () => {
    const d = upgradeSave({ pay: -5, unlocked: ['nobody'], selected: 'nobody', shop: { chair: 99, gone: 2 } });
    assert(d.pay === 0 && d.selected === 'tier1' && d.unlocked.join() === 'tier1', JSON.stringify(d));
    assert(d.shop.chair === 5 && !('gone' in d.shop), JSON.stringify(d.shop));
  }],
);

// Milestone 11: the other maps.
// A shift on `map` with a save that has every map open.
function onMap(map) {
  const meta = new Meta();
  meta.data.mapsWon.push('office', 'server', 'callcenter', 'garage');
  meta.selectMap(map);
  const sim = new Sim({}, meta);
  sim.player.god = true;
  return sim;
}

tests.push(
  ['each map has its own floor, solid furniture, and starts the tech off it', () => {
    const solid = { server: 0, callcenter: 0, garage: 0, merger: 0 };
    for (const map of Object.keys(solid)) {
      const sim = onMap(map);
      assert(sim.mapId === map && sim.floor.style === map, `${map}: style ${sim.floor.style}`);
      assert(!sim.floor.blocked(sim.player.x, sim.player.y + FOOT), `${map}: started inside furniture`);
      for (let cx = -3; cx <= 3; cx++) for (let cy = -3; cy <= 3; cy++) solid[map] += sim.floor.layout(cx, cy).solids.length;
      assert(solid[map] > 10, `${map}: only ${solid[map]} solid rects`);
    }
  }],
  ['Server Room hot aisles drain sanity and speed the tech up', () => {
    const sim = onMap('server');
    sim.player.god = false;
    sim.spawner.update = () => {};
    let hot = null;
    for (let cx = 0; cx < 10 && !hot; cx++) hot = sim.floor.layout(cx, 0).hot;
    assert(hot, 'no hot aisle nearby');
    const p = sim.player;
    p.x = hot[0] + hot[2] / 2;
    p.y = hot[1] + hot[3] / 2 - FOOT;
    p.invuln = 0;
    sim.tick(STEP, still);
    assert(sim.twist.hot && p.hp < p.maxHp, `hot ${sim.twist.hot}, hp ${p.hp}`);
    assert(Math.abs(p.slow - 1.3) < 1e-9, `slow ${p.slow}`);
  }],
  ['Call Center desk phones go off near the tech', () => {
    const sim = onMap('callcenter');
    sim.spawner.update = () => {};
    run(sim, 5, still);
    assert(sim.hazards.bombs.count >= 1, 'no phone rang');
    const b = sim.hazards.bombs.items[0];
    assert(Math.hypot(b.x - sim.player.x, b.y - sim.player.y) <= 141, 'phone too far away');
  }],
  ['Merger Day: the parent company takes over more floor, with tougher users and double tickets on it', () => {
    const sim = onMap('merger');
    run(sim, 0.1, still);
    const start = sim.floor.share;
    sim.time = 125;
    run(sim, 0.1, still);
    assert(Math.abs(start - 0.3) < 1e-9 && sim.floor.share > start, `share ${start} -> ${sim.floor.share}`);
    let acquired = null;
    let legacy = null;
    for (let cx = -6; cx <= 6; cx++)
      for (let cy = -6; cy <= 6; cy++) {
        if (sim.floor.acquiredChunk(cx, cy)) acquired ??= [cx * 256 + 128, cy * 256 + 128];
        else legacy ??= [cx * 256 + 128, cy * 256 + 128];
      }
    const a = spawnEnemy(sim, 'pam', ...acquired, 1);
    const b = spawnEnemy(sim, 'pam', ...legacy, 1);
    assert(Math.abs(a.maxHp / b.maxHp - 1.2) < 1e-9, `hp ${a.maxHp} vs ${b.maxHp}`);
    assert(sim.twist.xpMult(sim, ...acquired) === 2 && sim.twist.xpMult(sim, ...legacy) === 1, 'tickets');
    // Moving boxes keep turning up, three at most.
    sim.spawner.update = () => {};
    sim.player.weapons = [];
    run(sim, 90, still);
    let boxes = 0;
    for (let i = 0; i < sim.enemies.count; i++) if (sim.enemies.items[i].def.anchored) boxes++;
    assert(boxes === 3, `${boxes} boxes`);
  }],
  ['Merger Day brings its own users, and the Server Room more Shadow IT', () => {
    const count = (map, t) => {
      const sim = onMap(map);
      sim.time = t;
      const seen = {};
      for (let i = 0; i < 4000; i++) {
        const e = sim.spawner.spawn(sim);
        seen[e.def.sprite] = (seen[e.def.sprite] ?? 0) + 1;
        e.dead = true;
        sim.enemies.compact();
      }
      return seen;
    };
    const merger = count('merger', 300);
    assert(merger.dave > 100 && merger.consultant > 50 && merger.brenda > 50, JSON.stringify(merger));
    const office = count('office', 300);
    assert(!office.dave && !office.brenda, 'Merger Day users in the office');
    const server = count('server', 900);
    const office2 = count('office', 900);
    assert(server.steve > office2.steve * 1.2, `steve ${server.steve} vs ${office2.steve}`);
  }],
  ['each map has its own boss at 10:00', () => {
    const want = { office: 'incident', server: 'ratsnest', callcenter: 'caller', garage: 'janitor', merger: 'takeover' };
    for (const [map, boss] of Object.entries(want)) {
      const sim = onMap(map);
      sim.time = 599.9;
      run(sim, 0.2, still);
      assert(sim.bossAlive() && sim.boss.def.sprite === boss, `${map}: ${sim.boss?.def.sprite}`);
    }
  }],
  ["the Rat's Nest splits into three, and the fight lasts until all are down", () => {
    const sim = onMap('server');
    sim.debugBoss();
    const e = sim.boss;
    damageEnemy(sim, e, e.maxHp * 0.55, null, 0, 0, 0);
    run(sim, 0.1, still);
    assert(sim.bossParts.length === 3 && e.ai.small, `${sim.bossParts.length} pieces`);
    for (const [part] of sim.bossParts) damageEnemy(sim, part, part.hp + 1, null, 0, 0, 0);
    run(sim, 0.1, still);
    assert(!sim.bossAlive() && sim.items.count > 0, 'no chest after the last nest');
  }],
  ['the Night Janitor turns the lights out, and leaves wet floor', () => {
    const sim = onMap('garage');
    sim.spawner.update = () => {};
    sim.debugBoss();
    const e = sim.boss;
    e.ai.lastAttack = 'mop';
    for (let i = 0; i < 20 && sim.twist.dimT <= 0; i++) {
      e.ai.attackIn = 0;
      e.ai.state = 0;
      e.ai.lastAttack = '';
      run(sim, 0.7, still);
    }
    assert(sim.twist.dimT > 0, 'lights stayed on');
    let wet = 0;
    for (let i = 0; i < sim.zones.pool.count; i++) if (sim.zones.pool.items[i].slip) wet++;
    assert(wet > 0, 'no wet floor');
  }],
  ['the Hostile Takeover absorbs users, and spins off a Subsidiary', () => {
    const sim = onMap('merger');
    sim.spawner.update = () => {};
    sim.debugBoss();
    sim.player.weapons = [];
    const e = sim.boss;
    e.hp = e.maxHp * 0.6;
    for (let i = 0; i < 6; i++) spawnEnemy(sim, 'pam', e.x + 4, e.y + 2, 1);
    e.ai.absorbBudget = 6;
    run(sim, STEP, still);
    assert(e.hp > e.maxHp * 0.6 && e.scale > 1, `hp ${e.hp / e.maxHp}, scale ${e.scale}`);
    damageEnemy(sim, e, e.maxHp * 0.2, null, 0, 0, 0);
    run(sim, 0.1, still);
    assert(sim.bossParts.length === 2 && sim.bossParts[1][0].def.sprite === 'subsidiary', 'no Subsidiary');
  }],
);

// --- Shift Policies, Hardcore and the training shift (M12) -----------------------------
// A shift with these policies (and maybe Hardcore), as if picked in the Clock In picker.
function withPolicies(ids, hardcore = false) {
  const meta = new Meta(memoryStore());
  meta.data.mapsWon = [...MAP_ORDER]; // every policy and Hardcore open
  meta.data.shifts = 1;
  meta.data.policyUnlocks = ['changeFreeze'];
  meta.setPolicies(ids);
  meta.setHardcore(hardcore);
  return new Sim({}, meta);
}

tests.push(
  ['every Shift Policy runs a shift', () => {
    for (const id of POLICY_ORDER) {
      const sim = withPolicies([id]);
      assert(sim.policy.ids[0] === id, `${id} not applied`);
      run(sim, 30, { x: 1, y: 0.3 });
      assert(sim.time > 0, id);
    }
  }],
  ['policies change slots, stats and starting tools', () => {
    assert(withPolicies(['budgetCuts']).player.maxWeapons === 4, 'Budget Cuts');
    assert(withPolicies(['hiringFreeze']).player.maxPassives === 3, 'Hiring Freeze');
    const glass = withPolicies(['glassDesk']).player;
    assert(glass.maxHp === Math.round(glass.baseMaxHp * 0.6), `Glass Desk max sanity ${glass.maxHp}`);
    assert(withPolicies(['auditWeek']).player.stats.damageTaken === 2, 'Audit Week');
    const lock = withPolicies(['vendorLockIn']).player;
    assert(lock.weapons.length === 2 && lock.weapons.every((w) => w.level === 3) && lock.maxWeapons === 2, 'Vendor Lock-In');
    assert(withPolicies(['onboardingBuddy']).player.weapons.length === 2, 'Onboarding Buddy');
    assert(withPolicies(['longWeekend']).player.longWeekend === 1, 'Long Weekend');
    assert(withPolicies(['hotDesking']).policy.cards === 2, 'Hot Desking');
  }],
  ['policies toughen users and bosses', () => {
    const sim = withPolicies(['mandatoryFun', 'casualFriday', 'escalated']);
    const plain = withPolicies([]);
    const e = spawnEnemy(sim, 'pam', 100, 0, 1);
    const e0 = spawnEnemy(plain, 'pam', 100, 0, 1);
    assert(Math.abs(e.maxHp / e0.maxHp - 1.4) < 1e-6, `hp ${e.maxHp}`);
    assert(Math.abs(e.speed / e0.speed - 1.25) < 1e-6, `speed ${e.speed}`);
    const boss = spawnEnemy(sim, 'executive', 200, 0, 1);
    const boss0 = spawnEnemy(plain, 'executive', 200, 0, 1);
    assert(Math.abs(boss.maxHp / boss0.maxHp - 1.5) < 1e-6, `boss hp ${boss.maxHp}`);
    assert(sim.policy.mult === 2.28, `mult ${sim.policy.mult}`); // 1.3 * 1.3 * 1.35
  }],
  ['Monday Morning starts the queue busy; Ticket Blitz tickets vanish', () => {
    const monday = withPolicies(['mondayMorning']);
    assert(monday.spawner.busyTime(monday) === 180, 'no head start');
    const blitz = withPolicies(['ticketBlitz']);
    blitz.spawner.update = () => {};
    blitz.player.weapons = [];
    dropTicket(blitz, blitz.player.x + 400, blitz.player.y, 1);
    run(blitz, 9, still);
    assert(blitz.tickets.count === 1, 'ticket gone too soon');
    run(blitz, 2, still);
    assert(blitz.tickets.count === 0, 'ticket stayed');
  }],
  ['Hardcore: more users, no Union Rep, no Extended Warranty, double score', () => {
    const sim = withPolicies(['workFromHome', 'budgetCuts'], true);
    assert(sim.policy.hardcore && sim.policy.ids.join() === 'budgetCuts', 'perks are off in Hardcore');
    assert(sim.policy.spawns === 1.5 && sim.policy.otGrace === 120, 'Hardcore effects');
    assert(sim.player.revives === 0, 'Union Rep in Hardcore');
    assert(sim.player.locked('passives', 'warranty'), 'Extended Warranty on offer');
    assert(sim.policy.mult === 2.7, `mult ${sim.policy.mult}`);
    run(sim, 5, still);
    sim.player.hp = 0;
    run(sim, STEP, still);
    assert(sim.over && sim.over.hardcore && sim.over.score === Math.round(sim.over.csat * 2.7), 'score not multiplied');
  }],
  ['the training shift teaches, never burns out, and finishes', () => {
    const cards = [];
    const sim = new Sim({ coach: (c) => cards.push(c) });
    sim.startTutorial();
    assert(sim.spawner.stopped && sim.policy.ids.length === 0 && sim.mapId === 'office', 'not a plain Office shift');
    sim.floor.solid = false; // walking straight at the pizza could get stuck on a cubicle row
    let a = 0;
    for (let i = 0; i < 60 * 240 && !sim.over; i++) {
      if (sim.choices) sim.choose(sim.choices[0]);
      if (sim.chest) sim.closeChest(); // a user can drop one
      a += 0.01;
      // Walk in a circle to learn moving, walk to any pizza, and otherwise stand still and
      // let the users come to the tools.
      const pz = sim.items.items.slice(0, sim.items.count).find((it) => it.id === 'pizza');
      const ax = pz
        ? { x: Math.sign(pz.x - sim.player.x), y: Math.sign(pz.y - sim.player.y) }
        : sim.tutorial.current?.id === 'move' ? { x: Math.cos(a), y: Math.sin(a) } : still;
      sim.tick(STEP, ax);
      assert(sim.player.hp > 0, 'burned out in training');
    }
    assert(sim.over?.training, `training didn't finish (step ${sim.tutorial.step})`);
    assert(sim.meta.data.trained && sim.meta.data.shifts === 0, 'training counted as a shift');
    assert(cards.filter(Boolean).length === 5 && cards[cards.length - 1] === null, `${cards.length} coach cards`);
  }],
  ['the leaderboard accepts every map, and a shift\'s policies fit its checks', () => {
    // supabase/001_3d.sql refuses unknown maps: its list must match data/maps.js.
    const sql = readFileSync(new URL('../supabase/001_3d.sql', import.meta.url), 'utf8');
    const list = sql.match(/map in \(([^)]*)\)/)[1].match(/'([a-z]+)'/g).map((q) => q.slice(1, -1));
    assert(list.join() === MAP_ORDER.join(), `SQL maps ${list} vs ${MAP_ORDER}`);
    // The most a shift can be multiplied by is x6 (Hardcore), and mods are letters and commas.
    const sim = new Sim({}, new Meta());
    sim.meta.data.mapsWon = [...MAP_ORDER];
    sim.newRun(undefined, undefined, combinePolicies(POLICY_ORDER.filter((id) => POLICIES[id].group === 'bad').slice(0, 3), true, true));
    assert(sim.policy.mult <= 6 && sim.policy.mult >= 0.5, `x${sim.policy.mult}`);
    assert(/^[A-Za-z,]*$/.test(modsString(sim.policy)), modsString(sim.policy));
  }],
);
