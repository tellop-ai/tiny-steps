/**
 * Letter muncher's rules: the monster asks for one letter of the app
 * language's alphabet; the child feeds it the one tile with that letter. Easy
 * and Normal show capitals; Hard shows small letters, by the language's own
 * case rules (Turkish I and ı, İ and i). Pure.
 */

import { pickOther, sample, shuffle } from '../play/random.js';

import { alphabetFor, small } from './letters.js';

/** How many tiles there are and whether they show small letters, by level. */
export const LEVELS = Object.freeze({
  easy: Object.freeze({ tiles: 2, small: false }),
  normal: Object.freeze({ tiles: 3, small: false }),
  hard: Object.freeze({ tiles: 4, small: true }),
});

/**
 * `letter` is the capital (the letter's identity, as in `letters.js`); `shown`
 * is what the screen shows for this level.
 *
 * @typedef {{ id: string, letter: string, shown: string }} Tile
 * @typedef {{ wanted: string, shown: string, tiles: Tile[] }} Round
 */

/**
 * One round: the letter wanted (never the last round's) and the tiles: the
 * wanted letter and other different letters of the same alphabet, in random
 * order.
 *
 * @param {string} level
 * @param {string} locale
 * @param {string | null} lastWanted  the last round's capital
 * @param {() => number} [random]
 * @returns {Round}
 */
export function makeRound(level, locale, lastWanted, random = Math.random) {
  const rules = LEVELS[level] ?? LEVELS.normal;
  const alphabet = alphabetFor(locale);
  const show = (letter) => (rules.small ? small(letter, locale) : letter);
  const wanted = pickOther(alphabet, lastWanted, random);
  const others = sample(alphabet.filter((letter) => letter !== wanted), rules.tiles - 1, random);
  const tiles = shuffle([wanted, ...others], random).map((letter) => ({ id: `l${letter}`, letter, shown: show(letter) }));
  return { wanted, shown: show(wanted), tiles };
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
 * Whether a fed tile is the letter wanted.
 *
 * @param {Round} round
 * @param {string} tileId
 */
export function isRight(round, tileId) {
  return tileOf(round, tileId)?.letter === round.wanted;
}
