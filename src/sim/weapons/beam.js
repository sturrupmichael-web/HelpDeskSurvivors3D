// "Beam" behavior: on cooldown, projects a wide beam at the nearest user (or the way
// you face) for `duration` seconds, sweeping it back and forth across the crowd, and
// hurts every user in it every `tick` seconds. Used by: Screen Share.
// stats: damage, cooldown, duration, tick, length, width, knockback
// Ported from the original. With no user in range it aims the way the tech faces; the
// renderer draws the beam along (`ux`, `uy`).

import { damageEnemy, nearestEnemy } from '../enemies.js';
import { hitBuf as buf } from '../../engine/spatialHash.js';

const SWEEP = 0.6; // radians either side of the aim the beam swings through

export default {
  init(w) {
    w.active = 0;
    w.aim = 0;
    w.ux = 1;
    w.uy = 0;
    w.timer = 0.8;
  },
  update(w, game, dt) {
    const s = w.stats;
    const p = game.player;
    if (w.active <= 0) {
      if ((w.timer -= dt) > 0) return;
      w.timer = s.cooldown * p.stats.cooldown;
      w.active = s.duration;
      const t = nearestEnemy(game, p.x, p.y, s.length * p.stats.area * 1.5);
      w.aim = t ? Math.atan2(t.y - p.y, t.x - p.x) : Math.atan2(Math.cos(p.facing), Math.sin(p.facing));
      w.dir = Math.random() < 0.5 ? 1 : -1;
      game.sfx('projector');
    }
    w.active -= dt;
    // One slow pass from one side of the aim to the other, like a presenter waving at the slide.
    const a = w.aim + w.dir * SWEEP * Math.cos((Math.PI * w.active) / s.duration);
    w.ux = Math.cos(a);
    w.uy = Math.sin(a);
    const len = s.length * p.stats.area;
    const half = (s.width * p.stats.area) / 2;
    const dmg = s.damage * p.stats.damage;
    const tick = s.tick * p.stats.cooldown;
    const now = game.time;
    const cx = p.x + (w.ux * len) / 2;
    const cy = p.y - 4 + (w.uy * len) / 2;
    const items = game.enemies.items;
    const n = game.hash.query(cx, cy, len / 2 + half + 16, buf);
    for (let i = 0; i < n; i++) {
      const e = items[buf[i]];
      if (e.dead || now - e.hitAt[w.slot] < tick) continue;
      const dx = e.x - p.x;
      const dy = e.y - (p.y - 4);
      const along = dx * w.ux + dy * w.uy;
      if (along < -e.r || along > len + e.r) continue;
      // The beam widens a little toward the far end, like a projector.
      if (Math.abs(dx * w.uy - dy * w.ux) > half * (0.6 + 0.4 * Math.max(0, along) / len) + e.r) continue;
      e.hitAt[w.slot] = now;
      damageEnemy(game, e, dmg, w, w.ux, w.uy, s.knockback);
    }
  },
};
