// "Trap" behavior: on cooldown, drops traps on the floor around you. The first users to
// walk over one get tied down (stunned for `root` seconds) and hurt; a trap snaps after
// `uses` users or `life` seconds. Used by: Zip Ties.
// stats: damage, cooldown, count, radius (trigger size), root, uses, life, spread (how
//        far from you they land)
// Ported from the original, with the traps pooled (a full pool reuses the oldest trap);
// the renderer draws the ones in `traps`.

import { damageEnemy, stunEnemy } from '../enemies.js';
import { hitBuf as buf } from '../../engine/spatialHash.js';
import { Pool } from '../../engine/pool.js';

const MAX = 40;

// All traps down: reuse the one closest to snapping.
function oldest(pool) {
  let best = pool.items[0];
  for (let i = 1; i < pool.count; i++) if (pool.items[i].life < best.life) best = pool.items[i];
  return best;
}

export default {
  init(w) {
    w.traps = new Pool(MAX, () => ({ x: 0, y: 0, life: 0, uses: 0, snap: 0 }));
    w.timer = 0.6;
  },
  update(w, game, dt) {
    const s = w.stats;
    const p = game.player;
    if ((w.timer -= dt) <= 0) {
      w.timer += s.cooldown * p.stats.cooldown;
      const count = s.count + (p.extraCount ?? 0);
      const a0 = Math.random() * Math.PI * 2;
      for (let i = 0; i < count; i++) {
        const t = w.traps.spawn() ?? oldest(w.traps);
        const a = a0 + (i / count) * Math.PI * 2;
        const d = s.spread * (0.5 + Math.random() * 0.5);
        t.x = p.x + Math.cos(a) * d;
        t.y = p.y + 6 + Math.sin(a) * d * 0.8;
        t.life = s.life;
        t.uses = s.uses;
        t.snap = 0;
      }
      game.sfx('ziptie');
    }
    const radius = s.radius * p.stats.area;
    const dmg = s.damage * p.stats.damage;
    const now = game.time;
    const items = game.enemies.items;
    for (let i = w.traps.count - 1; i >= 0; i--) {
      const t = w.traps.items[i];
      if (t.snap > 0) {
        // Just used up: show the zip tie pulled tight for a moment.
        if ((t.snap -= dt) <= 0) w.traps.removeAt(i);
        continue;
      }
      if ((t.life -= dt) <= 0) {
        w.traps.removeAt(i);
        continue;
      }
      const n = game.hash.query(t.x, t.y, radius + 12, buf);
      for (let k = 0; k < n && t.uses > 0; k++) {
        const e = items[buf[k]];
        if (e.dead || now - e.hitAt[w.slot] < s.root) continue;
        const dx = e.x - t.x;
        const dy = e.y + 4 - t.y;
        if (dx * dx + dy * dy > (radius + e.r) ** 2) continue;
        e.hitAt[w.slot] = now;
        t.uses--;
        stunEnemy(e, s.root);
        damageEnemy(game, e, dmg, w, 0, 0, 0);
        game.burst(e.x, e.y, ['#94b0c2', '#f4f4f4'], 3);
      }
      if (t.uses <= 0) t.snap = 0.25;
    }
  },
};
