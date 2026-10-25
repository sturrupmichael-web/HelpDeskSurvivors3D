// Copied unchanged from the original (HelpDeskSurvivor data/).
// Closed Tickets (XP gems). A dropped ticket uses the highest tier its value reaches.
export const TICKET_TIERS = [
  { sprite: 'ticket_blue', minValue: 1 },
  { sprite: 'ticket_green', minValue: 5 },
  { sprite: 'ticket_gold', minValue: 25 },
];

export const TICKETS = {
  maxOnFloor: 1200, // when full, the farthest ticket is moved to the new drop and takes its XP
  magnetSpeed: 60, // starting speed when a ticket flies toward you
  magnetAccel: 700, // px/s^2 while flying
  collectRadius: 10,
};

// Other floor pickups. `chance` is per enemy closed (bosses/elites use `drops` in
// data/enemies.js instead); `maps` limits random drops to those maps. Touch them to collect.
// What a pickup does is its list of `effects` (src/game/pickups.js ITEM_EFFECTS):
//   heal         + `heal` sanity
//   boost        move speed x`speed` for `time` seconds
//   invulnerable no damage for `invulnerable` seconds
//   bulkClose    every ticket on the floor flies to you
//   chest        opens the Change Approved screen
// plus how it looks and sounds: `sound`, `burst` [colors, count] of particles at you,
// `ring` [radius, color, seconds, filled], and `tally` (an achievement counter to bump).
// On the floor: `glow` pulses a circle of that color under it, and `edgeArrow` points to it
// from the screen edge while it is off screen.
export const ITEMS = {
  pizza: { sprite: 'pizza', chance: 0.004, heal: 30, label: '+30 SANITY', effects: ['heal'], sound: 'heal', burst: [['#38b764', '#f4f4f4'], 10], tally: 'pizzas' },
  bulk_close: { sprite: 'bulk_close', chance: 0.0012, label: 'BULK CLOSE!', effects: ['bulkClose'], sound: 'bulk', ring: [120, '#41a6f6', 0.5, false] },
  // Merger Day only (`maps`): sanity plus a short speed boost.
  swag_bag: {
    sprite: 'swag_bag', chance: 0.0025, maps: ['merger'], heal: 20, speed: 1.3, time: 6, label: 'WELCOME SWAG!',
    effects: ['heal', 'boost'], sound: 'heal', burst: [['#34488f', '#ffcd75', '#f4f4f4'], 12],
  },
  pto: { sprite: 'pto', chance: 0.0006, invulnerable: 6, label: 'OUT OF OFFICE', glow: '#41a6f6', effects: ['invulnerable'], sound: 'pto', ring: [40, '#41a6f6', 0.5, true] },
  // The 19th Hole only: its ace disc drops these (chance 0, never at random).
  gummies: { sprite: 'gummies', chance: 0, heal: 8, label: '+8 SANITY', effects: ['heal'], sound: 'heal', burst: [['#b13e53', '#38b764', '#ffcd75', '#ef7d57'], 8] },
  chest: { sprite: 'chest', chance: 0, label: 'CHANGE APPROVED', glow: '#ffcd75', edgeArrow: true, effects: ['chest'] },
};

// Change Approved chest without an evolution available: how many upgrades it grants.
export const CHEST_REWARDS = [
  { upgrades: 1, weight: 75 },
  { upgrades: 3, weight: 25 },
];

export const ITEM_PICKUP_RADIUS = 14; // touch distance for non-ticket pickups
export const MAX_ITEMS = 40;
