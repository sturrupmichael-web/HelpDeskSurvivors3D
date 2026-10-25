// Floor hazards: pooled circles that slow the player (Printer Jammer paper jams, later the
// Rat's Nest cable loops) or make the floor slippery (`slip`: the Night Janitor's wet floor).
// Ported from the original's src/game/zones.js with the drawing removed; `sprite` is kept
// for the renderer to pick a look.

import { Pool } from '../engine/pool.js';
import { FOOT } from './player.js';

export class Zones {
  constructor() {
    this.pool = new Pool(96, () => ({ x: 0, y: 0, r: 0, life: 0, max: 0, slow: 1, slip: false, sprite: '' }));
  }
  clear() {
    this.pool.clear();
  }
  add(x, y, params) {
    const z = this.pool.spawn() ?? this.pool.items[0]; // when full, recycle the oldest slot
    z.x = x;
    z.y = y;
    z.r = params.radius;
    z.life = z.max = params.life;
    z.slow = params.slow ?? 1;
    z.slip = !!params.slip;
    z.sprite = params.sprite ?? 'paperjam';
  }
  // Ages zones and sets the player's slow multiplier and slip flag for this tick.
  update(game, dt) {
    const p = game.player;
    p.slow = p.tailgate; // Badge Brenda (set this tick in resolveEnemies) is a slow too
    p.tailgate = 1;
    p.slip = false;
    const pool = this.pool;
    for (let i = pool.count - 1; i >= 0; i--) {
      const z = pool.items[i];
      if ((z.life -= dt) <= 0) {
        pool.removeAt(i);
        continue;
      }
      const dx = p.x - z.x;
      const dy = p.y + FOOT - z.y; // the player's feet
      if (dx * dx + dy * dy < z.r * z.r) {
        if (z.slow < p.slow) p.slow = z.slow;
        if (z.slip) p.slip = true;
      }
    }
  }
}
