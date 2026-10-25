// Particles: the little bits that fly off a closed user or a pickup (the simulation's
// `burst` hook). One InstancedMesh of tiny cubes, colored per instance, with a fixed pool
// in typed arrays, so a crowd of kills allocates nothing.
// The original's fx.js drew 2x2 pixels on the canvas; here they are cubes that pop up,
// tumble and fall onto the floor.

import * as THREE from 'three';
import { px } from './models.js';
import { FOOT } from '../sim/player.js';

const MAX = 1500;
const GRAVITY = 14; // scene units / s²
const SIZE = 0.12;

const m = new THREE.Matrix4();
const q = new THREE.Quaternion();
const pos = new THREE.Vector3();
const scl = new THREE.Vector3();
const euler = new THREE.Euler();
const colors = new Map(); // CSS color -> THREE.Color, made once per color

export class FxView {
  constructor(scene) {
    this.mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(SIZE, SIZE, SIZE), new THREE.MeshLambertMaterial(), MAX);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.setColorAt(0, new THREE.Color()); // creates instanceColor
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    scene.add(this.mesh);
    // Per particle: position, velocity, age, life, spin.
    this.p = new Float32Array(MAX * 3);
    this.v = new Float32Array(MAX * 3);
    this.t = new Float32Array(MAX);
    this.life = new Float32Array(MAX);
    this.spin = new Float32Array(MAX);
    this.count = 0;
  }

  clear() {
    this.count = 0;
  }

  // The `burst` hook: `n` bits at world (x, y), cycling through `list` (CSS colors).
  burst(x, y, list, n) {
    const cx = px(x);
    const cz = px(y + FOOT);
    for (let i = 0; i < n && this.count < MAX; i++) {
      const k = this.count++;
      const a = Math.random() * Math.PI * 2;
      const s = 1.5 + Math.random() * 2.5;
      this.p[k * 3] = cx;
      this.p[k * 3 + 1] = 0.5 + Math.random() * 0.4;
      this.p[k * 3 + 2] = cz;
      this.v[k * 3] = Math.cos(a) * s;
      this.v[k * 3 + 1] = 3 + Math.random() * 3;
      this.v[k * 3 + 2] = Math.sin(a) * s;
      this.t[k] = 0;
      this.life[k] = 0.5 + Math.random() * 0.35;
      this.spin[k] = (Math.random() - 0.5) * 20;
      const css = list[i % list.length];
      let c = colors.get(css);
      if (!c) colors.set(css, (c = new THREE.Color(css)));
      this.mesh.setColorAt(k, c);
    }
    this.mesh.instanceColor.needsUpdate = true;
  }

  // `dt` is frame time: particles are decoration, so they move with the frame, not the sim.
  update(dt, frozen) {
    if (frozen) dt = 0;
    const { p, v, t, life, spin } = this;
    for (let k = this.count - 1; k >= 0; k--) {
      if ((t[k] += dt) < life[k]) continue;
      // Dead: move the last particle into this slot.
      const last = --this.count;
      if (k !== last) {
        p.copyWithin(k * 3, last * 3, last * 3 + 3);
        v.copyWithin(k * 3, last * 3, last * 3 + 3);
        t[k] = t[last];
        life[k] = life[last];
        spin[k] = spin[last];
        this.mesh.instanceColor.array.copyWithin(k * 3, last * 3, last * 3 + 3);
        this.mesh.instanceColor.needsUpdate = true;
      }
    }
    for (let k = 0; k < this.count; k++) {
      const i = k * 3;
      v[i + 1] -= GRAVITY * dt;
      p[i] += v[i] * dt;
      p[i + 1] += v[i + 1] * dt;
      p[i + 2] += v[i + 2] * dt;
      if (p[i + 1] < SIZE / 2) {
        // Land and skid to a stop.
        p[i + 1] = SIZE / 2;
        v[i + 1] = 0;
        v[i] *= 0.8;
        v[i + 2] *= 0.8;
        spin[k] *= 0.8;
      }
      const a = t[k] * spin[k];
      q.setFromEuler(euler.set(a, a * 0.7, 0));
      const s = Math.min(1, (life[k] - t[k]) * 6); // shrink away at the end
      m.compose(pos.set(p[i], p[i + 1], p[i + 2]), q, scl.setScalar(s));
      this.mesh.setMatrixAt(k, m);
    }
    this.mesh.count = this.count;
    if (this.count) this.mesh.instanceMatrix.needsUpdate = true;
  }
}
