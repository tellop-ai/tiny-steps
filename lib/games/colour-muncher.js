/**
 * Colour muncher's rules: the monster asks for one colour; the child
 * taps the one thing of that colour among things of other colours. Pure.
 */

import { pick, pickOther, sample, shuffle } from '../play/random.js';

import { COLOURS } from './colours.js';

/** The colours and the number of things to pick from, by level. */
export const LEVELS = Object.freeze({
  easy: Object.freeze({ colours: Object.freeze(['red', 'yellow', 'green', 'blue']), choices: 3 }),
  normal: Object.freeze({ colours: Object.freeze(['red', 'yellow', 'green', 'blue', 'orange', 'purple']), choices: 4 }),
  hard: Object.freeze({ colours: Object.freeze(['red', 'yellow', 'green', 'blue', 'orange', 'purple', 'pink', 'brown']), choices: 6 }),
});

/**
 * @typedef {{ id: string, glyph: string, colour: string }} Thing
 * @typedef {{ colour: string, things: Thing[] }} Round
 */

/**
 * One round: the colour asked for (never the last round's when another exists)
 * and the things to pick from: exactly one of that colour, the rest each of a
 * different other colour, in random order.
 *
 * @param {string} level
 * @param {string | null} lastColour
 * @param {() => number} [random]
 * @returns {Round}
 */
export function makeRound(level, lastColour, random = Math.random) {
  const rules = LEVELS[level] ?? LEVELS.normal;
  const colour = pickOther(rules.colours, lastColour, random);
  const others = sample(rules.colours.filter((id) => id !== colour), rules.choices - 1, random);
  const things = shuffle([colour, ...others], random).map((id, index) => ({
    id: `${index}-${id}`,
    glyph: pick(COLOURS[id].items, random),
    colour: id,
  }));
  return { colour, things };
}

/**
 * Whether a tapped thing is the colour asked for.
 *
 * @param {Round} round
 * @param {string} thingId
 */
export function isRight(round, thingId) {
  return round.things.some((thing) => thing.id === thingId && thing.colour === round.colour);
}
