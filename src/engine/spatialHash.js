// Ported unchanged from the original (HelpDeskSurvivor src/engine/).
// Uniform-grid spatial hash for collision queries, rebuilt every tick with a counting
// sort into preallocated typed arrays (zero allocations per frame).
//
// The grid is a fixed window of cols x rows cells centered on a point (the player);
// the world is endless, but everything that matters is near the player. Objects
// outside the window are simply not indexed.

export class SpatialHash {
  constructor(cellSize, cols, rows, maxItems) {
    this.cell = cellSize;
    this.ox = 0; // world position of the grid's top-left corner
    this.oy = 0;
    this.itemCell = new Int32Array(maxItems);
    this.sorted = new Int32Array(maxItems);
    this.resize(cols, rows);
  }

  // Changes the window to cols x rows cells (the game sizes it to the screen).
  resize(cols, rows = cols) {
    if (cols === this.cols && rows === this.rows && this.cellStart) return;
    this.cols = cols;
    this.rows = rows;
    this.cellStart = new Int32Array(cols * rows + 1);
    this.cellFill = new Int32Array(cols * rows);
  }

  // Index items[0..count) (objects with x, y) around (cx, cy).
  build(items, count, cx, cy) {
    const { cell, cols, rows, cellStart, cellFill, itemCell, sorted } = this;
    this.ox = cx - (cols * cell) / 2;
    this.oy = cy - (rows * cell) / 2;
    cellStart.fill(0);
    for (let i = 0; i < count; i++) {
      const it = items[i];
      const gx = Math.floor((it.x - this.ox) / cell);
      const gy = Math.floor((it.y - this.oy) / cell);
      if (gx < 0 || gy < 0 || gx >= cols || gy >= rows) {
        itemCell[i] = -1;
        continue;
      }
      const c = gy * cols + gx;
      itemCell[i] = c;
      cellStart[c + 1]++;
    }
    for (let c = 0; c < cols * rows; c++) cellStart[c + 1] += cellStart[c];
    cellFill.set(cellStart.subarray(0, cols * rows));
    for (let i = 0; i < count; i++) {
      const c = itemCell[i];
      if (c >= 0) sorted[cellFill[c]++] = i;
    }
  }

  // Writes indices of items in cells overlapping the circle into `out`; returns how
  // many. Callers do the exact distance check.
  query(x, y, r, out) {
    const { cell, cols, rows, cellStart, sorted } = this;
    const x0 = Math.max(0, Math.floor((x - r - this.ox) / cell));
    const y0 = Math.max(0, Math.floor((y - r - this.oy) / cell));
    const x1 = Math.min(cols - 1, Math.floor((x + r - this.ox) / cell));
    const y1 = Math.min(rows - 1, Math.floor((y + r - this.oy) / cell));
    let n = 0;
    const max = out.length;
    for (let gy = y0; gy <= y1; gy++) {
      for (let gx = x0; gx <= x1; gx++) {
        const c = gy * cols + gx;
        for (let k = cellStart[c], end = cellStart[c + 1]; k < end && n < max; k++) out[n++] = sorted[k];
      }
    }
    return n;
  }
}

// Shared result buffer for weapon and projectile hit checks. They run one after another
// and never nest a query inside another, so one buffer serves them all. (Game.scratch and
// scratch2 are separate buffers for the queries that do nest.)
export const hitBuf = new Int32Array(4096);
