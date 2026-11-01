/**
 * Picking at random, with the source of chance passed in so checks are fixed.
 *
 * Every function takes an optional `random` returning a number in [0, 1), like
 * `Math.random`; the games pass nothing and the checks pass a fixed sequence.
 * Pure.
 */

/** @typedef {() => number} Random */

/**
 * A whole number from `0` up to, but not including, `count`.
 *
 * @param {number} count
 * @param {Random} [random]
 */
export function below(count, random = Math.random) {
  if (!Number.isSafeInteger(count) || count < 1) throw new RangeError('count must be a whole number of at least 1');
  return Math.min(count - 1, Math.floor(random() * count));
}

/**
 * One item of a list.
 *
 * @template T
 * @param {readonly T[]} items
 * @param {Random} [random]
 * @returns {T}
 */
export function pick(items, random = Math.random) {
  return items[below(items.length, random)];
}

/**
 * One item, never `avoid` when another item exists.
 *
 * @template T
 * @param {readonly T[]} items
 * @param {T | undefined | null} avoid
 * @param {Random} [random]
 * @returns {T}
 */
export function pickOther(items, avoid, random = Math.random) {
  const others = items.filter((item) => item !== avoid);
  return pick(others.length > 0 ? others : items, random);
}

/**
 * A shuffled copy (Fisher and Yates).
 *
 * @template T
 * @param {readonly T[]} items
 * @param {Random} [random]
 * @returns {T[]}
 */
export function shuffle(items, random = Math.random) {
  const copy = [...items];
  for (let at = copy.length - 1; at > 0; at -= 1) {
    const other = below(at + 1, random);
    [copy[at], copy[other]] = [copy[other], copy[at]];
  }
  return copy;
}

/**
 * `count` different items, in random order; all of them when there are fewer.
 *
 * @template T
 * @param {readonly T[]} items
 * @param {number} count
 * @param {Random} [random]
 * @returns {T[]}
 */
export function sample(items, count, random = Math.random) {
  return shuffle(items, random).slice(0, Math.max(0, count));
}

/**
 * The whole numbers from `low` to `high`, both included.
 *
 * @param {number} low
 * @param {number} high
 */
export function range(low, high) {
  const numbers = [];
  for (let n = low; n <= high; n += 1) numbers.push(n);
  return numbers;
}
