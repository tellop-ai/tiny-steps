/**
 * Toy room's rules: toys shaped like solid shapes stand on a round rug in a
 * small 3D room; the voice asks for one shape ("Where is the cone?") and the
 * child taps that toy. The rug can be turned by dragging, so each toy can be
 * seen from its other sides. Pure: no DOM, no React, no three.js.
 *
 * The shapes are solids (a ball, a cube, a cone, a cylinder, a pyramid, a
 * ring), the 3D cousins of the flat shapes in the other shape games. Toys are
 * coloured from the look's tokens, so the game never names a colour.
 */

/** Every solid the game knows, in teaching order. */
export const SOLIDS = Object.freeze(['ball', 'cube', 'cone', 'cylinder', 'pyramid', 'ring']);

/** How many colours the toys can take (the look's five marks and its soft highlight colour). */
export const COLOURS = 6;

/**
 * Each level: how many toys stand on the rug, which solids it uses, and
 * whether the rug turns slowly by itself.
 */
export const LEVELS = Object.freeze({
  easy: Object.freeze({ count: 3, kinds: Object.freeze(SOLIDS.slice(0, 3)), turning: false }),
  normal: Object.freeze({ count: 4, kinds: Object.freeze(SOLIDS.slice(0, 5)), turning: false }),
  hard: Object.freeze({ count: 5, kinds: SOLIDS, turning: true }),
});

/** The rug's radius and each toy's footprint radius, in scene units (about a metre each). */
export const RUG_RADIUS = 1.55;
export const TOY_RADIUS = 0.55;

/** @param {string} level */
export function rulesFor(level) {
  return LEVELS[level] ?? LEVELS.normal;
}

/**
 * A random whole number from 0 up to (not including) `below`.
 *
 * @param {number} below
 * @param {() => number} random
 */
function below(below, random) {
  return Math.min(below - 1, Math.floor(random() * below));
}

/**
 * A shuffled copy (Fisher-Yates).
 *
 * @template T
 * @param {readonly T[]} list
 * @param {() => number} random
 */
function shuffled(list, random) {
  const out = [...list];
  for (let at = out.length - 1; at > 0; at -= 1) {
    const other = below(at + 1, random);
    [out[at], out[other]] = [out[other], out[at]];
  }
  return out;
}

/**
 * @typedef {{ id: string, kind: string, colour: number }} Toy
 * @typedef {{ toys: Toy[], wanted: string }} Round
 */

/**
 * One round: `count` toys of different solids, each a different colour, in a
 * random order around the rug, and the solid the voice asks for. The asked
 * solid is never the same as the last round's when another one is on the rug.
 *
 * @param {string} level
 * @param {string | null} [previous]  the last round's asked solid
 * @param {() => number} [random]
 * @returns {Round}
 */
export function makeRound(level, previous = null, random = Math.random) {
  const rules = rulesFor(level);
  const kinds = shuffled(rules.kinds, random).slice(0, rules.count);
  const colours = shuffled(Array.from({ length: COLOURS }, (_, at) => at), random);
  const toys = kinds.map((kind, at) => ({ id: `toy-${at}`, kind, colour: colours[at] }));
  const choices = kinds.filter((kind) => kind !== previous);
  const wanted = choices[below(choices.length, random)];
  return { toys, wanted };
}

/**
 * @param {Round} round
 * @param {string} toyId
 */
export function toyOf(round, toyId) {
  return round.toys.find((toy) => toy.id === toyId) ?? null;
}

/**
 * @param {Round} round
 * @param {string} toyId
 */
export function isRight(round, toyId) {
  return toyOf(round, toyId)?.kind === round.wanted;
}

/**
 * Where each toy stands: evenly round the rug, the first one at the front (the
 * side nearest the camera, +z), going round to the right. Angles in radians.
 *
 * @param {number} count
 * @param {number} [radius]
 */
export function rugPlaces(count, radius = RUG_RADIUS) {
  if (!Number.isSafeInteger(count) || count < 1) throw new RangeError('count must be a whole number of at least 1');
  return Array.from({ length: count }, (_, at) => {
    const angle = Math.PI / 2 + (2 * Math.PI * at) / count;
    return { x: radius * Math.cos(angle), z: radius * Math.sin(angle), angle };
  });
}

/**
 * A word with its first letter capital, by the language's own rules (Turkish
 * i becomes İ), for a filled-in word that starts a sentence.
 *
 * @param {string} word
 * @param {string} locale
 */
export function capitalFirst(word, locale) {
  if (typeof word !== 'string' || word.length === 0) return '';
  const tag = locale === 'tr' ? 'tr-TR' : 'en-GB';
  return word.charAt(0).toLocaleUpperCase(tag) + word.slice(1);
}
