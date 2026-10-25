// Endless floor in one of the map styles from data/maps.js (office, server, callcenter,
// garage, merger): the furniture layout and its solid rects, plus each map's floor
// features: the Server Room's hot aisles (isHot) and Merger Day's acquired floor
// (isAcquired). Ported from the original's src/game/floor.js. Each 256x256 chunk is laid
// out deterministically from its coordinates with the same RNG sequence as the original,
// so a chunk has the same furniture in the same places in both versions.
//
// The simulation only needs the solid rects and the floor features; the renderer
// (src/render/floor.js) reads the same layout as a list of props and builds meshes from
// it. A chunk's layout object is replaced when it changes (Merger Day's floor changing
// hands, or a new map), so the renderer rebuilds a chunk whenever layout() hands back a
// different object. World units are the original's pixels: x right, y down the screen
// (y becomes Three.js +Z).

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

// Value noise in 0..1, bilinearly interpolated between integer grid points.
function smooth(x, y) {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = x - x0;
  const fy = y - y0;
  const v = (i, j) => (hash2(x0 + i + 911, y0 + j + 377) % 1000) / 999;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const top = v(0, 0) + (v(1, 0) - v(0, 0)) * sx;
  const bottom = v(0, 1) + (v(1, 1) - v(0, 1)) * sx;
  return top + (bottom - top) * sy;
}

// How "legacy" a Merger Day chunk is (0..1): smooth noise, so the parent company's
// floor arrives as rounded regions, a little higher around the start so you begin on
// the old company's floor.
function legacy(cx, cy) {
  return 0.15 * Math.max(0, 1 - Math.hypot(cx, cy) / 4) + 0.85 * smooth(cx / 2.5, cy / 2.5);
}

// legacy() values of the chunks around the start, sorted: share -> threshold.
const LEGACY_QUANTILES = [];
for (let x = -8; x <= 8; x++) for (let y = -8; y <= 8; y++) if (Math.hypot(x, y) <= 8) LEGACY_QUANTILES.push(legacy(x, y));
LEGACY_QUANTILES.sort((a, b) => a - b);

function rng(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const chunkKey = (cx, cy) => (cx + 32768) * 65536 + (cy + 32768);
export const unkey = (k) => [Math.floor(k / 65536) - 32768, (k % 65536) - 32768];

// Adds a prop at chunk-local (x, y): the original sprite's top-left, so placements match.
function put(l, type, x, y, extra) {
  l.props.push({ type, x: l.bx + x, y: l.by + y, ...extra });
}

// Marks a chunk-local rect as solid furniture.
function block(l, x, y, w, h) {
  l.solids.push([l.bx + x, l.by + y, w, h]);
}

export class Floor {
  constructor() {
    this.layouts = new Map(); // chunk key -> { props, solids, hot, acquired }
    this.solid = true; // furniture blocks movement (set from the map's `solid`)
    this.hitSide = false;
    this.style = 'office';
    this.share = -1; // Merger Day: share of the floor the parent company owns (0..1)
    this.owned = -1; // ...as a threshold on legacy(): chunks below it are acquired
  }

  setStyle(style) {
    if (style === this.style) return;
    this.style = style;
    this.share = this.owned = -1;
    this.layouts.clear();
  }

  // Merger Day: the parent company now owns about `share` of the floor. Chunks that
  // changed hands, and their neighbours (whose integration line moved), are laid out again.
  setOwned(share) {
    if (share === this.share) return;
    this.share = share;
    const before = this.owned;
    this.owned = LEGACY_QUANTILES[Math.min(LEGACY_QUANTILES.length - 1, Math.floor(share * LEGACY_QUANTILES.length))];
    if (this.style !== 'merger') return;
    const flipped = (cx, cy) => {
      const l = legacy(cx, cy);
      return l < before !== l < this.owned;
    };
    for (const k of [...this.layouts.keys()]) {
      const [cx, cy] = unkey(k);
      if (flipped(cx, cy) || flipped(cx - 1, cy) || flipped(cx + 1, cy) || flipped(cx, cy - 1) || flipped(cx, cy + 1)) this.layouts.delete(k);
    }
  }

  acquiredChunk(cx, cy) {
    return legacy(cx, cy) < this.owned;
  }

  isAcquired(x, y) {
    return this.style === 'merger' && this.acquiredChunk(Math.floor(x / CHUNK), Math.floor(y / CHUNK));
  }

  // A chunk's layout: `props` for drawing ({ type, x, y, ... } in world px), `solids`
  // ([x, y, w, h] rects), the Server Room's `hot` aisle rect (or null) and, on Merger
  // Day, whether the parent company owns it (`acquired`).
  layout(cx, cy) {
    const k = chunkKey(cx, cy);
    let l = this.layouts.get(k);
    if (l) return l;
    l = { props: [], solids: [], hot: null, acquired: false, bx: cx * CHUNK, by: cy * CHUNK };
    const r = rng(hash2(cx * 7 + 3, cy * 13 + 5));
    const ox = 16 + Math.floor(r() * 40); // chunk-local, as in the original
    const oy = 16 + Math.floor(r() * 40);
    this[this.style](l, r, ox, oy, r(), cx, cy);
    if (this.layouts.size > MAX_CACHED) this.layouts.clear();
    this.layouts.set(k, l);
    return l;
  }

  office(l, r, ox, oy, roll) {
    if (roll < 0.55) {
      // Cubicle block: one or two rows of two or three cubicles.
      const segments = ox + 192 <= CHUNK - 8 && r() < 0.5 ? 3 : 2;
      const rows = r() < 0.5 ? 2 : 1;
      for (let row = 0; row < rows; row++) this.cubicleRow(l, r, ox, oy + row * 96, segments);
    } else if (roll < 0.65) {
      // Break area.
      put(l, 'waterCooler', ox + 40, oy + 20);
      put(l, 'plant', ox + 10, oy + 24);
      put(l, 'plant', ox + 60, oy + 24);
    } else if (roll < 0.8) {
      put(l, 'plant', ox + 60, oy + 60);
    }
  }

  // A row of cubicles: partition panels along the top, a desk pushed against each panel,
  // chairs in front, and side panels between neighbours. Some panels are yellow.
  cubicleRow(l, r, x, y, segments) {
    const yellow = [];
    for (let i = 0; i < segments; i++) yellow.push(r() < 0.2);
    put(l, 'cubicleRow', x, y, { segments, yellow });
    block(l, x - 3, y, segments * CUBICLE + 6, SOLID_DEPTH); // partition and desks, not chairs
  }

  // Merger Day: the old office (cubicles, half packed into moving boxes) next to the
  // parent company's floor (hot-desk benches, bean bags, SYNERGY banners). A dashed
  // integration line marks every border between the two.
  merger(l, r, ox, oy, roll, cx, cy) {
    const mine = (l.acquired = this.acquiredChunk(cx, cy));
    if (!mine) {
      this.office(l, r, ox, oy, roll);
      if (r() < 0.6) put(l, r() < 0.5 ? 'boxStack' : 'boxSingle', 200 - Math.floor(r() * 30), 190 + Math.floor(r() * 30));
    } else if (roll < 0.6) {
      const rows = r() < 0.5 ? 2 : 1;
      for (let i = 0; i < rows; i++) {
        put(l, 'benchDesk', ox + 20, oy + 20 + i * 70);
        block(l, ox + 20, oy + 24 + i * 70, 70, 20);
      }
      if (r() < 0.5) put(l, 'beanBag', ox + 110, oy + 50);
    } else if (roll < 0.85) {
      put(l, 'synergyBanner', ox + 30, oy + 30);
      put(l, 'beanBag', ox + 40, oy + 80);
      put(l, 'beanBag', ox + 80, oy + 90);
    }
    const edge = (x, y, w, h) => put(l, 'integrationLine', x, y, { w, h });
    if (this.acquiredChunk(cx, cy - 1) !== mine) edge(0, 0, CHUNK, 4);
    if (this.acquiredChunk(cx, cy + 1) !== mine) edge(0, CHUNK - 4, CHUNK, 4);
    if (this.acquiredChunk(cx - 1, cy) !== mine) edge(0, 0, 4, CHUNK);
    if (this.acquiredChunk(cx + 1, cy) !== mine) edge(CHUNK - 4, 0, 4, CHUNK);
  }

  // Server Room: a row of racks with its hot aisle (exhaust side) glowing in front.
  server(l, r, ox, oy, roll) {
    if (roll < 0.65) {
      const n = 3 + Math.floor(r() * 3);
      const x = Math.min(ox, CHUNK - n * 32 - 8);
      l.hot = [l.bx + x - 6, l.by + oy + 58, n * 32 + 12, 26];
      put(l, 'hotAisle', x - 6, oy + 58, { w: n * 32 + 12, h: 26 });
      const racks = [];
      for (let i = 0; i < n; i++) racks.push(Math.floor(r() * 3));
      put(l, 'rackRow', x, oy, { racks });
      block(l, x, oy + 4, n * 32, 52); // the hot aisle in front stays walkable
    } else if (roll < 0.8) {
      put(l, 'crac', ox + 30, oy + 30);
      block(l, ox + 30, oy + 34, 40, 44);
    }
  }

  // Call Center: clusters of headset pods behind low dividers, the odd queue wallboard.
  callcenter(l, r, ox, oy, roll) {
    if (roll < 0.7) {
      const n = ox + 4 * 34 <= CHUNK - 8 && r() < 0.5 ? 4 : 3;
      const rows = r() < 0.6 ? 2 : 1;
      for (let row = 0; row < rows; row++) {
        const y = oy + row * 64;
        put(l, 'podRow', ox, y, { n });
        block(l, ox - 2, y, n * 34, 32);
      }
    } else if (roll < 0.85) {
      put(l, 'wallboard', ox + 40, oy + 40);
    }
  }

  // Parking Garage: painted stalls with parked cars, and concrete pillars.
  garage(l, r, ox, oy, roll) {
    if (roll < 0.7) {
      const n = 4;
      const x0 = Math.min(ox, CHUNK - n * 44 - 8);
      const cars = [];
      for (let i = 0; i < n; i++)
        if (r() < 0.65) {
          cars.push(Math.floor(r() * 4)); // red, blue, white, green
          block(l, x0 + i * 44 + 9, oy + 12, 28, 46); // empty stalls stay walkable
        } else cars.push(-1);
      put(l, 'stalls', x0, oy, { cars });
    } else if (roll < 0.9) {
      put(l, 'pillar', ox + 40, oy + 40);
      block(l, ox + 40, oy + 44, 24, 36);
    }
  }

  // Is (x, y) in a Server Room hot aisle?
  isHot(x, y) {
    if (this.style !== 'server') return false;
    const h = this.layout(Math.floor(x / CHUNK), Math.floor(y / CHUNK)).hot;
    return !!h && x >= h[0] && x < h[0] + h[2] && y >= h[1] && y < h[1] + h[3];
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
