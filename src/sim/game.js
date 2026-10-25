// The simulation: owns the world state and advances it one fixed tick at a time. It knows
// nothing about Three.js or the page, so it also runs headless in Node (tests/). The
// renderer and the UI read its state; input arrives as a movement axis per tick.
//
// Units are the original game's world pixels on a flat plane: x to the right, y down the
// screen. The renderer maps (x, y) to Three.js (X, Z).
//
// The page passes in hooks for what the simulation can't do itself (sound, banners,
// screen shake, particles, damage numbers, effect rings); headless they do nothing.
//
// Level-ups and Change Approved chests stop the floor until the player answers: the
// simulation sets `choices` (the cards) or `chest` (what a chest gave), skips ticks while
// either is set, and the page calls `choose(card)` or `closeChest()`. Pausing works the
// same way (`paused`), and a burnout sets `over` to the run's stats until `newRun()`. The one thing the
// page tells the simulation is what part of the floor is on screen (`view`), which the
// spawner needs, as the original's spawner needed the canvas size.

import { CHARACTERS, COMEBACKS } from '../../data/player.js';
import { MAPS } from '../../data/maps.js';
import { SPAWNER } from '../../data/waves.js';
import { Pool } from '../engine/pool.js';
import { SpatialHash } from '../engine/spatialHash.js';
import { Floor } from './floor.js';
import { createPlayer, updatePlayer, addXp, recomputeStats, FOOT } from './player.js';
import { makeEnemy, updateEnemies, resolveEnemies } from './enemies.js';
import { Spawner } from './spawner.js';
import { WEAPONS } from '../../data/weapons.js';
import { createWeapon, setWeaponLevel, updateWeapons, weaponReady } from './weapons/index.js';
import { createProjectilePool, updateProjectiles } from './projectiles.js';
import { TICKETS, MAX_ITEMS } from '../../data/pickups.js';
import { EVOLUTIONS } from '../../data/evolutions.js';
import { makeTicket, makeItem, updateTickets, updateItems, dropItem } from './pickups.js';
import { rollChoices, applyChoice, openChest } from './upgrades.js';
import { PASSIVES } from '../../data/passives.js';
import { Score } from './score.js';

const noop = () => {};
const HEADLESS_VIEW = [854, 480]; // world px "on screen" when there is no page, as in the original

export class Sim {
  // Hooks: sfx(name, x), banner(title, text, seconds), shake(amount),
  // burst(x, y, colors, count), number(x, y, amount), ring(x, y, radius, color, life, fill),
  // text(x, y, words, color).
  constructor(hooks = {}) {
    this.sfx = hooks.sfx ?? noop;
    this.banner = hooks.banner ?? noop;
    this.shake = hooks.shake ?? noop;
    this.burst = hooks.burst ?? noop;
    this.number = hooks.number ?? noop;
    this.ring = hooks.ring ?? noop;
    this.text = hooks.text ?? noop;
    this.mapId = 'office';
    this.map = MAPS[this.mapId];
    this.floor = new Floor();
    this.floor.solid = !!this.map.solid;
    this.enemies = new Pool(SPAWNER.maxEnemies, makeEnemy);
    this.hash = new SpatialHash(32, 128, 128, SPAWNER.maxEnemies);
    this.scratch = new Int32Array(SPAWNER.maxEnemies); // query buffers (two, for nested queries)
    this.scratch2 = new Int32Array(SPAWNER.maxEnemies);
    this.spawner = new Spawner();
    this.projectiles = createProjectilePool();
    this.tickets = new Pool(TICKETS.maxOnFloor, makeTicket);
    this.items = new Pool(MAX_ITEMS, makeItem);
    this.score = new Score();
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
    this.score.reset();
    this.paused = false;
    this.beatT = 0;
    this.over = null; // the run's stats once the tech burns out
    this.choices = null; // level-up cards waiting for a pick
    this.chest = null; // what the last Change Approved chest gave, until it's dismissed
    this.autoPizza = false; // everything maxed: take the pizza without asking
    this.enemies.clear();
    this.projectiles.clear();
    this.tickets.clear();
    this.items.clear();
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

  get kills() {
    return this.score.kills;
  }

  // True while a level-up or chest screen is up; the floor doesn't move.
  get waiting() {
    return !!(this.choices || this.chest);
  }

  // True whenever ticks are skipped: a screen is up, the game is paused or the run is over.
  get frozen() {
    return this.waiting || this.paused || !!this.over;
  }

  // Ignored while a screen is already up (the floor is stopped anyway).
  pause() {
    if (!this.over && !this.waiting) this.paused = true;
  }

  resume() {
    this.paused = false;
  }

  tick(dt, axis) {
    const p = this.player;
    if (this.frozen) return this.hold();
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
    updateTickets(this, dt);
    updateItems(this, dt); // may open a chest
    const comeback = p.hp <= 0 && COMEBACKS.find((c) => p[c.counter] > 0);
    if (comeback) this.revive(comeback);
    else if (p.hp > 0 && p.pendingLevels > 0 && !this.chest) this.openLevelUp();
    this.score.update(dt);
    // Low sanity: you can hear your pulse.
    if (p.hp > 0 && p.hp < p.maxHp * 0.25 && (this.beatT -= dt) <= 0) {
      this.beatT = 0.9;
      this.sfx('heartbeat');
    }
    if (p.hp <= 0) this.endRun(false);
  }

  // While frozen, everything's previous position is its position, so the renderer's
  // interpolation holds still instead of swinging between the last two ticks.
  hold() {
    const p = this.player;
    p.px = p.x;
    p.py = p.y;
    for (const pool of [this.enemies, this.projectiles, this.tickets, this.items]) {
      for (let i = 0; i < pool.count; i++) {
        const o = pool.items[i];
        o.px = o.x;
        o.py = o.y;
      }
    }
  }

  // The shift is over: `over` holds what the summary screen shows. Winning needs the
  // final boss, which comes later.
  endRun(won) {
    const p = this.player;
    p.hp = Math.max(0, p.hp);
    this.choices = null;
    this.chest = null;
    this.paused = false;
    this.sfx(won ? 'victory' : 'burnout');
    this.shake(won ? 4 : 8);
    this.over = {
      won,
      character: p.def.name,
      mapName: this.map.name,
      time: this.time,
      kills: this.score.kills,
      csat: this.score.csat,
      bestStreak: this.score.bestStreak,
      level: p.level,
      tools: p.weapons
        .map((w) => ({
          name: w.def.name, icon: w.def.icon, desc: w.def.desc, evolved: !!w.def.evolved, damage: Math.round(w.damageDone),
          level: w.level, maxLevel: w.def.levels.length,
        }))
        .sort((a, b) => b.damage - a.damage),
      passives: Object.entries(p.passives).map(([id, level]) => {
        const d = PASSIVES[id];
        return { name: d.name, icon: d.icon, desc: d.desc, level, maxLevel: d.maxLevel };
      }),
    };
  }

  // --- Level-ups, chests, comebacks ---------------------------------------------------
  openLevelUp() {
    const p = this.player;
    const choices = rollChoices(this);
    if (this.autoPizza && choices.length === 1 && choices[0].kind === 'reward') {
      // Everything's maxed and the player said to stop asking: eat the pizza for every level.
      while (p.pendingLevels > 0) {
        applyChoice(this, choices[0]);
        p.pendingLevels--;
      }
      this.text(p.x, p.y - 30, 'VENDOR LUNCH', '#ffcd75');
      this.sfx('heal');
      return;
    }
    this.choices = choices;
    this.sfx('levelup');
  }

  // The player picked `card` from `choices`. `always`: take the pizza from now on.
  choose(card, always = false) {
    if (!this.choices) return;
    if (always) this.autoPizza = true;
    applyChoice(this, card);
    this.choices = null;
    if (--this.player.pendingLevels > 0) this.openLevelUp();
  }

  // Called by a Change Approved pickup.
  openChest() {
    this.chest = openChest(this);
    this.sfx('chest');
  }

  closeChest() {
    this.chest = null;
  }

  // Back from burnout (Extended Warranty): half sanity, a moment of PTO, users shoved away.
  revive(c) {
    const p = this.player;
    p[c.counter]--;
    p.hp = p.maxHp * 0.5;
    p.invuln = 3;
    const pool = this.enemies;
    for (let i = 0; i < pool.count; i++) {
      const e = pool.items[i];
      const dx = e.x - p.x;
      const dy = e.y - p.y;
      const d = Math.hypot(dx, dy) || 1;
      if (d < 160 && !e.heavy) {
        e.kx += (dx / d) * 400;
        e.ky += (dy / d) * 400;
      }
    }
    this.ring(p.x, p.y, 160, '#ffcd75', 0.6, true);
    this.shake(6);
    this.banner(c.title, c.text, 3);
    this.sfx('pto');
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
  // Exactly enough XP for the next level.
  debugLevelUp() {
    addXp(this, (this.player.xpNeed - this.player.xp) / this.player.stats.growth + 0.01);
  }
  debugChest() {
    dropItem(this, 'chest', this.player.x + 40, this.player.y);
  }
  // Every evolvable tool at max level plus its passive, so the next chest evolves one.
  debugEvolveKit() {
    const p = this.player;
    for (const [id, evo] of Object.entries(EVOLUTIONS)) {
      if (!weaponReady(id) || !weaponReady(evo.into)) continue;
      let w = p.weapons.find((x) => x.id === id);
      if (!w && p.weapons.some((x) => x.def.from === id)) continue; // already evolved
      if (!w && p.weapons.length < p.maxWeapons) p.weapons.push((w = createWeapon(id, p.weapons.length)));
      if (!w) continue;
      setWeaponLevel(w, w.def.levels.length);
      p.passives[evo.passive] = Math.max(1, p.passives[evo.passive] ?? 0);
    }
    recomputeStats(p);
  }
  // Every tool one level up.
  debugLevelWeapons() {
    for (const w of this.player.weapons) if (w.level < w.def.levels.length) setWeaponLevel(w, w.level + 1);
  }
}
