// Ported unchanged from the original's src/ui/screens/timeline.js.
// Shift timeline chart (idea 29) on the end-of-shift screen: three small charts on one
// time axis (sanity, tickets closed, damage dealt), with boss arrivals and revives marked.
// Data comes from src/sim/timeline.js. Tap or hover to read the values at a moment.

import { fmtTime } from './hud.js';

const BUCKETS = [5, 10, 15, 20, 30, 60, 120]; // seconds per bar: the first giving <= 30 bars

// tl: { step, points: [{ t, hp, kills, dmg }], marks: [{ t, kind, name }] }
function shape(tl) {
  const pts = tl.points;
  const end = Math.max(tl.step, pts[pts.length - 1]?.t ?? 0);
  const size = BUCKETS.find((b) => end / b <= 30) ?? 120;
  const n = Math.max(1, Math.ceil(end / size));
  const kills = new Array(n).fill(0);
  const dmg = new Array(n).fill(0);
  for (const p of pts) {
    if (!p.t) continue; // the 0:00 sample has nothing in it
    const i = Math.min(n - 1, Math.floor((p.t - 1) / size));
    kills[i] += p.kills;
    dmg[i] += p.dmg;
  }
  return { pts, end, size, n, kills, dmg };
}

const per = (size) => (size === 60 ? 'a minute' : size === 120 ? 'per 2 min' : `per ${size} s`);
const unit = (size) => (size === 60 ? '/min' : `/${size < 60 ? size + 's' : '2min'}`);

function bars(values, size, end, cls) {
  const top = Math.max(1, ...values);
  const gap = size * 0.18;
  return values
    .map((v, i) => {
      const h = (v / top) * 96;
      const w = Math.min(size, end - i * size) - gap;
      return v > 0 && w > 0 ? `<rect class="${cls}" x="${i * size + gap / 2}" y="${100 - h}" width="${w}" height="${h}"/>` : '';
    })
    .join('');
}

function marks(tl) {
  return tl.marks.map((m) => `<line class="tl-mark ${m.kind}" x1="${m.t}" x2="${m.t}" y1="0" y2="100"/>`).join('');
}

const svg = (end, body, tl) =>
  `<svg viewBox="0 0 ${end} 100" preserveAspectRatio="none" aria-hidden="true">${marks(tl)}${body}</svg>`;

export function timelineChart(tl) {
  if (!tl?.points?.length || tl.points.length < 3) return ''; // too short a shift to chart
  const d = shape(tl);
  const { pts, end, size } = d;
  const low = pts.reduce((a, p) => (p.hp < a.hp ? p : a), pts[0]);
  const peakK = d.kills.indexOf(Math.max(...d.kills));
  const peakD = d.dmg.indexOf(Math.max(...d.dmg));
  const line = pts.map((p) => `${p.t},${100 - p.hp}`).join(' ');
  const area = `0,100 ${line} ${pts[pts.length - 1].t},100`;
  const ticks = [];
  const every = end > 900 ? 300 : end > 300 ? 120 : 60;
  for (let t = 0; t <= end; t += every) ticks.push(`<span style="left:${(t / end) * 100}%">${fmtTime(t)}</span>`);
  const bosses = tl.marks.filter((m) => m.kind === 'boss');
  const revives = tl.marks.filter((m) => m.kind === 'revive');
  const markList = [
    ...bosses.map((m) => `<span><i class="tl-key boss"></i>${m.name} ${fmtTime(m.t)}</span>`),
    ...revives.map((m) => `<span><i class="tl-key revive"></i>Revived ${fmtTime(m.t)}</span>`),
  ].join('');
  const summary =
    `Shift timeline. Sanity was lowest at ${low.hp}% at ${fmtTime(low.t)}. ` +
    `Most tickets: ${d.kills[peakK].toLocaleString()} ${per(size)} around ${fmtTime(peakK * size)}. ` +
    `Most damage: ${d.dmg[peakD].toLocaleString()} ${per(size)} around ${fmtTime(peakD * size)}.` +
    (bosses.length ? ` Bosses: ${bosses.map((m) => `${m.name} at ${fmtTime(m.t)}`).join(', ')}.` : '');
  return `<figure class="timeline" role="img" aria-label="${summary.replace(/"/g, '&quot;')}">
      <div class="tools-head">Shift timeline</div>
      <p class="tl-read" aria-hidden="true">Tap or hover the chart to see a moment.</p>
      <div class="tl-plots" data-end="${end}" aria-hidden="true">
        <div class="tl-row"><div class="tl-name">Sanity <b>low ${low.hp}%</b></div>${svg(end, `<polygon class="tl-area" points="${area}"/><polyline class="tl-line" points="${line}"/>`, tl)}</div>
        <div class="tl-row"><div class="tl-name">Tickets ${unit(size)} <b>peak ${d.kills[peakK].toLocaleString()}</b></div>${svg(end, bars(d.kills, size, end, 'tl-bar tickets'), tl)}</div>
        <div class="tl-row"><div class="tl-name">Damage ${unit(size)} <b>peak ${d.dmg[peakD].toLocaleString()}</b></div>${svg(end, bars(d.dmg, size, end, 'tl-bar damage'), tl)}</div>
        <div class="tl-cursor" hidden></div>
      </div>
      <div class="tl-axis" aria-hidden="true">${ticks.join('')}</div>
      ${markList ? `<div class="tl-marks" aria-hidden="true">${markList}</div>` : ''}
    </figure>`;
}

// Hover / tap readout: the values at the time under the pointer, on one line above the chart.
export function wireTimeline(root, tl) {
  const plots = root.querySelector('.tl-plots');
  if (!plots) return;
  const d = shape(tl);
  const read = root.querySelector('.tl-read');
  const cursor = plots.querySelector('.tl-cursor');
  const show = (e) => {
    const r = plots.getBoundingClientRect();
    const k = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
    const t = k * d.end;
    const p = d.pts.reduce((a, q) => (Math.abs(q.t - t) < Math.abs(a.t - t) ? q : a), d.pts[0]);
    const i = Math.min(d.n - 1, Math.floor(t / d.size));
    const near = tl.marks.find((m) => Math.abs(m.t - t) <= d.size / 2);
    cursor.hidden = false;
    cursor.style.left = `${(p.t / d.end) * 100}%`;
    read.innerHTML =
      `<b>${fmtTime(p.t)}</b> Sanity ${p.hp}% · ${d.kills[i].toLocaleString()} tickets${unit(d.size)} · ${d.dmg[i].toLocaleString()} damage${unit(d.size)}` +
      (near ? ` · <b>${near.kind === 'boss' ? near.name : 'Revived'}</b>` : '');
  };
  plots.addEventListener('pointermove', show);
  plots.addEventListener('pointerdown', show);
}
