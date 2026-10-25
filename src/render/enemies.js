// Draws the horde: one InstancedMesh per kind of user (from models.js) and its outline,
// plus one instanced blob shadow for everyone, and the circles some users carry with them
// (the VIP's aura, Badge Brenda's reader range), and what's wrong with each user over their
// head (stunned, confused, flagged by a tool). Each frame writes matrices into preallocated
// buffers; nothing is created per user, so a thousand users cost a handful of draw calls.
// With `lod` on (Settings, Quality: on by default on phones), users away from the tech are
// drawn from a low-detail copy of their model with no outline, at about a quarter of the
// cost. That's most of a crowd closing in from the screen's edges, where users are small.

import * as THREE from 'three';
import { USER_MODELS, STATUS_MODELS, lowDetail, flatMaterial, flashToonMaterial, outlineMaterial, blobShadowGeometry, px } from './models.js';

const lerp = (a, b, t) => a + (b - a) * t;

const m = new THREE.Matrix4();
const q = new THREE.Quaternion();
const pos = new THREE.Vector3();
const scl = new THREE.Vector3();
const euler = new THREE.Euler(0, 0, 0, 'YXZ');

// A user is far once they're this share of the way from the tech to the farthest corner
// of the visible floor.
const NEAR = 0.45;

function changed(mesh) {
  if (!mesh.count) return;
  mesh.instanceMatrix.needsUpdate = true;
  mesh.userData.flash.needsUpdate = true;
}

// One batch of a user model (with its per-instance hit flash).
function batch(scene, geo, capacity) {
  const flash = new THREE.InstancedBufferAttribute(new Float32Array(capacity), 1);
  flash.setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('aFlash', flash);
  const mesh = new THREE.InstancedMesh(geo, flashToonMaterial, capacity);
  mesh.userData.flash = flash;
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.frustumCulled = false; // instances spread across the floor; bounds would be stale
  mesh.count = 0;
  mesh.receiveShadow = true;
  scene.add(mesh);
  return mesh;
}

export class EnemyView {
  constructor(scene, capacity) {
    this.capacity = capacity;
    this.lod = false; // draw far users in low detail (see FAR)
    this.kinds = new Map(); // sprite id -> InstancedMesh (its far copy is userData.far)
    for (const [id, build] of Object.entries(USER_MODELS)) {
      const geo = build();
      geo.computeBoundingBox();
      // Hit flash per instance (see flashToonMaterial).
      const mesh = batch(scene, geo, capacity);
      mesh.userData.far = batch(scene, lowDetail(build), capacity);
      // The outline: the same instances again in ink, sharing the matrices.
      const ink = new THREE.InstancedMesh(mesh.geometry, outlineMaterial, capacity);
      ink.instanceMatrix = mesh.instanceMatrix;
      ink.frustumCulled = false;
      ink.count = 0;
      mesh.userData.ink = ink;
      mesh.userData.top = geo.boundingBox.max.y; // where the status markers float
      scene.add(ink);
      this.kinds.set(id, mesh);
    }
    this.shadows = new THREE.InstancedMesh(
      blobShadowGeometry(0.36),
      new THREE.MeshBasicMaterial({ color: '#0a0c18', transparent: true, opacity: 0.35, depthWrite: false }),
      capacity,
    );
    this.shadows.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.shadows.frustumCulled = false;
    this.shadows.renderOrder = -1;
    scene.add(this.shadows);
    // Floor circles: a soft red disc and rim under each VIP (their aura speeds up users
    // nearby), and a pulsing ring round Badge Brenda while she's slowing you.
    const disc = new THREE.CircleGeometry(1, 32).rotateX(-Math.PI / 2);
    const rim = new THREE.RingGeometry(0.97, 1, 48).rotateX(-Math.PI / 2);
    const circle = (geo, opacity) => {
      const mesh = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ color: '#b13e53', transparent: true, opacity, depthWrite: false }), 64);
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.frustumCulled = false;
      mesh.renderOrder = -1;
      mesh.count = 0;
      scene.add(mesh);
      return mesh;
    };
    this.auraDisc = circle(disc, 0.12);
    this.auraRim = circle(rim, 0.55);
    this.badgeRing = circle(new THREE.RingGeometry(0.94, 1, 48).rotateX(-Math.PI / 2), 0.6);
    // Status markers: one batch each, facing the camera.
    this.status = {};
    for (const [id, build] of Object.entries(STATUS_MODELS)) {
      const mesh = new THREE.InstancedMesh(build(), flatMaterial, capacity);
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.frustumCulled = false;
      mesh.count = 0;
      scene.add(mesh);
      this.status[id] = mesh;
    }
    this.missing = new Set(); // sprite ids with no model yet (warned once)
  }

  // `rect` is the visible floor in world px; users well outside it are skipped. (tx, tz) is
  // the tech, in scene units, to tell near users from far.
  update(sim, alpha, rect, tx, tz) {
    for (const mesh of this.kinds.values()) mesh.count = mesh.userData.far.count = 0;
    const far2 = this.lod ? px(rect.radius * NEAR) ** 2 : Infinity;
    let shadows = 0;
    let auras = 0;
    let badges = 0;
    const { stun, confuse, mark } = this.status;
    stun.count = confuse.count = mark.count = 0;
    const spin = performance.now() / 300;
    const pool = sim.enemies;
    const x0 = rect.x0 - 64;
    const x1 = rect.x1 + 64;
    const y0 = rect.y0 - 96;
    const y1 = rect.y1 + 64;
    for (let i = 0; i < pool.count; i++) {
      const e = pool.items[i];
      if (e.dead || e.def.boss) continue; // bosses have their own models (bosses.js)
      const kind = this.kinds.get(e.def.sprite);
      if (!kind) {
        if (!this.missing.has(e.def.sprite)) {
          this.missing.add(e.def.sprite);
          console.warn('No 3D model yet for', e.def.sprite);
        }
        continue;
      }
      const wx = lerp(e.px, e.x, alpha);
      const wy = lerp(e.py, e.y, alpha) + e.foot; // drawn at the feet
      if (wx < x0 || wx > x1 || wy < y0 || wy > y1) continue;
      const x = px(wx);
      const z = px(wy);
      const mesh = (x - tx) ** 2 + (z - tz) ** 2 > far2 ? kind.userData.far : kind;
      // Waddle: a side-to-side rock and a little hop in step, slower when stunned.
      const t = e.animT * (e.def.speed > 45 ? 11 : 8);
      const rock = e.stun > 0 ? 0 : Math.sin(t) * 0.12;
      const hop = e.stun > 0 ? 0 : Math.abs(Math.cos(t)) * 0.07;
      euler.set(0, e.facing, rock);
      q.setFromEuler(euler);
      const s = e.scale;
      m.compose(pos.set(x, hop, z), q, scl.set(s, s, s));
      mesh.userData.flash.array[mesh.count] = e.flash > 0 ? 0.85 : 0;
      mesh.setMatrixAt(mesh.count++, m);
      m.makeScale(s * (e.r / 7), 1, s * (e.r / 7)).setPosition(x, 0.012, z);
      this.shadows.setMatrixAt(shadows++, m);
      if (e.stun > 0 || e.confuse > 0 || e.mark > 0) {
        const y = (kind.userData.top + 0.22) * s;
        if (e.stun > 0) stun.setMatrixAt(stun.count++, m.makeRotationY(spin + i).scale(scl.set(1.5, 1.5, 1.5)).setPosition(x, y + 0.05, z));
        else if (e.confuse > 0) confuse.setMatrixAt(confuse.count++, m.makeScale(1.5, 1.5, 1.5).setPosition(x + 0.2, y + Math.sin(e.animT * 6) * 0.06, z));
        if (e.mark > 0) mark.setMatrixAt(mark.count++, m.makeScale(1.5, 1.5, 1.5).setPosition(x - 0.32, y - 0.05, z));
      }
      const b = e.def.behavior;
      if (b === 'aura' && auras < 64) {
        const r = px(e.params.radius) * (1 + 0.04 * Math.sin(e.animT * 4));
        m.makeScale(r, 1, r).setPosition(x, 0.014, z);
        this.auraDisc.setMatrixAt(auras, m);
        this.auraRim.setMatrixAt(auras++, m);
      } else if (b === 'tailgate' && e.n && badges < 64) {
        const r = px(e.params.radius);
        m.makeScale(r, 1, r).setPosition(x, 0.016, z);
        this.badgeRing.setMatrixAt(badges++, m);
      }
    }
    for (const mesh of this.kinds.values()) {
      mesh.userData.ink.count = mesh.count;
      changed(mesh);
      changed(mesh.userData.far);
    }
    if (stun.count) stun.instanceMatrix.needsUpdate = true;
    if (confuse.count) confuse.instanceMatrix.needsUpdate = true;
    if (mark.count) mark.instanceMatrix.needsUpdate = true;
    this.shadows.count = shadows;
    this.shadows.instanceMatrix.needsUpdate = true;
    this.auraDisc.count = this.auraRim.count = auras;
    this.badgeRing.count = badges;
    if (auras) this.auraDisc.instanceMatrix.needsUpdate = this.auraRim.instanceMatrix.needsUpdate = true;
    if (badges) {
      this.badgeRing.instanceMatrix.needsUpdate = true;
      this.badgeRing.material.opacity = 0.35 + 0.25 * Math.sin(performance.now() / 125);
    }
  }
}
