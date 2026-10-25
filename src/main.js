// Entry point: start input, the save, the simulation, the 3D view and the page UI, then
// the loop. The game opens on the title screen, over the office floor.

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
import { Menus } from './ui/menus.js';
import { Meta } from './sim/meta.js';
import { Floaters } from './ui/floaters.js';
import { initAudio, sfx, toggleMute, isMuted, setVolumes, setListener, startMusic, stopMusic, duckMusic, setMusicStyle } from './engine/audio.js';
import { setHaptics } from './engine/haptics.js';
import { VERSION } from './version.js';
import { MAPS, MAP_ORDER } from '../data/maps.js';

const canvas = document.getElementById('game');
const ui = document.getElementById('ui');
initInput(canvas);
// Browsers only allow sound after a key press or a tap.
addEventListener('keydown', initAudio);
addEventListener('pointerdown', initAudio);
addEventListener('contextmenu', (e) => e.preventDefault()); // a long press shouldn't open a menu

const settings = loadSettings();
let view = null;
const floaters = new Floaters(ui); // under the HUD
const hud = new Hud(ui, () => sim.pause());
hud.setMuted(isMuted());
const banner = { show: (title, text, seconds) => hud.banner(title, text, seconds) };
// The save lives in localStorage; a private window or blocked storage just forgets it.
const SAVE_KEY = 'helpdesk-survivors-3d.save.v1';
const meta = new Meta({
  load: () => JSON.parse(localStorage.getItem(SAVE_KEY) ?? 'null'),
  save: (d) => localStorage.setItem(SAVE_KEY, JSON.stringify(d)),
});
const sim = new Sim({
  banner: banner.show,
  shake: (amount) => view?.rig.shake(amount),
  ring: (x, y, r, color, life, fill) => view?.weapons.ring(x, y, r, color, life, fill),
  sfx,
  burst: (x, y, colors, n) => view?.fx.burst(x, y, colors, n),
  number: (x, y, amount) => floaters.number(x, y, amount),
  text: (x, y, words, color) => floaters.text(x, y, words, color),
  toast: (a) => hud.toast(a),
}, meta);
setMusicStyle(sim.map.music);
// Antialiasing is fixed when the renderer is made: off on phones, where it costs most.
view = new View(canvas, sim, { antialias: !isTouchDevice() });
const fps = new FpsCounter(ui);
const stick = new TouchStick(ui);
const panel = new SettingsPanel(ui, settings, apply, playtest);
const levelUp = new LevelUpScreen(
  ui,
  (card, always) => sim.choose(card, always),
  () => sim.closeChest(),
  () => sim.reroll(),
);
const pause = new PauseScreen(ui, {
  onResume: () => sim.resume(),
  onRestart: () => newShift(),
  onQuit: () => toMenu().title(),
  onSettings: () => panel.toggle(true),
  onMute: () => mute(),
  muted: isMuted,
});
const gameOver = new GameOverScreen(ui, (act) => {
  if (act === 'again') newShift();
  else if (act === 'switch') toMenu().setup('char');
  else if (act === 'shop') toMenu().shop();
  else toMenu().title();
});
const menus = new Menus(ui, {
  sim,
  portrait: (id) => view.portrait(id),
  onStart: () => newShift(),
  onPreview: (tech, map) => reset(tech, map),
  onSettings: () => panel.toggle(true),
  sfx,
});
// The gear and Settings panel go on top of the screens, and the toasts on top of those.
ui.append(panel.button, panel.panel, hud.toasts);

// A fresh floor with the picked tech on it (or `tech` on `map`, previewed from the menus).
function reset(tech, map) {
  sim.newRun(tech, map);
  setMusicStyle(sim.map.music); // each map has its own remix
  view.resetCamera();
  view.fx.clear();
  floaters.clear();
}

function newShift() {
  menus.hide();
  sim.menu = false;
  reset();
}

// Back to the menus between shifts (the title, the Clock In picker, the shop): the floor
// waits with the tech on it. Returns the menus, to show one.
function toMenu() {
  sim.menu = true;
  reset();
  return menus;
}

function mute() {
  hud.setMuted(toggleMute());
  pause.refresh();
}

function apply(s) {
  view.applyQuality(s);
  view.setCamera({ tilt: s.tilt, zoom: s.zoom });
  view.rig.shakeEnabled = s.shake;
  fps.visible = s.fps;
  stick.enabled = s.stick;
  floaters.showNumbers = s.numbers;
  setVolumes(s.sfx, s.music);
  setHaptics(s.vibration);
}
apply(settings);

// Playtest helpers, like the original's debug hotkeys (also buttons in Settings for phones).
function playtest(act) {
  const p = sim.player;
  if (act === 'spawn50') sim.debugSpawn(50);
  else if (act === 'spawn300') sim.debugSpawn(300);
  else if (act === 'each') banner.show('ONE OF EACH', `${sim.debugSpawnEach()} kinds of user, in a ring round you.`, 2);
  else if (act === 'tool') {
    const w = sim.debugAddWeapon();
    if (w) banner.show(w.def.name.toUpperCase(), w.def.desc, 2);
    else banner.show('NO MORE TOOLS', p.weapons.length >= p.maxWeapons ? 'Every tool slot is full.' : 'Every tool ported so far is equipped.', 2);
  } else if (act === 'swap') {
    const w = sim.debugSwapWeapon();
    if (w) banner.show(w.def.name.toUpperCase(), w.def.desc, 2);
  } else if (act === 'levelup') {
    sim.debugLevelWeapons();
    banner.show('TOOLS LEVELLED UP', p.weapons.map((w) => `${w.def.name} ${w.level}`).join(' · '), 2.5);
  } else if (act === 'xp') sim.debugLevelUp();
  else if (act === 'chest') sim.debugChest();
  else if (act === 'boss') sim.debugBoss();
  else if (act === 'hitboss' && !sim.debugHitBoss()) banner.show('NO BOSS', 'Press B to start a boss fight first.', 1.5);
  else if (act === 'evokit') {
    sim.debugEvolveKit();
    sim.debugChest();
    banner.show('EVOLUTION KIT', 'Tools maxed with their paired passives. Grab the chest to evolve one.', 2.5);
  } else if (act === 'skip') sim.debugSkip(60);
  else if (act === 'god') {
    p.god = !p.god;
    banner.show(p.god ? 'GOD MODE ON' : 'GOD MODE OFF', p.god ? 'Users can no longer hurt you.' : 'Careful now.', 1.5);
  } else if (act === 'clear') sim.debugClear();
  else if (act === 'restart' && !sim.menu) newShift();
  else if (act === 'pay') {
    meta.data.pay += 1000;
    meta.save();
    menus.refresh();
    banner.show('+$1,000 OVERTIME PAY', `Balance: $${meta.data.pay.toLocaleString()}. Spend it in the Overtime Shop or on a new tech.`, 2);
  } else if (act === 'map') {
    // Counts a win on the map before the next locked one, as if you'd clocked out there:
    // that opens the map, and whatever that win unlocks (data/unlocks.js).
    const next = MAP_ORDER.find((id) => !meta.mapUnlocked(id));
    if (!next) return banner.show('EVERY MAP IS OPEN', 'Pick one when you Clock In.', 2);
    const won = MAPS[next].unlockAfter;
    meta.data.mapsWon.push(won);
    meta.save();
    menus.refresh();
    banner.show(`${MAPS[next].name.toUpperCase()} UNLOCKED`, `Counted a win in the ${MAPS[won].name}, with everything it unlocks.`, 2.5);
  } else if (act === 'wipe') {
    meta.reset();
    toMenu().title();
  }
}
const PLAYTEST_KEYS = { Digit1: 'spawn50', Digit2: 'spawn300', Digit3: 'tool', KeyT: 'swap', Digit4: 'skip', Digit5: 'god', Digit6: 'clear', Digit7: 'levelup', Digit8: 'xp', Digit9: 'chest', Digit0: 'evokit', KeyU: 'each', KeyB: 'boss', Equal: 'boss', KeyK: 'hitboss', KeyR: 'restart', KeyG: 'pay' };

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
  if (gameOver.key(code) || menus.key(code) || levelUp.key(code) || pause.key(code)) return;
  if (code === 'KeyM') mute();
  else if (code === 'KeyO') panel.toggle(true);
  else if (code === 'KeyG') playtest('pay'); // works on the menus too, to try the shop and techs
  else if (code === 'KeyL') playtest('map'); // ...and so does this, to try the maps
  else if (sim.over || sim.waiting || sim.menu) return;
  else if (code === 'Escape' || code === 'KeyP' || code === 'PadStart') sim.pause();
  else if (PLAYTEST_KEYS[code]) playtest(PLAYTEST_KEYS[code]);
});

let hudHidden = false;
sim.menu = true;
menus.title();

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
    if (sim.menu !== hudHidden) hud.setVisible(!(hudHidden = sim.menu));
    hud.update(dt, sim, view);
    floaters.update(dt, view, sim.frozen);
    music();
    setListener(sim.player.x);
    levelUp.update(sim);
    pause.update(sim);
    gameOver.update(sim);
    fps.frame(dt, view.renderer.info);
  },
);

// Music plays during a shift, quieter while paused, and stops on the summary.
let musicState = '';
function music() {
  const want = sim.over ? 'off' : sim.paused ? 'ducked' : 'on';
  if (want === musicState) return;
  if (want === 'off') stopMusic();
  else if (musicState === 'off' || musicState === '') startMusic();
  duckMusic(want === 'ducked');
  musicState = want;
}

// Handy in the browser console.
window.sim = sim;
window.view = view;
console.info('Helpdesk Survivors 3D version', VERSION);
document.getElementById('boot')?.remove();
