// The floor in 3D: a ground plane in the map's floor style that follows the camera, and
// per 256 px chunk of the simulation's layout (src/sim/floor.js) one merged furniture
// mesh, one mesh for its lights (rack LEDs, screens, the hot aisle), and the odd special
// floor tile (vented panels, cracks and oil stains, Merger Day's navy floor and logos).
// Chunks are built as they come into view (a couple per frame) and dropped when far away;
// a chunk is built again when its layout changes (Merger Day's floor changing hands), and
// all of them when the map changes.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { CHUNK, TILE, chunkKey, hash2 } from '../sim/floor.js';
import { PALETTE as P } from '../../data/palette.js';
import { flatMaterial, outlined, propsGeometry, px } from './models.js';

const BUILDS_PER_FRAME = 2;
const GROUND_SIZE = 192; // scene units; snapped to the floor pattern as the camera moves
const PATTERN = px(TILE * 2); // a ground texture covers 2 x 2 tiles
const TILES_PER_CHUNK = CHUNK / TILE;

// A 2 x 2-tile texture (64 texels per tile) painted by `paint(g, tx, ty, ox, oy, rnd)`.
function tileTexture(paint, repeat = GROUND_SIZE / PATTERN) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  let seed = 1234567;
  const rnd = () => ((seed = (Math.imul(seed, 1103515245) + 12345) >>> 0) / 4294967296);
  for (let ty = 0; ty < 2; ty++) for (let tx = 0; tx < 2; tx++) paint(g, tx, ty, tx * 64, ty * 64, rnd);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeat, repeat);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

// Speckles a tile: each 2 x 2 texel cell gets the first color whose odds it rolls.
function speckle(g, ox, oy, rnd, odds) {
  for (let y = 0; y < 64; y += 2)
    for (let x = 0; x < 64; x += 2) {
      let v = rnd();
      for (const [p, color] of odds) {
        if (v < p) {
          g.fillStyle = color;
          g.fillRect(ox + x, oy + y, 2, 2);
          break;
        }
        v -= p;
      }
    }
}

function seams(g, ox, oy, color, w = 2) {
  g.fillStyle = color;
  g.fillRect(ox + 64 - w, oy, w, 64);
  g.fillRect(ox, oy + 64 - w, 64, w);
}

// Ground textures per floor style (data/maps.js `floor`), like the original's tiles, a
// shade lighter so the furniture reads in 3D.
const GROUNDS = {
  // Grey carpet with darker flecks, alternating two weaves, a faint seam at each tile edge.
  office: () =>
    tileTexture((g, tx, ty, ox, oy, rnd) => {
      const dark = (tx + ty) & 1;
      g.fillStyle = dark ? '#3f3f46' : P.m;
      g.fillRect(ox, oy, 64, 64);
      speckle(g, ox, oy, rnd, [[dark ? 0.07 : 0.04, P.c], [0.04, '#57575f']]);
      seams(g, ox, oy, 'rgba(26, 28, 44, 0.35)');
    }),
  // Raised-floor panels: grey, a bevel highlight, dark seams and a screw in each corner.
  server: () =>
    tileTexture((g, tx, ty, ox, oy) => {
      g.fillStyle = '#5f7590';
      g.fillRect(ox, oy, 64, 64);
      g.fillStyle = '#8aa2b8';
      g.fillRect(ox, oy, 64, 2);
      g.fillRect(ox, oy, 2, 64);
      seams(g, ox, oy, P.R, 3);
      g.fillStyle = P.R;
      for (const [x, y] of [[6, 6], [56, 6], [6, 56], [56, 56]]) g.fillRect(ox + x, oy + y, 3, 3);
    }),
  // Navy call-center carpet, two weaves.
  callcenter: () =>
    tileTexture((g, tx, ty, ox, oy, rnd) => {
      const dark = (tx + ty) & 1;
      g.fillStyle = dark ? '#26326a' : '#2e3c7c';
      g.fillRect(ox, oy, 64, 64);
      speckle(g, ox, oy, rnd, [[dark ? 0.22 : 0.1, '#1d2246'], [0.03, P.b]]);
      seams(g, ox, oy, 'rgba(26, 28, 44, 0.5)');
    }),
  // Bare concrete with lighter and darker grit.
  garage: () =>
    tileTexture((g, tx, ty, ox, oy, rnd) => {
      g.fillStyle = '#55555c';
      g.fillRect(ox, oy, 64, 64);
      speckle(g, ox, oy, rnd, [[0.06, P.X], [0.04, P.c]]);
      seams(g, ox, oy, 'rgba(26, 28, 44, 0.25)', 1);
    }),
};
GROUNDS.merger = GROUNDS.office; // the old company's carpet; the parent company's floor is per chunk

// Special tiles, each its own texture: one 32 px tile (`corp` is the parent company's
// polished navy floor, 2 x 2 tiles, laid over a whole chunk).
const DECALS = {
  // A perforated raised-floor panel (the vents in front of the racks).
  vent: () =>
    tileTexture((g, tx, ty, ox, oy) => {
      if (tx || ty) return;
      g.fillStyle = '#5f7590';
      g.fillRect(0, 0, 128, 128);
      g.fillStyle = P.R;
      for (let y = 10; y < 118; y += 8) for (let x = 10; x < 118; x += 8) g.fillRect(x, y, 4, 4);
      g.fillRect(0, 122, 128, 6);
      g.fillRect(122, 0, 6, 128);
    }, 1),
  crack: () =>
    tileTexture((g, tx, ty, ox, oy, rnd) => {
      if (tx || ty) return;
      let x = 26;
      g.fillStyle = P.k;
      for (let y = 14; y < 112; y += 4) {
        g.fillRect(x, y, 4, 4);
        if (rnd() < 0.4) x += rnd() < 0.5 ? 4 : -4;
      }
    }, 1),
  oil: () =>
    tileTexture((g, tx, ty, ox, oy, rnd) => {
      if (tx || ty) return;
      for (let y = 30; y < 98; y += 4)
        for (let x = 30; x < 104; x += 4) {
          const d = Math.hypot((x - 68) / 36, (y - 64) / 28);
          if (d < 1 && rnd() < 1.2 - d) {
            g.fillStyle = d < 0.5 ? 'rgba(20, 20, 26, 0.9)' : 'rgba(40, 40, 48, 0.75)';
            g.fillRect(x, y, 4, 4);
          }
        }
    }, 1),
  corp: () =>
    tileTexture((g, tx, ty, ox, oy, rnd) => {
      g.fillStyle = (tx + ty) & 1 ? '#1b2552' : P.a;
      g.fillRect(ox, oy, 64, 64);
      // A diagonal sheen across the glossy tile, and the odd fleck.
      g.fillStyle = 'rgba(52, 72, 143, 0.55)';
      for (let k = 0; k < 52; k += 2) g.fillRect(ox + k, oy + 52 - k, 6, 2);
      speckle(g, ox, oy, rnd, [[0.02, P.A]]);
      seams(g, ox, oy, 'rgba(160, 112, 60, 0.7)', 2); // gold seams
    }, 4),
  // The merged company's logo inlaid in its floor: two interlocking rings.
  logo: () =>
    tileTexture((g, tx, ty) => {
      if (tx || ty) return;
      g.lineWidth = 6;
      g.strokeStyle = P.w;
      g.beginPath();
      g.arc(48, 62, 24, 0, Math.PI * 2);
      g.stroke();
      g.strokeStyle = P.y;
      g.beginPath();
      g.arc(78, 62, 24, 0, Math.PI * 2);
      g.stroke();
    }, 1),
};

// Which special tiles a chunk has, as the original picked its tile sprites: by a hash of
// the tile's global coordinates. Returns a list of [decal, tile x, tile y] (tile coords
// within the chunk), plus ['corp', 0, 0] for a whole acquired chunk.
function chunkDecals(style, cx, cy, acquired) {
  const list = [];
  if (style === 'merger' && acquired) list.push(['corp', 0, 0]);
  for (let ty = 0; ty < TILES_PER_CHUNK; ty++)
    for (let tx = 0; tx < TILES_PER_CHUNK; tx++) {
      const h = hash2(cx * 8 + tx, cy * 8 + ty);
      if (style === 'server' && h % 7 === 0) list.push(['vent', tx, ty]);
      else if (style === 'garage' && h % 41 < 2) list.push([h % 41 ? 'oil' : 'crack', tx, ty]);
      else if (style === 'merger' && acquired && h % 29 === 0) list.push(['logo', tx, ty]);
    }
  return list;
}

export class FloorView {
  constructor(scene, floor) {
    this.floor = floor; // the simulation's layout
    this.scene = scene;
    this.chunks = new Map(); // chunk key -> { layout, meshes }
    this.style = null;
    this.grounds = {}; // style -> texture, made when first needed
    this.ground = new THREE.Mesh(new THREE.PlaneGeometry(GROUND_SIZE, GROUND_SIZE), new THREE.MeshLambertMaterial());
    this.ground.rotation.x = -Math.PI / 2;
    this.ground.receiveShadow = true;
    scene.add(this.ground);
    // Lights: unlit and see-through, so the hot aisle glows over the floor.
    this.glowMaterial = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.9 });
    this.decalMaterials = {};
    this.decalGeo = new THREE.PlaneGeometry(px(TILE), px(TILE)).rotateX(-Math.PI / 2);
    this.corpGeo = new THREE.PlaneGeometry(px(CHUNK), px(CHUNK)).rotateX(-Math.PI / 2);
  }

  decalMaterial(id) {
    const opaque = id === 'corp' || id === 'vent'; // whole tiles; the rest are see-through marks
    return (this.decalMaterials[id] ??= new THREE.MeshLambertMaterial({ map: DECALS[id](), transparent: !opaque, depthWrite: opaque, polygonOffset: true, polygonOffsetFactor: -1 }));
  }

  // `rect` is the visible ground area in world px ({ x0, y0, x1, y1 }); `cx`, `cz` the
  // camera's ground point in scene units; `time` for the hot aisles' shimmer.
  update(rect, cx, cz, time = 0) {
    if (this.floor.style !== this.style) this.setStyle(this.floor.style);
    // Snap the plane to whole pattern repeats so the floor stays put under your feet.
    this.ground.position.set(Math.round(cx / PATTERN) * PATTERN, 0, Math.round(cz / PATTERN) * PATTERN);
    this.glowMaterial.opacity = this.style === 'server' ? 0.75 + 0.15 * Math.sin(time * 3) : 0.9;
    const pad = CHUNK / 2;
    const cx0 = Math.floor((rect.x0 - pad) / CHUNK);
    const cx1 = Math.floor((rect.x1 + pad) / CHUNK);
    const cy0 = Math.floor((rect.y0 - pad) / CHUNK);
    const cy1 = Math.floor((rect.y1 + pad) / CHUNK);
    let budget = this.chunks.size ? BUILDS_PER_FRAME : Infinity; // first frame: build them all
    for (let cy = cy0; cy <= cy1; cy++)
      for (let ccx = cx0; ccx <= cx1; ccx++) {
        const k = chunkKey(ccx, cy);
        const c = this.chunks.get(k);
        if (c && c.layout === this.floor.layouts.get(k)) continue; // up to date
        if (budget <= 0) continue;
        budget--;
        if (c) this.drop(c);
        this.chunks.set(k, this.build(ccx, cy));
      }
    // Drop chunks well outside the view.
    for (const [k, c] of this.chunks) {
      const kx = Math.floor(k / 65536) - 32768; // unkey(), without the array
      const ky = (k % 65536) - 32768;
      if (kx < cx0 - 2 || kx > cx1 + 2 || ky < cy0 - 2 || ky > cy1 + 2) {
        this.drop(c);
        this.chunks.delete(k);
      }
    }
  }

  // A new map: its ground, and every chunk built again.
  setStyle(style) {
    this.style = style;
    const tex = (this.grounds[style] ??= GROUNDS[style]());
    this.ground.material.map = tex;
    this.ground.material.needsUpdate = true;
    for (const c of this.chunks.values()) this.drop(c);
    this.chunks.clear();
  }

  build(cx, cy) {
    const layout = this.floor.layout(cx, cy);
    const meshes = [];
    const { solid, glow } = propsGeometry(layout.props);
    if (solid) {
      const mesh = new THREE.Mesh(solid, flatMaterial);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      meshes.push(outlined(mesh)); // inked like the people
    }
    if (glow) meshes.push(new THREE.Mesh(glow, this.glowMaterial));
    // Special floor tiles: one merged mesh per kind.
    const kinds = {};
    for (const [id, tx, ty] of chunkDecals(this.style, cx, cy, layout.acquired)) {
      const g = (id === 'corp' ? this.corpGeo : this.decalGeo).clone();
      const size = id === 'corp' ? CHUNK : TILE;
      g.translate(px(cx * CHUNK + tx * TILE + size / 2), id === 'corp' ? 0.003 : 0.006, px(cy * CHUNK + ty * TILE + size / 2));
      (kinds[id] ??= []).push(g);
    }
    for (const id in kinds) {
      const mesh = new THREE.Mesh(mergeGeometries(kinds[id]), this.decalMaterial(id));
      for (const g of kinds[id]) g.dispose();
      mesh.receiveShadow = true;
      mesh.renderOrder = -2;
      meshes.push(mesh);
    }
    for (const m of meshes) this.scene.add(m);
    return { layout, meshes };
  }

  drop(c) {
    for (const m of c.meshes) {
      this.scene.remove(m);
      m.geometry.dispose();
    }
  }
}
