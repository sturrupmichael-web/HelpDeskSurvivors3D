// Copied unchanged from the original (HelpDeskSurvivor data/).
// Playable characters and the XP curve.
// Speeds are in world pixels per second (one world pixel = one sprite pixel).

// `cost` is the Overtime Pay needed to unlock (0 = available from the start).
// `bonus` adds to the stat multipliers passives use (see BALANCE.md, "Player power"),
// e.g. { damage: 0.1 } = +10% damage, { damageTaken: -0.1 } = 10% less damage taken.
//
// Perks: optional fields a tech can have on top of the usual stats. Each one is read in
// one place, listed here; tests/data.test.mjs fails on a field that isn't in TECH_PERKS,
// so a misspelled perk can't silently do nothing.
//   summonBonus      + damage for turrets and helpers (src/game/player.js summonDamage)
//   extraCount       + shots / shields / helpers on every tool (player.js, the weapons)
//   crew             built-in helpers { count, damage, perLevel } (Game.newRun, createCrew)
//   toolSlots        extra tool slots (player.js maxWeapons)
//   alsoStarts       more starting tools, by id (Game.newRun)
//   payMult          x Overtime Pay (Game.endRun)
//   chestBonus       + upgrades in every Change Approved chest (upgrades.js openChest)
//   hurtBy           x sanity lost to a user, by user sprite (enemies.js resolveEnemies)
//   damagePerMinute  + damage for every minute of the shift (player.js updatePlayer)
//   auraArea         + area for aura tools (weapons/aura.js)
//   slowedAmp        + damage to slowed users (enemies.js damageEnemy)
//   cardWeights      x chance a tool is offered on level-up, by id (upgrades.js rollChoices)
//   cooldownFor      x cooldown of one tool, by id (weapons/nuke.js)
//   bonusVs          x damage against a user, by user sprite (enemies.js damageEnemy)
//   phishTest        floor perk { every, stun } (src/game/perks.js)
//   boxEvery         floor perk: seconds between moving boxes (src/game/perks.js)
export const TECH_PERKS = [
  'summonBonus', 'extraCount', 'crew', 'toolSlots', 'alsoStarts', 'payMult', 'chestBonus', 'hurtBy',
  'damagePerMinute', 'auraArea', 'slowedAmp', 'cardWeights', 'cooldownFor', 'bonusVs', 'phishTest', 'boxEvery',
];

export const CHARACTERS = {
  tier1: {
    name: 'Tier 1 Tech',
    sprite: 'player_tier1',
    starter: 'reboot', // weapon id from data/weapons.js
    maxHp: 100, // "Sanity"
    speed: 74,
    radius: 7, // collision radius
    pickupRadius: 36, // Closed Tickets inside this radius fly to you
    regen: 0, // sanity per second
    cost: 0,
    bonus: {},
    perk: 'No perks. No excuses.',
    blurb: 'Fresh headset, full sanity. Answers every call with a smile. For now.',
  },
  desktop: {
    name: 'Desktop Support',
    sprite: 'player_desktop',
    starter: 'kbArticle',
    maxHp: 90,
    speed: 84,
    radius: 7,
    pickupRadius: 46,
    regen: 0,
    cost: 300,
    bonus: {},
    perk: 'Fastest on the floor, bigger pickup radius, a little less sanity.',
    blurb: 'Has walked every floor of this building. Twice. Today.',
  },
  sysadmin: {
    name: 'SysAdmin',
    sprite: 'player_sysadmin',
    starter: 'powershell',
    maxHp: 120,
    speed: 66,
    radius: 7,
    pickupRadius: 36,
    regen: 0,
    cost: 700,
    bonus: { damage: 0.1, cooldown: -0.05 },
    perk: '+10% damage, 5% faster cooldowns, more sanity, slow walker.',
    blurb: 'Automated their job in 2019. Nobody noticed. Still here.',
  },
  secops: {
    name: 'SecOps Analyst',
    sprite: 'player_secops',
    starter: 'firewall',
    maxHp: 100,
    speed: 74,
    radius: 7,
    pickupRadius: 36,
    regen: 0.5,
    cost: 1200,
    bonus: { damageTaken: -0.1 },
    perk: 'Regenerates 0.5 sanity per second and takes 10% less damage.',
    blurb: 'Trusts no one. Especially that email from "the CEO".',
  },
  neteng: {
    name: 'Network Engineer',
    sprite: 'player_neteng',
    starter: 'patchCable',
    maxHp: 100,
    speed: 74,
    radius: 7,
    pickupRadius: 36,
    regen: 0,
    cost: 1500,
    bonus: { area: 0.15 },
    perk: '+15% area on every tool.',
    blurb: 'Knows where every cable goes. Will not tell you.',
  },
  manager: {
    name: 'Help Desk Manager',
    sprite: 'player_manager',
    starter: 'delegate',
    maxHp: 110,
    speed: 67,
    radius: 7,
    pickupRadius: 36,
    regen: 0,
    cost: 2000,
    summonBonus: 0.25,
    bonus: {},
    perk: 'Helpers and turrets do +25% damage. Walks 10% slower.',
    blurb: 'Has a meeting about the meeting. Their team does the actual work.',
  },
  intern: {
    name: 'The Intern',
    sprite: 'player_intern',
    starter: 'coffeeRun',
    maxHp: 70,
    speed: 78,
    radius: 7,
    pickupRadius: 36,
    regen: 0,
    cost: 200,
    bonus: { growth: 0.3 },
    perk: '+30% XP, but only 70 sanity. Hard mode.',
    blurb: 'First week. Already has admin rights somehow.',
  },
  cloud: {
    name: 'Cloud Architect',
    sprite: 'player_cloud',
    starter: 'autoScaling',
    maxHp: 90,
    speed: 74,
    radius: 7,
    pickupRadius: 36,
    regen: 0,
    cost: 3000,
    extraCount: 1,
    bonus: {},
    perk: '+1 projectile, shield or helper on every tool. 10% less sanity.',
    blurb: 'Moved the whole company to the cloud. The cloud is down.',
  },

  // --- Job-title pack (ideas 52-62) ---
  supervisor: {
    name: 'Help Desk Supervisor',
    sprite: 'player_supervisor',
    starter: 'autoClose',
    maxHp: 100,
    speed: 74,
    radius: 7,
    pickupRadius: 36,
    regen: 0,
    cost: 1800,
    bonus: { damage: -0.15 },
    // Two interns who follow you all shift (no tool slot); +5% damage per level you reach.
    crew: { count: 2, damage: 10, perLevel: 0.05 },
    perk: 'Two interns follow you from the start and get 5% stronger every level. Your own tools do 15% less damage.',
    blurb: 'Reassigns your ticket to you, then asks for an update.',
  },
  sysops: {
    name: 'Systems Operations Manager',
    sprite: 'player_sysops',
    starter: 'patchRollout',
    maxHp: 85,
    speed: 74,
    radius: 7,
    pickupRadius: 36,
    regen: 0,
    cost: 2500,
    toolSlots: 1, // extra tool slots
    bonus: {},
    perk: 'One extra tool slot. Only 85 sanity.',
    blurb: 'Owns every laptop in the building. Has personally touched none.',
  },
  director: {
    name: 'IT Director',
    sprite: 'player_director',
    starter: 'outOfOffice',
    alsoStarts: ['delegate'], // extra starting tools: his direct reports do the actual work
    maxHp: 110,
    speed: 70,
    radius: 7,
    pickupRadius: 36,
    regen: 0,
    cost: 4000,
    payMult: 1.25, // Overtime Pay multiplier
    chestBonus: 1, // extra upgrades in every Change Approved chest that doesn't evolve
    bonus: { growth: -0.15 },
    perk: 'Also starts with Delegate. +25% Overtime Pay and one extra item in every chest. 15% less XP (always in meetings).',
    blurb: 'Approved the budget. Wants to know where it all went.',
  },
  crmAnalyst: {
    name: 'CRM Analyst',
    sprite: 'player_crmanalyst',
    starter: 'dedupe',
    maxHp: 90,
    speed: 74,
    radius: 7,
    pickupRadius: 36,
    regen: 0,
    cost: 1200,
    bonus: { luck: 0.2 },
    perk: '+20% luck. Only 90 sanity.',
    blurb: 'Found 4,000 copies of the same customer. All named Dave.',
  },
  crmManager: {
    name: 'CRM Manager',
    sprite: 'player_crmmanager',
    starter: 'fairwayDriver',
    maxHp: 100,
    speed: 74,
    radius: 7,
    pickupRadius: 36,
    regen: 0,
    cost: 2000,
    hurtBy: { walkup: 1.25 }, // contact damage multipliers, by user sprite id
    bonus: { area: 0.1 },
    perk: '+10% area. Ticket-less Walk-Ups hurt 25% more.',
    blurb: 'Calls it a team-building offsite. It is just him.',
  },
  cloudEng: {
    name: 'Cloud Engineer',
    sprite: 'player_cloudeng',
    starter: 'terraform',
    maxHp: 100,
    speed: 74,
    radius: 7,
    pickupRadius: 36,
    regen: 0,
    cost: 2200,
    damagePerMinute: 0.02, // +2% damage for every full minute of the shift
    bonus: { damage: -0.15 },
    perk: 'Scales with load: +2% damage every minute of the shift, but starts at 15% less.',
    blurb: "Keeps the Architect's diagram actually running. At 3 a.m.",
  },
  syseng: {
    name: 'Systems Engineer',
    sprite: 'player_syseng',
    starter: 'groupPolicy',
    maxHp: 105,
    speed: 67,
    radius: 7,
    pickupRadius: 36,
    regen: 0,
    cost: 1600,
    auraArea: 0.2, // extra area on aura tools (Group Policy Push, Domain Lockdown)
    slowedAmp: 0.1, // slowed users take this much extra damage
    bonus: {},
    perk: 'Auras are 20% bigger and slowed users take 10% more damage. Walks 10% slower.',
    blurb: "Wrote the GPO that broke printing in 2021. Won't talk about it.",
  },
  euc: {
    name: 'EUC Engineer',
    sprite: 'player_euc',
    starter: 'rdp',
    maxHp: 90,
    speed: 74,
    radius: 7,
    pickupRadius: 36,
    regen: 0,
    cost: 1400,
    cardWeights: { reimage: 3 }, // level-up card weight multipliers, by tool id
    cooldownFor: { reimage: 0.75 }, // cooldown multipliers, by tool id
    bonus: {},
    perk: 'Reimage shows up 3x as often and recharges 25% faster. Only 90 sanity.',
    blurb: 'Built the golden image. Rebuilds it every Patch Tuesday.',
  },
  secmgr: {
    name: 'Security Manager',
    sprite: 'player_secmgr',
    starter: 'passwordExpired',
    maxHp: 105,
    speed: 68,
    radius: 7,
    pickupRadius: 36,
    regen: 0,
    cost: 2500,
    phishTest: { every: 60, stun: 1 }, // freezes every user on screen
    bonus: {},
    perk: 'Every 60 seconds a phishing test freezes every user on screen for a second. Walks 8% slower.',
    blurb: 'Sends the fake phishing emails. Knows exactly who clicked.',
  },
  seceng: {
    name: 'Security Engineer',
    sprite: 'player_seceng',
    starter: 'pingSweep',
    maxHp: 100,
    speed: 74,
    radius: 7,
    pickupRadius: 36,
    regen: 0,
    cost: 1800,
    bonusVs: { phish: 2, malware: 2 }, // damage multipliers against these users (sprite ids)
    bonus: { pickupRadius: -0.1 },
    perk: 'Phish Clickers and Malware take double damage. 10% smaller pickup radius.',
    blurb: 'Patched it before you reported it, and logged that you reported it late.',
  },
  assets: {
    name: 'Asset Management Analyst',
    sprite: 'player_assets',
    starter: 'assetTag',
    maxHp: 100,
    speed: 74,
    radius: 7,
    pickupRadius: 36,
    regen: 0,
    cost: 1000,
    boxEvery: 45, // seconds between Unclaimed Moving Boxes turning up near you, on any map
    bonus: { damage: -0.1 },
    perk: 'An Unclaimed Moving Box (always has something inside) turns up near you every 45 seconds, on any map. 10% less damage.',
    blurb: "Knows where all 3,412 laptops are. Except the CEO's.",
  },
};

// XP needed to go from level L to L+1 is: first + (L - 1) * step,
// where step comes from the first band whose `upTo` is >= L.
export const XP_CURVE = {
  first: 5,
  bands: [
    { upTo: 20, step: 14 },
    { upTo: 40, step: 30 },
    { upTo: Infinity, step: 70 },
  ],
};


// Comebacks from burnout (sanity 0), claimed in this order while their counter on the
// player is above 0: back at half sanity, 3 s untouchable, nearby users shoved away, and
// this banner. Counters are set in src/game/player.js createPlayer (and the Extended
// Warranty card in src/game/upgrades.js).
export const COMEBACKS = [
  { counter: 'warranty', title: 'WARRANTY CLAIM APPROVED', text: 'Covered under your Extended Warranty. Back at half sanity.' }, // passive
  { counter: 'longWeekend', title: 'LONG WEEKEND', text: 'You remembered Friday is off. Back at half sanity.' }, // Shift Policy
  { counter: 'revives', title: 'UNION REP INTERVENED', text: 'Mandatory 15-minute break. You are back, at half sanity.' }, // shop
];
