/**
 * Number pond's rules: fish swim across a
 * pond, each in its own lane, wrapping round; each carries a number. The game
 * asks for one number and the child catches the fish that carries it. Easy has
 * 4 slow fish and numbers 1 to 5, Normal 6 fish and 1 to 10, Hard 8 quicker
 * fish and 1 to 20. The numbers on screen are distinct and always include the
 * wanted one. Pure: the game turns these positions into pixels.
 *
 * A fish's place across the pond is its progress `p` in [0, 1): at 0 its nose
 * is at the left edge, coming in; at 1 its tail leaves the right edge. So the
 * whole trip is the pond's width plus the fish's own width, and a fish that
 * wraps from 1 to 0 is out of sight when it does.
 */

import { below, pickOther, range, sample } from '../play/random.js';

/**
 * Fish, the highest number, and the speed in trips per second (one trip is
 * the pond's width plus a fish's width), by level.
 */
export const LEVELS = Object.freeze({
  easy: Object.freeze({ fish: 4, high: 5, speed: 0.06 }),
  normal: Object.freeze({ fish: 6, high: 10, speed: 0.08 }),
  hard: Object.freeze({ fish: 8, high: 20, speed: 0.11 }),
});

/** How much one fish's speed may differ from its level's, either way, as a share of it. */
export const SPEED_SPREAD = 0.2;

/** How fast fish bob up and down, in radians per second. */
export const BOB_RATE = 2.4;

/** How long a caught fish shows before every fish gets a new number, in milliseconds. */
export const NEXT_ROUND_MS = 900;

/** The marks the fish wear, in turn. */
const MARKS = Object.freeze(['chart-1', 'chart-2', 'chart-3', 'chart-4', 'chart-5']);

/**
 * @typedef {{ lane: number, direction: 1 | -1, speed: number, start: number, bob: number, mark: string }} Fish
 * @typedef {{ wanted: number, numbers: number[] }} Round
 *   `numbers[i]` is the number fish `i` carries.
 */

/** @param {string} level */
export function rulesFor(level) {
  return LEVELS[level] ?? LEVELS.normal;
}

/**
 * The fish for a run: one per lane, lanes swimming in turn left and right
 * (the first lane's way by chance), each at its level's speed give or take a
 * fifth, starting anywhere across the pond.
 *
 * @param {string} level
 * @param {() => number} [random]
 * @returns {Fish[]}
 */
export function makeSchool(level, random = Math.random) {
  const rules = rulesFor(level);
  const first = random() < 0.5 ? 1 : -1;
  return range(0, rules.fish - 1).map((lane) => ({
    lane,
    direction: /** @type {1 | -1} */ (lane % 2 === 0 ? first : -first),
    speed: rules.speed * (1 + SPEED_SPREAD * (2 * random() - 1)),
    start: random(),
    bob: random() * 2 * Math.PI,
    mark: MARKS[lane % MARKS.length],
  }));
}

/**
 * A value wrapped into [0, 1).
 *
 * @param {number} value
 */
export function wrap(value) {
  const wrapped = value - Math.floor(value);
  return wrapped >= 1 ? 0 : wrapped;
}

/**
 * Where a fish is on its trip after `seconds` of swimming, in [0, 1).
 *
 * @param {Fish} fish
 * @param {number} seconds
 */
export function progressAt(fish, seconds) {
  return wrap(fish.start + fish.direction * fish.speed * seconds);
}

/**
 * A fish's bob after `seconds`, from -1 (lowest) to 1 (highest).
 *
 * @param {Fish} fish
 * @param {number} seconds
 */
export function bobAt(fish, seconds) {
  return Math.sin(seconds * BOB_RATE + fish.bob);
}

/**
 * The share of a trip a fish's own body takes: its width over the pond's
 * width plus its own.
 *
 * @param {number} pondWidth
 * @param {number} fishWidth
 */
export function bodyShare(pondWidth, fishWidth) {
  if (!(pondWidth > 0) || !(fishWidth > 0)) return 0;
  return fishWidth / (pondWidth + fishWidth);
}

/**
 * Whether a fish's middle is inside the pond (it can be seen and pressed).
 *
 * @param {number} progress
 * @param {number} share  `bodyShare` of the pond and the fish
 */
export function middleInView(progress, share) {
  return progress >= share / 2 && progress <= 1 - share / 2;
}

/**
 * How much of its trip a fish has left while it is still whole in the pond,
 * as a share of a trip (0 or less when it is already leaving or not yet in).
 *
 * @param {Fish} fish
 * @param {number} progress
 * @param {number} share
 */
export function travelLeft(fish, progress, share) {
  if (progress < share || progress > 1 - share) return 0;
  return fish.direction > 0 ? 1 - share - progress : progress - share;
}

/**
 * Whether a fish is a good one to carry the next wanted number: whole in the
 * pond and in the first half of its crossing, so it stays to be caught.
 *
 * @param {Fish} fish
 * @param {number} progress
 * @param {number} share
 */
export function goodToCarry(fish, progress, share) {
  if (progress < share || progress > 1 - share) return false;
  return fish.direction > 0 ? progress <= 0.5 : progress >= 0.5;
}

/**
 * Which fish carries the next wanted number: one of the good ones by chance;
 * when none is good, the one with the most crossing left.
 *
 * @param {readonly Fish[]} school
 * @param {number} seconds
 * @param {number} share
 * @param {() => number} [random]
 */
export function pickCarrier(school, seconds, share, random = Math.random) {
  const places = school.map((fish) => progressAt(fish, seconds));
  const good = school.map((fish, at) => at).filter((at) => goodToCarry(school[at], places[at], share));
  if (good.length > 0) return good[below(good.length, random)];
  let best = 0;
  for (let at = 1; at < school.length; at += 1) {
    if (travelLeft(school[at], places[at], share) > travelLeft(school[best], places[best], share)) best = at;
  }
  return best;
}

/**
 * One round: the wanted number (never the last one when another exists), on
 * the fish `carrier`; every other fish a different number from 1 to the
 * level's highest.
 *
 * @param {string} level
 * @param {number | null} lastWanted
 * @param {number} carrier  which fish carries the wanted number
 * @param {() => number} [random]
 * @returns {Round}
 */
export function makeRound(level, lastWanted, carrier, random = Math.random) {
  const rules = rulesFor(level);
  const all = range(1, rules.high);
  const wanted = pickOther(all, lastWanted, random);
  const others = sample(all.filter((n) => n !== wanted), rules.fish - 1, random);
  const at = Number.isInteger(carrier) && carrier >= 0 && carrier < rules.fish ? carrier : 0;
  const numbers = [...others.slice(0, at), wanted, ...others.slice(at)];
  return { wanted, numbers };
}

/**
 * Whether the fish at `index` carries the wanted number.
 *
 * @param {Round} round
 * @param {number} index
 */
export function isRight(round, index) {
  return round.numbers[index] === round.wanted;
}
