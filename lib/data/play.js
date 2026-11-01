/**
 * The grown-ups' choices: one settings row and one row per game with a level or
 * a favourite star, all for one owner.
 *
 * Every read and write names its owner, and every write goes through
 * `modelAction` from `./index.js`, never the generated client. A read never
 * creates a row: no row means the defaults, and nothing is saved until a
 * grown-up changes something (`AGENTS.md` rule 4a).
 *
 * Values are copied into plain objects before they leave this file, because the
 * records route used inside Tellop answers objects with no prototype.
 */

import { DEFAULT_LEVEL, GAME_IDS, LEVELS } from '../play/catalog.js';
import { checkChoice, checkSettings, LANGUAGES } from '../play/limits.js';
import { CHALLENGES, DEFAULT_CHALLENGE } from '../play/meter.js';

import { DataError, modelAction } from './index.js';

/** The settings while nothing is saved: sounds and speaking on, the app's own language, a kind challenge. */
export const SETTINGS_DEFAULTS = Object.freeze({ soundOn: true, voiceOn: true, language: '', challenge: DEFAULT_CHALLENGE });

/** A game's choice while nothing is saved. */
export const CHOICE_DEFAULTS = Object.freeze({ level: DEFAULT_LEVEL, favourite: false });

/**
 * @typedef {{ soundOn: boolean, voiceOn: boolean, language: string, challenge: string }} SettingsView
 * @typedef {{ level: string, favourite: boolean }} ChoiceView
 */

/** @param {unknown} value */
function requireOwner(value) {
  if (typeof value !== 'string' || value.trim().length === 0) throw new DataError('error.ownerMissing');
  return value.trim();
}

/** @param {unknown} value */
function flag(value) {
  if (value === true || value === 1 || value === 1n) return true;
  if (value === false || value === 0 || value === 0n) return false;
  throw new DataError('error.storageUnreadable');
}

/**
 * A saved settings row as a plain view. A value outside its list reads as the default.
 *
 * @param {any} row
 * @returns {SettingsView}
 */
function settingsView(row) {
  if (row === null || typeof row !== 'object') throw new DataError('error.storageUnreadable');
  return {
    soundOn: flag(row.soundOn),
    voiceOn: flag(row.voiceOn),
    language: LANGUAGES.includes(row.language) ? row.language : SETTINGS_DEFAULTS.language,
    challenge: CHALLENGES.includes(row.challenge) ? row.challenge : SETTINGS_DEFAULTS.challenge,
  };
}

/**
 * @param {any} row
 * @returns {ChoiceView}
 */
function choiceView(row) {
  if (row === null || typeof row !== 'object') throw new DataError('error.storageUnreadable');
  return {
    level: LEVELS.includes(row.level) ? row.level : DEFAULT_LEVEL,
    favourite: flag(row.favourite),
  };
}

/**
 * Runs one records call and turns an unexpected failure into words a person
 * can read. A `DataError` passes through as it is.
 *
 * @template T
 * @param {() => Promise<T>} work
 * @param {string} failureKey
 * @returns {Promise<T>}
 */
async function guarded(work, failureKey) {
  try {
    return await work();
  } catch (error) {
    if (error instanceof DataError) throw error;
    throw new DataError(failureKey);
  }
}

/**
 * The owner's settings, or the defaults when nothing is saved.
 *
 * @param {unknown} ownerId
 * @returns {Promise<SettingsView>}
 */
export async function readSettingsFor(ownerId) {
  const owner = requireOwner(ownerId);
  const row = await guarded(
    () => modelAction('PlaySettings', 'findUnique', { where: { ownerId: owner } }),
    'error.storageUnreadable',
  );
  return row === null || row === undefined ? { ...SETTINGS_DEFAULTS } : settingsView(row);
}

/**
 * Every game's choice for the owner, keyed by game id; a game with no saved row
 * gets the defaults. One read of at most fifteen rows.
 *
 * @param {unknown} ownerId
 * @returns {Promise<Record<string, ChoiceView>>}
 */
export async function readChoicesFor(ownerId) {
  const owner = requireOwner(ownerId);
  const rows = await guarded(
    () => modelAction('GameChoice', 'findMany', {
      where: { ownerId: owner, gameId: { in: [...GAME_IDS] } },
      select: { gameId: true, level: true, favourite: true },
      take: GAME_IDS.length,
    }),
    'error.storageUnreadable',
  );
  if (!Array.isArray(rows)) throw new DataError('error.storageUnreadable');
  /** @type {Record<string, ChoiceView>} */
  const choices = {};
  for (const id of GAME_IDS) choices[id] = { ...CHOICE_DEFAULTS };
  for (const row of rows) {
    if (row !== null && typeof row === 'object' && GAME_IDS.includes(row.gameId)) choices[row.gameId] = choiceView(row);
  }
  return choices;
}

/**
 * One game's choice for the owner, or the defaults.
 *
 * @param {unknown} ownerId
 * @param {string} gameId
 * @returns {Promise<ChoiceView>}
 */
export async function readChoiceFor(ownerId, gameId) {
  const owner = requireOwner(ownerId);
  if (!GAME_IDS.includes(gameId)) throw new DataError('play.problem.refused');
  const row = await guarded(
    () => modelAction('GameChoice', 'findUnique', { where: { ownerId_gameId: { ownerId: owner, gameId } } }),
    'error.storageUnreadable',
  );
  return row === null || row === undefined ? { ...CHOICE_DEFAULTS } : choiceView(row);
}

/**
 * Saves the four settings in one step and answers what was saved. A saved value
 * that differs from what was asked is an unconfirmed save.
 *
 * @param {unknown} ownerId
 * @param {unknown} settings
 * @returns {Promise<SettingsView>}
 */
export async function saveSettingsFor(ownerId, settings) {
  const owner = requireOwner(ownerId);
  const wanted = checkSettings(settings);
  const row = await guarded(
    () => modelAction('PlaySettings', 'upsert', {
      where: { ownerId: owner },
      create: { ownerId: owner, ...wanted },
      update: { ...wanted },
    }),
    'error.saveFailed',
  );
  const saved = settingsView(row);
  if (Object.keys(wanted).some((key) => saved[key] !== wanted[key])) throw new DataError('error.saveUnconfirmed');
  return saved;
}

/**
 * Saves one game's level and favourite star and answers what was saved.
 *
 * @param {unknown} ownerId
 * @param {unknown} choice
 * @returns {Promise<{ gameId: string } & ChoiceView>}
 */
export async function saveChoiceFor(ownerId, choice) {
  const owner = requireOwner(ownerId);
  const { gameId, level, favourite } = checkChoice(choice);
  const row = await guarded(
    () => modelAction('GameChoice', 'upsert', {
      where: { ownerId_gameId: { ownerId: owner, gameId } },
      create: { ownerId: owner, gameId, level, favourite },
      update: { level, favourite },
    }),
    'error.saveFailed',
  );
  const saved = choiceView(row);
  if (saved.level !== level || saved.favourite !== favourite || row.gameId !== gameId) throw new DataError('error.saveUnconfirmed');
  return { gameId, ...saved };
}
