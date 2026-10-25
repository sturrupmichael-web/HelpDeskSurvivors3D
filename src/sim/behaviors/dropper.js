// Ported from the original (HelpDeskSurvivor src/game/behaviors/).
// Printer Jammer: slow chaser that leaves paper-jam zones that slow the player.
// params: every (s), zone: { radius, life, slow }

import { stepToward } from './chase.js';

export default {
  init(e) {
    e.t0 = 1 + Math.random() * e.params.every;
  },
  update(e, game, dt) {
    stepToward(e, game.player.x, game.player.y, e.speed * e.slow * e.buff, dt);
    e.t0 -= dt;
    if (e.t0 <= 0) {
      e.t0 = e.params.every;
      game.zones.add(e.x, e.y + e.foot - 4, e.params.zone);
    }
  },
};
