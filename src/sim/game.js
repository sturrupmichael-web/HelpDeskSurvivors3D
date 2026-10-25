// The simulation: owns the world state and advances it one fixed tick at a time. It knows
// nothing about Three.js or the page, so it also runs headless in Node (tests/). The
// renderer and the UI read its state; input arrives as a movement axis per tick.
//
// Units are the original game's world pixels on a flat plane: x to the right, y down the
// screen. The renderer maps (x, y) to Three.js (X, Z).
//
// The page passes in hooks for what the simulation can't do itself (sound, banners,
// screen shake, particles, damage numbers, effect rings); headless they do nothing. The one thing the
// page tells the simulation is what part of the floor is on screen (`view`), which the
// spawner needs, as the original's spawner needed the canvas size.

import { CHARACTERS } from '../../data/player.js';
import { MAPS } from '../../data/maps.js';
import { SPAWNER } from '../../data/waves.js';
import { Pool } from '../engine/pool.js';
import { SpatialHash } from '../engine/spatialHash.js';
import { Floor } from './floor.js';
import { createPlayer, updatePlayer, FOOT } from './player.js';
import { makeEnemy, updateEnemies, resolveEnemies } from './enemies.js';
import { Spawner } from './spawner.js';
import { WEAPONS } from '../../data/weapons.js';
import { createWeapon, setWeaponLevel, updateWeapons, weaponReady } from './weapons/index.js';
import { createProjectilePool, updateProjectiles } from './projectiles.js';

const noop = () => {};
const HEADLESS_VIEW = [854, 480]; // world px "on screen" when there is no page, as in the original
const BURNOUT_PAUSE = 2.5; // seconds on the burnout banner before the shift restarts (until milestone 5)

export class Sim {
  // Hooks: sfx(name, x), banner(title, text, seconds), shake(amount),
  // burst(x, y, colors, count), number(x, y, amount), ring(x, y, radius, color, life, fill).
  constructor(hooks = {}) {
    this.sfx = hooks.sfx ?? noop;
    this.banner = hooks.banner ?? noop;
    this.shake = hooks.shake ?? noop;
    this.burst = hooks.burst ?? noop;
    this.number = hooks.number ?? noop;
    this.ring = hooks.ring ?? noop;
    this.map = MAPS.office;
    this.floor = new Floor();
    this.floor.solid = !!this.map.solid;
    this.enemies = new Pool(SPAWNER.maxEnemies, makeEnemy);
    this.hash = new SpatialHash(32, 128, 128, SPAWNER.maxEnemies);
    this.scratch = new Int32Array(SPAWNER.maxEnemies); // query buffers (two, for nested queries)
    this.scratch2 = new Int32Array(SPAWNER.maxEnemies);
    this.spawner = new Spawner();
    this.projectiles = createProjectilePool();
    // The visible floor around the camera's ground point, in world px: the four screen
    // corners (x, y pairs, clockwise from bottom left), the extents, and the farthest corner.
    this.view = { corners: new Float64Array(8), left: 0, right: 0, top: 0, bottom: 0, radius: 0 };
    const [w, h] = HEADLESS_VIEW;
    this.setView([-w / 2, h / 2, w / 2, h / 2, w / 2, -h / 2, -w / 2, -h / 2]);
    this.newRun();
  }

  // `corners`: 8 numbers, the screen corners on the floor relative to the camera's target.
  setView(corners) {
    const v = this.view;
    v.left = v.right = v.top = v.bottom = v.radius = 0;
    for (let i = 0; i < 4; i++) {
      const x = (v.corners[i * 2] = corners[i * 2]);
      const y = (v.corners[i * 2 + 1] = corners[i * 2 + 1]);
      v.left = Math.max(v.left, -x);
      v.right = Math.max(v.right, x);
      v.top = Math.max(v.top, -y);
      v.bottom = Math.max(v.bottom, y);
      v.radius = Math.max(v.radius, Math.hypot(x, y));
    }
    // Collision grid: just big enough for everything the spawner keeps.
    const reach = v.radius * SPAWNER.recycleDistance + 64;
    this.hash.resize(Math.min(128, Math.ceil((reach * 2) / this.hash.cell)));
  }

  newRun(charId = this.charId ?? 'tier1') {
    this.charId = charId;
    const def = CHARACTERS[charId];
    this.player = createPlayer(def);
    this.player.weapons.push(createWeapon(def.starter, 0));
    this.time = 0;
    this.ticks = 0;
    this.kills = 0;
    this.burnoutT = 0;
    this.enemies.clear();
    this.projectiles.clear();
    this.spawner.reset();
    // Start in a clear spot: walk down from the origin until the feet are off furniture.
    const p = this.player;
    while (this.floor.blocked(p.x, p.y + FOOT)) p.y += 8;
    p.px = p.x;
    p.py = p.y;
  }

  // Bosses come later; the spawner asks.
  bossAlive() {
    return false;
  }

  tick(dt, axis) {
    const p = this.player;
    if (this.burnoutT > 0) {
      // Burned out: the floor freezes for a moment, then a new shift starts.
      p.px = p.x;
      p.py = p.y;
      for (let i = 0; i < this.enemies.count; i++) {
        const e = this.enemies.items[i];
        e.px = e.x;
        e.py = e.y;
      }
      for (let i = 0; i < this.projectiles.count; i++) {
        const o = this.projectiles.items[i];
        o.px = o.x;
        o.py = o.y;
      }
      if ((this.burnoutT -= dt) <= 0) this.newRun();
      return;
    }
    this.time += dt;
    this.ticks++;
    updatePlayer(this, axis, dt);
    this.spawner.update(this, dt);
    updateEnemies(this, dt);
    this.hash.build(this.enemies.items, this.enemies.count, p.x, p.y);
    resolveEnemies(this, dt);
    updateWeapons(this, dt);
    updateProjectiles(this, dt);
    this.enemies.compact(); // hash indices are stale after this point
    if (p.hp <= 0) {
      p.hp = 0;
      this.burnoutT = BURNOUT_PAUSE;
      this.banner('BURNED OUT', `You lasted ${fmtTime(this.time)}. A fresh shift starts in a moment.`, BURNOUT_PAUSE);
      this.sfx('burnout');
    }
  }

  // --- Playtest helpers (the original's debug hotkeys) ---------------------------------
  debugSpawn(n) {
    for (let i = 0; i < n && this.enemies.count < this.enemies.capacity; i++) this.spawner.spawn(this);
  }
  debugSkip(seconds) {
    this.time += seconds;
  }
  debugClear() {
    this.enemies.clear();
  }
  // Adds the next tool the tech doesn't have yet (up to the slot limit). Returns it.
  debugAddWeapon() {
    const p = this.player;
    if (p.weapons.length >= p.maxWeapons) return null;
    const id = Object.keys(WEAPONS).find((k) => weaponReady(k) && !WEAPONS[k].evolved && !p.weapons.some((w) => w.id === k || w.def.from === k));
    if (!id) return null;
    const w = createWeapon(id, p.weapons.length);
    p.weapons.push(w);
    return w;
  }
  // Every tool one level up (until level-ups arrive in milestone 4).
  debugLevelWeapons() {
    for (const w of this.player.weapons) if (w.level < w.def.levels.length) setWeaponLevel(w, w.level + 1);
  }
}

export const fmtTime = (t) => {
  const s = Math.floor(t);
  return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
};
