// The status bar, messages and menus, drawn on a 2D canvas at DOOM's 200 lines with the
// pixel font (font.js) and stretched over the 3D view.

import { drawText } from './font.js';
import { PALETTE as P } from '../../data/palette.js';

const LINES = 200;
const MESSAGE_TIME = 4;

export class Hud {
  constructor(canvas, renderer) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.renderer = renderer;
    this.messages = [];
    this.fps = 60;
    this.resize();
    addEventListener('resize', () => this.resize());
  }

  resize() {
    const aspect = Math.max(1, innerWidth / Math.max(1, innerHeight));
    this.h = LINES;
    this.w = Math.round(LINES * aspect);
    this.canvas.width = this.w;
    this.canvas.height = this.h;
    this.ctx.imageSmoothingEnabled = false;
  }

  message(text) {
    this.messages.push({ text, t: MESSAGE_TIME });
    if (this.messages.length > 3) this.messages.shift();
  }

  draw(dt, { player, level, locked }) {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.w, this.h);
    this.fps += (1 / Math.max(dt, 1e-3) - this.fps) * 0.05;
    // Messages, top left.
    this.messages = this.messages.filter((m) => (m.t -= dt) > 0);
    this.messages.forEach((m, i) => drawText(ctx, m.text, 2, 2 + i * 9, P.r, 1, 'left', P.k));
    // Status bar placeholder (stage 2 brings the real one).
    const barH = 32;
    ctx.fillStyle = P.c;
    ctx.fillRect(0, this.h - barH, this.w, barH);
    ctx.fillStyle = P.m;
    ctx.fillRect(0, this.h - barH, this.w, 1);
    drawText(ctx, level.name, this.w / 2, this.h - barH + 6, P.y, 1, 'center');
    drawText(ctx, `X ${player.x.toFixed(1)}  Z ${player.z.toFixed(1)}  FLOOR ${player.feet.toFixed(2)}  ${Math.round(this.fps)} FPS`, this.w / 2, this.h - barH + 18, P.g, 1, 'center');
    if (!locked) {
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(0, this.h / 2 - 20, this.w, 34);
      drawText(ctx, 'CLICK TO PLAY', this.w / 2, this.h / 2 - 14, P.w, 2, 'center', P.k);
      drawText(ctx, 'WASD MOVE  MOUSE LOOK  SPACE USE  SHIFT WALK', this.w / 2, this.h / 2 + 4, P.g, 1, 'center', P.k);
    }
  }
}
