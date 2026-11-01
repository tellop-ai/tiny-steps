/**
 * Animal count's rules: one kind of animal walks into a
 * meadow one by one and settles; the child counts them and picks the number.
 * Pure: rounds, answers, the walking-in timetable and the meadow layout.
 */

import { below, pickOther, range, sample } from '../play/random.js';

/**
 * The animals, by id. Their words are `games.animal-count.one.<id>` (one
 * animal) and `games.animal-count.many.<id>` (several) in each language. All
 * emoji are from Unicode 13 or earlier.
 */
export const ANIMALS = Object.freeze({
  dog: '🐶',
  cat: '🐱',
  rabbit: '🐰',
  frog: '🐸',
  chick: '🐥',
  pig: '🐷',
  cow: '🐮',
  monkey: '🐵',
  panda: '🐼',
  duck: '🦆',
  turtle: '🐢',
  fox: '🦊',
});

/** Every animal id. */
export const ANIMAL_IDS = Object.freeze(Object.keys(ANIMALS));

/** The most animals in a round and how many answers to pick from, by level. */
export const LEVELS = Object.freeze({
  easy: Object.freeze({ most: 5, answers: 3 }),
  normal: Object.freeze({ most: 10, answers: 4 }),
  hard: Object.freeze({ most: 20, answers: 4 }),
});

/** How far a wrong answer may be from the right one. */
export const ANSWER_SPREAD = 3;

/** The longest the whole walk-in may take, in milliseconds. */
export const MAX_ENTRY_MS = 3800;

/** How long one animal takes to walk to its spot, in milliseconds. */
export const WALK_MS = 900;

/** The longest wait between two animals setting off, in milliseconds. */
export const MAX_GAP_MS = 450;

/** The biggest an animal is drawn, in CSS pixels, however roomy the meadow. */
export const MAX_SIZE = 104;

/** The roomiest even grid's cell is this many animal sizes across, which leaves room to scatter. */
export const CELL_ROOM = 1.45;

/** Two resting animals' centres are at least this many animal sizes apart. */
export const SPACING = 1.08;

/** The most animals the layout takes (well above any level). */
export const MAX_ANIMALS = 60;

/**
 * @param {string} level
 */
export function rulesFor(level) {
  return LEVELS[level] ?? LEVELS.normal;
}

/**
 * The answers to pick from: `size` distinct whole numbers of at least 1, each
 * within `ANSWER_SPREAD` of `count`, the right one among them, rising.
 *
 * @param {number} count
 * @param {number} size
 * @param {() => number} [random]
 * @returns {number[]}
 */
export function makeAnswers(count, size, random = Math.random) {
  if (!Number.isSafeInteger(count) || count < 1) throw new RangeError('count must be a whole number of at least 1');
  const near = range(Math.max(1, count - ANSWER_SPREAD), count + ANSWER_SPREAD).filter((n) => n !== count);
  const others = sample(near, Math.max(0, size - 1), random);
  return [count, ...others].sort((a, b) => a - b);
}

/**
 * @typedef {{ animal: string, count: number, answers: number[] }} Round
 */

/**
 * One round: an animal kind other than the last one, how many of them come
 * (1 to the level's most), and the answers.
 *
 * @param {string} level
 * @param {string | null} lastAnimal
 * @param {() => number} [random]
 * @returns {Round}
 */
export function makeRound(level, lastAnimal, random = Math.random) {
  const rules = rulesFor(level);
  const animal = pickOther(ANIMAL_IDS, lastAnimal, random);
  const count = 1 + below(rules.most, random);
  return { animal, count, answers: makeAnswers(count, rules.answers, random) };
}

/**
 * When each animal sets off and how long the walk-in takes in all: the
 * animals leave one after another, at most `MAX_GAP_MS` apart, and the last one
 * settles within `MAX_ENTRY_MS`.
 *
 * @param {number} count
 * @returns {{ delays: number[], walkMs: number, totalMs: number }}
 */
export function entryPlan(count) {
  if (!Number.isSafeInteger(count) || count < 0) throw new RangeError('count must be a whole number');
  const gap = count > 1 ? Math.min(MAX_GAP_MS, (MAX_ENTRY_MS - WALK_MS) / (count - 1)) : 0;
  const delays = Array.from({ length: count }, (_, at) => Math.round(at * gap));
  const totalMs = count === 0 ? 0 : delays[count - 1] + WALK_MS;
  return { delays, walkMs: WALK_MS, totalMs };
}

/**
 * @typedef {{ x: number, y: number, from: 'left' | 'right' }} Spot
 * @typedef {{ size: number, spacing: number, spots: Spot[] }} Meadow
 */

/**
 * Where `count` animals rest in a meadow of `box` (CSS pixels): their drawn
 * size, and each one's centre. Every animal is wholly inside the box and no two
 * centres are closer than `spacing` (at least the size), so none covers
 * another. Each walks in from the nearer side.
 *
 * The animals' size comes from the even grid with the roomiest cell for this
 * count. The meadow is then cut into as many cells as fit at that spacing
 * (never fewer than the even grid has), so there are more cells than animals;
 * the animals take random cells and sit at a random place inside each, held
 * back from the cell's edge just enough to keep the spacing from their
 * neighbours. Spare cells are what make the meadow look scattered, not ruled.
 *
 * @param {number} count
 * @param {{ width: number, height: number }} box
 * @param {() => number} [random]
 * @returns {Meadow}
 */
export function meadowSpots(count, box, random = Math.random) {
  if (!Number.isSafeInteger(count) || count < 0 || count > MAX_ANIMALS) {
    throw new RangeError(`count must be a whole number from 0 to ${MAX_ANIMALS}`);
  }
  const width = Number(box?.width);
  const height = Number(box?.height);
  if (!(Number.isFinite(width) && width > 0 && Number.isFinite(height) && height > 0)) {
    throw new RangeError('the meadow needs a width and a height above 0');
  }
  if (count === 0) return { size: 0, spacing: 0, spots: [] };

  let best = { columns: 1, rows: count, cell: 0 };
  for (let columns = 1; columns <= count; columns += 1) {
    const rows = Math.ceil(count / columns);
    const cell = Math.min(width / columns, height / rows);
    if (cell > best.cell) best = { columns, rows, cell };
  }
  const size = Math.min(MAX_SIZE, best.cell / CELL_ROOM);
  const spacing = size * SPACING;
  // Spacing is below the even grid's cell, so the finer grid never has fewer cells than it.
  const columns = Math.max(best.columns, Math.floor(width / spacing));
  const rows = Math.max(best.rows, Math.floor(height / spacing));
  const cellWidth = width / columns;
  const cellHeight = height / rows;
  const roamX = Math.max(0, (cellWidth - spacing) / 2);
  const roamY = Math.max(0, (cellHeight - spacing) / 2);
  const cells = sample(range(0, columns * rows - 1), count, random);
  const spots = cells.map((cell) => {
    const column = cell % columns;
    const row = Math.floor(cell / columns);
    const x = (column + 0.5) * cellWidth + (random() * 2 - 1) * roamX;
    const y = (row + 0.5) * cellHeight + (random() * 2 - 1) * roamY;
    return { x, y, from: /** @type {'left' | 'right'} */ (x < width / 2 ? 'left' : 'right') };
  });
  return { size, spacing, spots };
}

/**
 * The same meadow fitted to a box that changed size (the window was resized):
 * every spot keeps its place relative to the box, and the animals shrink with
 * the narrower of the two stretches (never above `MAX_SIZE`), so they stay
 * inside and apart without jumping to new places.
 *
 * @param {Meadow} meadow
 * @param {{ width: number, height: number }} from
 * @param {{ width: number, height: number }} to
 * @returns {Meadow}
 */
export function scaleMeadow(meadow, from, to) {
  for (const box of [from, to]) {
    if (!(Number.isFinite(box?.width) && box.width > 0 && Number.isFinite(box?.height) && box.height > 0)) {
      throw new RangeError('the meadow needs a width and a height above 0');
    }
  }
  const across = to.width / from.width;
  const down = to.height / from.height;
  const shrink = Math.min(across, down);
  return {
    size: Math.min(MAX_SIZE, meadow.size * shrink),
    spacing: meadow.spacing * shrink,
    spots: meadow.spots.map((spot) => ({ x: spot.x * across, y: spot.y * down, from: spot.from })),
  };
}
