/**
 * Number tracing's rules: which numbers each level
 * draws, how wide its path is, and whether the centre line shows. Pure.
 */

import { pickOther, range } from '../play/random.js';

/** The numbers, the path and the centre line, by level. */
export const LEVELS = Object.freeze({
  easy: Object.freeze({ glyphs: Object.freeze(range(0, 5).map(String)), path: 'wide', guide: true }),
  normal: Object.freeze({ glyphs: Object.freeze(range(0, 9).map(String)), path: 'middle', guide: false }),
  hard: Object.freeze({ glyphs: Object.freeze(range(10, 20).map(String)), path: 'narrow', guide: false }),
});

/** A level's rules; an unknown level plays as normal. @param {string} level */
export function rulesFor(level) {
  return LEVELS[level] ?? LEVELS.normal;
}

/**
 * The next number to draw: never the last one.
 *
 * @param {string} level
 * @param {string | null} last
 * @param {() => number} [random]
 */
export function nextGlyph(level, last, random = Math.random) {
  return pickOther(rulesFor(level).glyphs, last, random);
}

/**
 * The first number of a run: `wanted` when the level has it (a review case may
 * name it in the address), otherwise a random one.
 *
 * @param {string} level
 * @param {string | null} wanted
 * @param {() => number} [random]
 */
export function firstGlyph(level, wanted, random = Math.random) {
  return wanted !== null && rulesFor(level).glyphs.includes(wanted) ? wanted : nextGlyph(level, null, random);
}
