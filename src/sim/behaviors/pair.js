// Ported from the original (HelpDeskSurvivor src/game/behaviors/).
// Synergy Consultants: they always come in twos. The lead (params.partner set) brings
// its partner along when it spawns; the two walk at you side by side. Close one and the
// other one "circles back": faster (x`enrage`) and hitting harder for the rest of its life.
// params: partner (enemy id spawned alongside), gap (px between them), enrage

import { stepToward } from './chase.js';
import { spawnEnemy } from '../enemies.js';

let spawningPartner = false;

function link(a, b) {
  a.mate = b;
  a.mateUid = b.uid;
  b.mate = a;
  b.mateUid = a.uid;
}

export default {
  init(e, game) {
    e.mate = null;
    e.side = 0;
    e.n = 0; // 1 once enraged
    const id = e.params.partner;
    if (!id || spawningPartner) return;
    spawningPartner = true;
    const m = spawnEnemy(game, id, e.x + 12, e.y + 12);
    spawningPartner = false;
    if (!m) return;
    m.hp = m.maxHp = e.maxHp;
    m.speed = e.speed;
    link(e, m);
    e.side = 1;
    m.side = -1;
  },

  update(e, game, dt) {
    const pl = game.player;
    if (e.mate && (e.mate.dead || e.mate.uid !== e.mateUid)) {
      // Partner closed: this one takes it personally.
      e.mate = null;
      e.side = 0;
      if (!e.n) {
        e.n = 1;
        e.speed *= e.params.enrage;
        e.damage *= 1.5;
        e.flash = 0.3;
        game.text(e.x, e.y - 24, 'CIRCLE BACK!', '#b13e53');
      }
    }
    // Walk side by side: each aims a little to its own side of you.
    const dx = pl.x - e.x;
    const dy = pl.y - e.y;
    const d = Math.hypot(dx, dy) || 1;
    const off = d > 40 ? (e.side * e.params.gap) / 2 : 0;
    stepToward(e, pl.x - (dy / d) * off, pl.y + (dx / d) * off, e.speed * e.slow * e.buff, dt);
  },
};
