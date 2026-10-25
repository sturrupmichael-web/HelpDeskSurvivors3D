// The pause menu ("ON HOLD"): Esc, P, gamepad Start or the II button. Also opens by itself
// when the tab is hidden. Ported from the original's src/ui/screens/pause.js; Restart and
// Quit to Title throw the shift (and its pay) away, so outside training they need a second
// press. It also lists the shift's policies. Not yet ported: Shift Stats and Report a Bug.

import { PAUSE_LINES } from '../../data/flavor.js';
import { POLICIES } from '../../data/policies.js';
import { fmtMult } from '../sim/policies.js';

const pickLine = (list) => list[(Math.random() * list.length) | 0];
const SHIFT_LABELS = { restart: 'Restart Shift <kbd>R</kbd>', quit: 'Quit to Title <kbd>Q</kbd>' };
const TRAINING_LABELS = { restart: 'Restart Training <kbd>R</kbd>', quit: 'Skip Training <kbd>Q</kbd>' };

export class PauseScreen {
  // `onResume()`, `onRestart()`, `onQuit()`, `onSettings()` and `onMute()` go back to the
  // page; `muted()` says whether sound is off.
  constructor(root, { onResume, onRestart, onQuit, onSettings, onMute, muted }) {
    this.onResume = onResume;
    this.onRestart = onRestart;
    this.onQuit = onQuit;
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
    this.armed = null; // the button waiting for its second press
    this.disarm = 0;
    this.training = false;
    this.labels = SHIFT_LABELS;
  }

  get open() {
    return !this.el.hidden;
  }

  // Called every frame: shows or hides itself to match `sim.paused`.
  update(sim) {
    if (sim.paused === this.open) return;
    if (sim.paused) this.show(sim);
    else this.el.hidden = true;
  }

  show(sim) {
    this.armed = null;
    clearTimeout(this.disarm);
    this.training = !!sim.tutorial;
    this.labels = this.training ? TRAINING_LABELS : SHIFT_LABELS;
    const pol = sim.policy;
    const policies = pol.ids.length || pol.hardcore
      ? `<p class="pause-policies">${pol.hardcore ? '<b class="hc-tag">HARDCORE</b> ' : ''}${pol.ids.length ? 'Policies' : 'Pay and score'} (${fmtMult(pol.mult)})${pol.ids.length ? ': ' : ''}${pol.ids.map((id) => `<b>${POLICIES[id].name}</b>`).join(', ')}</p>`
      : '';
    this.el.innerHTML = `
      <div class="panel pause-panel">
        <h2>ON HOLD</h2>
        <p class="sub">${pickLine(PAUSE_LINES)}</p>
        ${policies}
        <button class="primary" data-act="resume">Resume <kbd>Esc</kbd></button>
        <button data-act="settings">Settings <kbd>O</kbd></button>
        <button data-act="mute">${this.soundLabel()}</button>
        <div class="pause-danger">
          <button class="confirm" data-act="restart">${this.labels.restart}</button>
          <button class="confirm" data-act="quit">${this.labels.quit}</button>
        </div>
      </div>`;
    this.el.hidden = false;
  }

  act(act) {
    if (act === 'resume') this.onResume();
    else if (act === 'settings') this.onSettings();
    else if (act === 'mute') this.onMute();
    else if (act === 'restart' || act === 'quit') {
      if (this.armed !== act && !this.training) {
        // First press: ask again, and forget it after 3 seconds.
        this.reset();
        this.armed = act;
        const b = this.el.querySelector(`[data-act=${act}]`);
        b.classList.add('armed');
        b.innerHTML = `${act === 'restart' ? 'Restart' : 'Quit'}? This shift's pay is lost. ${matchMedia('(pointer: coarse)').matches ? 'Tap' : 'Press'} again to confirm <kbd>${act === 'restart' ? 'R' : 'Q'}</kbd>`;
        this.disarm = setTimeout(() => this.reset(), 3000);
        return;
      }
      this.reset();
      if (act === 'restart') this.onRestart();
      else this.onQuit();
    }
  }

  // Puts an armed Restart or Quit button back the way it was.
  reset() {
    clearTimeout(this.disarm);
    if (!this.armed) return;
    const b = this.el.querySelector(`[data-act=${this.armed}]`);
    b?.classList.remove('armed');
    if (b) b.innerHTML = this.labels[this.armed];
    this.armed = null;
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
    else if (code === 'KeyQ') this.act('quit');
    else if (code === 'KeyO' || code === 'KeyM') return false;
    return true;
  }
}
