/**
 * The star meter every game fills.
 *
 * It starts at 10. A right answer adds the game's `gain` (`./catalog.js`), up to
 * 100, and 100 wins. A miss takes the challenge's loss, down to 0, and 0 loses;
 * only a challenge that takes points can lose. Once a run is won or lost the
 * meter does not move again.
 *
 * Pure: the page holds the meter for one run and nothing is stored.
 */

export const METER_START = 10;
export const METER_FULL = 100;
export const METER_EMPTY = 0;

/** The three challenges, kindest first. */
export const CHALLENGES = Object.freeze(['gentle', 'normal', 'strict']);

/** The challenge the app starts with: a miss costs nothing. */
export const DEFAULT_CHALLENGE = 'gentle';

/** What one miss takes from the meter, by challenge. */
export const MISS_LOSS = Object.freeze({ gentle: 0, normal: 5, strict: 10 });

/** @typedef {{ value: number, state: 'playing' | 'won' | 'lost' }} Meter */

/** @returns {Meter} */
export function startMeter() {
  return { value: METER_START, state: 'playing' };
}

/**
 * The meter after one right answer.
 *
 * @param {Meter} meter
 * @param {number} gain
 * @returns {Meter}
 */
export function afterRight(meter, gain) {
  if (meter.state !== 'playing') return meter;
  const step = Number.isSafeInteger(gain) && gain > 0 ? gain : 0;
  const value = Math.min(METER_FULL, meter.value + step);
  return { value, state: value >= METER_FULL ? 'won' : 'playing' };
}

/**
 * The meter after one miss. An unknown challenge counts as the kindest.
 *
 * @param {Meter} meter
 * @param {string} challenge
 * @returns {Meter}
 */
export function afterMiss(meter, challenge) {
  if (meter.state !== 'playing') return meter;
  const loss = Object.hasOwn(MISS_LOSS, challenge) ? MISS_LOSS[challenge] : 0;
  if (loss === 0) return meter;
  const value = Math.max(METER_EMPTY, meter.value - loss);
  return { value, state: value <= METER_EMPTY ? 'lost' : 'playing' };
}
