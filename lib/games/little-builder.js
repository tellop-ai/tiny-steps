/**
 * Little builder's rules: build a
 * picture piece by piece. The game names each piece's colour, so every piece
 * is an emoji whose colour is fixed (the colour rule), and PIECES is
 * the one place a piece comes from. Pictures are our own slot lists on a
 * 100 x 100 board. Pure.
 */

import { pickOther, sample, shuffle } from '../play/random.js';

/** The board's size in board units, both ways. */
export const BOARD = 100;
/** How far every slot stays inside the board's edge. */
export const MARGIN = 2;

/**
 * Which emoji exists for each shape and colour. A pair missing here does not
 * exist as a piece (a triangle is red only, a diamond orange or blue, a star
 * yellow). All Unicode 13 or earlier.
 */
export const PIECES = Object.freeze({
  circle: Object.freeze({ red: '🔴', orange: '🟠', yellow: '🟡', green: '🟢', blue: '🔵', purple: '🟣', brown: '🟤', black: '⚫', white: '⚪' }),
  square: Object.freeze({ red: '🟥', orange: '🟧', yellow: '🟨', green: '🟩', blue: '🟦', purple: '🟪', brown: '🟫', black: '⬛', white: '⬜' }),
  heart: Object.freeze({ red: '❤️', orange: '🧡', yellow: '💛', green: '💚', blue: '💙', purple: '💜', brown: '🤎', black: '🖤', white: '🤍' }),
  triangle: Object.freeze({ red: '🔺' }),
  diamond: Object.freeze({ orange: '🔶', blue: '🔷' }),
  star: Object.freeze({ yellow: '⭐' }),
});

/**
 * @typedef {{ id: string, shape: string, colour: string, glyph: string }} Piece
 * @typedef {{ shape: string, colour: string, x: number, y: number, size: number }} Slot
 * @typedef {{ id: string, slots: readonly Slot[] }} Picture
 */

/** Every piece there is, one per shape and colour pair in PIECES. */
export const ALL_PIECES = Object.freeze(
  Object.entries(PIECES).flatMap(([shape, colours]) =>
    Object.entries(colours).map(([colour, glyph]) => Object.freeze({ id: `${shape}-${colour}`, shape, colour, glyph })),
  ),
);

/**
 * The piece for a shape and colour, or null when no such piece exists.
 *
 * @returns {Piece | null}
 */
export function pieceFor(shape, colour) {
  return ALL_PIECES.find((piece) => piece.shape === shape && piece.colour === colour) ?? null;
}

/** How many pieces the tray holds and how many of the wrong ones look alike, by level; whether the asked slot blinks. */
export const LEVELS = Object.freeze({
  easy: Object.freeze({ tray: 3, alike: 0, blink: true }),
  normal: Object.freeze({ tray: 4, alike: 2, blink: true }),
  hard: Object.freeze({ tray: 5, alike: 4, blink: false }),
});

const slot = (shape, colour, x, y, size) => Object.freeze({ shape, colour, x, y, size });
const picture = (id, slots) => Object.freeze({ id, slots: Object.freeze(slots) });

/** Every picture; slots are built in this order. Words: `games.little-builder.pic.<id>`. */
export const PICTURES = Object.freeze([
  picture('house', [
    slot('square', 'yellow', 39, 57, 24),
    slot('square', 'blue', 63, 57, 24),
    slot('square', 'brown', 39, 81, 24),
    slot('square', 'yellow', 63, 81, 24),
    slot('triangle', 'red', 51, 25, 40),
    slot('circle', 'yellow', 86, 13, 16),
  ]),
  picture('snowman', [
    slot('circle', 'white', 50, 80, 32),
    slot('circle', 'white', 50, 50, 28),
    slot('circle', 'white', 50, 26, 20),
    slot('square', 'black', 50, 9, 14),
    slot('star', 'yellow', 84, 16, 16),
  ]),
  picture('tree', [
    slot('square', 'brown', 50, 86, 18),
    slot('square', 'brown', 50, 68, 18),
    slot('circle', 'green', 36, 44, 26),
    slot('circle', 'green', 64, 44, 26),
    slot('circle', 'green', 50, 20, 26),
    slot('circle', 'red', 80, 84, 12),
  ]),
  picture('car', [
    slot('square', 'red', 30, 56, 22),
    slot('circle', 'black', 30, 78, 20),
    slot('square', 'red', 52, 56, 22),
    slot('square', 'blue', 41, 34, 22),
    slot('square', 'red', 74, 56, 22),
    slot('circle', 'black', 74, 78, 20),
    slot('square', 'blue', 63, 34, 22),
  ]),
  picture('robot', [
    slot('square', 'purple', 50, 54, 32),
    slot('square', 'blue', 50, 26, 22),
    slot('circle', 'red', 50, 9, 12),
    slot('square', 'yellow', 24, 48, 14),
    slot('square', 'yellow', 76, 48, 14),
    slot('square', 'black', 41, 82, 16),
    slot('square', 'black', 59, 82, 16),
  ]),
  picture('traffic-light', [
    slot('circle', 'red', 50, 16, 22),
    slot('circle', 'yellow', 50, 40, 22),
    slot('circle', 'green', 50, 64, 22),
    slot('square', 'black', 50, 87, 16),
  ]),
  picture('rocket', [
    slot('square', 'white', 50, 58, 22),
    slot('square', 'white', 50, 36, 22),
    slot('triangle', 'red', 50, 14, 22),
    slot('triangle', 'red', 31, 64, 16),
    slot('triangle', 'red', 69, 64, 16),
    slot('diamond', 'orange', 50, 82, 20),
    slot('star', 'yellow', 84, 20, 16),
  ]),
  picture('flower', [
    slot('circle', 'yellow', 50, 32, 18),
    slot('circle', 'purple', 50, 14, 16),
    slot('square', 'green', 50, 68, 12),
    slot('circle', 'purple', 68, 32, 16),
    slot('heart', 'green', 37, 76, 14),
    slot('circle', 'purple', 50, 50, 16),
    slot('square', 'green', 50, 82, 12),
    slot('circle', 'purple', 32, 32, 16),
    slot('heart', 'green', 63, 76, 14),
  ]),
  picture('caterpillar', [
    slot('circle', 'red', 83, 50, 20),
    slot('circle', 'green', 65, 56, 16),
    slot('heart', 'green', 50, 86, 14),
    slot('circle', 'green', 48, 62, 16),
    slot('circle', 'green', 31, 56, 16),
    slot('circle', 'green', 14, 62, 16),
  ]),
  picture('cake', [
    slot('square', 'brown', 28, 76, 22),
    slot('square', 'brown', 50, 76, 22),
    slot('square', 'brown', 72, 76, 22),
    slot('square', 'yellow', 39, 54, 22),
    slot('square', 'yellow', 61, 54, 22),
    slot('square', 'red', 50, 37, 12),
    slot('diamond', 'orange', 50, 23, 14),
  ]),
]);

/** A slot's box on the board: left, top, right, bottom. */
export function slotBox(each) {
  const half = each.size / 2;
  return { left: each.x - half, top: each.y - half, right: each.x + half, bottom: each.y + half };
}

/** Whether two pieces look alike: the same colour or the same shape (but not both). */
export function looksAlike(a, b) {
  return (a.shape === b.shape) !== (a.colour === b.colour);
}

/**
 * The tray for the slot being asked: the right piece and others in random
 * order. Easy: the others share neither shape nor colour with it. Normal: up
 * to two look alike (one of the same colour and one of the same shape, when
 * both exist). Hard: up to four look alike. Look-alikes that do not exist are
 * made up with unlike pieces, so the tray is always full.
 *
 * @param {string} level
 * @param {Slot} asked
 * @param {() => number} [random]
 * @returns {Piece[]}
 */
export function makeTray(level, asked, random = Math.random) {
  const rules = LEVELS[level] ?? LEVELS.normal;
  const right = pieceFor(asked.shape, asked.colour);
  if (!right) throw new RangeError(`no ${asked.colour} ${asked.shape} piece exists`);
  const others = ALL_PIECES.filter((piece) => piece.id !== right.id);
  const sameColour = shuffle(others.filter((piece) => piece.colour === right.colour), random);
  const sameShape = shuffle(others.filter((piece) => piece.shape === right.shape), random);
  const unlike = others.filter((piece) => !looksAlike(piece, right));

  // Take look-alikes in turn from each kind, so both kinds show when both exist.
  const alike = [];
  while (alike.length < rules.alike && (sameColour.length > 0 || sameShape.length > 0)) {
    const first = alike.length % 2 === 0 ? sameColour : sameShape;
    const second = first === sameColour ? sameShape : sameColour;
    alike.push((first.length > 0 ? first : second).shift());
  }
  const rest = sample(unlike, rules.tray - 1 - alike.length, random);
  return shuffle([right, ...alike, ...rest], random);
}

/** Whether a piece fills the slot. */
export function isRight(asked, piece) {
  return piece.shape === asked.shape && piece.colour === asked.colour;
}

/** Whether the asked slot blinks at this level. */
export function blinks(level) {
  return (LEVELS[level] ?? LEVELS.normal).blink;
}

/**
 * The next picture: never the last one again.
 *
 * @param {string | null} lastId
 * @param {() => number} [random]
 * @returns {Picture}
 */
export function nextPicture(lastId, random = Math.random) {
  const last = PICTURES.find((each) => each.id === lastId);
  return pickOther(PICTURES, last, random);
}
