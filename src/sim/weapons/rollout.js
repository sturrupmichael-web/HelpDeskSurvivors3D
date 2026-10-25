// "Rollout" behavior: on cooldown, a series of shockwave rings goes out from the player,
// one every `gap` seconds, each wider than the last (deployment rings: pilot, then
// broader). Each ring hits every user it passes once; the last ring also stuns.
// Used by: Patch Rollout, Patch Tuesday (evolved: the def's `stunAll` makes every ring stun).
// stats: damage, cooldown, radius, gap, rings (each ring's radius as a share of
//        `radius`), stun, knockback, speed
// Ported from the original; the renderer draws each live ring in `waves`.

import { damageEnemy, stunEnemy } from '../enemies.js';

export default {
  init(w) {
    w.waves = []; // live rings: { r, max, last }
    w.next = 0; // index of the next ring to send in this rollout
    w.gapT = 0;
  },

  update(w, game, dt) {
    const p = game.player;
    const s = w.stats;
    const { enemies, hash, scratch: buf } = game;
    const dmg = s.damage * p.stats.damage;
    for (let i = w.waves.length - 1; i >= 0; i--) {
      // Grow the ring and hit enemies inside the band it swept this tick.
      const ring = w.waves[i];
      const r0 = ring.r;
      const r1 = Math.min(ring.max, r0 + s.speed * p.stats.attackSpeed * dt);
      const n = hash.query(p.x, p.y, r1 + 16, buf);
      for (let k = 0; k < n; k++) {
        const e = enemies.items[buf[k]];
        if (e.dead) continue;
        const dx = e.x - p.x;
        const dy = e.y - p.y;
        const d = Math.max(0, Math.sqrt(dx * dx + dy * dy) - e.r);
        if (d < r0 || d >= r1) continue;
        if (ring.last || w.def.stunAll) stunEnemy(e, s.stun);
        damageEnemy(game, e, dmg, w, dx, dy, s.knockback);
      }
      ring.r = r1;
      if (r1 >= ring.max) w.waves.splice(i, 1);
    }
    // The rings of the current rollout, one per gap.
    if (w.next < s.rings.length && (w.gapT -= dt) <= 0) {
      const last = w.next === s.rings.length - 1;
      w.waves.push({ r: 0, max: s.radius * s.rings[w.next] * p.stats.area, last });
      w.next++;
      w.gapT = s.gap;
      game.sfx(last ? 'pulse' : 'shoot');
    }
    if ((w.timer -= dt) <= 0) {
      w.timer += s.cooldown * p.stats.cooldown + s.gap * (s.rings.length - 1);
      w.next = 0;
      w.gapT = 0;
    }
  },
};
