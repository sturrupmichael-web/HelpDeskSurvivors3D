// The Settings panel (gear button, or O): quality options, the FPS counter, sound and
// comfort options, and camera sliders for playtesting. Changes apply at once and are saved.

import { saveSettings, defaultSettings } from './settings.js';

const pct = (v) => `${Math.round(v * 100)}%`;
const RES_LABELS = { low: 'Low (1x)', medium: 'Medium (1.5x)', high: 'High (native)' };

export class SettingsPanel {
  // `onChange(settings)` applies them to the game; `playtest(action)` runs a playtest helper.
  constructor(root, settings, onChange, playtest) {
    this.s = settings;
    this.onChange = onChange;
    this.playtest = playtest;
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
      ${toggle('outlines', 'Outlines')}
      <div class="row"><span>Resolution</span><span class="choices">${Object.entries(RES_LABELS)
        .map(([k, l]) => `<button class="choice${s.resolution === k ? ' on' : ''}" data-res="${k}">${l}</button>`)
        .join('')}</span></div>
      ${toggle('fps', 'FPS counter <kbd>F</kbd>')}
      <h3>Sound</h3>
      <div class="row"><span>Effects <b class="v-sfx">${pct(s.sfx)}</b></span><input type="range" min="0" max="1" step="0.05" value="${s.sfx}" data-range="sfx"></div>
      <div class="row"><span>Music <b class="v-music">${pct(s.music)}</b></span><input type="range" min="0" max="1" step="0.05" value="${s.music}" data-range="music"></div>
      <h3>Comfort</h3>
      ${toggle('shake', 'Screen shake')}
      ${toggle('numbers', 'Damage numbers')}
      ${toggle('vibration', 'Vibration (phones)')}
      ${toggle('stick', 'Touch joystick')}
      <h3>Camera (playtest tuning)</h3>
      <div class="row"><span>Tilt <b class="v-tilt">${s.tilt}°</b></span><input type="range" min="40" max="70" step="1" value="${s.tilt}" data-range="tilt"></div>
      <div class="row"><span>Distance <b class="v-zoom">${s.zoom.toFixed(2)}x</b></span><input type="range" min="0.7" max="1.5" step="0.05" value="${s.zoom}" data-range="zoom"></div>
      <div class="row buttons"><button data-act="reset-camera">Reset camera</button></div>
      <h3>Playtest helpers</h3>
      <div class="grid">
        <button data-play="spawn50">+50 users <kbd>1</kbd></button>
        <button data-play="spawn300">+300 users <kbd>2</kbd></button>
        <button data-play="each">One of each user <kbd>U</kbd></button>
        <button data-play="boss">Start a boss fight <kbd>B</kbd></button>
        <button data-play="hitboss">Hit the boss for 25% <kbd>K</kbd></button>
        <button data-play="tool">Add a tool <kbd>3</kbd></button>
        <button data-play="swap">Swap in the next tool <kbd>T</kbd></button>
        <button data-play="levelup">Level up tools <kbd>7</kbd></button>
        <button data-play="xp">Level up (cards) <kbd>8</kbd></button>
        <button data-play="chest">Drop a chest <kbd>9</kbd></button>
        <button data-play="evokit">Evolution kit <kbd>0</kbd></button>
        <button data-play="skip">Skip 1 minute <kbd>4</kbd></button>
        <button data-play="god">God mode <kbd>5</kbd></button>
        <button data-play="clear">Clear users <kbd>6</kbd></button>
        <button data-play="restart">New shift <kbd>R</kbd></button>
        <button data-play="pay">+$1,000 Overtime Pay <kbd>G</kbd></button>
        <button data-play="wipe" class="confirm">Wipe the save</button>
      </div>
      <div class="row buttons"><button data-act="close">Close <kbd>O</kbd></button></div>`;
  }

  click(e) {
    const b = e.target.closest('button');
    if (!b) return;
    const s = this.s;
    if (b.dataset.play === 'wipe' && !b.classList.contains('armed')) {
      // Pay, techs, shop, records and achievements all go: ask again.
      b.classList.add('armed');
      b.textContent = 'Wipe everything? Tap again';
      return;
    }
    if (b.dataset.play) {
      this.playtest(b.dataset.play);
      return this.toggle(false);
    }
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
    const v = this.s[key];
    this.panel.querySelector(`.v-${key}`).textContent = key === 'tilt' ? `${v}°` : key === 'zoom' ? `${v.toFixed(2)}x` : pct(v);
    this.changed();
  }

  changed() {
    saveSettings(this.s);
    this.onChange(this.s);
  }
}
