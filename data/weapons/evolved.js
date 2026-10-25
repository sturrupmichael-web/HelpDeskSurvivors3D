// Copied unchanged from the original (HelpDeskSurvivor data/).
// Evolved tools (recipes in data/evolutions.js). One level each; never offered on
// level-up cards. Fields are explained in data/weapons.js.

export const EVOLVED = {
  // --- Evolutions (see data/evolutions.js). One level each; never offered on cards. ---
  fleetReboot: {
    name: 'Fleet-Wide Reboot', icon: 'power', behavior: 'pulse', evolved: true, from: 'reboot',
    tags: ['restart'], color: '#ffcd75', ringColors: ['#ffcd75', '#f4f4f4'], ringWidth: 5,
    desc: 'Every machine on the floor restarts at once. Huge, fast, stunning shockwaves.',
    flavor: 'Scheduled for 2 PM on a Tuesday. In the middle of the all-hands.',
    levels: [{ damage: 36, cooldown: 1.2, radius: 140, knockback: 260, speed: 460, stun: 0.3 }],
    notes: ['Evolved.'],
  },
  scheduledTasks: {
    name: 'Scheduled Task Army', icon: 'terminal', behavior: 'turret', sprite: 'turret_evo', boltSprite: 'proj_bolt_evo',
    evolved: true, from: 'powershell', tags: ['script'], color: '#38b764',
    desc: 'A swarm of green turrets, each firing three-way bursts.',
    flavor: 'Runs every minute. Nobody remembers who created it. Nobody dares delete it.',
    levels: [{ cooldown: 1.2, max: 8, duration: 9, fireRate: 0.28, damage: 20, range: 230, boltSpeed: 360, spread: 3 }],
    notes: ['Evolved.'],
  },
  zeroTrust: {
    name: 'Zero Trust Perimeter', icon: 'firewall', behavior: 'orbit', sprite: 'proj_firewall', evolved: true, from: 'firewall',
    tags: ['policy', 'security'], color: '#b13e53', rings: 2,
    desc: 'Two counter-rotating walls that never go down.',
    flavor: 'Never trust, always verify. Especially Randy.',
    levels: [{ damage: 30, count: 10, radius: 72, rotSpeed: 4.0, duration: Infinity, cooldown: 0, hitInterval: 0.3, knockback: 220 }],
    notes: ['Evolved.'],
  },
  autoTriage: {
    name: 'Automated Triage', icon: 'ticket', behavior: 'projectile', sprite: 'proj_ticket_gold', evolved: true, from: 'autoClose',
    tags: ['ticket'], color: '#ffcd75',
    desc: 'Golden tickets that pick separate targets, home in, and pierce.',
    flavor: 'The AI routes every ticket to the right queue. The right queue is yours.',
    levels: [{ damage: 32, cooldown: 0.6, count: 6, speed: 340, pierce: 4, life: 2.2, knockback: 60, homing: true, turn: 9 }],
    notes: ['Evolved.'],
  },
  fiberBackbone: {
    name: 'Fiber Backbone', icon: 'cable', behavior: 'whip', evolved: true, from: 'patchCable', tags: ['network'], bossDamage: 2.5, color: '#73eff7',
    desc: 'A fiber line whirls all the way around you, hitting everything in reach. Hits bosses extra hard.',
    flavor: 'Ten gigabits of pure spite.',
    levels: [{ damage: 32, cooldown: 0.85, range: 130, width: 30, sides: 2, knockback: 170, full: true }],
    notes: ['Evolved.'],
  },
  outsourcedTeam: {
    name: 'Outsourced Team', icon: 'delegate', behavior: 'minion', sprite: 'helper_evo', evolved: true, from: 'delegate', tags: ['people'], bossDamage: 2.5, color: '#ef7d57',
    desc: 'Five contractors in orange polos who close users fast and swarm bosses.',
    flavor: 'Follow-the-sun support. The sun is never where you need it.',
    levels: [{ count: 5, damage: 20, speed: 165, leash: 190, hitInterval: 0.28, knockback: 90 }],
    notes: ['Evolved.'],
  },
  espresso: {
    name: 'Espresso Machine', icon: 'mug', behavior: 'trail', evolved: true, from: 'coffeeRun', tags: ['coffee'], bossDamage: 2.5, color: '#3d2410',
    desc: 'Huge, scalding espresso spills that also slow users to a crawl. Bosses really feel it.',
    flavor: 'Somebody expensed a commercial machine. Nobody knows how to clean it.',
    levels: [{ damage: 16, tick: 0.35, radius: 32, life: 5.5, gap: 0.35, slow: 0.45 }],
    notes: ['Evolved.'],
  },

  // --- Evolutions added with ideas 41-46 ---
  confluence: {
    name: 'Confluence Space', icon: 'kb', behavior: 'boomerang', sprite: 'proj_kb', evolved: true, from: 'kbArticle', ring: true, curl: 2.4,
    tags: ['docs'], color: '#41a6f6',
    desc: 'Articles spiral out all the way round you and come back. Nobody reads any of them.',
    flavor: '312 pages, 4 owners (all left the company), last edited 2019.',
    levels: [{ damage: 30, cooldown: 2.2, count: 6, speed: 300, range: 200, knockback: 110 }],
    notes: ['Evolved.'],
  },
  passwordless: {
    name: 'Passwordless', icon: 'mfa', behavior: 'chain', evolved: true, from: 'mfa', sound: 'zap',
    tags: ['policy', 'security'], color: '#73eff7', colors: [['#73eff7', 6], ['#f4f4f4', 2]],
    desc: 'Three prompts at once that keep bouncing and never run out of targets. Long stuns.',
    flavor: 'No passwords to forget. Just a passkey on the phone you left in the car.',
    levels: [{ damage: 45, cooldown: 1.3, jumps: 12, jumpRange: 110, stun: 1.2, chains: 3 }],
    notes: ['Evolved.'],
  },
  domainLockdown: {
    name: 'Domain Lockdown', icon: 'policy', behavior: 'aura', evolved: true, from: 'groupPolicy', bossDamage: 2,
    tags: ['policy'], color: '#38b764',
    desc: 'A huge policy field. Users at its edge freeze solid.',
    flavor: 'USB ports disabled. Wallpapers locked. Fun disabled by GPO.',
    levels: [{ damage: 11, tick: 0.25, radius: 110, slow: 0.4, edge: 0.3, freeze: 0.6 }],
    notes: ['Evolved.'],
  },
  remoteWipe: {
    name: 'Remote Wipe', icon: 'rdp', behavior: 'homing', sprite: 'proj_rdp', evolved: true, from: 'rdp', vacuum: true,
    tags: ['remote'], color: '#b13e53',
    desc: 'A swarm of cursors that delete what they hit and send its Closed Ticket straight to you.',
    flavor: 'Lost device reported. The device was on the desk. The device is gone now.',
    levels: [{ damage: 60, cooldown: 0.9, count: 8, speed: 260, turn: 7, life: 3.8, pierce: 2 }],
    notes: ['Evolved.'],
  },
  sabbatical: {
    name: 'Sabbatical', icon: 'ooo', behavior: 'shield', sprite: 'proj_email', evolved: true, from: 'outOfOffice', bossDamage: 2.5,
    tags: ['email'], color: '#73eff7',
    desc: 'A huge bubble that is almost always up. Boss bullets go back to the sender.',
    flavor: '"I am on sabbatical until further notice. Your message has been returned to sender."',
    levels: [{ cooldown: 1.6, duration: 4.0, radius: 64, damage: 60, knockback: 380, reflect: 150 }],
    notes: ['Evolved.'],
  },
  siem: {
    name: 'SIEM', icon: 'radar', behavior: 'sweep', evolved: true, from: 'pingSweep', bossDamage: 2,
    tags: ['network', 'security'], color: '#ef7d57',
    desc: 'Two radar beams. Every user they pass gets flagged and takes extra damage from everything.',
    flavor: '40,000 alerts a day. One of them is real. Good luck.',
    levels: [{ damage: 26, range: 140, rotSpeed: 3.8, width: 0.7, hitInterval: 0.7, beams: 2, mark: 3, markAmp: 0.3 }],
    notes: ['Evolved.'],
  },

  // --- Evolutions for the job-title tools (idea 63) ---
  patchTuesday: {
    name: 'Patch Tuesday', icon: 'rollout', behavior: 'rollout', evolved: true, from: 'patchRollout', stunAll: true, bossDamage: 2,
    tags: ['restart'], color: '#38b764',
    desc: 'Five fast rings that reach right across the screen, and every one of them stuns.',
    flavor: 'Second Tuesday of the month. Nobody gets any work done. Including you.',
    // stunAll: every ring stuns, not just the last.
    levels: [{ damage: 20, cooldown: 2.6, radius: 300, gap: 0.3, rings: [0.2, 0.4, 0.6, 0.8, 1], stun: 0.8, knockback: 140, speed: 520 }],
    notes: ['Evolved.'],
  },
  goldenRecord: {
    name: 'Golden Record', icon: 'dedupe', behavior: 'cluster', evolved: true, from: 'dedupe', merge: 1.25,
    tags: ['data'], color: '#ffcd75',
    bonusVs: { dave: 2, dave2: 2, consultant: 2, consultant_b: 2 },
    desc: 'Merges two bunches at once. Each merged bunch drops one big ticket worth all of them, and a bit more.',
    flavor: 'One true record per customer. There are now four true records per customer.',
    // blasts: bunches hit per cast. merge: users it closes drop no tickets of their own;
    // each blast drops one ticket worth all of them times this.
    levels: [{ damage: 38, cooldown: 0.9, radius: 60, range: 260, crowdBonus: 0.22, crowdMax: 18, knockback: 60, blasts: 2 }],
    notes: ['Evolved.'],
  },
  nineteenthHole: {
    name: 'The 19th Hole', icon: 'frisbee', behavior: 'disc', sprite: 'proj_disc', evolved: true, from: 'fairwayDriver', aceDrop: 'gummies', bossDamage: 2,
    tags: ['sport'], color: '#ef7d57',
    desc: 'Discs ricochet from user to user. Every 5th throw adds a huge ace disc, and users it closes drop fruit gummies. At 80% sanity or more, every disc bounces once more.',
    flavor: 'Shot a 54. Ate a whole bag of gummies in the parking lot. Back for the 2:00.',
    // bounces: how many times a disc jumps to the next user. Every aceEvery-th throw adds
    // an ace (aceMult damage, aceBounces bounces). fullHp: the sanity share for +1 bounce.
    levels: [{ damage: 40, cooldown: 1.1, count: 3, speed: 300, life: 0.9, bounces: 4, bounceRange: 130, knockback: 60, aceEvery: 5, aceMult: 3, aceBounces: 8, fullHp: 0.8 }],
    notes: ['Evolved.'],
  },
  terraformDestroy: {
    name: 'Terraform Destroy', icon: 'terraform', behavior: 'grid', evolved: true, from: 'terraform', bossDamage: 2,
    tags: ['cloud'], color: '#7a4ea0',
    desc: 'A giant 9x9 grid that applies almost at once. The tiles stay live and keep hurting anyone on them.',
    flavor: 'Do you really want to destroy all resources? Only \'yes\' will be accepted. yes',
    // hitInterval: live tiles hit the same user again every this many seconds.
    levels: [{ damage: 26, cooldown: 2.2, size: 9, tile: 24, plan: 0.15, live: 1.2, hitInterval: 0.4, knockback: 40 }],
    notes: ['Evolved.'],
  },
  rfidInventory: {
    name: 'RFID Inventory', icon: 'barcode', behavior: 'projectile', sprite: 'proj_tag', evolved: true, from: 'assetTag',
    tags: ['data'], color: '#f4f4f4', tagXp: 3, tagMark: [4, 0.25],
    desc: 'Tags that stick and beep. Tagged users take 25% more damage from all your tools and drop triple tickets.',
    flavor: 'We can now locate every laptop in the building. Just not the one you need.',
    // tagMark: [seconds, extra damage] every user it hits is flagged for.
    levels: [{ damage: 30, cooldown: 0.75, count: 7, speed: 320, pierce: 4, life: 1.9, knockback: 35 }],
    notes: ['Evolved.'],
  },
};
