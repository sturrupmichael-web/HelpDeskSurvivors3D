// "Duck" behavior: rubber ducks circle you at `orbit` px. Every `cooldown` seconds each
// one quacks: users within `radius` of it take damage and get flagged for `mark`
// seconds, taking `markAmp` extra damage from every tool meanwhile. Used by: Rubber Duck.
// stats: damage, cooldown, radius, orbit, rotSpeed, mark, markAmp
// Ported from the original. `prevAngle` is the angle a tick ago, for interpolation; the
// renderer places the ducks with `duckSpot`, the same math the quacks use.

import { damageEnemy, markEnemy } from '../enemies.js';
import { hitBuf as buf } from '../../engine/spatialHash.js';

// Duck i's offset from the player at ring angle `angle`, written into `out` ({x, y}).
export function duckSpot(w, p, angle, i, out) {
  const count = duckCount(p);
  const a = angle + (i / count) * Math.PI * 2;
  const orbit = w.stats.orbit * p.stats.area;
  out.x = Math.cos(a) * orbit;
  out.y = Math.sin(a) * orbit * 0.8;
  return out;
}

export const duckCount = (p) => 1 + (p.extraCount ?? 0);

const spot = { x: 0, y: 0 };

export default {
  init(w) {
    w.angle = 0;
    w.prevAngle = 0;
    w.quackT = 0; // seconds since the last quack, for the drawing
    w.timer = 1;
  },
  update(w, game, dt) {
    const s = w.stats;
    const p = game.player;
    w.prevAngle = w.angle;
    w.angle += s.rotSpeed * p.stats.attackSpeed * dt;
    w.quackT += dt;
    if ((w.timer -= dt) > 0) return;
    w.timer += s.cooldown * p.stats.cooldown;
    w.quackT = 0;
    const count = duckCount(p);
    const radius = s.radius * p.stats.area;
    const dmg = s.damage * p.stats.damage;
    const items = game.enemies.items;
    for (let i = 0; i < count; i++) {
      duckSpot(w, p, w.angle, i, spot);
      const dx0 = p.x + spot.x;
      const dy0 = p.y + spot.y;
      const n = game.hash.query(dx0, dy0, radius + 16, buf);
      for (let k = 0; k < n; k++) {
        const e = items[buf[k]];
        if (e.dead) continue;
        const dx = e.x - dx0;
        const dy = e.y - dy0;
        if (dx * dx + dy * dy > (radius + e.r) ** 2) continue;
        markEnemy(e, s.mark, s.markAmp);
        damageEnemy(game, e, dmg, w, dx, dy, 30);
      }
      game.ring(dx0, dy0 - 4, radius, '#ffcd75', 0.25);
    }
    game.sfx('quack', p.x);
  },
};
