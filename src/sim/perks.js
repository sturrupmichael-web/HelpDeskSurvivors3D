// Tech perks that act on the floor on a timer, keyed by the field that turns them on in
// data/player.js (e.g. a tech with `phishTest: {...}` runs FLOOR_PERKS.phishTest). Each
// one gets the game, its config from the tech and the seconds since it last fired, and
// returns true when it fired (the timer starts again).
// Ported from the original's src/game/perks.js. "On screen" is the visible floor round the
// tech (`game.view`), where the original used the canvas round its camera.

import { stunEnemy, spawnEnemy } from './enemies.js';

export const FLOOR_PERKS = {
  // Security Manager: every `every` s, everyone on screen stops `stun` s to read the email.
  phishTest(game, cfg, t) {
    if (t < cfg.every) return false;
    const p = game.player;
    const v = game.view;
    const pool = game.enemies;
    for (let i = 0; i < pool.count; i++) {
      const e = pool.items[i];
      const dx = e.x - p.x;
      const dy = e.y - p.y;
      if (!e.dead && dx > -v.left - 16 && dx < v.right + 16 && dy > -v.top - 16 && dy < v.bottom + 16) stunEnemy(e, cfg.stun);
    }
    game.ring(p.x, p.y, Math.max(v.left, v.right, v.top, v.bottom) + 16, '#7a4ea0', 0.5);
    game.text(p.x, p.y - 30, 'PHISHING TEST', '#ffcd75');
    game.sfx('error');
    return true;
  },
  // Asset Management Analyst: every `boxEvery` s, a moving box near you (at most 3 out).
  boxEvery(game, every, t) {
    if (t < every) return false;
    const p = game.player;
    let boxes = 0;
    const pool = game.enemies;
    for (let i = 0; i < pool.count; i++) if (pool.items[i].def.anchored && !pool.items[i].dead) boxes++;
    if (boxes < 3) {
      const a = Math.random() * Math.PI * 2;
      const r = 110 + Math.random() * 70;
      spawnEnemy(game, 'moving_box', p.x + Math.cos(a) * r, p.y + Math.sin(a) * r, game.spawner.sample(game.time, 'hpMult'));
    }
    return true;
  },
};
