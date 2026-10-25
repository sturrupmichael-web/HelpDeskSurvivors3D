// The level-up cards and the Change Approved chest, as HTML over the frozen floor.
// Ported from the original's src/ui/screens/levelUp.js: the same cards, icons, evolution
// hints and wording. The simulation decides what's on offer (`sim.choices`, `sim.chest`);
// this only shows it and reports the pick (and a reroll, with the shop's Escalation Path).

import { icon } from './icons.js';
import { LEVEL_UP_LINES } from '../../data/flavor.js';

const DIGITS = { Digit1: 0, Digit2: 1, Digit3: 2, Digit4: 3, Digit5: 4, Numpad1: 0, Numpad2: 1, Numpad3: 2, Numpad4: 3, Numpad5: 4 };
const READY_DELAY = 400; // ms before taps count: a thumb put back down to steer could otherwise land on a card
const pickLine = (list) => list[(Math.random() * list.length) | 0];

const levelLabel = (c) => (c.kind === 'reward' ? 'Reward' : c.level === 1 ? 'NEW!' : `Level ${c.level}`);

export class LevelUpScreen {
  // `onPick(card, always)`, `onClose()` and `onReroll()` go back to the simulation.
  constructor(root, onPick, onClose, onReroll) {
    this.onPick = onPick;
    this.onReroll = onReroll;
    this.onClose = onClose;
    this.el = document.createElement('div');
    this.el.className = 'screen';
    this.el.hidden = true;
    root.append(this.el);
    this.el.addEventListener('click', (e) => this.click(e));
    this.shownFor = null; // the choices or chest object on screen
    this.readyAt = 0;
  }

  get open() {
    return !this.el.hidden;
  }

  get ready() {
    return performance.now() >= this.readyAt;
  }

  // Called every frame: shows or hides itself to match the simulation.
  update(sim) {
    const want = sim.choices ?? sim.chest;
    if (want === this.shownFor) return;
    this.shownFor = want;
    if (!want) {
      this.el.hidden = true;
      return;
    }
    if (sim.choices) this.showCards(sim.choices, sim.player.rerolls);
    else this.showChest(sim.chest);
    this.el.hidden = false;
    this.readyAt = performance.now() + READY_DELAY;
  }

  showCards(choices, rerolls) {
    this.choices = choices;
    this.onlyPizza = choices.length === 1 && choices[0].kind === 'reward';
    const card = (c, i) => `
      <button class="card ${c.pair?.length ? 'paired' : ''}" data-i="${i}">
        <div class="card-head">${icon(c.icon, 40)}
          <div><div class="card-name">${c.name}</div><div class="card-level">${levelLabel(c)}</div></div>
          <kbd>${i + 1}</kbd>
        </div>
        ${c.pair?.length ? `<div class="evo-pair"><b>&#9889; EVO PAIR</b><span>with</span>${c.pair.map((x) => icon(x.icon, 20)).join('')}</div>` : ''}
        <div class="card-text">${c.text}</div>
        <div class="card-flavor">${c.flavor}</div>
        ${c.hint ? `<div class="card-hint">${c.hint}</div>` : ''}
      </button>`;
    this.el.innerHTML = `
      <div class="panel wide levelup-panel">
        <h2>LEVEL UP!</h2>
        <p class="sub">${pickLine(LEVEL_UP_LINES)}</p>
        <div class="cards">${choices.map(card).join('')}</div>
        ${this.onlyPizza ? `<button class="always" data-act="always">Everything's maxed: always take the pizza from now on <kbd>A</kbd></button>` : ''}
        ${rerolls > 0 && !this.onlyPizza ? `<button class="always" data-act="reroll">Escalate: reroll these cards (${rerolls} left) <kbd>R</kbd></button>` : ''}
      </div>`;
  }

  // result: { evolved?: { from, to }, upgrades: [card] } from the simulation's openChest().
  showChest(result) {
    this.choices = null;
    const ev = result.evolved;
    const body = ev
      ? `<p class="sub">Emergency change approved by the CAB. Your tool has evolved!</p>
        <div class="evolve">
          <div class="evo-from">${icon(ev.from.icon, 40)}<span>${ev.from.name}</span></div>
          <div class="evo-arrow">&#9654;</div>
          <div class="evo-to">${icon(ev.to.icon, 56)}<b>${ev.to.name}</b></div>
        </div>
        <div class="card-text">${ev.to.desc}</div>
        <div class="card-flavor">${ev.to.flavor}</div>`
      : `<p class="sub">Standard change approved. ${result.upgrades.length > 1 ? 'Triple sign-off!' : 'One sign-off.'}</p>
        <div class="chest-list">${result.upgrades
          .map((c) => `<div class="chest-item">${icon(c.icon, 32)}<div><div class="card-name">${c.name}</div><div class="card-level">${levelLabel(c)}</div></div></div>`)
          .join('')}</div>`;
    this.el.innerHTML = `
      <div class="panel chest">
        <h2>CHANGE APPROVED</h2>
        ${body}
        <button class="primary" data-act="ok">Deploy to Production <kbd>Enter</kbd></button>
      </div>`;
  }

  pick(i, always = false) {
    if (!this.ready || !this.choices?.[i]) return;
    this.readyAt = Infinity; // one pick per screen
    this.onPick(this.choices[i], always);
  }

  reroll() {
    if (!this.ready || !this.choices) return;
    this.readyAt = Infinity;
    this.onReroll();
  }

  close() {
    if (!this.ready || this.choices) return;
    this.readyAt = Infinity;
    this.onClose();
  }

  click(e) {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.i !== undefined) this.pick(Number(b.dataset.i));
    else if (b.dataset.act === 'always') this.pick(0, true);
    else if (b.dataset.act === 'reroll') this.reroll();
    else if (b.dataset.act === 'ok') this.close();
  }

  // Keyboard and gamepad (buttons arrive as Pad* codes). Returns true if it used the key.
  key(code) {
    if (!this.open || code === 'KeyO' || code === 'KeyM') return false; // Settings and mute still work over the cards
    if (this.choices) {
      if (DIGITS[code] !== undefined) this.pick(DIGITS[code]);
      else if (this.onlyPizza && code === 'KeyA') this.pick(0, true);
      else if ((code === 'KeyR' || code === 'PadX') && !this.onlyPizza) this.reroll();
      else if (code === 'PadA') this.pick(0);
    } else if (code === 'Enter' || code === 'Space' || code === 'PadA') this.close();
    return true; // swallow everything else (no pausing or playtest keys mid-choice)
  }
}
