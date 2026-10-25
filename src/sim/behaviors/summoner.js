// Ported from the original (HelpDeskSurvivor src/game/behaviors/).
// Phish Clicker: keeps some distance and periodically releases minions (Malware).
// params: every (s), count, minion (enemy id), keepDistance (px)

import { stepToward } from './chase.js';
import { spawnEnemy } from '../enemies.js';

export default {
  init(e) {
    e.t0 = 1 + Math.random() * e.params.every;
  },
  update(e, game, dt) {
    const p = e.params;
    const pl = game.player;
    const speed = e.speed * e.slow * e.buff;
    const d = Math.hypot(pl.x - e.x, pl.y - e.y);
    if (d > p.keepDistance) stepToward(e, pl.x, pl.y, speed, dt);
    else if (d < p.keepDistance * 0.7) stepToward(e, pl.x, pl.y, -speed * 0.6, dt);
    e.t0 -= dt;
    if (e.t0 <= 0) {
      e.t0 = p.every;
      const hp = game.spawner.sample(game.time, 'hpMult');
      const count = p.count + (game.policy.summons[e.def.sprite] ?? 0); // Phishing Simulation
      for (let i = 0; i < count; i++) spawnEnemy(game, p.minion, e.x + (Math.random() * 20 - 10), e.y + (Math.random() * 20 - 10), hp);
      game.burst(e.x, e.y - 8, e.def.particle, 4);
    }
  },
};
