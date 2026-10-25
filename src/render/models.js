// What everything looks like: low-poly models built from primitives, colored per vertex
// from the original palette (data/palette.js) and drawn with one flat-shaded material.
//
// This is the one place that knows about shapes. Gameplay never sees it, and the rest of
// the renderer only asks for "the player model" or "the geometry of a cubicle row", so a
// glTF loader can take over any entry here later without touching anything else.
//
// Sizes are in scene units: 1 unit = 16 world px (about a metre: the tech is ~1.75 tall).

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { PALETTE as P } from '../../data/palette.js';

export const UNIT = 16; // world px per scene unit
export const px = (v) => v / UNIT;

// One material for every vertex-colored model, so meshes batch well.
export const flatMaterial = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });

const tmpColor = new THREE.Color();
const tmpMatrix = new THREE.Matrix4();
const tmpEuler = new THREE.Euler();
const tmpQuat = new THREE.Quaternion();
const tmpPos = new THREE.Vector3();
const tmpScale = new THREE.Vector3(1, 1, 1);

// Paints a geometry one color (writes its `color` attribute) and moves it into place.
// Every part ends up non-indexed (flat shading needs no shared vertices), so all merge.
function paint(geo, color, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
  if (geo.index) {
    const flat = geo.toNonIndexed();
    geo.dispose();
    geo = flat;
  }
  tmpColor.set(color);
  const n = geo.attributes.position.count;
  const c = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    c[i * 3] = tmpColor.r;
    c[i * 3 + 1] = tmpColor.g;
    c[i * 3 + 2] = tmpColor.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(c, 3));
  geo.deleteAttribute('uv'); // no textures on models; keeps every part mergeable
  tmpQuat.setFromEuler(tmpEuler.set(rx, ry, rz));
  geo.applyMatrix4(tmpMatrix.compose(tmpPos.set(x, y, z), tmpQuat, tmpScale));
  return geo;
}

// Primitive helpers. Boxes and cylinders sit on their base: (x, y, z) is the bottom center.
export const box = (w, h, d, color, x = 0, y = 0, z = 0, ry = 0) =>
  paint(new THREE.BoxGeometry(w, h, d), color, x, y + h / 2, z, 0, ry);
export const cyl = (rTop, rBottom, h, color, x = 0, y = 0, z = 0, sides = 8) =>
  paint(new THREE.CylinderGeometry(rTop, rBottom, h, sides), color, x, y + h / 2, z);
// Centered shapes (for heads, foliage, cups).
export const ball = (r, color, x, y, z, detail = 0) => paint(new THREE.IcosahedronGeometry(r, detail), color, x, y, z);
const rotBox = (w, h, d, color, x, y, z, rx = 0, ry = 0, rz = 0) => paint(new THREE.BoxGeometry(w, h, d), color, x, y, z, rx, ry, rz);

export const merge = (parts) => {
  const g = mergeGeometries(parts, false);
  for (const p of parts) p.dispose();
  return g;
};

// --- The tech -------------------------------------------------------------------------
// Tier 1 Tech from the original sprite: brown hair, grey headset with a boom mic, blue
// polo, yellow lanyard and white badge, navy trousers, black shoes.
// Returns { root, legL, legR, armL, armR, body } so the renderer can animate the limbs.
export function createTechModel() {
  const root = new THREE.Group();
  const body = new THREE.Group(); // bobs while walking
  root.add(body);
  const mesh = (geo) => {
    const m = new THREE.Mesh(geo, flatMaterial);
    m.castShadow = true;
    return m;
  };

  // Legs hang from the hip (pivot at y = 0.82), so they can swing.
  const leg = (side) => {
    const g = new THREE.Group();
    g.position.set(side * 0.13, 0.82, 0);
    g.add(mesh(merge([box(0.2, 0.74, 0.22, P.n, 0, -0.78, 0), box(0.22, 0.1, 0.32, P.k, 0, -0.82, 0.04)])));
    body.add(g);
    return g;
  };
  // Arms hang from the shoulder: sleeve, forearm, hand.
  const arm = (side) => {
    const g = new THREE.Group();
    g.position.set(side * 0.37, 1.32, 0);
    g.add(mesh(merge([box(0.17, 0.26, 0.2, P.b, 0, -0.24, 0), box(0.13, 0.3, 0.15, P.s, 0, -0.52, 0), box(0.14, 0.1, 0.16, P.s, 0, -0.6, 0)])));
    body.add(g);
    return g;
  };
  const legL = leg(-1);
  const legR = leg(1);
  const armL = arm(-1);
  const armR = arm(1);

  body.add(mesh(merge([
    // Belt and polo.
    box(0.5, 0.08, 0.28, P.k, 0, 0.78, 0),
    box(0.56, 0.52, 0.3, P.b, 0, 0.84, 0),
    box(0.3, 0.06, 0.31, P.w, 0, 1.33, 0), // collar
    // Lanyard and badge on the chest.
    box(0.04, 0.26, 0.02, P.y, -0.07, 1.08, 0.155),
    box(0.04, 0.26, 0.02, P.y, 0.07, 1.08, 0.155),
    box(0.14, 0.16, 0.02, P.w, 0, 0.94, 0.16),
    box(0.1, 0.04, 0.025, P.B, 0, 1.03, 0.16),
    // Neck and head.
    box(0.16, 0.08, 0.16, P.s, 0, 1.36, 0),
    box(0.42, 0.4, 0.38, P.s, 0, 1.42, 0),
    // Eyes (facing +z, the way the tech walks).
    box(0.05, 0.07, 0.02, P.k, -0.09, 1.6, 0.19),
    box(0.05, 0.07, 0.02, P.k, 0.09, 1.6, 0.19),
    // Hair: a cap over the top and back.
    box(0.46, 0.12, 0.42, P.h, 0, 1.8, -0.01),
    box(0.46, 0.28, 0.1, P.h, 0, 1.54, -0.18),
    box(0.06, 0.12, 0.3, P.h, -0.21, 1.68, -0.03),
    box(0.06, 0.12, 0.3, P.h, 0.21, 1.68, -0.03),
    // Headset: band over the top, ear cups, boom mic to the mouth.
    box(0.5, 0.05, 0.08, P.G, 0, 1.9, 0),
    box(0.05, 0.25, 0.08, P.G, -0.24, 1.66, 0),
    box(0.05, 0.25, 0.08, P.G, 0.24, 1.66, 0),
    box(0.07, 0.16, 0.16, P.k, -0.25, 1.52, 0),
    box(0.07, 0.16, 0.16, P.k, 0.25, 1.52, 0),
    rotBox(0.03, 0.03, 0.24, P.G, -0.2, 1.5, 0.12, 0, 0.5, 0),
    box(0.06, 0.05, 0.05, P.k, -0.11, 1.48, 0.21),
  ])));
  return { root, body, legL, legR, armL, armR };
}

// --- Office furniture ---------------------------------------------------------------
// Each builder takes a prop from the simulation's layout (src/sim/floor.js, world px)
// and appends geometry in scene units to `out`. A chunk's parts are merged into one mesh.

// Small deterministic variety (which desks get a mug or papers) from integer coordinates.
const vary = (a, b) => (((Math.imul(a | 0, 73856093) ^ Math.imul(b | 0, 19349663)) >>> 0) % 1000) / 1000;

const PANEL_H = 1.35;
const SIDE_H = 1.2;

function cubicleRow(out, prop) {
  const { x, y, segments, yellow } = prop;
  const z0 = px(y);
  for (let i = 0; i < segments; i++) {
    const cx = px(x + i * 64 + 32); // cubicle center
    // Back partition: fabric panel with a light trim on top.
    out.push(box(px(64), PANEL_H, 0.18, yellow[i] ? '#c9a24e' : P.G, cx, 0, z0 + 0.12));
    out.push(box(px(64), 0.06, 0.22, P.g, cx, PANEL_H, z0 + 0.12));
    // Desk against the partition: top, front edge, modesty panel.
    const dz = z0 + px(6 + 13);
    out.push(box(px(58), 0.06, px(26), P.D, cx, 0.72, dz));
    out.push(box(px(58), 0.08, 0.06, P.E, cx, 0.66, dz + px(13) - 0.03));
    out.push(box(px(58) - 0.1, 0.62, 0.05, P.E, cx, 0.05, z0 + 0.35));
    // Monitor, stand and keyboard.
    out.push(box(0.12, 0.2, 0.12, P.k, cx, 0.78, dz - 0.25));
    out.push(box(0.72, 0.44, 0.06, P.k, cx, 0.96, dz - 0.28));
    out.push(box(0.64, 0.36, 0.02, P.B, cx, 1.0, dz - 0.245));
    out.push(box(0.56, 0.03, 0.18, P.g, cx, 0.78, dz + 0.22));
    // Something on the desk now and then.
    const v = vary(x + i, y);
    if (v < 0.35) out.push(cyl(0.06, 0.05, 0.13, P.w, cx + 0.9, 0.78, dz)); // mug
    else if (v < 0.65) out.push(box(0.32, 0.03, 0.42, P.w, cx - 0.95, 0.78, dz + 0.05, 0.3)); // papers
    if (vary(y, x + i) < 0.3) out.push(box(0.1, 0.1, 0.01, P.y, cx + 0.3, 1.0, dz - 0.21)); // sticky note on the screen
    // Chair in front (walkable in the original: only the partition and desk block).
    const chz = z0 + px(46);
    const ry = (v - 0.5) * 0.8;
    out.push(cyl(0.05, 0.05, 0.38, P.k, cx, 0.06, chz, 6));
    out.push(cyl(0.3, 0.3, 0.06, P.K, cx, 0.02, chz, 5));
    out.push(box(0.56, 0.1, 0.52, P.n, cx, 0.44, chz, ry));
    out.push(rotBox(0.54, 0.5, 0.08, P.n, cx - Math.sin(ry) * 0.26, 0.82, chz + Math.cos(ry) * 0.26, -0.12, ry, 0));
  }
  // Side panels between and at the ends of the cubicles, as deep as the solid part.
  for (let i = 0; i <= segments; i++) {
    const sx = px(x + i * 64);
    out.push(box(0.16, SIDE_H, px(38), P.G, sx, 0, z0 + px(19)));
    out.push(box(0.2, 0.06, px(38), P.g, sx, SIDE_H, z0 + px(19)));
  }
}

function waterCooler(out, { x, y }) {
  const cx = px(x + 6);
  const cz = px(y + 28) - 0.25;
  out.push(box(0.5, 0.95, 0.46, P.w, cx, 0, cz));
  out.push(box(0.5, 0.06, 0.46, P.g, cx, 0.95, cz));
  out.push(box(0.12, 0.08, 0.06, P.B, cx - 0.1, 0.62, cz + 0.25));
  out.push(box(0.12, 0.08, 0.06, P.r, cx + 0.1, 0.62, cz + 0.25));
  out.push(cyl(0.2, 0.22, 0.5, '#7fc4f0', cx, 1.01, cz, 8));
  out.push(cyl(0.08, 0.2, 0.1, '#7fc4f0', cx, 1.51, cz, 8));
}

function plant(out, { x, y }) {
  const cx = px(x + 8);
  const cz = px(y + 24) - 0.25;
  out.push(cyl(0.3, 0.22, 0.5, P.h, cx, 0, cz, 7));
  out.push(cyl(0.31, 0.31, 0.05, '#4a2e14', cx, 0.48, cz, 7));
  out.push(ball(0.45, P.e, cx, 0.95, cz));
  out.push(ball(0.32, '#2a8a4a', cx + 0.2, 1.3, cz - 0.1));
  out.push(ball(0.28, '#4fcf7a', cx - 0.18, 1.25, cz + 0.12));
}

const PROPS = { cubicleRow, waterCooler, plant };

// Geometry for a list of props, merged into one (or null when there's nothing).
export function propsGeometry(props) {
  const parts = [];
  for (const p of props) PROPS[p.type](parts, p);
  return parts.length ? merge(parts) : null;
}
