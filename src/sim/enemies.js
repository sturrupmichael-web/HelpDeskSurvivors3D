// End-user horde: pooled enemy objects, movement via behaviors, separation, contact
// damage, damage and death. Ported from the original's src/game/enemies.js with the
// drawing removed. Not yet ported (they return with their milestones): map twists and
// Shift Policies.

import { ENEMIES } from '../../data/enemies.js';
import { BEHAVIORS } from './behaviors/index.js';
import { hurtPlayer, FOOT } from './player.js';
import { dropTicket, rollItemDrops } from './pickups.js';
import { angryTick } from './behaviors/phase2.js';

export const HIT_SLOTS = 8; // per-weapon "last hit" timestamps for damage-over-time weapons
const DEFAULT_FOOT = 10;
const NO_PARAMS = {};
const TURN_RATE = 10; // how fast a user turns to face where they're going (1/s); drawing only

let nextUid = 1;

export function makeEnemy() {
  return {
    def: null, behavior: null, params: NO_PARAMS,
    uid: 0, x: 0, y: 0, r: 7, foot: DEFAULT_FOOT,
    kx: 0, ky: 0, // knockback velocity
    px: 0, py: 0, // position at the start of the tick (solid cubicles; the renderer interpolates from here)
    wall: null, wallX: 0, wallY: 0, // the cubicle row it's walking round, and which way (-1/1)
    dx: 0, dy: 0, // fixed direction (dashes, storm lines)
    hp: 1, maxHp: 1, speed: 0, damage: 0, xp: 1, kbMul: 1,
    slow: 1, // speed multiplier from slows; reset every tick, set by weapons
    buff: 1, // speed multiplier from VIP auras; reset every tick
    stun: 0, life: -1,
    confuse: 0, // seconds left walking the wrong way (Password Expired)
    mark: 0, markAmp: 0, // seconds left flagged, and the extra damage it takes meanwhile
    tagXp: 1, // Closed Ticket multiplier from an Asset Tag sticker
    flash: 0, animT: 0, flip: false, dead: false, noSep: false,
    facing: 0, // radians on the floor plane, 0 = down the screen (the 3D version turns users)
    t0: 0, t1: 0, n: 0, // scratch for regular users' behaviors (timers, a flag)
    ai: null, // a boss's own named state, made by its behavior's init() each fight
    heavy: false, // bosses (and anchored boxes): the horde can't shove them around
    angry: false, angryT: 0, // a boss in its second phase (behaviors/phase2.js), and its ember timer
    anim: 'walk', pose: -1, // what a boss is doing, for the renderer: 'walk' or 'attack', and which attack pose
    scale: 1, // drawn size
    hitAt: new Float64Array(HIT_SLOTS),
  };
}

export function spawnEnemy(game, id, x, y, hpMult = 1, speedMult = 1, behaviorId) {
  const e = game.enemies.spawn();
  if (!e) return null;
  const def = ENEMIES[id];
  e.def = def;
  e.behavior = BEHAVIORS[behaviorId ?? def.behavior];
  e.params = def.params ?? NO_PARAMS;
  e.uid = nextUid++;
  e.x = e.px = x;
  e.y = e.py = y;
  e.wall = null;
  e.r = def.radius;
  e.foot = def.foot ?? DEFAULT_FOOT;
  e.kx = e.ky = e.dx = e.dy = 0;
  // The map toughens regular users (bosses keep their tuned HP).
  const map = def.boss ? null : game.map;
  e.hp = e.maxHp = def.hp * hpMult * (map?.hpMult ?? 1);
  e.speed = def.speed * speedMult * (map?.speedMult ?? 1);
  e.damage = def.damage;
  e.xp = def.xp;
  e.kbMul = def.knockback;
  e.slow = e.buff = 1;
  e.stun = 0;
  e.confuse = e.mark = e.markAmp = 0;
  e.tagXp = 1;
  e.life = -1;
  e.flash = 0;
  e.animT = Math.random();
  e.dead = false;
  e.noSep = !!def.noSeparation;
  e.t0 = e.t1 = 0;
  e.n = 0;
  e.ai = null;
  e.heavy = !!def.boss || !!def.anchored;
  e.angry = false;
  e.angryT = 0;
  e.anim = 'walk';
  e.pose = -1;
  e.scale = 1;
  e.hitAt.fill(-1e9);
  // Face the player from the start.
  e.facing = Math.atan2(game.player.x - x, game.player.y - y);
  if (e.behavior.init) e.behavior.init(e, game);
  return e;
}

export function updateEnemies(game, dt) {
  const pool = game.enemies;
  const damp = Math.exp(-8 * dt);
  const turn = Math.min(1, TURN_RATE * dt);
  for (let i = 0; i < pool.count; i++) {
    const e = pool.items[i];
    if (e.dead) continue;
    if (e.life > 0 && (e.life -= dt) <= 0) {
      e.dead = true;
      continue;
    }
    e.px = e.x;
    e.py = e.y;
    if (e.mark > 0) e.mark -= dt;
    if (e.stun > 0) e.stun -= dt;
    else if (e.confuse > 0) {
      // Confused: whatever step the behavior takes, take it backwards instead.
      e.confuse -= dt;
      const x0 = e.x;
      const y0 = e.y;
      e.behavior.update(e, game, dt);
      e.x = x0 - (e.x - x0);
      e.y = y0 - (e.y - y0);
    } else e.behavior.update(e, game, dt);
    // Turn toward the step the behavior took (before knockback, so a shove doesn't spin them).
    const mx = e.x - e.px;
    const my = e.y - e.py;
    if (mx * mx + my * my > 1e-6) {
      let d = Math.atan2(mx, my) - e.facing;
      d -= Math.round(d / (Math.PI * 2)) * Math.PI * 2;
      e.facing += d * turn;
    }
    e.x += e.kx * dt;
    e.y += e.ky * dt;
    e.kx *= damp;
    e.ky *= damp;
    e.slow = 1;
    e.buff = 1;
    e.animT += dt;
    if (e.flash > -1) e.flash -= dt;
    if (e.angry) angryTick(e, game, dt);
  }
}

// After the spatial hash is built: push overlapping enemies apart, run behaviors'
// post-hash hooks (auras), and apply contact damage to the player.
export function resolveEnemies(game, dt) {
  const { enemies: pool, hash, scratch: buf } = game;
  const items = pool.items;
  for (let i = 0; i < pool.count; i++) {
    const a = items[i];
    if (a.dead) continue;
    if (a.behavior.post) a.behavior.post(a, game);
    if (a.noSep) continue;
    const n = hash.query(a.x, a.y, a.r * 2, buf);
    let checked = 0;
    for (let k = 0; k < n && checked < 10; k++) {
      const j = buf[k];
      if (j <= i) continue;
      const b = items[j];
      if (b.noSep || b.dead) continue;
      checked++;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const min = a.r + b.r;
      const d2 = dx * dx + dy * dy;
      if (d2 >= min * min) continue;
      const d = Math.sqrt(d2) || 0.01;
      const push = (min - d) / d;
      const pa = a.heavy ? 0 : b.heavy ? 0.5 : 0.25;
      const pb = b.heavy ? 0 : a.heavy ? 0.5 : 0.25;
      a.x -= dx * push * pa;
      a.y -= dy * push * pa;
      b.x += dx * push * pb;
      b.y += dy * push * pb;
    }
  }

  if (game.floor.solid) avoidSolids(game, dt);

  // Contact: touching enemies drain sanity continuously; exploders go off once.
  const p = game.player;
  const n = hash.query(p.x, p.y, p.r + 16, buf);
  let drain = 0;
  for (let k = 0; k < n; k++) {
    const e = items[buf[k]];
    if (e.dead) continue;
    const dx = e.x - p.x;
    const dy = e.y - p.y;
    const min = e.r + p.r;
    if (dx * dx + dy * dy >= min * min) continue;
    const hurtBy = p.def.hurtBy?.[e.def.sprite] ?? 1; // CRM Manager: walk-ups hurt more
    if (e.def.explode) {
      e.dead = true;
      game.burst(e.x, e.y, e.def.particle, 14);
      game.shake(4);
      game.sfx('boom', e.x);
      hurtPlayer(game, e.def.explode.damage * hurtBy);
    } else drain += e.damage * hurtBy;
  }
  if (drain > 0) hurtPlayer(game, drain * dt);
}

// Solid cubicles: push users out of them, and a user stuck on a cubicle row with you on
// the far side walks along it (at its own speed, whatever its behavior wanted this tick)
// toward the end that is the shorter way round, then down the end of the row. It sticks
// with the end it picked until it leaves the row, so it doesn't dither when you move.
// Bosses barge straight through, and so do event swarms (which expire) and anchored boxes.
function avoidSolids(game, dt) {
  const floor = game.floor;
  const p = game.player;
  const py = p.y + FOOT; // the player's feet
  const items = game.enemies.items;
  for (let i = 0; i < game.enemies.count; i++) {
    const e = items[i];
    if (e.dead || e.life > 0 || e.heavy) continue;
    const r = Math.max(4, e.r * 0.6);
    const s = floor.collide(e, e.foot, r);
    if (s !== e.wall) {
      e.wall = s;
      e.wallX = e.wallY = 0;
    }
    if (!s || e.stun > 0) continue;
    const fy = e.y + e.foot;
    const inX = e.x >= s[0] && e.x <= s[0] + s[2];
    const inY = fy >= s[1] && fy <= s[1] + s[3];
    const pastY = fy < s[1] ? py > s[1] + s[3] : fy > s[1] + s[3] && py < s[1];
    const pastX = e.x < s[0] ? p.x > s[0] + s[2] : e.x > s[0] + s[2] && p.x < s[0];
    let along; // 'x': walk along the top/bottom face, 'y': along a side face
    if (inX) along = pastY ? 'x' : null;
    else if (inY) along = pastX ? 'y' : null;
    else along = pastY ? 'y' : pastX ? 'x' : null; // at a corner: round it toward you
    if (!along) continue;
    const step = e.speed * e.slow * e.buff * dt;
    e.x = e.px;
    e.y = e.py;
    if (along === 'x') {
      const a = s[0] - r - 2;
      const b = s[0] + s[2] + r + 2;
      if (!e.wallX) e.wallX = (inX ? Math.abs(e.x - a) + Math.abs(a - p.x) <= Math.abs(e.x - b) + Math.abs(b - p.x) : p.x < s[0]) ? -1 : 1;
      const end = e.wallX < 0 ? a : b;
      e.x += Math.sign(end - e.x) * Math.min(step, Math.abs(end - e.x));
    } else {
      const from = e.y + e.foot;
      const a = s[1] - r - 2;
      const b = s[1] + s[3] + r + 2;
      if (!e.wallY) e.wallY = (inY ? Math.abs(from - a) + Math.abs(a - py) <= Math.abs(from - b) + Math.abs(b - py) : py < s[1]) ? -1 : 1;
      const end = e.wallY < 0 ? a : b;
      e.y += Math.sign(end - from) * Math.min(step, Math.abs(end - from));
    }
    if (!inX && !inY) {
      // Rounding a corner: also step clear of the face it's turning onto, or the corner
      // keeps pushing it back where it came from.
      if (along === 'y') {
        const out = e.x < s[0] + s[2] / 2 ? s[0] - r - 2 : s[0] + s[2] + r + 2;
        e.x += Math.sign(out - e.x) * Math.min(step, Math.abs(out - e.x));
      } else {
        const from = e.y + e.foot;
        const out = from < s[1] + s[3] / 2 ? s[1] - r - 2 : s[1] + s[3] + r + 2;
        e.y += Math.sign(out - from) * Math.min(step, Math.abs(out - from));
      }
    }
    floor.collide(e, e.foot, r);
  }
}

// Applies weapon damage. (dx, dy) is the knockback direction (need not be normalized).
export function damageEnemy(game, e, amount, weapon, dx, dy, knockback) {
  if (e.dead) return;
  if (weapon && e.def.resist) for (const tag of weapon.def.tags) amount *= e.def.resist[tag] ?? 1;
  if (weapon?.def.bossDamage && e.def.boss) amount *= weapon.def.bossDamage;
  if (e.mark > 0) amount *= 1 + e.markAmp;
  const pd = game.player.def;
  if (weapon?.def.bonusVs) amount *= weapon.def.bonusVs[e.def.sprite] ?? 1;
  if (pd.bonusVs) amount *= pd.bonusVs[e.def.sprite] ?? 1;
  if (pd.slowedAmp && e.slow < 1) amount *= 1 + pd.slowedAmp;
  if (weapon?.def.tagXp) e.tagXp = weapon.def.tagXp; // Asset Tag
  if (weapon?.def.tagMark) markEnemy(e, weapon.def.tagMark[0], weapon.def.tagMark[1]); // RFID Inventory
  e.hp -= amount;
  if (!e.heavy) e.flash = 0.12;
  else if (e.flash < -0.2) e.flash = 0.06;
  if (weapon) weapon.damageDone += Math.min(amount, e.hp + amount);
  game.timeline.damage += Math.min(amount, e.hp + amount);
  game.number(e.x, e.y, amount);
  game.sfx(e.def.boss ? 'bosshit' : 'hit', e.x);
  if (knockback && (dx || dy)) {
    const d = Math.hypot(dx, dy);
    e.kx += (dx / d) * knockback * e.kbMul;
    e.ky += (dy / d) * knockback * e.kbMul;
  }
  if (e.hp <= 0) killEnemy(game, e, weapon);
}

// Stuns an enemy for `seconds`, scaled down by its stunResist (bosses barely flinch).
export function stunEnemy(e, seconds) {
  const t = seconds * (e.def.stunResist ?? 1);
  if (t > e.stun) e.stun = t;
}

// Confuses an enemy: it walks the wrong way for `seconds`.
export function confuseEnemy(e, seconds) {
  const t = seconds * (e.def.stunResist ?? 1);
  if (t > e.confuse) e.confuse = t;
}

// Flags an enemy: for `seconds` it takes `amp` extra damage (0.25 = +25%) from everything.
export function markEnemy(e, seconds, amp) {
  if (e.mark <= 0 || amp > e.markAmp) e.markAmp = amp;
  if (seconds > e.mark) e.mark = seconds;
}

// `weapon` is the tool that closed it, if any (Remote Wipe pulls the ticket straight to you;
// Golden Record keeps the XP and drops one merged ticket per blast).
export function killEnemy(game, e, weapon) {
  e.dead = true;
  const combo = game.score.onKill();
  if (combo) {
    const pl = game.player;
    game.text(pl.x, pl.y - 40, `RESOLVED x${combo}!`, combo >= 100 ? '#ef7d57' : '#a7f070');
    game.sfx('combo');
  }
  if (e.xp > 0) {
    const xp = e.xp * e.tagXp;
    if (weapon?.def.merge) weapon.mergeXp += xp;
    else {
      const t = dropTicket(game, e.x, e.y, xp);
      if (weapon?.def.vacuum) t.magnet = true;
    }
  }
  game.burst(e.x, e.y, e.def.particle, 6);
  game.sfx('pop', e.x);
  game.achievements.onKill(e.def.sprite);
  rollItemDrops(game, e);
  if (e.def.boss) game.onBossDown(e);
  const od = e.def.onDeath;
  if (od) {
    const hpMult = game.spawner.sample(game.time, 'hpMult');
    for (let i = 0; i < od.count; i++) {
      const a = (i / od.count) * Math.PI * 2 + Math.random();
      const c = spawnEnemy(game, od.spawn, e.x + Math.cos(a) * 10, e.y + Math.sin(a) * 10, hpMult);
      if (c) {
        c.kx = Math.cos(a) * 120;
        c.ky = Math.sin(a) * 120;
      }
    }
  }
}

// Nearest live enemy to (x, y) within maxR, searching outward in growing rings.
// `skip(e)` can exclude candidates. Returns the enemy or null.
export function nearestEnemy(game, x, y, maxR, skip) {
  const { enemies, hash, scratch2: buf } = game;
  for (let r = 64; ; r = Math.min(maxR, r * 2)) {
    const n = hash.query(x, y, r, buf);
    let best = null;
    let bestD = r * r;
    for (let k = 0; k < n; k++) {
      const e = enemies.items[buf[k]];
      if (e.dead || (skip && skip(e))) continue;
      const dx = e.x - x;
      const dy = e.y - y;
      const d = dx * dx + dy * dy;
      if (d < bestD) {
        bestD = d;
        best = e;
      }
    }
    if (best || r >= maxR) return best;
  }
}
