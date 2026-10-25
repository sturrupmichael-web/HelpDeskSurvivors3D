// "Grid" behavior: on cooldown, plans a square grid of tiles centered where you stand.
// After `plan` seconds the grid applies: for `live` seconds every tile hits each user on
// it once. Used by: Terraform Apply, Terraform Destroy (evolved: with `hitInterval`, live
// tiles hit the same user again every that many seconds).
// stats: damage, cooldown, size (tiles per side), tile (px), plan, live, knockback, hitInterval
// Ported from the original, with the grids pooled; the renderer draws the ones in `grids`.

import { damageEnemy } from '../enemies.js';
import { hitBuf as buf } from '../../engine/spatialHash.js';
import { Pool } from '../../engine/pool.js';

export default {
  init(w) {
    w.grids = new Pool(8, () => ({ x: 0, y: 0, half: 0, t: 0, cast: 0 })); // t counts up from 0: planning, then live
  },

  update(w, game, dt) {
    const s = w.stats;
    const p = game.player;
    if ((w.timer -= dt) <= 0) {
      w.timer += s.cooldown * p.stats.cooldown;
      const g = w.grids.spawn();
      if (g) {
        g.x = p.x;
        g.y = p.y + 4;
        g.half = (s.size * s.tile * p.stats.area) / 2;
        g.t = 0;
        g.cast = game.time;
      }
      game.sfx('blip', p.x);
    }
    const items = game.enemies.items;
    const dmg = s.damage * p.stats.damage;
    for (let i = w.grids.count - 1; i >= 0; i--) {
      const g = w.grids.items[i];
      const was = g.t;
      g.t += dt;
      if (g.t < s.plan) continue;
      if (was < s.plan) {
        game.sfx('zap', g.x);
        game.shake(2);
      }
      if (g.t > s.plan + s.live) {
        w.grids.removeAt(i);
        continue;
      }
      const n = game.hash.query(g.x, g.y, g.half * 1.42, buf);
      for (let k = 0; k < n; k++) {
        const e = items[buf[k]];
        // One hit per user per grid (hitAt remembers which grid last hit it), or one per
        // hitInterval seconds (hitAt is then the time of the last hit).
        if (e.dead || (s.hitInterval ? game.time - e.hitAt[w.slot] < s.hitInterval : e.hitAt[w.slot] === g.cast)) continue;
        if (Math.abs(e.x - g.x) > g.half + e.r * 0.5 || Math.abs(e.y - g.y) > g.half + e.r * 0.5) continue;
        e.hitAt[w.slot] = s.hitInterval ? game.time : g.cast;
        damageEnemy(game, e, dmg, w, e.x - g.x, e.y - g.y, s.knockback);
      }
    }
  },
};
