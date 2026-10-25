// Copied unchanged from the original (HelpDeskSurvivor data/).
// CSAT (customer satisfaction) score. Every closed ticket earns points; quick
// successive closures build a streak that multiplies the points.
export const CSAT = {
  pointsPerKill: 1,
  streakWindow: 1.5, // seconds without a kill before the streak resets
  killsPerTier: 25, // every N kills in a streak adds +1 to the multiplier
  maxMultiplier: 5,
  resetOnHit: true, // taking sanity damage breaks the streak
  // Ticket combos: reaching one of these streak lengths pops "RESOLVED xN!" over your tech
  // and pays a one-off bonus of N x comboBonus CSAT (times the current multiplier).
  // After the last one, every further `comboEvery` closes counts as another milestone,
  // paying the same bonus as the last one.
  comboMilestones: [10, 25, 50, 100, 250, 500, 1000],
  comboEvery: 1000,
  comboBonus: 0.5,
};
