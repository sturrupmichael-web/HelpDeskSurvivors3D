// Floor pickups. Closed Tickets (XP gems) are dropped by enemies, magnetized when
// inside your pickup radius, collected on contact. Items (pizza, Bulk Close, PTO,
// Change Approved chests) drop rarely and do something when touched.
// Ported from the original's src/game/pickups.js with the drawing removed. Pickups keep
// their previous position (`px`, `py`) for interpolation. Not yet ported: achievement
// tallies.

import { TICKET_TIERS, TICKETS, ITEMS, ITEM_PICKUP_RADIUS, MAX_ITEMS } from '../../data/pickups.js';
import { addXp } from './player.js';

export function makeTicket() {
  return { x: 0, y: 0, px: 0, py: 0, value: 0, tier: 0, magnet: false, speed: 0, t: 0, age: 0, dead: false };
}

// Index into TICKET_TIERS for a ticket's value (the renderer picks the model by it).
function tierOf(value) {
  let n = 0;
  for (let i = 0; i < TICKET_TIERS.length; i++) if (value >= TICKET_TIERS[i].minValue) n = i;
  return n;
}

// Returns the ticket (a magnetized one flies to you).
export function dropTicket(game, x, y, value) {
  const pool = game.tickets;
  let t = pool.spawn();
  if (!t) {
    // Floor is full: move the ticket farthest from you here and fold the XP into it,
    // so XP keeps landing where the fighting is instead of piling up across the map.
    const p = game.player;
    let far = -1;
    for (let i = 0; i < pool.count; i++) {
      const o = pool.items[i];
      if (o.magnet) continue;
      const d = (o.x - p.x) ** 2 + (o.y - p.y) ** 2;
      if (d > far) (far = d), (t = o);
    }
    if (!t) t = pool.items[(Math.random() * pool.count) | 0];
    value += t.value;
  }
  t.x = x;
  t.y = y;
  game.floor.collide(t, 0, 7); // never inside a solid cubicle
  t.px = t.x;
  t.py = t.y;
  t.value = value;
  t.tier = tierOf(value);
  t.magnet = false;
  t.speed = TICKETS.magnetSpeed;
  t.t = Math.random() * 6;
  t.age = 0; // seconds on the floor (Ticket Blitz makes them vanish)
  t.dead = false;
  return t;
}

export function updateTickets(game, dt) {
  const p = game.player;
  const pool = game.tickets;
  const pr = p.def.pickupRadius * p.stats.pickupRadius;
  const pr2 = pr * pr;
  const cr2 = TICKETS.collectRadius * TICKETS.collectRadius;
  const life = game.policy.ticketLife; // Ticket Blitz: 0 = tickets stay
  for (let i = pool.count - 1; i >= 0; i--) {
    const t = pool.items[i];
    t.px = t.x;
    t.py = t.y;
    t.t += dt;
    if (life && !t.magnet && (t.age += dt) > life) {
      pool.removeAt(i);
      continue;
    }
    const dx = p.x - t.x;
    const dy = p.y - t.y;
    const d2 = dx * dx + dy * dy;
    if (!t.magnet && d2 < pr2) {
      t.magnet = true;
      t.speed = TICKETS.magnetSpeed;
    }
    if (t.magnet) {
      t.speed += TICKETS.magnetAccel * dt;
      const d = Math.sqrt(d2) || 1;
      const step = Math.min(d, t.speed * dt);
      t.x += (dx / d) * step;
      t.y += (dy / d) * step;
      if (d2 < cr2 || step >= d) {
        addXp(game, t.value);
        game.sfx('ticket');
        pool.removeAt(i);
      }
    }
  }
}

// --- Items ---------------------------------------------------------------------------

export function makeItem() {
  return { id: '', def: null, x: 0, y: 0, px: 0, py: 0, t: 0, magnet: false, speed: 0 };
}

export function dropItem(game, id, x, y) {
  const it = game.items.spawn();
  if (!it) return;
  it.id = id;
  it.def = ITEMS[id];
  it.x = x;
  it.y = y;
  game.floor.collide(it, 0, 9);
  it.px = it.x;
  it.py = it.y;
  it.t = 0;
  it.magnet = false;
  it.speed = 0;
}

// Called when an enemy is closed: per-kill item chances, plus the enemy's own `drops`.
export function rollItemDrops(game, e) {
  const odds = game.policy.items; // Team Lunch / No Pizza Policy: per-pickup multipliers
  const loot = e.def.loot;
  if (loot) {
    const allowed = loot.filter((id) => odds[id] !== 0);
    return allowed.length && dropItem(game, allowed[(Math.random() * allowed.length) | 0], e.x, e.y);
  }
  const drops = e.def.drops;
  if (drops) {
    for (const id in drops) if (Math.random() < drops[id] * (odds[id] ?? 1)) dropItem(game, id, e.x, e.y);
    return;
  }
  if (game.items.count >= MAX_ITEMS) return;
  const luck = game.player.stats.luck; // Lucky Lanyard
  for (const id in ITEMS) {
    if (ITEMS[id].maps && !ITEMS[id].maps.includes(game.mapId)) continue;
    const c = ITEMS[id].chance * luck * (odds[id] ?? 1);
    if (c && Math.random() < c) return dropItem(game, id, e.x, e.y);
  }
}

// What pickups do, by the names in their `effects` (data/pickups.js). (game, def) => void.
export const ITEM_EFFECTS = {
  heal(game, d) {
    const p = game.player;
    p.hp = Math.min(p.maxHp, p.hp + d.heal);
  },
  boost(game, d) {
    game.player.boost = d.speed;
    game.player.boostT = d.time;
  },
  invulnerable(game, d) {
    game.player.invuln = d.invulnerable;
  },
  // Every ticket on the floor flies to you.
  bulkClose(game) {
    const tk = game.tickets;
    for (let i = 0; i < tk.count; i++) {
      const t = tk.items[i];
      if (!t.magnet) {
        t.magnet = true;
        t.speed = TICKETS.magnetSpeed * 3;
      }
    }
  },
  chest(game) {
    game.openChest();
  },
};

function collect(game, it) {
  const p = game.player;
  const d = it.def;
  game.text(p.x, p.y - 30, d.label, '#ffcd75');
  if (d.tally) game.achievements.run[d.tally]++;
  if (d.burst) game.burst(p.x, p.y - 8, d.burst[0], d.burst[1]);
  if (d.ring) game.ring(p.x, p.y, d.ring[0], d.ring[1], d.ring[2], d.ring[3]);
  if (d.sound) game.sfx(d.sound);
  for (const name of d.effects) ITEM_EFFECTS[name](game, d); // last: a chest pauses the game
}

export function updateItems(game, dt) {
  const p = game.player;
  const pool = game.items;
  const pr = p.def.pickupRadius * p.stats.pickupRadius;
  const touch = ITEM_PICKUP_RADIUS + p.r;
  for (let i = pool.count - 1; i >= 0; i--) {
    const it = pool.items[i];
    it.px = it.x;
    it.py = it.y;
    it.t += dt;
    const dx = p.x - it.x;
    const dy = p.y - it.y;
    const d = Math.hypot(dx, dy) || 1;
    if (d < touch) {
      pool.removeAt(i); // remove first: a chest pauses the game inside collect()
      collect(game, it);
      continue;
    }
    if (!it.magnet && d < pr) it.magnet = true;
    if (it.magnet) {
      it.speed += TICKETS.magnetAccel * 0.5 * dt;
      const step = Math.min(d, it.speed * dt);
      it.x += (dx / d) * step;
      it.y += (dy / d) * step;
    }
  }
}
