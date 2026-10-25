// Copied unchanged from the original (HelpDeskSurvivor data/).
// Sound settings. All sounds are synthesized in src/engine/audio.js (no audio files).
export const AUDIO = {
  masterVolume: 0.45,
  // Mixing (src/engine/audio.js): sound-effect compressor threshold (dB) and ratio, the
  // makeup gain after it, and how much room reverb the sound effects and music get.
  mastering: { threshold: -22, ratio: 3, makeup: 2.2, reverb: 0.5, sfxReverb: 0.12, musicReverb: 0.2 },
  musicVolume: 0.45, // background music, relative to the master volume (0 = off)
  musicTempo: 100, // beats per minute
  // Per-sound volume multipliers; set one to 0 to silence that sound.
  volume: {
    hit: 0.5, pop: 0.6, ticket: 0.5, levelup: 1, chest: 1, evolve: 1, hurt: 0.8, alarm: 0.9, siren: 1,
    boom: 0.5, heal: 0.8, pto: 0.8, bulk: 0.8, pulse: 0.2, ring: 0.7, whoosh: 0.7, victory: 1, burnout: 1, click: 0.5,
    bosshit: 0.6, shoot: 0.35, zap: 1.1, launch: 0.4, throw: 1, wipe: 0.35, deploy: 0.5, blip: 1, hum: 0.5,
    ping: 0.5, bubble: 0.5, snap: 0.45, mail: 0.5, ziptie: 0.6, error: 0.6, projector: 0.6, quack: 0.6, warn: 1, charge: 0.8, slosh: 0.7, scream: 0.7, phase2: 1, heartbeat: 0.28, combo: 0.7,
  },
};
