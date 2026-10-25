// "Sweep" behavior: a radar beam circles you nonstop and hits every user it passes
// over (each user at most once per `hitInterval`). Used by: Ping Sweep, SIEM (evolved:
// `beams` evenly spaced beams, and every user hit is flagged for `mark` seconds,
// taking `markAmp` extra damage from everything meanwhile).
// stats: damage, range, rotSpeed, width (radians behind the beam that count as hit),
//        hitInterval, beams, mark, markAmp
// Ported from the original. `prevAngle` is the angle a tick ago, for interpolation.

import { damageEnemy, markEnemy } from '../enemies.js';
import { hitBuf as buf } from '../../engine/spatialHash.js';

const TAU = Math.PI * 2;

export default {
  init(w) {
    w.angle = 0;
    w.prevAngle = 0;
  },
  update(w, game, dt) {
    const s = w.stats;
    const p = game.player;
    const prev = w.angle;
    w.prevAngle = prev;
    w.angle = (w.angle + s.rotSpeed * p.stats.attackSpeed * dt) % TAU;
    if (w.angle < prev) game.sfx('ping'); // the beam came all the way round
    const range = s.range * p.stats.area;
    const dmg = s.damage * p.stats.damage;
    const now = game.time;
    const gap = TAU / (s.beams ?? 1);
    const items = game.enemies.items;
    const n = game.hash.query(p.x, p.y, range + 16, buf);
    for (let k = 0; k < n; k++) {
      const e = items[buf[k]];
      if (e.dead || now - e.hitAt[w.slot] < s.hitInterval) continue;
      const dx = e.x - p.x;
      const dy = e.y - p.y;
      if (dx * dx + dy * dy > (range + e.r) ** 2) continue;
      // How far the beam has passed it (with several beams, the nearest one behind it).
      const behind = (((w.angle - Math.atan2(dy, dx)) % gap) + gap) % gap;
      if (behind > s.width) continue;
      e.hitAt[w.slot] = now;
      if (s.mark) markEnemy(e, s.mark, s.markAmp);
      damageEnemy(game, e, dmg, w, 0, 0, 0);
    }
  },
};
