// "Shield" behavior: every `cooldown` seconds a bubble pops up around you for
// `duration` seconds. Users touching it take damage and get shoved out; boss bullets
// that reach it bounce off and vanish. Used by: Out-of-Office Reply, Sabbatical
// (evolved: boss bullets are sent back as homing replies for `reflect` damage each).
// stats: cooldown, duration, radius, damage, knockback, reflect
// Ported from the original; the renderer draws the bubble while `active` lasts.

import { damageEnemy, nearestEnemy } from '../enemies.js';
import { fireProjectile } from '../projectiles.js';
import { hitBuf as buf } from '../../engine/spatialHash.js';

const HIT_EVERY = 0.25;

export default {
  init(w) {
    w.active = 0;
  },
  update(w, game, dt) {
    const s = w.stats;
    const p = game.player;
    if (w.active <= 0) {
      if ((w.timer -= dt) > 0) return;
      w.timer = s.cooldown * p.stats.cooldown;
      w.active = s.duration;
      game.sfx('bubble');
    }
    w.active -= dt;
    const radius = s.radius * p.stats.area;
    const dmg = s.damage * p.stats.damage;
    const now = game.time;
    const items = game.enemies.items;
    const n = game.hash.query(p.x, p.y, radius + 20, buf);
    for (let k = 0; k < n; k++) {
      const e = items[buf[k]];
      if (e.dead) continue;
      const dx = e.x - p.x;
      const dy = e.y - p.y;
      if (dx * dx + dy * dy > (radius + e.r) ** 2) continue;
      if (now - e.hitAt[w.slot] < HIT_EVERY) continue;
      e.hitAt[w.slot] = now;
      damageEnemy(game, e, dmg, w, dx || 1, dy, s.knockback);
    }
    const bl = game.hazards.bullets;
    for (let i = bl.count - 1; i >= 0; i--) {
      const b = bl.items[i];
      if ((b.x - p.x) ** 2 + (b.y - p.y) ** 2 > radius * radius) continue;
      game.burst(b.x, b.y, ['#73eff7', '#f4f4f4'], 4);
      if (s.reflect) {
        // Return to sender: an auto-reply that homes in on the boss (or whoever's nearest).
        const t = game.bossAlive() ? game.boss : nearestEnemy(game, b.x, b.y, 300);
        fireProjectile(game, w, b.x, b.y, t ? t.x - b.x : b.x - p.x, t ? t.y - b.y : b.y - p.y, {
          kind: 'homing', spr: w.def.sprite, speed: 260, damage: s.reflect * p.stats.damage,
          pierce: 0, life: 3, turn: 8, target: t, r: 6, knockback: 60,
        });
      }
      bl.removeAt(i);
    }
  },
};
