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

// --- End-users ----------------------------------------------------------------------
// The horde is drawn instanced, so each user is one merged geometry (no moving limbs);
// the renderer makes them waddle and bob as a whole. Built facing +z, feet at y = 0.

// A generic office worker, like the original's shared end-user body: hair, skin, a top
// (with an optional inner shirt showing at the front), trousers or a skirt.
function person({ hair, skin = P.s, top, inner = null, pants = P.n, skirt = null, hairStyle = 'short' }) {
  const parts = [
    // Shoes and legs (or a skirt over bare legs).
    box(0.2, 0.1, 0.3, P.k, -0.12, 0, 0.03),
    box(0.2, 0.1, 0.3, P.k, 0.12, 0, 0.03),
  ];
  if (skirt) {
    parts.push(box(0.13, 0.4, 0.14, skin, -0.12, 0.1, 0), box(0.13, 0.4, 0.14, skin, 0.12, 0.1, 0));
    parts.push(cyl(0.27, 0.33, 0.36, skirt, 0, 0.44, 0, 7));
  } else {
    parts.push(box(0.2, 0.7, 0.22, pants, -0.12, 0.1, 0), box(0.2, 0.7, 0.22, pants, 0.12, 0.1, 0));
  }
  parts.push(
    box(0.54, 0.54, 0.3, top, 0, 0.78, 0), // torso
    box(0.15, 0.48, 0.18, top, -0.35, 0.82, 0), // arms
    box(0.15, 0.48, 0.18, top, 0.35, 0.82, 0),
    box(0.13, 0.12, 0.15, skin, -0.35, 0.72, 0), // hands
    box(0.13, 0.12, 0.15, skin, 0.35, 0.72, 0),
    box(0.15, 0.08, 0.15, skin, 0, 1.32, 0), // neck
    box(0.4, 0.38, 0.36, skin, 0, 1.38, 0), // head
    box(0.05, 0.07, 0.02, P.k, -0.09, 1.57, 0.18), // eyes
    box(0.05, 0.07, 0.02, P.k, 0.09, 1.57, 0.18),
  );
  if (inner) parts.push(box(0.16, 0.5, 0.02, inner, 0, 0.8, 0.155));
  if (hairStyle === 'bob') {
    parts.push(box(0.46, 0.14, 0.42, hair, 0, 1.74, -0.01), box(0.48, 0.34, 0.12, hair, 0, 1.42, -0.17));
    parts.push(box(0.07, 0.34, 0.36, hair, -0.22, 1.42, -0.02), box(0.07, 0.34, 0.36, hair, 0.22, 1.42, -0.02));
  } else {
    parts.push(box(0.44, 0.12, 0.4, hair, 0, 1.74, -0.01), box(0.44, 0.22, 0.1, hair, 0, 1.54, -0.17));
  }
  return parts;
}

// One builder per user sprite id (data/enemies.js `sprite`). Each returns merged geometry.
export const USER_MODELS = {
  // Password Reset Pam: purple cardigan over a white blouse, grey skirt, brown bob, waving
  // a yellow sticky note (her password, probably).
  pam: () => {
    const parts = person({ hair: P.h, top: P.p, inner: P.w, skirt: P.G, hairStyle: 'bob' });
    parts.push(rotBox(0.15, 0.42, 0.18, P.p, 0.4, 1.32, 0.05, 0, 0, -0.5)); // raised arm
    parts.push(box(0.26, 0.26, 0.03, P.y, 0.56, 1.5, 0.08)); // sticky note
    return merge(parts);
  },
  // "Quick Question" Quinn: green cardigan, blond, a speech bubble with a question mark.
  quinn: () => {
    const parts = person({ hair: P.y, top: P.e, inner: P.w });
    const bx = 0.42;
    const by = 2.05;
    parts.push(box(0.56, 0.46, 0.08, P.w, bx, by, 0)); // bubble
    parts.push(box(0.12, 0.12, 0.08, P.w, bx - 0.14, by - 0.1, 0)); // tail
    // The "?" in dark blocks on the bubble's front.
    parts.push(box(0.2, 0.06, 0.02, P.k, bx, by + 0.34, 0.05));
    parts.push(box(0.06, 0.1, 0.02, P.k, bx + 0.08, by + 0.24, 0.05));
    parts.push(box(0.1, 0.06, 0.02, P.k, bx + 0.02, by + 0.2, 0.05));
    parts.push(box(0.06, 0.06, 0.02, P.k, bx, by + 0.08, 0.05));
    return merge(parts);
  },
  // Reply-All Randy: white shirt, red tie, black hair, holding up an envelope.
  randy: () => {
    const parts = person({ hair: P.k, skin: P.S, top: P.w, inner: P.r });
    parts.push(rotBox(0.15, 0.42, 0.18, P.w, 0.4, 1.32, 0.05, 0, 0, -0.5));
    parts.push(box(0.4, 0.28, 0.04, P.w, 0.56, 1.46, 0.08)); // envelope
    parts.push(rotBox(0.27, 0.03, 0.02, P.k, 0.49, 1.66, 0.11, 0, 0, -0.55)); // flap
    parts.push(rotBox(0.27, 0.03, 0.02, P.k, 0.63, 1.66, 0.11, 0, 0, 0.55));
    return merge(parts);
  },
  // Reply-All Reply: a pint-sized Randy (the original's 16 x 16 sprite).
  randy_small: () => {
    const g = merge(person({ hair: P.k, skin: P.s, top: P.w, inner: P.r }));
    g.scale(0.6, 0.6, 0.6);
    return g;
  },
};

// --- Projectiles and shields --------------------------------------------------------
// Keyed by the weapon's `sprite` id from data/weapons.js. Each is centered on its own
// origin and points along +Z (the way it flies); the renderer lifts it to hand height.
// Flat things are stacked slabs, each a hair taller than the one below, so the top
// layer shows like the original sprite's pixels.

const slab = (w, d, color, layer, x = 0, z = 0) => box(w, 0.05 + layer * 0.006, d, color, x, -0.025, z);

function ticket(paper) {
  return merge([
    slab(0.46, 0.64, P.k, 0),
    slab(0.38, 0.56, paper, 1),
    slab(0.22, 0.4, P.r, 2), // the CLOSED stamp
    slab(0.12, 0.3, paper, 3),
  ]);
}

export const PROJECTILE_MODELS = {
  // Ticket Auto-Close: a ticket stamped CLOSED.
  proj_ticket: () => ticket(P.w),
  proj_ticket_gold: () => ticket(P.y),
  // KB Article: a page with a blue header and grey lines.
  proj_kb: () => merge([
    slab(0.56, 0.7, P.k, 0),
    slab(0.48, 0.62, P.w, 1),
    slab(0.22, 0.1, P.B, 2, -0.1, 0.22),
    slab(0.32, 0.04, P.g, 2, 0, 0.06),
    slab(0.26, 0.04, P.g, 2, -0.03, -0.06),
    slab(0.32, 0.04, P.g, 2, 0, -0.18),
  ]),
  // Remote Desktop Session: somebody else's mouse cursor, tip first.
  proj_rdp: () => {
    const shape = new THREE.Shape();
    const pts = [[0, 0], [0, -0.62], [0.15, -0.48], [0.26, -0.72], [0.36, -0.67], [0.25, -0.44], [0.44, -0.44]];
    shape.moveTo(pts[0][0], pts[0][1]);
    for (const [x, y] of pts.slice(1)) shape.lineTo(x, y);
    const body = new THREE.ExtrudeGeometry(shape, { depth: 0.08, bevelEnabled: false });
    const edge = body.clone();
    edge.translate(-0.2, 0.36, 0);
    edge.scale(1.25, 1.25, 0.9);
    body.translate(-0.2, 0.36, 0);
    // Lay it flat with the tip toward +Z (the edge, black and a size up, sits just below).
    return merge([paint(edge, P.k, 0, -0.03, 0, Math.PI / 2), paint(body, P.B, 0, 0.01, 0, Math.PI / 2)]);
  },
  // Auto-Scaling: a little cloud.
  proj_cloud: () => merge([
    ball(0.17, P.w, -0.17, 0, 0),
    ball(0.22, P.w, 0.04, 0.05, 0),
    ball(0.15, P.w, 0.24, -0.01, 0),
    ball(0.12, P.q, 0.08, -0.09, 0.1),
  ]),
  // Reply-All Storm: an envelope.
  proj_email: () => merge([
    slab(0.62, 0.44, P.k, 0),
    slab(0.54, 0.36, P.w, 1),
    rotBox(0.3, 0.06, 0.03, P.k, -0.12, 0.012, 0.06, 0, -0.6, 0),
    rotBox(0.3, 0.06, 0.03, P.k, 0.12, 0.012, 0.06, 0, 0.6, 0),
  ]),
  // Asset Tag: a white barcode sticker.
  proj_tag: () => merge([
    slab(0.56, 0.42, P.k, 0),
    slab(0.48, 0.34, P.w, 1),
    ...[-0.16, -0.08, 0.02, 0.08, 0.16].map((x, i) => slab(i % 2 ? 0.03 : 0.05, 0.2, P.k, 2, x, 0)),
  ]),
  // Fairway Driver: an orange disc golf driver.
  proj_disc: () => merge([
    cyl(0.36, 0.36, 0.06, P.k, 0, -0.03, 0, 12),
    cyl(0.32, 0.32, 0.066, P.o, 0, -0.03, 0, 12),
    cyl(0.2, 0.2, 0.07, P.w, 0, -0.03, 0, 12),
    cyl(0.15, 0.15, 0.074, P.o, 0, -0.03, 0, 12),
    cyl(0.05, 0.05, 0.078, P.r, 0, -0.03, 0, 6),
  ]),
  // Firewall: a block of bricks, standing, its face toward +Z.
  proj_firewall: () => {
    const W = 0.9;
    const parts = [box(W, 0.7, 0.2, P.k, 0, -0.35, 0)]; // the mortar
    for (let row = 0; row < 5; row++) {
      const y = -0.33 + row * 0.135;
      // Running bond: every other row starts with a half brick.
      const edges = row % 2 ? [-0.43, -0.32, -0.11, 0.1, 0.31, 0.43] : [-0.43, -0.22, -0.01, 0.2, 0.43];
      for (let i = 0; i < edges.length - 1; i++) {
        const x0 = edges[i] + 0.012;
        const x1 = edges[i + 1] - 0.012;
        parts.push(box(x1 - x0, 0.11, 0.26, P.r, (x0 + x1) / 2, y, 0));
      }
    }
    return merge(parts);
  },
};

// Stand-in for a projectile with no model yet: a small cube.
export const fallbackProjectile = () => box(0.24, 0.24, 0.24, P.w, 0, -0.12, 0);

// A soft round shadow on the floor, for the horde (and for the tech when shadows are off).
export function blobShadowGeometry(radius = 0.42) {
  const g = new THREE.CircleGeometry(radius, 14);
  g.rotateX(-Math.PI / 2);
  return g;
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
