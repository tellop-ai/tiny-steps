/**
 * Rainbow maker's rules: a belt brings one thing at a
 * time; the child taps the paint pot of that thing's colour. Each right answer
 * this run fills one more arc of a five-arc rainbow, starting again after five.
 * Pure.
 *
 * Colours are named only through `lib/games/colours.js` (the square emoji on a
 * pot, the thing's own emoji); the rainbow's arcs are decoration and never named.
 */

import { pickOther } from '../play/random.js';

import { COLOURS } from './colours.js';

/** The pots by level, and whether a pot shows its colour's name under the square. */
export const LEVELS = Object.freeze({
  easy: Object.freeze({ pots: Object.freeze(['red', 'yellow', 'green', 'blue']), names: true }),
  normal: Object.freeze({ pots: Object.freeze(['red', 'yellow', 'green', 'blue', 'orange', 'purple']), names: true }),
  hard: Object.freeze({
    pots: Object.freeze(['red', 'yellow', 'green', 'blue', 'orange', 'purple', 'brown', 'black', 'white']),
    names: false,
  }),
});

/** How many arcs the rainbow has. */
export const ARCS = 5;

/**
 * The rules for a level; an unknown level plays as normal.
 *
 * @param {string} level
 */
export function rulesFor(level) {
  return LEVELS[level] ?? LEVELS.normal;
}

/**
 * @typedef {{ colour: string, glyph: string }} Thing
 */

/**
 * The next thing on the belt: a colour of this level's pots that is not the
 * last thing's colour, and an emoji of that colour that is not the last thing's
 * emoji.
 *
 * @param {string} level
 * @param {Thing | null} last
 * @param {() => number} [random]
 * @returns {Thing}
 */
export function nextThing(level, last, random = Math.random) {
  const { pots } = rulesFor(level);
  const colour = pickOther(pots, last?.colour ?? null, random);
  const glyph = pickOther(COLOURS[colour].items, last?.glyph ?? null, random);
  return { colour, glyph };
}

/**
 * Whether a pot is the thing's colour.
 *
 * @param {Thing} thing
 * @param {string} pot
 */
export function isRight(thing, pot) {
  return thing.colour === pot;
}

/**
 * How many arcs are filled after this many right answers in the run: one more
 * per right answer, all five on the fifth, then one again on the sixth.
 *
 * @param {number} rights
 */
export function arcsShown(rights) {
  if (!Number.isSafeInteger(rights) || rights <= 0) return 0;
  return ((rights - 1) % ARCS) + 1;
}
