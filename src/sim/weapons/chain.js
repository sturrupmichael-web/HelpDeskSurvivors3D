// "Chain" behavior: zaps the nearest enemy, then jumps to the next nearest not yet hit,
// stunning each one. Used by: MFA Prompt, Passwordless (evolved: `chains` separate
// chains at once, each starting on a different user), Password Expired (`confuse`
// instead of `stun`: users walk the wrong way for that many seconds).
// stats: damage, cooldown, jumps, jumpRange, stun, confuse, chains
// def: colors (bolt colors, outer then inner), sound
// Ported from the original; the renderer draws the bolts along `paths` while `flashT` lasts.

import { damageEnemy, nearestEnemy, stunEnemy, confuseEnemy } from '../enemies.js';

const MAX_PATH = 24;
export const MAX_CHAINS = 6;
const MAX_HITS = MAX_PATH * MAX_CHAINS;
export const COLORS = [['#ffcd75', 5], ['#f4f4f4', 2]];

export default {
  init(w) {
    w.paths = Array.from({ length: MAX_CHAINS }, () => new Float32Array(MAX_PATH * 2));
    w.pathN = new Int32Array(MAX_CHAINS);
    w.flashT = 0;
    w.hitUids = new Int32Array(MAX_HITS);
    w.hitN = 0;
    w.skip = (e) => {
      for (let i = 0; i < w.hitN; i++) if (w.hitUids[i] === e.uid) return true;
      return false;
    };
  },
  update(w, game, dt) {
    const s = w.stats;
    const p = game.player;
    if (w.flashT > 0) w.flashT -= dt;
    if ((w.timer -= dt) > 0) return;
    w.timer += s.cooldown * p.stats.cooldown;
    w.hitN = 0;
    const dmg = s.damage * p.stats.damage;
    const chains = Math.min(MAX_CHAINS, s.chains ?? 1);
    let any = false;
    for (let c = 0; c < chains; c++) {
      const path = w.paths[c];
      let n = 0;
      path[n++] = p.x;
      path[n++] = p.y - 8;
      let x = p.x;
      let y = p.y;
      let range = 200 * p.stats.area;
      for (let j = 0, hits = 0; j <= s.jumps && hits < MAX_PATH - 1 && w.hitN < MAX_HITS; j++, hits++) {
        const e = nearestEnemy(game, x, y, range, w.skip);
        if (!e) break;
        w.hitUids[w.hitN++] = e.uid;
        path[n++] = e.x;
        path[n++] = e.y - 6;
        if (s.stun) stunEnemy(e, s.stun);
        if (s.confuse) confuseEnemy(e, s.confuse);
        damageEnemy(game, e, dmg, w, 0, 0, 0);
        x = e.x;
        y = e.y;
        range = s.jumpRange * p.stats.area;
      }
      w.pathN[c] = n;
      if (n >= 4) any = true;
    }
    for (let c = chains; c < MAX_CHAINS; c++) w.pathN[c] = 0;
    if (any) {
      w.flashT = 0.22;
      game.sfx(w.def.sound ?? 'zap');
    }
  },
};
