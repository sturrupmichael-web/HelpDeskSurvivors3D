// Ported from the original (HelpDeskSurvivor src/game/behaviors/).
// Shadow IT Steve: chases, but every few seconds blinks a short distance closer.
// params: every (s), range (px), minDistance (px from the player)

import { stepToward } from './chase.js';

export default {
  init(e) {
    e.t0 = 1 + Math.random() * e.params.every;
  },
  update(e, game, dt) {
    const pl = game.player;
    stepToward(e, pl.x, pl.y, e.speed * e.slow * e.buff, dt);
    e.t0 -= dt;
    if (e.t0 > 0) return;
    const p = e.params;
    e.t0 = p.every * (0.7 + Math.random() * 0.6);
    let dx = pl.x - e.x;
    let dy = pl.y - e.y;
    const d = Math.hypot(dx, dy) || 1;
    // Jump toward the player at a slight angle, but never right on top of them.
    const a = Math.atan2(dy, dx) + (Math.random() - 0.5) * 1.6;
    const jump = Math.min(p.range, Math.max(0, d - p.minDistance));
    if (jump < 8) return;
    game.burst(e.x, e.y - 6, e.def.particle, 5);
    e.x += Math.cos(a) * jump;
    e.y += Math.sin(a) * jump;
    game.burst(e.x, e.y - 6, e.def.particle, 5);
  },
};
