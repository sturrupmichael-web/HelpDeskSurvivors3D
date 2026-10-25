// Boss attacks that hurt the player: pooled bullets (ringing phones, slide decks) and
// telegraphed bombs (a warning circle that fills up, then goes off). Ported from the
// original's src/game/hazards.js with the drawing moved to src/render/hazards.js.

import { Pool } from '../engine/pool.js';
import { hurtPlayer } from './player.js';

export class Hazards {
  constructor() {
    // `sprite` is the bullet's model id (render/models.js HAZARD_MODELS).
    this.bullets = new Pool(600, () => ({ x: 0, y: 0, px: 0, py: 0, vx: 0, vy: 0, r: 5, damage: 0, life: 0, sprite: '', rot: 0, spin: 0 }));
    this.bombs = new Pool(48, () => ({ x: 0, y: 0, r: 0, t: 0, delay: 0, damage: 0 }));
  }

  clear() {
    this.bullets.clear();
    this.bombs.clear();
  }

  // Fires a bullet from (x, y) at `angle`.
  bullet(x, y, angle, speed, damage, sprite, spin = 0) {
    const b = this.bullets.spawn();
    if (!b) return;
    b.x = b.px = x;
    b.y = b.py = y;
    b.vx = Math.cos(angle) * speed;
    b.vy = Math.sin(angle) * speed;
    b.r = 5;
    b.damage = damage;
    b.life = 6;
    b.sprite = sprite;
    b.rot = angle;
    b.spin = spin;
  }

  // A warning circle at (x, y) that detonates after `delay` seconds.
  bomb(x, y, radius, delay, damage) {
    const b = this.bombs.spawn();
    if (!b) return;
    b.x = x;
    b.y = y;
    b.r = radius;
    b.t = 0;
    b.delay = delay;
    b.damage = damage;
  }

  update(game, dt) {
    const p = game.player;
    const bl = this.bullets;
    for (let i = bl.count - 1; i >= 0; i--) {
      const b = bl.items[i];
      b.px = b.x;
      b.py = b.y;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.rot += b.spin * dt;
      const dx = b.x - p.x;
      const dy = b.y - p.y;
      const rr = b.r + p.r;
      if (dx * dx + dy * dy < rr * rr) {
        hurtPlayer(game, b.damage);
        game.burst(b.x, b.y, ['#f4f4f4', '#b13e53'], 4);
        bl.removeAt(i);
      } else if (game.floor.blocked(b.x, b.y)) {
        // Solid cubicles are cover: the shot hits the partition.
        game.burst(b.x, b.y, ['#f4f4f4', '#8b9bb4'], 3);
        bl.removeAt(i);
      } else if ((b.life -= dt) <= 0) bl.removeAt(i);
    }
    const bm = this.bombs;
    for (let i = bm.count - 1; i >= 0; i--) {
      const b = bm.items[i];
      if ((b.t += dt) < b.delay) continue;
      const dx = p.x - b.x;
      const dy = p.y - b.y;
      if (dx * dx + dy * dy < (b.r + p.r) * (b.r + p.r)) hurtPlayer(game, b.damage);
      game.ring(b.x, b.y, b.r, '#ffcd75', 0.35, true);
      game.ring(b.x, b.y, b.r * 1.2, '#b13e53', 0.45);
      game.burst(b.x, b.y, ['#b13e53', '#ffcd75', '#f4f4f4'], 10);
      game.shake(3);
      game.sfx('boom', b.x);
      bm.removeAt(i);
    }
  }
}
