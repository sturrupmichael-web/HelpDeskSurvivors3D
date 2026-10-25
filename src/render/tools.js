// Draws the tools ported in Milestone 9: lightning chains, the patch-cable lash, the
// projector beam, the radar sweep, deployment rings, the out-of-office bubble, coffee
// puddles, zip ties, Terraform grids, rubber ducks, script turrets and the Delegate
// helpers. (Their bolts and discs are projectiles, drawn by weapons.js.) It only reads
// weapon state from the simulation.
//
// Most of it goes through a few shared instanced batches: floor decals and glowing
// strokes with a per-instance color and opacity, and one batch per prop model. Tools
// with a mesh of their own (a beam, a bubble) make it once, the first time they're seen.

import * as THREE from 'three';
import { TOOL_MODELS, PROJECTILE_MODELS, flatMaterial, toonMaterial, outlineMaterial, box, px } from './models.js';
import { FOOT } from '../sim/player.js';
import { MAX_CHAINS, COLORS as CHAIN_COLORS } from '../sim/weapons/chain.js';
import { duckSpot, duckCount } from '../sim/weapons/duck.js';
import { SHOW as WHIP_SHOW } from '../sim/weapons/whip.js';

const TAU = Math.PI * 2;
const BEAM_H = 0.8; // the projector beam and lightning start at about hand height
const CHAIN_H = 0.9;
const WHIP_H = 0.6;
const lerp = (a, b, t) => a + (b - a) * t;

const m = new THREE.Matrix4();
const q = new THREE.Quaternion();
const pos = new THREE.Vector3();
const scl = new THREE.Vector3();
const dir = new THREE.Vector3();
const zAxis = new THREE.Vector3(0, 0, 1);
const yAxis = new THREE.Vector3(0, 1, 0);
const color = new THREE.Color();
const spot = { x: 0, y: 0 };

// A see-through material whose instances each have their own opacity (`aAlpha`), so one
// batch can hold things at different stages of fading. Instance colors tint it.
function alphaMaterial(additive, depthTest = true) {
  const mat = new THREE.MeshBasicMaterial({
    transparent: true, depthWrite: false, depthTest, side: THREE.DoubleSide,
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
  });
  mat.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aAlpha;\nvarying float vAlpha;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvAlpha = aAlpha;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vAlpha;')
      .replace('#include <alphamap_fragment>', '#include <alphamap_fragment>\ndiffuseColor.a *= vAlpha;');
  };
  mat.customProgramCacheKey = () => 'alpha';
  return mat;
}

// An instanced batch of one shape with a color and opacity per instance.
class Batch {
  // `overlay` draws it over everything, like the original drew lightning on top.
  constructor(scene, geo, capacity, { additive = false, order = 0, overlay = false } = {}) {
    geo = geo.clone();
    this.alpha = new THREE.InstancedBufferAttribute(new Float32Array(capacity), 1);
    this.alpha.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('aAlpha', this.alpha);
    this.mesh = new THREE.InstancedMesh(geo, alphaMaterial(additive, !overlay), capacity);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.setColorAt(0, color.set('#ffffff')); // creates instanceColor
    this.mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = order;
    this.mesh.count = 0;
    this.capacity = capacity;
    scene.add(this.mesh);
  }
  begin() {
    this.mesh.count = 0;
  }
  // Adds an instance with matrix `m`, color `hex` (a string or THREE.Color) and opacity.
  add(matrix, hex, opacity) {
    const i = this.mesh.count;
    if (i >= this.capacity || opacity <= 0) return;
    this.mesh.setMatrixAt(i, matrix);
    this.mesh.setColorAt(i, hex.isColor ? hex : color.set(hex));
    this.alpha.array[i] = opacity;
    this.mesh.count++;
  }
  // A flat shape on the floor at (x, z), sized (sx, sz) and turned by `yaw`.
  floor(x, z, sx, sz, yaw, hex, opacity, y = 0.02) {
    q.setFromAxisAngle(yAxis, yaw);
    this.add(m.compose(pos.set(x, y, z), q, scl.set(sx, 1, sz)), hex, opacity);
  }
  // A bar from (ax, ay, az) to (bx, by, bz), `w` thick (the shape is a unit box).
  stroke(ax, ay, az, bx, by, bz, w, hex, opacity) {
    dir.set(bx - ax, by - ay, bz - az);
    const len = dir.length();
    if (len < 1e-4) return;
    q.setFromUnitVectors(zAxis, dir.divideScalar(len));
    this.add(m.compose(pos.set((ax + bx) / 2, (ay + by) / 2, (az + bz) / 2), q, scl.set(w, w, len)), hex, opacity);
  }
  end() {
    if (!this.mesh.count) return;
    this.mesh.instanceMatrix.needsUpdate = true;
    this.mesh.instanceColor.needsUpdate = true;
    this.alpha.needsUpdate = true;
  }
}

// One instanced batch of a solid model (ducks, turrets, zip ties), optionally toon-shaded
// and outlined like the people.
class Props {
  constructor(scene, geo, capacity, { toon = false } = {}) {
    this.mesh = new THREE.InstancedMesh(geo, toon ? toonMaterial : flatMaterial, capacity);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = true;
    this.mesh.count = 0;
    scene.add(this.mesh);
    if (toon) {
      this.ink = new THREE.InstancedMesh(geo, outlineMaterial, capacity);
      this.ink.instanceMatrix = this.mesh.instanceMatrix;
      this.ink.frustumCulled = false;
      this.ink.count = 0;
      scene.add(this.ink);
    }
    this.capacity = capacity;
  }
  begin() {
    this.mesh.count = 0;
  }
  // At (x, y, z), turned by `yaw` (and tipped sideways by `roll`), scaled by `s`.
  add(x, y, z, yaw, s = 1, roll = 0) {
    if (this.mesh.count >= this.capacity) return;
    euler.set(0, yaw, roll);
    q.setFromEuler(euler);
    this.mesh.setMatrixAt(this.mesh.count++, m.compose(pos.set(x, y, z), q, scl.setScalar(s)));
  }
  end() {
    if (this.ink) this.ink.count = this.mesh.count;
    if (this.mesh.count) this.mesh.instanceMatrix.needsUpdate = true;
  }
}
const euler = new THREE.Euler(0, 0, 0, 'YXZ');

// Shapes, made once.
const DISC = new THREE.CircleGeometry(1, 32).rotateX(-Math.PI / 2);
const RING = new THREE.RingGeometry(0.94, 1, 48).rotateX(-Math.PI / 2);
const TILE = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
const FRAME = new THREE.RingGeometry(0.82, 1, 4, 1, Math.PI / 4).rotateX(-Math.PI / 2).scale(Math.SQRT1_2, 1, Math.SQRT1_2);
const BAR = new THREE.BoxGeometry(1, 1, 1);
const WALL_H = 0.5;

// A ring wall that fades toward its top (as for the reboot shockwave).
function wallGeometry() {
  const g = new THREE.CylinderGeometry(1, 1, WALL_H, 48, 1, true);
  g.translate(0, WALL_H / 2, 0);
  const n = g.attributes.position.count;
  const c = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) c.set([1, 1, 1, g.attributes.position.getY(i) > WALL_H / 2 ? 0 : 1], i * 4);
  g.setAttribute('color', new THREE.BufferAttribute(c, 4));
  return g;
}
const WALL = wallGeometry();

// The projector's light: a flat trapezoid from the tech (0.6 wide) to the slide (1 wide),
// unit length along +z and unit half-width, brighter toward the tech.
function beamGeometry() {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([-0.6, 0, 0, 0.6, 0, 0, 1, 0, 1, -1, 0, 1], 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute([1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0.55, 1, 1, 1, 0.55], 4));
  g.setIndex([0, 2, 1, 0, 3, 2]);
  return g;
}
const BEAM = beamGeometry();

// The radar's afterglow: a fan of unit radius covering `width` radians behind the beam
// (angles -width..0, in the floor's x-z plane), fading from the beam backward.
function fanGeometry(width, segments = 12) {
  const p = [0, 0, 0];
  const c = [1, 1, 1, 0.7];
  for (let i = 0; i <= segments; i++) {
    const a = -width * (i / segments);
    p.push(Math.cos(a), 0, Math.sin(a));
    c.push(1, 1, 1, 0.7 * (1 - i / segments));
  }
  const idx = [];
  for (let i = 1; i <= segments; i++) idx.push(0, i, i + 1);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(c, 4));
  g.setIndex(idx);
  return g;
}

const fade = (hex, { vertexColors = false, glow = false } = {}) =>
  new THREE.MeshBasicMaterial({
    color: hex, transparent: true, depthWrite: false, side: THREE.DoubleSide, vertexColors,
    blending: glow ? THREE.AdditiveBlending : THREE.NormalBlending,
  });

function hidden(geo, mat, order = 0) {
  const mesh = new THREE.Mesh(geo, mat);
  mesh.visible = false;
  mesh.renderOrder = order;
  return mesh;
}

export class ToolView {
  constructor(scene) {
    this.scene = scene;
    // Floor decals (puddles, grid tiles) under everyone, and glowing strokes (lightning,
    // scanlines, radar beams) that add light.
    this.decals = new Batch(scene, DISC, 256, { order: -2 });
    this.tiles = new Batch(scene, TILE, 512, { order: -2 });
    this.frames = new Batch(scene, FRAME, 512, { order: -2 });
    this.glow = new Batch(scene, BAR, 1024, { additive: true, order: 2 });
    this.bolts = new Batch(scene, BAR, 512, { additive: true, order: 6, overlay: true });
    this.cable = new Batch(scene, BAR, 128);
    this.props = {};
    for (const id of ['duck', 'turret', 'turret_evo', 'ziptie']) this.props[id] = new Props(scene, TOOL_MODELS[id](), id === 'ziptie' ? 64 : 16);
    for (const id of ['helper', 'helper_evo']) this.props[id] = new Props(scene, TOOL_MODELS[id](), 24, { toon: true });
    this.plugs = new Props(scene, box(0.44, 0.28, 0.34, '#94b0c2'), 4); // the whip's RJ45 plug
    this.propList = [...Object.values(this.props), this.plugs];
    this.batches = [this.decals, this.tiles, this.frames, this.glow, this.bolts, this.cable];
    this.tools = []; // per-tool meshes, made once per tool: { w, meshes, seen, ... }
  }

  // (x, z): the tech's interpolated feet, in scene units.
  update(sim, alpha, dt, x, z) {
    for (const b of this.batches) b.begin();
    for (const b of this.propList) b.begin();
    for (let i = 0; i < this.tools.length; i++) this.tools[i].seen = false;
    const p = sim.player;
    const time = sim.time;
    for (let i = 0; i < p.weapons.length + p.innate.length; i++) {
      const w = i < p.weapons.length ? p.weapons[i] : p.innate[i - p.weapons.length];
      switch (w.def.behavior) {
        case 'chain': this.chain(w); break;
        case 'whip': this.whip(w, p, x, z); break;
        case 'beam': this.beam(w, p, time, x, z); break;
        case 'sweep': this.sweep(w, p, alpha, x, z); break;
        case 'rollout': this.rollout(w, x, z); break;
        case 'shield': this.shield(w, p, time, x, z); break;
        case 'trail': this.trail(w, p); break;
        case 'trap': this.trap(w, p); break;
        case 'grid': this.grid(w); break;
        case 'duck': this.duck(w, p, alpha, time, x, z); break;
        case 'turret': this.turret(w); break;
        case 'minion': this.minion(w, alpha); break;
      }
    }
    for (const b of this.batches) b.end();
    for (const b of this.propList) b.end();
    for (let i = this.tools.length - 1; i >= 0; i--) if (!this.tools[i].seen) this.dropTool(i);
  }

  tool(w, make) {
    let t = null;
    for (let i = 0; i < this.tools.length; i++) if (this.tools[i].w === w) t = this.tools[i];
    if (!t) {
      t = make();
      t.w = w;
      for (const mesh of t.meshes) this.scene.add(mesh);
      this.tools.push(t);
    }
    t.seen = true;
    return t;
  }

  dropTool(i) {
    for (const mesh of this.tools[i].meshes) {
      this.scene.remove(mesh);
      mesh.material.dispose();
      if (mesh.userData.ownGeometry) mesh.geometry.dispose();
    }
    this.tools.splice(i, 1);
  }

  // MFA Prompt, Passwordless, Password Expired: jagged bolts from you to each user hit,
  // re-jittered every frame, an outer glow and a bright core.
  chain(w) {
    if (w.flashT <= 0) return;
    const a = Math.min(1, w.flashT / 0.12);
    const layers = w.def.colors ?? CHAIN_COLORS;
    for (let c = 0; c < MAX_CHAINS; c++) {
      const path = w.paths[c];
      const n = w.pathN[c];
      if (n < 4) continue;
      for (let l = 0; l < layers.length; l++) {
        const hex = layers[l][0];
        const jitter = px(layers[l][1]);
        const width = l === 0 ? 0.16 : 0.06;
        let ax = px(path[0]);
        let az = px(path[1] + 16);
        let ay = CHAIN_H;
        for (let i = 2; i < n; i += 2) {
          const bx = px(path[i]);
          const bz = px(path[i + 1] + 16);
          const mx = (ax + bx) / 2 + (Math.random() - 0.5) * jitter * 2;
          const mz = (az + bz) / 2 + (Math.random() - 0.5) * jitter * 2;
          const my = CHAIN_H + (Math.random() - 0.5) * jitter * 2;
          this.bolts.stroke(ax, ay, az, mx, my, mz, width, hex, a);
          this.bolts.stroke(mx, my, mz, bx, CHAIN_H, bz, width, hex, a);
          ax = bx;
          ay = CHAIN_H;
          az = bz;
        }
      }
    }
  }

  // Patch Cable: a cable bowing sideways as it flies out (both ways from `sides: 2`), an
  // RJ45 plug on the end. Fiber Backbone: the cable whirls all the way round.
  whip(w, p, x, z) {
    if (w.flash <= 0) return;
    const s = w.stats;
    const range = px(s.range * p.stats.area);
    const t = 1 - w.flash / WHIP_SHOW;
    const a = Math.min(1, (w.flash / WHIP_SHOW) * 1.6);
    const N = 12;
    if (s.full) {
      const a0 = t * TAU;
      const r = range * 0.85;
      for (let i = 0; i < N * 2; i++) {
        const t0 = a0 + (i / (N * 2)) * TAU * 0.8;
        const t1 = a0 + ((i + 1) / (N * 2)) * TAU * 0.8;
        const ax = x + Math.cos(t0) * r;
        const az = z + Math.sin(t0) * r;
        const bx = x + Math.cos(t1) * r;
        const bz = z + Math.sin(t1) * r;
        this.cable.stroke(ax, WHIP_H, az, bx, WHIP_H, bz, 0.26, w.def.color, a);
        this.glow.stroke(ax, WHIP_H + 0.1, az, bx, WHIP_H + 0.1, bz, 0.08, '#f4f4f4', a);
      }
      return;
    }
    for (let side = 0; side < (s.sides > 1 ? 2 : 1); side++) {
      const d = side ? -1 : 1;
      const ux = w.ux * d;
      const uz = w.uy * d;
      const len = range * Math.min(1, t * 2.5);
      const sag = px(Math.sin(t * Math.PI) * 10);
      // A quadratic curve from the hand, through a control point pulled sideways, to the tip.
      const sx = x + ux * 0.4;
      const sz = z + uz * 0.4;
      const cx = x + (ux * len) / 2 + uz * sag;
      const cz = z + (uz * len) / 2 - ux * sag;
      const tx = x + ux * len;
      const tz = z + uz * len;
      let ax = sx;
      let az = sz;
      for (let i = 1; i <= N; i++) {
        const k = i / N;
        const bx = (1 - k) * (1 - k) * sx + 2 * (1 - k) * k * cx + k * k * tx;
        const bz = (1 - k) * (1 - k) * sz + 2 * (1 - k) * k * cz + k * k * tz;
        this.cable.stroke(ax, WHIP_H, az, bx, WHIP_H, bz, 0.22, w.def.color, a);
        this.glow.stroke(ax, WHIP_H + 0.09, az, bx, WHIP_H + 0.09, bz, 0.07, '#f4f4f4', a);
        ax = bx;
        az = bz;
      }
      this.plugs.add(tx, WHIP_H - 0.14, tz, Math.atan2(ux, uz));
    }
  }

  // Screen Share: a flickering cone of light with scanlines running down it, and the
  // slide at the far end.
  beam(w, p, time, x, z) {
    const t = this.tool(w, () => {
      const cone = hidden(BEAM, fade(w.def.color, { vertexColors: true, glow: true }), 1);
      const slide = new THREE.Mesh(TOOL_MODELS.slide(), flatMaterial.clone()); // dropTool disposes the material
      slide.visible = false;
      slide.castShadow = true;
      slide.userData.ownGeometry = true;
      return { meshes: [cone, slide], cone, slide };
    });
    const on = w.active > 0;
    t.cone.visible = t.slide.visible = on;
    if (!on) return;
    const s = w.stats;
    const len = px(s.length * p.stats.area);
    const half = px((s.width * p.stats.area) / 2);
    const yaw = Math.atan2(w.ux, w.uy);
    const k = Math.min(1, w.active / 0.2, (s.duration - w.active) / 0.08);
    const flicker = 0.85 + Math.sin(time * 40) * 0.15;
    t.cone.position.set(x, BEAM_H, z);
    t.cone.rotation.y = yaw;
    t.cone.scale.set(half, 1, len);
    t.cone.material.opacity = 0.3 * k * flicker;
    // The bright core and the scanlines.
    const ex = x + w.ux * len;
    const ez = z + w.uy * len;
    this.glow.stroke(x, BEAM_H + 0.01, z, ex, BEAM_H + 0.01, ez, 0.06, '#f4f4f4', 0.45 * k);
    const step = px(8);
    const off = ((time * 60) % 8) / 8;
    for (let d = off * step; d < len; d += step) {
      const h = half * (0.6 + (0.4 * d) / len);
      const cx = x + w.ux * d;
      const cz = z + w.uy * d;
      this.glow.stroke(cx - w.uy * h, BEAM_H + 0.01, cz + w.ux * h, cx + w.uy * h, BEAM_H + 0.01, cz - w.ux * h, 0.03, w.def.color, 0.16 * k);
    }
    t.slide.position.set(ex, BEAM_H + 0.1, ez);
    t.slide.rotation.y = yaw + Math.PI; // the slide faces back at the presenter
    t.slide.scale.setScalar(Math.max(0.01, k));
  }

  // Ping Sweep, SIEM: a radar beam (or two) going round, a fading wedge behind each, and
  // the edge of its range.
  sweep(w, p, alpha, x, z) {
    const beams = w.stats.beams ?? 1;
    const t = this.tool(w, () => {
      const fan = fanGeometry(w.stats.width);
      const fans = [];
      for (let b = 0; b < beams; b++) {
        const f = hidden(fan, fade(w.def.color, { vertexColors: true }), -2);
        f.userData.ownGeometry = b === 0;
        fans.push(f);
      }
      const edge = hidden(RING, fade(w.def.color), -2);
      edge.material.opacity = 0.25;
      return { meshes: [...fans, edge], fans, edge };
    });
    const range = px(w.stats.range * p.stats.area);
    let d = w.angle - w.prevAngle;
    if (d < 0) d += TAU;
    const angle = w.prevAngle + d * alpha;
    for (let b = 0; b < t.fans.length; b++) {
      const a = angle + (b / beams) * TAU;
      const f = t.fans[b];
      f.visible = true;
      f.position.set(x, 0.022, z);
      f.rotation.y = -a; // see fanGeometry: turns its +x to the beam
      f.scale.set(range, 1, range);
      f.material.opacity = 0.5;
      this.glow.stroke(x, 0.06, z, x + Math.cos(a) * range, 0.06, z + Math.sin(a) * range, 0.07, w.def.color, 0.9);
    }
    t.edge.visible = true;
    t.edge.position.set(x, 0.022, z);
    t.edge.scale.set(range, 1, range);
  }

  // Patch Rollout, Patch Tuesday: the deployment rings going out, the last one white.
  rollout(w, x, z) {
    const t = this.tool(w, () => {
      const walls = [];
      const edges = [];
      for (let i = 0; i < 8; i++) {
        walls.push(hidden(WALL, fade(w.def.color, { vertexColors: true, glow: true })));
        edges.push(hidden(RING, fade(w.def.color, { glow: true })));
      }
      return { meshes: [...walls, ...edges], walls, edges };
    });
    for (let i = 0; i < t.walls.length; i++) {
      const ring = w.waves[i];
      const wall = t.walls[i];
      const edge = t.edges[i];
      wall.visible = edge.visible = !!ring;
      if (!ring) continue;
      const r = Math.max(0.01, px(ring.r));
      const k = 1 - (ring.r / ring.max) * 0.7;
      const hex = ring.last ? '#f4f4f4' : w.def.color;
      wall.material.color.set(hex);
      edge.material.color.set(hex);
      wall.position.set(x, 0, z);
      wall.scale.set(r, ring.last ? 1.3 : 1, r);
      wall.material.opacity = 0.85 * k;
      edge.position.set(x, 0.03, z);
      edge.scale.set(r, 1, r);
      edge.material.opacity = 0.85 * k;
    }
  }

  // Out-of-Office Reply, Sabbatical: a shimmering bubble round you, the auto-reply's
  // envelope bobbing on top.
  shield(w, p, time, x, z) {
    const t = this.tool(w, () => {
      const bubble = hidden(new THREE.IcosahedronGeometry(1, 2), fade(w.def.color, { glow: true }), 1);
      bubble.userData.ownGeometry = true;
      const rim = hidden(RING, fade(w.def.color, { glow: true }), -2);
      const env = new THREE.Mesh(PROJECTILE_MODELS.proj_email(), flatMaterial.clone());
      env.userData.ownGeometry = true;
      env.visible = false;
      return { meshes: [bubble, rim, env], bubble, rim, env };
    });
    const on = w.active > 0;
    t.bubble.visible = t.rim.visible = t.env.visible = on;
    if (!on) return;
    const r = px(w.stats.radius * p.stats.area);
    const k = Math.min(1, w.active / 0.3);
    t.bubble.position.set(x, 0.5, z);
    t.bubble.scale.set(r, r * 0.8, r);
    t.bubble.material.opacity = (0.16 + Math.sin(time * 20) * 0.04) * k;
    t.rim.position.set(x, 0.03, z);
    t.rim.scale.set(r, 1, r);
    t.rim.material.opacity = (0.6 + Math.sin(time * 20) * 0.2) * k;
    t.env.position.set(x, 0.5 + r * 0.8 + 0.25 + Math.sin(time * 4) * 0.08, z);
    t.env.rotation.set(Math.PI / 2 - 0.4, 0, 0); // stood up, tipped toward the camera
    t.env.scale.setScalar(k);
  }

  // Coffee Run, Espresso Machine: spreading puddles that fade out, with a lighter splash.
  trail(w, p) {
    const radius = px(w.stats.radius * p.stats.area);
    const pool = w.puddles;
    for (let i = 0; i < pool.count; i++) {
      const d = pool.items[i];
      const k = Math.min(1, (d.max - d.life) * 6) * Math.min(1, d.life / 0.6);
      const x = px(d.x);
      const z = px(d.y - 6 + FOOT);
      this.decals.floor(x, z, radius * (0.9 + Math.sin(d.wob) * 0.1), radius * 0.6, 0, w.def.color, 0.65 * k, 0.018);
      this.decals.floor(x - radius * 0.3, z - radius * 0.15, radius * 0.3, radius * 0.15, 0, '#a0703c', 0.5 * k, 0.02);
    }
  }

  // Zip Ties: loops of cable tie on the floor that cinch shut when used.
  trap(w, p) {
    const radius = px(w.stats.radius * p.stats.area);
    const pool = w.traps;
    for (let i = 0; i < pool.count; i++) {
      const t = pool.items[i];
      const k = t.snap > 0 ? t.snap / 0.25 : Math.min(1, t.life / 0.5);
      const r = (t.snap > 0 ? radius * 0.3 : radius * 0.8) * (0.4 + 0.6 * k);
      this.props.ziptie.add(px(t.x), 0, px(t.y - 6 + FOOT), 0, r);
    }
  }

  // Terraform Apply, Terraform Destroy: dashed tile outlines that fill in one by one while
  // the plan runs, then the whole grid lights up.
  grid(w) {
    const s = w.stats;
    const pool = w.grids;
    for (let g = 0; g < pool.count; g++) {
      const gr = pool.items[g];
      const size = s.size;
      const half = px(gr.half);
      const tile = (half * 2) / size;
      const x0 = px(gr.x) - half + tile / 2;
      const z0 = px(gr.y - 4 + FOOT) - half + tile / 2;
      if (gr.t < s.plan) {
        const k = gr.t / s.plan;
        const done = Math.floor(k * size * size);
        for (let j = 0; j < size; j++) {
          for (let i = 0; i < size; i++) {
            const tx = x0 + i * tile;
            const tz = z0 + j * tile;
            this.frames.floor(tx, tz, tile * 0.85, tile * 0.85, 0, w.def.color, 0.3 + 0.4 * k, 0.024);
            if (j * size + i < done) this.tiles.floor(tx, tz, tile * 0.8, tile * 0.8, 0, w.def.color, 0.22, 0.022);
          }
        }
      } else {
        const k = 1 - (gr.t - s.plan) / s.live;
        this.tiles.floor(x0 - tile / 2 + half, z0 - tile / 2 + half, half * 2, half * 2, 0, w.def.color, 0.55 * k, 0.022);
        for (let j = 0; j < size; j++) {
          for (let i = 0; i < size; i++) this.frames.floor(x0 + i * tile, z0 + j * tile, tile * 0.97, tile * 0.97, 0, '#f4f4f4', 0.8 * k, 0.026);
        }
      }
    }
  }

  // Rubber Duck: ducks bobbing round you, facing the way they swim, hopping when they quack.
  duck(w, p, alpha, time, x, z) {
    const angle = lerp(w.prevAngle, w.angle, alpha);
    const count = duckCount(p);
    const hop = w.quackT < 0.15 ? 0.12 : 0;
    for (let i = 0; i < count; i++) {
      duckSpot(w, p, angle, i, spot);
      const a = angle + (i / count) * TAU;
      const bob = Math.sin(time * 5 + i) * 0.05;
      this.props.duck.add(x + px(spot.x), 0.25 + bob + hop, z + px(spot.y), Math.atan2(-Math.sin(a), Math.cos(a) * 0.8), 1.4);
    }
  }

  // PowerShell Script, Scheduled Task Army: terminals on tripods, blinking before they expire.
  turret(w) {
    const props = this.props[w.def.sprite] ?? this.props.turret;
    for (const t of w.turrets) {
      if (!t.on || (t.life < 1 && (t.life * 8) & 1)) continue;
      props.add(px(t.x), 0, px(t.y + 2), 0);
    }
  }

  // Delegate, Outsourced Team, the Supervisor's crew: little helpers waddling after users.
  minion(w, alpha) {
    const props = this.props[w.def.sprite] ?? this.props.helper;
    for (const mn of w.minions) {
      const t = mn.animT * 12;
      const rock = mn.animT > 0 ? Math.sin(t) * 0.14 : 0;
      const hop = mn.animT > 0 ? Math.abs(Math.cos(t)) * 0.06 : 0;
      props.add(px(lerp(mn.px, mn.x, alpha)), hop, px(lerp(mn.py, mn.y, alpha) + 6), mn.facing, 1, rock);
    }
  }
}
