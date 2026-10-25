// Run statistics: tickets closed (kills) and the CSAT score with streak multiplier.
// Ported unchanged from the original's src/game/score.js.

import { CSAT } from '../../data/scoring.js';

export class Score {
  constructor() {
    this.reset();
  }
  reset() {
    this.kills = 0;
    this.csat = 0;
    this.streak = 0;
    this.streakT = 0;
    this.mult = 1;
    this.bestStreak = 0;
    this.combos = 0;
  }
  // Returns the streak length when it just hit a combo milestone, otherwise 0.
  onKill() {
    this.kills++;
    this.streak++;
    this.streakT = CSAT.streakWindow;
    this.mult = Math.min(CSAT.maxMultiplier, 1 + Math.floor(this.streak / CSAT.killsPerTier));
    this.csat += CSAT.pointsPerKill * this.mult;
    if (this.streak > this.bestStreak) this.bestStreak = this.streak;
    const n = this.streak;
    const last = CSAT.comboMilestones[CSAT.comboMilestones.length - 1];
    if (!CSAT.comboMilestones.includes(n) && !(n > last && n % CSAT.comboEvery === 0)) return 0;
    // Past the last milestone every repeat pays the same as the last one, so one long
    // streak can't grow the bonus without limit (and get the score refused by the board).
    this.csat += Math.round(Math.min(n, last) * CSAT.comboBonus) * this.mult;
    this.combos++;
    return n;
  }
  onHurt() {
    if (CSAT.resetOnHit) this.breakStreak();
  }
  breakStreak() {
    this.streak = 0;
    this.mult = 1;
  }
  update(dt) {
    if (this.streakT > 0 && (this.streakT -= dt) <= 0) this.breakStreak();
  }
}
