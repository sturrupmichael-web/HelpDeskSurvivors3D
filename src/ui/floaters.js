// Floating damage numbers and words ("RESOLVED x25!", pickup labels), drawn on a 2D canvas
// over the 3D view at the point on the floor where they happened. The simulation's
// `number` and `text` hooks land here. Pooled like the original's fx.js, with cached
// number strings so a crowd of hits allocates nothing.

import { Pool } from '../engine/pool.js';

const NUM = Array.from({ length: 1000 }, (_, i) => String(i));
const RISE = 34; // px per second
const NUMBER_LIFE = 0.6;
const TEXT_LIFE = 1.2;

export class Floaters {
  constructor(root) {
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'floaters';
    root.append(this.canvas);
    this.ctx = this.canvas.getContext('2d');
    this.items = new Pool(160, () => ({ x: 0, y: 0, t: 0, life: 0, text: '', color: '#fff', big: false, dx: 0 }));
    this.showNumbers = true;
    this.pt = { x: 0, y: 0 };
    this.w = 0;
    this.h = 0;
  }

  clear() {
    this.items.clear();
  }

  // The `number` hook: damage dealt to a user at world (x, y).
  number(x, y, amount) {
    if (!this.showNumbers) return;
    const n = this.items.spawn();
    if (!n) return;
    const v = Math.round(amount);
    n.text = v < 1000 ? NUM[Math.max(0, v)] : String(v);
    this.place(n, x, y, '#f4f4f4', false, NUMBER_LIFE);
  }

  // The `text` hook: a word or two, larger and longer lived.
  text(x, y, words, color = '#ffcd75') {
    const n = this.items.spawn();
    if (!n) return;
    n.text = words;
    this.place(n, x, y, color, true, TEXT_LIFE);
  }

  place(n, x, y, color, big, life) {
    n.x = x;
    n.y = y;
    n.t = 0;
    n.life = life;
    n.color = color;
    n.big = big;
    n.dx = big ? 0 : Math.random() * 12 - 6;
  }

  update(dt, view, frozen) {
    const dpr = Math.min(2, devicePixelRatio || 1);
    const w = Math.round(innerWidth * dpr);
    const h = Math.round(innerHeight * dpr);
    if (w !== this.w || h !== this.h) {
      this.canvas.width = this.w = w;
      this.canvas.height = this.h = h;
    }
    const ctx = this.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const items = this.items;
    if (!items.count) return;
    if (frozen) dt = 0;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#1a1c2c';
    const pt = this.pt;
    let font = '';
    for (let i = items.count - 1; i >= 0; i--) {
      const n = items.items[i];
      if ((n.t += dt) >= n.life) {
        items.removeAt(i);
        continue;
      }
      if (!view.toScreen(n.x, n.y, pt)) continue;
      const k = n.t / n.life;
      ctx.globalAlpha = k < 0.65 ? 1 : 1 - (k - 0.65) / 0.35;
      const want = n.big ? '800 18px system-ui, sans-serif' : '700 13px system-ui, sans-serif';
      if (font !== want) ctx.font = font = want;
      ctx.lineWidth = n.big ? 4 : 3;
      // Words pop in a little larger, then settle.
      const pop = n.big && n.t < 0.12 ? 1.25 - n.t * 2 : 1;
      const x = pt.x + n.dx;
      const y = pt.y - (n.big ? 40 : 28) - n.t * RISE;
      if (pop !== 1) ctx.setTransform(dpr * pop, 0, 0, dpr * pop, x * dpr * (1 - pop), y * dpr * (1 - pop));
      ctx.strokeText(n.text, x, y);
      ctx.fillStyle = n.color;
      ctx.fillText(n.text, x, y);
      if (pop !== 1) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    ctx.globalAlpha = 1;
  }
}
