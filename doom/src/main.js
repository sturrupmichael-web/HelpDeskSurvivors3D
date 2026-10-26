// Helpdesk Survivors: Doom Mode. Boots the game: loads the map, builds the level, and
// runs the fixed-timestep loop shared with the 3D game (src/engine/loop.js).

import { startLoop } from '../../src/engine/loop.js';
import { Level, loadLevelData } from './level.js';
import { LevelMeshes } from './geometry.js';
import { Renderer, LightEffects } from './renderer.js';
import { Input } from './input.js';
import { Player, RADIUS } from './player.js';
import { Hud } from './hud.js';

const view = document.getElementById('view');
const hudCanvas = document.getElementById('hud');
const renderer = new Renderer(view);
const input = new Input(hudCanvas);
const hud = new Hud(hudCanvas, renderer);
const lights = new LightEffects();

const level = new Level(await loadLevelData('e1m1'));
const meshes = new LevelMeshes(level);
renderer.scene.add(meshes.group);
const start = level.things.find((t) => t.type === 'start') ?? { x: level.S * 1.5, z: level.S * 1.5, angle: 0 };
const player = new Player(level, start);

hudCanvas.addEventListener('click', () => input.lock());

const occupied = (j) => {
  const S = level.S;
  const c = j % level.w;
  const r = (j / level.w) | 0;
  return player.x + RADIUS > c * S && player.x - RADIUS < (c + 1) * S && player.z + RADIUS > r * S && player.z - RADIUS < (r + 1) * S;
};

function update(dt) {
  input.pollGamepad();
  for (const a of input.presses()) {
    if (a === 'use') {
      const res = level.use(player.x, player.z, player.feet, player.yaw, player.keys);
      if (res?.locked) hud.message(`YOU NEED A ${res.locked.toUpperCase()} BADGE TO OPEN THIS DOOR`);
      if (res?.exit) {
        meshes.switchExit();
        hud.message('CLOCKED OUT! (THE TALLY SCREEN ARRIVES IN STAGE 4)');
      }
    }
  }
  player.update(dt, input.state(), () => false);
  level.update(dt, occupied);
  meshes.sync();
  const secret = level.secretAt(player.x, player.z);
  if (secret && !secret.found) {
    secret.found = true;
    hud.message('YOU FOUND A FORGOTTEN SERVER CLOSET!');
  }
}

function render(dt) {
  player.look(input.takeMouse());
  meshes.setLighting(lights.update(dt));
  renderer.follow(player);
  renderer.render();
  hud.draw(dt, { player, level, locked: input.locked });
}

document.getElementById('boot')?.remove();
window.doom = { level, player, renderer, input };
startLoop(update, render);
