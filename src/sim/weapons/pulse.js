// "Pulse" behavior: on cooldown, a shockwave ring expands from the player and hits
// every enemy it passes over once, knocking them back.
// Used by: Turn It Off and On Again, Fleet-Wide Reboot (evolved: `stun`, and the def's
// ringColors/ringWidth for a thicker two-tone ring).
// Ported from the original; the renderer draws the ring from `ring` and `ringMax`.

import { damageEnemy, stunEnemy } from '../enemies.js';

export default {
  init(w) {
    w.ring = -1; // current ring radius, -1 when no ring is active
    w.ringMax = 0;
  },

  update(w, game, dt) {
    const p = game.player;
    const s = w.stats;
    if (w.ring >= 0) {
      // Grow the ring and hit enemies inside the band it swept this tick.
      const r0 = w.ring;
      const r1 = Math.min(w.ringMax, r0 + s.speed * p.stats.attackSpeed * dt);
      const { enemies, hash, scratch: buf } = game;
      const n = hash.query(p.x, p.y, r1 + 16, buf);
      const dmg = s.damage * p.stats.damage;
      for (let k = 0; k < n; k++) {
        const e = enemies.items[buf[k]];
        if (e.dead) continue;
        const dx = e.x - p.x;
        const dy = e.y - p.y;
        const d = Math.max(0, Math.sqrt(dx * dx + dy * dy) - e.r);
        if (d < r0 || d >= r1) continue;
        if (s.stun) stunEnemy(e, s.stun);
        damageEnemy(game, e, dmg, w, dx, dy, s.knockback);
      }
      w.ring = r1 >= w.ringMax ? -1 : r1;
    }
    w.timer -= dt;
    if (w.timer <= 0) {
      w.timer += s.cooldown * p.stats.cooldown;
      w.ring = 0;
      w.ringMax = s.radius * p.stats.area;
      game.sfx('pulse');
    }
  },
};
