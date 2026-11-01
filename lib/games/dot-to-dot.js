/**
 * Dot to dot's rules: the child taps
 * numbered dots in order on a square board (0..100 both ways); a line joins
 * each dot to the last, and the last dot closes the picture. Our own
 * pictures, each a closed outline of points. Pure.
 */

import { pickOther } from '../play/random.js';

/** The board's size in board units, both ways. */
export const BOARD = 100;
/** How far every dot stays from the board's edge, so its tap area stays on the board. */
export const MARGIN = 8;
/** The least distance between two dots of one picture, so tap areas never overlap. */
export const MIN_GAP = 11;
/** The largest tap area radius; never more than MARGIN, so it stays on the board. */
export const MAX_HIT = 8;

/** How many dots a picture has at each level, both ends included, and whether the next dot glows. */
export const LEVELS = Object.freeze({
  easy: Object.freeze({ min: 5, max: 8, glow: true }),
  normal: Object.freeze({ min: 9, max: 12, glow: false }),
  hard: Object.freeze({ min: 13, max: 20, glow: false }),
});

const p = (...pairs) => Object.freeze(pairs.map((pair) => Object.freeze(pair)));
const picture = (id, points) => Object.freeze({ id, points });

/** A star's points: outer and inner corners in turn, from the top, clockwise. */
function starPoints(cx, cy, outer, inner, corners) {
  const points = [];
  for (let k = 0; k < corners * 2; k += 1) {
    const angle = -Math.PI / 2 + (k * Math.PI) / corners;
    const r = k % 2 === 0 ? outer : inner;
    points.push([Math.round((cx + r * Math.cos(angle)) * 10) / 10, Math.round((cy + r * Math.sin(angle)) * 10) / 10]);
  }
  return p(...points);
}

/** A flower head: each petal two points out, with a dip between petals, from the top, clockwise. */
function flowerPoints(cx, cy, outer, inner, petals, spread) {
  const points = [];
  const round = (n) => Math.round(n * 10) / 10;
  for (let k = 0; k < petals; k += 1) {
    const middle = -Math.PI / 2 + (k * 2 * Math.PI) / petals;
    for (const side of [-spread, spread]) points.push([round(cx + outer * Math.cos(middle + side)), round(cy + outer * Math.sin(middle + side))]);
    const dip = middle + Math.PI / petals;
    points.push([round(cx + inner * Math.cos(dip)), round(cy + inner * Math.sin(dip))]);
  }
  return p(...points);
}

/**
 * Every picture, in the order a child joins its dots. Words: `games.dot-to-dot.pic.<id>`.
 * The level a picture plays at follows from its number of dots (`levelOfCount`).
 */
export const PICTURES = Object.freeze([
  // Easy: 5 to 8 dots.
  picture('house', p([24, 86], [76, 86], [76, 50], [50, 20], [24, 50])),
  picture('gem', p([34, 22], [66, 22], [88, 42], [50, 88], [12, 42])),
  picture('fish', p([12, 50], [36, 28], [62, 36], [86, 18], [86, 82], [62, 64], [36, 72])),
  picture('boat', p([50, 12], [76, 52], [88, 60], [74, 82], [26, 82], [12, 60], [50, 60])),
  picture('tree', p([50, 10], [82, 64], [60, 64], [60, 88], [40, 88], [40, 64], [18, 64])),
  picture('crown', p([14, 82], [86, 82], [88, 28], [68, 52], [50, 20], [32, 52], [12, 28])),
  picture('heart', p([50, 32], [64, 16], [82, 20], [90, 40], [50, 88], [10, 40], [18, 20], [36, 16])),
  // Normal: 9 to 12 dots.
  picture('moon', p([70, 15], [40, 11], [16, 29], [16, 71], [40, 89], [70, 85], [54, 70], [46, 50], [54, 30])),
  picture('star', starPoints(50, 54, 42, 18, 5)),
  picture('rocket', p([50, 8], [63, 27], [63, 58], [80, 82], [62, 76], [50, 90], [38, 76], [20, 82], [37, 58], [37, 27])),
  picture('cat', p([20, 14], [38, 32], [62, 32], [80, 14], [84, 46], [78, 70], [62, 86], [38, 86], [22, 70], [16, 46])),
  picture('apple', p([50, 30], [52, 12], [70, 18], [88, 36], [88, 62], [72, 84], [50, 80], [28, 84], [12, 62], [12, 36], [30, 18])),
  picture('bell', p([50, 10], [64, 18], [70, 36], [72, 58], [88, 76], [58, 76], [50, 90], [42, 76], [12, 76], [28, 58], [30, 36], [36, 18])),
  picture('car', p([10, 70], [10, 52], [26, 48], [36, 30], [64, 30], [76, 48], [90, 54], [90, 70], [80, 82], [68, 70], [32, 70], [20, 82])),
  // Hard: 13 to 20 dots.
  picture('pine', p([50, 8], [72, 32], [59, 32], [82, 56], [66, 56], [90, 78], [58, 78], [58, 92], [42, 92], [42, 78], [10, 78], [34, 56], [18, 56], [41, 32], [28, 32])),
  picture('sun', starPoints(50, 50, 41, 26, 8)),
  picture('umbrella', p([50, 10], [70, 15], [85, 30], [90, 50], [74, 44], [56, 50], [56, 80], [46, 92], [32, 88], [26, 76], [38, 78], [44, 50], [26, 44], [10, 50], [15, 30], [30, 15])),
  picture('castle', p([14, 88], [40, 88], [40, 70], [50, 60], [60, 70], [60, 88], [86, 88], [86, 22], [71.6, 22], [71.6, 36], [57.2, 36], [57.2, 22], [42.8, 22], [42.8, 36], [28.4, 36], [28.4, 22], [14, 22])),
  picture('flower', flowerPoints(50, 50, 40, 20, 6, (12 * Math.PI) / 180)),
  picture('butterfly', p([50, 34], [62, 20], [80, 12], [90, 26], [84, 46], [66, 52], [82, 66], [78, 84], [62, 86], [50, 70], [38, 86], [22, 84], [18, 66], [34, 52], [16, 46], [10, 26], [20, 12], [38, 20])),
]);

/**
 * The level a picture of `count` dots plays at, or null when no level takes it.
 *
 * @param {number} count
 * @returns {'easy' | 'normal' | 'hard' | null}
 */
export function levelOfCount(count) {
  for (const [level, rules] of Object.entries(LEVELS)) if (count >= rules.min && count <= rules.max) return /** @type {any} */ (level);
  return null;
}

/** The pictures a level plays (an unknown level plays as normal). */
export function picturesFor(level) {
  const known = Object.hasOwn(LEVELS, level) ? level : 'normal';
  return PICTURES.filter((each) => levelOfCount(each.points.length) === known);
}

/**
 * The next picture: one of the level's, never the last one again.
 *
 * @param {string} level
 * @param {string | null} lastId
 * @param {() => number} [random]
 */
export function nextPicture(level, lastId, random = Math.random) {
  const choices = picturesFor(level);
  const last = choices.find((each) => each.id === lastId);
  return pickOther(choices, last, random);
}

/** Whether the next dot glows at this level. */
export function glows(level) {
  return (LEVELS[level] ?? LEVELS.normal).glow;
}

/**
 * What a tap on dot `index` (from 0) means when `joined` dots are already joined:
 * `right` (it is the next one), `done` (already joined: nothing happens) or `miss`.
 *
 * @param {number} joined
 * @param {number} index
 * @param {number} count
 * @returns {'right' | 'done' | 'miss'}
 */
export function tapResult(joined, index, count) {
  if (!Number.isInteger(index) || index < 0 || index >= count) return 'done';
  if (index === joined) return 'right';
  return index < joined ? 'done' : 'miss';
}

/** Whether every dot is joined. */
export function isComplete(joined, count) {
  return joined >= count;
}

/** The least distance between any two of a picture's dots. */
export function nearestGap(points) {
  let least = Infinity;
  for (let a = 0; a < points.length; a += 1) {
    for (let b = a + 1; b < points.length; b += 1) {
      least = Math.min(least, Math.hypot(points[a][0] - points[b][0], points[a][1] - points[b][1]));
    }
  }
  return least;
}

/**
 * How big a picture's dots and their tap areas are, in board units: tap areas as
 * big as they can be without touching (at most MAX_HIT), dots a little smaller.
 *
 * @param {readonly (readonly number[])[]} points
 */
export function dotSizes(points) {
  const gap = nearestGap(points);
  const hit = Math.min(MAX_HIT, gap / 2);
  const dot = Math.min(5.6, Math.max(3.6, gap * 0.3));
  return { dot: Math.round(dot * 10) / 10, hit: Math.floor(hit * 100) / 100 };
}

/** The line colour (mark 1 to 5) of the line that ends at dot `index`. */
export function markOf(index) {
  return (index % 5) + 1;
}
