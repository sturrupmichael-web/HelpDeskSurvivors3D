// Weapon instances. Behavior modules are looked up by the `behavior` field in
// data/weapons.js. A behavior is { init?(w), update(w, game, dt) }; drawing lives in
// src/render/weapons.js, which reads the same weapon state.
// Ported from the original's src/game/weapons/index.js. Only some behaviors are ported
// so far; `weaponReady(id)` says whether a tool can be used yet (the level-up cards and
// the playtest helpers only offer those).

import { WEAPONS } from '../../../data/weapons.js';
import pulse from './pulse.js';
import projectile from './projectile.js';
import boomerang from './boomerang.js';
import orbit from './orbit.js';
import aura from './aura.js';
import homing from './homing.js';
import nuke from './nuke.js';

export const WEAPON_BEHAVIORS = { pulse, projectile, boomerang, orbit, aura, homing, nuke };

export const weaponReady = (id) => !!WEAPONS[id] && WEAPONS[id].behavior in WEAPON_BEHAVIORS;

// `slot` indexes the per-enemy hit timers (enemy.hitAt) used by damage-over-time weapons.
export function createWeapon(id, slot, def = WEAPONS[id]) {
  const w = {
    id,
    def,
    slot,
    behavior: WEAPON_BEHAVIORS[def.behavior],
    level: 1,
    stats: def.levels[0],
    timer: 0.5, // first activation shortly after pickup
    damageDone: 0,
  };
  if (w.behavior.init) w.behavior.init(w);
  return w;
}

export function setWeaponLevel(w, level) {
  w.level = level;
  w.stats = w.def.levels[level - 1];
}

export function updateWeapons(game, dt) {
  const p = game.player;
  for (const w of p.weapons) w.behavior.update(w, game, dt);
  for (const w of p.innate) w.behavior.update(w, game, dt);
}
