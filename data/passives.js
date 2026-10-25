// Copied unchanged from the original (HelpDeskSurvivor data/).
// Passive items. Each level adds `perLevel` to the stat multiplier:
//   final multiplier = 1 + perLevel * level   (negative perLevel reduces the stat)
// Stats: moveSpeed, attackSpeed, area, damage, growth (XP gain), damageTaken,
//        cooldown, pickupRadius, maxHp, luck (item drops, rarer cards, bigger chests).
// `add` instead adds perLevel * level to a flat player number: extraCount (extra
// projectiles, shields, helpers, traps and ducks on every tool) or regen (sanity/s).
// `revives` grants that many comebacks from burnout when picked.

export const PASSIVES = {
  coldBrew: {
    name: 'Cold Brew', icon: 'coffee', stat: 'moveSpeed', perLevel: 0.08, maxLevel: 5, weight: 8,
    desc: '+8% move speed per level.',
    flavor: 'Iced. Black. Third one today.',
  },
  mechKeyboard: {
    name: 'Mechanical Keyboard', icon: 'keyboard', stat: 'attackSpeed', perLevel: 0.1, maxLevel: 5, weight: 8,
    desc: '+10% attack speed: shockwaves and projectiles travel faster.',
    flavor: 'Clicky switches. Your cubicle neighbours love it.',
  },
  secondMonitor: {
    name: 'Second Monitor', icon: 'monitor', stat: 'area', perLevel: 0.1, maxLevel: 5, weight: 8,
    desc: '+10% area per level.',
    flavor: 'One for the queue, one for the other queue.',
  },
  domainAdmin: {
    name: 'Domain Admin Rights', icon: 'key', stat: 'damage', perLevel: 0.1, maxLevel: 5, weight: 8,
    desc: '+10% damage per level.',
    flavor: 'With great power comes a very long audit log.',
  },
  itil: {
    name: 'ITIL Certification', icon: 'cert', stat: 'growth', perLevel: 0.1, maxLevel: 5, weight: 8,
    desc: '+10% XP from Closed Tickets per level.',
    flavor: 'You now know there is a process for that. There is always a process.',
  },
  headphones: {
    name: 'Noise-Cancelling Headphones', icon: 'headphones', stat: 'damageTaken', perLevel: -0.07, maxLevel: 5, weight: 8,
    desc: '-7% sanity loss per level.',
    flavor: 'Sorry, can\'t hear you. Please submit a ticket.',
  },
  runbook: {
    name: 'Runbook', icon: 'book', stat: 'cooldown', perLevel: -0.07, maxLevel: 5, weight: 8,
    desc: '-7% weapon cooldowns per level.',
    flavor: 'Step 1: Don\'t panic. Step 2: See step 1.',
  },
  queueFilter: {
    name: 'Ticket Queue Filter', icon: 'filter', stat: 'pickupRadius', perLevel: 0.25, maxLevel: 5, weight: 8,
    desc: '+25% pickup radius per level.',
    flavor: 'Auto-sorts the urgent from the "urgent".',
  },
  standingDesk: {
    name: 'Standing Desk', icon: 'desk', stat: 'maxHp', perLevel: 0.1, maxLevel: 5, weight: 8,
    desc: '+10% max sanity per level.',
    flavor: 'Raised to "standing" once. Has been at "sitting" ever since.',
  },

  // --- Added with ideas 37-40 ---
  spareCharger: {
    name: 'Spare Charger', icon: 'charger', add: 'extraCount', perLevel: 1, maxLevel: 2, weight: 5,
    desc: '+1 projectile, shield, intern, zip tie or duck on every tool that uses them, per level.',
    flavor: 'USB-C. Found in a drawer. Belongs to nobody. Now it belongs to you.',
  },
  warranty: {
    name: 'Extended Warranty', icon: 'warranty', revives: 1, maxLevel: 1, weight: 5,
    desc: 'Once per shift, a burnout is covered: you come back at half sanity.',
    flavor: 'Covers accidental damage, water damage and emotional damage. Excludes Mondays.',
  },
  snackDrawer: {
    name: 'Snack Drawer', icon: 'snack', add: 'regen', perLevel: 0.25, maxLevel: 5, weight: 7,
    desc: '+0.25 sanity per second per level.',
    flavor: 'Bottom left drawer. Granola bars, emergency chocolate, one fossilised mint.',
  },
  luckyLanyard: {
    name: 'Lucky Lanyard', icon: 'lanyard', stat: 'luck', perLevel: 0.2, maxLevel: 5, weight: 7,
    desc: '+20% luck per level: more pizza, PTO and Bulk Close drops, rarer level-up cards, bigger chests.',
    flavor: 'From the 2014 vendor conference. Has never once been washed. Do not wash it.',
  },
};

// Offered when every slot is full and everything is maxed.
export const FALLBACK_REWARDS = {
  pizza: {
    name: 'Leftover Vendor-Lunch Pizza', icon: 'pizza', heal: 30, desc: 'Restore 30 sanity.',
    flavor: 'Cold, slightly mysterious, absolutely free.',
  },
};

export const MAX_WEAPONS = 6;
export const MAX_PASSIVES = 6;
// Cards offered per level-up. 4 since the tool list grew from 9 to 15, so each tool
// still turns up about as often as it did with 3 cards.
export const LEVEL_UP_CHOICES = 4;
