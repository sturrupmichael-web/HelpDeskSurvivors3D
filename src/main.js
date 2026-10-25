// Entry point: start input, the simulation, the 3D view and the page UI, then the loop.

import { initInput, moveAxis, pollGamepad, onKeyPress } from './engine/input.js';
import { startLoop } from './engine/loop.js';
import { Sim } from './sim/game.js';
import { View } from './render/view.js';
import { loadSettings, saveSettings, isTouchDevice } from './ui/settings.js';
import { FpsCounter } from './ui/fps.js';
import { TouchStick } from './ui/touchStick.js';
import { SettingsPanel } from './ui/settingsPanel.js';
import { VERSION } from './version.js';

const canvas = document.getElementById('game');
const ui = document.getElementById('ui');
initInput(canvas);

const settings = loadSettings();
const sim = new Sim();
// Antialiasing is fixed when the renderer is made: off on phones, where it costs most.
const view = new View(canvas, sim, { antialias: !isTouchDevice() });
const fps = new FpsCounter(ui);
const stick = new TouchStick(ui);
const panel = new SettingsPanel(ui, settings, apply);

function apply(s) {
  view.applyQuality(s);
  view.setCamera({ tilt: s.tilt, zoom: s.zoom });
  view.rig.shakeEnabled = s.shake;
  fps.visible = s.fps;
  stick.enabled = s.stick;
}
apply(settings);

onKeyPress((code) => {
  if (code === 'KeyF') {
    settings.fps = !settings.fps;
    saveSettings(settings);
    apply(settings);
    if (panel.open) panel.draw();
  } else if (code === 'KeyO' || (code === 'Escape' && panel.open)) panel.toggle();
});

const axis = { x: 0, y: 0 };
const none = { x: 0, y: 0 };
startLoop(
  (dt) => sim.tick(dt, panel.open ? none : moveAxis(axis)),
  (dt, alpha) => {
    pollGamepad(dt);
    view.render(dt, alpha);
    stick.update();
    fps.frame(dt, view.renderer.info);
  },
);

// Handy in the browser console.
window.sim = sim;
window.view = view;
console.info('Helpdesk Survivors 3D version', VERSION);
document.getElementById('boot')?.remove();
