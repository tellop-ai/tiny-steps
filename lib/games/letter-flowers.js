/**
 * Letter flowers' rules: the garden shows one letter; the child taps the
 * tile with that letter among others, and each right answer in this run grows
 * the flower one stage. Pure: the rounds, the check and the flower's stages.
 */

import { pickOther, shuffle } from '../play/random.js';

import { alphabetFor, capital, exampleOf, small } from './letters.js';

/**
 * The tiles to pick from and how the letters show, by level. Normal also shows
 * and says the letter's example word.
 */
export const LEVELS = Object.freeze({
  easy: Object.freeze({ tiles: 4, small: false, example: false }),
  normal: Object.freeze({ tiles: 6, small: false, example: true }),
  hard: Object.freeze({ tiles: 9, small: true, example: false }),
});

/**
 * Small letters that look alike when one is shown alone and big: a child cannot
 * tell a lone "l" from a lone "ı" (both a plain upright bar), so a round with
 * small letters never shows both. Capitals have no such pair (I and İ differ by the dot).
 */
export const SMALL_LOOK_ALIKE = Object.freeze([Object.freeze(['l', 'ı'])]);

/** Whether two small glyphs are a look-alike pair. @param {string} a @param {string} b */
function lookAlike(a, b) {
  return SMALL_LOOK_ALIKE.some(([one, two]) => (a === one && b === two) || (a === two && b === one));
}

/**
 * @typedef {{ id: string, letter: string, glyph: string }} Tile
 *   `letter` is the alphabet's capital (the letter's identity); `glyph` is how it shows.
 * @typedef {{ word: string, emoji: string, inside?: true }} Example
 * @typedef {{ letter: string, glyph: string, tiles: Tile[], example: Example | null }} Round
 */

/**
 * One round: the wanted letter (never the last round's), and distinct tiles with
 * the wanted one among them, in random order, as capitals or small letters by level;
 * never two small letters that look alike (`SMALL_LOOK_ALIKE`).
 *
 * @param {string} level
 * @param {string} locale
 * @param {string | null} lastLetter  the previous round's letter (either case), or null
 * @param {() => number} [random]
 * @returns {Round}
 */
export function makeRound(level, locale, lastLetter, random = Math.random) {
  const rules = LEVELS[level] ?? LEVELS.normal;
  const alphabet = alphabetFor(locale);
  const last = lastLetter == null ? null : capital(lastLetter, locale);
  const letter = pickOther(alphabet, last, random);
  const show = (each) => (rules.small ? small(each, locale) : each);
  // The other tiles, in random order, skipping a letter that looks like one already on a tile.
  const chosen = [letter];
  for (const each of shuffle(alphabet.filter((other) => other !== letter), random)) {
    if (chosen.length >= rules.tiles) break;
    if (!chosen.some((other) => lookAlike(show(each), show(other)))) chosen.push(each);
  }
  const tiles = shuffle(chosen, random).map((each, index) => ({
    id: `${index}-${each}`,
    letter: each,
    glyph: show(each),
  }));
  return { letter, glyph: show(letter), tiles, example: rules.example ? exampleOf(letter, locale) : null };
}

/**
 * Whether a tapped tile is the wanted letter.
 *
 * @param {Round} round
 * @param {string} tileId
 */
export function isRight(round, tileId) {
  return round.tiles.some((tile) => tile.id === tileId && tile.letter === round.letter);
}

/**
 * An example word split around the first place its letter is, so the screen can
 * mark the letter: "fo" + "x" + "", "" + "a" + "pple". The whole word is `before`
 * when the letter is not in it.
 *
 * @param {string} word
 * @param {string} letter
 * @param {string} locale
 */
export function splitWord(word, letter, locale) {
  const at = small(word, locale).indexOf(small(letter, locale));
  if (at < 0) return { before: word, match: '', after: '' };
  const length = small(letter, locale).length;
  return { before: word.slice(0, at), match: word.slice(at, at + length), after: word.slice(at + length) };
}

/** The right answers after which the flower is in full bloom; more add nothing. */
export const FULL_BLOOM = 8;

/** The flower's drawing, in its own units (`app/_games/letter-flowers.jsx`, viewBox 25 0 150 300, the stem at x 100). */
export const GROUND_Y = 262;
export const STEM_SHORTEST = 52;
export const STEM_TALLEST = 172;
export const HEAD_SMALLEST = 0.6;
export const HEAD_BIGGEST = 1;
export const PETALS_FEWEST = 4;
export const PETALS_MOST = 12;

/**
 * @typedef {{ stage: number, stem: number, headY: number, head: number, petals: number,
 *   angles: number[], mark: 'chart-1' | 'chart-2' | 'chart-5', leaves: number }} Growth
 */

/**
 * How the flower looks after `rights` right answers this run: stage 0 (a bud with
 * 4 petals in chart-2) to stage 8 (full bloom, 12 petals in chart-5). The stem
 * rises, the head grows, a petal is added each stage, the petal mark moves from
 * chart-2 (stages 0 to 2) to chart-1 (3 to 5) to chart-5 (6 to 8), and leaves come
 * at stages 2 and 5. A part of an answer is dropped; anything below 0 or not a
 * finite number counts as 0.
 *
 * @param {number} rights
 * @returns {Growth}
 */
export function growth(rights) {
  const whole = Number.isFinite(rights) ? Math.floor(rights) : 0;
  const stage = Math.min(FULL_BLOOM, Math.max(0, whole));
  const share = stage / FULL_BLOOM;
  const stem = Math.round(STEM_SHORTEST + (STEM_TALLEST - STEM_SHORTEST) * share);
  const head = Math.round((HEAD_SMALLEST + (HEAD_BIGGEST - HEAD_SMALLEST) * share) * 1000) / 1000;
  const petals = PETALS_FEWEST + stage;
  const angles = Array.from({ length: petals }, (_, index) => Math.round((index * 3600) / petals) / 10);
  const mark = stage < 3 ? 'chart-2' : stage < 6 ? 'chart-1' : 'chart-5';
  const leaves = stage >= 5 ? 2 : stage >= 2 ? 1 : 0;
  return { stage, stem, headY: GROUND_Y - stem, head, petals, angles, mark, leaves };
}
