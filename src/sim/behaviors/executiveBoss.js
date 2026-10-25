// Ported from the original (HelpDeskSurvivor src/game/behaviors/); the floor telegraphs are
// drawn by src/render/bosses.js from e.ai.
//
// The Executive (20:00 final boss). Walks at you between attacks; every attack is
// telegraphed on the floor first:
//   charge  points at you (red lane on the floor), then sprints down that lane
//   cone    a wedge of slide decks thrown at you (more volleys in later phases)
//   bombs   "urgent meeting" circles drop on and around you, then go off
//   summon  calls in VIPs
//   calendar  (final phase) Calendar Tetris: a checkerboard of meeting blocks around you
//           goes off in two waves; stand on the second wave's squares, then step back
// Phases start at the HP fractions in params.phases; each phase is faster, has a
// shorter gap between attacks, and opens with a banner and a VIP summon. The final
// phase is its second phase in the shared sense (behaviors/phase2.js: growl, red glow).

import { stepToward } from './chase.js';
import { spawnEnemy } from '../enemies.js';
import { hurtPlayer } from '../player.js';
import { enterPhase2 } from './phase2.js';

// States (e.ai.state); the renderer reads them to draw the telegraphs and the pose.
export const WALK = 0;
export const CHARGE_TELL = 1;
export const CHARGING = 2;
export const CONE_TELL = 3;
export const CONE = 4;
export const POSE = 5; // bombs / summon: holds the phone up for a moment

export const HAND_Y = -10; // where thrown things come from, relative to the collision center
const VOLLEY_GAP = 0.35;
const POSE_TIME = 0.6;
export const POINT = 0; // e.pose: pointing at you, or the phone held up (-1: neither)
export const PHONE = 1;

function aimAtPlayer(e, game) {
  const pl = game.player;
  const dx = pl.x - e.x;
  const dy = pl.y - e.y;
  const d = Math.hypot(dx, dy) || 1;
  e.ai.aimX = dx / d;
  e.ai.aimY = dy / d;
  e.flip = dx < 0;
}

function throwCone(e, game, c) {
  const base = Math.atan2(e.ai.aimY, e.ai.aimX);
  for (let i = 0; i < c.bullets; i++) {
    const a = base + (c.bullets > 1 ? (i / (c.bullets - 1) - 0.5) * c.spread : 0);
    game.hazards.bullet(e.x, e.y + HAND_Y, a, c.speed, c.damage, 'hazard_slide');
  }
  game.sfx('whoosh');
}

function summon(e, game, s) {
  const hp = game.spawner.sample(game.time, 'hpMult');
  for (let i = 0; i < s.count; i++) {
    const a = Math.random() * Math.PI * 2;
    spawnEnemy(game, s.id, e.x + Math.cos(a) * 40, e.y + Math.sin(a) * 40, hp);
  }
  game.burst(e.x, e.y + HAND_Y, e.def.particle, 12);
}

function startAttack(e, game) {
  const p = e.params;
  const list = p.attacks[e.ai.phase];
  let i = (Math.random() * list.length) | 0;
  if (list.length > 1 && list[i] === e.ai.lastAttack) i = (i + 1) % list.length; // no repeats
  const name = list[i];
  e.ai.lastAttack = name;
  e.anim = 'attack';
  aimAtPlayer(e, game);
  if (name === 'charge') {
    e.ai.state = CHARGE_TELL;
    e.ai.stateT = p.charge.telegraph;
    game.sfx('warn', e.x);
    e.pose = POINT;
  } else if (name === 'cone') {
    e.ai.state = CONE_TELL;
    e.ai.stateT = p.cone.telegraph;
    game.sfx('warn', e.x);
    e.pose = POINT;
  } else {
    e.ai.state = POSE;
    e.ai.stateT = POSE_TIME;
    e.pose = PHONE;
    if (name === 'bombs') {
      const b = p.bombs;
      const pl = game.player;
      for (let k = 0; k < b.count; k++) {
        const r = k === 0 ? 0 : b.scatter * (0.4 + Math.random() * 0.6);
        const a = Math.random() * Math.PI * 2;
        game.hazards.bomb(pl.x + Math.cos(a) * r, pl.y + Math.sin(a) * r, b.radius, b.delay + k * 0.08, b.damage);
      }
      game.sfx('alarm');
    } else if (name === 'calendar') {
      // Calendar Tetris: wave A on the player's own square, wave B on its neighbours.
      const c = p.calendar;
      const pl = game.player;
      const half = (c.size - 1) / 2;
      for (let gx = 0; gx < c.size; gx++) {
        for (let gy = 0; gy < c.size; gy++) {
          const second = (gx + gy) % 2 === 1;
          game.hazards.bomb(pl.x + (gx - half) * c.spacing, pl.y + (gy - half) * c.spacing, c.radius, second ? c.delay2 : c.delay, c.damage);
        }
      }
      // The banner the first time; after that everyone knows the drill.
      if (!e.ai.calendarSeen) game.banner('CALENDAR TETRIS', 'Back-to-back meetings. Find a free slot.', 1.5);
      else game.text(pl.x, pl.y - 34, 'MEETINGS!', '#ef7d57');
      e.ai.calendarSeen = true;
      game.sfx('alarm');
    } else summon(e, game, p.summon);
  }
}

function endAttack(e) {
  e.ai.state = WALK;
  e.anim = 'walk';
  e.pose = -1;
  e.ai.attackIn = e.params.attackGap[e.ai.phase];
}

export default {
  init(e) {
    // This boss's own state (pool objects are reused, so it's made fresh each fight).
    e.ai = {
      state: WALK,
      stateT: 0, // seconds left in the current attack step
      attackIn: 2, // seconds until the next attack
      phase: 0, // index into params.phases reached so far
      lastAttack: '', // no repeats
      aimX: 1, // locked-in aim for the charge and cone
      aimY: 0,
      chargeHit: false, // the current charge already hit you
      volleysLeft: 0,
      phase2: false, // final phase reached (behaviors/phase2.js)
      calendarSeen: false, // the Calendar Tetris banner shows only the first time
    };
  },

  update(e, game, dt) {
    const p = e.params;
    const pl = game.player;

    // Phase changes.
    const frac = e.hp / e.maxHp;
    let phase = 0;
    while (phase < p.phases.length && frac < p.phases[phase]) phase++;
    if (phase > e.ai.phase) {
      e.ai.phase = phase;
      const b = p.phaseBanners[phase];
      if (b) game.banner(b[0], b[1], 3);
      game.shake(6);
      game.ring(e.x, e.y, 80, '#b13e53', 0.6);
      summon(e, game, p.summon);
      if (phase === p.phases.length) enterPhase2(e, game);
      else game.sfx('siren');
    }

    switch (e.ai.state) {
      case WALK:
        stepToward(e, pl.x, pl.y, e.speed * (1 + 0.25 * e.ai.phase) * e.slow * e.buff, dt);
        if ((e.ai.attackIn -= dt) <= 0) startAttack(e, game);
        break;
      case CHARGE_TELL:
        if ((e.ai.stateT -= dt) <= 0) {
          e.ai.state = CHARGING;
          e.ai.stateT = p.charge.time;
          e.ai.chargeHit = false;
          e.anim = 'walk';
          e.pose = -1;
          game.sfx('charge', e.x);
        }
        break;
      case CHARGING: {
        e.x += e.ai.aimX * p.charge.speed * dt;
        e.y += e.ai.aimY * p.charge.speed * dt;
        e.animT += dt * 2; // legs pump faster
        const rr = e.r + pl.r + 4;
        if (!e.ai.chargeHit && (pl.x - e.x) ** 2 + (pl.y - e.y) ** 2 < rr * rr) {
          e.ai.chargeHit = true;
          hurtPlayer(game, p.charge.damage);
          game.shake(5);
        }
        if ((e.ai.stateT -= dt) <= 0) {
          game.shake(3);
          game.burst(e.x, e.y + 20, ['#566c86', '#94b0c2'], 10);
          endAttack(e);
        }
        break;
      }
      case CONE_TELL:
        if ((e.ai.stateT -= dt) <= 0) {
          e.ai.state = CONE;
          e.ai.volleysLeft = p.cone.volleys[e.ai.phase];
          e.ai.stateT = 0;
        }
        break;
      case CONE:
        if ((e.ai.stateT -= dt) <= 0) {
          if (e.ai.volleysLeft-- <= 0) endAttack(e);
          else {
            aimAtPlayer(e, game);
            throwCone(e, game, p.cone);
            e.ai.stateT = VOLLEY_GAP;
          }
        }
        break;
      case POSE:
        if ((e.ai.stateT -= dt) <= 0) endAttack(e);
        break;
    }
  },
};
