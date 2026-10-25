// Endless office floor: the furniture layout and its solid rects. Ported from the
// original's src/game/floor.js (Open Office style only, for now). Each 256x256 chunk is
// laid out deterministically from its coordinates with the same RNG sequence as the
// original, so a chunk has the same cubicles in the same places in both versions.
//
// The simulation only needs the solid rects; the renderer (src/render/floor.js) reads
// the same layout as a list of props and builds meshes from it. World units are the
// original's pixels: x right, y down the screen (y becomes Three.js +Z).

export const CHUNK = 256;
export const TILE = 32;
export const SOLID_DEPTH = 38; // px of a cubicle row that blocks: partition and desks, not chairs
export const CUBICLE = 64; // width of one cubicle in a row

const MAX_CACHED = 512;

// Integer hash -> 32-bit unsigned.
export function hash2(x, y) {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (h ^ (h >>> 16)) >>> 0;
}

function rng(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const chunkKey = (cx, cy) => (cx + 32768) * 65536 + (cy + 32768);

export class Floor {
  constructor() {
    this.layouts = new Map(); // chunk key -> { props, solids }
    this.solid = true; // furniture blocks movement (the Open Office has `solid: true`)
    this.hitSide = false;
  }

  // A chunk's layout: `props` for drawing ({ type, x, y, ... } in world px, x/y being the
  // original sprite's top-left so placements match) and `solids` ([x, y, w, h] rects).
  layout(cx, cy) {
    const k = chunkKey(cx, cy);
    let l = this.layouts.get(k);
    if (l) return l;
    l = { props: [], solids: [] };
    const r = rng(hash2(cx * 7 + 3, cy * 13 + 5));
    const lx = 16 + Math.floor(r() * 40); // chunk-local, as in the original
    const ly = 16 + Math.floor(r() * 40);
    this.office(l, r, lx, cx * CHUNK + lx, cy * CHUNK + ly, r());
    if (this.layouts.size > MAX_CACHED) this.layouts.clear();
    this.layouts.set(k, l);
    return l;
  }

  // `lx` is the block's x inside the chunk; `ox`, `oy` its world position.
  office(l, r, lx, ox, oy, roll) {
    if (roll < 0.55) {
      // Cubicle block: one or two rows of two or three cubicles.
      const segments = lx + 192 <= CHUNK - 8 && r() < 0.5 ? 3 : 2;
      const rows = r() < 0.5 ? 2 : 1;
      for (let row = 0; row < rows; row++) this.cubicleRow(l, r, ox, oy + row * 96, segments);
    } else if (roll < 0.65) {
      // Break area.
      l.props.push({ type: 'waterCooler', x: ox + 40, y: oy + 20 });
      l.props.push({ type: 'plant', x: ox + 10, y: oy + 24 });
      l.props.push({ type: 'plant', x: ox + 60, y: oy + 24 });
    } else if (roll < 0.8) {
      l.props.push({ type: 'plant', x: ox + 60, y: oy + 60 });
    }
  }

  // A row of cubicles: partition panels along the top, a desk pushed against each panel,
  // chairs in front, and side panels between neighbours. Some panels are yellow.
  cubicleRow(l, r, x, y, segments) {
    const yellow = [];
    for (let i = 0; i < segments; i++) yellow.push(r() < 0.2);
    l.props.push({ type: 'cubicleRow', x, y, segments, yellow });
    l.solids.push([x - 3, y, segments * CUBICLE + 6, SOLID_DEPTH]);
  }

  solidRects(cx, cy) {
    return this.layout(cx, cy).solids;
  }

  // Is the point (x, y) inside solid furniture?
  blocked(x, y) {
    if (!this.solid) return false;
    for (const s of this.solidRects(Math.floor(x / CHUNK), Math.floor(y / CHUNK)))
      if (x >= s[0] && x < s[0] + s[2] && y >= s[1] && y < s[1] + s[3]) return true;
    return false;
  }

  // Pushes `o` (anything with x, y) out of solid furniture, treating it as a circle of
  // radius `r` at its feet (`foot` px below o.y). Returns the last rect it touched (or
  // null); `this.hitSide` says which face: true for left/right, false for top/bottom.
  collide(o, foot, r) {
    if (!this.solid) return null;
    let hit = null;
    const fy = o.y + foot;
    const cx0 = Math.floor((o.x - r) / CHUNK);
    const cx1 = Math.floor((o.x + r) / CHUNK);
    const cy0 = Math.floor((fy - r) / CHUNK);
    const cy1 = Math.floor((fy + r) / CHUNK);
    for (let cy = cy0; cy <= cy1; cy++)
      for (let cx = cx0; cx <= cx1; cx++)
        for (const s of this.solidRects(cx, cy)) {
          const y = o.y + foot;
          const nx = Math.max(s[0], Math.min(o.x, s[0] + s[2]));
          const ny = Math.max(s[1], Math.min(y, s[1] + s[3]));
          const dx = o.x - nx;
          const dy = y - ny;
          const d2 = dx * dx + dy * dy;
          if (d2 >= r * r) continue;
          hit = s;
          if (d2 > 1e-6) {
            // Outside the rect: back off along the line from the closest point.
            const d = Math.sqrt(d2);
            o.x += (dx / d) * (r - d);
            o.y += (dy / d) * (r - d);
            this.hitSide = dx !== 0 && Math.abs(dx) >= Math.abs(dy);
          } else {
            // Feet inside the rect: leave by the nearest face.
            const left = o.x - s[0] + r;
            const right = s[0] + s[2] - o.x + r;
            const top = y - s[1] + r;
            const bottom = s[1] + s[3] - y + r;
            const m = Math.min(left, right, top, bottom);
            this.hitSide = m === left || m === right;
            if (m === left) o.x -= left;
            else if (m === right) o.x += right;
            else if (m === top) o.y -= top;
            else o.y += bottom;
          }
        }
    return hit;
  }
}
