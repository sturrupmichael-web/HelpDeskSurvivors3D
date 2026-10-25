// Ported unchanged from the original (HelpDeskSurvivor src/game/behaviors/).
// "Quick Question" Quinn: drifts closer, then darts in a straight line at high speed.
// params: dashEvery (s), dashTime (s), dashMult (x speed), range (px), approachMult

import { stepToward } from './chase.js';

export default {
  init(e) {
    e.t0 = Math.random() * e.params.dashEvery; // time until next dash
    e.t1 = 0; // dash time remaining
  },
  update(e, game, dt) {
    const p = e.params;
    const speed = e.speed * e.slow * e.buff;
    if (e.t1 > 0) {
      e.t1 -= dt;
      e.x += e.dx * speed * p.dashMult * dt;
      e.y += e.dy * speed * p.dashMult * dt;
      return;
    }
    const d = stepToward(e, game.player.x, game.player.y, speed * p.approachMult, dt);
    e.t0 -= dt;
    if (e.t0 <= 0 && d < p.range) {
      e.dx = (game.player.x - e.x) / d;
      e.dy = (game.player.y - e.y) / d;
      e.t1 = p.dashTime;
      e.t0 = p.dashEvery;
    }
  },
};
