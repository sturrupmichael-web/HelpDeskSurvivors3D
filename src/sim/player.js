// The helpdesk technician: movement, stats (character + shop upgrades + passives), sanity.
// Ported from the original's src/game/player.js. Differences: the movement axis is passed
// in (the simulation never reads input devices), sounds go through `game.sfx`, and the
// overtime drain and Cloud Engineer ramp come back with the spawner and the other techs.

import { PASSIVES, MAX_WEAPONS, MAX_PASSIVES } from '../../data/passives.js';
import { XP_CURVE } from '../../data/player.js';

const STAT_KEYS = ['moveSpeed', 'attackSpeed', 'area', 'damage', 'growth', 'damageTaken', 'cooldown', 'pickupRadius', 'luck'];

// `meta` supplies permanent shop bonuses (not ported yet); omit it for a bare player.
export function createPlayer(def, meta = null) {
  const bonus = {};
  for (const k of STAT_KEYS) bonus[k] = (def.bonus?.[k] ?? 0) + (meta ? meta.bonus(k) : 0);
  const maxHp = def.maxHp + (meta ? meta.bonus('maxHp') : 0);
  const p = {
    def,
    x: 0,
    y: 0,
    px: 0, // position at the start of the last tick (the renderer interpolates from here)
    py: 0,
    r: def.radius,
    hp: maxHp,
    maxHp,
    baseMaxHp: maxHp, // before the Standing Desk passive
    extraCount: def.extraCount ?? 0, // extra projectiles / shields / helpers on every tool (+ Spare Charger)
    baseExtraCount: def.extraCount ?? 0,
    summonDamage: 1 + (def.summonBonus ?? 0), // damage multiplier for turrets and helpers
    regen: def.regen + (meta ? meta.bonus('regen') : 0), // sanity per second (+ Snack Drawer)
    baseRegen: def.regen + (meta ? meta.bonus('regen') : 0),
    rerolls: meta ? meta.bonus('rerolls') : 0, // level-up rerolls left this shift
    revives: meta ? meta.bonus('revives') : 0, // Union Rep comebacks left this shift
    warranty: 0, // Extended Warranty comebacks left this shift
    maxWeapons: MAX_WEAPONS + (def.toolSlots ?? 0),
    maxPassives: MAX_PASSIVES,
    bonus,
    facing: 0, // radians on the floor plane, 0 = facing down the screen (+y)
    moving: false,
    animT: 0,
    flash: 0,
    hurtCooldown: 0,
    slow: 1, // set each tick by floor hazards
    boost: 1, // speed multiplier while boostT > 0
    boostT: 0,
    slip: false, // standing on a wet floor: movement keeps its momentum
    vx: 0, // velocity (only lags behind your input while slipping)
    vy: 0,
    kx: 0, // shove from boss attacks
    ky: 0,
    god: false,
    invuln: 0, // seconds of PTO (Out of Office) left: no damage
    level: 1,
    xp: 0,
    xpNeed: xpForLevel(1),
    pendingLevels: 0,
    weapons: [],
    innate: [],
    passives: {}, // passive id -> level
    // Stat multipliers, recomputed whenever passives change.
    stats: { moveSpeed: 1, attackSpeed: 1, area: 1, damage: 1, growth: 1, damageTaken: 1, cooldown: 1, pickupRadius: 1, maxHp: 1, luck: 1 },
  };
  recomputeStats(p);
  return p;
}

export function xpForLevel(level) {
  const band = XP_CURVE.bands.find((b) => level <= b.upTo);
  return XP_CURVE.first + (level - 1) * band.step;
}

export function recomputeStats(p) {
  for (const k in p.stats) p.stats[k] = 1 + (p.bonus[k] ?? 0);
  p.extraCount = p.baseExtraCount;
  p.regen = p.baseRegen;
  for (const [id, lvl] of Object.entries(p.passives)) {
    const d = PASSIVES[id];
    if (d.stat) p.stats[d.stat] += d.perLevel * lvl;
    if (d.add) p[d.add] += d.perLevel * lvl; // flat: extraCount (Spare Charger), regen (Snack Drawer)
  }
  p.stats.cooldown = Math.max(0.2, p.stats.cooldown);
  // Max sanity scales with the Standing Desk passive; the extra sanity arrives filled.
  const maxHp = Math.round(p.baseMaxHp * p.stats.maxHp);
  if (maxHp > p.maxHp) p.hp += maxHp - p.maxHp;
  p.maxHp = maxHp;
  p.hp = Math.min(p.hp, maxHp);
  p.stats.damageTaken = Math.max(0.1, p.stats.damageTaken);
}

const SLIP_GRIP = 1.6; // how fast you change direction on a wet floor (1/s)
export const FOOT = 10; // px from the player's center down to their feet
const FOOT_RADIUS = 5; // size of the feet against solid furniture
const SHOVE_DAMP = 7; // how fast a shove from a boss dies down (1/s)

// `axis` is the movement input ({x, y}, length <= 1).
export function updatePlayer(game, axis, dt) {
  const p = game.player;
  p.px = p.x;
  p.py = p.y;
  const speed = p.def.speed * p.stats.moveSpeed * p.slow * (p.boostT > 0 ? p.boost : 1);
  if (p.boostT > 0) p.boostT -= dt;
  if (p.slip) {
    // Wet floor: you only slowly change direction.
    const k = Math.min(1, SLIP_GRIP * dt);
    p.vx += (axis.x * speed * 1.15 - p.vx) * k;
    p.vy += (axis.y * speed * 1.15 - p.vy) * k;
  } else {
    p.vx = axis.x * speed;
    p.vy = axis.y * speed;
  }
  p.x += (p.vx + p.kx) * dt;
  p.y += (p.vy + p.ky) * dt;
  game.floor.collide(p, FOOT, FOOT_RADIUS); // solid cubicles: stop and slide along them
  const damp = Math.exp(-SHOVE_DAMP * dt);
  p.kx *= damp;
  p.ky *= damp;
  p.moving = axis.x !== 0 || axis.y !== 0;
  // The original only flips the sprite left/right; a 3D figure turns to face where it walks.
  if (p.moving) p.facing = Math.atan2(axis.x, axis.y);
  p.animT = p.moving ? p.animT + dt : 0;
  if (p.flash > 0) p.flash -= dt;
  if (p.hurtCooldown > 0) p.hurtCooldown -= dt;
  if (p.invuln > 0) p.invuln -= dt;
  if (p.regen) p.hp = Math.min(p.maxHp, p.hp + p.regen * dt);
}

// Sanity damage. Returns true if any damage was applied.
export function hurtPlayer(game, amount) {
  const p = game.player;
  if (p.god || p.invuln > 0 || amount <= 0) return false;
  p.hp -= amount * p.stats.damageTaken;
  if (p.hurtCooldown <= 0) {
    p.flash = 0.1;
    p.hurtCooldown = 0.25;
    game.sfx('hurt');
  }
  return true;
}

export function addXp(game, amount) {
  const p = game.player;
  p.xp += amount * p.stats.growth;
  while (p.xp >= p.xpNeed) {
    p.xp -= p.xpNeed;
    p.level++;
    p.pendingLevels++;
    p.xpNeed = xpForLevel(p.level);
  }
}
