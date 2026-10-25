// Meta progression: the save file, Overtime Pay, the shop, character unlocks and personal
// records. Ported from the original's src/game/meta.js. Differences: the simulation has no
// storage of its own, so the page hands in a `store` ({ load(), save(data) }; main.js
// keeps it in localStorage, tests in memory); there is no preview build that opens
// everything; and only maps that are built (MAPS_BUILT) can be picked or unlocked. A map
// that isn't built leaves whatever winning it unlocks (data/unlocks.js) open. Every map is
// built now, so the unlocks are earned as in the original.

import { SHOP, PAYOUT } from '../../data/meta.js';
import { CHARACTERS } from '../../data/player.js';
import { MAPS, MAP_ORDER } from '../../data/maps.js';
import { UNLOCKS } from '../../data/unlocks.js';
import { POLICIES, POLICY_ORDER } from '../../data/policies.js';
import { cleanPolicies } from './policies.js';

const PREVIEW = false;

// Maps whose floor and twist are ported.
export const MAPS_BUILT = ['office', 'server', 'callcenter', 'garage', 'merger'];

// A save that lasts as long as the page (headless runs and tests).
export const memoryStore = () => {
  let saved = null;
  return { load: () => saved, save: (d) => (saved = structuredClone(d)) };
};

// Save format version. When content is renamed or reshaped, bump it and add a step to
// MIGRATIONS: MIGRATIONS[n] turns a version-n save into version n+1 (saves from before
// versioning count as version 0). Every save, local or from the cloud, is upgraded on load.
export const SAVE_VERSION = 1;
const MIGRATIONS = [
  // 0 -> 1: nothing to convert; versioning starts here (the cleanup in upgradeSave runs).
  (d) => d,
];

function fresh() {
  return {
    version: SAVE_VERSION,
    pay: 0, // Overtime Pay balance
    earned: 0, // lifetime Overtime Pay
    shop: {}, // shop item id -> level bought
    unlocked: ['tier1'],
    selected: 'tier1',
    best: { time: 0, tickets: 0, csat: 0 },
    shifts: 0,
    wins: 0,
    map: 'office', // selected map
    mapsWon: [], // maps with at least one won shift (each unlocks the next)
    mapBest: {}, // map id -> { time, tickets, wins }
    policies: [], // Shift Policies picked for the next shift (data/policies.js)
    reorg: false, // those picks came from the dice button (and keep its bonus)
    policiesWon: [], // policies you've won a shift with (stamps in the wiki)
    policyUnlocks: [], // policies unlocked by a feat rather than a map win (Change Freeze)
    hardcore: false, // the Hardcore switch is on for the next shift (data/policies.js HARDCORE)
    hardcoreWon: [], // maps with a won Hardcore shift
  };
}

export class Meta {
  constructor(store = memoryStore()) {
    this.store = store;
    this.onSave = null; // for the cloud save (M13)
    let saved = null;
    try {
      saved = store.load();
    } catch {
      // No storage, or a corrupt save: start fresh.
    }
    this.replace(saved);
  }

  // Swaps in a whole save (from storage or the cloud), upgraded to this version.
  replace(saved, store = false) {
    this.data = upgradeSave(saved);
    if (!this.mapUnlocked(this.data.map)) this.data.map = 'office';
    if (store) this.save(false);
  }

  save(sync = true) {
    try {
      this.store.save(this.data);
    } catch {
      // Storage blocked; progress lasts for this page only.
    }
    if (sync) this.onSave?.();
  }

  // Total bonus for one stat from everything bought in the shop.
  bonus(stat) {
    let total = 0;
    for (const [id, lvl] of Object.entries(this.data.shop)) if (SHOP[id]?.stat === stat) total += SHOP[id].perLevel * lvl;
    return total;
  }

  level(id) {
    return this.data.shop[id] ?? 0;
  }

  // Cost of the next level of a shop item, or null when maxed.
  nextCost(id) {
    const c = SHOP[id].costs[this.level(id)];
    return c ?? null;
  }

  buy(id) {
    const cost = this.nextCost(id);
    if (cost === null || this.data.pay < cost) return false;
    this.data.pay -= cost;
    this.data.shop[id] = this.level(id) + 1;
    this.save();
    return true;
  }

  isUnlocked(charId) {
    return this.data.unlocked.includes(charId);
  }

  unlock(charId) {
    const cost = CHARACTERS[charId].cost;
    if (this.isUnlocked(charId) || this.data.pay < cost || !this.itemUnlocked('characters', charId)) return false;
    this.data.pay -= cost;
    this.data.unlocked.push(charId);
    this.data.selected = charId;
    this.save();
    return true;
  }

  select(charId) {
    if (!this.isUnlocked(charId)) return false;
    this.data.selected = charId;
    this.save();
    return true;
  }

  // The map whose win unlocks an item (data/unlocks.js), or null if it's always there.
  // kind: 'tools', 'passives', 'evolutions' or 'characters'.
  unlockedBy(kind, id) {
    for (const [map, u] of Object.entries(UNLOCKS)) if (u[kind]?.includes(id)) return map;
    return null;
  }

  // Can this tool / passive / evolution / character turn up (or be hired)? Preview builds
  // open everything; players keep what their wiki shows they've already used or hired.
  // `real` ignores the preview's open-everything rule.
  itemUnlocked(kind, id, real = false) {
    const map = this.unlockedBy(kind, id);
    if (!map || (PREVIEW && !real) || !MAPS_BUILT.includes(map) || this.data.mapsWon.includes(map)) return true;
    if (kind === 'characters') return this.data.unlocked.includes(id);
    const w = this.data.wiki;
    return !!w && (kind === 'passives' ? w.passives : w.tools).includes(id);
  }

  // Everything a map win adds, as { kind, id } (for the end-of-shift screen).
  unlocksFor(map) {
    return Object.entries(UNLOCKS[map] ?? {}).flatMap(([kind, ids]) => ids.map((id) => ({ kind, id })));
  }

  // Preview builds open every map, so a new one can be tried before it's earned.
  mapUnlocked(id) {
    const m = MAPS[id];
    return !!m && MAPS_BUILT.includes(id) && (PREVIEW || !m.unlockAfter || this.data.mapsWon.includes(m.unlockAfter));
  }

  selectMap(id) {
    if (!this.mapUnlocked(id)) return false;
    this.data.map = id;
    this.save();
    return true;
  }

  // --- Shift Policies (data/policies.js) ---
  // The Policies step shows up once you've finished a shift (and always in preview builds).
  policiesOpen() {
    return PREVIEW || this.data.shifts > 0;
  }

  // Can this policy be picked? `real` ignores the preview's open-everything rule.
  policyUnlocked(id, real = false) {
    const u = POLICIES[id]?.unlock;
    if (!POLICIES[id]) return false;
    if (!u || (PREVIEW && !real)) return true;
    if (MAPS[u]) return this.data.mapsWon.includes(u);
    return this.data.policyUnlocks.includes(id);
  }

  // Why a policy is locked, for its card.
  policyLockText(id) {
    const u = POLICIES[id].unlock;
    if (MAPS[u]) return `win a shift in the ${MAPS[u].name}`;
    if (u === 'noEvolveWin') return 'win a shift without evolving a tool';
    return 'not available yet';
  }

  // --- Hardcore (data/policies.js HARDCORE) ---
  // The switch shows up once you've won a shift on every map (always in preview builds).
  hardcoreOpen(real = false) {
    return (PREVIEW && !real) || MAP_ORDER.every((id) => this.data.mapsWon.includes(id));
  }

  // Is the next shift a Hardcore one?
  hardcoreOn() {
    return this.data.hardcore && this.hardcoreOpen();
  }

  setHardcore(on) {
    this.data.hardcore = !!on && this.hardcoreOpen();
    this.save();
  }

  setPolicies(ids, reorg = false) {
    this.data.policies = cleanPolicies(ids).filter((id) => this.policyUnlocked(id));
    this.data.reorg = reorg && this.data.policies.length > 0;
    this.save();
  }

  // Ends a shift on map `s.map`: pays out (with the map's pay bonus and the policies'
  // multiplier), updates records and unlocks. Returns { pay, records: [names of new
  // records], newMap: id or null, newUnlocks: [{ kind, id }] added by this map's first
  // win, newPolicies: [policy ids unlocked], policiesOpened: first shift done,
  // hardcoreOpened: this win opened Hardcore }.
  finishShift(s) {
    const map = MAPS[s.map] ?? MAPS.office;
    const pay = Math.floor(
      ((s.time / 60) * PAYOUT.perMinute + s.kills * PAYOUT.perKill + s.csat * PAYOUT.perCsat + (s.won ? PAYOUT.winBonus : 0)) * map.pay * (s.policyMult ?? 1) * (s.payMult ?? 1),
    );
    const d = this.data;
    const mb = (d.mapBest[s.map] ??= { time: 0, tickets: 0, wins: 0 });
    mb.time = Math.max(mb.time, s.time);
    mb.tickets = Math.max(mb.tickets, s.kills);
    let newMap = null;
    let newUnlocks = [];
    const lockedBefore = POLICY_ORDER.filter((id) => !this.policyUnlocked(id, true));
    const hardcoreBefore = this.hardcoreOpen(true);
    if (s.won) {
      mb.wins++;
      if (s.hardcore && !d.hardcoreWon.includes(s.map)) d.hardcoreWon.push(s.map);
      for (const id of s.policies ?? []) if (!d.policiesWon.includes(id)) d.policiesWon.push(id);
      if (!s.evolutions) for (const id of POLICY_ORDER) if (POLICIES[id].unlock === 'noEvolveWin' && !d.policyUnlocks.includes(id)) d.policyUnlocks.push(id);
      if (!d.mapsWon.includes(s.map)) {
        newUnlocks = this.unlocksFor(s.map).filter((u) => !this.itemUnlocked(u.kind, u.id, true));
        d.mapsWon.push(s.map);
        newMap = Object.keys(MAPS).find((id) => MAPS[id].unlockAfter === s.map && this.mapUnlocked(id)) ?? null;
      }
    }
    d.pay += pay;
    d.earned += pay;
    d.shifts++;
    if (s.won) d.wins++;
    const records = [];
    if (s.time > d.best.time) (d.best.time = s.time), records.push('time');
    if (s.kills > d.best.tickets) (d.best.tickets = s.kills), records.push('tickets');
    if (s.csat > d.best.csat) (d.best.csat = s.csat), records.push('csat');
    const newPolicies = lockedBefore.filter((id) => this.policyUnlocked(id, true));
    const policiesOpened = d.shifts === 1 && !PREVIEW; // the Policies step opens after the first shift
    const hardcoreOpened = !hardcoreBefore && this.hardcoreOpen(true);
    this.save();
    return { pay, records, newMap, newUnlocks, newPolicies, policiesOpened, hardcoreOpened };
  }

  // Debug: wipe the save.
  reset() {
    this.data = fresh();
    this.save();
  }
}

// Brings any save (missing, old, partial or hand-edited) up to SAVE_VERSION: runs the
// migrations, fills in missing fields, and drops ids this version of the game doesn't
// know, so screens never look up a tool, tech or map that no longer exists. A save from a
// newer build (an old copy of the app still running offline) is only filled in, never
// trimmed, so it doesn't lose things this build hasn't heard of yet.
export function upgradeSave(saved) {
  let d = saved && typeof saved === 'object' ? structuredClone(saved) : {};
  const from = Number.isInteger(d.version) ? d.version : 0;
  for (let v = from; v < SAVE_VERSION; v++) d = MIGRATIONS[v](d) ?? d;
  const base = fresh();
  d = Object.assign(base, d, { version: Math.max(from, SAVE_VERSION) });
  for (const k of ['pay', 'earned', 'shifts', 'wins']) if (!(d[k] >= 0)) d[k] = 0;
  d.best = Object.assign(fresh().best, isObj(d.best) ? d.best : {});
  if (!isObj(d.shop)) d.shop = {};
  if (!isObj(d.mapBest)) d.mapBest = {};
  if (!Array.isArray(d.unlocked)) d.unlocked = [];
  if (!Array.isArray(d.mapsWon)) d.mapsWon = [];
  for (const k of ['policiesWon', 'policyUnlocks', 'hardcoreWon']) if (!Array.isArray(d[k])) d[k] = [];
  d.hardcore = !!d.hardcore;
  d.policies = cleanPolicies(d.policies);
  d.reorg = !!d.reorg && d.policies.length > 0;
  if (from <= SAVE_VERSION) {
    d.unlocked = [...new Set(d.unlocked.filter((id) => CHARACTERS[id]))];
    d.mapsWon = [...new Set(d.mapsWon.filter((id) => MAPS[id]))];
    for (const id of Object.keys(d.shop)) {
      if (!SHOP[id] || !(d.shop[id] > 0)) delete d.shop[id];
      else d.shop[id] = Math.min(Math.floor(d.shop[id]), SHOP[id].costs.length);
    }
    for (const id of Object.keys(d.mapBest)) if (!MAPS[id]) delete d.mapBest[id];
    d.policiesWon = [...new Set(d.policiesWon.filter((id) => POLICIES[id]))];
    d.policyUnlocks = [...new Set(d.policyUnlocks.filter((id) => POLICIES[id]))];
    d.hardcoreWon = [...new Set(d.hardcoreWon.filter((id) => MAPS[id]))];
  }
  if (!d.unlocked.includes('tier1')) d.unlocked.unshift('tier1');
  for (const id of Object.keys(d.mapBest)) d.mapBest[id] = { time: 0, tickets: 0, wins: 0, ...(isObj(d.mapBest[id]) ? d.mapBest[id] : {}) };
  if (!CHARACTERS[d.selected] || !d.unlocked.includes(d.selected)) d.selected = 'tier1';
  if (!MAPS[d.map]) d.map = 'office';
  return d;
}

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
