// "Aura" behavior: a persistent field around the player that slows enemies inside it
// and damages them every `tick` seconds. Used by: Group Policy Push, Domain Lockdown
// (evolved: users in the outer `edge` share of the field freeze solid for `freeze` s
// on each tick). The Systems Engineer's `auraArea` makes every aura bigger.
// stats: damage, tick, radius, slow, edge, freeze
// Ported from the original; the renderer sizes the field with `auraRadius`.

import { damageEnemy, stunEnemy } from '../enemies.js';
import { hitBuf as buf } from '../../engine/spatialHash.js';

export const auraRadius = (w, p) => w.stats.radius * p.stats.area * (1 + (p.def.auraArea ?? 0));

export default {
  update(w, game, dt) {
    const s = w.stats;
    const p = game.player;
    const radius = auraRadius(w, p);
    const r2 = radius * radius;
    const now = game.time;
    const tick = s.tick * p.stats.cooldown;
    const dmg = s.damage * p.stats.damage;
    const items = game.enemies.items;
    const inner2 = s.freeze ? (radius * (1 - s.edge)) ** 2 : Infinity;
    const n = game.hash.query(p.x, p.y, radius, buf);
    for (let k = 0; k < n; k++) {
      const e = items[buf[k]];
      if (e.dead) continue;
      const dx = e.x - p.x;
      const dy = e.y - p.y;
      const d2 = dx * dx + dy * dy;
      if (d2 >= r2) continue;
      if (e.slow > s.slow) e.slow = s.slow;
      if (now - e.hitAt[w.slot] >= tick) {
        e.hitAt[w.slot] = now;
        if (d2 > inner2) stunEnemy(e, s.freeze);
        damageEnemy(game, e, dmg, w, 0, 0, 0);
      }
    }
  },
};
