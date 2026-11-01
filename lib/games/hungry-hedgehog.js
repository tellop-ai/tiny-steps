/**
 * Hungry hedgehog's rules: the hedgehog shows the number it wants on a
 * sign; the child feeds it the one tile with that number from a tray of
 * different numbers. Pure.
 */

import { pickOther, range, sample, shuffle } from '../play/random.js';

/** The numbers the hedgehog may want and how many tiles the tray holds, by level. */
export const LEVELS = Object.freeze({
  easy: Object.freeze({ low: 1, high: 5, tiles: 4 }),
  normal: Object.freeze({ low: 1, high: 10, tiles: 6 }),
  hard: Object.freeze({ low: 1, high: 20, tiles: 8 }),
});

/**
 * @typedef {{ id: string, value: number }} Tile
 * @typedef {{ wanted: number, tiles: Tile[] }} Round
 */

/**
 * One round: the number wanted (never the last round's) and the tray's tiles:
 * the wanted number and other different numbers of the level's range, in
 * random order.
 *
 * @param {string} level
 * @param {number | null} lastWanted
 * @param {() => number} [random]
 * @returns {Round}
 */
export function makeRound(level, lastWanted, random = Math.random) {
  const rules = LEVELS[level] ?? LEVELS.normal;
  const numbers = range(rules.low, rules.high);
  const wanted = pickOther(numbers, lastWanted, random);
  const others = sample(numbers.filter((n) => n !== wanted), rules.tiles - 1, random);
  const tiles = shuffle([wanted, ...others], random).map((value) => ({ id: `n${value}`, value }));
  return { wanted, tiles };
}

/**
 * The tile with this id, or null.
 *
 * @param {Round} round
 * @param {string} tileId
 */
export function tileOf(round, tileId) {
  return round.tiles.find((tile) => tile.id === tileId) ?? null;
}

/**
 * Whether a fed tile is the number wanted.
 *
 * @param {Round} round
 * @param {string} tileId
 */
export function isRight(round, tileId) {
  return tileOf(round, tileId)?.value === round.wanted;
}
