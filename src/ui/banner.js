// The big event banner (PATCH TUESDAY, BURNED OUT...) and a small shift clock. The full
// HUD arrives in milestone 5; these are what playtesting the waves needs until then.

import { fmtTime } from '../sim/game.js';

export class Banner {
  constructor(root) {
    this.el = document.createElement('div');
    this.el.className = 'banner';
    this.el.hidden = true;
    this.el.innerHTML = '<b></b><span></span>';
    this.clock = document.createElement('div');
    this.clock.className = 'clock';
    root.append(this.el, this.clock);
    this.t = 0;
    this.shown = '';
  }

  show(title, text, seconds) {
    this.el.querySelector('b').textContent = title;
    this.el.querySelector('span').textContent = text;
    this.el.hidden = false;
    this.t = seconds;
  }

  update(dt, sim) {
    if (this.t > 0 && (this.t -= dt) <= 0) this.el.hidden = true;
    const s = `${fmtTime(sim.time)} · ${sim.enemies.count} users`;
    if (s !== this.shown) this.clock.textContent = this.shown = s;
  }
}
