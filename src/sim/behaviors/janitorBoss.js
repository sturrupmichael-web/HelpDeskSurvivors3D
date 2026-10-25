// Ported from the original (HelpDeskSurvivor src/game/behaviors/); the floor telegraphs are
// drawn by src/render/bosses.js from e.ai.
//
// The Night Janitor (Parking Garage boss at 10:00): rides a floor buffer, leaves a wet
// trail, and you slide on wet floor (see Zones / updatePlayer). Attacks, never the same
// one twice in a row:
//   mop     swings the mop: a fan of wet patches toward you
//   charge  points the buffer at you (red lane on the floor), then charges down it
//   lights  kills the lights: the flashlight shrinks for a few seconds (dark maps only;
//           elsewhere he charges instead)
// Second phase (DOUBLE SHIFT, at `phase2.at` HP): the gaps between attacks shrink, every
// charge comes straight back at you a second time, and he learns
//   spin    a red circle around him first; then the buffer spins out, hurting and
//           shoving you if you're inside, and leaves a ring of wet floor

import { stepToward } from './chase.js';
import { hurtPlayer } from '../player.js';
import { belowPhase2, enterPhase2 } from './phase2.js';

export const WALK = 0;
export const CHARGE_TELL = 1;
export const CHARGING = 2;
export const POSE = 3;
export const SPIN_TELL = 4;
export const SPINNING = 5;
export const POSE_TIME = 0.6;
export const MOP = 0; // e.pose while attacking (the renderer picks the model's pose)
export const LEAN = 1;

function aim(e, game) {
  const pl = game.player;
  const dx = pl.x - e.x;
  const dy = pl.y - e.y;
  const d = Math.hypot(dx, dy) || 1;
  e.ai.aimX = dx / d;
  e.ai.aimY = dy / d;
  e.flip = dx < 0;
}

function mop(e, game, m, wet) {
  const base = Math.atan2(e.ai.aimY, e.ai.aimX);
  for (let i = 0; i < m.count; i++) {
    const a = base + (i / (m.count - 1) - 0.5) * m.spread;
    const r = m.reach * (0.45 + 0.55 * ((i * 7) % m.count) / m.count);
    game.zones.add(e.x + Math.cos(a) * r, e.y + Math.sin(a) * r, wet);
  }
  game.burst(e.x + e.ai.aimX * 30, e.y + e.ai.aimY * 30, ['#41a6f6', '#f4f4f4'], 12);
  game.sfx('slosh', e.x);
}

// Spin-out: drops a ring of wet floor around the buffer.
function spinRing(e, game, s, wet) {
  for (let i = 0; i < s.wet; i++) {
    const a = (i / s.wet) * Math.PI * 2;
    game.zones.add(e.x + Math.cos(a) * s.radius * 0.8, e.y + e.foot - 6 + Math.sin(a) * s.radius * 0.8, wet);
  }
}

function startAttack(e, game) {
  const p = e.params;
  const all = e.ai.phase2 ? p.phase2.attacks : p.attacks;
  const list = game.map.twist?.type === 'dark' ? all : all.filter((a) => a !== 'lights');
  let i = (Math.random() * list.length) | 0;
  if (list[i] === e.ai.lastAttack) i = (i + 1) % list.length; // no repeats
  e.ai.lastAttack = list[i];
  e.ai.recharged = false;
  e.anim = 'attack';
  aim(e, game);
  if (e.ai.lastAttack === 'spin') {
    e.ai.state = SPIN_TELL;
    e.ai.stateT = p.phase2.spin.telegraph;
    game.sfx('warn', e.x);
    e.pose = LEAN;
  } else if (e.ai.lastAttack === 'charge') {
    e.ai.state = CHARGE_TELL;
    e.ai.stateT = p.charge.telegraph;
    game.sfx('warn', e.x);
    e.pose = LEAN;
  } else {
    e.ai.state = POSE;
    e.ai.stateT = POSE_TIME;
    e.pose = MOP;
    if (e.ai.lastAttack === 'mop') mop(e, game, p.mop, p.wet);
    else {
      game.twist.dim(p.lights.time, p.lights.scale);
      game.banner('LIGHTS OUT', 'The janitor found the breaker panel.', 1.5);
      game.sfx('alarm');
    }
  }
}

function endAttack(e, enraged) {
  e.ai.state = WALK;
  e.anim = 'walk';
  e.pose = -1;
  e.ai.attackIn = e.params.attackGap[enraged ? 1 : 0];
}

export default {
  init(e) {
    // This boss's own state (pool objects are reused, so it's made fresh each fight).
    e.ai = {
      state: WALK,
      stateT: 0, // seconds left in the current state
      attackIn: 2.5, // seconds until the next attack
      trailIn: 0, // seconds until the next wet patch behind the buffer
      lastAttack: '', // never the same attack twice in a row
      aimX: 1, // unit vector of the current attack
      aimY: 0,
      chargeHit: false, // has this charge (or spin) hit you yet?
      phase2: false, // double shift (behaviors/phase2.js)
      recharged: false, // phase 2: this attack's second charge has started
    };
  },

  update(e, game, dt) {
    const p = e.params;
    const pl = game.player;
    if (!e.ai.phase2 && belowPhase2(e, game)) enterPhase2(e, game);
    const enraged = e.ai.phase2;
    // The buffer leaves a wet trail wherever it goes.
    if ((e.ai.trailIn -= dt) <= 0) {
      e.ai.trailIn = e.ai.state === CHARGING ? p.trailEvery / 3 : p.trailEvery;
      game.zones.add(e.x, e.y + e.foot - 6, p.wet);
    }
    switch (e.ai.state) {
      case WALK:
        stepToward(e, pl.x, pl.y, e.speed * e.slow * e.buff, dt);
        e.animT += dt;
        if ((e.ai.attackIn -= dt) <= 0) startAttack(e, game);
        break;
      case CHARGE_TELL:
        if ((e.ai.stateT -= dt) <= 0) {
          e.ai.state = CHARGING;
          e.ai.stateT = p.charge.time;
          e.ai.lastAttack = 'charge';
          e.ai.chargeHit = false;
          e.pose = -1;
          game.sfx('charge', e.x);
        }
        break;
      case CHARGING: {
        e.x += e.ai.aimX * p.charge.speed * dt;
        e.y += e.ai.aimY * p.charge.speed * dt;
        e.animT += dt * 3;
        const rr = e.r + pl.r + 4;
        if (!e.ai.chargeHit && (pl.x - e.x) ** 2 + (pl.y - e.y) ** 2 < rr * rr) {
          e.ai.chargeHit = true;
          hurtPlayer(game, p.charge.damage);
          pl.kx += e.ai.aimX * 220;
          pl.ky += e.ai.aimY * 220;
          game.shake(5);
        }
        if ((e.ai.stateT -= dt) <= 0) {
          game.shake(3);
          if (enraged && !e.ai.recharged) {
            // Double shift: turn round and come straight back.
            e.ai.recharged = true;
            aim(e, game);
            e.ai.state = CHARGE_TELL;
            e.ai.stateT = p.phase2.recharge;
            e.pose = LEAN;
            game.sfx('warn', e.x);
          } else endAttack(e, enraged);
        }
        break;
      }
      case SPIN_TELL:
        if ((e.ai.stateT -= dt) <= 0) {
          e.ai.state = SPINNING;
          e.ai.stateT = p.phase2.spin.time;
          e.ai.chargeHit = false;
          e.pose = -1;
          spinRing(e, game, p.phase2.spin, p.wet);
          game.sfx('charge', e.x);
          game.sfx('slosh', e.x);
        }
        break;
      case SPINNING: {
        const s = p.phase2.spin;
        e.animT += dt * 6;
        e.flip = ((game.time * 12) | 0) % 2 === 0;
        const dx = pl.x - e.x;
        const dy = pl.y - e.y;
        const d = Math.hypot(dx, dy) || 1;
        if (!e.ai.chargeHit && d < s.radius + pl.r) {
          e.ai.chargeHit = true;
          hurtPlayer(game, s.damage);
          pl.kx += (dx / d) * s.push;
          pl.ky += (dy / d) * s.push;
          game.shake(4);
        }
        if ((e.ai.stateT -= dt) <= 0) endAttack(e, enraged);
        break;
      }
      case POSE:
        if ((e.ai.stateT -= dt) <= 0) endAttack(e, enraged);
        break;
    }
  },
};
