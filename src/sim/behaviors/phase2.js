// Boss second phases: at `params.phase2.at` of its HP a boss gets angry and picks up a new
// attack. The switch always looks and sounds the same, so players learn it: a banner, a
// shockwave, the "phase2" growl, and from then on a red glow under the boss, embers coming
// off it and an orange HUD bar. Ported from the original's src/game/behaviors/phase2.js
// (the red glow is drawn by src/render/bosses.js).

const EMBERS = ['#b13e53', '#ef7d57', '#ffcd75'];

// Has this boss (or, with `whole`, the whole fight across split pieces) dropped below
// the phase 2 line? `whole` is for bosses that split before their second phase. The
// Escalated policy moves the line up (phase2Sooner).
export function belowPhase2(e, game, whole = false) {
  const ph = e.params.phase2;
  if (!ph) return false;
  return (whole ? game.bossHpFrac() : e.hp / e.maxHp) < Math.min(0.95, ph.at + game.policy.phase2Sooner);
}

// Switches a boss into its second phase. The banner and sound play once per fight even
// when several pieces of a split boss switch together.
export function enterPhase2(e, game) {
  const ph = e.params.phase2;
  e.angry = true;
  e.ai.phase2 = true;
  game.ring(e.x, e.y, 90, '#b13e53', 0.6);
  game.ring(e.x, e.y, 50, '#ef7d57', 0.4, true);
  game.burst(e.x, e.y - 10, EMBERS, 24);
  if (game.bossPhase2) return;
  game.bossPhase2 = true;
  if (ph.title) game.banner(ph.title, ph.text, 2.5);
  game.shake(7);
  game.sfx('phase2', e.x);
}

// Embers while angry; called every tick from updateEnemies.
export function angryTick(e, game, dt) {
  if ((e.angryT -= dt) > 0) return;
  e.angryT = 0.2;
  game.burst(e.x + (Math.random() - 0.5) * e.r * 1.4, e.y - e.r * 0.6, EMBERS, 2);
}
