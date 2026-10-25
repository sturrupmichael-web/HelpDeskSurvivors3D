// Ported from the original (HelpDeskSurvivor src/game/behaviors/); the badge reader circle
// is drawn by the renderer (src/render/enemies.js) while `n` is set.
// Badge Brenda: chases you, and while she is within `radius` of you, you move at x`slow`
// (she's right behind you at every door).
// params: radius (px), slow (multiplier)

import chase from './chase.js';

export default {
  update: chase.update,
  post(e, game) {
    const p = game.player;
    const { radius, slow } = e.params;
    const dx = p.x - e.x;
    const dy = p.y - e.y;
    e.n = dx * dx + dy * dy < radius * radius ? 1 : 0;
    if (e.n && slow < p.tailgate) p.tailgate = slow;
  },
};
