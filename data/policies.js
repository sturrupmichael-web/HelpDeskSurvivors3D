// Copied unchanged from the original (HelpDeskSurvivor data/).
// Shift Policies (idea 25): optional twists picked in the Clock In picker, after the tech
// and the map (src/ui/screens/shiftSetup.js). Bad ones make the shift harder, perks make
// it easier, mixed ones change how it plays. Every policy has a `mult`: the ones you pick
// multiply together (clamped to POLICY_RULES) and that multiplier is applied to Overtime
// Pay and to your leaderboard score (CSAT x multiplier).
//
//   group    'bad' | 'mixed' | 'perk' (the row it sits in on the picker)
//   unlock   null = there from the start; a map id = win a shift there; 'noEvolveWin' =
//            win a shift without evolving a tool (checked in Meta.finishShift)
//   excludes ids that can't be picked together with this one
//   fx       what it does, combined by src/game/policies.js:
//     enemyHp, enemySpeed   multiply regular users' HP / speed (bosses keep theirs)
//     bossHp                multiplies boss HP
//     phase2Sooner          bosses get angry this much sooner (added to phase2.at)
//     stats                 added to the player's stat multipliers (like the shop)
//     statMul               multiplies a stat after passives (damageTaken, maxHp)
//     regen                 sanity per second, added (negative drains)
//     maxWeapons/maxPassives  fewer slots (the smallest wins)
//     cards, rareCards      level-up cards shown, and how much rarer cards are favoured
//     noEvolve              chests never evolve a tool
//     items                 multiplies random drop chances per pickup id (0 = never)
//     lockPassives          passives that are never offered
//     headStart             seconds: the queue starts as busy as it is at this time
//     mixBoost              multiplies spawn weights per user id (like a map's mixBoost)
//     splits, summons       extra users from onDeath splits / summoners, per user id
//     ticketXp, ticketLife  multiply ticket XP; tickets vanish after this many seconds
//     startTools            { random: n, level, starterLevel, noNewTools }
//     revives               extra comebacks from burnout (Long Weekend)

export const POLICY_RULES = {
  maxPicked: 3,
  minMult: 0.5,
  maxMult: 3,
  reorgBonus: 1.1, // the dice button: 2 random bad policies, +10% while you keep them
  reorgCount: 2,
};

export const POLICIES = {
  // --- Bad: harder, more pay -----------------------------------------------------------
  casualFriday: {
    name: 'Casual Friday', icon: 'shoe', group: 'bad', mult: 1.3, unlock: null,
    desc: 'Users move 25% faster. You get +10% move speed.',
    flavor: 'Jeans day. Everyone is in a great mood and in a great hurry.',
    fx: { enemySpeed: 1.25, stats: { moveSpeed: 0.1 } },
  },
  budgetCuts: {
    name: 'Budget Cuts', icon: 'scissors', group: 'bad', mult: 1.35, unlock: null,
    desc: '4 tool slots instead of 6.',
    flavor: 'Finance has reviewed your toolkit and found it "aspirational".',
    fx: { maxWeapons: 4 },
  },
  hiringFreeze: {
    name: 'Hiring Freeze', icon: 'freeze', group: 'bad', mult: 1.25, unlock: 'server',
    desc: '3 passive slots instead of 6.',
    flavor: 'No new headcount. No new chairs. No new anything.',
    fx: { maxPassives: 3 },
  },
  mandatoryFun: {
    name: 'Mandatory Fun', icon: 'cert', group: 'bad', mult: 1.3, unlock: 'office',
    desc: 'Users have 40% more HP.',
    flavor: 'Team-building was this morning. Everyone is hyped and nobody is leaving.',
    fx: { enemyHp: 1.4 },
  },
  mondayMorning: {
    name: 'Monday Morning', icon: 'mug', group: 'bad', mult: 1.2, unlock: 'callcenter',
    desc: 'The queue starts as busy as it normally is at 3:00.',
    flavor: 'The whole weekend\'s tickets, all at 8:01.',
    fx: { headStart: 180 },
  },
  legacyHardware: {
    name: 'Legacy Hardware', icon: 'ssd', group: 'bad', mult: 1.25, unlock: 'office',
    desc: 'Tool cooldowns are 20% longer.',
    flavor: 'Your laptop was refreshed in 2011. It remembers.',
    fx: { stats: { cooldown: 0.2 } },
  },
  noPizza: {
    name: 'No Pizza Policy', icon: 'pizza', group: 'bad', mult: 1.2, unlock: 'office', excludes: ['teamLunch'],
    desc: 'No pizza drops, and Snack Drawer is never offered.',
    flavor: 'After The Incident, food is banned from the floor.',
    fx: { items: { pizza: 0 }, lockPassives: ['snackDrawer'] },
  },
  changeFreeze: {
    name: 'Change Freeze', icon: 'freeze', group: 'bad', mult: 1.4, unlock: 'noEvolveWin',
    desc: 'Change Approved chests never evolve a tool. They still give upgrades.',
    flavor: 'Nothing goes to production until after the holidays. Which holidays? Yes.',
    fx: { noEvolve: true },
  },
  auditWeek: {
    name: 'Audit Week', icon: 'book', group: 'bad', mult: 1.4, unlock: 'callcenter',
    desc: 'Every hit costs double sanity.',
    flavor: 'The auditors are on the floor. Every mistake is a finding.',
    fx: { statMul: { damageTaken: 2 } },
  },
  replyAllDay: {
    name: 'Reply-All Day', icon: 'email', group: 'bad', mult: 1.2, unlock: 'server',
    desc: '3x Reply-All Randys, and each one splits into 5 instead of 3.',
    flavor: 'Someone emailed the whole company. Then someone replied.',
    fx: { mixBoost: { randy: 3 }, splits: { randy: 2 } },
  },
  phishingSim: {
    name: 'Phishing Simulation', icon: 'password', group: 'bad', mult: 1.2, unlock: 'server',
    desc: '3x Phish Clickers, and each one sends out 3 Malware instead of 2.',
    flavor: 'Security sent a fake phishing email. 80% clicked. Then a real one arrived.',
    fx: { mixBoost: { phish: 3 }, summons: { phish: 1 } },
  },
  escalated: {
    name: 'Escalated', icon: 'escalate', group: 'bad', mult: 1.35, unlock: 'garage',
    desc: 'Bosses have 50% more HP and get angry a quarter of their health sooner.',
    flavor: 'Every ticket today is a P1. Leadership is cc\'d on all of them.',
    fx: { bossHp: 1.5, phase2Sooner: 0.25 },
  },

  // --- Mixed ---------------------------------------------------------------------------
  overtimeApproved: {
    name: 'Overtime Approved', icon: 'coffee', group: 'mixed', mult: 1.1, unlock: 'office',
    desc: '+25% XP, but users have 20% more HP.',
    flavor: 'Time and a half. The users heard and are staying late too.',
    fx: { stats: { growth: 0.25 }, enemyHp: 1.2 },
  },
  glassDesk: {
    name: 'Glass Desk', icon: 'desk', group: 'mixed', mult: 1.15, unlock: 'server',
    desc: '+30% damage, but 40% less max sanity.',
    flavor: 'The new open-plan desks look amazing. Everyone can see your screen.',
    fx: { stats: { damage: 0.3 }, statMul: { maxHp: 0.6 } },
  },
  energyDrinks: {
    name: 'Energy Drinks', icon: 'charger', group: 'mixed', mult: 1.1, unlock: 'callcenter',
    desc: '+25% move and attack speed, but you lose 0.5 sanity a second.',
    flavor: 'Four cans before stand-up. You can hear colours.',
    fx: { stats: { moveSpeed: 0.25, attackSpeed: 0.25 }, regen: -0.5 },
  },
  hotDesking: {
    name: 'Hot Desking', icon: 'monitor', group: 'mixed', mult: 1.1, unlock: 'garage',
    desc: 'Level-ups show 2 cards instead of 4, but rare ones turn up far more often.',
    flavor: 'No assigned seats. Grab whatever desk is free. It\'s always the weird one.',
    fx: { cards: 2, rareCards: 4 },
  },
  vendorLockIn: {
    name: 'Vendor Lock-In', icon: 'key', group: 'mixed', mult: 1.3, unlock: 'garage',
    desc: 'Start with your starter and one random tool, both at level 3. No new tools all shift.',
    flavor: 'The contract is for five years. The exit clause is in Latin.',
    fx: { startTools: { random: 1, level: 3, starterLevel: 3, noNewTools: true } },
  },
  ticketBlitz: {
    name: 'Ticket Blitz', icon: 'ticket', group: 'mixed', mult: 1.1, unlock: 'callcenter',
    desc: 'Tickets are worth 1.5x XP, but vanish after 10 seconds on the floor.',
    flavor: 'SLA breach in 10... 9... 8...',
    fx: { ticketXp: 1.5, ticketLife: 10 },
  },

  // --- Perks: easier, less pay ---------------------------------------------------------
  workFromHome: {
    name: 'Work From Home', icon: 'laptop', group: 'perk', mult: 0.8, unlock: null,
    desc: 'Users are 15% slower.',
    flavor: 'Half the office is "on a call". The other half is on mute.',
    fx: { enemySpeed: 0.85 },
  },
  teamLunch: {
    name: 'Team Lunch', icon: 'pizza', group: 'perk', mult: 0.85, unlock: null, excludes: ['noPizza'],
    desc: '3x pizza drops.',
    flavor: 'The vendor is buying. The vendor wants a meeting.',
    fx: { items: { pizza: 3 } },
  },
  onboardingBuddy: {
    name: 'Onboarding Buddy', icon: 'delegate', group: 'perk', mult: 0.8, unlock: 'server',
    desc: 'Start with a second, random tool.',
    flavor: 'Kevin has been here nine years. Kevin will show you where everything is.',
    fx: { startTools: { random: 1, level: 1 } },
  },
  longWeekend: {
    name: 'Long Weekend', icon: 'ooo', group: 'perk', mult: 0.75, unlock: 'callcenter',
    desc: 'One free comeback from burnout, at half sanity.',
    flavor: 'Friday off. Just get through today. Just get through today.',
    fx: { revives: 1 },
  },
  coffeeMachine: {
    name: 'New Coffee Machine', icon: 'coffee', group: 'perk', mult: 0.85, unlock: 'office',
    desc: 'Tool cooldowns are 15% shorter.',
    flavor: 'Bean to cup. Eleven settings. A small queue that never moves.',
    fx: { stats: { cooldown: -0.15 } },
  },
};

export const POLICY_GROUPS = [
  { id: 'bad', name: 'Bad policies', note: 'Harder. More pay and score.' },
  { id: 'mixed', name: 'Mixed', note: 'Changes how you play.' },
  { id: 'perk', name: 'Perks', note: 'Easier. Less pay and score.' },
];

// The order they're listed in (picker, wiki, numbers players use).
export const POLICY_ORDER = Object.keys(POLICIES);

// Hardcore (idea 6): a switch on the Clock In map step, there once you've won a shift on
// every map. It stacks with bad and mixed policies (its `mult` multiplies theirs, beyond
// POLICY_RULES.maxMult) but not with perks. Applied by combinePolicies (src/game/policies.js).
//   spawns        multiplies how many users come and how many stay on the floor
//   enemyHp       multiplies regular users' HP
//   enemyDamage   multiplies regular users' contact damage
//   phase2Sooner  bosses get angry this much sooner (added to phase2.at)
//   otGrace       seconds of overtime before it starts ramping up (normally OVERTIME.grace)
//   lockPassives  passives that are never offered (Extended Warranty: no comebacks)
// Union Rep (shop) doesn't work in Hardcore either.
export const HARDCORE = {
  name: 'Hardcore', mult: 2,
  desc: '50% more users with 30% more HP who hit 10% harder, bosses get angry sooner, overtime gets harder after 2 minutes, and no comebacks from burnout. Perks are off. Double pay and score.',
  fx: { spawns: 1.5, enemyHp: 1.3, enemyDamage: 1.1, phase2Sooner: 0.15, otGrace: 120, lockPassives: ['warranty'] },
};
