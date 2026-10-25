// "Orbit" behavior: shields circle the player for `duration` seconds, then go down for
// `cooldown`. Each shield hits an enemy at most once per `hitInterval`.
// Used by: Firewall, Zero Trust Perimeter (evolved: the def's `rings: 2` adds an inner
// ring spinning the other way; duration Infinity keeps it up permanently).
// stats: damage, count (per ring), radius, rotSpeed, duration, cooldown, hitInterval, knockback
// Ported from the original. `prevAngle` is the angle a tick ago, for interpolation; the
// renderer places the shields with `orbitShield`, the same math the hits use.

export const INNER = 0.6; // inner ring radius, relative to the outer one

import { damageEnemy } from '../enemies.js';
import { hitBuf as buf } from '../../engine/spatialHash.js';

// Shield i's offset from the player at ring angle `angle`, written into `out` ({x, y}).
export function orbitShield(w, p, angle, i, out) {
  const count = w.stats.count + (p.extraCount ?? 0);
  const inner = i >= count;
  const a = (inner ? -angle : angle) + (i / count) * Math.PI * 2;
  const r = w.stats.radius * p.stats.area * (inner ? INNER : 1);
  out.x = Math.cos(a) * r;
  out.y = Math.sin(a) * r;
  return out;
}

export const shieldCount = (w, p) => (w.stats.count + (p.extraCount ?? 0)) * (w.def.rings ?? 1);

const off = { x: 0, y: 0 };

export default {
  init(w) {
    w.angle = 0;
    w.prevAngle = 0;
    w.active = 0; // seconds of uptime left
    w.timer = 0.3;
  },
  update(w, game, dt) {
    const s = w.stats;
    const p = game.player;
    w.prevAngle = w.angle;
    w.angle += s.rotSpeed * p.stats.attackSpeed * dt;
    if (w.active > 0) {
      w.active -= dt;
      if (w.active <= 0) w.timer = s.cooldown * p.stats.cooldown;
    } else if ((w.timer -= dt) <= 0) {
      w.active = s.duration;
      game.sfx('hum');
    }
    if (w.active <= 0) return;
    const dmg = s.damage * p.stats.damage;
    const now = game.time;
    const items = game.enemies.items;
    const n0 = shieldCount(w, p);
    for (let i = 0; i < n0; i++) {
      orbitShield(w, p, w.angle, i, off);
      const sx = p.x + off.x;
      const sy = p.y + off.y;
      const n = game.hash.query(sx, sy, 20, buf);
      for (let k = 0; k < n; k++) {
        const e = items[buf[k]];
        if (e.dead || now - e.hitAt[w.slot] < s.hitInterval) continue;
        const dx = e.x - sx;
        const dy = e.y - sy;
        const rr = e.r + 7;
        if (dx * dx + dy * dy >= rr * rr) continue;
        e.hitAt[w.slot] = now;
        damageEnemy(game, e, dmg, w, e.x - p.x, e.y - p.y, s.knockback);
      }
    }
  },
};
