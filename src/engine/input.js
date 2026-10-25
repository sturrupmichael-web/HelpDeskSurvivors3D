// Input: keyboard, gamepad and touch. Ported from the original with one change: the touch
// joystick is drawn by the page (src/ui/touchStick.js) instead of on the canvas.
// - Held state for movement: moveAxis() merges WASD/arrows, the gamepad's left stick
//   and d-pad, and the on-screen touch joystick.
// - Press callbacks (onKeyPress) for menus and hotkeys. Gamepad buttons arrive as
//   virtual codes: PadA, PadB, PadX, PadY, PadStart, PadUp/Down/Left/Right (the d-pad
//   and the left stick, with menu-style auto-repeat).
//
// The camera never turns, so screen up is always world -Z (the simulation's -y) and the
// axis needs no rotating.

const down = new Set();
const listeners = [];
// Keys whose browser default (scrolling, etc.) we suppress.
const BLOCK = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Backquote', 'Tab']);

const DEADZONE = 0.25;
// Standard gamepad mapping (https://w3c.github.io/gamepad/#remapping). The d-pad
// (12-15) is read as a direction instead.
const PAD_BUTTONS = { 0: 'PadA', 1: 'PadB', 2: 'PadX', 3: 'PadY', 8: 'PadSelect', 9: 'PadStart' };
const REPEAT_DELAY = 0.35; // seconds before a held direction repeats in menus
const REPEAT_RATE = 0.12;

const pad = { x: 0, y: 0, connected: false, prev: {}, dir: '', dirT: 0 };
const touch = { id: -1, ox: 0, oy: 0, ax: 0, ay: 0, active: false, used: false, radius: 50 };

const emit = (code) => {
  for (const fn of listeners) fn(code);
};

// `surface` is the element a finger goes down on for the joystick (the game canvas).
export function initInput(surface) {
  addEventListener('keydown', (e) => {
    if (e.target instanceof HTMLTextAreaElement || (e.target instanceof HTMLInputElement && e.target.type === 'text')) return;
    if (BLOCK.has(e.code)) e.preventDefault();
    down.add(e.code);
    if (!e.repeat) for (const fn of listeners) fn(e.code, e);
  });
  addEventListener('keyup', (e) => down.delete(e.code));
  addEventListener('blur', () => down.clear());

  // Floating touch joystick: put a finger down anywhere on the playfield and drag.
  surface.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'touch' || touch.active) return;
    touch.used = true;
    touch.active = true;
    touch.id = e.pointerId;
    touch.ox = e.clientX;
    touch.oy = e.clientY;
    touch.ax = touch.ay = 0;
    try {
      surface.setPointerCapture(e.pointerId);
    } catch {
      // Synthetic or already-released pointers can't be captured; moves still arrive.
    }
    e.preventDefault();
  });
  surface.addEventListener('pointermove', (e) => {
    if (e.pointerId !== touch.id) return;
    let dx = e.clientX - touch.ox;
    let dy = e.clientY - touch.oy;
    const d = Math.hypot(dx, dy);
    if (d > touch.radius) {
      // Drag the base along so the stick never feels stuck at the edge.
      touch.ox += (dx / d) * (d - touch.radius);
      touch.oy += (dy / d) * (d - touch.radius);
      dx = e.clientX - touch.ox;
      dy = e.clientY - touch.oy;
    }
    const len = Math.hypot(dx, dy) || 1;
    const m = Math.min(1, len / touch.radius);
    touch.ax = m < 0.15 ? 0 : (dx / len) * m;
    touch.ay = m < 0.15 ? 0 : (dy / len) * m;
  });
  const end = (e) => {
    if (e.pointerId !== touch.id) return;
    touch.active = false;
    touch.id = -1;
    touch.ax = touch.ay = 0;
  };
  surface.addEventListener('pointerup', end);
  surface.addEventListener('pointercancel', end);
}

// Reads the first connected gamepad and fires press events. Call once per frame.
export function pollGamepad(dt) {
  const pads = navigator.getGamepads ? navigator.getGamepads() : [];
  let gp = null;
  for (const p of pads) {
    if (p && p.connected) {
      gp = p;
      break;
    }
  }
  pad.connected = !!gp;
  if (!gp) {
    pad.x = pad.y = 0;
    return;
  }
  let x = gp.axes[0] ?? 0;
  let y = gp.axes[1] ?? 0;
  if (Math.hypot(x, y) < DEADZONE) x = y = 0;
  const b = gp.buttons;
  if (b[14]?.pressed) x = -1;
  if (b[15]?.pressed) x = 1;
  if (b[12]?.pressed) y = -1;
  if (b[13]?.pressed) y = 1;
  const m = Math.hypot(x, y);
  pad.x = m > 1 ? x / m : x;
  pad.y = m > 1 ? y / m : y;

  for (const i in PAD_BUTTONS) {
    const pressed = !!b[i]?.pressed;
    if (pressed && !pad.prev[i]) emit(PAD_BUTTONS[i]);
    pad.prev[i] = pressed;
  }
  // Menu directions from the stick or d-pad, with auto-repeat.
  const dir = m < 0.5 ? '' : Math.abs(x) > Math.abs(y) ? (x < 0 ? 'PadLeft' : 'PadRight') : y < 0 ? 'PadUp' : 'PadDown';
  if (dir !== pad.dir) {
    pad.dir = dir;
    pad.dirT = REPEAT_DELAY;
    if (dir) emit(dir);
  } else if (dir && (pad.dirT -= dt) <= 0) {
    pad.dirT = REPEAT_RATE;
    emit(dir);
  }
}

export const onKeyPress = (fn) => listeners.push(fn);
export const touchState = touch;
export const gamepadConnected = () => pad.connected;

// Writes the movement vector (length <= 1) into `out` ({x, y}).
export function moveAxis(out) {
  let x = 0;
  let y = 0;
  if (down.has('KeyA') || down.has('ArrowLeft')) x -= 1;
  if (down.has('KeyD') || down.has('ArrowRight')) x += 1;
  if (down.has('KeyW') || down.has('ArrowUp')) y -= 1;
  if (down.has('KeyS') || down.has('ArrowDown')) y += 1;
  x += pad.x + touch.ax;
  y += pad.y + touch.ay;
  const m = Math.hypot(x, y);
  if (m > 1) {
    x /= m;
    y /= m;
  }
  out.x = x;
  out.y = y;
  return out;
}
