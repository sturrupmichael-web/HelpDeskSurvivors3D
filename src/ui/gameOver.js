// The end-of-shift summary: BURNOUT (or CLOCKED OUT), the run's stats and records, the
// Overtime Pay earned, what a map win unlocked, the shift's policies and score, damage by
// tool and the passives taken, the shift timeline and the HR performance review, then Next
// Shift, Change Tech, the shop or the title. At the end of the training shift it shows the
// "you're ready" screen instead (the original's trainingDone).
// Ported from the original's src/ui/screens/gameOver.js and training.js. Not yet ported:
// the Knowledge Base and posting to the leaderboard (M13).

import { icon } from './icons.js';
import { fmtTime } from './hud.js';
import { PAY } from './menus.js';
import { timelineChart, wireTimeline } from './timeline.js';
import { BURNOUT_QUIPS, VICTORY_QUIPS } from '../../data/flavor.js';
import { CHARACTERS } from '../../data/player.js';
import { WEAPONS } from '../../data/weapons.js';
import { PASSIVES } from '../../data/passives.js';
import { MAPS } from '../../data/maps.js';
import { POLICIES } from '../../data/policies.js';
import { fmtMult } from '../sim/policies.js';

const pickLine = (list) => list[(Math.random() * list.length) | 0];
const READY_DELAY = 600; // ms: don't let a held key skip the summary
const ITEM_HINT = 'Hover or tap a tool or passive to see what it does.';
const itemLevel = (t) => (t.level >= t.maxLevel ? 'MAX' : `Lv ${t.level}`);
// Display name of a map-win unlock ({ kind, id } from Meta.unlocksFor).
const unlockName = ({ kind, id }) =>
  kind === 'characters' ? `${CHARACTERS[id].name} (hire)` : kind === 'passives' ? PASSIVES[id].name : kind === 'evolutions' ? `${WEAPONS[id].name} (evolution)` : WEAPONS[id].name;

// The HR performance review (worked out in src/sim/review.js).
function reviewCard(s) {
  const r = s.review;
  const stars = '★'.repeat(r.stars) + '☆'.repeat(5 - r.stars);
  return `<div class="review rating-${r.ratingId}">
    <div class="review-head"><span>PERFORMANCE REVIEW${s.hardcore ? ' <b class="hc-tag">HARDCORE</b>' : ''}</span><span>${s.character}</span></div>
    <div class="review-rating"><span class="review-stars" aria-label="${r.stars} out of 5">${stars}</span><b>${r.rating}</b></div>
    <div class="review-label">Manager's comments</div>
    <ul>${r.lines.map((l) => `<li>${l}</li>`).join('')}</ul>
    <div class="review-goal"><span class="review-label">Goal for next quarter</span> ${r.goal}</div>
    <div class="review-sign">Signed, <i>${r.manager}</i></div>
  </div>`;
}

export class GameOverScreen {
  // `onAct(act)`: 'again' (the next shift), 'switch' (change tech), 'shop' or 'title'; after
  // training, 'clockin' (the Clock In picker) or 'title'.
  constructor(root, onAct) {
    this.onAct = onAct;
    this.el = document.createElement('div');
    this.el.className = 'screen';
    this.el.hidden = true;
    root.append(this.el);
    this.el.addEventListener('click', (e) => {
      const b = e.target.closest('.summary-buttons button');
      if (b) this.go(b.dataset.act);
    });
    this.shownFor = null;
    this.readyAt = 0;
  }

  get open() {
    return !this.el.hidden;
  }

  // Called every frame: shows or hides itself to match `sim.over`.
  update(sim) {
    if (sim.over === this.shownFor) return;
    this.shownFor = sim.over;
    if (sim.over) this.show(sim.over);
    else this.el.hidden = true;
  }

  show(s) {
    if (s.training) return this.showTraining();
    const rec = (k) => (s.records.includes(k) ? ' <b class="record">NEW RECORD</b>' : '');
    const topDamage = Math.max(1, ...s.tools.map((t) => t.damage));
    const items = [...s.tools, ...s.passives];
    const tools = s.tools
      .map(
        (t, i) => `<div class="tool-row ${t.evolved ? 'evolved' : ''}" data-item="${i}" tabindex="0">${icon(t.icon, 20)}<span class="tool-name">${t.name}</span>
          <span class="tool-bar"><i style="width:${Math.round((t.damage / topDamage) * 100)}%"></i></span><span class="tool-dmg">${t.damage.toLocaleString()}</span></div>`,
      )
      .join('');
    const passives = s.passives
      .map(
        (p, i) => `<div class="tool-row passive-row" data-item="${s.tools.length + i}" tabindex="0">${icon(p.icon, 20)}<span class="tool-name">${p.name}</span>
          <span class="tool-lvl">${itemLevel(p)}</span></div>`,
      )
      .join('');
    this.el.innerHTML = `
      <div class="panel wide summary ${s.won ? 'win' : 'lose'}">
        <h1>${s.won ? 'CLOCKED OUT!' : 'BURNOUT'}</h1>
        <p class="sub">${pickLine(s.won ? VICTORY_QUIPS : BURNOUT_QUIPS)}</p>
        ${s.newMap ? `<p class="unlock">NEW MAP UNLOCKED: <b>${MAPS[s.newMap].name}</b> (pick it when you Clock In)</p>` : ''}
        ${s.newUnlocks?.length ? `<p class="unlock">NOW AVAILABLE: ${s.newUnlocks.map((u) => `<b>${unlockName(u)}</b>`).join(', ')}</p>` : ''}
        ${s.policiesOpened ? '<p class="unlock">SHIFT POLICIES UNLOCKED: optional twists for more pay and score. Pick them when you Clock In, after the map.</p>' : ''}
        ${s.hardcoreOpened ? '<p class="unlock">HARDCORE UNLOCKED: you\'ve won on every map. Flip the Hardcore switch under the maps when you Clock In, for double pay and score.</p>' : ''}
        ${s.newPolicies?.length && !s.policiesOpened ? `<p class="unlock">NEW POLICIES: ${s.newPolicies.map((id) => `<b>${POLICIES[id].name}</b>`).join(', ')}</p>` : ''}
        <div class="summary-cols">
          <table class="stats">
            <tr><td>Technician</td><td>${s.character}</td></tr>
            <tr><td>Map</td><td>${s.mapName}</td></tr>
            <tr><td>Time survived</td><td>${fmtTime(s.time)}${rec('time')}</td></tr>
            <tr><td>Tickets closed</td><td>${s.kills.toLocaleString()}${rec('tickets')}</td></tr>
            <tr><td>CSAT score</td><td>${s.csat.toLocaleString()}${rec('csat')}</td></tr>
            ${
              s.policies.length || s.hardcore
                ? `${s.hardcore ? '<tr><td>Mode</td><td><b class="hc-tag">HARDCORE</b> x2</td></tr>' : ''}
                   ${s.policies.length ? `<tr><td>Policies</td><td class="pol-line">${s.policies.map((id) => POLICIES[id].name).join(', ')}${s.reorg ? ' (Reorg)' : ''}</td></tr>` : ''}
                   <tr><td>Leaderboard score</td><td>${s.score.toLocaleString()} <span class="pol-line">(CSAT ${fmtMult(s.policyMult)})</span></td></tr>`
                : ''
            }
            <tr><td>Best streak</td><td>x${s.bestStreak}</td></tr>
            <tr><td>Level reached</td><td>${s.level}</td></tr>
            <tr class="paid"><td>Overtime Pay earned</td><td>+${PAY(s.pay)}</td></tr>
            <tr><td>Balance</td><td>${PAY(s.balance)}</td></tr>
          </table>
          <div class="tools item-list"><div class="tools-head">Damage by tool</div>${tools || '<div class="tool-lvl">No tools this shift.</div>'}
            ${passives ? `<div class="tools-head passives-head">Passives</div>${passives}` : ''}
            <p class="item-info" aria-live="polite">${ITEM_HINT}</p>
          </div>
        </div>
        ${timelineChart(s.timeline)}
        ${reviewCard(s)}
        <div class="summary-buttons">
          <button class="primary" data-act="again">Next Shift <kbd>Enter</kbd></button>
          <button data-act="switch">Change Tech or Map <kbd>C</kbd></button>
          <button data-act="shop">Overtime Shop <kbd>S</kbd></button>
          <button data-act="title">Title <kbd>Esc</kbd></button>
        </div>
      </div>`;
    this.el.hidden = false;
    this.training = false;
    this.el.querySelector('.panel').scrollTop = 0;
    this.readyAt = performance.now() + READY_DELAY;
    wireTimeline(this.el, s.timeline);
    wireItems(this.el, items);
  }

  // End of the training shift.
  showTraining() {
    this.el.innerHTML = `
      <div class="panel training">
        <h1>TRAINING<br>COMPLETE</h1>
        <p class="sub">You're ready for the floor. A few things to know:</p>
        <ul class="training-list">
          <li>Survive the 20-minute shift and beat The Executive to clock out.</li>
          <li>Every shift pays Overtime Pay, even a short one. Spend it in the Overtime Shop on permanent upgrades, or hire new technicians.</li>
          <li>Bosses drop a Change Approved chest. A maxed tool plus the right passive can evolve in one.</li>
          <li>Pause with the II button<span class="keys-only"> or <kbd>Esc</kbd></span>. Training is always on the title screen if you want it again.</li>
        </ul>
        <div class="summary-buttons">
          <button class="primary" data-act="clockin">Clock In <kbd>Enter</kbd></button>
          <button data-act="title">Title <kbd>Esc</kbd></button>
        </div>
      </div>`;
    this.el.hidden = false;
    this.training = true;
    this.readyAt = performance.now() + READY_DELAY;
  }

  go(act) {
    if (performance.now() < this.readyAt) return;
    this.readyAt = Infinity;
    this.el.hidden = true; // now, not on the next frame: the menus take the keys from here
    this.onAct(act);
  }

  // Keyboard and gamepad. Returns true if it used the key (it takes them all while open,
  // except F and O, which the page handles).
  key(code) {
    if (!this.open) return false;
    if (code === 'KeyF' || code === 'KeyO' || code === 'KeyM') return false;
    if (code === 'Enter' || code === 'Space' || code === 'PadA' || code === 'PadStart') this.go(this.training ? 'clockin' : 'again');
    else if (this.training && code !== 'Escape' && code !== 'PadB') return true;
    else if (code === 'KeyC') this.go('switch');
    else if (code === 'KeyS') this.go('shop');
    else if (code === 'Escape' || code === 'PadB') this.go('title');
    return true;
  }
}

// Shows one item's description in the .item-info box under the lists: on hover or keyboard
// focus, and on a tap for phones (tapping the same row again hides it). A tap moves the box
// to just under the row, so it's on screen even when the lists are long.
function wireItems(root, items) {
  const box = root.querySelector('.item-info');
  const rows = [...root.querySelectorAll('[data-item]')];
  const home = box.parentNode;
  let shown = null;
  const show = (row, under = false) => {
    shown = row;
    if (row && under) row.after(box);
    else home.append(box);
    rows.forEach((r) => r.classList.toggle('selected', r === row));
    if (!row) {
      box.textContent = ITEM_HINT;
      box.classList.remove('on');
      return;
    }
    const t = items[row.dataset.item];
    const level = t.maxLevel > 1 ? ` <span class="tool-lvl">${itemLevel(t)}</span>` : '';
    box.innerHTML = `<b>${t.name}</b>${level}<br>${t.desc ?? ''}`;
    box.classList.add('on');
  };
  let touch = false; // the pointer that's down is a finger or pen, not a mouse
  let pressing = false;
  for (const row of rows) {
    row.addEventListener('pointerenter', (e) => e.pointerType === 'mouse' && show(row));
    row.addEventListener('pointerdown', (e) => {
      touch = e.pointerType !== 'mouse';
      pressing = true;
    });
    row.addEventListener('focus', () => !pressing && show(row)); // Tab key
    row.addEventListener('click', () => {
      pressing = false;
      show(touch && shown === row ? null : row, touch);
    });
  }
  root.querySelector('.item-list').addEventListener('pointerleave', (e) => e.pointerType === 'mouse' && show(null));
}
