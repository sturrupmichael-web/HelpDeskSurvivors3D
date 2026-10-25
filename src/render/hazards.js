// Draws boss attacks from the simulation's hazards (src/sim/hazards.js): the bullets
// (ringing phones, slide decks), one InstancedMesh per kind with a thick bright outline so
// they stand out from a crowd of users in any colour, and the "urgent meeting" bombs: a
// red circle that fills up from the middle, its border turning yellow and blinking just
// before it goes off. Bomb circles are drawn over everything, like the boss telegraphs.

import * as THREE from 'three';
import { HAZARD_MODELS, flatMaterial, hazardOutlineMaterial, px } from './models.js';
import { FOOT } from '../sim/player.js';

const FLIGHT_H = 0.75; // boss bullets fly at about knee-to-hand height (scene units)
const MAX_BULLETS = 600;
const MAX_BOMBS = 48;
const RED = new THREE.Color('#b13e53');
const YELLOW = new THREE.Color('#ffcd75');

const lerp = (a, b, t) => a + (b - a) * t;
const m = new THREE.Matrix4();
const q = new THREE.Quaternion();
const pos = new THREE.Vector3();
const scl = new THREE.Vector3(1.5, 1.5, 1.5); // drawn bigger than their hitbox, so they read at a glance
const yAxis = new THREE.Vector3(0, 1, 0);

function overlay(geo, opacity, capacity) {
  const mesh = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ transparent: true, opacity, depthTest: false, depthWrite: false }), capacity);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.frustumCulled = false;
  mesh.renderOrder = 5;
  mesh.count = 0;
  return mesh;
}

export class HazardView {
  constructor(scene) {
    this.kinds = new Map(); // sprite id -> InstancedMesh
    for (const [id, build] of Object.entries(HAZARD_MODELS)) {
      const mesh = new THREE.InstancedMesh(build(), flatMaterial, MAX_BULLETS);
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.frustumCulled = false;
      mesh.count = 0;
      const edge = new THREE.InstancedMesh(mesh.geometry, hazardOutlineMaterial, MAX_BULLETS);
      edge.instanceMatrix = mesh.instanceMatrix;
      edge.frustumCulled = false;
      edge.count = 0;
      mesh.userData.edge = edge;
      scene.add(mesh, edge);
      this.kinds.set(id, mesh);
    }
    this.bombFill = overlay(new THREE.CircleGeometry(1, 32).rotateX(-Math.PI / 2), 0.28, MAX_BOMBS);
    this.bombFill.material.color.copy(RED);
    this.bombEdge = overlay(new THREE.RingGeometry(0.9, 1, 40).rotateX(-Math.PI / 2), 0.9, MAX_BOMBS);
    this.bombEdge.setColorAt(0, RED); // creates instanceColor
    scene.add(this.bombFill, this.bombEdge);
  }

  update(sim, alpha) {
    for (const mesh of this.kinds.values()) mesh.count = 0;
    const bl = sim.hazards.bullets;
    for (let i = 0; i < bl.count; i++) {
      const b = bl.items[i];
      const mesh = this.kinds.get(b.sprite);
      if (!mesh) continue;
      // Spinning phones tumble round; slide decks fly flat, pointing the way they go.
      q.setFromAxisAngle(yAxis, b.spin ? b.rot : Math.atan2(b.vx, b.vy));
      pos.set(px(lerp(b.px, b.x, alpha)), FLIGHT_H, px(lerp(b.py, b.y, alpha) + FOOT));
      m.compose(pos, q, scl);
      mesh.setMatrixAt(mesh.count++, m);
    }
    for (const mesh of this.kinds.values()) {
      mesh.userData.edge.count = mesh.count;
      if (mesh.count) mesh.instanceMatrix.needsUpdate = true;
    }

    const bm = sim.hazards.bombs;
    const n = sim.over ? 0 : bm.count;
    for (let i = 0; i < n; i++) {
      const b = bm.items[i];
      const k = Math.min(1, b.t / b.delay);
      const x = px(b.x);
      const z = px(b.y + FOOT);
      const r = px(b.r);
      m.makeScale(r * Math.max(0.02, k), 1, r * Math.max(0.02, k)).setPosition(x, 0.025, z);
      this.bombFill.setMatrixAt(i, m);
      m.makeScale(r, 1, r).setPosition(x, 0.03, z);
      this.bombEdge.setMatrixAt(i, m);
      const late = k > 0.7 && (b.t * 12) & 1;
      this.bombEdge.setColorAt(i, late ? YELLOW : RED);
    }
    this.bombFill.count = this.bombEdge.count = n;
    if (n) {
      this.bombFill.instanceMatrix.needsUpdate = true;
      this.bombEdge.instanceMatrix.needsUpdate = true;
      this.bombEdge.instanceColor.needsUpdate = true;
    }
  }
}
