/**
 * Tracing (Number tracing and Letter tracing): the pure
 * engine behind the trace board. Pure: no DOM, no React.
 *
 * - A glyph becomes a **mask**: a width × height grid of on and off cells, taken
 *   from the board's own drawing of the glyph (`maskFromAlpha`).
 * - Every separate **part** of the mask (the "1" and the "0" of 10, the dot of
 *   i, the cedilla of Ç, the two dots of Ü) is found by 8-connected labelling.
 *   Specks below `MIN_PART` of the mask are dropped.
 * - The **centre line** is the mask thinned to one cell (Zhang and Suen). A part
 *   whose line thins away entirely keeps one cell near its middle.
 * - The **allowed area** is the mask widened by a tolerance (a disc).
 * - The **pen** paints every mask cell within its radius of a pen point that is
 *   inside the allowed area: the radius is the ink's, so what counts is what
 *   the child sees painted. A stroke that leaves the allowed area is reported
 *   once per stroke (`stroke` answers `left`).
 * - A glyph is **traced** when every part (the dot of i, a cedilla) has at
 *   least `SUCCESS` of its area painted and at least `LINE_SUCCESS` of its
 *   centre line, so a short stroke (a Q's tail, a t's bar), little area but
 *   much line, is never skipped either.
 */

/** The share of each part's area that must be painted. */
export const SUCCESS = 0.9;

/** The share of each part's centre line that must be painted. */
export const LINE_SUCCESS = 0.97;

/**
 * The ink's width, a share of the path's: a little wider than the path, so a
 * stroke a little off the middle still paints the path's whole width.
 */
export const INK_WIDTH = 1.2;

/** A part smaller than this share of the whole mask is a speck, not a part. */
export const MIN_PART = 0.004;

/**
 * The path widths and tolerances, as shares of the font size: `grow` is the
 * extra outline drawn round the glyph (a wider path to stay inside), and
 * `tolerance` how far outside the drawn path the pen may go before it has left.
 */
export const PATHS = Object.freeze({
  wide: Object.freeze({ grow: 0.08, tolerance: 0.06 }),
  middle: Object.freeze({ grow: 0.04, tolerance: 0.045 }),
  narrow: Object.freeze({ grow: 0, tolerance: 0.03 }),
});

/** @typedef {{ width: number, height: number, cells: Uint8Array }} Grid */

/**
 * @typedef {{
 *   width: number, height: number,
 *   mask: Grid, allowed: Grid,
 *   cellPart: Int32Array,
 *   partTotals: number[],
 *   points: Int32Array,
 *   pointPart: Int32Array,
 *   strokeWidth: number,
 *   pen: number,
 * }} Trace
 * `cellPart[cell]` is the cell's part plus one (0 off the mask); `partTotals[n]`
 * is part n's size in cells. `points` holds x, y pairs of the centre line;
 * `pointPart[i]` is point i's part (0-based). `pen` is the ink's radius in cells.
 */

/**
 * @typedef {{ painted: Uint8Array, count: number, partCounts: number[] }} Coverage
 * `painted[cell]` is 1 on a painted mask cell; `count` and `partCounts` count them.
 */

/**
 * An empty grid.
 *
 * @param {number} width
 * @param {number} height
 * @returns {Grid}
 */
export function makeGrid(width, height) {
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width < 1 || height < 1) {
    throw new RangeError('a grid needs a whole width and height of at least 1');
  }
  return { width, height, cells: new Uint8Array(width * height) };
}

/**
 * A grid from rows of text, `#` on and anything else off (for checks).
 *
 * @param {string[]} rows
 * @returns {Grid}
 */
export function gridFromRows(rows) {
  const grid = makeGrid(Math.max(...rows.map((row) => row.length)), rows.length);
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x += 1) if (row[x] === '#') grid.cells[y * grid.width + x] = 1;
  });
  return grid;
}

/**
 * The mask of a drawing: a cell is on where the drawing's cover (alpha) is at
 * least `cut` of 255.
 *
 * @param {ArrayLike<number>} rgba  four numbers a cell, as a canvas gives them
 * @param {number} width
 * @param {number} height
 * @param {number} [cut]
 * @returns {Grid}
 */
export function maskFromAlpha(rgba, width, height, cut = 128) {
  const grid = makeGrid(width, height);
  for (let cell = 0; cell < width * height; cell += 1) grid.cells[cell] = rgba[cell * 4 + 3] >= cut ? 1 : 0;
  return grid;
}

/** How many cells are on. @param {Grid} grid */
export function countOn(grid) {
  let count = 0;
  for (const cell of grid.cells) count += cell;
  return count;
}

/**
 * The separate parts of a mask, 8-connected: `labels[cell]` is 0 off the mask
 * and 1, 2, … for each part, in reading order; `sizes[n - 1]` is part n's size.
 *
 * @param {Grid} mask
 * @returns {{ labels: Int32Array, sizes: number[] }}
 */
export function labelParts(mask) {
  const { width, height, cells } = mask;
  const labels = new Int32Array(width * height);
  /** @type {number[]} */
  const sizes = [];
  const queue = new Int32Array(width * height);
  for (let first = 0; first < cells.length; first += 1) {
    if (!cells[first] || labels[first]) continue;
    const label = sizes.length + 1;
    let head = 0;
    let tail = 0;
    queue[tail++] = first;
    labels[first] = label;
    while (head < tail) {
      const cell = queue[head++];
      const x = cell % width;
      const y = (cell - x) / width;
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          const next = ny * width + nx;
          if (cells[next] && !labels[next]) {
            labels[next] = label;
            queue[tail++] = next;
          }
        }
      }
    }
    sizes.push(tail);
  }
  return { labels, sizes };
}

/**
 * The mask without its specks: parts smaller than `share` of all its cells.
 *
 * @param {Grid} mask
 * @param {number} [share]
 * @returns {Grid}
 */
export function dropSpecks(mask, share = MIN_PART) {
  const { labels, sizes } = labelParts(mask);
  const total = sizes.reduce((sum, size) => sum + size, 0);
  const clean = makeGrid(mask.width, mask.height);
  for (let cell = 0; cell < labels.length; cell += 1) {
    const label = labels[cell];
    if (label && sizes[label - 1] >= share * total) clean.cells[cell] = 1;
  }
  return clean;
}

/**
 * The centre line: the mask thinned to one cell wide (Zhang and Suen, 1984),
 * keeping its shape's joins and loops.
 *
 * @param {Grid} mask
 * @returns {Grid}
 */
export function thin(mask) {
  const { width, height } = mask;
  const cells = Uint8Array.from(mask.cells);
  const at = (x, y) => (x < 0 || y < 0 || x >= width || y >= height ? 0 : cells[y * width + x]);
  /** @type {number[]} */
  const remove = [];
  let changed = true;
  while (changed) {
    changed = false;
    for (const second of [false, true]) {
      remove.length = 0;
      for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
          if (!cells[y * width + x]) continue;
          // The eight neighbours, clockwise from the one above.
          const p2 = at(x, y - 1);
          const p3 = at(x + 1, y - 1);
          const p4 = at(x + 1, y);
          const p5 = at(x + 1, y + 1);
          const p6 = at(x, y + 1);
          const p7 = at(x - 1, y + 1);
          const p8 = at(x - 1, y);
          const p9 = at(x - 1, y - 1);
          const on = p2 + p3 + p4 + p5 + p6 + p7 + p8 + p9;
          if (on < 2 || on > 6) continue;
          const ring = [p2, p3, p4, p5, p6, p7, p8, p9, p2];
          let rises = 0;
          for (let n = 0; n < 8; n += 1) if (ring[n] === 0 && ring[n + 1] === 1) rises += 1;
          if (rises !== 1) continue;
          if (second ? p2 * p4 * p8 || p2 * p6 * p8 : p2 * p4 * p6 || p4 * p6 * p8) continue;
          remove.push(y * width + x);
        }
      }
      for (const cell of remove) cells[cell] = 0;
      if (remove.length > 0) changed = true;
    }
  }
  return { width, height, cells };
}

/**
 * The mask widened by a disc of `radius` cells: every cell within `radius` of
 * an on cell is on.
 *
 * @param {Grid} mask
 * @param {number} radius
 * @returns {Grid}
 */
export function widen(mask, radius) {
  const { width, height, cells } = mask;
  const wide = { width, height, cells: Uint8Array.from(cells) };
  const reach = Math.max(0, Math.floor(radius));
  if (reach === 0) return wide;
  /** @type {[number, number][]} */
  const disc = [];
  for (let dy = -reach; dy <= reach; dy += 1) {
    for (let dx = -reach; dx <= reach; dx += 1) if (dx * dx + dy * dy <= radius * radius) disc.push([dx, dy]);
  }
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (!cells[y * width + x]) continue;
      // Only an edge cell can reach outside the mask.
      const inner =
        x > 0 && y > 0 && x < width - 1 && y < height - 1 &&
        cells[y * width + x - 1] && cells[y * width + x + 1] && cells[(y - 1) * width + x] && cells[(y + 1) * width + x];
      if (inner) continue;
      for (const [dx, dy] of disc) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx >= 0 && ny >= 0 && nx < width && ny < height) wide.cells[ny * width + nx] = 1;
      }
    }
  }
  return wide;
}

/**
 * How deep inside the mask each cell is: the distance, in cells, from an on
 * cell to the nearest off cell (or the grid's edge), by a two-pass chamfer
 * (steps of 3 straight and 4 diagonal, divided by 3). Off cells are 0.
 *
 * @param {Grid} mask
 * @returns {Float64Array}
 */
export function depth(mask) {
  const { width, height, cells } = mask;
  const far = 3 * (width + height);
  const steps = new Float64Array(width * height);
  for (let cell = 0; cell < cells.length; cell += 1) steps[cell] = cells[cell] ? far : 0;
  const at = (x, y) => (x < 0 || y < 0 || x >= width || y >= height ? 0 : steps[y * width + x]);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const cell = y * width + x;
      if (!steps[cell]) continue;
      steps[cell] = Math.min(steps[cell], at(x - 1, y) + 3, at(x, y - 1) + 3, at(x - 1, y - 1) + 4, at(x + 1, y - 1) + 4);
    }
  }
  for (let y = height - 1; y >= 0; y -= 1) {
    for (let x = width - 1; x >= 0; x -= 1) {
      const cell = y * width + x;
      if (!steps[cell]) continue;
      steps[cell] = Math.min(steps[cell], at(x + 1, y) + 3, at(x, y + 1) + 3, at(x + 1, y + 1) + 4, at(x - 1, y + 1) + 4);
    }
  }
  for (let cell = 0; cell < steps.length; cell += 1) steps[cell] /= 3;
  return steps;
}

/**
 * Everything the board needs to follow a pen over one glyph.
 *
 * @param {Grid} rawMask
 * @param {{ tolerance: number, pen?: number }} options  in cells; `pen` (the ink's
 *   radius) defaults to `INK_WIDTH` of the glyph's stroke width, halved.
 * @returns {Trace}
 */
export function prepare(rawMask, { tolerance, pen }) {
  const mask = dropSpecks(rawMask);
  const { width, height } = mask;
  const { labels, sizes } = labelParts(mask);
  const line = thin(mask);

  /** @type {number[]} */
  const xs = [];
  /** @type {number[]} */
  const ys = [];
  /** @type {number[]} */
  const parts = [];
  const seen = new Set();
  for (let cell = 0; cell < line.cells.length; cell += 1) {
    if (!line.cells[cell]) continue;
    xs.push(cell % width);
    ys.push(Math.floor(cell / width));
    parts.push(labels[cell] - 1);
    seen.add(labels[cell]);
  }
  // A part that thinned away entirely keeps the cell of it nearest its middle.
  for (let label = 1; label <= sizes.length; label += 1) {
    if (seen.has(label)) continue;
    let sumX = 0;
    let sumY = 0;
    for (let cell = 0; cell < labels.length; cell += 1) {
      if (labels[cell] !== label) continue;
      sumX += cell % width;
      sumY += Math.floor(cell / width);
    }
    const midX = sumX / sizes[label - 1];
    const midY = sumY / sizes[label - 1];
    let best = -1;
    let bestDistance = Infinity;
    for (let cell = 0; cell < labels.length; cell += 1) {
      if (labels[cell] !== label) continue;
      const distance = (cell % width - midX) ** 2 + (Math.floor(cell / width) - midY) ** 2;
      if (distance < bestDistance) {
        bestDistance = distance;
        best = cell;
      }
    }
    xs.push(best % width);
    ys.push(Math.floor(best / width));
    parts.push(label - 1);
  }

  const total = xs.length;
  const points = new Int32Array(total * 2);
  const pointPart = Int32Array.from(parts);
  for (let index = 0; index < total; index += 1) {
    points[index * 2] = xs[index];
    points[index * 2 + 1] = ys[index];
  }

  // The stroke's width: twice the middle depth of the centre line.
  const depths = depth(mask);
  const along = xs.map((x, index) => depths[ys[index] * width + x]).sort((a, b) => a - b);
  const strokeWidth = total > 0 ? 2 * along[Math.floor(total / 2)] : 0;
  const reach = Math.max(0, tolerance);
  return {
    width,
    height,
    mask,
    allowed: widen(mask, reach),
    cellPart: labels,
    partTotals: [...sizes],
    points,
    pointPart,
    strokeWidth,
    pen: pen ?? Math.max(1.5, (strokeWidth * INK_WIDTH) / 2),
  };
}

/** A fresh, empty coverage for a trace. @param {Trace} trace @returns {Coverage} */
export function startCoverage(trace) {
  return { painted: new Uint8Array(trace.width * trace.height), count: 0, partCounts: trace.partTotals.map(() => 0) };
}

/**
 * Whether a point (in cells, fractions allowed) is inside the allowed area.
 *
 * @param {Trace} trace
 * @param {number} x
 * @param {number} y
 */
export function inside(trace, x, y) {
  const cx = Math.floor(x);
  const cy = Math.floor(y);
  if (!Number.isFinite(x) || !Number.isFinite(y) || cx < 0 || cy < 0 || cx >= trace.width || cy >= trace.height) return false;
  return trace.allowed.cells[cy * trace.width + cx] === 1;
}

/**
 * Paints the mask cells whose middles are within the pen's radius of one pen
 * point. Answers how many cells it newly painted. A point outside the allowed
 * area paints nothing.
 *
 * @param {Trace} trace
 * @param {Coverage} coverage
 * @param {number} x
 * @param {number} y
 */
export function stamp(trace, coverage, x, y) {
  if (!inside(trace, x, y)) return 0;
  const { width, height, pen, cellPart } = trace;
  let added = 0;
  const top = Math.max(0, Math.floor(y - pen));
  const bottom = Math.min(height - 1, Math.ceil(y + pen));
  const left = Math.max(0, Math.floor(x - pen));
  const right = Math.min(width - 1, Math.ceil(x + pen));
  for (let cy = top; cy <= bottom; cy += 1) {
    for (let cx = left; cx <= right; cx += 1) {
      const cell = cy * width + cx;
      if (cellPart[cell] === 0 || coverage.painted[cell]) continue;
      const dx = cx + 0.5 - x;
      const dy = cy + 0.5 - y;
      if (dx * dx + dy * dy > pen * pen) continue;
      coverage.painted[cell] = 1;
      coverage.count += 1;
      coverage.partCounts[cellPart[cell] - 1] += 1;
      added += 1;
    }
  }
  return added;
}

/**
 * The pen moved in a straight line from `from` to `to` (cells). Walks it a cell
 * at a time: every step inside the allowed area paints, and `left` answers
 * whether any step was outside it.
 *
 * @param {Trace} trace
 * @param {Coverage} coverage
 * @param {{ x: number, y: number }} from
 * @param {{ x: number, y: number }} to
 * @returns {{ left: boolean, added: number }}
 */
export function stroke(trace, coverage, from, to) {
  const length = Math.hypot(to.x - from.x, to.y - from.y);
  const steps = Math.max(1, Math.ceil(length));
  // Stamping every few cells is enough: each stamp paints `pen` cells round.
  const every = Math.max(1, Math.floor(trace.pen / 2));
  let left = false;
  let added = 0;
  for (let step = 1; step <= steps; step += 1) {
    const x = from.x + ((to.x - from.x) * step) / steps;
    const y = from.y + ((to.y - from.y) * step) / steps;
    if (!inside(trace, x, y)) {
      left = true;
      continue;
    }
    if (step % every === 0 || step === steps) added += stamp(trace, coverage, x, y);
  }
  return { left, added };
}

/**
 * How far the tracing has come.
 *
 * @param {Trace} trace
 * @param {Coverage} coverage
 * @returns {{ fraction: number, line: number, parts: boolean[], done: boolean, missingPart: boolean }}
 *   `fraction`: the share of the whole area painted; `line`: of the whole centre
 *   line; `parts`: whether each part is done; `missingPart`: the biggest part is
 *   done but another (a dot, a cedilla) is not.
 */
export function measure(trace, coverage) {
  const total = trace.partTotals.reduce((sum, size) => sum + size, 0);
  const fraction = total > 0 ? coverage.count / total : 0;
  const lineTotals = trace.partTotals.map(() => 0);
  const linePainted = trace.partTotals.map(() => 0);
  for (let index = 0; index < trace.pointPart.length; index += 1) {
    const part = trace.pointPart[index];
    lineTotals[part] += 1;
    if (coverage.painted[trace.points[index * 2 + 1] * trace.width + trace.points[index * 2]]) linePainted[part] += 1;
  }
  const lineAll = lineTotals.reduce((sum, size) => sum + size, 0);
  const line = lineAll > 0 ? linePainted.reduce((sum, size) => sum + size, 0) / lineAll : 0;
  const parts = trace.partTotals.map(
    (size, part) => size > 0 && coverage.partCounts[part] / size >= SUCCESS && linePainted[part] / lineTotals[part] >= LINE_SUCCESS,
  );
  const done = total > 0 && parts.every(Boolean);
  let biggest = 0;
  trace.partTotals.forEach((size, part) => {
    if (size > trace.partTotals[biggest]) biggest = part;
  });
  return { fraction, line, parts, done, missingPart: !done && parts.length > 1 && parts[biggest] };
}

/**
 * Where and how big to draw a glyph so it fits a square board, from the
 * glyph's measured box at a font size of 100 (a canvas's `measureText`).
 *
 * @param {{ left: number, right: number, ascent: number, descent: number }} box  at size 100
 * @param {number} side  the board's side
 * @param {number} grow  the path's extra outline, a share of the font size
 * @param {number} [fill]  the share of the side the glyph may take
 * @returns {{ size: number, x: number, y: number }}  font size and the text origin (left, baseline)
 */
export function fitGlyph(box, side, grow, fill = 0.78) {
  const width = Math.max(1, box.left + box.right) / 100 + grow;
  const height = Math.max(1, box.ascent + box.descent) / 100 + grow;
  const size = (fill * side) / Math.max(width, height);
  const scale = size / 100;
  return {
    size,
    x: side / 2 - ((box.right - box.left) * scale) / 2,
    y: side / 2 + ((box.ascent - box.descent) * scale) / 2,
  };
}
