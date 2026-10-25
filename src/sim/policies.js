// Ported unchanged from the original's src/game/policies.js.

// Shift Policies (data/policies.js): combines the picked policies into one set of effects
// the rest of the game reads from `game.policy`, and works out the pay/score multiplier.

import { POLICIES, POLICY_RULES, HARDCORE } from '../../data/policies.js';

// Ids that still exist, in picking order, at most POLICY_RULES.maxPicked, without clashes.
export function cleanPolicies(ids) {
  const out = [];
  for (const id of Array.isArray(ids) ? ids : []) {
    if (!POLICIES[id] || out.includes(id) || out.length >= POLICY_RULES.maxPicked) continue;
    if (out.some((o) => clashes(o, id))) continue;
    out.push(id);
  }
  return out;
}

export const clashes = (a, b) => !!(POLICIES[a].excludes?.includes(b) || POLICIES[b].excludes?.includes(a));

// The pay and score multiplier for a set of policies (2 decimals). `reorg` adds the dice
// button's bonus.
export function policyMult(ids, reorg = false) {
  let m = reorg && ids.length ? POLICY_RULES.reorgBonus : 1;
  for (const id of ids) m *= POLICIES[id].mult;
  m = Math.min(POLICY_RULES.maxMult, Math.max(POLICY_RULES.minMult, m));
  return Math.round(m * 100) / 100;
}

// "x1.35" / "x0.8" for buttons and the HUD.
export const fmtMult = (m) => `x${m.toFixed(2).replace(/0$/, '').replace(/\.0$/, '')}`;

const NONE = Object.freeze({
  ids: Object.freeze([]), reorg: false, mult: 1,
  enemyHp: 1, enemySpeed: 1, bossHp: 1, phase2Sooner: 0,
  stats: Object.freeze({}), statMul: Object.freeze({}), regen: 0,
  maxWeapons: Infinity, maxPassives: Infinity, cards: 0, rareCards: 1, noEvolve: false,
  items: Object.freeze({}), lockPassives: Object.freeze([]), headStart: 0,
  mixBoost: Object.freeze({}), splits: Object.freeze({}), summons: Object.freeze({}),
  ticketXp: 1, ticketLife: 0, startTools: null, revives: 0,
  hardcore: false, spawns: 1, otGrace: null, noRevive: false, enemyDamage: 1,
});

// No policies: what the training shift and a plain shift use.
export const NO_POLICY = NONE;

// Perks can't be picked in a Hardcore shift.
export const hardcoreOk = (id) => POLICIES[id]?.group !== 'perk';

// The pay and score multiplier with or without Hardcore (2 decimals).
export const shiftMult = (ids, reorg = false, hardcore = false) =>
  Math.round(policyMult(ids, reorg) * (hardcore ? HARDCORE.mult : 1) * 100) / 100;

// One flat effects object for a set of policy ids, plus Hardcore (data/policies.js HARDCORE).
export function combinePolicies(ids, reorg = false, hardcore = false) {
  ids = cleanPolicies(ids);
  if (hardcore) ids = ids.filter(hardcoreOk);
  if (!ids.length && !hardcore) return NONE;
  const c = {
    ...NONE, ids, reorg: reorg && ids.length > 0, mult: shiftMult(ids, reorg, hardcore),
    stats: {}, statMul: {}, items: {}, lockPassives: [], mixBoost: {}, splits: {}, summons: {},
  };
  if (hardcore) {
    const f = HARDCORE.fx;
    Object.assign(c, { hardcore: true, spawns: f.spawns, otGrace: f.otGrace, noRevive: true });
    c.enemyHp *= f.enemyHp;
    c.enemyDamage *= f.enemyDamage;
    c.phase2Sooner += f.phase2Sooner;
    c.lockPassives.push(...f.lockPassives);
  }
  for (const id of ids) {
    const f = POLICIES[id].fx;
    for (const k of ['enemyHp', 'enemySpeed', 'bossHp', 'ticketXp']) if (f[k]) c[k] *= f[k];
    for (const k of ['phase2Sooner', 'regen', 'headStart', 'revives']) if (f[k]) c[k] += f[k];
    for (const k of ['maxWeapons', 'maxPassives']) if (f[k]) c[k] = Math.min(c[k], f[k]);
    if (f.cards) c.cards = c.cards ? Math.min(c.cards, f.cards) : f.cards;
    if (f.rareCards) c.rareCards *= f.rareCards;
    if (f.noEvolve) c.noEvolve = true;
    if (f.ticketLife) c.ticketLife = c.ticketLife ? Math.min(c.ticketLife, f.ticketLife) : f.ticketLife;
    for (const [k, v] of Object.entries(f.stats ?? {})) c.stats[k] = (c.stats[k] ?? 0) + v;
    for (const [k, v] of Object.entries(f.statMul ?? {})) c.statMul[k] = (c.statMul[k] ?? 1) * v;
    for (const [k, v] of Object.entries(f.items ?? {})) c.items[k] = (c.items[k] ?? 1) * v;
    for (const [k, v] of Object.entries(f.mixBoost ?? {})) c.mixBoost[k] = (c.mixBoost[k] ?? 1) * v;
    for (const [k, v] of Object.entries(f.splits ?? {})) c.splits[k] = (c.splits[k] ?? 0) + v;
    for (const [k, v] of Object.entries(f.summons ?? {})) c.summons[k] = (c.summons[k] ?? 0) + v;
    c.lockPassives.push(...(f.lockPassives ?? []));
    if (f.startTools) {
      const s = c.startTools ?? { random: 0, level: 1, starterLevel: 1, noNewTools: false };
      c.startTools = {
        random: s.random + f.startTools.random,
        level: Math.max(s.level, f.startTools.level ?? 1),
        starterLevel: Math.max(s.starterLevel, f.startTools.starterLevel ?? 1),
        noNewTools: s.noNewTools || !!f.startTools.noNewTools,
      };
    }
  }
  return c;
}

// The "dice" button: `count` random bad policies from the ones this save can pick.
export function rollReorg(available, rnd = Math.random) {
  const bad = available.filter((id) => POLICIES[id].group === 'bad');
  const out = [];
  while (out.length < POLICY_RULES.reorgCount && bad.length) {
    const id = bad.splice(Math.floor(rnd() * bad.length), 1)[0];
    if (!out.some((o) => clashes(o, id))) out.push(id);
  }
  return out;
}

// Policy ids as stored on a leaderboard row ("casualFriday,budgetCuts"; "reorg" marks the
// dice bonus, "hardcore" a Hardcore shift), and back.
export const modsString = (p) => [...p.ids, ...(p.reorg ? ['reorg'] : []), ...(p.hardcore ? ['hardcore'] : [])].join(',');
export const parseMods = (s) => String(s ?? '').split(',').filter((id) => POLICIES[id] || id === 'reorg' || id === 'hardcore');
