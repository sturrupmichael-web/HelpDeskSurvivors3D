// Ported unchanged from the original (HelpDeskSurvivor src/engine/).
// Phone vibration (idea 31): short buzzes for the moments that matter, keyed off the same
// names as the sound effects so sfx() can call it. Works where the browser has
// navigator.vibrate (Android Chrome and Firefox; iPhones don't support it). Ignores mute,
// so a muted phone still buzzes; Settings > Vibration turns it off.

const PATTERNS = {
  hurt: 25, // taking a hit (throttled below)
  levelup: [30, 40, 30],
  evolve: [40, 40, 40, 40, 80],
  chest: 40,
  warn: 60, // a boss winds up an attack
  alarm: [80, 60, 80],
  siren: [150, 80, 150], // boss arriving
  phase2: [60, 40, 60, 40, 200],
  burnout: 300,
  victory: [60, 50, 60, 50, 180],
};
const GAP = { hurt: 0.3, warn: 0.5 }; // seconds between buzzes of the same kind
const last = {};
let enabled = true;

export function setHaptics(on) {
  enabled = on;
}

export function buzz(name) {
  const pattern = PATTERNS[name];
  if (!enabled || !pattern || typeof navigator === 'undefined' || !navigator.vibrate) return;
  const now = performance.now() / 1000;
  if (GAP[name] && now - (last[name] ?? -9) < GAP[name]) return;
  last[name] = now;
  try {
    navigator.vibrate(pattern);
  } catch {
    // Blocked (no user gesture yet, or the browser said no): stay silent.
  }
}
