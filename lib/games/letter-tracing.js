/**
 * Letter tracing's rules: the app language's alphabet,
 * capitals on Easy and Normal, small letters on Hard; how wide the path is and
 * whether the centre line shows. Pure.
 */

import { pickOther } from '../play/random.js';

import { alphabetFor, small } from './letters.js';

/** The letter case, the path and the centre line, by level. */
export const LEVELS = Object.freeze({
  easy: Object.freeze({ small: false, path: 'wide', guide: true }),
  normal: Object.freeze({ small: false, path: 'middle', guide: false }),
  hard: Object.freeze({ small: true, path: 'narrow', guide: false }),
});

/** A level's rules; an unknown level plays as normal. @param {string} level */
export function rulesFor(level) {
  return LEVELS[level] ?? LEVELS.normal;
}

/**
 * The letters a level draws in an app language (Turkish small letters by
 * Turkish rules: I to ı, İ to i).
 *
 * @param {string} level
 * @param {string} locale
 * @returns {string[]}
 */
export function glyphsFor(level, locale) {
  const letters = alphabetFor(locale);
  return rulesFor(level).small ? letters.map((letter) => small(letter, locale)) : [...letters];
}

/**
 * The next letter to draw: never the last one.
 *
 * @param {string} level
 * @param {string} locale
 * @param {string | null} last
 * @param {() => number} [random]
 */
export function nextGlyph(level, locale, last, random = Math.random) {
  return pickOther(glyphsFor(level, locale), last, random);
}

/**
 * The first letter of a run: `wanted` when the level has it (a review case may
 * name it in the address), otherwise a random one.
 *
 * @param {string} level
 * @param {string} locale
 * @param {string | null} wanted
 * @param {() => number} [random]
 */
export function firstGlyph(level, locale, wanted, random = Math.random) {
  return wanted !== null && glyphsFor(level, locale).includes(wanted) ? wanted : nextGlyph(level, locale, null, random);
}
