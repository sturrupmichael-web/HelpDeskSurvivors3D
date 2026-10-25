// Copied unchanged from the original (HelpDeskSurvivor data/).
// Meta progression: Overtime Pay earned per shift, and the shop it is spent in.
// Everything is saved in the browser (localStorage) by src/game/meta.js.

// Overtime Pay for one shift:
//   perMinute × minutes survived + perKill × tickets closed + perCsat × CSAT,
//   + winBonus if you closed The Executive's ticket.
export const PAYOUT = {
  perMinute: 12,
  perKill: 0.01,
  perCsat: 0.002,
  winBonus: 300,
};

// Permanent upgrades. Each level adds `perLevel` to `stat`; `costs[i]` buys level i+1.
// Stats: the passive multipliers (moveSpeed, attackSpeed, area, damage, growth,
// damageTaken, cooldown, pickupRadius), plus maxHp (flat sanity), regen (sanity/s),
// rerolls (level-up rerolls per shift) and revives (comebacks per shift).
export const SHOP = {
  chair: {
    name: 'Ergonomic Chair', icon: 'chair', stat: 'maxHp', perLevel: 10, costs: [60, 120, 200, 320, 480],
    desc: '+10 max sanity per level.', flavor: 'Lumbar support is self-care.',
  },
  laptop: {
    name: 'Laptop Refresh', icon: 'laptop', stat: 'damage', perLevel: 0.05, costs: [80, 160, 260, 400, 600],
    desc: '+5% damage per level.', flavor: 'Finally, a machine from this decade.',
  },
  sneakers: {
    name: 'Comfy Sneakers', icon: 'shoe', stat: 'moveSpeed', perLevel: 0.04, costs: [70, 140, 230, 350],
    desc: '+4% move speed per level.', flavor: 'Dress code says "business casual". These are casual.',
  },
  ssd: {
    name: 'SSD Upgrade', icon: 'ssd', stat: 'cooldown', perLevel: -0.03, costs: [90, 180, 300, 450, 650],
    desc: '3% faster cooldowns per level.', flavor: 'Boots before you finish saying "it is loading".',
  },
  notifications: {
    name: 'Ticket Notifications', icon: 'bell', stat: 'pickupRadius', perLevel: 0.1, costs: [50, 100, 170, 260],
    desc: '+10% pickup radius per level.', flavor: 'Ding. Ding. Ding. Ding.',
  },
  training: {
    name: 'Training Budget', icon: 'cert', stat: 'growth', perLevel: 0.05, costs: [80, 160, 260, 400, 600],
    desc: '+5% XP per level.', flavor: 'Approved! (Expires end of fiscal year. Which was yesterday.)',
  },
  plant: {
    name: 'Desk Plant', icon: 'plant', stat: 'regen', perLevel: 0.15, costs: [120, 260, 450],
    desc: '+0.15 sanity per second per level.', flavor: 'Its name is Gerald. Gerald listens.',
  },
  escalation: {
    name: 'Escalation Path', icon: 'escalate', stat: 'rerolls', perLevel: 1, costs: [150, 350, 600],
    desc: '+1 level-up reroll per shift.', flavor: '"Let me check with my lead."',
  },
  union: {
    name: 'Union Rep', icon: 'union', stat: 'revives', perLevel: 1, costs: [900],
    desc: 'Once per shift, come back from BURNOUT at half sanity.', flavor: 'Mandatory 15-minute break. In writing.',
  },
};
