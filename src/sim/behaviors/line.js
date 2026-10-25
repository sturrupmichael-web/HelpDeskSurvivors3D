// Ported unchanged from the original (HelpDeskSurvivor src/game/behaviors/).
// Event swarms (Login Storm): march in a fixed direction (e.dx, e.dy), ignoring the
// player, and expire when `life` runs out.

export default {
  update(e, game, dt) {
    const s = e.speed * e.slow * e.buff;
    e.x += e.dx * s * dt;
    e.y += e.dy * s * dt;
    if (e.dx) e.flip = e.dx < 0;
  },
};
