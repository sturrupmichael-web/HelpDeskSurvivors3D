// Helpdesk Survivors: Doom Mode. Boots the game: loads the map, builds the level, and
// runs the fixed-timestep loop shared with the 3D game (src/engine/loop.js).

import { startLoop, STEP } from '../../src/engine/loop.js';
import { Level, loadLevelData } from './level.js';
import { Renderer, LightEffects } from './renderer.js';
import { Input } from './input.js';
import { Hud } from './hud.js';
import { Game } from './game.js';
import * as audio from './audio.js';
import { Tally, drawDeath } from './screens.js';

const view = document.getElementById('view');
const hudCanvas = document.getElementById('hud');
const renderer = new Renderer(view);
const input = new Input(hudCanvas);
const hud = new Hud(hudCanvas);
const lights = new LightEffects();

const mapData = await loadLevelData('e1m1');
let level;
let game;
let mode = 'play'; // play | tally
let tally = null;
let exitT = 0;
let deadT = 0;
let clicked = false;
let skill = 3;

// Starts the level from scratch (a new shift, or after burning out).
function startGame() {
  for (const scene of [renderer.scene, renderer.viewScene]) {
    scene.traverse((o) => o.geometry?.dispose());
    scene.clear();
  }
  hud.messages = [];
  level = new Level(mapData);
  game = new Game({ level, renderer, hud, skill });
  mode = 'play';
  tally = null;
  exitT = 0;
  deadT = 0;
}
startGame();

hudCanvas.addEventListener('click', () => {
  audio.init();
  if (input.locked || mode !== 'play') clicked = true;
  input.lock();
});
addEventListener('keydown', () => audio.init(), { once: true });

function update(dt) {
  input.pollGamepad();
  const presses = input.presses();
  const click = clicked;
  clicked = false;
  if (mode === 'tally') {
    tally.update(dt);
    if ((presses.includes('use') || click) && tally.press()) startGame();
    return;
  }
  for (const a of presses) {
    if (a === 'keys') {
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
  if (game.player.dead) {
    deadT += dt;
    if (deadT > 1 && (presses.includes('use') || click)) return startGame();
  }
  game.update(dt, input, game.player.dead ? presses.filter((a) => a !== 'use') : presses);
  // The exit switch: a moment to hear it click, then the tally.
  if (game.exited) {
    exitT += dt;
    if (exitT > 0.8) {
      mode = 'tally';
      tally = new Tally(game);
    }
  }
}

function render(dt) {
  if (mode === 'play') {
    if (!game.player.dead) game.player.look(input.takeMouse());
    game.render(dt, lights.update(dt));
    renderer.render();
    hud.draw(dt, game);
    if (game.player.dead) drawDeath(hud.ctx, hud.w, hud.h, deadT, hud.h - 32);
    else if (!input.locked) hud.banner(['CLICK TO PLAY'], { scale: 2, color: '#f4f4f4' });
  } else {
    input.takeMouse();
    renderer.render();
    hud.ctx.clearRect(0, 0, hud.w, hud.h);
    tally.draw(hud.ctx, hud.w, hud.h);
  }
}

document.getElementById('boot')?.remove();
// For tests and the console: `doom.tick(n)` runs n fixed steps and draws one frame
// (headless browsers don't always run animation frames on their own).
window.doom = {
  get level() {
    return level;
  },
  get game() {
    return game;
  },
  get mode() {
    return mode;
  },
  get tally() {
    return tally;
  },
  renderer,
  input,
  hud,
  restart: startGame,
  tick(n = 1) {
    for (let i = 0; i < n; i++) update(STEP);
    render(STEP);
  },
};
startLoop(update, render);
