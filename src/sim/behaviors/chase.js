// Ported unchanged from the original (HelpDeskSurvivor src/game/behaviors/).
// Walks straight at the player. The default for most end-users.

export function stepToward(e, tx, ty, speed, dt) {
  const dx = tx - e.x;
  const dy = ty - e.y;
  const d = Math.hypot(dx, dy) || 1;
  e.x += (dx / d) * speed * dt;
  e.y += (dy / d) * speed * dt;
  if (dx) e.flip = dx < 0;
  return d;
}

export default {
  update(e, game, dt) {
    stepToward(e, game.player.x, game.player.y, e.speed * e.slow * e.buff, dt);
  },
};
