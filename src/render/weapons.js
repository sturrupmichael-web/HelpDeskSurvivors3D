// Draws what the tools do: projectiles (one InstancedMesh per sprite id), orbiting
// shields, shockwave rings, aura fields, and the one-off effect rings the simulation asks
// for (Reimage's flash). It only reads weapon and projectile state from the simulation.
// Everything is created up front or once per tool, never per frame.

import * as THREE from 'three';
import { PROJECTILE_MODELS, fallbackProjectile, flatMaterial, px } from './models.js';
import { FOOT } from '../sim/player.js';
import { orbitShield, shieldCount } from '../sim/weapons/orbit.js';
import { auraRadius } from '../sim/weapons/aura.js';

const FLIGHT_H = 0.85; // projectiles fly at about hand height (scene units)
const SHIELD_H = 0.5; // the Firewall's bricks float a little lower
const PROJ_FOOT = FOOT + 4; // shots leave from 4 px above the tech's center, so this lands them at the feet
const MAX_SHIELDS = 64;
const MAX_RINGS = 24;
const WALL_H = 0.55; // height of a shockwave's wall

const lerp = (a, b, t) => a + (b - a) * t;
const m = new THREE.Matrix4();
const q = new THREE.Quaternion();
const pos = new THREE.Vector3();
const scl = new THREE.Vector3();
const yAxis = new THREE.Vector3(0, 1, 0);
const off = { x: 0, y: 0 };

function instanced(geo, capacity) {
  const mesh = new THREE.InstancedMesh(geo, flatMaterial, capacity);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.frustumCulled = false;
  mesh.castShadow = true;
  mesh.count = 0;
  return mesh;
}

// A shockwave: a low wall that fades toward its top (vertex alpha), plus a faint disc.
function wallGeometry() {
  const g = new THREE.CylinderGeometry(1, 1, WALL_H, 48, 1, true);
  g.translate(0, WALL_H / 2, 0);
  const n = g.attributes.position.count;
  const c = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) {
    c.set([1, 1, 1, g.attributes.position.getY(i) > WALL_H / 2 ? 0 : 1], i * 4);
  }
  g.setAttribute('color', new THREE.BufferAttribute(c, 4));
  return g;
}
const WALL = wallGeometry();
const DISC = new THREE.CircleGeometry(1, 48).rotateX(-Math.PI / 2);
const RING = new THREE.RingGeometry(0.94, 1, 48).rotateX(-Math.PI / 2);

// Dashed outline for auras: short flat dashes round a unit circle.
function dashGeometry(dashes = 36) {
  const parts = [];
  for (let i = 0; i < dashes; i++) {
    const a0 = (i / dashes) * Math.PI * 2;
    const a1 = a0 + (Math.PI / dashes) * 0.9;
    const g = new THREE.RingGeometry(0.97, 1.0, 3, 1, a0, a1 - a0);
    parts.push(g.toNonIndexed());
    g.dispose();
  }
  const pos = new Float32Array(parts.reduce((n, g) => n + g.attributes.position.array.length, 0));
  let o = 0;
  for (const g of parts) {
    pos.set(g.attributes.position.array, o);
    o += g.attributes.position.array.length;
    g.dispose();
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  return geo.rotateX(-Math.PI / 2);
}
const DASHES = dashGeometry();

const fade = (color, vertexColors = false, glow = false) =>
  new THREE.MeshBasicMaterial({
    color, transparent: true, depthWrite: false, side: THREE.DoubleSide, vertexColors,
    blending: glow ? THREE.AdditiveBlending : THREE.NormalBlending,
  });

// Floor effects sit just above the carpet and draw before the horde's blob shadows.
function floorMesh(geo, mat, y = 0.02) {
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.y = y;
  mesh.renderOrder = -2;
  mesh.visible = false;
  return mesh;
}

export class WeaponView {
  constructor(scene) {
    this.scene = scene;
    this.kinds = new Map(); // sprite id -> InstancedMesh
    for (const [id, build] of Object.entries(PROJECTILE_MODELS)) this.kinds.set(id, instanced(build(), 800));
    this.fallback = instanced(fallbackProjectile(), 800);
    this.batches = [...this.kinds.values(), this.fallback]; // for per-frame loops without iterators
    for (const mesh of this.batches) scene.add(mesh);
    // Orbit shields: a separate batch, so a Firewall and a Firewall shot never share a count.
    this.shields = instanced(PROJECTILE_MODELS.proj_firewall(), MAX_SHIELDS);
    scene.add(this.shields);
    this.tools = []; // per-tool meshes (pulse rings, aura fields), made once per tool: { w, meshes, ... }
    // One-off effect rings from the simulation's `ring` hook.
    this.rings = [];
    for (let i = 0; i < MAX_RINGS; i++) {
      const mesh = floorMesh(RING, fade('#ffffff'), 0.03);
      scene.add(mesh);
      this.rings.push({ mesh, x: 0, z: 0, r: 0, t: 0, life: 0, fill: false });
    }
    this.ringNext = 0;
  }

  // The simulation's `ring` hook: an expanding ring, or a filled flash when `fill`.
  ring(x, y, r, color, life = 0.3, fill = false) {
    const g = this.rings[this.ringNext];
    this.ringNext = (this.ringNext + 1) % MAX_RINGS;
    g.x = px(x);
    g.z = px(y + FOOT);
    g.r = px(r);
    g.t = 0;
    g.life = life;
    g.fill = fill;
    g.mesh.geometry = fill ? DISC : RING;
    g.mesh.material.color.set(color);
    g.mesh.visible = true;
  }

  // (x, z): the tech's interpolated feet, in scene units.
  update(sim, alpha, dt, x, z) {
    this.drawProjectiles(sim, alpha);
    const p = sim.player;
    let shields = 0;
    for (let i = 0; i < this.tools.length; i++) this.tools[i].seen = false;
    for (const w of p.weapons) {
      const b = w.def.behavior;
      if (b === 'pulse') this.drawPulse(w, x, z);
      else if (b === 'aura') this.drawAura(w, p, sim.time, x, z);
      else if (b === 'orbit') shields = this.drawShields(w, p, alpha, x, z, shields);
    }
    this.shields.count = shields;
    this.shields.instanceMatrix.needsUpdate = true;
    // Tools the tech no longer has (a new shift) hide their meshes.
    for (let i = this.tools.length - 1; i >= 0; i--) if (!this.tools[i].seen) this.dropTool(i);
    this.drawRings(dt);
  }

  drawProjectiles(sim, alpha) {
    const batches = this.batches;
    for (let i = 0; i < batches.length; i++) batches[i].count = 0;
    const pool = sim.projectiles;
    for (let i = 0; i < pool.count; i++) {
      const o = pool.items[i];
      if (o.dead) continue;
      const mesh = this.kinds.get(o.spr) ?? this.fallback;
      const yaw = o.spin ? o.rot : Math.atan2(o.vx, o.vy);
      q.setFromAxisAngle(yAxis, yaw);
      pos.set(px(lerp(o.px, o.x, alpha)), FLIGHT_H, px(lerp(o.py, o.y, alpha) + PROJ_FOOT));
      m.compose(pos, q, scl.setScalar(o.scale));
      mesh.setMatrixAt(mesh.count++, m);
    }
    for (let i = 0; i < batches.length; i++) batches[i].instanceMatrix.needsUpdate = true;
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
    }
    this.tools.splice(i, 1);
  }

  drawPulse(w, x, z) {
    const t = this.tool(w, () => {
      const wall = floorMesh(WALL, fade(w.def.color, true, true), 0);
      const edge = floorMesh(RING, fade(w.def.color, false, true), 0.03);
      const disc = floorMesh(DISC, fade(w.def.color));
      return { meshes: [wall, edge, disc], wall, edge, disc };
    });
    const on = w.ring >= 0;
    t.wall.visible = t.edge.visible = t.disc.visible = on;
    if (!on) return;
    const r = Math.max(0.01, px(w.ring));
    const k = 1 - w.ring / w.ringMax;
    t.wall.position.set(x, 0, z);
    t.wall.scale.set(r, 1, r);
    t.wall.material.opacity = Math.sqrt(k); // the ring only lives a fifth of a second; keep it bright
    t.edge.position.set(x, 0.03, z);
    t.edge.scale.set(r, 1, r);
    t.edge.material.opacity = Math.sqrt(k);
    t.disc.position.set(x, 0.02, z);
    t.disc.scale.set(r, 1, r);
    t.disc.material.opacity = 0.15 * k;
  }

  drawAura(w, p, time, x, z) {
    const t = this.tool(w, () => {
      const disc = floorMesh(DISC, fade(w.def.color));
      const dash = floorMesh(DASHES, fade(w.def.color), 0.025);
      disc.material.opacity = 0.12;
      dash.material.opacity = 0.5;
      return { meshes: [disc, dash], disc, dash };
    });
    const r = px(auraRadius(w, p));
    t.disc.visible = t.dash.visible = true;
    t.disc.position.set(x, 0.02, z);
    t.disc.scale.set(r, 1, r);
    t.dash.position.set(x, 0.025, z);
    t.dash.scale.set(r, 1, r);
    t.dash.rotation.y = (time * 12) / auraRadius(w, p); // the dashes march round, as in the original
  }

  drawShields(w, p, alpha, x, z, n) {
    if (w.active <= 0) return n;
    const angle = lerp(w.prevAngle, w.angle, alpha);
    const pop = Math.min(1, w.active / 0.3); // shrink away in the last moment of uptime
    const count = shieldCount(w, p);
    for (let i = 0; i < count && n < MAX_SHIELDS; i++) {
      orbitShield(w, p, angle, i, off);
      // Face outward, like a wall segment of a round tower.
      q.setFromAxisAngle(yAxis, Math.atan2(off.x, off.y));
      pos.set(x + px(off.x), SHIELD_H * pop, z + px(off.y));
      m.compose(pos, q, scl.setScalar(pop));
      this.shields.setMatrixAt(n++, m);
    }
    return n;
  }

  drawRings(dt) {
    for (const g of this.rings) {
      if (!g.mesh.visible) continue;
      g.t += dt;
      const k = g.t / g.life;
      if (k >= 1) {
        g.mesh.visible = false;
        continue;
      }
      // A ring races out to its radius; a flash stays put. Both fade.
      const r = g.fill ? g.r : g.r * (0.35 + 0.65 * Math.sqrt(k));
      g.mesh.position.set(g.x, 0.03, g.z);
      g.mesh.scale.set(r, 1, r);
      g.mesh.material.opacity = (g.fill ? 0.5 : 0.9) * (1 - k);
    }
  }
}
