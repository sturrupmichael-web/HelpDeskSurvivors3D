// In-run HUD as HTML over the canvas: XP bar, shift clock, sanity, tool and passive slots,
// tickets closed and CSAT, the event banner, the boss bar, a pause button, and an arrow at
// the screen edge pointing to an off-screen Change Approved chest.
// Ported from the original's src/ui/hud.js. Values are cached so the DOM is only touched
// when something changes. Not yet ported: Shift Policies and the training coach.

import { icon } from './icons.js';
import { SHIFT_LENGTH, OVERTIME } from '../../data/waves.js';
import { PASSIVES } from '../../data/passives.js';

export const fmtTime = (t) => {
  const s = Math.floor(t);
  return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
};

const EDGE = 28; // px from the screen edge to the chest arrow's center

export class Hud {
  // `onPause()`: the pause button was pressed.
  constructor(root, onPause) {
    this.root = document.createElement('div');
    this.root.className = 'hud';
    this.root.innerHTML = `
      <div class="hud-xp"><i></i><b class="hud-level">LV 1</b></div>
      <div class="hud-timer"><span class="t">00:00</span><small class="shift">SHIFT ENDS ${fmtTime(SHIFT_LENGTH)}</small></div>
      <div class="hud-left">
        <div class="hud-sanity">
          <span class="label">SANITY</span>
          <span class="bar"><i class="hp-fill"></i></span>
          <span class="hp-text">100</span>
        </div>
        <div class="slots weapons"></div>
        <div class="slots passives"></div>
      </div>
      <div class="hud-right">
        <div>TICKETS CLOSED <b class="kills">0</b></div>
        <div>CSAT <b class="csat">0</b> <span class="mult"></span></div>
        <div class="muted" hidden>MUTED <kbd>M</kbd></div>
      </div>
      <div class="hud-banner" hidden><b></b><span></span></div>
      <div class="edge-arrow" hidden></div>
      <div class="hud-boss" hidden>
        <div class="boss-name"></div>
        <div class="boss-bar"><i class="boss-fill"></i></div>
      </div>`;
    this.pauseButton = document.createElement('button');
    this.pauseButton.className = 'hud-pause';
    this.pauseButton.setAttribute('aria-label', 'Pause');
    this.pauseButton.textContent = 'II';
    this.pauseButton.addEventListener('click', onPause);
    // Achievement toasts live outside the HUD so they also show on menus.
    this.toasts = document.createElement('div');
    this.toasts.className = 'toasts';
    this.toasts.setAttribute('role', 'status'); // screen readers announce new achievements
    root.append(this.root, this.pauseButton, this.toasts);
    const q = (s) => this.root.querySelector(s);
    this.el = {
      xp: q('.hud-xp i'), level: q('.hud-level'), timer: q('.hud-timer .t'), shift: q('.shift'),
      hp: q('.hp-fill'), hpText: q('.hp-text'), sanity: q('.hud-sanity'),
      kills: q('.kills'), csat: q('.csat'), mult: q('.mult'),
      weapons: q('.weapons'), passives: q('.passives'),
      banner: q('.hud-banner'), arrow: q('.edge-arrow'), muted: q('.muted'),
      boss: q('.hud-boss'), bossName: q('.boss-name'), bossFill: q('.boss-fill'),
    };
    this.cache = {};
    this.bannerT = 0;
    this.pt = { x: 0, y: 0 };
  }

  // "Achievement unlocked" toast for a data/achievements.js entry.
  toast(a) {
    const t = document.createElement('div');
    t.className = 'toast';
    t.innerHTML = `${icon(a.icon, 32)}<div><small>${a.label ?? 'ACHIEVEMENT UNLOCKED'}</small><b></b></div>`;
    t.querySelector('b').textContent = a.name;
    this.toasts.appendChild(t);
    setTimeout(() => t.classList.add('out'), 3500);
    setTimeout(() => t.remove(), 4000);
  }

  setMuted(m) {
    this.el.muted.hidden = !m;
  }

  setVisible(v) {
    this.root.hidden = !v;
    this.pauseButton.hidden = !v;
  }

  // Big warning banner for events (Patch Tuesday, Login Storm, comebacks).
  banner(title, text, seconds) {
    const b = this.el.banner;
    b.querySelector('b').textContent = title;
    b.querySelector('span').textContent = text;
    b.hidden = false;
    b.classList.remove('show');
    void b.offsetWidth; // restart the CSS animation
    b.classList.add('show');
    this.bannerT = seconds;
  }

  set(key, value, apply) {
    if (this.cache[key] === value) return;
    this.cache[key] = value;
    apply(value);
  }

  // Called every frame. `view` places the chest arrow.
  update(dt, sim, view) {
    if (this.bannerT > 0 && (this.bannerT -= dt) <= 0) this.el.banner.hidden = true;
    const p = sim.player;
    const s = sim.score;
    const e = this.el;
    this.set('xp', Math.floor(Math.min(1, p.xp / p.xpNeed) * 1000), (v) => (e.xp.style.width = v / 10 + '%'));
    this.set('level', p.level, (v) => (e.level.textContent = 'LV ' + v));
    this.set('time', Math.floor(sim.time), (v) => (e.timer.textContent = fmtTime(v)));
    // Overtime: a countdown to the first ramp-up during the grace period, then the level.
    const ot = sim.spawner.overtimeLevel(sim);
    const graceLeft = Math.ceil(SHIFT_LENGTH + OVERTIME.grace - sim.time);
    // Numbers as cache keys, so nothing is built per frame: 0 in the shift, then -seconds of
    // grace left, then the overtime level.
    const shift = sim.time < SHIFT_LENGTH ? 0 : ot || -graceLeft;
    this.set('overtime', shift, (v) => {
      e.shift.textContent = v === 0 ? 'SHIFT ENDS ' + fmtTime(SHIFT_LENGTH) : ot ? `OVERTIME x${ot}` : 'OVERTIME · HARDER IN ' + fmtTime(graceLeft);
      e.shift.classList.toggle('over', v !== 0);
    });
    const hp = Math.max(0, Math.ceil(p.hp));
    this.set('hp', hp * 1e5 + p.maxHp, () => {
      e.hp.style.width = Math.min(100, (hp / p.maxHp) * 100) + '%';
      e.hpText.textContent = hp + '/' + p.maxHp;
      e.sanity.classList.toggle('low', hp < p.maxHp * 0.25);
    });
    this.set('kills', s.kills, (v) => (e.kills.textContent = v.toLocaleString()));
    this.set('csat', s.csat, (v) => (e.csat.textContent = v.toLocaleString()));
    this.set('mult', s.mult, (v) => (e.mult.textContent = v > 1 ? `x${v} STREAK` : ''));
    this.set('slots', slotKey(p), () => this.refreshSlots(p));
    // The boss bar: what's left of the whole fight, orange and ENRAGED in its second phase.
    const boss = sim.bossAlive() && !sim.over ? sim.boss : null;
    this.set('bossOn', boss ? boss.uid : 0, () => {
      e.boss.hidden = !boss;
      if (boss) e.bossName.textContent = boss.def.name;
    });
    this.set('bossAngry', !!boss && sim.bossPhase2, (v) => e.boss.classList.toggle('angry', v));
    if (boss) this.set('bossHp', Math.ceil(sim.bossHpFrac() * 400), (v) => (e.bossFill.style.width = v / 4 + '%'));
    this.edgeArrow(sim, view);
  }

  // Rebuilds the tool and passive icon rows (only when they change).
  refreshSlots(p) {
    const slot = (ic, lvl, max, evolved) =>
      evolved
        ? `<div class="slot evolved">${icon(ic, 24)}<span class="lvl"><i></i></span></div>`
        : `<div class="slot">${icon(ic, 24)}<span class="lvl"><i style="width:${Math.round((lvl / max) * 100)}%"></i></span></div>`;
    const empty = '<div class="slot empty"></div>';
    this.el.weapons.innerHTML =
      p.weapons.map((w) => slot(w.def.icon, w.level, w.def.levels.length, w.def.evolved)).join('') + empty.repeat(Math.max(0, p.maxWeapons - p.weapons.length));
    const passives = Object.entries(p.passives);
    this.el.passives.innerHTML =
      passives.map(([id, lvl]) => slot(PASSIVES[id].icon, lvl, PASSIVES[id].maxLevel)).join('') + empty.repeat(Math.max(0, p.maxPassives - passives.length));
  }

  // Off-screen chests get an arrow at the screen edge pointing to them (the nearest one).
  edgeArrow(sim, view) {
    const pool = sim.items;
    const p = sim.player;
    let best = null;
    let bestD = Infinity;
    for (let i = 0; i < pool.count; i++) {
      const it = pool.items[i];
      if (!it.def.edgeArrow) continue;
      const d = (it.x - p.x) ** 2 + (it.y - p.y) ** 2;
      if (d < bestD) (bestD = d), (best = it);
    }
    const a = this.el.arrow;
    const w = innerWidth;
    const h = innerHeight;
    const pt = this.pt;
    const ahead = best && view.toScreen(best.x, best.y, pt);
    if (!best || (ahead && pt.x > 0 && pt.x < w && pt.y > 0 && pt.y < h)) {
      this.set('arrow', false, () => (a.hidden = true));
      return;
    }
    this.set('arrow', true, () => (a.hidden = false));
    let dx = pt.x - w / 2;
    let dy = pt.y - h / 2;
    if (!ahead) (dx = -dx), (dy = -dy); // behind the camera the projection flips
    const k = Math.min((w / 2 - EDGE) / Math.abs(dx || 1e-6), (h / 2 - EDGE) / Math.abs(dy || 1e-6));
    const x = Math.round(w / 2 + dx * k);
    const y = Math.round(h / 2 + dy * k);
    a.style.transform = `translate(${x}px, ${y}px) rotate(${Math.atan2(dy, dx).toFixed(2)}rad)`;
  }
}

// A number that changes whenever a slot row needs redrawing (no strings built per frame).
function slotKey(p) {
  let k = p.weapons.length * 1e6;
  for (let i = 0; i < p.weapons.length; i++) {
    const w = p.weapons[i];
    k += (i + 1) * (w.level * 7 + (w.def.evolved ? 500 : 0));
  }
  let n = 0;
  for (const id in p.passives) k += ++n * 1000 + p.passives[id] * 13 * n;
  return k;
}
