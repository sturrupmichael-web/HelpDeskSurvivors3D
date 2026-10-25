// Floor hazards from the simulation's zones (src/sim/zones.js), by their `sprite`: the
// Printer Jammer's paper jams (a scatter of jammed sheets), the Rat's Nest's cable loops
// and the Night Janitor's wet floor (a puddle with a yellow caution sign). One InstancedMesh
// per look, scaled to each zone's radius; zones shrink away in their last half second
// instead of fading.

import * as THREE from 'three';
import { flatMaterial, merge, box, cyl, px } from './models.js';
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

// A unit-radius coil of loose patch cable: loops in a few colours, a plug on the end.
function cableLoop() {
  const parts = [];
  [[P.B, 0.75, 0, 0], [P.y, 0.55, 0.2, -0.1], [P.e, 0.65, -0.15, 0.15], [P.o, 0.4, 0.1, 0.25]].forEach(([c, r, x, z], i) => {
    const t = new THREE.TorusGeometry(r, 0.07, 4, 16).rotateX(Math.PI / 2);
    t.translate(x, 0.04 + i * 0.012, z);
    parts.push(paintGeo(t, c));
  });
  parts.push(box(0.2, 0.1, 0.12, P.w, 0.85, 0, 0.1));
  return merge(parts);
}

// A unit-radius wet patch: a shiny blue puddle, with a folded caution sign on some.
function wetFloor() {
  return merge([cyl(1, 1, 0.012, '#41a6f6', 0, 0, 0, 14), cyl(0.7, 0.7, 0.014, '#73eff7', 0.12, 0, -0.1, 12), cyl(0.25, 0.25, 0.016, P.w, -0.3, 0, -0.35, 8)]);
}
function cautionSign() {
  const a = new THREE.BoxGeometry(0.42, 0.62, 0.03);
  return merge([
    paintGeo(a.clone().rotateX(-0.28).translate(0, 0.3, 0.09), P.y),
    paintGeo(a.rotateX(0.28).translate(0, 0.3, -0.09), P.y),
    box(0.3, 0.06, 0.02, P.k, 0, 0.38, 0.19),
  ]);
}

// Paints a geometry one colour (for shapes the box/cyl helpers don't cover).
function paintGeo(geo, color) {
  const flat = geo.index ? geo.toNonIndexed() : geo;
  const c = new THREE.Color(color);
  const n = flat.attributes.position.count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) arr.set([c.r, c.g, c.b], i * 3);
  flat.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  flat.deleteAttribute('uv');
  return flat;
}

const LOOKS = { paperjam: paperJam, cable_loop: cableLoop, wet_floor: wetFloor };
const MAX = 96;

function instanced(scene, geo) {
  const mesh = new THREE.InstancedMesh(geo, flatMaterial, MAX);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.frustumCulled = false;
  mesh.receiveShadow = true;
  mesh.count = 0;
  scene.add(mesh);
  return mesh;
}

export class ZoneView {
  constructor(scene) {
    this.kinds = new Map(); // zone sprite -> InstancedMesh
    for (const [id, build] of Object.entries(LOOKS)) this.kinds.set(id, instanced(scene, build()));
    this.signs = instanced(scene, cautionSign()); // on every other wet patch, at its edge
    this.signs.castShadow = true;
  }

  update(sim) {
    for (const mesh of this.kinds.values()) mesh.count = 0;
    this.signs.count = 0;
    const pool = sim.zones.pool;
    for (let i = 0; i < pool.count; i++) {
      const z = pool.items[i];
      const mesh = this.kinds.get(z.sprite) ?? this.kinds.get('paperjam');
      // The look covers about the zone's radius; each zone gets its own turn from its spot.
      const k = Math.min(1, z.life / 0.5, (z.max - z.life) / 0.15 + 0.3);
      const r = px(z.r) * k;
      const turn = (z.x * 0.37 + z.y * 0.21) % 6.28;
      q.setFromAxisAngle(up, turn);
      m.compose(pos.set(px(z.x), 0.006, px(z.y)), q, scl.set(r, 1, r));
      mesh.setMatrixAt(mesh.count++, m);
      if (z.sprite === 'wet_floor' && ((z.x + z.y) | 0) & 1) {
        q.setFromAxisAngle(up, turn * 3);
        m.compose(pos.set(px(z.x) + Math.cos(turn) * px(z.r) * 0.7, 0, px(z.y) + Math.sin(turn) * px(z.r) * 0.7), q, scl.set(k, k, k));
        this.signs.setMatrixAt(this.signs.count++, m);
      }
    }
    for (const mesh of this.kinds.values()) if (mesh.count) mesh.instanceMatrix.needsUpdate = true;
    if (this.signs.count) this.signs.instanceMatrix.needsUpdate = true;
  }
}
