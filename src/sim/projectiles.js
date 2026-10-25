// Weapon projectiles: one shared pool for every weapon. Ported from the original's
// src/game/projectiles.js. Kinds:
//   straight   flies in a line
//   homing     steers toward a target enemy, re-targeting if it dies
//   boomerang  flies out, slows, turns around and returns to the player
// Any kind can `bounce`: after a hit it turns toward the nearest user it hasn't hit yet
// (within `bounceRange`), that many times (The 19th Hole).
// Each projectile remembers which enemies it already hit, so piercing shots hit each
// enemy once (boomerangs forget when they turn around, so they can hit on the way back).
//
// Differences: `spr` stays a sprite id (the renderer picks the model), projectiles keep
// their previous position (`px`, `py`) for interpolation, and their facing (`dir`) for
// the renderer. The `ace` pickup drop comes back with pickups.

import { Pool } from '../engine/pool.js';
import { damageEnemy, nearestEnemy } from './enemies.js';
import { hitBuf as buf } from '../engine/spatialHash.js';

const MAX_HITS = 32;

export function createProjectilePool() {
  return new Pool(800, () => ({
    kind: 'straight', weapon: null, spr: '',
    x: 0, y: 0, px: 0, py: 0, vx: 0, vy: 0, speed: 0, r: 5,
    damage: 0, knockback: 0, pierce: 0, life: 0, age: 0,
    target: null, targetUid: 0, turn: 0, decel: 0, returning: false,
    rot: 0, spin: 0, curl: 0, scale: 1,
    bounce: 0, bounceRange: 0,
    hits: new Int32Array(MAX_HITS), hitCount: 0, dead: false,
  }));
}

// Spawns a projectile. `o` holds: kind, spr, speed, damage, knockback, pierce, life,
// r, turn, decel, spin, curl (outbound boomerangs bend by this many rad/s), target,
// scale (drawn size), bounce, bounceRange. Returns it (or null if the pool is full).
export function fireProjectile(game, weapon, x, y, dirX, dirY, o) {
  const p = game.projectiles.spawn();
  if (!p) return null;
  const d = Math.hypot(dirX, dirY) || 1;
  p.kind = o.kind ?? 'straight';
  p.weapon = weapon;
  p.spr = o.spr;
  p.x = p.px = x;
  p.y = p.py = y;
  p.speed = o.speed;
  p.vx = (dirX / d) * o.speed;
  p.vy = (dirY / d) * o.speed;
  p.r = o.r ?? 5;
  p.damage = o.damage;
  p.knockback = o.knockback ?? 0;
  p.pierce = o.pierce ?? 0;
  p.life = o.life ?? 2;
  p.age = 0;
  p.target = o.target ?? null;
  p.targetUid = p.target ? p.target.uid : 0;
  p.turn = o.turn ?? 0;
  p.decel = o.decel ?? 0;
  p.returning = false;
  p.rot = 0;
  p.spin = o.spin ?? 0;
  p.curl = o.curl ?? 0;
  p.scale = o.scale ?? 1;
  p.bounce = o.bounce ?? 0;
  p.bounceRange = o.bounceRange ?? 0;
  p.hitCount = 0;
  p.dead = false;
  return p;
}

function hitAlready(p, uid) {
  for (let i = 0; i < p.hitCount; i++) if (p.hits[i] === uid) return true;
  return false;
}

// The bouncing projectile skips users it already hit (one shared function, so a bounce
// doesn't allocate a closure).
let bouncing = null;
const skipHit = (o) => hitAlready(bouncing, o.uid);

export function updateProjectiles(game, dt) {
  const pool = game.projectiles;
  const pl = game.player;
  const enemies = game.enemies.items;
  for (let i = pool.count - 1; i >= 0; i--) {
    const p = pool.items[i];
    p.age += dt;
    if (p.dead || p.age >= p.life) {
      pool.removeAt(i);
      continue;
    }
    p.px = p.x;
    p.py = p.y;

    if (p.kind === 'homing') {
      let t = p.target;
      if (!t || t.dead || t.uid !== p.targetUid) {
        t = p.target = nearestEnemy(game, p.x, p.y, 256);
        p.targetUid = t ? t.uid : 0;
      }
      if (t) {
        // Rotate the velocity toward the target, limited by the turn rate.
        const want = Math.atan2(t.y - p.y, t.x - p.x);
        const cur = Math.atan2(p.vy, p.vx);
        let diff = want - cur;
        diff -= Math.round(diff / (Math.PI * 2)) * Math.PI * 2;
        const a = cur + Math.max(-p.turn * dt, Math.min(p.turn * dt, diff));
        p.vx = Math.cos(a) * p.speed;
        p.vy = Math.sin(a) * p.speed;
      }
    } else if (p.kind === 'boomerang') {
      if (!p.returning) {
        const s = Math.hypot(p.vx, p.vy);
        const ns = s - p.decel * dt;
        if (ns <= 0) {
          p.returning = true;
          p.hitCount = 0;
        } else {
          const f = ns / s;
          if (p.curl) {
            // Bend the throw: rotate the velocity a little each tick.
            const c = Math.cos(p.curl * dt);
            const sn = Math.sin(p.curl * dt);
            const vx = p.vx * c - p.vy * sn;
            p.vy = p.vx * sn + p.vy * c;
            p.vx = vx;
          }
          p.vx *= f;
          p.vy *= f;
        }
      }
      if (p.returning) {
        const dx = pl.x - p.x;
        const dy = pl.y - p.y;
        const d = Math.hypot(dx, dy) || 1;
        if (d < 10) {
          pool.removeAt(i);
          continue;
        }
        const s = Math.min(p.speed * 1.3, Math.hypot(p.vx, p.vy) + p.decel * dt);
        p.vx = (dx / d) * s;
        p.vy = (dy / d) * s;
      }
    }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.rot += p.spin * dt;

    // Collisions.
    const n = game.hash.query(p.x, p.y, p.r + 12, buf);
    for (let k = 0; k < n; k++) {
      const e = enemies[buf[k]];
      if (e.dead) continue;
      const dx = e.x - p.x;
      const dy = e.y - p.y;
      const rr = e.r + p.r;
      if (dx * dx + dy * dy >= rr * rr || hitAlready(p, e.uid)) continue;
      if (p.hitCount < MAX_HITS) p.hits[p.hitCount++] = e.uid;
      damageEnemy(game, e, p.damage, p.weapon, p.vx, p.vy, p.knockback);
      if (p.bounce > 0) {
        p.bounce--;
        bouncing = p;
        const t = nearestEnemy(game, e.x, e.y, p.bounceRange, skipHit);
        if (t) {
          const d = Math.hypot(t.x - p.x, t.y - p.y) || 1;
          p.vx = ((t.x - p.x) / d) * p.speed;
          p.vy = ((t.y - p.y) / d) * p.speed;
          p.age = 0; // a fresh flight to the next user
        }
        break;
      }
      if (p.pierce-- <= 0) {
        p.dead = true;
        break;
      }
    }
  }
}
