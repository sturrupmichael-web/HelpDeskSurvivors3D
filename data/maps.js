// Copied unchanged from the original (HelpDeskSurvivor data/).
// Office maps. Pick one on the title screen (Map button, L). Each map unlocks once you
// win a shift (close The Executive's ticket) on the map listed in `unlockAfter`.
//   floor       floor style drawn by src/game/floor.js
//   pay         multiplier on Overtime Pay earned on this map
//   hpMult      extra multiplier on enemy HP (on top of data/waves.js)
//   speedMult   extra multiplier on enemy speed
//   mixBoost    multiplies spawn weights per enemy id (see the `mix` in data/waves.js)
//   music       remix of the background track: transpose (semitones), tempo (x), lead
//               (oscillator type), cutoff (lead filter Hz)
//   boss        replaces the Major Incident at 10:00: `boss` enemy id (data/enemies.js)
//               plus the warning banner's `title` and `text`
//   twist       the map's special rule, handled in src/game/maps.js:
//               hotAisles  red strips on the floor: drain `drain` sanity/s, +`speed` move speed
//               phones     every `every` s a desk phone rings near you and goes off after
//                          `delay` s for `damage` (+`damagePerMin` per minute) in `radius`
//               dark       you only see `radius` px around you (`flicker` = light wobble)
//               integration the parent company's (navy) floor spreads: it owns `start` of
//                          the floor at 0:00, `+step` every `every` s, up to `max`. Users who spawn
//                          on it get x`hpMult` HP and drop x`xpMult` tickets when closed
//                          there. Every `boxEvery` s an Unclaimed Moving Box appears nearby
//                          (at most `boxMax` at once).
//   solid       the furniture is solid (cubicles, server racks, call-center pods, parked
//               cars and pillars, Merger Day benches; see src/game/floor.js): nobody walks through them
//               (users go round the end, bosses barge through), boss bullets stop at them,
//               pickups never land in them
//   newUsers   map-only users added to the spawn mix from `from` seconds on, each at
//              `share` of the timeline mix's total weight (list them in `from` order)

export const MAPS = {
  office: {
    name: 'Open Office',
    floor: 'office',
    unlockAfter: null,
    blurb: 'Cubicles, a water cooler and 847 unread tickets. Where every career starts.',
    twistText: 'Solid cubicles: nobody walks through them. Users have to go round, and boss shots stop at them.',
    pay: 1,
    hpMult: 0.9,
    speedMult: 1,
    solid: true,
    mixBoost: {},
    music: { transpose: 0, tempo: 1, lead: 'square', cutoff: 1400 },
  },
  server: {
    name: 'Server Room',
    floor: 'server',
    unlockAfter: 'office',
    blurb: 'Raised floor, roaring fans and racks nobody has labeled since 2014.',
    twistText: 'Hot aisles drain sanity but make you faster. Rack rows are solid. More Shadow IT and phishers.',
    pay: 1.25,
    hpMult: 1.1,
    speedMult: 1,
    solid: true,
    mixBoost: { steve: 1.6, phish: 1.6 },
    music: { transpose: -3, tempo: 1.06, lead: 'sawtooth', cutoff: 1100 },
    twist: { type: 'hotAisles', drain: 2, speed: 0.3 },
    boss: { boss: 'ratsnest', title: "THE RAT'S NEST", text: 'Someone opened the cable tray under rack 14. It opened back.' },
  },
  callcenter: {
    name: 'Call Center',
    floor: 'callcenter',
    unlockAfter: 'server',
    blurb: 'Headsets on. The queue never empties and the wallboard is always red.',
    twistText: 'All lines busy: desk phones go off around you. The pod rows are solid and the aisles narrow. Reply-All storms everywhere.',
    pay: 1.25,
    hpMult: 1.15,
    speedMult: 1,
    solid: true,
    mixBoost: { randy: 2, walkup: 1.4 },
    music: { transpose: 2, tempo: 1.1, lead: 'square', cutoff: 2000 },
    twist: { type: 'phones', every: 4.5, delay: 1.4, radius: 50, damage: 8, damagePerMin: 1.2 },
    boss: { boss: 'caller', title: 'THE ANGRY CALLER', text: 'Line 1 has been on hold for forty minutes. Line 1 is coming to you.' },
  },
  garage: {
    name: 'Night Shift: Parking Garage',
    floor: 'garage',
    unlockAfter: 'callcenter',
    blurb: "3 a.m. on-call. The exec's laptop won't connect and he is in the car.",
    twistText: 'Lights out: you only see what your phone flashlight shows. Parked cars and pillars are solid. Users are 10% faster.',
    pay: 1.5,
    hpMult: 1.15,
    speedMult: 1.1,
    solid: true,
    mixBoost: { phish: 1.3, vip: 1.5 },
    music: { transpose: -5, tempo: 0.92, lead: 'triangle', cutoff: 900 },
    twist: { type: 'dark', radius: 190, flicker: 0.06 },
    boss: { boss: 'janitor', title: 'THE NIGHT JANITOR', text: "You're walking on his clean floor." },
  },
  merger: {
    name: 'Merger Day',
    floor: 'merger',
    unlockAfter: 'garage',
    blurb: "Congratulations, you've been acquired! Two logos, two badge systems, two ticketing systems.",
    twistText: 'The new parent company takes more of the floor every minute. On their navy floor users are tougher but drop double tickets. Cubicles and benches are solid.',
    pay: 1.5,
    hpMult: 1.2,
    speedMult: 1.06,
    solid: true,
    mixBoost: { vip: 1.4 },
    newUsers: {
      dave: { from: 45, share: 0.1 },
      consultant: { from: 150, share: 0.05 },
      brenda: { from: 240, share: 0.06 },
    },
    music: { transpose: 5, tempo: 1.04, lead: 'sine', cutoff: 2200 },
    twist: { type: 'integration', start: 0.3, step: 0.035, every: 60, max: 0.92, hpMult: 1.2, xpMult: 2, boxEvery: 20, boxMax: 3 },
    boss: { boss: 'takeover', title: 'THE HOSTILE TAKEOVER', text: "The new CEO is touring the floor. Everything he touches becomes his." },
  },
};

export const MAP_ORDER = ['office', 'server', 'callcenter', 'garage', 'merger'];
