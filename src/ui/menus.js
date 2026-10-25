// The menus between shifts: the title screen, the Clock In picker (pick a tech, then a
// map with the Hardcore switch under it, then Shift Policies), the training offer,
// Characters, the Overtime Shop, Achievements, and the online screens (the leaderboard,
// Account and profiles, in src/ui/online.js). One overlay; each screen renders into it
// and handles its own keys.
// Ported from the original's src/ui/screens/ (title.js, shiftSetup.js, policies.js,
// training.js, characters.js, shop.js, achievements.js): the same wording, cards and keys.
// The tech pictures are renders of the 3D models (`portrait`) where the original drew
// sprites. Not yet ported: the Knowledge Base, what's new and Report a Bug.

import { icon } from './icons.js';
import { fmtTime } from './hud.js';
import { CHARACTERS } from '../../data/player.js';
import { WEAPONS } from '../../data/weapons.js';
import { MAPS, MAP_ORDER } from '../../data/maps.js';
import { SHOP } from '../../data/meta.js';
import { ACHIEVEMENTS } from '../../data/achievements.js';
import { TITLE_TAGLINES } from '../../data/flavor.js';
import { VERSION } from '../version.js';
import { POLICIES, POLICY_ORDER, POLICY_GROUPS, POLICY_RULES, HARDCORE } from '../../data/policies.js';
import { shiftMult, fmtMult, clashes, rollReorg, hardcoreOk } from '../sim/policies.js';
import { leaderboard, profile, accountScreen, conflictScreen, accountKind } from './online.js';

const pickLine = (list) => list[(Math.random() * list.length) | 0];
export const PAY = (n) => `<span class="pay">$${n.toLocaleString()}</span>`;
const DIGITS = { Digit1: 0, Digit2: 1, Digit3: 2, Digit4: 3, Digit5: 4, Digit6: 5, Digit7: 6, Digit8: 7, Digit9: 8, Numpad1: 0, Numpad2: 1, Numpad3: 2, Numpad4: 3, Numpad5: 4, Numpad6: 5, Numpad7: 6, Numpad8: 7, Numpad9: 8 };

export class Menus {
  // `sim` for the save (sim.meta) and achievements; `portrait(techId)` gives a picture URL;
  // `onStart()` starts a shift with the saved picks; `onTraining()` starts the training
  // shift; `onPreview(tech, map)` shows a tech on a map's floor behind the menu (the saved
  // picks by default); `onSettings()` opens Settings; `sfx`; `cloud` is the CloudSave
  // (src/net/cloudsave.js), for the Account screen.
  constructor(root, { sim, portrait, onStart, onTraining, onPreview, onSettings, sfx, cloud }) {
    this.sim = sim;
    this.cloud = cloud;
    this.pendingConflict = null; // the cloud save's "which progress?" question, for the next title
    this.portrait = portrait;
    this.onStart = onStart;
    this.onTraining = onTraining;
    this.onPreview = onPreview;
    this.onSettings = onSettings;
    this.sfx = sfx;
    this.el = document.createElement('div');
    this.el.className = 'screen menus';
    this.el.hidden = true;
    root.append(this.el);
    this.keys = null; // key handler for the current screen
    this.redraw = null; // shows the current screen again (after a playtest helper changes the save)
  }

  get meta() {
    return this.sim.meta;
  }

  get open() {
    return !this.el.hidden;
  }

  show(html, keys, redraw) {
    this.el.innerHTML = html;
    this.el.hidden = false;
    this.keys = keys;
    this.redraw = redraw;
    this.el.querySelector('.panel')?.focus({ preventScroll: true });
  }

  hide() {
    this.el.hidden = true;
    this.el.innerHTML = '';
    this.keys = null;
    this.redraw = null;
  }

  refresh() {
    this.redraw?.();
  }

  bind(selector, fn) {
    this.el.querySelectorAll(selector).forEach((el, i) => el.addEventListener('click', () => fn(i, el)));
  }

  // Keyboard and gamepad. Returns true if the screen used the key; F, M, O and the
  // playtest pay key fall through to the page.
  key(code) {
    if (!this.open || !this.keys) return false;
    if (code === 'PadB') code = 'Escape';
    if (code === 'PadA' || code === 'PadStart') code = 'Enter';
    if (code === 'PadRight' || code === 'PadDown') code = 'ArrowRight';
    if (code === 'PadLeft' || code === 'PadUp') code = 'ArrowLeft';
    return this.keys(code) !== false;
  }

  techImg(id, size = 64) {
    return `<img class="tech-pic" src="${this.portrait(id)}" width="${size}" height="${size}" alt="">`;
  }

  // --- Title ------------------------------------------------------------------------------
  title() {
    // Both this device and the account changed: ask before anything else.
    if (this.pendingConflict) return this.pendingConflict();
    const m = this.meta.data;
    const ch = CHARACTERS[m.selected];
    const go = (act) => {
      this.sfx('click');
      if (act === 'start') {
        // Brand-new players get offered the training shift once.
        if (!m.trained && !m.shifts && !m.offeredTraining) this.trainingOffer();
        else this.clockIn();
      } else if (act === 'training') this.onTraining();
      else if (act === 'chars') this.characters();
      else if (act === 'shop') this.shop();
      else if (act === 'ach') this.achievements();
      else if (act === 'settings') this.onSettings();
      else if (act === 'board') this.leaderboard();
      else if (act === 'account') this.account();
    };
    const tile = (act, ic, label, extra, key) =>
      `<button class="tile" data-act="${act}">${icon(ic, 28)}<span>${label}</span>${extra ? `<small>${extra}</small>` : ''}<kbd>${key}</kbd></button>`;
    const best = m.best;
    const hired = Object.keys(CHARACTERS).filter((id) => this.meta.isUnlocked(id)).length;
    this.show(
      `<div class="panel title" tabindex="-1">
        <div class="title-head">
          <h1>HELPDESK<br>SURVIVORS <span class="three-d">3D</span></h1>
          <p class="sub">${pickLine(TITLE_TAGLINES)}</p>
          <div class="title-char">${this.techImg(m.selected)}
            <div><div class="card-name">${ch.name}</div><div class="card-flavor">${ch.perk}</div></div></div>
          <button class="primary clock-in" data-act="start">Clock In <kbd>Enter</kbd></button>
        </div>
        <div class="title-menu">
          <div class="tiles">
            ${tile('shop', 'laptop', 'Overtime Shop', PAY(m.pay), 'S')}
            ${tile('chars', 'delegate', 'Characters', `${hired}/${Object.keys(CHARACTERS).length} hired`, 'C')}
            ${tile('ach', 'cert', 'Achievements', `${Object.keys(m.achievements ?? {}).length}/${ACHIEVEMENTS.length}`, 'A')}
            ${tile('board', 'escalate', 'Leaderboard', 'Top shifts per map', 'B')}
            ${tile('account', 'lanyard', 'Account', accountKind(), 'U')}
            ${tile('settings', 'policy', 'Settings', 'Sound, quality, camera', 'O')}
            ${tile('training', 'book', 'Training', m.trained ? 'Done: take it again' : 'A guided first shift', 'T')}
          </div>
          <p class="title-records">${
            m.shifts
              ? `Best shift ${fmtTime(best.time)} · ${best.tickets.toLocaleString()} tickets · CSAT ${best.csat.toLocaleString()} · ${m.wins} of ${m.shifts} shifts survived`
              : 'No shifts worked yet. Your records show up here.'
          }</p>
          <div class="controls keys-only">
            <div><kbd>WASD</kbd>/<kbd>Arrows</kbd> move · your tools fire automatically</div>
            <div><kbd>Esc</kbd> pause · <kbd>M</kbd> mute · <kbd>C</kbd> characters</div>
          </div>
          <p class="version">Version ${VERSION} · <a href="https://game.michaelsturrup.com/" target="_blank" rel="noopener">Play the original 2D game</a></p>
        </div>
      </div>`,
      (code) => {
        if (code === 'Enter' || code === 'Space') go('start');
        else if (code === 'KeyC') go('chars');
        else if (code === 'KeyS') go('shop');
        else if (code === 'KeyA') go('ach');
        else if (code === 'KeyT') go('training');
        else if (code === 'KeyB') go('board');
        else if (code === 'KeyU') go('account');
        else return false; // O (Settings) is the page's
      },
      () => this.title(),
    );
    this.bind('button[data-act]', (i, el) => go(el.dataset.act));
  }

  // --- Online (src/ui/online.js) ---------------------------------------------------------
  leaderboard(mapId) {
    leaderboard(this, mapId);
  }

  account() {
    accountScreen(this, this.cloud);
  }

  profile(name, back = () => this.title()) {
    profile(this, name, back);
  }

  // The cloud save found progress on both sides: ask on the title, never mid-shift.
  conflict(local, cloud, choose) {
    this.pendingConflict = () => {
      this.pendingConflict = null;
      conflictScreen(this, local, cloud, choose);
    };
    if (this.el.querySelector('.panel.title')) this.title();
  }

  // --- Clock In ---------------------------------------------------------------------------
  // Pick a tech, then a map, then (once you've finished a shift) Shift Policies. Everything
  // starts on the last shift's picks, which are saved when the shift starts.
  // From the title: skips a step that has nothing to choose (one tech and nothing affordable
  // to hire, or one open map), so a brand-new player goes straight to work. "Change Tech"
  // on the end-of-shift screen still shows every step.
  clockIn() {
    const meta = this.meta;
    const pick = this.savedPick();
    pick.skipped = {};
    const chars = Object.keys(CHARACTERS);
    const hireable = (id) => !meta.isUnlocked(id) && meta.itemUnlocked('characters', id) && meta.data.pay >= CHARACTERS[id].cost;
    pick.skipped.char = chars.filter((id) => meta.isUnlocked(id)).length === 1 && !chars.some(hireable);
    pick.skipped.map = MAP_ORDER.filter((id) => meta.mapUnlocked(id)).length === 1;
    if (!pick.skipped.char) return this.setup('char', pick);
    if (!pick.skipped.map) return this.setup('map', pick);
    if (meta.policiesOpen()) return this.policies(pick);
    this.start(pick);
  }

  savedPick() {
    const d = this.meta.data;
    return { char: d.selected, map: d.map, policies: [...d.policies], reorg: d.reorg, hardcore: this.meta.hardcoreOn() };
  }

  start(pick) {
    this.sfx('click');
    this.meta.select(pick.char);
    this.meta.selectMap(pick.map);
    if (pick.policies) this.meta.setPolicies(pick.policies, pick.reorg);
    this.meta.setHardcore(pick.hardcore);
    this.onStart();
  }

  setup(step = 'char', pick) {
    const meta = this.meta;
    pick ??= this.savedPick();
    const withPolicies = meta.policiesOpen();
    const skipped = pick.skipped ?? {};
    const steps = (withPolicies ? 3 : 2) - (skipped.char ? 1 : 0) - (skipped.map ? 1 : 0);
    const isChar = step === 'char';
    const stepNo = isChar || skipped.char ? 1 : 2;
    const ids = isChar ? Object.keys(CHARACTERS) : MAP_ORDER;
    const usable = (id) => (isChar ? meta.isUnlocked(id) : meta.mapUnlocked(id));
    const key = isChar ? 'char' : 'map';
    const again = () => this.setup(step, pick);
    const next = () => {
      if (isChar && !skipped.map) {
        this.sfx('click');
        return this.setup('map', pick);
      }
      if (withPolicies) {
        this.sfx('click');
        return this.policies(pick);
      }
      this.start(pick);
    };
    // Hardcore (data/policies.js HARDCORE): a switch under the maps once every map is won.
    const withHardcore = !isChar && meta.hardcoreOpen();
    const toggleHardcore = () => {
      if (!withHardcore) return false;
      pick.hardcore = !pick.hardcore;
      this.sfx(pick.hardcore ? 'warn' : 'click');
      again();
    };
    const back = () => {
      this.sfx('click');
      if (isChar || skipped.char) {
        this.onPreview(); // back to the saved picks
        this.title();
      } else this.setup('char', pick);
    };
    // Tapping the highlighted card again moves on, so a double tap (or A twice) is enough.
    const choose = (i) => {
      const id = ids[i];
      if (!id) return;
      if (id === pick[key] && usable(id)) return next();
      if (isChar && !meta.isUnlocked(id)) {
        if (!meta.unlock(id)) return; // hire with Overtime Pay
        this.sim.achievements.check();
        this.sfx('chest');
      } else if (!usable(id)) return;
      else this.sfx('click');
      pick[key] = id;
      if (!isChar) this.onPreview(pick.char, pick.map); // walk out onto the map's floor
      again();
    };
    const move = (dir) => {
      const open = ids.filter(usable);
      const at = open.indexOf(pick[key]);
      pick[key] = open[(at + dir + open.length) % open.length];
      if (!isChar) this.onPreview(pick.char, pick.map);
      this.sfx('click');
      again();
    };
    const tech = CHARACTERS[pick.char];
    const nextLabel = isChar && !skipped.map ? 'Next: Map' : withPolicies ? 'Next: Policies' : `Clock In: ${MAPS[pick.map].name}${pick.hardcore && withHardcore ? ' (Hardcore)' : ''}`;
    this.show(
      `<div class="panel wide chars setup" tabindex="-1">
        <p class="setup-step">STEP ${stepNo} OF ${steps}</p>
        <h2>${isChar ? 'PICK YOUR TECH' : 'PICK YOUR MAP'}</h2>
        ${
          isChar
            ? `<p class="sub">Overtime Pay: ${PAY(meta.data.pay)}</p>`
            : skipped.char
              ? ''
              : `<button class="setup-tech" data-act="back">${this.techImg(pick.char, 40)}
                <span><b>${tech.name}</b><small>Change tech</small></span></button>`
        }
        <div class="cards">${ids.map((id, i) => (isChar ? this.charCard(id, i, pick.char === id, 'PICKED', 'Tap to pick') : this.mapCard(id, i, pick))).join('')}</div>
        ${
          withHardcore
            ? `<button class="hc-switch ${pick.hardcore ? 'on' : ''}" data-act="hardcore" aria-pressed="${!!pick.hardcore}">
                <span class="switch"></span>${icon('hardcore', 20)}<span><b>HARDCORE</b> ${pick.hardcore ? 'ON' : 'OFF'} <kbd>H</kbd>
                <small>${HARDCORE.desc}</small></span></button>`
            : ''
        }
        <div class="setup-bar">
          <button data-act="back">${isChar || skipped.char ? 'Cancel' : 'Back'} <kbd>Esc</kbd></button>
          <button class="primary" data-act="next">${nextLabel} <kbd>Enter</kbd></button>
        </div>
      </div>`,
      (code) => {
        if (DIGITS[code] !== undefined) choose(DIGITS[code]);
        else if (code === 'ArrowRight' || code === 'ArrowDown' || code === 'KeyD' || code === 'KeyS') move(1);
        else if (code === 'ArrowLeft' || code === 'ArrowUp' || code === 'KeyA' || code === 'KeyW') move(-1);
        else if (code === 'Enter' || code === 'Space') next();
        else if (code === 'Escape' || code === 'Backspace') back();
        else if (code === 'KeyH') return toggleHardcore();
        else return false;
      },
      again,
    );
    this.bind('.card', (i) => choose(i));
    this.bind('[data-act=hardcore]', toggleHardcore);
    this.bind('[data-act=back]', back);
    this.bind('[data-act=next]', next);
    this.el.querySelector('.card.selected')?.scrollIntoView({ block: 'nearest' });
  }

  // Clock In's last step: Shift Policies (data/policies.js). Tap a card to sign up to it or
  // drop it; the bar shows the pay and score multiplier. Hardcore shifts can't have perks.
  policies(pick) {
    const meta = this.meta;
    const hardcore = !!pick.hardcore && meta.hardcoreOpen();
    const allowed = (id) => meta.policyUnlocked(id) && (!hardcore || hardcoreOk(id));
    pick.policies = pick.policies.filter((id) => POLICIES[id] && allowed(id));
    if (!pick.policies.length) pick.reorg = false;
    // Redraw after a tap, keeping the list where it was scrolled to.
    const again = () => {
      const top = this.el.querySelector('.panel')?.scrollTop ?? 0;
      this.policies(pick);
      this.el.querySelector('.panel').scrollTop = top;
    };
    const picked = pick.policies;
    const full = picked.length >= POLICY_RULES.maxPicked;
    const mult = shiftMult(picked, pick.reorg, hardcore);
    const clashWith = (id) => picked.find((o) => o !== id && clashes(o, id));
    const toggle = (id) => {
      if (!allowed(id)) return;
      const at = picked.indexOf(id);
      if (at >= 0) picked.splice(at, 1);
      else if (full || clashWith(id)) return this.sfx('hurt');
      else picked.push(id);
      pick.reorg = false; // hand-picked: no dice bonus
      this.sfx('click');
      again();
    };
    const reorg = () => {
      const open = POLICY_ORDER.filter((id) => allowed(id));
      pick.policies = rollReorg(open);
      pick.reorg = pick.policies.length > 0;
      this.sfx('chest');
      again();
    };
    const clear = () => {
      pick.policies = [];
      pick.reorg = false;
      this.sfx('click');
      again();
    };
    // Steps that Clock In skipped (nothing to choose) are skipped on the way back too.
    const skipped = pick.skipped ?? {};
    const back = () => {
      this.sfx('click');
      if (!skipped.map) this.setup('map', pick);
      else if (!skipped.char) this.setup('char', pick);
      else this.title();
    };
    const stepNo = 3 - (skipped.char ? 1 : 0) - (skipped.map ? 1 : 0);
    const card = (id) => {
      const p = POLICIES[id];
      const n = POLICY_ORDER.indexOf(id) + 1;
      const on = picked.includes(id);
      const unlocked = meta.policyUnlocked(id);
      const open = allowed(id);
      const clash = !on && clashWith(id);
      const status = !unlocked
        ? `Locked: ${meta.policyLockText(id)}`
        : !open
          ? 'Not in Hardcore'
          : on
            ? '<b class="ok">SIGNED</b>'
            : clash
              ? `Can't combine with ${POLICIES[clash].name}`
              : full
                ? ''
                : '<span class="hint">Tap to sign</span>';
      const stamp = meta.data.policiesWon.includes(id) ? '<span class="pol-stamp" title="You\'ve won a shift with this">WON</span>' : '';
      const dim = open && !on && (full || clash);
      return `<button class="card policy ${p.group} ${on ? 'selected' : ''} ${open ? '' : 'locked'} ${dim ? 'dim' : ''}" data-id="${id}" ${open ? '' : 'disabled'}>
        <div class="card-head">${icon(unlocked ? p.icon : 'policy', 28)}<div class="card-name"><small>${n}.</small> ${unlocked ? p.name : '???'}</div><b class="pol-x">${fmtMult(p.mult)}</b></div>
        ${unlocked ? `<div class="card-text">${p.desc}</div>` : ''}
        ${status || stamp ? `<div class="char-status">${status}${stamp}</div>` : ''}
      </button>`;
    };
    const groups = POLICY_GROUPS.map(
      (gr) => `<div class="pol-group ${gr.id}">${gr.name.toUpperCase()} <small>${hardcore && gr.id === 'perk' ? 'Off in Hardcore.' : gr.note}</small></div>
        <div class="cards policies">${POLICY_ORDER.filter((id) => POLICIES[id].group === gr.id).map(card).join('')}</div>`,
    ).join('');
    const names = [...(hardcore ? ['Hardcore'] : []), ...picked.map((id) => POLICIES[id].name), ...(pick.reorg ? ['Reorg bonus'] : [])];
    const summary = names.length ? names.map((n) => `<b>${n}</b>`).join(' + ') : 'No policies: a normal shift.';
    const bonus = Math.round((POLICY_RULES.reorgBonus - 1) * 100);
    this.show(
      `<div class="panel wide chars setup" tabindex="-1">
        <p class="setup-step">STEP ${stepNo} OF ${stepNo}</p>
        <h2>SHIFT POLICIES</h2>
        <p class="sub">Optional. Up to ${POLICY_RULES.maxPicked}. Bad policies raise your Overtime Pay and leaderboard score, perks lower them.</p>
        <div class="pol-summary"><span>${summary}</span><b class="pol-total ${mult > 1 ? 'up' : mult < 1 ? 'down' : ''}">Pay and score ${fmtMult(mult)}</b></div>
        <div class="pol-tools">
          <button data-act="reorg" title="${POLICY_RULES.reorgCount} random bad policies, +${bonus}% while you keep them">🎲 Reorg <kbd>R</kbd></button>
          <button data-act="clear" ${picked.length ? '' : 'disabled'}>No policies <kbd>N</kbd></button>
        </div>
        <p class="pol-note">🎲 Reorg signs you up to ${POLICY_RULES.reorgCount} random bad policies for an extra +${bonus}% while you keep them.</p>
        ${groups}
        <div class="setup-bar">
          <button data-act="back">${stepNo === 1 ? 'Cancel' : 'Back'} <kbd>Esc</kbd></button>
          <button class="primary" data-act="next">Clock In: ${MAPS[pick.map].name}${hardcore ? ' (Hardcore)' : ''} <kbd>Enter</kbd></button>
        </div>
      </div>`,
      (code) => {
        if (code === 'Enter' || code === 'Space') this.start(pick);
        else if (code === 'Escape' || code === 'Backspace') back();
        else if (code === 'KeyR') reorg();
        else if (code === 'KeyN') clear();
        else return false;
      },
      again,
    );
    this.bind('.card.policy', (i, el) => toggle(el.dataset.id));
    this.bind('[data-act=reorg]', reorg);
    this.bind('[data-act=clear]', clear);
    this.bind('[data-act=back]', back);
    this.bind('[data-act=next]', () => this.start(pick));
  }

  // First Clock In ever: offer the training shift (once; it stays on the title screen).
  trainingOffer() {
    const m = this.meta;
    m.data.offeredTraining = true;
    m.save();
    const go = (act) => {
      this.sfx('click');
      if (act === 'training') this.onTraining();
      else this.clockIn();
    };
    this.show(
      `<div class="panel training" tabindex="-1">
        <h2>FIRST DAY?</h2>
        <p class="sub">A two-minute training shift shows you how to move, close tickets and level up.</p>
        <button class="primary" data-act="training">Start Training <kbd>Enter</kbd></button>
        <button data-act="skip">Skip, I know the drill <kbd>Esc</kbd></button>
        <p class="tiny">You can take training any time from the title screen.</p>
      </div>`,
      (code) => {
        if (code === 'Enter' || code === 'Space' || code === 'KeyT') go('training');
        else if (code === 'Escape') go('skip');
        else return false;
      },
    );
    this.bind('button', (i, el) => go(el.dataset.act));
  }

  // A tech's card, for the Clock In picker and Characters. Locked techs are hired with
  // Overtime Pay, and some need a map win first (data/unlocks.js).
  charCard(id, i, selected, selectedText, pickText, blurb = false) {
    const meta = this.meta;
    const c = CHARACTERS[id];
    const unlocked = meta.isUnlocked(id);
    const hireable = meta.itemUnlocked('characters', id);
    const afford = hireable && meta.data.pay >= c.cost;
    const status = selected
      ? `<b class="ok">${selectedText}</b>`
      : unlocked
        ? pickText
        : !hireable
          ? `Locked: win a shift in the ${MAPS[meta.unlockedBy('characters', id)].name}`
          : afford
            ? `Hire for ${PAY(c.cost)}`
            : `Need ${PAY(c.cost)}`;
    return `<button class="card char ${selected ? 'selected' : ''} ${unlocked ? '' : 'locked'}" data-i="${i}" ${!unlocked && !afford ? 'disabled' : ''}>
      <div class="card-head">${this.techImg(id)}
        <div class="card-name">${c.name}</div><kbd>${i + 1}</kbd></div>
      <div class="card-level">Starts with ${WEAPONS[c.starter].name}</div>
      <div class="card-text">${c.perk}</div>
      ${blurb ? `<div class="card-flavor">${c.blurb}</div>` : ''}
      <div class="char-status">${status}</div>
    </button>`;
  }

  // A map's card. Picking one shows its floor behind the menu.
  mapCard(id, i, pick) {
    const meta = this.meta;
    const m = MAPS[id];
    const unlocked = meta.mapUnlocked(id);
    const best = meta.data.mapBest[id];
    const status = pick.map === id
      ? '<b class="ok">PICKED</b>'
      : unlocked
        ? 'Tap to pick'
        : `Locked: win a shift in the ${MAPS[m.unlockAfter].name}`;
    return `<button class="card map ${pick.map === id ? 'selected' : ''} ${unlocked ? '' : 'locked'}" data-i="${i}" ${unlocked ? '' : 'disabled'}>
      <div class="card-head"><div><div class="card-name">${m.name}</div>
        <div class="card-level">${m.pay > 1 ? `${m.pay}x Overtime Pay` : 'Standard pay'}</div></div><kbd>${i + 1}</kbd></div>
      <div class="card-text">${m.twistText}</div>
      ${best ? `<div class="card-hint">Best: ${fmtTime(best.time)} · ${best.tickets.toLocaleString()} tickets · ${best.wins} won</div>` : ''}
      <div class="char-status">${status}</div>
    </button>`;
  }

  // --- Characters -------------------------------------------------------------------------
  characters() {
    const meta = this.meta;
    const ids = Object.keys(CHARACTERS);
    const act = (i) => {
      const id = ids[i];
      if (!id) return;
      if (meta.isUnlocked(id)) meta.select(id);
      else if (!meta.unlock(id)) return;
      else this.sim.achievements.check();
      this.sfx(meta.isUnlocked(id) ? 'chest' : 'click');
      this.onPreview();
      this.characters();
    };
    this.show(
      `<div class="panel wide chars" tabindex="-1">
        <h2>CHARACTERS</h2>
        <p class="sub">Overtime Pay: ${PAY(meta.data.pay)}</p>
        <div class="cards">${ids.map((id, i) => this.charCard(id, i, meta.data.selected === id, 'ON SHIFT', 'Select', true)).join('')}</div>
        <button class="back" data-act="back">Back <kbd>Esc</kbd></button>
      </div>`,
      (code) => {
        if (DIGITS[code] !== undefined) act(DIGITS[code]);
        else if (code === 'Escape' || code === 'Enter') this.title();
        else return false;
      },
      () => this.characters(),
    );
    this.bind('.card', (i) => act(i));
    this.bind('[data-act=back]', () => this.title());
  }

  // --- Overtime Shop: permanent upgrades ---------------------------------------------------
  shop() {
    const meta = this.meta;
    const ids = Object.keys(SHOP);
    const buy = (i) => {
      const id = ids[i];
      if (!id) return;
      if (meta.buy(id)) {
        this.sfx('chest');
        this.sim.achievements.check();
        this.shop();
      }
    };
    const row = (id, i) => {
      const d = SHOP[id];
      const lvl = meta.level(id);
      const cost = meta.nextCost(id);
      const max = d.costs.length;
      return `<button class="shop-row" data-i="${i}" ${cost === null || meta.data.pay < cost ? 'disabled' : ''}>
        ${icon(d.icon, 32)}
        <div class="shop-info"><div class="card-name">${d.name} <span class="pips">Lv ${lvl}/${max}</span></div>
          <div class="card-text">${d.desc}</div><div class="card-flavor">${d.flavor}</div></div>
        <div class="shop-cost">${cost === null ? '<b class="ok">MAXED</b>' : PAY(cost)}</div>
        <kbd>${i + 1}</kbd>
      </button>`;
    };
    this.show(
      `<div class="panel wide" tabindex="-1">
        <h2>OVERTIME SHOP</h2>
        <p class="sub">Balance: ${PAY(meta.data.pay)}. Upgrades are permanent and apply to every character.</p>
        <div class="shop-list">${ids.map(row).join('')}</div>
        <button class="back" data-act="back">Back <kbd>Esc</kbd></button>
      </div>`,
      (code) => {
        if (DIGITS[code] !== undefined) buy(DIGITS[code]);
        else if (code === 'Escape' || code === 'Enter') this.title();
        else return false;
      },
      () => this.shop(),
    );
    this.bind('.shop-row', (i) => buy(i));
    this.bind('[data-act=back]', () => this.title());
  }

  // --- Achievements -----------------------------------------------------------------------
  achievements() {
    const got = this.meta.data.achievements ?? {};
    const card = (a) => `<div class="ach ${got[a.id] ? '' : 'locked'}">${icon(a.icon, 32)}<div><b>${a.name}</b><span>${a.desc}</span></div></div>`;
    this.show(
      `<div class="panel wide" tabindex="-1">
        <h2>ACHIEVEMENTS</h2>
        <p class="sub">${Object.keys(got).length} of ${ACHIEVEMENTS.length} unlocked</p>
        <div class="ach-grid">${ACHIEVEMENTS.map(card).join('')}</div>
        <button class="back" data-act="back">Back <kbd>Esc</kbd></button>
      </div>`,
      (code) => {
        if (code === 'Escape' || code === 'Enter') this.title();
        else return false;
      },
      () => this.achievements(),
    );
    this.bind('[data-act=back]', () => this.title());
  }
}
