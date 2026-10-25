// Copied unchanged from the original (HelpDeskSurvivor data/).
// Achievements. `check(r, meta)` returns true once earned; it is evaluated about once a
// second during a shift and again when a shift ends. `r` is the current run's tracker
// (see src/game/achievements.js), `meta` the save data (src/game/meta.js).

import { CHARACTERS } from './player.js';
import { POLICIES } from './policies.js';
import { MAP_ORDER } from './maps.js';

export const ACHIEVEMENTS = [
  { id: 'first_shift', name: 'Onboarding Complete', icon: 'ticket', desc: 'Finish your first shift, one way or another.', check: (r) => r.ended },
  { id: 'speedrun', name: 'Rage Quit', icon: 'power', desc: 'Burn out in under a minute.', check: (r) => r.ended && !r.won && r.time < 60 },
  { id: 'patch', name: 'Fully Patched', icon: 'disc', desc: 'Survive past Patch Tuesday (5:30).', check: (r) => r.time >= 330 },
  { id: 'tickets_1k', name: 'Queue Buster', icon: 'filter', desc: 'Close 1,000 tickets in one shift.', check: (r) => r.kills >= 1000 },
  { id: 'tickets_10k', name: 'Ticket Machine', icon: 'terminal', desc: 'Close 10,000 tickets in one shift.', check: (r) => r.kills >= 10000 },
  { id: 'streak', name: 'Customer Obsessed', icon: 'cert', desc: 'Reach the maximum CSAT streak multiplier.', check: (r) => r.maxMult >= 5 },
  { id: 'evolve', name: 'Digital Transformation', icon: 'key', desc: 'Evolve a tool.', check: (r) => r.evolutions >= 1 },
  { id: 'evolve_all', name: 'Fully Automated', icon: 'policy', desc: 'Evolve all four tools in one shift.', check: (r) => r.evolutions >= 4 },
  { id: 'incident', name: 'Incident Commander', icon: 'mfa', desc: 'Resolve the Major Incident.', check: (r) => r.bosses.includes('incident') },
  { id: 'win', name: 'Clocked Out', icon: 'firewall', desc: "Close The Executive's ticket.", check: (r) => r.won },
  { id: 'win_flawless', name: 'Zen Mode', icon: 'headphones', desc: 'Win a shift without ever dropping below half sanity.', check: (r) => r.won && r.minHpFrac >= 0.5 },
  { id: 'overtime', name: 'Unpaid Overtime', icon: 'coffee', desc: 'Still be on the clock at 21:00.', check: (r) => r.time >= 1260 },
  { id: 'pizza', name: 'Pizza Party', icon: 'pizza', desc: 'Eat 5 slices of vendor-lunch pizza in one shift.', check: (r) => r.pizzas >= 5 },
  { id: 'steve', name: 'Shadow IT Audit', icon: 'rdp', desc: 'Close 100 Shadow IT Steves in one shift.', check: (r) => (r.killsById.steve ?? 0) >= 100 },
  { id: 'union', name: 'Solidarity', icon: 'union', desc: 'Get rescued by your Union Rep.', check: (r) => r.revived },
  { id: 'hired_all', name: 'Full Headcount', icon: 'monitor', desc: 'Hire every character.', check: (r, m) => m.unlocked.length >= Object.keys(CHARACTERS).length },
  { id: 'shopper', name: 'Expense Report', icon: 'laptop', desc: 'Buy 15 shop upgrades.', check: (r, m) => Object.values(m.shop).reduce((a, b) => a + b, 0) >= 15 },
  { id: 'boss_ratsnest', name: 'Cable Management', icon: 'cable', desc: "Untangle the Rat's Nest in the Server Room.", check: (r) => r.bosses?.includes('ratsnest') },
  { id: 'boss_caller', name: 'Customer Satisfied', icon: 'headphones', desc: 'Resolve the Angry Caller in the Call Center.', check: (r) => r.bosses?.includes('caller') },
  { id: 'boss_janitor', name: 'Clean Sweep', icon: 'mug', desc: 'Outlast the Night Janitor in the Parking Garage.', check: (r) => r.bosses?.includes('janitor') },
  { id: 'boss_takeover', name: 'Due Diligence', icon: 'cert', desc: 'Close the Hostile Takeover (and its Subsidiary) on Merger Day.', check: (r) => r.bosses?.includes('takeover') },
  { id: 'map_server', name: 'Cold Aisle Containment', icon: 'ssd', desc: 'Win a shift in the Server Room.', check: (r, m) => m.mapsWon?.includes('server') },
  { id: 'map_call', name: 'First Call Resolution', icon: 'headphones', desc: 'Win a shift in the Call Center.', check: (r, m) => m.mapsWon?.includes('callcenter') },
  { id: 'map_garage', name: 'Night Owl', icon: 'key', desc: 'Win the Night Shift in the Parking Garage.', check: (r, m) => m.mapsWon?.includes('garage') },
  { id: 'map_merger', name: 'Synergy Achieved', icon: 'laptop', desc: 'Win a shift on Merger Day.', check: (r, m) => m.mapsWon?.includes('merger') },
  { id: 'red_tape', name: 'Red Tape', icon: 'book', desc: 'Win a shift under 3 bad Shift Policies.', check: (r) => r.won && r.policies.filter((id) => POLICIES[id].group === 'bad').length >= 3 },
  { id: 'lean_team', name: 'Doing More With Less', icon: 'scissors', desc: 'Win a shift under Budget Cuts and Hiring Freeze.', check: (r) => r.won && r.policies.includes('budgetCuts') && r.policies.includes('hiringFreeze') },
  { id: 'hardcore_win', name: 'No Comebacks', icon: 'hardcore', desc: 'Win a Hardcore shift.', check: (r) => r.won && r.hardcore },
  { id: 'hardcore_all', name: 'Iron Helpdesk', icon: 'hardcore', desc: 'Win a Hardcore shift on every map.', check: (r, m) => MAP_ORDER.every((id) => m.hardcoreWon?.includes(id)) },
  { id: 'veteran', name: 'Employee of the Month', icon: 'chair', desc: 'Work 25 shifts.', check: (r, m) => m.shifts >= 25 },
];
