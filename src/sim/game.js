// The simulation: owns the world state and advances it one fixed tick at a time. It knows
// nothing about Three.js or the page, so it also runs headless in Node (tests/). The
// renderer and the UI read its state; input arrives as a movement axis per tick.
//
// Units are the original game's world pixels on a flat plane: x to the right, y down the
// screen. The renderer maps (x, y) to Three.js (X, Z).

import { CHARACTERS } from '../../data/player.js';
import { Floor } from './floor.js';
import { createPlayer, updatePlayer } from './player.js';

const noop = () => {};

export class Sim {
  // `sfx(name, x)` plays a sound (the page wires in the synth; headless leaves it silent).
  constructor({ sfx = noop } = {}) {
    this.sfx = sfx;
    this.floor = new Floor();
    this.time = 0;
    this.ticks = 0;
    this.newRun();
  }

  newRun(charId = 'tier1') {
    this.player = createPlayer(CHARACTERS[charId]);
    this.time = 0;
    this.ticks = 0;
    // Start in a clear spot: walk down from the origin until the feet are off furniture.
    const p = this.player;
    while (this.floor.blocked(p.x, p.y + 10)) p.y += 8;
    p.px = p.x;
    p.py = p.y;
  }

  tick(dt, axis) {
    this.time += dt;
    this.ticks++;
    updatePlayer(this, axis, dt);
  }
}
