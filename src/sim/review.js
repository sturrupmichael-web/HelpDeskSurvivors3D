// Ported from the original's src/game/review.js; the only change is a local fmtTime.
// End-of-shift HR performance review: an overall rating, three manager's comments and a
// goal for next quarter, all worked out from the shift's stats. Text in data/review.js.

import { RATINGS, MANAGERS, COMMENTS, GOALS, BOSS_NAMES } from '../../data/review.js';
import { MAPS } from '../../data/maps.js';
import { MAP_BOSS_EVENT } from '../../data/waves.js';
import { POLICIES } from '../../data/policies.js';

// The HUD's clock format (src/ui/hud.js fmtTime); the simulation doesn't import the UI.
const fmtTime = (t) => {
  const s = Math.floor(t);
  return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
};
const pick = (list, rnd) => list[Math.floor(rnd() * list.length)];
const fill = (text, c) => text.replace(/\{(\w+)\}/g, (m, k) => (c[k] === undefined ? m : String(c[k])));

// s: stats from Game.endRun. run: achievements.run. rnd: random source (tests pass a fixed one).
export function performanceReview(s, run, rnd = Math.random) {
  const rating = RATINGS.find((r) => r.when(s, run));
  const totalDamage = s.tools.reduce((n, t) => n + t.damage, 0);
  const top = s.tools[0];
  const mapBoss = MAPS[s.map]?.boss?.boss ?? MAP_BOSS_EVENT.boss;
  const beaten = run.bosses.filter((id) => BOSS_NAMES[id] && id !== 'executive');
  const dodged = run.bossesMet.filter((id) => BOSS_NAMES[id] && id !== 'executive' && !run.bosses.includes(id));
  const k = run.killsById;
  const pol = (s.policies ?? []).filter((id) => POLICIES[id]);
  const perks = pol.filter((id) => POLICIES[id].group === 'perk');
  const c = {
    has: (id) => pol.includes(id), // a Shift Policy was on
    badCount: pol.filter((id) => POLICIES[id].group === 'bad').length,
    perkCount: perks.length,
    perks: perks.map((id) => POLICIES[id].name).join(' and '),
    won: s.won,
    time: fmtTime(s.time).replace(/^0/, ''),
    kills: s.kills.toLocaleString(),
    quota: Math.ceil(s.kills * 1.15).toLocaleString(),
    csat: s.csat.toLocaleString(),
    streak: s.bestStreak,
    level: s.level,
    pizzas: run.pizzas,
    revived: run.revived,
    close: run.minHpFrac < 0.1,
    steve: k.steve ?? 0,
    pam: k.pam ?? 0,
    randy: (k.randy ?? 0) + (k.randy_small ?? 0),
    vip: k.vip ?? 0,
    evolved: s.tools.find((t) => t.evolved)?.name,
    bossBeaten: beaten.length ? BOSS_NAMES[beaten[0]] : undefined,
    bossDodged: dodged.length ? BOSS_NAMES[dodged[0]] : undefined,
    topTool: top?.name,
    topShare: top && totalDamage ? top.damage / totalDamage : 0,
    topPct: top && totalDamage ? Math.round((top.damage / totalDamage) * 100) : 0,
    toolCount: s.tools.length,
    perMin: s.time > 0 ? Math.round(s.kills / (s.time / 60)) : 0,
    target: s.time > 0 ? Math.round(s.kills / (s.time / 60)) + 5 : 5,
  };
  // The time test above needs seconds, not the formatted clock.
  const ctx = { ...c, time: s.time, kills: s.kills, csat: s.csat };
  const comments = COMMENTS.filter((x) => x.when(ctx))
    .map((x) => ({ x, order: x.pri + rnd() * 0.5 }))
    .sort((a, b) => b.order - a.order);
  const lines = [];
  for (const { x } of comments) {
    if (lines.length >= 3) break;
    if (x.pri === 0) {
      // Fallbacks: different lines from the same pool until there are three.
      for (const line of [...x.lines].sort(() => rnd() - 0.5)) {
        if (lines.length >= 3) break;
        lines.push(fill(line, c));
      }
    } else {
      lines.push(fill(pick(x.lines, rnd), c));
    }
  }

  let goal;
  if (s.won) goal = run.revived ? GOALS.union : run.minHpFrac <= 0.5 ? GOALS.clean : GOALS.map;
  else if (s.time >= 1200) goal = GOALS.executive;
  else if (run.bossesMet.includes(mapBoss) && !run.bosses.includes(mapBoss)) goal = GOALS.boss;
  else if (s.time >= 900) goal = GOALS.twenty;
  else if (s.time >= 600) goal = GOALS.fifteen;
  else if (s.time >= 300) goal = GOALS.ten;
  else goal = GOALS.five;
  goal = fill(goal, { boss: BOSS_NAMES[mapBoss], bossName: BOSS_NAMES[mapBoss].replace(/^the /, '') });

  return {
    rating: rating.name,
    ratingId: rating.id,
    stars: rating.stars,
    lines,
    goal,
    manager: MANAGERS[s.map] ?? MANAGERS.office,
  };
}
