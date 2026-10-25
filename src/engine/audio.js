// Ported unchanged from the original (HelpDeskSurvivor src/engine/).
// Synthesized sound effects (WebAudio, no audio files). Every sound is a tiny recipe of
// oscillators and filtered noise. Browsers only allow audio after a key press or click,
// so initAudio() is called from the first input event. Volumes live in data/audio.js.
//
// Signal path: sounds -> sfx bus -> high shelf -> compressor ┐
//              music  -> music bus                          ├-> mix -> low cut -> limiter
//              both   -> a little room reverb               ┘       -> master -> speakers
// The compressor lifts quiet sounds and holds a busy boss fight together without
// pushing the music around; the limiter is a ceiling so nothing ever clips.

import { AUDIO } from '../../data/audio.js';
import { buzz } from './haptics.js';

const MUTE_KEY = 'helpdesk-survivors.muted';

let ctx = null;
let master = null;
let mix = null; // everything -> mastering chain
let sfxBus = null; // sound effects -> mix
let reverbSend = null; // -> room reverb -> mix
let sfxLevel = 1; // settings multipliers (0..1)
let musicLevel = 1;
let noise = null; // 1 s of white noise, reused by every noisy sound
let muted = false;
let detune = 0; // random pitch offset (cents) for the sound being built
let listenerX = 0; // world x the stereo field is centred on (the player)
let winStart = 0; // voice limiter: sounds started in the current 50 ms window
let winCount = 0;
const lastPlayed = {};

// Minimum seconds between two plays of the same sound, so 300 hits a second don't
// turn into a wall of noise.
const THROTTLE = {
  hit: 0.05, bosshit: 0.07, pop: 0.035, ticket: 0.04, hurt: 0.3, pulse: 0.1, boom: 0.08, ring: 0.3, whoosh: 0.15,
  shoot: 0.06, zap: 0.08, launch: 0.1, throw: 0.1, blip: 0.06, snap: 0.1, warn: 0.15, hum: 0.5, bubble: 0.3,
  ping: 0.3, deploy: 0.15, charge: 0.3, phase2: 1, slosh: 0.3, scream: 0.5, heartbeat: 0.4,
  mail: 0.2, ziptie: 0.2, error: 0.2, projector: 0.5, quack: 0.3,
};
// Random pitch spread (cents) so repeated sounds don't machine-gun.
const VARY = { quack: 120, mail: 80, ziptie: 120, hit: 120, bosshit: 80, pop: 150, ticket: 60, shoot: 100, zap: 150, throw: 120, blip: 80, snap: 100, boom: 80, whoosh: 100 };
// Never dropped by the voice limiter.
const PRIORITY = new Set(['levelup', 'chest', 'evolve', 'hurt', 'alarm', 'siren', 'victory', 'burnout', 'click', 'warn', 'heartbeat', 'heal', 'pto', 'bulk', 'wipe']);
const MAX_PER_WINDOW = 7;

try {
  muted = localStorage.getItem(MUTE_KEY) === '1';
} catch {
  // Storage blocked (private window, sandbox): just start unmuted.
}

// A short, dark, slightly uneven room: decaying stereo noise.
function roomImpulse(seconds, decay) {
  const len = Math.floor(ctx.sampleRate * seconds);
  const ir = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = ir.getChannelData(ch);
    let lp = 0;
    for (let i = 0; i < len; i++) {
      lp += 0.25 * (Math.random() * 2 - 1 - lp); // soften the tail
      d[i] = lp * Math.pow(1 - i / len, decay);
    }
  }
  return ir;
}

export function initAudio() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : AUDIO.masterVolume;
    master.connect(ctx.destination);
    // Mastering: a compressor for the sound effects; rumble cut and a hard ceiling for all.
    const m = AUDIO.mastering;
    const lowCut = ctx.createBiquadFilter();
    lowCut.type = 'highpass';
    lowCut.frequency.value = 35;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = m.threshold;
    comp.knee.value = 10;
    comp.ratio.value = m.ratio;
    comp.attack.value = 0.004;
    comp.release.value = 0.2;
    const makeup = ctx.createGain();
    makeup.gain.value = m.makeup;
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -2;
    limiter.knee.value = 0;
    limiter.ratio.value = 20;
    limiter.attack.value = 0.001;
    limiter.release.value = 0.08;
    mix = ctx.createGain();
    mix.connect(lowCut).connect(limiter).connect(master);
    // Room reverb, shared by sound effects and music.
    reverbSend = ctx.createGain();
    reverbSend.gain.value = 1;
    const verb = ctx.createConvolver();
    verb.buffer = roomImpulse(1.1, 3);
    const verbTone = ctx.createBiquadFilter();
    verbTone.type = 'lowpass';
    verbTone.frequency.value = 3500;
    const verbLevel = ctx.createGain();
    verbLevel.gain.value = m.reverb;
    reverbSend.connect(verb).connect(verbTone).connect(verbLevel).connect(mix);
    // Sound effects: a high shelf takes the fizz off the square and sawtooth waves.
    sfxBus = ctx.createGain();
    sfxBus.gain.value = sfxLevel;
    const shelf = ctx.createBiquadFilter();
    shelf.type = 'highshelf';
    shelf.frequency.value = 4500;
    shelf.gain.value = -5;
    sfxBus.connect(shelf).connect(comp).connect(makeup).connect(mix);
    const sfxVerb = ctx.createGain();
    sfxVerb.gain.value = m.sfxReverb;
    makeup.connect(sfxVerb).connect(reverbSend);
    noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  if (ctx.state === 'suspended') ctx.resume();
  if (wantMusic && !musicTimer) startScheduler();
}

export const isMuted = () => muted;

export function toggleMute() {
  muted = !muted;
  if (master) master.gain.value = muted ? 0 : AUDIO.masterVolume;
  try {
    localStorage.setItem(MUTE_KEY, muted ? '1' : '0');
  } catch {
    // Not persisted; fine.
  }
  return muted;
}

// Sounds placed in the world pan left/right relative to this x (call every frame).
export function setListener(x) {
  listenerX = x;
}

// One oscillator note with a pitch slide and a fast attack / exponential decay. Square
// and sawtooth notes go through a lowpass a few harmonics up, so they buzz instead of fizz.
function tone(type, f0, f1, start, dur, vol, out) {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.detune.value = detune;
  o.frequency.setValueAtTime(f0, start);
  if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, start + dur);
  g.gain.setValueAtTime(0.0001, start);
  g.gain.exponentialRampToValueAtTime(vol, start + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  if (type === 'square' || type === 'sawtooth') {
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = Math.min(9000, Math.max(f0, f1) * 6);
    o.connect(f).connect(g);
  } else o.connect(g);
  g.connect(out);
  o.start(start);
  o.stop(start + dur + 0.02);
}

// Filtered noise burst; the filter frequency slides from f0 to f1. A 3 ms fade-in
// avoids the click of starting noise at full volume.
function hiss(filter, f0, f1, start, dur, vol, out) {
  const s = ctx.createBufferSource();
  s.buffer = noise;
  s.detune.value = detune;
  const f = ctx.createBiquadFilter();
  f.type = filter;
  f.frequency.setValueAtTime(f0, start);
  f.frequency.exponentialRampToValueAtTime(f1, start + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, start);
  g.gain.exponentialRampToValueAtTime(vol, start + 0.003);
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  s.connect(f).connect(g).connect(out);
  s.start(start, Math.random() * 0.5);
  s.stop(start + dur + 0.02);
}

const arp = (type, notes, gap, len, vol, out, t) => notes.forEach((f, i) => tone(type, f, f, t + i * gap, len, vol, out));

const RECIPES = {
  hit: (t, o) => {
    tone('square', 260 + Math.random() * 60, 120, t, 0.04, 0.08, o);
    hiss('bandpass', 2500, 900, t, 0.03, 0.06, o);
  },
  // Hitting a boss: a heavier thud so you can hear you're getting through.
  bosshit: (t, o) => {
    tone('square', 150, 70, t, 0.07, 0.12, o);
    hiss('lowpass', 1600, 300, t, 0.06, 0.14, o);
  },
  pop: (t, o) => tone('triangle', 700 + Math.random() * 200, 180, t, 0.07, 0.25, o),
  ticket: (t, o) => tone('sine', 1100 + Math.random() * 300, 1700, t, 0.06, 0.18, o),
  pulse: (t, o) => {
    tone('sine', 140, 45, t, 0.18, 0.5, o);
    hiss('lowpass', 800, 150, t, 0.12, 0.12, o);
  },
  levelup: (t, o) => {
    arp('square', [523, 659, 784, 1047], 0.07, 0.12, 0.16, o, t);
    arp('triangle', [1047, 1319, 1568, 2093], 0.07, 0.2, 0.06, o, t + 0.02);
  },
  chest: (t, o) => {
    arp('triangle', [392, 523, 659, 784, 1047], 0.06, 0.2, 0.3, o, t);
    hiss('highpass', 6000, 9000, t + 0.3, 0.4, 0.08, o);
  },
  evolve: (t, o) => {
    tone('sawtooth', 110, 880, t, 0.6, 0.15, o);
    arp('square', [523, 659, 784, 1047, 1319, 1568], 0.08, 0.18, 0.15, o, t + 0.5);
  },
  hurt: (t, o) => {
    tone('sawtooth', 180, 60, t, 0.14, 0.3, o);
    hiss('lowpass', 1200, 200, t, 0.1, 0.2, o);
  },
  alarm: (t, o) => {
    for (let i = 0; i < 4; i++) tone('square', i % 2 ? 660 : 880, i % 2 ? 660 : 880, t + i * 0.18, 0.16, 0.15, o);
  },
  siren: (t, o) => {
    for (let i = 0; i < 3; i++) {
      tone('sawtooth', 300, 700, t + i * 0.7, 0.35, 0.18, o);
      tone('sawtooth', 700, 300, t + i * 0.7 + 0.35, 0.35, 0.18, o);
    }
  },
  boom: (t, o) => {
    hiss('lowpass', 900, 60, t, 0.45, 0.7, o);
    tone('sine', 90, 30, t, 0.35, 0.5, o);
  },
  heal: (t, o) => arp('sine', [440, 554, 659, 880], 0.05, 0.15, 0.3, o, t),
  pto: (t, o) => {
    for (const f of [523, 659, 784]) tone('triangle', f, f, t, 0.8, 0.15, o);
    arp('sine', [1047, 1319, 1568], 0.1, 0.4, 0.1, o, t + 0.1);
  },
  bulk: (t, o) => {
    for (let i = 0; i < 10; i++) tone('sine', 800 + i * 120, 1200 + i * 120, t + i * 0.03, 0.05, 0.12, o);
  },
  // The bridge call: two-tone office phone ring.
  ring: (t, o) => {
    for (let i = 0; i < 6; i++) {
      tone('sine', 440, 440, t + i * 0.05, 0.045, 0.12, o);
      tone('sine', 480, 480, t + i * 0.05, 0.045, 0.12, o);
    }
  },
  whoosh: (t, o) => hiss('bandpass', 400, 2400, t, 0.3, 0.5, o),
  victory: (t, o) => {
    arp('square', [523, 523, 523, 659, 784, 659, 784, 1047], 0.12, 0.2, 0.15, o, t);
    for (const f of [523, 659, 784, 1047]) tone('triangle', f, f, t + 1.0, 1.2, 0.12, o);
  },
  burnout: (t, o) => {
    [392, 370, 349, 262].forEach((f, i) => tone('sawtooth', f, i === 3 ? 196 : f, t + i * 0.35, i === 3 ? 0.9 : 0.3, 0.12, o));
  },
  click: (t, o) => tone('square', 900, 900, t, 0.03, 0.1, o),

  // --- Tools ---
  // Ticket Auto-Close, Auto-Scaling, Automated Triage: a rubber-stamp "pew".
  shoot: (t, o) => {
    tone('triangle', 950, 480, t, 0.06, 0.14, o);
    hiss('highpass', 3000, 1800, t, 0.025, 0.07, o);
  },
  // MFA Prompt: a crackle of electricity.
  zap: (t, o) => {
    for (let i = 0; i < 3; i++) tone('sawtooth', 1400 - i * 250, 300, t + i * 0.022, 0.04, 0.07, o);
    hiss('bandpass', 4500, 1800, t, 0.09, 0.12, o);
  },
  // Remote Desktop Session: a rising "connecting" whoop.
  launch: (t, o) => {
    tone('sine', 320, 960, t, 0.14, 0.16, o);
    tone('triangle', 640, 1920, t + 0.02, 0.1, 0.05, o);
  },
  // KB Article: paper flapping through the air.
  throw: (t, o) => {
    hiss('bandpass', 1200, 3400, t, 0.1, 0.22, o);
    hiss('bandpass', 3000, 1300, t + 0.07, 0.1, 0.14, o);
  },
  // Reimage: the disk spins up, then the whole floor gets wiped.
  wipe: (t, o) => {
    tone('sawtooth', 70, 1400, t, 0.35, 0.1, o);
    hiss('lowpass', 2200, 70, t + 0.3, 0.7, 0.55, o);
    tone('sine', 75, 28, t + 0.3, 0.6, 0.55, o);
  },
  // PowerShell Script: a terminal pops up (deploy), then types bolts (blip).
  combo: (t, o) => arp('square', [784, 988, 1175, 1568], 0.045, 0.06, 0.12, o, t),
  deploy: (t, o) => arp('square', [880, 1318], 0.05, 0.07, 0.09, o, t),
  blip: (t, o) => tone('square', 1500, 1300, t, 0.025, 0.05, o),
  // Firewall: shields hum up.
  hum: (t, o) => {
    tone('sawtooth', 110, 110, t, 0.45, 0.06, o);
    tone('sine', 220, 330, t, 0.4, 0.1, o);
  },
  // Ping Sweep: a sonar ping each time the beam comes round.
  ping: (t, o) => {
    tone('sine', 1320, 1300, t, 0.5, 0.1, o);
    tone('sine', 1980, 1960, t, 0.25, 0.03, o);
  },
  // Out-of-Office Reply: a bubble inflates.
  bubble: (t, o) => {
    tone('sine', 300, 900, t, 0.18, 0.22, o);
    tone('sine', 600, 1500, t + 0.03, 0.12, 0.08, o);
  },
  // Patch Cable, and the Rat's Nest's lash: a cable cracking like a whip.
  snap: (t, o) => {
    hiss('highpass', 2500, 6500, t, 0.05, 0.45, o);
    tone('square', 1800, 380, t, 0.045, 0.08, o);
  },
  // Reply-All Storm: the new-mail chime, times everyone.
  mail: (t, o) => {
    arp('sine', [1175, 1568], 0.07, 0.12, 0.16, o, t);
    hiss('bandpass', 1500, 4000, t, 0.12, 0.1, o);
  },
  // Zip Ties: the ratchet zipping shut.
  ziptie: (t, o) => {
    for (let i = 0; i < 6; i++) tone('square', 2400 - i * 120, 2000 - i * 120, t + i * 0.018, 0.012, 0.06, o);
  },
  // Password Expired: the "that didn't work" dud.
  error: (t, o) => {
    tone('square', 330, 330, t, 0.09, 0.1, o);
    tone('square', 247, 240, t + 0.1, 0.16, 0.1, o);
  },
  // Screen Share: the projector fan whirs up.
  projector: (t, o) => {
    tone('sawtooth', 90, 150, t, 0.4, 0.05, o);
    hiss('bandpass', 600, 1600, t, 0.35, 0.12, o);
  },
  // Rubber Duck: a squeaky quack.
  quack: (t, o) => {
    tone('sawtooth', 620, 420, t, 0.09, 0.12, o);
    tone('square', 900, 560, t + 0.01, 0.07, 0.05, o);
  },

  // --- Bosses ---
  // An attack is about to land (telegraph): two short beeps.
  warn: (t, o) => arp('square', [1046, 1046], 0.1, 0.06, 0.13, o, t),
  // The Executive and the Night Janitor charging.
  charge: (t, o) => {
    tone('sawtooth', 130, 55, t, 0.45, 0.14, o);
    hiss('lowpass', 700, 120, t, 0.45, 0.35, o);
  },
  // The Night Janitor's mop.
  slosh: (t, o) => {
    hiss('lowpass', 900, 250, t, 0.35, 0.45, o);
    hiss('bandpass', 500, 1400, t + 0.05, 0.22, 0.18, o);
  },
  // The Angry Caller screaming down the line.
  scream: (t, o) => {
    for (const f of [520, 565, 610]) tone('sawtooth', f, f * 1.7, t, 0.5, 0.07, o);
    hiss('bandpass', 1500, 2600, t, 0.45, 0.2, o);
  },
  // A boss enters its second phase: a low growl under three rising stabs.
  phase2: (t, o) => {
    tone('sawtooth', 220, 55, t, 0.9, 0.2, o);
    tone('square', 110, 40, t, 0.9, 0.1, o);
    arp('square', [392, 466, 587], 0.12, 0.1, 0.12, o, t + 0.05);
    hiss('lowpass', 1400, 90, t, 0.8, 0.45, o);
  },
  // Low sanity: your pulse.
  heartbeat: (t, o) => {
    tone('sine', 75, 48, t, 0.13, 0.55, o);
    tone('sine', 70, 45, t + 0.17, 0.11, 0.4, o);
  },
};

// Plays a named sound if audio is running and the sound isn't throttled. Pass a world
// `x` to place it left or right of the player.
export function sfx(name, x) {
  buzz(name);
  if (!ctx || muted || sfxLevel <= 0 || ctx.state !== 'running') return;
  const now = ctx.currentTime;
  const gap = THROTTLE[name];
  if (gap && now - (lastPlayed[name] ?? -1) < gap) return;
  // Voice limiter: in a crowd, only a handful of sounds may start every 50 ms.
  if (now - winStart > 0.05) (winStart = now), (winCount = 0);
  if (!PRIORITY.has(name) && ++winCount > MAX_PER_WINDOW) return;
  lastPlayed[name] = now;
  const vol = AUDIO.volume[name] ?? 1;
  if (vol <= 0) return;
  const out = ctx.createGain();
  out.gain.value = vol;
  if (x !== undefined && ctx.createStereoPanner) {
    const pan = ctx.createStereoPanner();
    pan.pan.value = Math.max(-1, Math.min(1, (x - listenerX) / 220)) * 0.6;
    out.connect(pan).connect(sfxBus);
  } else out.connect(sfxBus);
  detune = (Math.random() * 2 - 1) * (VARY[name] ?? 0);
  RECIPES[name](now + 0.01, out);
  detune = 0;
}

// --- Background music -----------------------------------------------------------------
// An original, looping synth track in the spirit of 90s corporate hold music: mellow
// electric-piano chords, a walking synth bass, a soft drum machine and a lead through a
// tape-style echo. Written for this game (not a copy of any real hold tune). The
// sequencer schedules notes slightly ahead of time on the audio clock, so it stays in
// time even when frames drop.

const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);
const STEPS_PER_BAR = 16;
// One chord per bar, looping every 4 bars: Dm9, G13, Cmaj9, Am7.
const CHORDS = [
  { bass: 38, notes: [53, 57, 60, 64] },
  { bass: 43, notes: [53, 59, 64, 65] },
  { bass: 36, notes: [52, 55, 59, 62] },
  { bass: 45, notes: [55, 60, 64, 67] },
];
// Lead melody, 8 bars (phrase A then phrase B): [step, note, length in steps].
const MELODY = [
  [[0, 69, 3], [3, 72, 3], [6, 74, 2], [8, 72, 2], [10, 69, 4], [14, 67, 2]],
  [[0, 65, 3], [3, 67, 3], [6, 69, 6], [12, 71, 2], [14, 72, 2]],
  [[0, 74, 4], [4, 76, 2], [6, 74, 2], [8, 71, 4], [12, 67, 4]],
  [[0, 69, 6], [6, 67, 2], [8, 64, 4], [12, 62, 4]],
  [[0, 77, 2], [2, 76, 2], [4, 74, 2], [6, 72, 4], [10, 74, 2], [12, 76, 4]],
  [[0, 74, 8], [8, 71, 2], [10, 72, 2], [12, 74, 4]],
  [[0, 76, 3], [3, 79, 3], [6, 76, 2], [8, 74, 4], [12, 71, 4]],
  [[0, 69, 8], [8, 72, 2], [10, 71, 2], [12, 69, 4]],
];
const CHORD_HITS = [0, 6, 10]; // syncopated electric-piano stabs within each bar
const BASS_LINE = [[0, 0], [3, 12], [8, 7], [11, 0], [14, 10]]; // [step, semitones above root]

let musicBus = null;
let echoIn = null;
let wantMusic = false;
let musicTimer = 0;
let nextStepTime = 0;
let step = 0;
let ducked = false;
let delayNode = null;
// Per-map remix (data/maps.js `music`).
let style = { transpose: 0, tempo: 1, lead: 'square', cutoff: 1400 };
const stepSec = () => 60 / (AUDIO.musicTempo * style.tempo) / 4;

export function setMusicStyle(s) {
  style = { ...style, ...s };
  if (delayNode) delayNode.delayTime.value = stepSec() * 3; // dotted eighth
}

function musicGain() {
  return (AUDIO.musicVolume ?? 0.5) * musicLevel * (ducked ? 0.35 : 1);
}

// Settings sliders (0..1). Safe to call before audio has started.
export function setVolumes(sfx, music) {
  sfxLevel = sfx;
  musicLevel = music;
  if (sfxBus) sfxBus.gain.value = sfx;
  if (musicBus && musicTimer) musicBus.gain.setTargetAtTime(Math.max(0.0001, musicGain()), ctx.currentTime, 0.05);
}

// Stereo placement for the chord voices and drums (built with the music bus).
let padL = null;
let padR = null;
let hatPan = null;

function panned(pan) {
  if (!ctx.createStereoPanner) return musicBus;
  const p = ctx.createStereoPanner();
  p.pan.value = pan;
  p.connect(musicBus);
  return p;
}

function buildMusicBus() {
  musicBus = ctx.createGain();
  musicBus.gain.value = musicGain();
  musicBus.connect(mix);
  const verb = ctx.createGain();
  verb.gain.value = AUDIO.mastering.musicReverb;
  musicBus.connect(verb).connect(reverbSend);
  padL = panned(-0.35);
  padR = panned(0.35);
  hatPan = panned(0.25);
  // Feedback echo for the lead.
  echoIn = ctx.createGain();
  echoIn.gain.value = 1;
  const delay = (delayNode = ctx.createDelay(1));
  delay.delayTime.value = stepSec() * 3; // dotted eighth
  const fb = ctx.createGain();
  fb.gain.value = 0.32;
  const tone = ctx.createBiquadFilter();
  tone.type = 'lowpass';
  tone.frequency.value = 2200;
  echoIn.connect(musicBus);
  echoIn.connect(delay);
  delay.connect(tone).connect(fb).connect(delay);
  tone.connect(panned(-0.4)); // the echo answers from the left
}

// Soft note with attack/release, through an optional lowpass.
function synth(type, freq, t, dur, vol, out, cutoff, detune = 0) {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.value = freq;
  o.detune.value = detune;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.015);
  g.gain.exponentialRampToValueAtTime(vol * 0.6, t + dur * 0.5);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  if (cutoff) {
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = cutoff;
    o.connect(f).connect(g);
  } else o.connect(g);
  g.connect(out);
  o.start(t);
  o.stop(t + dur + 0.05);
}

function scheduleStep(s, t) {
  const sec = stepSec();
  const tr = style.transpose;
  const bar = Math.floor(s / STEPS_PER_BAR);
  const inBar = s % STEPS_PER_BAR;
  const chord = CHORDS[bar % CHORDS.length];
  if (CHORD_HITS.includes(inBar)) {
    for (const n of chord.notes) {
      synth('triangle', midi(n + tr), t, sec * 5, 0.05, padL, 1800, -6);
      synth('sine', midi(n + tr), t, sec * 5, 0.04, padR, 0, 6);
    }
  }
  for (const [st, semi] of BASS_LINE) if (st === inBar) synth('sawtooth', midi(chord.bass + semi + tr), t, sec * 2.5, 0.12, musicBus, 500);
  for (const [st, n, len] of MELODY[bar % MELODY.length]) {
    if (st === inBar) synth(style.lead, midi(n + tr), t, sec * len, style.lead === 'sawtooth' ? 0.035 : 0.045, echoIn, style.cutoff);
  }
  // Drum machine: kick on 1 and 3, snare on 2 and 4, soft closed hats on eighths.
  if (inBar === 0 || inBar === 8) tone('sine', 110, 40, t, 0.18, 0.35, musicBus);
  if (inBar === 4 || inBar === 12) hiss('bandpass', 1800, 900, t, 0.14, 0.18, musicBus);
  if (inBar % 2 === 0) hiss('highpass', 7000, 8000, t, 0.03, inBar % 4 ? 0.025 : 0.04, hatPan);
}

function scheduler() {
  if (!ctx || ctx.state !== 'running') return;
  const sec = stepSec();
  if (nextStepTime < ctx.currentTime) nextStepTime = ctx.currentTime + 0.05; // after a stall
  while (nextStepTime < ctx.currentTime + 0.25) {
    scheduleStep(step, nextStepTime);
    step = (step + 1) % (STEPS_PER_BAR * MELODY.length);
    nextStepTime += sec;
  }
}

function startScheduler() {
  if (!ctx || musicTimer) return;
  if (!musicBus) buildMusicBus();
  step = 0;
  nextStepTime = ctx.currentTime + 0.1;
  musicBus.gain.setTargetAtTime(musicGain(), ctx.currentTime, 0.05);
  musicTimer = setInterval(scheduler, 50);
}

// Starts the loop from the top (or as soon as audio is allowed to start).
export function startMusic() {
  wantMusic = true;
  ducked = false;
  if (musicTimer) {
    clearInterval(musicTimer);
    musicTimer = 0;
  }
  startScheduler();
}

export function stopMusic() {
  wantMusic = false;
  if (musicTimer) clearInterval(musicTimer);
  musicTimer = 0;
  if (musicBus) musicBus.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.15);
}

// Quieter while paused.
export function duckMusic(on) {
  ducked = on;
  if (musicBus && musicTimer) musicBus.gain.setTargetAtTime(musicGain(), ctx.currentTime, 0.1);
}
