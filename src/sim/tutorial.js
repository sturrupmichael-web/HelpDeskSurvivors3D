// Training shift: a short guided first shift for new players. The normal wave spawner
// is switched off and each step spawns its own users, shows a coach card on the HUD and
// waits for the player to do the thing it teaches. Nothing here pays out, counts as a
// shift or goes on the leaderboard. Texts live in data/tutorial.js.
// Ported from the original's src/game/tutorial.js. Differences: the coach card goes
// through the `coach` and `coachProgress` hooks, and the page says how the player moves
// (the `device` hook: 'keys', 'touch' or 'pad'), since the simulation has no DOM.

import { TUTORIAL } from '../../data/tutorial.js';
import { spawnEnemy } from './enemies.js';
import { dropItem } from './pickups.js';

const STEP_PAUSE = 1.2; // seconds between finishing a step and showing the next one

export class Tutorial {
  constructor(game) {
    this.game = game;
    this.step = -1;
    this.wait = 0.6; // short beat before the first card
    this.lowHpT = 0;
    this.done = false;
    this.bar = null; // the coach card's progress bar, last sent to the page
  }

  get current() {
    return TUTORIAL.steps[this.step];
  }

  next() {
    const g = this.game;
    this.step++;
    const s = this.current;
    if (!s) {
      this.done = true;
      g.coach(null);
      g.finishTutorial();
      return;
    }
    this.t = 0;
    this.spawned = 0;
    this.spawnT = 0;
    this.startKills = g.score.kills;
    this.moved = 0;
    this.lastX = g.player.x;
    this.lastY = g.player.y;
    if (s.id === 'rush') this.rush();
    if (s.id === 'pizza') this.dropPizza();
    this.show();
    if (this.step > 0) g.sfx('ticket');
  }

  show() {
    const s = this.current;
    const text = typeof s.text === 'function' ? s.text({ device: this.game.device(), tool: this.game.player.weapons[0].def.name }) : s.text;
    this.bar = this.progress();
    this.game.coach({ title: s.title, text, step: this.step + 1, steps: TUTORIAL.steps.length, progress: this.bar });
  }

  // 0..1 for the coach card's bar, or null when the step has no bar.
  progress() {
    const g = this.game;
    const p = g.player;
    const s = this.current;
    if (!s) return null;
    if (s.id === 'move') return Math.min(1, this.moved / TUTORIAL.moveDistance);
    if (s.id === 'fix') return p.level > 1 ? 1 : p.xp / p.xpNeed;
    if (s.id === 'rush') return this.spawned ? 1 - Math.min(1, g.enemies.count / this.spawned) : 0;
    return null;
  }

  // Sends the bar to the page when it moves by a percent (or appears or goes).
  sendProgress(v) {
    const pct = v === null ? -1 : Math.round(v * 100);
    const was = this.bar === null ? -1 : Math.round(this.bar * 100);
    this.bar = v;
    if (pct !== was) this.game.coachProgress(v);
  }

  // Called every tick of the training shift, after the player and spawner moved.
  update(dt) {
    if (this.done) return;
    const g = this.game;
    const p = g.player;
    // Training can't burn you out: hold sanity above zero and send pizza when it's low.
    if (p.hp < 1) p.hp = 1;
    if ((this.lowHpT -= dt) <= 0 && p.hp < p.maxHp * 0.3) {
      this.lowHpT = 8;
      this.dropPizza();
    }
    if (this.wait > 0) {
      if ((this.wait -= dt) <= 0) this.next();
      return;
    }
    const s = this.current;
    this.t += dt;
    if (s.id === 'move') {
      this.moved += Math.hypot(p.x - this.lastX, p.y - this.lastY);
      this.lastX = p.x;
      this.lastY = p.y;
    }
    if (s.id === 'fix') this.trickle(dt);
    this.sendProgress(this.progress());
    if (this.complete(s)) {
      this.sendProgress(1);
      this.wait = STEP_PAUSE;
    }
  }

  complete(s) {
    const g = this.game;
    const p = g.player;
    if (s.id === 'move') return this.moved >= TUTORIAL.moveDistance;
    if (s.id === 'fix') return p.level > 1 && p.pendingLevels === 0;
    if (s.id === 'rush') return (this.t > 1 && g.enemies.count === 0) || this.t > TUTORIAL.rush.timeout;
    if (s.id === 'pizza') return !this.hasPizza();
    if (s.id === 'wrapup') return this.t >= s.seconds;
    return true;
  }

  // "fix" step: a few slow users at a time until the first level-up.
  trickle(dt) {
    const g = this.game;
    const f = TUTORIAL.fix;
    if ((this.spawnT -= dt) > 0 || g.enemies.count >= f.maxAlive || g.player.level > 1) return;
    this.spawnT = f.every;
    this.spawnAround(f.enemy, Math.random() * Math.PI * 2, f.speedMult);
  }

  // "rush" step: a ring of users from every side at once.
  rush() {
    const r = TUTORIAL.rush;
    let i = 0;
    for (const [id, n] of Object.entries(r.mix)) {
      for (let k = 0; k < n; k++, i++) this.spawnAround(id, (i / r.count) * Math.PI * 2, r.speedMult);
    }
    this.spawned = i;
    this.game.shake(3);
    this.game.sfx('alarm');
  }

  // Just off the edge of the screen's short side, closer than the normal spawn ring, so
  // nobody waits long for users to arrive.
  spawnAround(id, angle, speedMult) {
    const g = this.game;
    const p = g.player;
    const v = g.view;
    const d = Math.min(v.left + v.right, v.top + v.bottom) / 2 + TUTORIAL.spawnPadding;
    spawnEnemy(g, id, p.x + Math.cos(angle) * d, p.y + Math.sin(angle) * d, 1, speedMult);
  }

  dropPizza() {
    const g = this.game;
    const p = g.player;
    const a = Math.random() * Math.PI * 2;
    dropItem(g, 'pizza', p.x + Math.cos(a) * TUTORIAL.pizzaDistance, p.y + Math.sin(a) * TUTORIAL.pizzaDistance);
  }

  hasPizza() {
    const items = this.game.items;
    for (let i = 0; i < items.count; i++) if (items.items[i].id === 'pizza') return true;
    return false;
  }

  // A line for the level-up screen while it's being taught.
  levelUpTip() {
    return this.current?.id === 'fix' ? TUTORIAL.levelUpTip : null;
  }
}
