// Floor hazards from the simulation's zones (src/sim/zones.js): the Printer Jammer's paper
// jams, a scatter of jammed sheets flat on the carpet. One InstancedMesh, scaled to each
// zone's radius; zones shrink away in their last half second instead of fading.

import * as THREE from 'three';
import { flatMaterial, merge, box, px } from './models.js';
import { PALETTE as P } from '../../data/palette.js';

const m = new THREE.Matrix4();
const q = new THREE.Quaternion();
const pos = new THREE.Vector3();
const scl = new THREE.Vector3();
const up = new THREE.Vector3(0, 1, 0);

// A unit-radius jam: crooked sheets, a couple of them crumpled up.
function paperJam() {
  const sheets = [];
  const spots = [[0, 0, 0.2], [-0.45, 0.3, -0.5], [0.5, -0.25, 0.7], [0.15, 0.55, 1.2], [-0.3, -0.5, 2.1], [0.6, 0.35, -1.1]];
  spots.forEach(([x, z, a], i) => {
    sheets.push(box(0.42, 0.012 + i * 0.002, 0.56, i % 3 ? P.w : P.g, x, 0, z, a));
    sheets.push(box(0.3, 0.004, 0.02, P.g, x, 0.014 + i * 0.002, z, a)); // a printed line
  });
  return merge(sheets);
}

export class ZoneView {
  constructor(scene) {
    this.mesh = new THREE.InstancedMesh(paperJam(), flatMaterial, 96);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.receiveShadow = true;
    this.mesh.count = 0;
    scene.add(this.mesh);
  }

  update(sim) {
    const pool = sim.zones.pool;
    for (let i = 0; i < pool.count; i++) {
      const z = pool.items[i];
      // The sheets cover about the slow radius; each zone gets its own turn from its spot.
      const r = px(z.r) * Math.min(1, z.life / 0.5, (z.max - z.life) / 0.15 + 0.3);
      q.setFromAxisAngle(up, (z.x * 0.37 + z.y * 0.21) % 6.28);
      m.compose(pos.set(px(z.x), 0.006, px(z.y)), q, scl.set(r, 1, r));
      this.mesh.setMatrixAt(i, m);
    }
    this.mesh.count = pool.count;
    if (pool.count) this.mesh.instanceMatrix.needsUpdate = true;
  }
}
