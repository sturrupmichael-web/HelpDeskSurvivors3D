// The simulation on its own, in Node: movement, furniture collision, the fixed tick.

import { Sim } from '../src/sim/game.js';
import { CHARACTERS } from '../data/player.js';
import { FOOT } from '../src/sim/player.js';
import { assert } from './harness.mjs';

const STEP = 1 / 60;
const run = (sim, seconds, axis) => {
  for (let i = 0; i < Math.round(seconds / STEP); i++) sim.tick(STEP, axis);
};

export const tests = [
  ['the tech starts off the furniture', () => {
    const sim = new Sim();
    assert(!sim.floor.blocked(sim.player.x, sim.player.y + FOOT), 'started inside a cubicle');
  }],
  ['the tech walks at their speed', () => {
    const sim = new Sim();
    sim.floor.solid = false;
    const x0 = sim.player.x;
    run(sim, 1, { x: 1, y: 0 });
    const moved = sim.player.x - x0;
    assert(Math.abs(moved - CHARACTERS.tier1.speed) < 0.5, `moved ${moved} px in 1 s`);
    assert(sim.player.facing > 1.5 && sim.player.facing < 1.6, 'faces right');
  }],
  ['cubicle rows block the feet', () => {
    const sim = new Sim();
    // Find a cubicle row and walk into it from below.
    let rect = null;
    for (let cx = 0; cx < 10 && !rect; cx++) rect = sim.floor.solidRects(cx, 0)[0];
    assert(rect, 'no cubicle row found');
    const p = sim.player;
    p.x = rect[0] + rect[2] / 2;
    p.y = rect[1] + rect[3] + 30 - FOOT;
    run(sim, 3, { x: 0, y: -1 });
    assert(!sim.floor.blocked(p.x, p.y + FOOT), 'feet ended inside the row');
    assert(p.y + FOOT >= rect[1] + rect[3], `walked through the row (feet at ${p.y + FOOT}, row ends ${rect[1] + rect[3]})`);
  }],
  ['the layout is the same every time', () => {
    const a = new Sim().floor.solidRects(3, -2);
    const b = new Sim().floor.solidRects(3, -2);
    assert(JSON.stringify(a) === JSON.stringify(b), 'layout differs');
  }],
];
