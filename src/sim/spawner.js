// Wave spawner: reads data/waves.js, spawns enemies just outside the visible floor, keeps
// a minimum horde alive, runs scripted events, and recycles stragglers. Ported from the
// original's src/game/spawner.js. What changed for 3D:
// - The visible floor is a trapezoid (the far edge is wider), not a rectangle, so spawn
//   points sit just outside that shape (game.view, kept up to date by the renderer), with
//   extra padding so a standing figure's head doesn't poke in at the bottom edge.
// - Only users whose behavior has been ported spawn (`ready`); the others are left out of
//   the mix, and boss events whose boss isn't ported are skipped.

import { TIMELINE, EVENTS, SPAWNER, SHIFT_LENGTH, OVERTIME } from '../../data/waves.js';
import { ENEMIES } from '../../data/enemies.js';
import { BEHAVIORS } from './behaviors/index.js';
import { spawnEnemy } from './enemies.js';

const HEAD_ROOM = 40; // world px added to SPAWNER.ringPadding: a user is ~2.5 units tall

const ready = (id) => !!ENEMIES[id] && !!BEHAVIORS[ENEMIES[id].behavior] && !ENEMIES[id].boss;

// A mix with the users that can't spawn yet taken out (cached per mix).
const readyMixes = new WeakMap();
function readyMix(mix) {
  let m = readyMixes.get(mix);
  if (!m) {
    m = {};
    for (const id in mix) if (ready(id)) m[id] = mix[id];
    readyMixes.set(mix, m);
  }
  return m;
}

function mixAt(t) {
  let m = TIMELINE[0].mix;
  for (const k of TIMELINE) if (k.t <= t) m = k.mix;
  return readyMix(m);
}

const hasKeys = (o) => {
  for (const _ in o) return true;
  return false;
};

// The timeline mix with the current map's mixBoost applied, plus the map's own users
// (newUsers) that have started showing up by time t. Cached per mix, map and how many
// of the map's users are in.
const boosted = new WeakMap();
function mapMix(mix, map, t) {
  if (!map) return mix;
  const extra = map.newUsers ?? {};
  let n = 0;
  for (const id in extra) if (t >= extra[id].from) n++;
  if (!n && !hasKeys(map.mixBoost)) return mix;
  let byMap = boosted.get(mix);
  if (!byMap) boosted.set(mix, (byMap = new Map()));
  let list = byMap.get(map);
  if (!list) byMap.set(map, (list = []));
  let m = list[n];
  if (!m) {
    m = {};
    let total = 0;
    for (const id in mix) total += m[id] = mix[id] * (map.mixBoost[id] ?? 1);
    Object.keys(extra)
      .slice(0, n)
      .filter(ready)
      .forEach((id) => (m[id] = total * extra[id].share));
    list[n] = m;
  }
  return m;
}

// Each office map can swap the event marked `mapBoss` (the 10:00 boss) for its own
// (`boss` in data/maps.js). Cached, so the merged event isn't rebuilt every tick.
const mapEvents = new WeakMap();
export function mapEvent(ev, map) {
  if (!ev?.mapBoss || !map.boss) return ev;
  let byMap = mapEvents.get(ev);
  if (!byMap) mapEvents.set(ev, (byMap = new Map()));
  if (!byMap.has(map)) byMap.set(map, { ...ev, ...map.boss });
  return byMap.get(map);
}

// A Shift Policy's mixBoost (Reply-All Day, Phishing Simulation) on top of the map's mix.
// Cached per mix and policy.
const policyMixes = new WeakMap();
function policyMix(mix, policy) {
  if (!hasKeys(policy.mixBoost)) return mix;
  let byPolicy = policyMixes.get(mix);
  if (!byPolicy) policyMixes.set(mix, (byPolicy = new WeakMap()));
  let m = byPolicy.get(policy);
  if (!m) {
    m = {};
    for (const id in mix) m[id] = mix[id] * (policy.mixBoost[id] ?? 1);
    byPolicy.set(policy, m);
  }
  return m;
}

function pick(mix) {
  let total = 0;
  for (const id in mix) total += mix[id];
  let r = Math.random() * total;
  for (const id in mix) if ((r -= mix[id]) <= 0) return id;
  return Object.keys(mix)[0];
}

export class Spawner {
  constructor() {
    this.pt = { x: 0, y: 0 };
    this.reset();
  }

  reset() {
    this.acc = 0;
    this.nextEvent = 0; // index into EVENTS
    this.done = new Set(); // events already run early by a playtest key (skipped when their time comes)
    this.warned = -1;
    this.storm = null; // active storm: { ev, left, t }
    this.bossScale = 1; // spawn-rate multiplier while a boss is up (event's spawnScale)
    this.stopped = false; // the shift is over: no more spawns
    this.otShown = 0; // overtime level the player has been warned about
  }

  // Linearly interpolated timeline value at time t.
  sample(t, key) {
    let a = TIMELINE[0];
    for (const k of TIMELINE) {
      if (k.t > t) return a[key] + (k[key] - a[key]) * ((t - a.t) / (k.t - a.t || 1));
      a = k;
    }
    return a[key];
  }

  // A point just outside the visible floor, in direction `angle` from the player. The
  // view's corners (game.view.corners, world px relative to the point the camera looks at)
  // make a convex shape around the player; walk out to its edge, then pad.
  ringPoint(game, angle = Math.random() * Math.PI * 2) {
    const c = game.view.corners;
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);
    let t = 0;
    for (let i = 0; i < 4; i++) {
      const ax = c[i * 2];
      const ay = c[i * 2 + 1];
      const ex = c[((i + 1) % 4) * 2] - ax;
      const ey = c[((i + 1) % 4) * 2 + 1] - ay;
      // Solve origin + t*d = a + u*e for t >= 0, 0 <= u <= 1.
      const den = dx * ey - dy * ex;
      if (Math.abs(den) < 1e-9) continue;
      const tt = (ax * ey - ay * ex) / den;
      const u = (ax * dy - ay * dx) / den;
      if (tt > t && u >= 0 && u <= 1) t = tt;
    }
    const r = t + SPAWNER.ringPadding + HEAD_ROOM;
    this.pt.x = game.player.x + dx * r;
    this.pt.y = game.player.y + dy * r;
    return this.pt;
  }

  // Monday Morning (policy): the queue (how many users, how fast they come, who they are
  // and how tough) starts as it is at `headStart`.
  busyTime(game) {
    return Math.max(game.time, game.policy.headStart);
  }

  // Overtime level (data/waves.js OVERTIME): 0 until the grace period after 20:00 runs out,
  // then 1, 2, 3... one more each minute.
  overtimeLevel(game) {
    const t = game.time - SHIFT_LENGTH - (game.policy.otGrace ?? OVERTIME.grace); // Hardcore: shorter grace
    return t < 0 || game.tutorial ? 0 : 1 + Math.floor(t / OVERTIME.every);
  }

  spawn(game, id, angle) {
    const t = game.time;
    const pt = this.ringPoint(game, angle);
    id ??= pick(policyMix(mapMix(mixAt(this.busyTime(game)), game.map, t), game.policy));
    const ot = this.overtimeLevel(game);
    const hp = this.sample(this.busyTime(game), 'hpMult') * (1 + OVERTIME.hpPerLevel * ot);
    const speed = this.sample(t, 'speedMult') * (1 + Math.min(OVERTIME.maxSpeed, OVERTIME.speedPerLevel * ot));
    const e = spawnEnemy(game, id, pt.x, pt.y, hp, speed);
    if (e && ot) e.damage *= 1 + OVERTIME.damagePerLevel * ot;
    return e;
  }

  update(game, dt) {
    if (this.stopped) return;
    this.events(game, dt);
    const ot = this.overtimeLevel(game);
    if (ot > this.otShown) {
      this.otShown = ot;
      if (ot === 1) game.banner('UNPAID OVERTIME', "Every minute you're still here, the users get tougher.", 4);
      game.sfx('warn');
    }
    const scale = (game.bossAlive() ? this.bossScale : 1) * (1 + OVERTIME.spawnPerLevel * ot) * game.policy.spawns; // Hardcore: more users
    const busy = this.busyTime(game);
    this.acc += this.sample(busy, 'rate') * scale * dt;
    const min = this.sample(busy, 'minAlive') * scale;
    while (game.enemies.count < min && game.enemies.count < SPAWNER.maxEnemies) this.spawn(game);
    while (this.acc >= 1) {
      this.acc -= 1;
      if (game.enemies.count < SPAWNER.maxEnemies) this.spawn(game);
    }
    this.recycle(game);
  }

  events(game, dt) {
    const t = game.time;
    let ev = EVENTS[this.nextEvent];
    // Events a playtest key already ran (and boss fights whose boss isn't ported): skip them.
    while (ev && ((ev.type === 'boss' && !BEHAVIORS[ENEMIES[mapEvent(ev, game.map).boss]?.behavior]) || this.done.has(ev))) ev = EVENTS[++this.nextEvent];
    ev = mapEvent(ev, game.map);
    if (ev) {
      if (this.warned !== this.nextEvent && t >= ev.t - ev.warn) {
        this.warned = this.nextEvent;
        game.banner(ev.title, ev.text, ev.warn + 2);
        game.sfx(ev.type === 'boss' ? 'siren' : 'alarm');
      }
      if (t >= ev.t) {
        this.nextEvent++;
        if (ev.type === 'ring') this.ringEvent(game, ev);
        else if (ev.type === 'storm') this.storm = { ev, left: ev.waves, t: 0 };
        else if (ev.type === 'boss') this.bossEvent(game, ev);
        game.shake(3);
      }
    }
    const s = this.storm;
    if (s && (s.t -= dt) <= 0) {
      this.stormWave(game, s.ev);
      s.t = s.ev.gap;
      if (--s.left <= 0) this.storm = null;
    }
  }

  // Bosses always spawn at full base HP and speed (no timeline scaling).
  bossEvent(game, ev) {
    game.timeline.mark(game, 'boss', ENEMIES[ev.boss]?.name ?? ev.title);
    const pool = game.enemies;
    if (pool.count >= pool.capacity) {
      // Make room: a boss must never fail to show up because the floor is full.
      for (let i = 0; i < 20; i++) if (!pool.items[i].def.boss) pool.items[i].dead = true;
      pool.compact();
    }
    const pt = this.ringPoint(game);
    const e = spawnEnemy(game, ev.boss, pt.x, pt.y);
    if (!e) return null;
    this.bossScale = ev.spawnScale ?? 1;
    game.setBoss(e);
    return e;
  }

  ringEvent(game, ev) {
    const mix = readyMix(ev.mix);
    for (let i = 0; i < ev.count; i++) this.spawn(game, pick(mix), (i / ev.count) * Math.PI * 2);
  }

  // A wall of enemies entering from one side and marching straight across. Uses the
  // visible floor's extents around the player (game.view: left, right, top, bottom).
  stormWave(game, ev) {
    const v = game.view;
    const p = game.player;
    const mix = readyMix(ev.mix);
    const side = (Math.random() * 4) | 0;
    const horizontal = side < 2; // enters from left/right
    const dir = side % 2 === 0 ? 1 : -1;
    const span = horizontal ? v.top + v.bottom + 80 : v.left + v.right + 80;
    // Enters from the left (dir 1) / right, or the top (dir 1) / bottom.
    const edge = horizontal ? (dir > 0 ? v.left : v.right) : dir > 0 ? v.top : v.bottom;
    const start = (horizontal ? p.x : p.y) - dir * (edge + 30 + (horizontal ? 0 : HEAD_ROOM));
    const life = ((horizontal ? v.left + v.right : v.top + v.bottom) + 120 + HEAD_ROOM) / ev.speed + 1;
    const mid = horizontal ? (v.bottom - v.top) / 2 : (v.right - v.left) / 2;
    const t = game.time;
    for (let i = 0; i < ev.count; i++) {
      const across = mid + (i / ev.count - 0.5) * span + (Math.random() - 0.5) * 10;
      const depth = Math.random() * 40;
      const x = horizontal ? start - dir * depth : p.x + across;
      const y = horizontal ? p.y + across : start - dir * depth;
      const e = spawnEnemy(game, pick(mix), x, y, this.sample(t, 'hpMult'), 1, 'line');
      if (!e) break;
      e.speed = ev.speed;
      e.dx = horizontal ? dir : 0;
      e.dy = horizontal ? 0 : dir;
      e.facing = Math.atan2(e.dx, e.dy);
      e.life = life;
    }
  }

  // Enemies left far behind are moved back onto the spawn ring.
  recycle(game) {
    const limit = game.view.radius * SPAWNER.recycleDistance;
    const p = game.player;
    const pool = game.enemies;
    for (let i = 0; i < pool.count; i++) {
      const e = pool.items[i];
      if (e.life > 0) continue; // event swarms expire on their own
      if (Math.abs(e.x - p.x) > limit || Math.abs(e.y - p.y) > limit) {
        const pt = this.ringPoint(game);
        e.x = e.px = pt.x;
        e.y = e.py = pt.y;
        e.kx = e.ky = 0;
      }
    }
  }

  // Debug: jump the clock to just before the next event's warning.
  skipToNextEvent(game) {
    const ev = EVENTS[this.nextEvent];
    if (ev) game.time = Math.max(game.time, ev.t - ev.warn - 0.5);
  }
}
