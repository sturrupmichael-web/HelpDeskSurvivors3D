// "Disc" behavior: throws discs at the nearest users that ricochet from user to user
// instead of coming back. Every `aceEvery`-th throw adds a big ace disc (`aceMult` damage,
// `aceBounces` bounces) whose kill drops the def's `aceDrop` pickup (see projectiles.js).
// At `fullHp` of max sanity or more, every disc bounces once more. Used by: The 19th Hole.
// stats: damage, cooldown, count, speed, life, bounces, bounceRange, knockback, aceEvery,
//        aceMult, aceBounces, fullHp
// Ported from the original. With no user in range it throws the way the tech faces.

import { fireProjectile } from '../projectiles.js';
import { nearestEnemy } from '../enemies.js';

export default {
  init(w) {
    w.throws = 0;
  },

  update(w, game, dt) {
    const s = w.stats;
    const p = game.player;
    if ((w.timer -= dt) > 0) return;
    w.timer += s.cooldown * p.stats.cooldown;
    w.throws++;
    game.sfx('throw');
    const t = nearestEnemy(game, p.x, p.y, 400);
    const base = t ? Math.atan2(t.y - p.y, t.x - p.x) : Math.atan2(Math.cos(p.facing), Math.sin(p.facing));
    const speed = s.speed * p.stats.attackSpeed;
    const extra = p.hp >= p.maxHp * s.fullHp ? 1 : 0; // fed and focused
    const disc = (a, ace) =>
      fireProjectile(game, w, p.x, p.y - 4, Math.cos(a), Math.sin(a), {
        spr: w.def.sprite, speed: ace ? speed * 1.15 : speed, damage: s.damage * p.stats.damage * (ace ? s.aceMult : 1),
        pierce: 999, life: s.life, knockback: s.knockback * (ace ? 1.5 : 1), r: ace ? 11 : 7, spin: ace ? 16 : 12,
        scale: ace ? 1.75 : 1, ace, bounce: (ace ? s.aceBounces : s.bounces) + extra, bounceRange: s.bounceRange * p.stats.area,
      });
    const count = s.count + (p.extraCount ?? 0);
    for (let i = 0; i < count; i++) disc(base + (i - (count - 1) / 2) * 0.5, false);
    if (w.throws % s.aceEvery === 0) {
      disc(base, true);
      game.sfx('ping', p.x);
    }
  },
};
