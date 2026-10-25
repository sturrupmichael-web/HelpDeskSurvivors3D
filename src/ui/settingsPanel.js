// The Settings panel (gear button, or O): quality options, the FPS counter, and camera
// sliders for playtesting. Changes apply at once and are saved.

import { saveSettings, defaultSettings } from './settings.js';

const RES_LABELS = { low: 'Low (1x)', medium: 'Medium (1.5x)', high: 'High (native)' };

export class SettingsPanel {
  // `onChange(settings)` applies them to the game.
  constructor(root, settings, onChange) {
    this.s = settings;
    this.onChange = onChange;
    this.button = document.createElement('button');
    this.button.className = 'gear';
    this.button.setAttribute('aria-label', 'Settings');
    this.button.textContent = '⚙';
    this.button.addEventListener('click', () => this.toggle());
    this.panel = document.createElement('div');
    this.panel.className = 'panel settings';
    this.panel.hidden = true;
    root.append(this.button, this.panel);
    this.panel.addEventListener('click', (e) => this.click(e));
    this.panel.addEventListener('input', (e) => this.input(e));
    this.draw();
  }

  get open() {
    return !this.panel.hidden;
  }

  toggle(on = !this.open) {
    this.panel.hidden = !on;
    if (on) this.draw();
  }

  draw() {
    const s = this.s;
    const toggle = (key, label) =>
      `<div class="row"><span>${label}</span><button class="toggle${s[key] ? ' on' : ''}" data-toggle="${key}" aria-pressed="${s[key]}">${s[key] ? 'ON' : 'OFF'}</button></div>`;
    this.panel.innerHTML = `
      <h2>Settings</h2>
      <h3>Quality</h3>
      ${toggle('shadows', 'Shadows')}
      <div class="row"><span>Resolution</span><span class="choices">${Object.entries(RES_LABELS)
        .map(([k, l]) => `<button class="choice${s.resolution === k ? ' on' : ''}" data-res="${k}">${l}</button>`)
        .join('')}</span></div>
      ${toggle('fps', 'FPS counter <kbd>F</kbd>')}
      <h3>Comfort</h3>
      ${toggle('shake', 'Screen shake')}
      ${toggle('stick', 'Touch joystick')}
      <h3>Camera (playtest tuning)</h3>
      <div class="row"><span>Tilt <b class="v-tilt">${s.tilt}°</b></span><input type="range" min="40" max="70" step="1" value="${s.tilt}" data-range="tilt"></div>
      <div class="row"><span>Distance <b class="v-zoom">${s.zoom.toFixed(2)}x</b></span><input type="range" min="0.7" max="1.5" step="0.05" value="${s.zoom}" data-range="zoom"></div>
      <div class="row buttons"><button data-act="reset-camera">Reset camera</button><button data-act="close">Close <kbd>O</kbd></button></div>`;
  }

  click(e) {
    const b = e.target.closest('button');
    if (!b) return;
    const s = this.s;
    if (b.dataset.toggle) s[b.dataset.toggle] = !s[b.dataset.toggle];
    else if (b.dataset.res) s.resolution = b.dataset.res;
    else if (b.dataset.act === 'reset-camera') ({ tilt: s.tilt, zoom: s.zoom } = defaultSettings());
    else if (b.dataset.act === 'close') return this.toggle(false);
    this.changed();
    this.draw();
  }

  input(e) {
    const key = e.target.dataset.range;
    if (!key) return;
    this.s[key] = Number(e.target.value);
    this.panel.querySelector(`.v-${key}`).textContent = key === 'tilt' ? `${this.s.tilt}°` : `${this.s.zoom.toFixed(2)}x`;
    this.changed();
  }

  changed() {
    saveSettings(this.s);
    this.onChange(this.s);
  }
}
