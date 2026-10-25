// On-screen frame counter: frames per second, the worst frame in the last half second,
// draw calls and triangles. Toggled with F or from Settings.

export class FpsCounter {
  constructor(root) {
    this.el = document.createElement('div');
    this.el.className = 'fps';
    this.el.hidden = true;
    root.appendChild(this.el);
    this.frames = 0;
    this.t = 0;
    this.worst = 0;
  }

  set visible(on) {
    this.el.hidden = !on;
  }

  get visible() {
    return !this.el.hidden;
  }

  // `info` is the WebGLRenderer's info; `extra` a short text for the second line.
  frame(dt, info, extra = '') {
    this.frames++;
    this.t += dt;
    this.worst = Math.max(this.worst, dt);
    if (this.t < 0.5) return;
    if (this.visible) {
      const fps = Math.round(this.frames / this.t);
      this.el.textContent = `${fps} FPS · worst ${(this.worst * 1000).toFixed(1)} ms\n${info.render.calls} draws · ${(info.render.triangles / 1000).toFixed(1)}k tris${extra ? '\n' + extra : ''}`;
    }
    this.frames = 0;
    this.t = 0;
    this.worst = 0;
  }
}
