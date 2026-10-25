// The big event banner (PATCH TUESDAY, BURNED OUT...), a small shift clock and the XP
// bar. The full HUD arrives in milestone 5; these are what playtesting needs until then.

import { fmtTime } from '../sim/game.js';

export class Banner {
  constructor(root) {
    this.el = document.createElement('div');
    this.el.className = 'banner';
    this.el.hidden = true;
    this.el.innerHTML = '<b></b><span></span>';
    this.clock = document.createElement('div');
    this.clock.className = 'clock';
    this.xp = document.createElement('div');
    this.xp.className = 'xpbar';
    this.xp.innerHTML = '<i></i><b></b>';
    root.append(this.el, this.clock, this.xp);
    this.xpShown = '';
    this.levelShown = 0;
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
    const p = sim.player;
    const w = `${Math.min(100, (p.xp / p.xpNeed) * 100).toFixed(1)}%`;
    if (w !== this.xpShown) this.xp.firstChild.style.width = this.xpShown = w;
    if (p.level !== this.levelShown) this.xp.lastChild.textContent = `LV ${(this.levelShown = p.level)}`;
  }
}
