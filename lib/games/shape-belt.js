/**
 * Shape belt's rules: a row of monsters, each with a mouth cut in a shape, and
 * a belt carrying shapes left to right, only shapes the monsters have. A shape
 * fed to the monster with the same mouth is right; a shape fed to another
 * monster, or one that rides off the end, is a miss. Every 8 right feeds a new
 * group of monsters comes. Times are in seconds, places in CSS pixels. Pure.
 */

import { pickOther, sample, shuffle } from '../play/random.js';

import { SHAPE_IDS } from './shapes.js';

/**
 * By level: how many monsters, about how often a new shape comes on, and how
 * long a shape takes to ride the whole belt (slow, steady, quick).
 */
export const LEVELS = Object.freeze({
  easy: Object.freeze({ monsters: 3, spawnSeconds: 1.7, crossSeconds: 9 }),
  normal: Object.freeze({ monsters: 4, spawnSeconds: 1.3, crossSeconds: 7 }),
  hard: Object.freeze({ monsters: 5, spawnSeconds: 1.0, crossSeconds: 5 }),
});

/** Right feeds before a new group of monsters comes. */
export const FEEDS_PER_GROUP = 8;

/** The look's marks the monsters are coloured with; never named aloud. */
export const MARKS = Object.freeze(['chart-1', 'chart-2', 'chart-3', 'chart-4', 'chart-5']);

/** How long the belt waits before the first shape, in seconds. */
export const FIRST_WAIT_SECONDS = 0.5;

/**
 * How far, in shape widths, a new shape's start must be clear of every shape
 * still on the belt, so shapes never come on on top of each other (on a narrow
 * screen this makes them come a little less often).
 */
export const ENTRY_GAP = 1.4;

/** The spread around a level's spawn time: from 85 % to 115 % of it. */
const SPREAD = Object.freeze({ low: 0.85, width: 0.3 });

/** Tries at a group that differs from the last one. */
const TRIES = 12;

/**
 * @typedef {{ kind: string, mark: string }} Monster
 */

/**
 * A level's rules; an unknown level plays as normal.
 *
 * @param {string} level
 */
export function rulesFor(level) {
  return LEVELS[level] ?? LEVELS.normal;
}

const sameSet = (a, b) => a.length === b.length && a.every((kind) => b.includes(kind));

/**
 * A group of monsters: distinct mouths, each monster in its own mark, the set
 * of mouths different from the last group's when it can be.
 *
 * @param {string} level
 * @param {string[] | null} [lastKinds]
 * @param {() => number} [random]
 * @returns {Monster[]}
 */
export function makeGroup(level, lastKinds = null, random = Math.random) {
  const count = rulesFor(level).monsters;
  let kinds = sample(SHAPE_IDS, count, random);
  for (let tries = 0; lastKinds && sameSet(kinds, lastKinds) && tries < TRIES; tries += 1) {
    kinds = sample(SHAPE_IDS, count, random);
  }
  const marks = shuffle(MARKS, random);
  return kinds.map((kind, at) => ({ kind, mark: marks[at % marks.length] }));
}

/**
 * The next shape to put on the belt: one of the monsters' mouths, never the
 * one just put on when another exists.
 *
 * @param {readonly string[]} kinds  the monsters' mouths
 * @param {string | null} lastKind
 * @param {() => number} [random]
 */
export function nextKind(kinds, lastKind, random = Math.random) {
  return pickOther(kinds, lastKind, random);
}

/**
 * Whether a shape feeds a monster: only the monster whose mouth is its shape.
 *
 * @param {string} shape
 * @param {string} mouth
 */
export function feeds(shape, mouth) {
  return shape === mouth;
}

/**
 * Whether this many right feeds brings a new group of monsters (every 8th).
 *
 * @param {number} rightFeeds
 */
export function isNewGroup(rightFeeds) {
  return Number.isSafeInteger(rightFeeds) && rightFeeds > 0 && rightFeeds % FEEDS_PER_GROUP === 0;
}

/**
 * Which group of monsters is playing after this many right feeds (the first is 1).
 *
 * @param {number} rightFeeds
 */
export function groupNumber(rightFeeds) {
  return Math.floor(Math.max(0, rightFeeds) / FEEDS_PER_GROUP) + 1;
}

/**
 * How fast the belt runs, in pixels a second: the whole width in the level's
 * crossing time.
 *
 * @param {string} level
 * @param {number} beltWidth
 */
export function beltSpeed(level, beltWidth) {
  if (!(beltWidth > 0)) return 0;
  return beltWidth / rulesFor(level).crossSeconds;
}

/**
 * How long to wait for the next shape: about the level's spawn time.
 *
 * @param {string} level
 * @param {() => number} [random]
 */
export function spawnWait(level, random = Math.random) {
  return rulesFor(level).spawnSeconds * (SPREAD.low + SPREAD.width * random());
}

/**
 * Whether a new shape comes on now: its wait is over and the start of the belt
 * is clear. A shape comes on at `-size` (just off the left end); the start is
 * clear when every shape on the belt is at least `ENTRY_GAP` shape widths on
 * from there.
 *
 * @param {number} waited  seconds since the last shape came on
 * @param {number} wait  this shape's wait
 * @param {number | null} nearestX  the left edge of the shape nearest the start, or null for an empty belt
 * @param {number} size  a shape's width
 */
export function canSpawn(waited, wait, nearestX, size) {
  if (waited < wait) return false;
  return nearestX === null || nearestX >= (ENTRY_GAP - 1) * size;
}

/**
 * Whether a shape has ridden off the right end (all of it past the end).
 *
 * @param {number} x  the shape's left edge
 * @param {number} beltWidth
 */
export function ridesOff(x, beltWidth) {
  return x > beltWidth;
}
