// "Turret" behavior: deploys stationary scripts that shoot the nearest enemy until
// they expire. Used by: PowerShell Script, Scheduled Task Army (evolved).
// stats: cooldown, max, duration, fireRate, damage, range, boltSpeed, spread (bolts per
// shot, fanned out; default 1). The def's `boltSprite` picks the bolt art.
// Ported from the original; the renderer draws the live turrets (`on`).

import { fireProjectile } from '../projectiles.js';
import { nearestEnemy } from '../enemies.js';

const MAX_TURRETS = 8;
const SPREAD_ANGLE = 0.22; // radians between bolts of one shot

export default {
  init(w) {
    w.turrets = Array.from({ length: MAX_TURRETS }, () => ({ on: false, x: 0, y: 0, life: 0, fireT: 0, born: 0 }));
    w.timer = 0.4;
  },
  update(w, game, dt) {
    const s = w.stats;
    const p = game.player;
    if ((w.timer -= dt) <= 0) {
      w.timer += s.cooldown * p.stats.cooldown;
      // Use a free slot, or replace the oldest turret once at the limit.
      let slot = null;
      let active = 0;
      let oldest = null;
      for (const t of w.turrets) {
        if (t.on) {
          active++;
          if (!oldest || t.born < oldest.born) oldest = t;
        } else if (!slot) slot = t;
      }
      if (active >= s.max) slot = oldest;
      if (slot) {
        slot.on = true;
        slot.x = p.x + (Math.random() - 0.5) * 24;
        slot.y = p.y + 8 + (Math.random() - 0.5) * 12;
        slot.life = s.duration;
        slot.fireT = 0.2;
        slot.born = game.time;
        game.sfx('deploy', slot.x);
      }
    }
    const range = s.range * p.stats.area;
    for (const t of w.turrets) {
      if (!t.on) continue;
      if ((t.life -= dt) <= 0) {
        t.on = false;
        continue;
      }
      if ((t.fireT -= dt) > 0) continue;
      const e = nearestEnemy(game, t.x, t.y, range);
      if (!e) {
        t.fireT = 0.1;
        continue;
      }
      t.fireT = s.fireRate / p.stats.attackSpeed;
      game.sfx('blip', t.x);
      const n = s.spread ?? 1;
      const base = Math.atan2(e.y - (t.y - 12), e.x - t.x);
      for (let k = 0; k < n; k++) {
        const a = base + (k - (n - 1) / 2) * SPREAD_ANGLE;
        fireProjectile(game, w, t.x, t.y - 12, Math.cos(a), Math.sin(a), {
          spr: w.def.boltSprite ?? 'proj_bolt', speed: s.boltSpeed * p.stats.attackSpeed, damage: s.damage * p.stats.damage * (p.summonDamage ?? 1), pierce: 0, life: 1.2, r: 3, knockback: 20,
        });
      }
    }
  },
};
