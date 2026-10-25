// Entry point: start input, the simulation, the 3D view and the page UI, then the loop.

import { initInput, moveAxis, pollGamepad, onKeyPress } from './engine/input.js';
import { startLoop } from './engine/loop.js';
import { Sim } from './sim/game.js';
import { View } from './render/view.js';
import { loadSettings, saveSettings, isTouchDevice } from './ui/settings.js';
import { FpsCounter } from './ui/fps.js';
import { TouchStick } from './ui/touchStick.js';
import { SettingsPanel } from './ui/settingsPanel.js';
import { Hud } from './ui/hud.js';
import { LevelUpScreen } from './ui/levelUp.js';
import { PauseScreen } from './ui/pause.js';
import { GameOverScreen } from './ui/gameOver.js';
import { VERSION } from './version.js';

const canvas = document.getElementById('game');
const ui = document.getElementById('ui');
initInput(canvas);

const settings = loadSettings();
let view = null;
const hud = new Hud(ui, () => sim.pause());
const banner = { show: (title, text, seconds) => hud.banner(title, text, seconds) };
const sim = new Sim({
  banner: banner.show,
  shake: (amount) => view?.rig.shake(amount),
  ring: (x, y, r, color, life, fill) => view?.weapons.ring(x, y, r, color, life, fill),
});
// Antialiasing is fixed when the renderer is made: off on phones, where it costs most.
view = new View(canvas, sim, { antialias: !isTouchDevice() });
const fps = new FpsCounter(ui);
const stick = new TouchStick(ui);
const panel = new SettingsPanel(ui, settings, apply, playtest);
const levelUp = new LevelUpScreen(
  ui,
  (card, always) => sim.choose(card, always),
  () => sim.closeChest(),
);
const pause = new PauseScreen(ui, {
  onResume: () => sim.resume(),
  onRestart: () => newShift(),
  onSettings: () => panel.toggle(true),
});
const gameOver = new GameOverScreen(ui, () => newShift());
// The gear and Settings panel go on top of the screens.
ui.append(panel.button, panel.panel);

function newShift() {
  sim.newRun();
  view.resetCamera();
}

function apply(s) {
  view.applyQuality(s);
  view.setCamera({ tilt: s.tilt, zoom: s.zoom });
  view.rig.shakeEnabled = s.shake;
  fps.visible = s.fps;
  stick.enabled = s.stick;
}
apply(settings);

// Playtest helpers, like the original's debug hotkeys (also buttons in Settings for phones).
function playtest(act) {
  const p = sim.player;
  if (act === 'spawn50') sim.debugSpawn(50);
  else if (act === 'spawn300') sim.debugSpawn(300);
  else if (act === 'tool') {
    const w = sim.debugAddWeapon();
    if (w) banner.show(w.def.name.toUpperCase(), w.def.desc, 2);
    else banner.show('NO MORE TOOLS', p.weapons.length >= p.maxWeapons ? 'Every tool slot is full.' : 'Every tool ported so far is equipped.', 2);
  } else if (act === 'levelup') {
    sim.debugLevelWeapons();
    banner.show('TOOLS LEVELLED UP', p.weapons.map((w) => `${w.def.name} ${w.level}`).join(' · '), 2.5);
  } else if (act === 'xp') sim.debugLevelUp();
  else if (act === 'chest') sim.debugChest();
  else if (act === 'evokit') {
    sim.debugEvolveKit();
    sim.debugChest();
    banner.show('EVOLUTION KIT', 'Tools maxed with their paired passives. Grab the chest to evolve one.', 2.5);
  } else if (act === 'skip') sim.debugSkip(60);
  else if (act === 'god') {
    p.god = !p.god;
    banner.show(p.god ? 'GOD MODE ON' : 'GOD MODE OFF', p.god ? 'Users can no longer hurt you.' : 'Careful now.', 1.5);
  } else if (act === 'clear') sim.debugClear();
  else if (act === 'restart') newShift();
}
const PLAYTEST_KEYS = { Digit1: 'spawn50', Digit2: 'spawn300', Digit3: 'tool', Digit4: 'skip', Digit5: 'god', Digit6: 'clear', Digit7: 'levelup', Digit8: 'xp', Digit9: 'chest', Digit0: 'evokit', KeyR: 'restart' };

// Keys go to the topmost thing on screen: Settings, then the summary, the cards, the pause
// menu, and last the floor. F (FPS counter) works everywhere.
onKeyPress((code) => {
  if (code === 'KeyF') {
    settings.fps = !settings.fps;
    saveSettings(settings);
    apply(settings);
    if (panel.open) panel.draw();
    return;
  }
  if (panel.open) {
    if (code === 'KeyO' || code === 'Escape' || code === 'PadB') panel.toggle(false);
    return;
  }
  if (gameOver.key(code) || levelUp.key(code) || pause.key(code)) return;
  if (code === 'KeyO') panel.toggle(true);
  else if (sim.over || sim.waiting) return;
  else if (code === 'Escape' || code === 'KeyP' || code === 'PadStart') sim.pause();
  else if (PLAYTEST_KEYS[code]) playtest(PLAYTEST_KEYS[code]);
});

// Hiding the tab (or the phone's screen going off) puts the shift on hold.
document.addEventListener('visibilitychange', () => document.hidden && sim.pause());

const axis = { x: 0, y: 0 };
const none = { x: 0, y: 0 };
startLoop(
  (dt) => sim.tick(dt, panel.open ? none : moveAxis(axis)),
  (dt, alpha) => {
    pollGamepad(dt);
    view.render(dt, alpha);
    stick.update();
    hud.update(dt, sim, view);
    levelUp.update(sim);
    pause.update(sim);
    gameOver.update(sim);
    fps.frame(dt, view.renderer.info);
  },
);

// Handy in the browser console.
window.sim = sim;
window.view = view;
console.info('Helpdesk Survivors 3D version', VERSION);
document.getElementById('boot')?.remove();
