// Copied unchanged from the original (HelpDeskSurvivor data/).
// The job-title pack's tools (ideas 52-62). Fields are explained in data/weapons.js.

export const JOB_TITLE_TOOLS = {
  // --- Job-title pack (ideas 52-62): each new tech's starter. Unlocked for everyone's
  // level-up cards by a Merger Day win (data/unlocks.js). ---
  patchRollout: {
    name: 'Patch Rollout', icon: 'rollout', behavior: 'rollout', tags: ['restart'], weight: 9, color: '#38b764',
    desc: 'Pushes updates in deployment rings: a small pilot ring, a medium ring, then a huge broad ring that stuns.',
    flavor: 'Pilot group first. The pilot group is everyone.',
    // rings: radius of each wave as a share of `radius`; the last one stuns for `stun` s.
    levels: [
      { damage: 9, cooldown: 3.2, radius: 110, gap: 0.45, rings: [0.35, 0.65, 1], stun: 0.6, knockback: 90, speed: 300 },
      { damage: 11, cooldown: 3.2, radius: 115, gap: 0.45, rings: [0.35, 0.65, 1], stun: 0.6, knockback: 90, speed: 300 },
      { damage: 11, cooldown: 3.0, radius: 125, gap: 0.42, rings: [0.35, 0.65, 1], stun: 0.7, knockback: 100, speed: 320 },
      { damage: 14, cooldown: 2.9, radius: 130, gap: 0.42, rings: [0.35, 0.65, 1], stun: 0.7, knockback: 100, speed: 320 },
      { damage: 14, cooldown: 2.7, radius: 140, gap: 0.4, rings: [0.3, 0.55, 0.8, 1], stun: 0.8, knockback: 110, speed: 340 },
      { damage: 17, cooldown: 2.6, radius: 145, gap: 0.4, rings: [0.3, 0.55, 0.8, 1], stun: 0.8, knockback: 110, speed: 340 },
      { damage: 20, cooldown: 2.4, radius: 155, gap: 0.38, rings: [0.3, 0.55, 0.8, 1], stun: 0.9, knockback: 120, speed: 360 },
      { damage: 25, cooldown: 2.2, radius: 170, gap: 0.35, rings: [0.25, 0.45, 0.65, 0.85, 1], stun: 1.0, knockback: 130, speed: 380 },
    ],
    notes: ['Deployment rings: pilot, medium, broad (stuns).', '+2 damage, wider.', 'Wider, more often, longer stun.', '+3 damage, wider.', 'A fourth ring. Wider, more often.', '+3 damage, wider.', '+3 damage, more often, longer stun.', 'Zero-day rollout: five rings, +5 damage, huge.'],
  },
  dedupe: {
    name: 'Dedupe', icon: 'dedupe', behavior: 'cluster', tags: ['data'], weight: 9, color: '#ffcd75',
    desc: 'Finds the most bunched-up users near you and merges them out of existence. The bigger the bunch, the harder it hits. Double damage to Duplicate Dave and the Synergy Consultants.',
    flavor: 'Merged 3 records into 1. The 1 is wrong.',
    bonusVs: { dave: 2, dave2: 2, consultant: 2, consultant_b: 2 }, // damage multipliers by user sprite id
    // crowdBonus: extra damage per other user in the blast (up to crowdMax of them).
    levels: [
      { damage: 10, cooldown: 1.8, radius: 34, range: 170, crowdBonus: 0.12, crowdMax: 8, knockback: 30 },
      { damage: 13, cooldown: 1.8, radius: 34, range: 170, crowdBonus: 0.12, crowdMax: 8, knockback: 30 },
      { damage: 13, cooldown: 1.6, radius: 38, range: 180, crowdBonus: 0.14, crowdMax: 10, knockback: 30 },
      { damage: 16, cooldown: 1.6, radius: 38, range: 180, crowdBonus: 0.14, crowdMax: 10, knockback: 35 },
      { damage: 16, cooldown: 1.4, radius: 42, range: 190, crowdBonus: 0.16, crowdMax: 12, knockback: 35 },
      { damage: 20, cooldown: 1.3, radius: 44, range: 200, crowdBonus: 0.16, crowdMax: 12, knockback: 40 },
      { damage: 24, cooldown: 1.2, radius: 46, range: 210, crowdBonus: 0.18, crowdMax: 14, knockback: 40 },
      { damage: 30, cooldown: 1.0, radius: 52, range: 230, crowdBonus: 0.2, crowdMax: 16, knockback: 50 },
    ],
    notes: ['Blasts the biggest bunch of users near you.', '+3 damage.', 'Bigger blast, faster, bunches count more.', '+3 damage.', 'Bigger, faster, bunches count more.', '+4 damage, faster.', '+4 damage, bigger.', 'Master data: +6 damage, much faster and bigger.'],
  },
  fairwayDriver: {
    name: 'Fairway Driver', icon: 'frisbee', behavior: 'boomerang', sprite: 'proj_disc', tags: ['sport'], weight: 9, color: '#ef7d57',
    curlAlt: true, // every other disc bends the other way, so they fan out in two arcs
    desc: 'Throws disc golf discs that curve out in a wide arc and come back around, hitting everything on the way.',
    flavor: 'Calls it a team-building offsite. It is just him, on a Tuesday.',
    // curl: how hard each disc bends (rad/s).
    levels: [
      { damage: 13, cooldown: 1.7, count: 1, speed: 230, range: 120, knockback: 50, curl: 1.65 },
      { damage: 17, cooldown: 1.7, count: 1, speed: 230, range: 125, knockback: 50, curl: 1.65 },
      { damage: 17, cooldown: 1.6, count: 2, speed: 240, range: 130, knockback: 55, curl: 1.65 },
      { damage: 20, cooldown: 1.5, count: 2, speed: 240, range: 135, knockback: 55, curl: 1.58 },
      { damage: 20, cooldown: 1.4, count: 3, speed: 250, range: 145, knockback: 60, curl: 1.58 },
      { damage: 25, cooldown: 1.35, count: 3, speed: 260, range: 150, knockback: 60, curl: 1.5 },
      { damage: 30, cooldown: 1.25, count: 4, speed: 270, range: 160, knockback: 65, curl: 1.5 },
      { damage: 37, cooldown: 1.1, count: 5, speed: 280, range: 175, knockback: 70, curl: 1.42 },
    ],
    notes: ['Throws a disc that arcs out and comes back.', '+4 damage, longer throw.', 'A second disc, curving the other way.', '+3 damage.', 'A third disc, longer throw.', '+5 damage, faster.', '+5 damage, a fourth disc.', 'Ace: +7 damage, five discs, longest throw.'],
  },
  terraform: {
    name: 'Terraform Apply', icon: 'terraform', behavior: 'grid', tags: ['cloud'], weight: 9, color: '#7a4ea0',
    desc: 'Plans a square grid of tiles around you. After a short plan step, every tile goes live and hits the users standing on it.',
    flavor: 'Plan: 3 to add, 0 to change, 47 to destroy.',
    // A size x size grid of tile-px tiles, planned `plan` s before it applies; tiles stay
    // live for `live` s and hit each user once.
    levels: [
      { damage: 16, cooldown: 2.6, size: 3, tile: 22, plan: 0.7, live: 0.35, knockback: 40 },
      { damage: 20, cooldown: 2.6, size: 3, tile: 22, plan: 0.7, live: 0.35, knockback: 40 },
      { damage: 20, cooldown: 2.4, size: 4, tile: 22, plan: 0.65, live: 0.4, knockback: 45 },
      { damage: 25, cooldown: 2.3, size: 4, tile: 23, plan: 0.65, live: 0.4, knockback: 45 },
      { damage: 25, cooldown: 2.1, size: 5, tile: 23, plan: 0.6, live: 0.45, knockback: 50 },
      { damage: 31, cooldown: 2.0, size: 5, tile: 24, plan: 0.6, live: 0.45, knockback: 50 },
      { damage: 37, cooldown: 1.8, size: 6, tile: 24, plan: 0.55, live: 0.5, knockback: 55 },
      { damage: 46, cooldown: 1.6, size: 7, tile: 24, plan: 0.5, live: 0.5, knockback: 60 },
    ],
    notes: ['Plans a 3x3 grid around you, then applies it.', '+4 damage.', '4x4 grid, more often.', '+5 damage, bigger tiles.', '5x5 grid, faster plans.', '+6 damage, bigger tiles.', '6x6 grid, +6 damage.', 'terraform apply -auto-approve: 7x7 grid, +9 damage, much faster.'],
  },
  assetTag: {
    name: 'Asset Tag', icon: 'barcode', behavior: 'projectile', sprite: 'proj_tag', tags: ['data'], weight: 9, color: '#f4f4f4',
    tagXp: 2, // users it hits drop this many times the usual Closed Ticket
    desc: 'Throws barcode stickers at users. Tagged users drop double tickets when you close them.',
    flavor: 'Property of IT. Do not remove. (It was removed.)',
    levels: [
      { damage: 8, cooldown: 1.3, count: 2, speed: 250, pierce: 0, life: 1.5, knockback: 20 },
      { damage: 10, cooldown: 1.3, count: 2, speed: 250, pierce: 0, life: 1.5, knockback: 20 },
      { damage: 10, cooldown: 1.2, count: 3, speed: 260, pierce: 1, life: 1.5, knockback: 20 },
      { damage: 13, cooldown: 1.2, count: 3, speed: 260, pierce: 1, life: 1.6, knockback: 25 },
      { damage: 13, cooldown: 1.1, count: 4, speed: 270, pierce: 1, life: 1.6, knockback: 25 },
      { damage: 16, cooldown: 1.0, count: 4, speed: 280, pierce: 2, life: 1.7, knockback: 30 },
      { damage: 19, cooldown: 0.95, count: 5, speed: 290, pierce: 2, life: 1.7, knockback: 30 },
      { damage: 24, cooldown: 0.85, count: 6, speed: 300, pierce: 3, life: 1.8, knockback: 35 },
    ],
    notes: ['Tags users: they drop double tickets.', '+2 damage.', '+1 sticker, stickers pierce 1 user.', '+3 damage.', '+1 sticker, faster.', '+3 damage, pierce 2.', '+3 damage, +1 sticker.', 'Full audit: +5 damage, +1 sticker, pierce 3, faster.'],
  },
};
