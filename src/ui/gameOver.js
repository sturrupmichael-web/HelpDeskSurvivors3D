// The end-of-shift summary: BURNOUT (or CLOCKED OUT, once the final boss is in), the run's
// stats, damage by tool and the passives taken, then Next Shift.
// Ported from the original's src/ui/screens/gameOver.js. Not yet ported: pay and records,
// unlocks, the timeline chart, the performance review, the leaderboard, and the shop and
// tech/map picker buttons.

import { icon } from './icons.js';
import { fmtTime } from './hud.js';
import { BURNOUT_QUIPS, VICTORY_QUIPS } from '../../data/flavor.js';

const pickLine = (list) => list[(Math.random() * list.length) | 0];
const READY_DELAY = 600; // ms: don't let a held key skip the summary
const ITEM_HINT = 'Hover or tap a tool or passive to see what it does.';
const itemLevel = (t) => (t.level >= t.maxLevel ? 'MAX' : `Lv ${t.level}`);

export class GameOverScreen {
  // `onAgain()`: start the next shift.
  constructor(root, onAgain) {
    this.onAgain = onAgain;
    this.el = document.createElement('div');
    this.el.className = 'screen';
    this.el.hidden = true;
    root.append(this.el);
    this.el.addEventListener('click', (e) => {
      if (e.target.closest('[data-act=again]')) this.again();
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
        <div class="summary-cols">
          <table class="stats">
            <tr><td>Technician</td><td>${s.character}</td></tr>
            <tr><td>Map</td><td>${s.mapName}</td></tr>
            <tr><td>Time survived</td><td>${fmtTime(s.time)}</td></tr>
            <tr><td>Tickets closed</td><td>${s.kills.toLocaleString()}</td></tr>
            <tr><td>CSAT score</td><td>${s.csat.toLocaleString()}</td></tr>
            <tr><td>Best streak</td><td>x${s.bestStreak}</td></tr>
            <tr><td>Level reached</td><td>${s.level}</td></tr>
          </table>
          <div class="tools item-list"><div class="tools-head">Damage by tool</div>${tools || '<div class="tool-lvl">No tools this shift.</div>'}
            ${passives ? `<div class="tools-head passives-head">Passives</div>${passives}` : ''}
            <p class="item-info" aria-live="polite">${ITEM_HINT}</p>
          </div>
        </div>
        <div class="summary-buttons">
          <button class="primary" data-act="again">Next Shift <kbd>Enter</kbd></button>
        </div>
      </div>`;
    this.el.hidden = false;
    this.readyAt = performance.now() + READY_DELAY;
    wireItems(this.el, items);
  }

  again() {
    if (performance.now() < this.readyAt) return;
    this.readyAt = Infinity;
    this.onAgain();
  }

  // Keyboard and gamepad. Returns true if it used the key (it takes them all while open,
  // except F and O, which the page handles).
  key(code) {
    if (!this.open) return false;
    if (code === 'KeyF' || code === 'KeyO') return false;
    if (code === 'Enter' || code === 'Space' || code === 'PadA' || code === 'PadStart') this.again();
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
