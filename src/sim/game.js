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
// same way (`paused`), and so do the menus between shifts (`menu`: title, Clock In, shop).
// A burnout, or clocking out after the final boss, pays out through `meta` (the save, see
// meta.js) and sets `over` to the run's stats until `newRun()`. The one thing the
// page tells the simulation is what part of the floor is on screen (`view`), which the
// spawner needs, as the original's spawner needed the canvas size.

import { CHARACTERS, COMEBACKS } from '../../data/player.js';
import { MAPS } from '../../data/maps.js';
import { SPAWNER } from '../../data/waves.js';
import { Pool } from '../engine/pool.js';
import { SpatialHash } from '../engine/spatialHash.js';
import { Floor } from './floor.js';
import { createPlayer, updatePlayer, addXp, recomputeStats, FOOT } from './player.js';
import { makeEnemy, updateEnemies, resolveEnemies, spawnEnemy, damageEnemy } from './enemies.js';
import { ENEMIES } from '../../data/enemies.js';
import { BEHAVIORS } from './behaviors/index.js';
import { Spawner, mapEvent } from './spawner.js';
import { WEAPONS } from '../../data/weapons.js';
import { createWeapon, createCrew, setWeaponLevel, updateWeapons, weaponReady } from './weapons/index.js';
import { createProjectilePool, updateProjectiles } from './projectiles.js';
import { TICKETS, MAX_ITEMS } from '../../data/pickups.js';
import { EVOLUTIONS } from '../../data/evolutions.js';
import { makeTicket, makeItem, updateTickets, updateItems, dropItem } from './pickups.js';
import { rollChoices, applyChoice, openChest } from './upgrades.js';
import { PASSIVES } from '../../data/passives.js';
import { Score } from './score.js';
import { Zones } from './zones.js';
import { MapTwist } from './maps.js';
import { Hazards } from './hazards.js';
import { EVENTS } from '../../data/waves.js';
import { Meta } from './meta.js';
import { Achievements } from './achievements.js';
import { Timeline } from './timeline.js';
import { performanceReview } from './review.js';
import { FLOOR_PERKS } from './perks.js';

const noop = () => {};
const HEADLESS_VIEW = [854, 480]; // world px "on screen" when there is no page, as in the original
const VICTORY_DELAY = 3.5; // seconds between closing the final boss and the summary screen

export class Sim {
  // Hooks: sfx(name, x), banner(title, text, seconds), shake(amount),
  // burst(x, y, colors, count), number(x, y, amount), ring(x, y, radius, color, life, fill),
  // text(x, y, words, color), toast(achievement).
  // `meta`: the save (Overtime Pay, the shop, techs, records); in memory by default.
  constructor(hooks = {}, meta = new Meta()) {
    this.sfx = hooks.sfx ?? noop;
    this.banner = hooks.banner ?? noop;
    this.shake = hooks.shake ?? noop;
    this.burst = hooks.burst ?? noop;
    this.number = hooks.number ?? noop;
    this.ring = hooks.ring ?? noop;
    this.text = hooks.text ?? noop;
    this.toast = hooks.toast ?? noop;
    this.meta = meta;
    this.menu = false; // a menu between shifts is up (the page sets it); the floor waits
    this.floor = new Floor();
    this.twist = new MapTwist();
    this.setMap('office');
    this.enemies = new Pool(SPAWNER.maxEnemies, makeEnemy);
    this.hash = new SpatialHash(32, 128, 128, SPAWNER.maxEnemies);
    this.scratch = new Int32Array(SPAWNER.maxEnemies); // query buffers (two, for nested queries)
    this.scratch2 = new Int32Array(SPAWNER.maxEnemies);
    this.spawner = new Spawner();
    this.projectiles = createProjectilePool();
    this.tickets = new Pool(TICKETS.maxOnFloor, makeTicket);
    this.items = new Pool(MAX_ITEMS, makeItem);
    this.score = new Score();
    this.zones = new Zones();
    this.hazards = new Hazards();
    this.boss = null; // the boss on the HUD bar (check bossAlive(): pool objects get reused)
    this.bossUid = 0;
    this.bossParts = []; // [enemy, uid] for every piece of a boss that splits (Rat's Nest, Hostile Takeover)
    this.bossMax = 1; // HP of the whole boss fight, for the HUD bar
    this.bossDef = null;
    // The visible floor around the camera's ground point, in world px: the four screen
    // corners (x, y pairs, clockwise from bottom left), the extents, and the farthest corner.
    this.view = { corners: new Float64Array(8), left: 0, right: 0, top: 0, bottom: 0, radius: 0 };
    const [w, h] = HEADLESS_VIEW;
    this.setView([-w / 2, h / 2, w / 2, h / 2, w / 2, -h / 2, -w / 2, -h / 2]);
    this.achievements = new Achievements(this);
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

  // Switches the floor and the twist to a map from data/maps.js (the page swaps the music).
  setMap(id) {
    this.mapId = id;
    this.map = MAPS[id];
    this.floor.setStyle(this.map.floor);
    this.floor.solid = !!this.map.solid;
  }

  // A new shift with `charId` on `mapId` (by default the tech and map picked in the save).
  newRun(charId = this.meta.data.selected, mapId = this.meta.data.map) {
    if (this.mapId !== mapId) this.setMap(mapId);
    this.charId = charId;
    const def = CHARACTERS[charId];
    this.player = createPlayer(def, this.meta);
    this.player.weapons.push(createWeapon(def.starter, 0));
    if (def.crew) this.player.innate.push(createCrew(def.crew)); // Help Desk Supervisor
    for (const id of def.alsoStarts ?? []) this.player.weapons.push(createWeapon(id, this.player.weapons.length)); // IT Director
    // Tools, passives and evolutions this save hasn't unlocked yet (data/unlocks.js).
    this.player.locked = (kind, id) => !this.meta.itemUnlocked(kind, id);
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
    this.zones.clear();
    this.twist.reset();
    this.hazards.clear();
    this.spawner.reset();
    this.boss = null;
    this.bossParts.length = 0;
    this.bossPhase2 = false; // the current fight has reached its second phase (behaviors/phase2.js)
    this.victoryT = 0; // counting down to the summary after the final boss
    this.perkT = {}; // floor perks (perks.js): seconds since each last fired
    this.timeline = new Timeline();
    this.achievements.startRun();
    // Start in a clear spot: walk down from the origin until the feet are off furniture.
    const p = this.player;
    while (this.floor.blocked(p.x, p.y + FOOT)) p.y += 8;
    p.px = p.x;
    p.py = p.y;
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
    return this.waiting || this.paused || this.menu || !!this.over;
  }

  // Ignored while a screen is already up (the floor is stopped anyway).
  pause() {
    if (!this.over && !this.waiting && !this.menu) this.paused = true;
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
    this.techPerks(dt);
    updateProjectiles(this, dt);
    this.enemies.compact(); // hash indices are stale after this point
    this.zones.update(this, dt);
    this.twist.update(this, dt);
    this.hazards.update(this, dt);
    updateTickets(this, dt);
    updateItems(this, dt); // may open a chest
    const comeback = p.hp <= 0 && COMEBACKS.find((c) => p[c.counter] > 0);
    if (comeback) this.revive(comeback);
    else if (p.hp > 0 && p.pendingLevels > 0 && !this.chest && this.victoryT <= 0) this.openLevelUp();
    this.score.update(dt);
    this.timeline.update(this);
    this.achievements.update(dt);
    // Low sanity: you can hear your pulse.
    if (p.hp > 0 && p.hp < p.maxHp * 0.25 && (this.beatT -= dt) <= 0) {
      this.beatT = 0.9;
      this.sfx('heartbeat');
    }
    if (p.hp <= 0) this.endRun(false);
    else if (this.victoryT > 0 && (this.victoryT -= dt) <= 0) this.endRun(true);
  }

  // Tech perks that act on the floor on a timer (FLOOR_PERKS in perks.js). Not during the
  // victory walk-off.
  techPerks(dt) {
    const d = this.player.def;
    if (this.spawner.stopped || this.victoryT > 0) return;
    for (const key in FLOOR_PERKS) {
      if (d[key] === undefined) continue;
      this.perkT[key] = (this.perkT[key] ?? 0) + dt;
      if (FLOOR_PERKS[key](this, d[key], this.perkT[key])) this.perkT[key] = 0;
    }
  }

  // While frozen, everything's previous position is its position, so the renderer's
  // interpolation holds still instead of swinging between the last two ticks.
  hold() {
    const p = this.player;
    p.px = p.x;
    p.py = p.y;
    for (const pool of [this.enemies, this.projectiles, this.tickets, this.items, this.hazards.bullets]) {
      for (let i = 0; i < pool.count; i++) {
        const o = pool.items[i];
        o.px = o.x;
        o.py = o.y;
      }
    }
  }

  // The shift is over (burned out, or `won` by closing the final boss): pays out and
  // updates the records (meta.finishShift), checks achievements, writes the performance
  // review, and `over` holds everything the summary screen shows.
  endRun(won) {
    const p = this.player;
    p.hp = Math.max(0, p.hp);
    this.choices = null;
    this.chest = null;
    this.paused = false;
    this.sfx(won ? 'victory' : 'burnout');
    this.shake(won ? 4 : 8);
    const stats = {
      won,
      character: p.def.name,
      map: this.mapId,
      mapName: this.map.name,
      time: this.time,
      kills: this.score.kills,
      csat: this.score.csat,
      policies: [], // Shift Policies arrive with M12
      evolutions: this.achievements.run.evolutions,
      bestStreak: this.score.bestStreak,
      level: p.level,
      payMult: p.def.payMult ?? 1, // IT Director
      tools: [...p.weapons, ...p.innate]
        .map((w) => ({
          name: w.def.name, icon: w.def.icon, desc: w.def.desc, evolved: !!w.def.evolved, damage: Math.round(w.damageDone),
          level: w.level, maxLevel: w.def.levels.length,
        }))
        .sort((a, b) => b.damage - a.damage),
      passives: Object.entries(p.passives).map(([id, level]) => {
        const d = PASSIVES[id];
        return { name: d.name, icon: d.icon, desc: d.desc, level, maxLevel: d.maxLevel };
      }),
      timeline: this.timeline.result(this),
    };
    const { pay, records, newMap, newUnlocks } = this.meta.finishShift(stats);
    const r = this.achievements.run;
    r.ended = true;
    r.won = won;
    r.time = this.time;
    r.kills = this.score.kills;
    this.achievements.check();
    const review = performanceReview(stats, r);
    this.over = { ...stats, pay, records, newMap, newUnlocks, review, balance: this.meta.data.pay };
  }

  // --- Bosses -------------------------------------------------------------------------
  setBoss(e) {
    this.boss = e;
    this.bossUid = e.uid;
    this.bossParts.length = 0;
    this.bossParts.push([e, e.uid]);
    this.bossMax = e.maxHp;
    this.bossPhase2 = false;
    this.bossDef = e.def; // the pieces' pool objects may be reused by the time it's over
    this.achievements.run.bossesMet.push(e.def.sprite); // for the review (and the Knowledge Base, later)
    this.shake(5);
  }

  // Another piece of the current boss: the fight lasts until every piece is down.
  addBossPart(e) {
    this.bossParts.push([e, e.uid]);
  }

  bossAlive() {
    const b = this.boss;
    if (b && !b.dead && b.uid === this.bossUid) return true;
    // The tracked piece is down: follow another live one, if any.
    for (const [e, uid] of this.bossParts) {
      if (e.dead || e.uid !== uid) continue;
      this.boss = e;
      this.bossUid = uid;
      return true;
    }
    return false;
  }

  // HUD bar: what is left of the whole fight (all pieces together).
  bossHpFrac() {
    let hp = 0;
    for (const [e, uid] of this.bossParts) if (!e.dead && e.uid === uid) hp += Math.max(0, e.hp);
    return Math.min(1, hp / this.bossMax);
  }

  // Called from killEnemy for any boss.
  onBossDown(e) {
    if (this.bossParts.length > 1 && this.bossAlive()) {
      // One piece of a split boss: the fight goes on.
      this.shake(4);
      this.ring(e.x, e.y, 50, '#ffcd75', 0.5, true);
      this.burst(e.x, e.y - 10, e.def.particle, 20);
      this.sfx('pop');
      return;
    }
    this.shake(8);
    this.ring(e.x, e.y, 90, '#ffcd75', 0.6, true);
    this.ring(e.x, e.y, 120, '#f4f4f4', 0.8);
    this.burst(e.x, e.y - 20, e.def.particle, 40);
    this.hazards.clear();
    if (e.def.final) {
      // Shift over: everyone else goes home, then the summary screen.
      this.victoryT = VICTORY_DELAY;
      this.spawner.stopped = true;
      this.player.invuln = VICTORY_DELAY + 1;
      const pool = this.enemies;
      for (let i = 0; i < pool.count; i++) {
        const o = pool.items[i];
        if (o.dead) continue;
        o.dead = true;
        if (i < 200) this.burst(o.x, o.y - 6, o.def.particle, 2);
      }
      for (let i = 0; i < this.tickets.count; i++) this.tickets.items[i].magnet = true; // bulk close on the way out
      const [title, text] = e.def.downBanner ?? ['SHIFT COMPLETE', 'Everyone went home.'];
      this.banner(title, text, VICTORY_DELAY);
      this.sfx('evolve');
    } else {
      // A split boss's last piece (no banner of its own) counts as the whole boss.
      const def = e.def.downBanner || !this.bossDef ? e.def : this.bossDef;
      this.achievements.run.bosses.push(def.sprite);
      const [title, text] = def.downBanner ?? ['BOSS DOWN', 'Grab the Change Approved.'];
      this.banner(title, text, 3);
      dropItem(this, 'chest', e.x, e.y);
      this.sfx('chest');
    }
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

  // Escalation Path (shop): new cards for one of the shift's rerolls.
  reroll() {
    const p = this.player;
    const onlyPizza = this.choices?.length === 1 && this.choices[0].kind === 'reward';
    if (!this.choices || onlyPizza || p.rerolls <= 0) return false;
    p.rerolls--;
    this.choices = rollChoices(this);
    return true;
  }

  // Called by a Change Approved pickup.
  openChest() {
    this.chest = openChest(this);
    if (this.chest.evolved) this.achievements.run.evolutions++;
    this.sfx('chest');
  }

  closeChest() {
    this.chest = null;
  }

  // Back from burnout (Extended Warranty): half sanity, a moment of PTO, users shoved away.
  revive(c) {
    const p = this.player;
    p[c.counter]--;
    this.achievements.run.revived = true;
    this.timeline.mark(this, 'revive', 'Back from burnout');
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
  // One of every regular user whose behavior is ported, in a ring round the tech.
  debugSpawnEach() {
    const ids = Object.keys(ENEMIES).filter((id) => !ENEMIES[id].boss && BEHAVIORS[ENEMIES[id].behavior] && id !== 'consultant_b');
    const p = this.player;
    ids.forEach((id, i) => {
      const a = (i / ids.length) * Math.PI * 2;
      spawnEnemy(this, id, p.x + Math.cos(a) * 140, p.y + Math.sin(a) * 140);
    });
    return ids.length;
  }
  // Starts a boss fight right now: the next boss on the timeline (this map's own at
  // 10:00), or the Executive.
  debugBoss() {
    const bosses = EVENTS.filter((e) => e.type === 'boss');
    const next = bosses.find((e) => e.t > this.time) ?? bosses[bosses.length - 1];
    const ev = mapEvent(next, this.map);
    this.banner(ev.title, ev.text, 3);
    this.sfx('siren');
    this.spawner.done.add(next); // the timeline won't send it again
    this.spawner.bossEvent(this, ev);
    return ev;
  }
  // Knocks a quarter of its HP off the current boss (to see its phases and the ending).
  debugHitBoss() {
    if (!this.bossAlive()) return false;
    const e = this.boss;
    damageEnemy(this, e, Math.min(e.hp + 1, e.maxHp * 0.25), null, 0, 0, 0);
    return true;
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
  // Swaps the newest tool for the next one in the toolbox that the tech doesn't have (or
  // adds one while a slot is free), so every tool can be tried in turn. Returns it.
  debugSwapWeapon() {
    const p = this.player;
    if (p.weapons.length < p.maxWeapons || !p.weapons.length) return this.debugAddWeapon();
    const ids = Object.keys(WEAPONS).filter((k) => weaponReady(k) && !WEAPONS[k].evolved);
    const last = p.weapons[p.weapons.length - 1];
    const from = ids.indexOf(last.def.from ?? last.id);
    for (let i = 1; i <= ids.length; i++) {
      const id = ids[(from + i) % ids.length];
      if (p.weapons.some((w) => w.id === id || w.def.from === id)) continue;
      const w = createWeapon(id, last.slot);
      p.weapons[p.weapons.length - 1] = w;
      return w;
    }
    return null;
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
