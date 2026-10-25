// The office floor in 3D: a carpet plane that follows the camera, and one merged
// furniture mesh per 256 px chunk of the simulation's layout (src/sim/floor.js). Chunks
// are built as they come into view (a couple per frame) and dropped when far away.

import * as THREE from 'three';
import { CHUNK, TILE, chunkKey } from '../sim/floor.js';
import { PALETTE as P } from '../../data/palette.js';
import { flatMaterial, propsGeometry, px } from './models.js';

const BUILDS_PER_FRAME = 2;
const GROUND_SIZE = 192; // scene units; snapped to the carpet pattern as the camera moves
const PATTERN = px(TILE * 2); // the carpet texture covers 2 x 2 tiles

// Carpet tiles like the original's, a shade lighter so the furniture reads in 3D: grey
// with darker flecks, alternating two weaves, with a faint seam at each tile edge. 2 x 2 tiles.
function carpetTexture() {
  const size = 128; // 64 texels per tile
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  let seed = 1234567;
  const rnd = () => ((seed = (Math.imul(seed, 1103515245) + 12345) >>> 0) / 4294967296);
  for (let ty = 0; ty < 2; ty++)
    for (let tx = 0; tx < 2; tx++) {
      const dark = (tx + ty) & 1;
      const ox = tx * 64;
      const oy = ty * 64;
      g.fillStyle = dark ? '#3f3f46' : P.m;
      g.fillRect(ox, oy, 64, 64);
      const black = dark ? 0.07 : 0.04;
      for (let y = 0; y < 64; y += 2)
        for (let x = 0; x < 64; x += 2) {
          const v = rnd();
          if (v < black) g.fillStyle = P.c;
          else if (v < black + 0.04) g.fillStyle = '#57575f';
          else continue;
          g.fillRect(ox + x, oy + y, 2, 2);
        }
      g.fillStyle = 'rgba(26, 28, 44, 0.35)';
      g.fillRect(ox + 62, oy, 2, 64);
      g.fillRect(ox, oy + 62, 64, 2);
    }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(GROUND_SIZE / PATTERN, GROUND_SIZE / PATTERN);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

export class FloorView {
  constructor(scene, floor) {
    this.floor = floor; // the simulation's layout
    this.scene = scene;
    this.chunks = new Map(); // chunk key -> Mesh (or null for an empty chunk)
    this.ground = new THREE.Mesh(
      new THREE.PlaneGeometry(GROUND_SIZE, GROUND_SIZE),
      new THREE.MeshLambertMaterial({ map: carpetTexture() }),
    );
    this.ground.rotation.x = -Math.PI / 2;
    this.ground.receiveShadow = true;
    scene.add(this.ground);
  }

  // `rect` is the visible ground area in world px ({ x0, y0, x1, y1 }); `cx`, `cy` the
  // camera's ground point in scene units.
  update(rect, cx, cz) {
    // Snap the plane to whole pattern repeats so the carpet stays put under your feet.
    this.ground.position.set(Math.round(cx / PATTERN) * PATTERN, 0, Math.round(cz / PATTERN) * PATTERN);
    const pad = CHUNK / 2;
    const cx0 = Math.floor((rect.x0 - pad) / CHUNK);
    const cx1 = Math.floor((rect.x1 + pad) / CHUNK);
    const cy0 = Math.floor((rect.y0 - pad) / CHUNK);
    const cy1 = Math.floor((rect.y1 + pad) / CHUNK);
    let budget = this.chunks.size ? BUILDS_PER_FRAME : Infinity; // first frame: build them all
    for (let cy = cy0; cy <= cy1; cy++)
      for (let ccx = cx0; ccx <= cx1; ccx++) {
        const k = chunkKey(ccx, cy);
        if (this.chunks.has(k) || budget <= 0) continue;
        budget--;
        this.chunks.set(k, this.build(ccx, cy));
      }
    // Drop chunks well outside the view.
    for (const [k, mesh] of this.chunks) {
      const kx = Math.floor(k / 65536) - 32768;
      const ky = (k % 65536) - 32768;
      if (kx < cx0 - 2 || kx > cx1 + 2 || ky < cy0 - 2 || ky > cy1 + 2) {
        if (mesh) {
          this.scene.remove(mesh);
          mesh.geometry.dispose();
        }
        this.chunks.delete(k);
      }
    }
  }

  build(cx, cy) {
    const geo = propsGeometry(this.floor.layout(cx, cy).props);
    if (!geo) return null;
    const mesh = new THREE.Mesh(geo, flatMaterial);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.scene.add(mesh);
    return mesh;
  }
}
