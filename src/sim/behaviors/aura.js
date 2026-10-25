// Ported from the original (HelpDeskSurvivor src/game/behaviors/); the aura circle is
// drawn by the renderer (src/render/enemies.js).
// The VIP: elite chaser whose "this is urgent" aura speeds up nearby end-users.
// params: radius (px), speedBuff (multiplier)

import chase from './chase.js';

export default {
  update: chase.update,
  // Runs after the spatial hash is built each tick.
  post(e, game) {
    const { radius, speedBuff } = e.params;
    const buf = game.scratch2;
    const n = game.hash.query(e.x, e.y, radius, buf);
    const r2 = radius * radius;
    for (let k = 0; k < n; k++) {
      const o = game.enemies.items[buf[k]];
      if (o === e || o.dead) continue;
      const dx = o.x - e.x;
      const dy = o.y - e.y;
      if (dx * dx + dy * dy < r2 && o.buff < speedBuff) o.buff = speedBuff;
    }
  },
};
