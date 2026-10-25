// Copied unchanged from the original (HelpDeskSurvivor data/).
// Wave timeline. Keyframes are interpolated linearly between their times (seconds).
//   rate      new enemies per second
//   minAlive  the spawner tops the horde up to at least this many (main pressure knob)
//   hpMult    multiplier on enemy base HP at spawn
//   speedMult multiplier on enemy speed (0.98 at the start = everyone 2% slower than base)
//   mix       relative spawn weights per enemy id (the latest keyframe's mix applies)
//
// Target feel: easy for the first 2 minutes, tense by 10, chaotic by 15.

export const SHIFT_LENGTH = 20 * 60; // seconds until the final boss shows up; beat it to clock out

// Overtime (idea 49): past 20:00 the timeline stays at its last keyframe, so without this
// a strong build could outlast The Executive forever. After `grace` seconds of overtime
// (time to finish the fight; bot wins mostly land by 24:00) every `every` seconds adds
// one overtime level. Per level, newly spawned users get +`hpPerLevel` HP, +`damagePerLevel`
// contact damage and +`speedPerLevel` speed (at most +`maxSpeed`), and the spawn rate and
// horde size grow by `spawnPerLevel`. Bosses already on the floor are not affected. You
// also lose `drainPerLevel` x level sanity per second (exhaustion), so even a build users
// can't reach burns out in the end.
export const OVERTIME = {
  grace: 5 * 60, every: 60,
  hpPerLevel: 0.15, damagePerLevel: 0.2, speedPerLevel: 0.03, maxSpeed: 0.3, spawnPerLevel: 0.1,
  drainPerLevel: 0.3,
};

export const TIMELINE = [
  { t: 0, rate: 1.2, minAlive: 10, hpMult: 1.0, speedMult: 0.98, mix: { pam: 1 } },
  { t: 60, rate: 2.0, minAlive: 20, hpMult: 1.0, speedMult: 0.98, mix: { pam: 6, quinn: 2 } },
  { t: 120, rate: 3.0, minAlive: 35, hpMult: 1.3, speedMult: 0.98, mix: { pam: 6, quinn: 3, randy: 1 } },
  { t: 180, rate: 4.0, minAlive: 50, hpMult: 1.7, speedMult: 1.02, mix: { pam: 6, quinn: 3, randy: 2, walkup: 1 } },
  { t: 240, rate: 5.0, minAlive: 65, hpMult: 2.1, speedMult: 1.02, mix: { pam: 5, quinn: 3, randy: 2, walkup: 1, phish: 1, jammer: 0.5 } },
  { t: 360, rate: 7.0, minAlive: 90, hpMult: 3.0, speedMult: 1.08, mix: { pam: 5, quinn: 3, randy: 2, walkup: 1.5, phish: 1, jammer: 1, steve: 1.5 } },
  { t: 480, rate: 9.0, minAlive: 120, hpMult: 4.2, speedMult: 1.08, mix: { pam: 4, quinn: 3, randy: 2.5, walkup: 1.5, phish: 1.2, jammer: 1, steve: 2, vip: 0.15 } },
  { t: 600, rate: 13, minAlive: 180, hpMult: 6.0, speedMult: 1.13, mix: { pam: 4, quinn: 3, randy: 3, walkup: 2, phish: 1.5, jammer: 1.5, steve: 2, vip: 0.3 } },
  { t: 780, rate: 17, minAlive: 250, hpMult: 8.0, speedMult: 1.13, mix: { pam: 4, quinn: 3, randy: 3, walkup: 2.5, phish: 2, jammer: 2, steve: 2.5, vip: 0.45 } },
  { t: 900, rate: 22, minAlive: 330, hpMult: 10.0, speedMult: 1.17, mix: { pam: 4, quinn: 4, randy: 3, walkup: 3, phish: 2, jammer: 2, steve: 3, vip: 0.6 } },
  { t: 1200, rate: 30, minAlive: 450, hpMult: 15.0, speedMult: 1.22, mix: { pam: 4, quinn: 4, randy: 3, walkup: 3, phish: 2.5, jammer: 2.5, steve: 3, vip: 0.8 } },
];

// Scripted events. A warning banner shows `warn` seconds before `t`.
//   ring   spawns `count` enemies in a ring closing in from every direction
//   storm  sends `waves` walls of `count` enemies marching across the screen at
//          `speed`, one wall every `gap` seconds, each from a random side
//   boss   spawns `boss` at the screen edge; `spawnScale` multiplies normal spawning
//          while it lives. The `final` boss ends the shift when it is defeated.
//          `mapBoss: true` marks the fight a map's own boss replaces (`boss` in data/maps.js).
export const EVENTS = [
  {
    t: 300, type: 'ring', warn: 4, count: 140, mix: { pam: 3, quinn: 1 },
    title: 'PATCH TUESDAY', text: 'Updates are being pushed to every machine. All of them. Now.',
  },
  {
    t: 600, type: 'boss', boss: 'incident', mapBoss: true, warn: 5, spawnScale: 0.6,
    title: 'MAJOR INCIDENT', text: 'Sev 1 declared. Everyone join the bridge. Now.',
  },
  {
    t: 900, type: 'storm', warn: 5, waves: 4, gap: 3, count: 70, speed: 92, mix: { pam: 3, quinn: 1 },
    title: 'MONDAY MORNING LOGIN STORM', text: 'Everyone forgot their password over the weekend.',
  },
  {
    t: 1200, type: 'boss', boss: 'executive', warn: 6, spawnScale: 0.25,
    title: 'THE EXECUTIVE IS HERE', text: 'Needs it fixed before the board meeting. The board meeting is now.',
  },
];

// The boss fight each map can swap for its own (the Major Incident unless a map has one).
export const MAP_BOSS_EVENT = EVENTS.find((e) => e.mapBoss);

export const SPAWNER = {
  maxEnemies: 1000, // hard cap on live enemies (pool size)
  ringPadding: 24, // spawn this far outside the visible screen edge
  recycleDistance: 1.6, // enemies further than this * screen half-diagonal get moved back near you
};
