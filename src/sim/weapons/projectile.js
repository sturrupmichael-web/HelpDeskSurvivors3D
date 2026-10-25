// "Projectile" behavior: on cooldown, fires a quick burst of shots at the nearest
// enemies. Used by: Ticket Auto-Close, Automated Triage (evolved: `homing` shots that
// each pick a different target and steer toward it at `turn` rad/s), Auto-Scaling
// (`scalePer`: one extra shot per that many users within `scaleRadius`, up to `maxCount`),
// Reply-All Storm (the def's `ring: true`: the whole burst goes out at once, evenly
// spread all the way round you, turned a little each time).
// stats: damage, cooldown, count, speed, pierce, life, knockback, homing, turn,
//        scaleRadius, scalePer, maxCount
// Ported from the original. With no user in range it fires the way the tech faces.

import { fireProjectile } from '../projectiles.js';
import { nearestEnemy } from '../enemies.js';

const BURST_GAP = 0.08;
const MAX_TARGETS = 16;

export default {
  init(w) {
    w.ringA = 0;
    w.burstLeft = 0;
    w.burstT = 0;
    w.targets = new Int32Array(MAX_TARGETS); // uids already targeted in this burst
    w.targetN = 0;
    w.skip = (e) => {
      for (let i = 0; i < w.targetN; i++) if (w.targets[i] === e.uid) return true;
      return false;
    };
  },
  update(w, game, dt) {
    const s = w.stats;
    const p = game.player;
    w.timer -= dt;
    if (w.timer <= 0) {
      w.timer += s.cooldown * p.stats.cooldown;
      w.burstLeft = s.count + (p.extraCount ?? 0);
      if (s.scalePer) {
        const crowd = game.hash.query(p.x, p.y, s.scaleRadius * p.stats.area, game.scratch);
        w.burstLeft = Math.min(s.maxCount + (p.extraCount ?? 0), w.burstLeft + Math.floor(crowd / s.scalePer));
      }
      w.burstT = 0;
      w.targetN = 0;
      if (w.def.ring) {
        const n = w.burstLeft;
        w.burstLeft = 0;
        w.ringA += 2.4; // ~golden angle, so gaps in one ring get covered by the next
        game.sfx(w.def.sound ?? 'shoot');
        for (let i = 0; i < n; i++) {
          const a = w.ringA + (i / n) * Math.PI * 2;
          fireProjectile(game, w, p.x, p.y - 4, Math.cos(a), Math.sin(a), {
            spr: w.def.sprite, speed: s.speed * p.stats.attackSpeed, damage: s.damage * p.stats.damage,
            pierce: s.pierce, life: s.life, knockback: s.knockback, r: 5 * p.stats.area,
          });
        }
        return;
      }
    }
    if (w.burstLeft <= 0 || (w.burstT -= dt) > 0) return;
    w.burstT = BURST_GAP;
    w.burstLeft--;
    game.sfx('shoot');
    const t = nearestEnemy(game, p.x, p.y, 420, s.homing ? w.skip : undefined);
    if (t && s.homing && w.targetN < MAX_TARGETS) w.targets[w.targetN++] = t.uid;
    const dx = t ? t.x - p.x : Math.sin(p.facing);
    const dy = t ? t.y - p.y : Math.cos(p.facing);
    fireProjectile(game, w, p.x, p.y - 4, dx, dy, {
      spr: w.def.sprite, speed: s.speed * p.stats.attackSpeed, damage: s.damage * p.stats.damage,
      pierce: s.pierce, life: s.life, knockback: s.knockback, r: 5 * p.stats.area,
      kind: s.homing ? 'homing' : 'straight', target: s.homing ? t : null, turn: s.turn,
    });
  },
};
