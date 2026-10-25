// Ported unchanged from the original's src/game/timeline.js.

// Shift timeline (idea 29): sanity, tickets closed and damage dealt, sampled every few
// seconds, plus marks for bosses and revives. Drawn on the end-of-shift screen
// (src/ui/screens/timeline.js).

export const TIMELINE_STEP = 5; // seconds between samples

export class Timeline {
  constructor() {
    this.reset();
  }

  reset() {
    this.points = []; // { t, hp (0-100), kills (in this step), dmg (in this step) }
    this.marks = []; // { t, kind: 'boss' | 'revive', name }
    this.next = 0;
    this.kills = 0;
    this.dmg = 0;
    this.damage = 0; // running total, added to by damageEnemy
  }

  update(game) {
    if (game.time < this.next) return;
    this.next += TIMELINE_STEP;
    this.sample(game);
  }

  sample(game) {
    const p = game.player;
    const kills = game.score.kills;
    this.points.push({
      t: Math.round(game.time),
      hp: Math.max(0, Math.round((p.hp / p.maxHp) * 100)),
      kills: kills - this.kills,
      dmg: Math.round(this.damage - this.dmg),
    });
    this.kills = kills;
    this.dmg = this.damage;
  }

  mark(game, kind, name) {
    this.marks.push({ t: Math.round(game.time), kind, name });
  }

  // What endRun hands the summary screen.
  result(game) {
    this.sample(game);
    return { step: TIMELINE_STEP, points: this.points, marks: this.marks };
  }
}
