// Helpdesk Survivors: Doom Mode. Boots the game: loads the map, builds the level, and
// runs the fixed-timestep loop shared with the 3D game (src/engine/loop.js).

import { startLoop, STEP } from '../../src/engine/loop.js';
import { Level, loadLevelData } from './level.js';
import { Renderer, LightEffects } from './renderer.js';
import { Input } from './input.js';
import { Hud } from './hud.js';
import { Game } from './game.js';
import * as audio from './audio.js';

const view = document.getElementById('view');
const hudCanvas = document.getElementById('hud');
const renderer = new Renderer(view);
const input = new Input(hudCanvas);
const hud = new Hud(hudCanvas);
const lights = new LightEffects();

const level = new Level(await loadLevelData('e1m1'));
const game = new Game({ level, renderer, hud, skill: 3 });

hudCanvas.addEventListener('click', () => {
  audio.init();
  input.lock();
});
addEventListener('keydown', () => audio.init(), { once: true });

function update(dt) {
  input.pollGamepad();
  const presses = input.presses();
  for (const a of presses) {
    if (a === 'keys') {
      // Playtest helper until badges arrive in stage 4: all three badges.
      for (const k of ['blue', 'yellow', 'red']) game.player.keys.add(k);
      hud.message('All badges (playtest)');
    }
    if (a === 'idkfa') {
      for (const id of ['replyAll', 'powershell', 'reimage', 'reboot']) game.arsenal.owned.add(id);
      for (const k of Object.keys(game.arsenal.ammo)) game.arsenal.ammo[k] = game.arsenal.max[k];
      game.player.armor = 200;
      game.player.armorClass = 2;
      hud.message('Every tool and full ammo (playtest)');
    }
    if (a === 'god') {
      game.god = !game.god;
      hud.message(game.god ? 'Degreelessness mode on (playtest)' : 'Degreelessness mode off');
    }
    if (a === 'mute') hud.message(audio.toggleMute() ? 'Sound off' : 'Sound on');
  }
  game.update(dt, input, presses);
  if (game.exited && !game.exitShown) {
    game.exitShown = true;
    hud.message('Clocked out! (The tally screen arrives in stage 4.)');
  }
}

function render(dt) {
  if (!game.player.dead) game.player.look(input.takeMouse());
  game.render(dt, lights.update(dt));
  renderer.render();
  hud.draw(dt, game);
  if (!input.locked) hud.banner(['CLICK TO PLAY'], { scale: 2, color: '#f4f4f4' });
}

document.getElementById('boot')?.remove();
// For tests and the console: `doom.tick(n)` runs n fixed steps and draws one frame
// (headless browsers don't always run animation frames on their own).
window.doom = {
  level,
  game,
  renderer,
  input,
  hud,
  tick(n = 1) {
    for (let i = 0; i < n; i++) update(STEP);
    render(STEP);
  },
};
startLoop(update, render);
