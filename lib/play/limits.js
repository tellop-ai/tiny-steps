/**
 * The exact shapes the save addresses accept, checked before anything is saved.
 *
 * Each check refuses with a `DataError` whose `messageKey` names words in
 * `lib/i18n/locales/`. Anything that is not exactly the expected shape refuses:
 * a missing or extra field, a string where a flag belongs, a value outside its
 * closed list, a nested value. Pure.
 */

import { DataError } from '../data/refusal.js';

import { GAME_IDS, LEVELS } from './catalog.js';
import { CHALLENGES } from './meter.js';

/** The languages a grown-up may pick: `''` follows the app's own language. */
export const LANGUAGES = Object.freeze(['', 'en', 'tr']);

/** The words for a request the app does not accept. */
export const REFUSED = 'play.problem.refused';

/**
 * @param {unknown} value
 * @param {readonly string[]} keys
 * @returns {value is Record<string, unknown>}
 */
function exactObject(value, keys) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return false;
  const own = Object.keys(value);
  return own.length === keys.length && keys.every((key) => Object.hasOwn(value, key));
}

/**
 * The four settings.
 *
 * @param {unknown} input
 * @returns {{ soundOn: boolean, voiceOn: boolean, language: string, challenge: string }}
 */
export function checkSettings(input) {
  if (!exactObject(input, ['soundOn', 'voiceOn', 'language', 'challenge'])) throw new DataError(REFUSED);
  const { soundOn, voiceOn, language, challenge } = input;
  if (typeof soundOn !== 'boolean' || typeof voiceOn !== 'boolean') throw new DataError(REFUSED);
  if (typeof language !== 'string' || !LANGUAGES.includes(language)) throw new DataError(REFUSED);
  if (typeof challenge !== 'string' || !CHALLENGES.includes(challenge)) throw new DataError(REFUSED);
  return { soundOn, voiceOn, language, challenge };
}

/**
 * One game's level and favourite star.
 *
 * @param {unknown} input
 * @returns {{ gameId: string, level: string, favourite: boolean }}
 */
export function checkChoice(input) {
  if (!exactObject(input, ['gameId', 'level', 'favourite'])) throw new DataError(REFUSED);
  const { gameId, level, favourite } = input;
  if (typeof gameId !== 'string' || !GAME_IDS.includes(gameId)) throw new DataError(REFUSED);
  if (typeof level !== 'string' || !LEVELS.includes(level)) throw new DataError(REFUSED);
  if (typeof favourite !== 'boolean') throw new DataError(REFUSED);
  return { gameId, level, favourite };
}
