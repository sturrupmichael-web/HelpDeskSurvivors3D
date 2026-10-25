// "Whip" behavior: on cooldown, lashes a patch cable at a boss in reach, else the nearest
// user (or the way you face; behind you too from `sides: 2`), hitting everything in a
// long thin strip.
// Used by: Patch Cable, Fiber Backbone (evolved: `full: true` hits a whole circle).
// stats: damage, cooldown, range, width, sides, knockback, full
// Ported from the original. With no user in range it lashes the way the tech faces; the
// renderer draws the lash from `flash` (SHOW seconds, counting down) along (`ux`, `uy`).

import { damageEnemy, nearestEnemy } from '../enemies.js';
import { hitBuf as buf } from '../../engine/spatialHash.js';

export const SHOW = 0.2; // seconds the lash stays on screen

export default {
  init(w) {
    w.flash = 0;
    w.ux = 1;
    w.uy = 0;
  },
  update(w, game, dt) {
    const s = w.stats;
    const p = game.player;
    if (w.flash > 0) w.flash -= dt;
    if ((w.timer -= dt) > 0) return;
    w.timer += s.cooldown * p.stats.cooldown;
    w.flash = SHOW;
    const range = s.range * p.stats.area;
    const half = (s.width * p.stats.area) / 2;
    const dmg = s.damage * p.stats.damage;
    const cy = p.y - 4;
    // A boss in reach gets lashed first; otherwise the nearest user.
    const boss = game.bossAlive() ? game.boss : null;
    const target = boss && Math.hypot(boss.x - p.x, boss.y - cy) < range + boss.r ? boss : nearestEnemy(game, p.x, cy, range * 1.3);
    const tx = target ? target.x - p.x : Math.sin(p.facing);
    const ty = target ? target.y - cy : Math.cos(p.facing);
    const tl = Math.hypot(tx, ty) || 1;
    w.ux = tx / tl;
    w.uy = ty / tl;
    const items = game.enemies.items;
    const n = game.hash.query(p.x, cy, range + 16, buf);
    for (let k = 0; k < n; k++) {
      const e = items[buf[k]];
      if (e.dead) continue;
      const dx = e.x - p.x;
      const dy = e.y - cy;
      if (s.full) {
        if (dx * dx + dy * dy > (range + e.r) ** 2) continue;
        damageEnemy(game, e, dmg, w, dx, dy, s.knockback);
        continue;
      }
      if (Math.abs(dx * w.uy - dy * w.ux) > half + e.r) continue;
      const along = dx * w.ux + dy * w.uy;
      const hit = (along >= -e.r && along <= range + e.r) || (s.sides > 1 && -along >= -e.r && -along <= range + e.r);
      if (hit) damageEnemy(game, e, dmg, w, dx, dy, s.knockback);
    }
    game.sfx('snap');
  },
};
