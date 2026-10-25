// Draws the floating touch joystick (src/engine/input.js tracks it) as two circles.

import { touchState as touch } from '../engine/input.js';

export class TouchStick {
  constructor(root) {
    this.base = document.createElement('div');
    this.base.className = 'stick-base';
    this.knob = document.createElement('div');
    this.knob.className = 'stick-knob';
    root.append(this.base, this.knob);
    this.enabled = true;
    this.shown = false;
  }

  update() {
    const on = this.enabled && touch.active;
    if (on !== this.shown) {
      this.shown = on;
      this.base.style.display = this.knob.style.display = on ? 'block' : 'none';
    }
    if (!on) return;
    const r = touch.radius;
    this.base.style.transform = `translate(${touch.ox - r}px, ${touch.oy - r}px)`;
    const kr = r * 0.45;
    this.knob.style.transform = `translate(${touch.ox + touch.ax * r - kr}px, ${touch.oy + touch.ay * r - kr}px)`;
  }
}
