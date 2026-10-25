// Player settings, saved in localStorage (separately from any progress, like the
// original). Quality defaults are lighter on phones and tablets.

const KEY = 'helpdesk-survivors-3d.settings.v1';

export const isTouchDevice = () => typeof matchMedia === 'function' && matchMedia('(hover: none) and (pointer: coarse)').matches;

export function defaultSettings() {
  const phone = isTouchDevice();
  return {
    shadows: !phone, // real shadows from the sun (off: blob shadows only)
    outlines: true, // ink outlines round people and furniture
    resolution: phone ? 'low' : 'high', // pixel ratio: low 1x, medium 1.5x, high native (max 2x)
    fps: false, // on-screen FPS counter
    shake: true, // screen shake
    stick: true, // on-screen touch joystick
    // Camera tuning for playtesting (src/render/cameraRig.js).
    tilt: 55,
    zoom: 1,
  };
}

export function loadSettings() {
  const s = defaultSettings();
  try {
    Object.assign(s, JSON.parse(localStorage.getItem(KEY) || '{}'));
  } catch {
    // Storage blocked or corrupt: defaults.
  }
  return s;
}

export function saveSettings(s) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    // Not persisted; fine.
  }
}
