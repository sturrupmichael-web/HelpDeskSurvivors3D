// "Boomerang" behavior: throws spinning projectiles that pierce everything, slow
// down, and fly back to the player. Used by: KB Article, Confluence Space (evolved: the
// def's `ring: true` throws them evenly all the way round, and `curl` bends each
// throw into a spiral, in rad/s), Fairway Driver (a `curl` stat, and the def's `curlAlt`:
// every other disc bends the other way, so the throws fan out in two arcs).
// stats: damage, cooldown, count, speed, range, knockback, curl
// Ported from the original. With no user in range it throws the way the tech faces.

import { fireProjectile } from '../projectiles.js';
import { nearestEnemy } from '../enemies.js';

export default {
  update(w, game, dt) {
    const s = w.stats;
    const p = game.player;
    if ((w.timer -= dt) > 0) return;
    w.timer += s.cooldown * p.stats.cooldown;
    game.sfx('throw');
    const t = nearestEnemy(game, p.x, p.y, 400);
    const base = t ? Math.atan2(t.y - p.y, t.x - p.x) : Math.atan2(Math.cos(p.facing), Math.sin(p.facing));
    const speed = s.speed * p.stats.attackSpeed;
    const range = s.range * p.stats.area;
    const count = s.count + (p.extraCount ?? 0);
    for (let i = 0; i < count; i++) {
      const curl = (s.curl ?? w.def.curl ?? 0) * (w.def.curlAlt && i % 2 ? -1 : 1);
      // A curling throw (not the ring) starts off to one side so its arc sweeps across the target.
      const a = w.def.ring ? base + (i / count) * Math.PI * 2 : base + (i - (count - 1) / 2) * 0.55 - (w.def.curlAlt ? curl * 0.3 : 0);
      fireProjectile(game, w, p.x, p.y - 4, Math.cos(a), Math.sin(a), {
        kind: 'boomerang', spr: w.def.sprite, speed, damage: s.damage * p.stats.damage,
        pierce: 999, life: 6, knockback: s.knockback, r: 7, spin: 10, curl,
        decel: (speed * speed) / (2 * range), // stops after `range` px, then returns
      });
    }
  },
};
