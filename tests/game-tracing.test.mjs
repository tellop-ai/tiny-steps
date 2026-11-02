import assert from 'node:assert/strict';
import { test } from 'node:test';

const {
  MIN_PART,
  PATHS,
  INK_WIDTH,
  LINE_SUCCESS,
  SUCCESS,
  depth,
  dropSpecks,
  fitGlyph,
  gridFromRows,
  inside,
  labelParts,
  makeGrid,
  maskFromAlpha,
  measure,
  prepare,
  stamp,
  startCoverage,
  stroke,
  thin,
  widen,
} = await import('../lib/games/tracing.js');

/** A grid with a filled box from (x0, y0) to (x1, y1), both included. */
function box(grid, x0, y0, x1, y1) {
  for (let y = y0; y <= y1; y += 1) for (let x = x0; x <= x1; x += 1) grid.cells[y * grid.width + x] = 1;
  return grid;
}

/** A filled disc. */
function disc(grid, cx, cy, r) {
  for (let y = 0; y < grid.height; y += 1) {
    for (let x = 0; x < grid.width; x += 1) if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) grid.cells[y * grid.width + x] = 1;
  }
  return grid;
}

/** A ring between two radii. */
function ring(grid, cx, cy, inner, outer) {
  for (let y = 0; y < grid.height; y += 1) {
    for (let x = 0; x < grid.width; x += 1) {
      const d = (x - cx) ** 2 + (y - cy) ** 2;
      if (d <= outer * outer && d >= inner * inner) grid.cells[y * grid.width + x] = 1;
    }
  }
  return grid;
}

const on = (grid, x, y) => grid.cells[y * grid.width + x] === 1;

function cellsOf(grid) {
  const list = [];
  for (let y = 0; y < grid.height; y += 1) for (let x = 0; x < grid.width; x += 1) if (on(grid, x, y)) list.push([x, y]);
  return list;
}

/** No 2 × 2 block of on cells: the line is one cell wide. */
function oneWide(grid) {
  for (let y = 0; y + 1 < grid.height; y += 1) {
    for (let x = 0; x + 1 < grid.width; x += 1) {
      if (on(grid, x, y) && on(grid, x + 1, y) && on(grid, x, y + 1) && on(grid, x + 1, y + 1)) return false;
    }
  }
  return true;
}

/** Paints these mask cells by hand. */
function paintCells(trace, coverage, cells) {
  for (const cell of cells) {
    if (coverage.painted[cell]) continue;
    coverage.painted[cell] = 1;
    coverage.count += 1;
    coverage.partCounts[trace.cellPart[cell] - 1] += 1;
  }
}

test('a grid needs a whole size of at least one cell', () => {
  assert.equal(makeGrid(1, 1).cells.length, 1);
  assert.throws(() => makeGrid(0, 5), RangeError);
  assert.throws(() => makeGrid(5, 0), RangeError);
  assert.throws(() => makeGrid(2.5, 5), RangeError);
});

test('the mask takes a cell whose cover is at the cut, and not one just under it', () => {
  // Three cells: alpha 127, 128, 129 with the cut at 128.
  const rgba = [0, 0, 0, 127, 0, 0, 0, 128, 0, 0, 0, 129];
  const mask = maskFromAlpha(rgba, 3, 1, 128);
  assert.deepEqual([...mask.cells], [0, 1, 1]);
});

test('a bar thins to one line along its middle', () => {
  const mask = box(makeGrid(50, 15), 5, 4, 44, 10); // 7 rows thick, middle row 7
  const line = thin(mask);
  const cells = cellsOf(line);
  assert.ok(cells.length >= 30, `only ${cells.length} cells`);
  assert.ok(oneWide(line));
  for (const [x, y] of cells) {
    assert.ok(on(mask, x, y), 'the line stays inside the mask');
    assert.ok(Math.abs(y - 7) <= 1, `cell ${x},${y} is off the middle`);
  }
  assert.equal(labelParts(line).sizes.length, 1, 'the line is one piece');
});

test('an L keeps both arms and its corner, joined', () => {
  const mask = makeGrid(40, 40);
  box(mask, 5, 5, 11, 34); // the upright, middle column 8
  box(mask, 5, 28, 34, 34); // the foot, middle row 31
  const line = thin(mask);
  const cells = cellsOf(line);
  assert.ok(oneWide(line));
  assert.equal(labelParts(line).sizes.length, 1, 'the arms stay joined');
  assert.ok(cells.some(([x, y]) => y < 15 && Math.abs(x - 8) <= 1), 'the upright reaches up');
  assert.ok(cells.some(([x, y]) => x > 25 && Math.abs(y - 31) <= 1), 'the foot reaches right');
  assert.ok(cells.some(([x, y]) => x <= 11 && y >= 28), 'the corner is on the line');
});

test('a ring thins to a closed loop round its hole', () => {
  const mask = ring(makeGrid(41, 41), 20, 20, 9, 15);
  const line = thin(mask);
  assert.ok(oneWide(line));
  assert.equal(labelParts(line).sizes.length, 1);
  // Flood the off cells from a corner: the hole's middle must stay unreached.
  const reached = new Uint8Array(41 * 41);
  const queue = [0];
  reached[0] = 1;
  while (queue.length > 0) {
    const cell = queue.pop();
    const x = cell % 41;
    const y = Math.floor(cell / 41);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= 41 || ny >= 41) continue;
      const next = ny * 41 + nx;
      if (!reached[next] && !line.cells[next]) {
        reached[next] = 1;
        queue.push(next);
      }
    }
  }
  assert.equal(reached[20 * 41 + 20], 0, 'the loop is closed');
});

test('two separate parts are found apart, and a speck is dropped', () => {
  const mask = makeGrid(30, 60);
  box(mask, 10, 20, 17, 55); // the stem: 8 × 36 = 288 cells
  disc(mask, 13, 8, 4); // the dot
  const { sizes } = labelParts(mask);
  assert.equal(sizes.length, 2);

  // A speck just under the share is dropped; one just over it stays.
  const total = 1000;
  const grid = makeGrid(100, 20);
  box(grid, 0, 0, 99, 9); // 1000 cells
  const speckSize = Math.ceil(MIN_PART * (total + 4)); // a part of this size is at least the share
  box(grid, 0, 15, speckSize - 1, 15);
  const kept = dropSpecks(grid);
  assert.equal(labelParts(kept).sizes.length, 2, 'a part just over the share stays');
  const tiny = makeGrid(100, 20);
  box(tiny, 0, 0, 99, 9);
  box(tiny, 0, 15, speckSize - 2, 15); // one cell smaller: under the share
  assert.equal(labelParts(dropSpecks(tiny)).sizes.length, 1, 'a speck under the share goes');
});

test('widening reaches exactly its radius and no further', () => {
  const mask = makeGrid(21, 21);
  mask.cells[10 * 21 + 10] = 1;
  const wide = widen(mask, 4);
  assert.ok(on(wide, 14, 10), 'exactly 4 cells away is in');
  assert.ok(!on(wide, 15, 10), '5 cells away is out');
  assert.ok(on(wide, 10, 6));
  assert.ok(!on(wide, 10, 5));
  assert.ok(on(wide, 12, 13), 'a diagonal at distance √13 < 4 is in');
  assert.ok(!on(wide, 13, 13), 'a diagonal at distance √18 > 4 is out');
  assert.deepEqual([...widen(mask, 0).cells], [...mask.cells], 'no tolerance widens nothing');
});

test('depth counts the cells to the nearest edge, and the stroke width follows it', () => {
  const mask = box(makeGrid(60, 30), 10, 10, 49, 18); // 9 rows thick
  const cells = depth(mask);
  assert.equal(cells[14 * 60 + 30], 5, 'the middle row is 5 steps from the off rows');
  assert.equal(cells[10 * 60 + 30], 1, 'an edge row is 1 step');
  assert.equal(cells[9 * 60 + 30], 0, 'off the mask is 0');
  const trace = prepare(mask, { tolerance: 2 });
  assert.ok(trace.strokeWidth >= 9 && trace.strokeWidth <= 11, `width ${trace.strokeWidth}`);
  assert.ok(Math.abs(trace.pen - (trace.strokeWidth * INK_WIDTH) / 2) < 1e-9, 'the ink is a little wider than the path');
});

test('the allowed area is the mask widened by the tolerance', () => {
  const mask = box(makeGrid(60, 30), 10, 10, 49, 19);
  const trace = prepare(mask, { tolerance: 3 });
  assert.equal(inside(trace, 30, 7), true, '3 above the top edge is in');
  assert.equal(inside(trace, 30, 6), false, '4 above is out');
  assert.equal(inside(trace, 52.9, 15), true, 'a fraction of a cell inside the edge is in');
  assert.equal(inside(trace, 53, 15), false);
  assert.equal(inside(trace, -1, 15), false, 'off the grid is out');
  assert.equal(inside(trace, Number.NaN, 15), false);
});

test('a bar traced end to end along its middle is done; a stroke off it has left', () => {
  const mask = box(makeGrid(80, 30), 10, 10, 69, 19);
  const trace = prepare(mask, { tolerance: 3 });
  assert.equal(trace.partTotals.length, 1);
  assert.ok(trace.pen >= trace.strokeWidth / 2, 'the ink is at least as wide as the path');

  const coverage = startCoverage(trace);
  stamp(trace, coverage, 10, 15);
  const along = stroke(trace, coverage, { x: 10, y: 15 }, { x: 69, y: 15 });
  assert.equal(along.left, false);
  const result = measure(trace, coverage);
  assert.equal(result.done, true);
  assert.equal(result.fraction, 1);

  const off = stroke(trace, startCoverage(trace), { x: 30, y: 15 }, { x: 30, y: 2 });
  assert.equal(off.left, true, 'going above the path leaves it');
  const edge = stroke(trace, startCoverage(trace), { x: 30, y: 15 }, { x: 30, y: 7 });
  assert.equal(edge.left, false, 'stopping on the allowed edge has not left');
});

test('a stroke along one edge paints only part of the path and is not done; the other edge finishes it', () => {
  // A child's report: ink over about three quarters of a letter finished it, because the centre line was all covered.
  const mask = box(makeGrid(80, 30), 10, 10, 69, 19);
  const trace = prepare(mask, { tolerance: 3 });
  const coverage = startCoverage(trace);
  stamp(trace, coverage, 10, 11);
  assert.equal(stroke(trace, coverage, { x: 10, y: 11 }, { x: 69, y: 11 }).left, false);
  const oneEdge = measure(trace, coverage);
  assert.equal(oneEdge.line, 1, 'the centre line is under the ink');
  assert.ok(oneEdge.fraction > 0.6 && oneEdge.fraction < SUCCESS, `one edge paints ${oneEdge.fraction}`);
  assert.equal(oneEdge.done, false);
  stroke(trace, coverage, { x: 10, y: 18 }, { x: 69, y: 18 });
  assert.equal(measure(trace, coverage).done, true);
});

test('a short stroke (a tail) must be painted even when the area is far enough', () => {
  const mask = makeGrid(120, 40);
  box(mask, 10, 20, 109, 29); // the long bar
  box(mask, 58, 4, 61, 19); // a thin stub on top, joined to it
  const trace = prepare(mask, { tolerance: 3 });
  assert.equal(trace.partTotals.length, 1, 'bar and stub are one part');
  const coverage = startCoverage(trace);
  stamp(trace, coverage, 10, 25);
  stroke(trace, coverage, { x: 10, y: 25 }, { x: 109, y: 25 });
  const barOnly = measure(trace, coverage);
  assert.ok(barOnly.fraction >= SUCCESS, `the bar alone paints ${barOnly.fraction} of the area`);
  assert.ok(barOnly.line < LINE_SUCCESS, `the bar alone paints ${barOnly.line} of the line`);
  assert.equal(barOnly.done, false);
  assert.equal(barOnly.missingPart, false, 'one part: nothing to point at apart');
  stroke(trace, coverage, { x: 60, y: 22 }, { x: 60, y: 4 });
  assert.equal(measure(trace, coverage).done, true);
});

test('a pen point outside the allowed area covers nothing', () => {
  const mask = box(makeGrid(80, 30), 10, 10, 69, 19);
  const trace = prepare(mask, { tolerance: 3, pen: 40 });
  const coverage = startCoverage(trace);
  assert.equal(stamp(trace, coverage, 40, 1), 0);
  assert.equal(coverage.count, 0);
});

test('the area threshold: exactly the success share is done, one cell under is not', () => {
  const mask = box(makeGrid(80, 30), 10, 10, 69, 19);
  const trace = prepare(mask, { tolerance: 3 });
  const total = trace.partTotals[0];
  const needed = Math.ceil(SUCCESS * total);
  // The centre line's cells first, so only the area decides.
  const line = [...Array(trace.points.length / 2).keys()].map((index) => trace.points[index * 2 + 1] * trace.width + trace.points[index * 2]);
  const rest = [...trace.cellPart.keys()].filter((cell) => trace.cellPart[cell] > 0 && !line.includes(cell));
  const order = [...line, ...rest];

  const under = startCoverage(trace);
  paintCells(trace, under, order.slice(0, needed - 1));
  assert.equal(measure(trace, under).line, 1);
  assert.equal(measure(trace, under).done, false, `${needed - 1} of ${total}`);

  const exact = startCoverage(trace);
  paintCells(trace, exact, order.slice(0, needed));
  assert.equal(measure(trace, exact).done, true, `${needed} of ${total}`);
});

test('the line threshold: one centre point too few is not done, with all the rest painted', () => {
  const mask = box(makeGrid(80, 30), 10, 10, 69, 19);
  const trace = prepare(mask, { tolerance: 3 });
  const points = trace.points.length / 2;
  const allowedOff = Math.floor(points * (1 - LINE_SUCCESS));
  const lineCell = (index) => trace.points[index * 2 + 1] * trace.width + trace.points[index * 2];
  const skipped = new Set([...Array(allowedOff + 1).keys()].map(lineCell));
  const cells = [...trace.cellPart.keys()].filter((cell) => trace.cellPart[cell] > 0);

  const short = startCoverage(trace);
  paintCells(trace, short, cells.filter((cell) => !skipped.has(cell)));
  assert.ok(measure(trace, short).fraction >= SUCCESS);
  assert.equal(measure(trace, short).done, false, `${allowedOff + 1} of ${points} centre points unpainted`);

  const enough = startCoverage(trace);
  paintCells(trace, enough, cells.filter((cell) => cell === lineCell(0) || !skipped.has(cell)));
  assert.equal(measure(trace, enough).done, true, `${allowedOff} of ${points} unpainted`);
});

test('a dotted i is not done until its dot is covered too', () => {
  const mask = makeGrid(30, 70);
  box(mask, 10, 20, 17, 65); // the stem
  disc(mask, 13, 8, 4); // the dot
  const trace = prepare(mask, { tolerance: 2 });
  assert.equal(trace.partTotals.length, 2, 'stem and dot are two parts');

  const coverage = startCoverage(trace);
  stamp(trace, coverage, 13, 20);
  stroke(trace, coverage, { x: 13, y: 20 }, { x: 13, y: 65 });
  const stemOnly = measure(trace, coverage);
  assert.equal(stemOnly.parts.filter(Boolean).length, 1, 'the stem alone is done');
  assert.equal(stemOnly.done, false, 'the dot is still missing');
  assert.equal(stemOnly.missingPart, true);

  stamp(trace, coverage, 13, 8); // one press on the dot
  const both = measure(trace, coverage);
  assert.equal(both.done, true);
  assert.equal(both.missingPart, false);
});

test('a part that thins away entirely keeps one point to cover', () => {
  const mask = makeGrid(40, 40);
  box(mask, 5, 5, 34, 12); // a bar
  box(mask, 18, 30, 19, 31); // a 2 × 2 block thins to nothing
  assert.equal(cellsOf(thin(box(makeGrid(6, 6), 2, 2, 3, 3))).length, 0, 'a 2 × 2 block alone thins away');
  const trace = prepare(mask, { tolerance: 2 });
  assert.equal(trace.partTotals.length, 2);
  assert.equal([...trace.pointPart].filter((part) => part === 1).length, 1, 'the block keeps one point');
  const coverage = startCoverage(trace);
  stamp(trace, coverage, 5, 8);
  stroke(trace, coverage, { x: 5, y: 8 }, { x: 34, y: 8 });
  assert.equal(measure(trace, coverage).missingPart, true);
  stamp(trace, coverage, 18.5, 30.5);
  assert.equal(measure(trace, coverage).done, true);
});

test('an empty drawing can never be done', () => {
  const trace = prepare(makeGrid(10, 10), { tolerance: 2 });
  assert.equal(trace.points.length, 0);
  const result = measure(trace, startCoverage(trace));
  assert.equal(result.done, false);
  assert.equal(result.fraction, 0);
});

test('a ring traced half way round is not done; all the way round it is', () => {
  const mask = ring(makeGrid(61, 61), 30, 30, 14, 22);
  const trace = prepare(mask, { tolerance: 3 });
  const coverage = startCoverage(trace);
  // Walk the middle radius (18) round in small steps.
  const at = (angle) => ({ x: 30 + 18 * Math.cos(angle), y: 30 + 18 * Math.sin(angle) });
  let last = at(0);
  stamp(trace, coverage, last.x, last.y);
  for (let step = 1; step <= 36; step += 1) {
    const next = at((step / 72) * 2 * Math.PI);
    assert.equal(stroke(trace, coverage, last, next).left, false);
    last = next;
  }
  const half = measure(trace, coverage);
  assert.equal(half.done, false);
  assert.ok(half.fraction > 0.4 && half.fraction < 0.65, `half way is ${half.fraction}`);
  for (let step = 37; step <= 72; step += 1) {
    const next = at((step / 72) * 2 * Math.PI);
    stroke(trace, coverage, last, next);
    last = next;
  }
  assert.equal(measure(trace, coverage).done, true);
});

test('a jump across a ring hole leaves the path', () => {
  const mask = ring(makeGrid(61, 61), 30, 30, 14, 22);
  const trace = prepare(mask, { tolerance: 2 });
  assert.equal(stroke(trace, startCoverage(trace), { x: 12, y: 30 }, { x: 48, y: 30 }).left, true);
});

test('the paths narrow from Easy to Hard', () => {
  assert.ok(PATHS.wide.grow > PATHS.middle.grow && PATHS.middle.grow > PATHS.narrow.grow);
  assert.ok(PATHS.wide.tolerance > PATHS.middle.tolerance && PATHS.middle.tolerance > PATHS.narrow.tolerance);
  assert.equal(PATHS.narrow.grow, 0);
});

test('a glyph fits the board at the fill share, centred', () => {
  const side = 400;
  const fill = 0.78;
  for (const glyph of [
    { left: 2, right: 58, ascent: 72, descent: 0 }, // tall and narrow, like "1"
    { left: 0, right: 110, ascent: 70, descent: 1 }, // wide, like "20"
    { left: -5, right: 50, ascent: 52, descent: 20 }, // a small letter with a tail, like "g"
  ]) {
    for (const grow of [0, PATHS.wide.grow]) {
      const { size, x, y } = fitGlyph(glyph, side, grow, fill);
      const scale = size / 100;
      const outline = (grow * size) / 2;
      const left = x - glyph.left * scale - outline;
      const right = x + glyph.right * scale + outline;
      const top = y - glyph.ascent * scale - outline;
      const bottom = y + glyph.descent * scale + outline;
      const widest = Math.max(right - left, bottom - top);
      assert.ok(Math.abs(widest - fill * side) < 1e-6, `the longer side fills ${fill}`);
      assert.ok(Math.abs((left + right) / 2 - side / 2) < 1e-6, 'centred across');
      assert.ok(Math.abs((top + bottom) / 2 - side / 2) < 1e-6, 'centred down');
    }
  }
});
