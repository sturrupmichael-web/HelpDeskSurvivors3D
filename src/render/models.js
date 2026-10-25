// What everything looks like: low-poly models built from primitives, colored per vertex
// from the original palette (data/palette.js) and drawn with one flat-shaded material.
//
// This is the one place that knows about shapes. Gameplay never sees it, and the rest of
// the renderer only asks for "the player model" or "the geometry of a cubicle row", so a
// glTF loader can take over any entry here later without touching anything else.
//
// Sizes are in scene units: 1 unit = 16 world px (about a metre: the tech is ~1.65 tall, big head and all).

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { PALETTE as P } from '../../data/palette.js';

export const UNIT = 16; // world px per scene unit
export const px = (v) => v / UNIT;

// One material for every vertex-colored model, so meshes batch well.
export const flatMaterial = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });

// People are toon-shaded: light falls off in two hard steps instead of a smooth ramp.
const toonSteps = new THREE.DataTexture(new Uint8Array([150, 255]), 2, 1, THREE.RedFormat);
toonSteps.minFilter = toonSteps.magFilter = THREE.NearestFilter;
toonSteps.needsUpdate = true;
export const toonMaterial = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: toonSteps });

// ...and outlined, like the original sprites: an "inverted hull", the same geometry drawn
// again in dark ink with its back faces only, pushed out along the normals. Works with
// instancing too (the instance matrix is applied after the push).
export const OUTLINE = 0.028; // outline thickness, scene units
export const outlineMaterial = new THREE.MeshBasicMaterial({ color: P.k, side: THREE.BackSide });
outlineMaterial.onBeforeCompile = (shader) => {
  shader.vertexShader = shader.vertexShader.replace(
    '#include <begin_vertex>',
    `#include <begin_vertex>
    transformed += normal * ${OUTLINE.toFixed(3)};`,
  );
};

// A mesh's outline: a child that shares its geometry.
export function outlined(mesh) {
  const ink = new THREE.Mesh(mesh.geometry, outlineMaterial);
  mesh.add(ink);
  return mesh;
}

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

// Soft shapes for people: rounded and low-poly, so the cast reads as cartoon office
// workers rather than voxels. `sx, sy, sz` squash a shape before it's placed.
const shaped = (geo, color, x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) => {
  geo.scale(sx, sy, sz);
  return paint(geo, color, x, y, z, rx, ry, rz);
};
const sphere = (r, color, x, y, z, sx = 1, sy = 1, sz = 1, w = 7, h = 5) =>
  shaped(new THREE.SphereGeometry(r, w, h), color, x, y, z, 0, 0, 0, sx, sy, sz);
// A capsule centered on (x, y, z), tilted by rz (sideways) and rx (forward).
const capsule = (r, len, color, x, y, z, rx = 0, rz = 0) =>
  shaped(new THREE.CapsuleGeometry(r, len, 1, 6), color, x, y, z, rx, 0, rz);
// A turned shape from a [radius, height] profile (bodies, skirts).
const lathe = (profile, color, segments = 10) =>
  paint(new THREE.LatheGeometry(profile.map(([r, h]) => new THREE.Vector2(r, h)), segments), color);
// Hair: a cap over the head, tilted back so it covers more at the back than the front.
// `reach` is how far down it comes (radians from the crown).
const hairCap = (r, color, y, reach, tilt = -0.45, sx = 1.04) =>
  shaped(new THREE.SphereGeometry(r, 10, 6, 0, Math.PI * 2, 0, reach), color, 0, y, -0.01, tilt, 0, 0, sx, 1, 1);

// Everyone shares a body plan (feet at y = 0, facing +z): a big round head, a bean of
// a torso, short limbs. Heights in scene units.
const HEAD_Y = 1.26;
const HEAD_R = 0.33;
const TORSO = [[0, 0.42], [0.22, 0.43], [0.28, 0.52], [0.285, 0.7], [0.24, 0.88], [0.15, 0.97], [0, 0.99]];

function head(parts, skin, hair, hairStyle) {
  parts.push(
    sphere(0.1, skin, 0, 1.0, 0, 1, 1, 1, 6, 3), // neck
    sphere(HEAD_R, skin, 0, HEAD_Y, 0, 1, 0.95, 0.95, 10, 7),
    sphere(0.03, P.k, -0.11, HEAD_Y + 0.02, HEAD_R * 0.95, 0.8, 1.3, 0.5, 5, 3), // eyes (small: the outline fattens them)
    sphere(0.03, P.k, 0.11, HEAD_Y + 0.02, HEAD_R * 0.95, 0.8, 1.3, 0.5, 5, 3),
  );
  if (hairStyle === 'bob') parts.push(hairCap(HEAD_R + 0.03, hair, HEAD_Y + 0.02, 1.95, -0.5, 1.1));
  else parts.push(hairCap(HEAD_R + 0.025, hair, HEAD_Y + 0.02, 1.45, -0.45));
}

// --- The tech -------------------------------------------------------------------------
// Tier 1 Tech from the original sprite: brown hair, grey headset with a boom mic, blue
// polo, yellow lanyard and white badge, navy trousers, black shoes.
// Returns { root, legL, legR, armL, armR, body } so the renderer can animate the limbs.
export function createTechModel() {
  const root = new THREE.Group();
  const body = new THREE.Group(); // bobs while walking
  root.add(body);
  const mesh = (geo) => {
    const m = new THREE.Mesh(geo, toonMaterial);
    m.castShadow = true;
    return outlined(m);
  };

  // Legs hang from the hip, so they can swing: trouser leg and a round shoe.
  const leg = (side) => {
    const g = new THREE.Group();
    g.position.set(side * 0.11, 0.5, 0);
    g.add(mesh(merge([capsule(0.095, 0.24, P.n, 0, -0.22, 0), sphere(0.12, P.k, 0, -0.44, 0.05, 1, 0.6, 1.35)])));
    body.add(g);
    return g;
  };
  // Arms hang from the shoulder: sleeve, forearm, hand.
  const arm = (side) => {
    const g = new THREE.Group();
    g.position.set(side * 0.3, 0.88, 0);
    g.add(mesh(merge([
      capsule(0.08, 0.14, P.b, side * 0.02, -0.12, 0, 0, side * 0.15),
      capsule(0.06, 0.12, P.s, side * 0.05, -0.3, 0, 0, side * 0.15),
      sphere(0.075, P.s, side * 0.07, -0.42, 0.01),
    ])));
    body.add(g);
    return g;
  };
  const legL = leg(-1);
  const legR = leg(1);
  const armL = arm(-1);
  const armR = arm(1);

  const parts = [
    lathe(TORSO, P.b), // polo
    paint(new THREE.CylinderGeometry(0.235, 0.235, 0.06, 12), P.k, 0, 0.45, 0), // belt
    paint(new THREE.TorusGeometry(0.13, 0.045, 5, 12), P.w, 0, 0.96, 0, Math.PI / 2), // collar
    // Lanyard and badge on the chest.
    capsule(0.016, 0.2, P.y, -0.07, 0.8, 0.255, -0.35, 0.25),
    capsule(0.016, 0.2, P.y, 0.07, 0.8, 0.255, -0.35, -0.25),
    rotBox(0.13, 0.16, 0.03, P.w, 0, 0.66, 0.285),
    rotBox(0.09, 0.035, 0.035, P.B, 0, 0.71, 0.29),
  ];
  head(parts, P.s, P.h, 'short');
  parts.push(
    // Headset: a band over the top, ear cups, boom mic to the mouth.
    paint(new THREE.TorusGeometry(HEAD_R + 0.05, 0.025, 4, 14, Math.PI), P.G, 0, HEAD_Y, 0),
    paint(new THREE.CylinderGeometry(0.1, 0.1, 0.09, 10), P.k, -HEAD_R - 0.03, HEAD_Y - 0.02, 0, 0, 0, Math.PI / 2),
    paint(new THREE.CylinderGeometry(0.1, 0.1, 0.09, 10), P.k, HEAD_R + 0.03, HEAD_Y - 0.02, 0, 0, 0, Math.PI / 2),
    capsule(0.016, 0.26, P.G, -0.27, HEAD_Y - 0.1, 0.17, Math.PI / 2, 0.0),
    sphere(0.035, P.k, -0.16, HEAD_Y - 0.13, 0.31),
  );
  body.add(mesh(merge(parts)));
  return { root, body, legL, legR, armL, armR };
}

// --- End-users ----------------------------------------------------------------------
// The horde is drawn instanced, so each user is one merged geometry (no moving limbs);
// the renderer makes them waddle and bob as a whole. Built facing +z, feet at y = 0.

// A generic office worker, like the original's shared end-user body: hair, skin, a top
// (with an optional inner shirt showing at the neck, or a tie), trousers or a skirt. With
// `raised`, the right arm is left off for the caller to add holding something up.
function person({ hair, skin = P.s, top, inner = null, tie = null, pants = P.n, skirt = null, hairStyle = 'short', raised = false }) {
  const parts = [
    sphere(0.115, P.k, -0.11, 0.06, 0.04, 1, 0.6, 1.35), // shoes
    sphere(0.115, P.k, 0.11, 0.06, 0.04, 1, 0.6, 1.35),
  ];
  if (skirt) {
    parts.push(capsule(0.06, 0.24, skin, -0.1, 0.26, 0), capsule(0.06, 0.24, skin, 0.1, 0.26, 0));
    parts.push(paint(new THREE.CylinderGeometry(0.25, 0.32, 0.26, 12), skirt, 0, 0.47, 0));
  } else {
    parts.push(capsule(0.09, 0.24, pants, -0.11, 0.28, 0), capsule(0.09, 0.24, pants, 0.11, 0.28, 0));
  }
  parts.push(lathe(TORSO, top));
  // The shirt underneath shows as a V at the neck, or a tie down the front.
  if (inner) parts.push(shaped(new THREE.ConeGeometry(0.11, 0.24, 3), inner, 0, 0.86, 0.22, 0, 0, Math.PI, 1, 1, 0.45));
  if (tie) parts.push(capsule(0.035, 0.24, tie, 0, 0.74, 0.27, -0.2));
  // Arms hang a little out from the body, hands at the hips.
  parts.push(capsule(0.07, 0.3, top, -0.33, 0.68, 0, 0, -0.2), sphere(0.075, skin, -0.38, 0.47, 0.01));
  if (!raised) parts.push(capsule(0.07, 0.3, top, 0.33, 0.68, 0, 0, 0.2), sphere(0.075, skin, 0.38, 0.47, 0.01));
  head(parts, skin, hair, hairStyle);
  return parts;
}

// The right arm held up and out, hand at about (0.5, 1.2): for waving something.
const raisedArm = (top, skin) => [capsule(0.07, 0.3, top, 0.4, 0.96, 0.04, 0, -0.6), sphere(0.075, skin, 0.5, 1.17, 0.06)];

// One builder per user sprite id (data/enemies.js `sprite`). Each returns merged geometry.
export const USER_MODELS = {
  // Password Reset Pam: purple cardigan over a white blouse, grey skirt, brown bob, waving
  // a yellow sticky note (her password, probably).
  pam: () => {
    const parts = person({ hair: P.h, top: P.p, inner: P.w, skirt: P.G, hairStyle: 'bob', raised: true });
    parts.push(...raisedArm(P.p, P.s));
    parts.push(rotBox(0.24, 0.24, 0.03, P.y, 0.55, 1.33, 0.08, 0, 0, -0.15)); // sticky note
    return merge(parts);
  },
  // "Quick Question" Quinn: green cardigan, blond, a speech bubble with a question mark.
  quinn: () => {
    const parts = person({ hair: P.y, top: P.e, inner: P.w });
    const bx = 0.44;
    const by = 1.86;
    parts.push(sphere(0.3, P.w, bx, by, 0, 1, 0.8, 0.28, 12, 6)); // bubble
    parts.push(shaped(new THREE.ConeGeometry(0.08, 0.2, 5), P.w, bx - 0.16, by - 0.24, 0, 0, 0, 2.6)); // tail
    // The "?" in dark blocks on the bubble's front.
    parts.push(rotBox(0.16, 0.05, 0.03, P.k, bx, by + 0.12, 0.08));
    parts.push(rotBox(0.05, 0.09, 0.03, P.k, bx + 0.06, by + 0.06, 0.08));
    parts.push(rotBox(0.07, 0.05, 0.03, P.k, bx + 0.02, by, 0.08));
    parts.push(rotBox(0.05, 0.05, 0.03, P.k, bx, by - 0.12, 0.08));
    return merge(parts);
  },
  // Reply-All Randy: white shirt, red tie, black hair, holding up an envelope.
  randy: () => {
    const parts = person({ hair: P.k, skin: P.S, top: P.w, tie: P.r, raised: true });
    parts.push(...raisedArm(P.w, P.S));
    parts.push(rotBox(0.36, 0.25, 0.04, P.w, 0.56, 1.3, 0.08)); // envelope
    parts.push(rotBox(0.24, 0.03, 0.02, P.k, 0.49, 1.36, 0.11, 0, 0, -0.55)); // flap
    parts.push(rotBox(0.24, 0.03, 0.02, P.k, 0.63, 1.36, 0.11, 0, 0, 0.55));
    return merge(parts);
  },
  // Reply-All Reply: a pint-sized Randy (the original's 16 x 16 sprite).
  randy_small: () => {
    const g = merge(person({ hair: P.k, skin: P.s, top: P.w, tie: P.r }));
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

// --- Pickups ---------------------------------------------------------------------------
// Closed Tickets (one per tier in data/pickups.js) and floor items, keyed by the original
// sprite id. Centered on their origin; the renderer floats, bobs and spins them.

// A ticket stub with a white check on both faces, in its tier color.
function stub(color) {
  const check = (z) => [
    rotBox(0.07, 0.16, 0.02, P.w, -0.06, -0.02, z, 0, 0, 0.7),
    rotBox(0.07, 0.3, 0.02, P.w, 0.06, 0.02, z, 0, 0, -0.6),
  ];
  return merge([
    rotBox(0.5, 0.34, 0.07, P.k, 0, 0, 0),
    rotBox(0.44, 0.28, 0.09, color, 0, 0, 0),
    ...check(0.05),
    ...check(-0.05),
  ]);
}

export const PICKUP_MODELS = {
  ticket_blue: () => stub(P.B),
  ticket_green: () => stub(P.e),
  ticket_gold: () => stub(P.y),
  // Leftover Vendor-Lunch Pizza: a slice, tip first.
  pizza: () => merge([
    paint(new THREE.CylinderGeometry(0.42, 0.42, 0.08, 3), P.y, 0, 0, 0.06, 0, Math.PI, 0),
    box(0.68, 0.1, 0.12, P.d, 0, -0.04, -0.17),
    cyl(0.06, 0.06, 0.1, P.r, -0.1, -0.03, -0.02, 6),
    cyl(0.06, 0.06, 0.1, P.r, 0.12, -0.03, -0.04, 6),
    cyl(0.05, 0.05, 0.1, P.r, 0.0, -0.03, 0.2, 6),
  ]),
  // Bulk Close: the big CLOSED stamp.
  bulk_close: () => merge([
    box(0.62, 0.1, 0.36, P.k, 0, -0.3, 0),
    box(0.58, 0.16, 0.32, P.r, 0, -0.2, 0),
    box(0.5, 0.04, 0.33, P.w, 0, -0.12, 0),
    cyl(0.06, 0.08, 0.26, P.h, 0, -0.04, 0, 6),
    ball(0.13, P.h, 0, 0.28, 0, 1),
  ]),
  // Change Approved: a taped-up box with a green check label.
  chest: () => merge([
    box(0.64, 0.46, 0.46, P.d, 0, -0.23, 0),
    box(0.66, 0.06, 0.48, P.h, 0, 0.17, 0), // lid seam
    box(0.12, 0.48, 0.48, P.y, 0, -0.24, 0), // tape
    box(0.2, 0.18, 0.02, P.w, -0.18, -0.12, 0.235), // label
    rotBox(0.04, 0.07, 0.02, P.e, -0.21, -0.13, 0.25, 0, 0, 0.7),
    rotBox(0.04, 0.12, 0.02, P.e, -0.16, -0.11, 0.25, 0, 0, -0.6),
  ]),
  // PTO Request: a calendar page with a beach on it.
  pto: () => merge([
    rotBox(0.5, 0.44, 0.06, P.k, 0, 0, 0),
    rotBox(0.44, 0.38, 0.08, P.w, 0, -0.02, 0),
    rotBox(0.44, 0.08, 0.09, P.r, 0, 0.17, 0),
    rotBox(0.44, 0.1, 0.09, P.B, 0, -0.14, 0),
    ball(0.07, P.y, -0.08, 0.02, 0.04, 0),
  ]),
  // Welcome Swag Bag: a navy tote with the new logo.
  swag_bag: () => merge([
    rotBox(0.5, 0.44, 0.2, P.a, 0, -0.06, 0),
    rotBox(0.2, 0.16, 0.22, P.y, 0.04, -0.04, 0),
    paint(new THREE.TorusGeometry(0.13, 0.025, 4, 10, Math.PI), P.k, 0, 0.16, 0),
  ]),
  // Fruit gummies: a purple bag with a window of gummies.
  gummies: () => merge([
    rotBox(0.46, 0.4, 0.14, P.p, 0, 0, 0),
    rotBox(0.46, 0.06, 0.15, P.w, 0, 0.18, 0),
    rotBox(0.3, 0.2, 0.16, P.w, 0, -0.02, 0),
    ball(0.05, P.r, -0.07, 0.0, 0.07, 0),
    ball(0.05, P.e, 0.04, -0.05, 0.07, 0),
    ball(0.05, P.o, 0.08, 0.04, 0.07, 0),
  ]),
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
