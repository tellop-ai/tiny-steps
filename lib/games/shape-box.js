/**
 * Shape box's rules: a board of holes and a tray of pieces, the same distinct
 * shapes in both, each piece in a random token mark so its colour gives
 * nothing away. A piece fits only the hole of its own shape. Pure.
 */

import { sample, shuffle } from '../play/random.js';

import { SHAPE_IDS } from './shapes.js';

/** How many shapes a round holds, by level. */
export const LEVELS = Object.freeze({
  easy: Object.freeze({ shapes: 3 }),
  normal: Object.freeze({ shapes: 4 }),
  hard: Object.freeze({ shapes: 6 }),
});

/** The look's marks a piece is coloured with (`data-mark`); never named aloud. */
export const MARKS = Object.freeze(['chart-1', 'chart-2', 'chart-3', 'chart-4', 'chart-5']);

/** Tries at a set or an order that differs from the one to avoid. */
const TRIES = 12;

/**
 * @typedef {{ id: string, kind: string, mark: string }} Piece
 * @typedef {{ holes: string[], pieces: Piece[] }} Round
 */

/**
 * How many shapes a level plays with; an unknown level plays as normal.
 *
 * @param {string} level
 */
export function shapeCount(level) {
  return (LEVELS[level] ?? LEVELS.normal).shapes;
}

const sameSet = (a, b) => a.length === b.length && a.every((kind) => b.includes(kind));
const sameOrder = (a, b) => a.length === b.length && a.every((kind, at) => b[at] === kind);

/**
 * One round: distinct shapes as holes on the board, and the same shapes as
 * pieces in the tray in another order (so the answer is never "straight
 * down"), each piece in a mark of its own while marks last. The set differs
 * from the last round's when it can.
 *
 * @param {string} level
 * @param {string[] | null} [lastHoles]  the last round's holes
 * @param {() => number} [random]
 * @returns {Round}
 */
export function makeRound(level, lastHoles = null, random = Math.random) {
  const count = shapeCount(level);
  let kinds = sample(SHAPE_IDS, count, random);
  for (let tries = 0; lastHoles && sameSet(kinds, lastHoles) && tries < TRIES; tries += 1) {
    kinds = sample(SHAPE_IDS, count, random);
  }
  const holes = shuffle(kinds, random);
  let order = shuffle(kinds, random);
  for (let tries = 0; count > 1 && sameOrder(order, holes) && tries < TRIES; tries += 1) order = shuffle(kinds, random);
  // Still the same after every try (only by a broken source of chance): turn it one step.
  if (count > 1 && sameOrder(order, holes)) order = [...order.slice(1), order[0]];
  const marks = shuffle(MARKS, random);
  const pieces = order.map((kind, at) => ({ id: `${at}-${kind}`, kind, mark: marks[at % marks.length] }));
  return { holes, pieces };
}

/**
 * Whether a piece fits a hole: only the hole of its own shape.
 *
 * @param {Round} round
 * @param {string} pieceId
 * @param {string} hole  the hole's shape
 */
export function fits(round, pieceId, hole) {
  return round.holes.includes(hole) && round.pieces.some((piece) => piece.id === pieceId && piece.kind === hole);
}

/**
 * Whether every hole is filled.
 *
 * @param {Round} round
 * @param {readonly string[]} filled  the holes filled so far
 */
export function isFull(round, filled) {
  return round.holes.every((hole) => filled.includes(hole));
}
