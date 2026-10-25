// Draws what's lying on the floor: Closed Tickets (one InstancedMesh per tier) and items
// (one per kind), each with an instanced ink outline, plus a pulsing glow disc under
// items that have one (PTO, chests). Reads the simulation's pickup pools only.

import * as THREE from 'three';
import { PICKUP_MODELS, flatMaterial, outlineMaterial, px } from './models.js';
import { TICKET_TIERS, ITEMS, TICKETS, MAX_ITEMS } from '../../data/pickups.js';
import { FOOT } from '../sim/player.js';

const FLOAT_H = 0.42; // pickups hover at about knee height
const FLY_H = 0.9; // and rise to hand height as they fly to you

const lerp = (a, b, t) => a + (b - a) * t;
const m = new THREE.Matrix4();
const q = new THREE.Quaternion();
const pos = new THREE.Vector3();
const scl = new THREE.Vector3();
const euler = new THREE.Euler();
const GLOW = Object.fromEntries(Object.entries(ITEMS).map(([id, d]) => [id, new THREE.Color(d.glow ?? '#ffffff')]));

function batch(scene, geo, capacity) {
  const mesh = new THREE.InstancedMesh(geo, flatMaterial, capacity);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.frustumCulled = false;
  mesh.castShadow = true;
  mesh.count = 0;
  const ink = new THREE.InstancedMesh(geo, outlineMaterial, capacity);
  ink.instanceMatrix = mesh.instanceMatrix;
  ink.frustumCulled = false;
  ink.count = 0;
  mesh.userData.ink = ink;
  scene.add(mesh, ink);
  return mesh;
}

export class PickupView {
  constructor(scene) {
    this.tiers = TICKET_TIERS.map((t) => batch(scene, PICKUP_MODELS[t.sprite](), TICKETS.maxOnFloor));
    this.kinds = new Map(); // item id -> InstancedMesh
    for (const [id, d] of Object.entries(ITEMS)) this.kinds.set(id, batch(scene, (PICKUP_MODELS[d.sprite] ?? PICKUP_MODELS.chest)(), MAX_ITEMS));
    this.batches = [...this.tiers, ...this.kinds.values()];
    // Glow under PTO and chests: flat discs, colored per instance.
    const disc = new THREE.CircleGeometry(px(11), 16).rotateX(-Math.PI / 2);
    this.glow = new THREE.InstancedMesh(disc, new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.45, depthWrite: false }), MAX_ITEMS);
    this.glow.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.glow.frustumCulled = false;
    this.glow.renderOrder = -2;
    this.glow.count = 0;
    scene.add(this.glow);
  }

  // `rect`: the visible floor in world px; pickups outside it are skipped.
  update(sim, alpha, rect) {
    const batches = this.batches;
    for (let i = 0; i < batches.length; i++) batches[i].count = 0;
    let glows = 0;
    const x0 = rect.x0 - 32;
    const x1 = rect.x1 + 32;
    const y0 = rect.y0 - 32;
    const y1 = rect.y1 + 32;

    const tickets = sim.tickets;
    const life = sim.policy.ticketLife; // Ticket Blitz: tickets about to vanish blink
    for (let i = 0; i < tickets.count; i++) {
      const t = tickets.items[i];
      if (life && t.age > life - 2 && (t.age * 8) & 1) continue;
      const wx = lerp(t.px, t.x, alpha);
      const wy = lerp(t.py, t.y, alpha) + FOOT; // drawn at the same ground point as the tech and users
      if (wx < x0 || wx > x1 || wy < y0 || wy > y1) continue;
      const mesh = this.tiers[t.tier];
      const h = t.magnet ? FLY_H : FLOAT_H + Math.sin(t.t * 4) * 0.06;
      // Slow spin, tilted back a little toward the camera so the check reads.
      q.setFromEuler(euler.set(-0.35, t.t * 1.6, 0, 'YXZ'));
      m.compose(pos.set(px(wx), h, px(wy)), q, scl.setScalar(1.25));
      mesh.setMatrixAt(mesh.count++, m);
    }

    const items = sim.items;
    for (let i = 0; i < items.count; i++) {
      const it = items.items[i];
      const wx = lerp(it.px, it.x, alpha);
      const wy = lerp(it.py, it.y, alpha) + FOOT;
      if (wx < x0 || wx > x1 || wy < y0 || wy > y1) continue;
      const mesh = this.kinds.get(it.id);
      q.setFromEuler(euler.set(-0.3, Math.sin(it.t * 1.5) * 0.6, 0, 'YXZ'));
      m.compose(pos.set(px(wx), FLOAT_H + 0.08 + Math.sin(it.t * 3) * 0.08, px(wy)), q, scl.setScalar(1.15));
      mesh.setMatrixAt(mesh.count++, m);
      if (it.def.glow) {
        const s = 1 + 0.15 * Math.sin(it.t * 5);
        m.makeScale(s, 1, s).setPosition(px(wx), 0.02, px(wy));
        this.glow.setMatrixAt(glows, m);
        this.glow.setColorAt(glows++, GLOW[it.id]);
      }
    }

    for (let i = 0; i < batches.length; i++) {
      batches[i].userData.ink.count = batches[i].count;
      if (batches[i].count) batches[i].instanceMatrix.needsUpdate = true;
    }
    this.glow.count = glows;
    if (glows) {
      this.glow.instanceMatrix.needsUpdate = true;
      this.glow.instanceColor.needsUpdate = true;
    }
  }
}
