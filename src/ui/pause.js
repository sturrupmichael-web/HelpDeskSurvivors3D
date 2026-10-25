// The pause menu ("ON HOLD"): Esc, P, gamepad Start or the II button. Also opens by itself
// when the tab is hidden. Ported from the original's src/ui/screens/pause.js; Restart
// throws the shift away, so it needs a second press. Not yet ported: Shift Stats, Report a
// Bug and Quit to Title.

import { PAUSE_LINES } from '../../data/flavor.js';

const pickLine = (list) => list[(Math.random() * list.length) | 0];
const RESTART = 'Restart Shift <kbd>R</kbd>';

export class PauseScreen {
  // `onResume()`, `onRestart()`, `onSettings()` and `onMute()` go back to the page;
  // `muted()` says whether sound is off.
  constructor(root, { onResume, onRestart, onSettings, onMute, muted }) {
    this.onResume = onResume;
    this.onRestart = onRestart;
    this.onSettings = onSettings;
    this.onMute = onMute;
    this.muted = muted;
    this.el = document.createElement('div');
    this.el.className = 'screen';
    this.el.hidden = true;
    root.append(this.el);
    this.el.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (b) this.act(b.dataset.act);
    });
    this.armed = false;
    this.disarm = 0;
  }

  get open() {
    return !this.el.hidden;
  }

  // Called every frame: shows or hides itself to match `sim.paused`.
  update(sim) {
    if (sim.paused === this.open) return;
    if (sim.paused) this.show();
    else this.el.hidden = true;
  }

  show() {
    this.armed = false;
    clearTimeout(this.disarm);
    this.el.innerHTML = `
      <div class="panel pause-panel">
        <h2>ON HOLD</h2>
        <p class="sub">${pickLine(PAUSE_LINES)}</p>
        <button class="primary" data-act="resume">Resume <kbd>Esc</kbd></button>
        <button data-act="settings">Settings <kbd>O</kbd></button>
        <button data-act="mute">${this.soundLabel()}</button>
        <div class="pause-danger"><button class="confirm" data-act="restart">${RESTART}</button></div>
      </div>`;
    this.el.hidden = false;
  }

  act(act) {
    if (act === 'resume') this.onResume();
    else if (act === 'settings') this.onSettings();
    else if (act === 'mute') this.onMute();
    else if (act === 'restart') {
      const b = this.el.querySelector('.confirm');
      if (!this.armed) {
        // First press: ask again, and forget it after 3 seconds.
        this.armed = true;
        b.classList.add('armed');
        b.innerHTML = `Restart? This shift is lost. ${matchMedia('(pointer: coarse)').matches ? 'Tap' : 'Press'} again to confirm <kbd>R</kbd>`;
        clearTimeout(this.disarm);
        this.disarm = setTimeout(() => {
          this.armed = false;
          b.classList.remove('armed');
          b.innerHTML = RESTART;
        }, 3000);
        return;
      }
      clearTimeout(this.disarm);
      this.onRestart();
    }
  }

  soundLabel() {
    return `Sound: ${this.muted() ? 'Off' : 'On'} <kbd>M</kbd>`;
  }

  // Keeps the Sound button in step when M is pressed.
  refresh() {
    const b = this.el.querySelector('[data-act=mute]');
    if (b) b.innerHTML = this.soundLabel();
  }

  // Keyboard and gamepad. Returns true if it used the key (it takes them all while open,
  // except O, which the page handles so Settings opens over the menu).
  key(code) {
    if (!this.open) return false;
    if (code === 'Escape' || code === 'KeyP' || code === 'PadStart' || code === 'PadB') this.act('resume');
    else if (code === 'KeyR') this.act('restart');
    else if (code === 'KeyO' || code === 'KeyM') return false;
    return true;
  }
}
