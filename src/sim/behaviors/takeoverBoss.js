// Ported from the original (HelpDeskSurvivor src/game/behaviors/); the floor telegraphs are
// drawn by src/render/bosses.js from e.ai.
//
// The Hostile Takeover (Merger Day boss at 10:00): the new parent company's CEO, touring
// the floor.
//   absorb    any user it touches is acquired: gone (no ticket), and the boss heals
//             `heal` HP and grows a little (up to x`maxScale`), at most `perSec` a second
//   memo      Restructuring: `lanes` long strips light up across your position, then a
//             memo slams down each one
//   allhands  calls in `pairs` pairs of Synergy Consultants around you
//   spin off  at `spinAt` HP it spins off The Subsidiary (a smaller boss that only sends
//             memos); the fight ends when both are down (see Game.addBossPart)
//   reorg     second phase (at `phase2.at` of its own HP): it attacks faster, and every
//             other attack is a Reorg, memo lanes both across and down at once, so only
//             the squares between them are safe
// The Subsidiary uses this behavior too, with `isSmall` and only the memo attack.

import { stepToward } from './chase.js';
import { spawnEnemy } from '../enemies.js';
import { hurtPlayer } from '../player.js';
import { belowPhase2, enterPhase2 } from './phase2.js';

export const WALK = 0;
export const MEMO_TELL = 1;
export const MEMO = 2;
export const POSE = 3;
export const MEMO_SHOW = 0.35;
export const POSE_TIME = 0.7;
export const MEMO_POSE = 0; // e.pose while attacking (the renderer picks the model's pose)
export const WIDE_POSE = 1;

// Lanes run horizontally or vertically through the player, with the others to either
// side. A Reorg (`cross`) lays both sets at once.
function addLanes(e, m, pl, horizontal) {
  const shift = (Math.random() - 0.5) * m.width * 0.6;
  for (let i = 0; i < m.lanes; i++) {
    const off = (i - (m.lanes - 1) / 2) * m.gap + shift;
    e.ai.lanes.push({ h: horizontal, c: horizontal ? pl.y + off : pl.x + off });
  }
}

function startMemo(e, game, cross) {
  const m = cross ? e.params.phase2.reorg : e.params.memo;
  const pl = game.player;
  e.ai.lanes.length = 0;
  e.ai.cross = cross;
  const horizontal = Math.random() < 0.5;
  addLanes(e, m, pl, horizontal);
  if (cross) addLanes(e, m, pl, !horizontal);
  e.ai.midX = pl.x; // middle of the strips along their length
  e.ai.midY = pl.y;
  e.ai.state = MEMO_TELL;
  e.ai.stateT = m.telegraph;
  e.anim = 'attack';
  e.pose = MEMO_POSE;
  game.sfx('warn', e.x);
  if (cross) game.text(pl.x, pl.y - 34, 'REORG!', '#ef7d57');
}

function memoParams(e) {
  return e.ai.cross ? e.params.phase2.reorg : e.params.memo;
}

function memoHits(e, game) {
  const m = memoParams(e);
  const pl = game.player;
  return e.ai.lanes.some((l) => {
    const across = l.h ? pl.y : pl.x;
    const along = l.h ? pl.x - e.ai.midX : pl.y - e.ai.midY;
    return Math.abs(along) <= m.length / 2 && Math.abs(across - l.c) < m.width / 2 + pl.r;
  });
}

function allHands(e, game) {
  const a = e.params.allhands;
  const pl = game.player;
  const hpMult = game.spawner.sample(game.time, 'hpMult');
  for (let i = 0; i < a.pairs; i++) {
    const ang = (i / a.pairs) * Math.PI * 2 + Math.random();
    spawnEnemy(game, a.id, pl.x + Math.cos(ang) * a.radius, pl.y + Math.sin(ang) * a.radius, hpMult);
  }
  // The banner the first time; after that everyone knows the drill.
  if (!e.ai.calledAllHands) game.banner('ALL-HANDS MEETING', 'Mandatory. Cameras on. The consultants are here to help.', 2);
  else game.text(pl.x, pl.y - 34, 'ALL-HANDS!', '#ffcd75');
  e.ai.calledAllHands = true;
  game.ring(e.x, e.y, 60, '#ffcd75', 0.5);
  game.sfx('alarm');
}

function spinOff(e, game) {
  const p = e.params;
  e.ai.spunOff = true;
  const c = spawnEnemy(game, p.spin, e.x + 40, e.y);
  if (!c) return;
  c.kx = 180;
  c.ai.attackIn = 1.5;
  game.addBossPart(c);
  game.banner('SPIN-OFF', 'It spun off a Subsidiary. Close them both.', 2.5);
  game.ring(e.x, e.y, 70, '#ffcd75', 0.5);
  game.burst(e.x, e.y, e.def.particle, 30);
  game.shake(6);
  game.sfx('siren');
}

function startAttack(e, game) {
  if (e.ai.phase2 && (e.ai.reorgNext = !e.ai.reorgNext)) return startMemo(e, game, true);
  const list = e.params.attacks;
  let i = (Math.random() * list.length) | 0;
  if (list.length > 1 && list[i] === e.ai.lastAttack) i = (i + 1) % list.length; // no repeats
  e.ai.lastAttack = list[i];
  if (e.ai.lastAttack === 'memo') return startMemo(e, game, false);
  e.ai.state = POSE;
  e.ai.stateT = POSE_TIME;
  e.anim = 'attack';
  e.pose = WIDE_POSE;
  allHands(e, game);
}

function endAttack(e) {
  const p = e.params;
  e.ai.state = WALK;
  e.anim = 'walk';
  e.pose = -1;
  e.ai.attackIn = p.attackGap[e.ai.phase2 ? 1 : 0];
}

export default {
  init(e) {
    // This boss's own state (pool objects are reused, so it's made fresh each fight).
    e.ai = {
      state: WALK,
      stateT: 0, // seconds left in the current state
      attackIn: e.params.isSmall ? 1.5 : 2.5, // seconds until the next attack
      lastAttack: '', // never the same attack twice in a row
      absorbBudget: 0, // users it may still acquire this second
      calledAllHands: false, // the banner shows only the first time
      spunOff: false, // has it spun off The Subsidiary yet?
      lanes: [], // memo lanes: { h: runs horizontally, c: position across the floor }
      midX: 0, // middle of the lanes along their length
      midY: 0,
      cross: false, // the current memo is a Reorg
      phase2: false, // hostile (behaviors/phase2.js)
      reorgNext: false, // phase 2 alternates Reorgs and its other attacks
    };
  },

  update(e, game, dt) {
    const p = e.params;
    const pl = game.player;
    if (p.absorb) e.ai.absorbBudget = Math.min(p.absorb.perSec, e.ai.absorbBudget + p.absorb.perSec * dt);
    if (!e.ai.spunOff && p.spinAt && e.hp < e.maxHp * p.spinAt) spinOff(e, game);
    if (!e.ai.phase2 && belowPhase2(e, game)) enterPhase2(e, game);
    switch (e.ai.state) {
      case WALK:
        stepToward(e, pl.x, pl.y, e.speed * e.slow * e.buff, dt);
        if ((e.ai.attackIn -= dt) <= 0) startAttack(e, game);
        break;
      case MEMO_TELL:
        if ((e.ai.stateT -= dt) <= 0) {
          e.ai.state = MEMO;
          e.ai.stateT = MEMO_SHOW;
          if (memoHits(e, game)) hurtPlayer(game, memoParams(e).damage);
          game.shake(3);
          game.sfx('whoosh', e.x);
        }
        break;
      case MEMO:
      case POSE:
        if ((e.ai.stateT -= dt) <= 0) endAttack(e);
        break;
    }
  },

  // After the spatial hash is built: acquire the users it is touching.
  post(e, game) {
    const a = e.params.absorb;
    if (!a || e.ai.absorbBudget < 1) return;
    const buf = game.scratch2;
    const n = game.hash.query(e.x, e.y, e.r + 10, buf);
    for (let k = 0; k < n && e.ai.absorbBudget >= 1; k++) {
      const o = game.enemies.items[buf[k]];
      if (o === e || o.dead || o.def.boss || o.def.anchored) continue;
      const rr = e.r + o.r;
      if ((o.x - e.x) ** 2 + (o.y - e.y) ** 2 > rr * rr) continue;
      o.dead = true; // acquired: no ticket for you
      e.ai.absorbBudget -= 1;
      e.hp = Math.min(e.maxHp, e.hp + a.heal);
      if (e.scale < a.maxScale) {
        e.scale = Math.min(a.maxScale, e.scale + a.grow);
        e.r = e.def.radius * e.scale;
      }
      game.burst(o.x, o.y - 6, ['#ffcd75', '#1f2a5c', '#f4f4f4'], 4);
      if (Math.random() < 0.15) game.text(o.x, o.y - 18, 'ACQUIRED', '#ffcd75');
    }
  },
};
