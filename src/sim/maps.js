// Map twists (data/maps.js `twist`): the one special rule each unlockable map adds.
// Ported from the original's src/game/maps.js with the drawing moved to the renderer
// (the Night Shift's flashlight is a light in src/render/view.js that reads `dimT` and
// `dimScale`). Each twist type is an entry in TWISTS, with any of these hooks:
//   update(twist, game, tw, dt)          every tick, after the floor hazards
//   hpMult(game, tw, x, y) / xpMult(...)  multipliers for users spawning / closed at (x, y)
// `twist` is the Sim's MapTwist (its fields are per-shift state), `tw` the map's data.
// One change for 3D: the hot aisle is tested at the tech's feet, where it is drawn.

import { spawnEnemy } from './enemies.js';
import { FOOT } from './player.js';

export const TWISTS = {
  // Server Room: red hot aisles drain sanity but speed you up.
  hotAisles: {
    update(twist, game, tw, dt) {
      const p = game.player;
      twist.hot = game.floor.isHot(p.x, p.y + FOOT);
      if (twist.hot) {
        p.slow *= 1 + tw.speed;
        if (!p.god && p.invuln <= 0 && game.victoryT <= 0) p.hp -= tw.drain * dt;
      }
    },
  },

  // Call Center: a desk phone somewhere near you starts ringing; it goes off after the delay.
  phones: {
    update(twist, game, tw, dt) {
      if ((twist.t += dt) < tw.every || game.victoryT > 0) return;
      twist.t = 0;
      const p = game.player;
      const a = Math.random() * Math.PI * 2;
      const d = 30 + Math.random() * 110;
      const dmg = tw.damage + tw.damagePerMin * (game.time / 60);
      game.hazards.bomb(p.x + Math.cos(a) * d, p.y + Math.sin(a) * d, tw.radius, tw.delay, dmg);
      game.sfx('ring');
    },
  },

  // Merger Day: the parent company's floor grows every `every` seconds; moving boxes keep
  // turning up. Users who spawn on its floor are tougher, and their tickets count double.
  integration: {
    update(twist, game, tw, dt) {
      const phase = Math.floor(game.time / tw.every);
      game.floor.setOwned(Math.min(tw.max, tw.start + phase * tw.step));
      if (phase > twist.phase) {
        twist.phase = phase;
        if (phase % 3 === 0 && game.time < 1190 && game.victoryT <= 0) {
          const pct = Math.round(Math.min(tw.max, tw.start + phase * tw.step) * 100);
          game.banner('REBRANDED', `Integration phase ${phase / 3} done. The parent company owns ${pct}% of the floor.`, 3);
        }
      }
      if (game.spawner.stopped || (twist.t += dt) < tw.boxEvery) return;
      twist.t = 0;
      let boxes = 0;
      const pool = game.enemies;
      for (let i = 0; i < pool.count; i++) if (pool.items[i].def.anchored && !pool.items[i].dead) boxes++;
      if (boxes >= tw.boxMax) return;
      const p = game.player;
      const a = Math.random() * Math.PI * 2;
      const d = 140 + Math.random() * 90;
      spawnEnemy(game, 'moving_box', p.x + Math.cos(a) * d, p.y + Math.sin(a) * d, game.spawner.sample(game.time, 'hpMult'));
    },
    hpMult: (game, tw, x, y) => (game.floor.isAcquired(x, y) ? tw.hpMult : 1),
    xpMult: (game, tw, x, y) => (game.floor.isAcquired(x, y) ? tw.xpMult : 1),
  },

  // Night Shift: lights out. Only the renderer does anything (the flashlight).
  dark: {},
};

export class MapTwist {
  constructor() {
    this.reset();
  }

  reset() {
    this.t = 0;
    this.hot = false; // the tech is standing in a hot aisle
    this.dimT = 0; // Night Janitor "lights out": seconds left
    this.dimScale = 1;
    this.phase = 0; // Merger Day: integration phases announced so far
  }

  // Toughness multiplier for a user spawning at (x, y) on the current map.
  hpMult(game, x, y) {
    const tw = game.map.twist;
    return tw && TWISTS[tw.type].hpMult ? TWISTS[tw.type].hpMult(game, tw, x, y) : 1;
  }

  // Ticket multiplier for a user closed at (x, y).
  xpMult(game, x, y) {
    const tw = game.map.twist;
    return tw && TWISTS[tw.type].xpMult ? TWISTS[tw.type].xpMult(game, tw, x, y) : 1;
  }

  // Shrinks the flashlight to `scale` for `time` seconds (dark maps only).
  dim(time, scale) {
    this.dimT = time;
    this.dimScale = scale;
  }

  update(game, dt) {
    if (this.dimT > 0) this.dimT -= dt;
    const tw = game.map.twist;
    if (tw) TWISTS[tw.type].update?.(this, game, tw, dt);
  }
}
