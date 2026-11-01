/**
 * Number hunt's rules: a board of number
 * tiles 1 to N in a random layout; the game asks for one number at a time.
 * Easy asks 1, 2, 3 … in order, then again from 1 on a new layout; Normal asks
 * at random, never the same number twice in a row; Hard asks at random and the
 * tiles change places after each find. Pure.
 */

import { pickOther, range, shuffle } from '../play/random.js';

/** The tiles on the board and the order of the asks, by level. */
export const LEVELS = Object.freeze({
  easy: Object.freeze({ count: 5, order: 'in-order', moveAfterFind: false }),
  normal: Object.freeze({ count: 10, order: 'random', moveAfterFind: false }),
  hard: Object.freeze({ count: 20, order: 'random', moveAfterFind: true }),
});

/** How long an ask waits for its right tile before that tile glows softly, in milliseconds. */
export const HINT_MS = 8000;

/** How long a found tile shows before the next ask, in milliseconds. */
export const NEXT_ASK_MS = 600;

/**
 * @typedef {{ layout: number[], wanted: number }} Hunt
 *   `layout`: the numbers in board order (each of 1 to N once); `wanted`: the number asked for.
 */

/** @param {string} level */
export function rulesFor(level) {
  return LEVELS[level] ?? LEVELS.normal;
}

/**
 * The numbers 1 to `count` in a random board order, never the same order as
 * `previous` when another order exists.
 *
 * @param {number} count
 * @param {readonly number[] | null} previous
 * @param {() => number} [random]
 * @returns {number[]}
 */
export function newLayout(count, previous, random = Math.random) {
  const layout = shuffle(range(1, count), random);
  if (count > 1 && previous && previous.length === count && layout.every((n, at) => n === previous[at])) {
    // The shuffle gave the same order back: turn it by one place, which always changes it.
    layout.push(layout.shift());
  }
  return layout;
}

/**
 * The first ask of a run: Easy starts at 1; Normal and Hard start anywhere.
 *
 * @param {string} level
 * @param {() => number} [random]
 * @returns {Hunt}
 */
export function startHunt(level, random = Math.random) {
  const rules = rulesFor(level);
  const layout = newLayout(rules.count, null, random);
  const wanted = rules.order === 'in-order' ? 1 : pickOther(range(1, rules.count), null, random);
  return { layout, wanted };
}

/**
 * The ask after the wanted number was found.
 * - Easy: the next number up on the same board; after the last, 1 again on a new layout.
 * - Normal: any other number, on the same board.
 * - Hard: any other number, and the tiles change places.
 *
 * @param {string} level
 * @param {Hunt} hunt
 * @param {() => number} [random]
 * @returns {Hunt}
 */
export function nextHunt(level, hunt, random = Math.random) {
  const rules = rulesFor(level);
  if (rules.order === 'in-order') {
    if (hunt.wanted < rules.count) return { layout: hunt.layout, wanted: hunt.wanted + 1 };
    return { layout: newLayout(rules.count, hunt.layout, random), wanted: 1 };
  }
  const wanted = pickOther(range(1, rules.count), hunt.wanted, random);
  const layout = rules.moveAfterFind ? newLayout(rules.count, hunt.layout, random) : hunt.layout;
  return { layout, wanted };
}

/**
 * Whether a tapped number is the one asked for.
 *
 * @param {Hunt} hunt
 * @param {number} number
 */
export function isRight(hunt, number) {
  return number === hunt.wanted;
}

/**
 * The mark (`chart-1` … `chart-5`) on a number's tile edge: the five marks in
 * turn, so a tile keeps its colour when it moves.
 *
 * @param {number} number
 */
export function markOf(number) {
  return `chart-${((number - 1) % 5) + 1}`;
}
