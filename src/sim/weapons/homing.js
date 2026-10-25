// "Homing" behavior: launches seeking shots that go after far-away enemies.
// Used by: Remote Desktop Session, Remote Wipe (evolved: `pierce`, and the def's
// `vacuum: true` sends each closed user's ticket straight to you, see killEnemy).
// stats: damage, cooldown, count, speed, turn, life, pierce
// Ported from the original; "near the screen" uses the visible floor's radius.

import { fireProjectile } from '../projectiles.js';

// Picks a random enemy that is far from the player but still near the screen.
function farTarget(game) {
  const { enemies, player: p, view } = game;
  const maxD = view.radius;
  let best = null;
  let bestD = 0;
  for (let tries = 0; tries < 24 && enemies.count; tries++) {
    const e = enemies.items[(Math.random() * enemies.count) | 0];
    if (e.dead) continue;
    const d = Math.hypot(e.x - p.x, e.y - p.y);
    if (d < maxD && d > bestD) {
      best = e;
      bestD = d;
    }
  }
  return best;
}

export default {
  update(w, game, dt) {
    const s = w.stats;
    const p = game.player;
    if ((w.timer -= dt) > 0) return;
    w.timer += s.cooldown * p.stats.cooldown;
    game.sfx('launch');
    for (let i = 0; i < s.count + (p.extraCount ?? 0); i++) {
      const t = farTarget(game);
      const a = Math.random() * Math.PI * 2; // launch in a random direction, then curve in
      fireProjectile(game, w, p.x, p.y - 6, Math.cos(a), Math.sin(a), {
        kind: 'homing', spr: w.def.sprite, speed: s.speed * p.stats.attackSpeed, damage: s.damage * p.stats.damage,
        pierce: s.pierce ?? 0, life: s.life, turn: s.turn, target: t, r: 5 * p.stats.area, knockback: 40,
      });
    }
  },
};
