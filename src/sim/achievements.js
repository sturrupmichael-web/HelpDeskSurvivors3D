// Achievement tracking: a per-run tracker the game updates as things happen, checked
// against data/achievements.js. Unlocks are stored in the save (meta.data.achievements)
// and announced with a toast (the `toast` hook; the page shows it over the HUD).
// Ported from the original's src/game/achievements.js; the toast and the sound go through
// the simulation's hooks.

import { ACHIEVEMENTS } from '../../data/achievements.js';

export class Achievements {
  constructor(game) {
    this.game = game;
    this.t = 0;
    this.startRun();
  }

  startRun() {
    this.run = {
      time: 0, kills: 0, killsById: {}, maxMult: 1, evolutions: 0, pizzas: 0,
      bosses: [], bossesMet: [], won: false, ended: false, revived: false, minHpFrac: 1,
      policies: [...(this.game.policy?.ids ?? [])], // this shift's Shift Policies
      hardcore: !!this.game.policy?.hardcore,
    };
  }

  get unlocked() {
    const d = this.game.meta.data;
    return (d.achievements ??= {});
  }

  onKill(id) {
    this.run.killsById[id] = (this.run.killsById[id] ?? 0) + 1;
  }

  // Called every tick; does the real check about once a second.
  update(dt) {
    const g = this.game;
    const r = this.run;
    const p = g.player;
    r.time = g.time;
    r.kills = g.score.kills;
    if (g.score.mult > r.maxMult) r.maxMult = g.score.mult;
    const frac = p.hp / p.maxHp;
    if (frac < r.minHpFrac) r.minHpFrac = frac;
    if ((this.t -= dt) <= 0) {
      this.t = 1;
      this.check();
    }
  }

  // Checks every locked achievement; returns the newly unlocked ones.
  check() {
    const u = this.unlocked;
    const fresh = [];
    for (const a of ACHIEVEMENTS) {
      if (u[a.id] || !a.check(this.run, this.game.meta.data)) continue;
      u[a.id] = Date.now();
      fresh.push(a);
      this.game.toast(a);
    }
    if (fresh.length) {
      this.game.meta.save();
      this.game.sfx('chest');
    }
    return fresh;
  }
}
