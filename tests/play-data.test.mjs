/**
 * The grown-ups' choices against a throwaway store, the two save addresses, and
 * who may save.
 */

import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { after, afterEach, test } from 'node:test';

const projectRoot = path.join(import.meta.dirname, '..');
const scratch = mkdtempSync(path.join(os.tmpdir(), 'tiny-steps-play-'));
const startedIn = process.cwd();
process.chdir(projectRoot);
process.env.APP_DATA_FILE = path.join(scratch, 'app.db');

const { DataError, closeStorage, modelAction } = await import('../lib/data/index.js');
const { CHOICE_DEFAULTS, SETTINGS_DEFAULTS, readChoiceFor, readChoicesFor, readSettingsFor, saveChoiceFor, saveSettingsFor } = await import('../lib/data/play.js');
const { checkChoice, checkSettings } = await import('../lib/play/limits.js');
const { canChange } = await import('../lib/play/roles.js');
const { currentOwner } = await import('../lib/play/owner.js');
const { MAX_BODY_BYTES } = await import('../lib/play/request.js');
const settingsRoute = await import('../app/api/settings/route.js');
const choicesRoute = await import('../app/api/choices/route.js');
const { GAME_IDS } = await import('../lib/play/catalog.js');
const { t } = await import('../lib/i18n/index.js');
const { bounded, measured } = await import('./records-bounds.mjs');

const PERSON = Symbol.for('tellop.person');

afterEach(() => {
  delete globalThis[PERSON];
});

after(async () => {
  await closeStorage();
  process.chdir(startedIn);
  rmSync(scratch, { recursive: true, force: true });
});

const refusedWith = (key) => (error) => error instanceof DataError && error.messageKey === key;
const owner = 'owner-a';
const settings = { soundOn: false, voiceOn: true, language: 'tr', challenge: 'normal' };

/** @param {string} address @param {unknown} body @param {string} [type] */
function post(route, address, body, type = 'application/json') {
  return route.POST(new Request(`http://app.invalid${address}`, {
    method: 'POST',
    headers: { 'content-type': type },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  }));
}

test('nothing saved reads as the defaults and creates no row', async () => {
  assert.deepEqual(await readSettingsFor(owner), SETTINGS_DEFAULTS);
  assert.deepEqual(SETTINGS_DEFAULTS, { soundOn: true, voiceOn: true, language: '', challenge: 'gentle' });
  const choices = await readChoicesFor(owner);
  assert.deepEqual(Object.keys(choices), [...GAME_IDS]);
  for (const id of GAME_IDS) assert.deepEqual(choices[id], CHOICE_DEFAULTS);
  assert.deepEqual(await readChoiceFor(owner, 'shape-box'), { level: 'normal', favourite: false });
  assert.equal(await modelAction('PlaySettings', 'count', { where: { ownerId: owner } }), 0);
  assert.equal(await modelAction('GameChoice', 'count', { where: { ownerId: owner } }), 0);
});

test('settings save, come back, and stay one owner’s', async () => {
  assert.deepEqual(await saveSettingsFor(owner, settings), settings);
  assert.deepEqual(await readSettingsFor(owner), settings);
  const changed = { ...settings, challenge: 'strict', language: '' };
  assert.deepEqual(await saveSettingsFor(owner, changed), changed);
  assert.deepEqual(await readSettingsFor(owner), changed);
  assert.deepEqual(await readSettingsFor('owner-b'), SETTINGS_DEFAULTS);
  assert.equal(await modelAction('PlaySettings', 'count', { where: { ownerId: owner } }), 1);
});

test('a game choice saves, comes back, and leaves the other games at their defaults', async () => {
  assert.deepEqual(await saveChoiceFor(owner, { gameId: 'number-pond', level: 'hard', favourite: true }), { gameId: 'number-pond', level: 'hard', favourite: true });
  assert.deepEqual(await saveChoiceFor(owner, { gameId: 'number-pond', level: 'easy', favourite: true }), { gameId: 'number-pond', level: 'easy', favourite: true });
  assert.deepEqual(await readChoiceFor(owner, 'number-pond'), { level: 'easy', favourite: true });
  const choices = await readChoicesFor(owner);
  assert.deepEqual(choices['number-pond'], { level: 'easy', favourite: true });
  assert.deepEqual(choices['shape-box'], CHOICE_DEFAULTS);
  assert.deepEqual((await readChoicesFor('owner-b'))['number-pond'], CHOICE_DEFAULTS);
  await assert.rejects(() => readChoiceFor(owner, 'not-a-game'), refusedWith('play.problem.refused'));
});

test('only the exact shapes are accepted', () => {
  assert.deepEqual(checkSettings(settings), settings);
  assert.deepEqual(checkSettings(Object.assign(Object.create(null), settings)), settings);
  for (const bad of [
    null, [], 'x', {},
    { ...settings, extra: 1 },
    { soundOn: false, voiceOn: true, language: 'tr' },
    { ...settings, soundOn: 'false' },
    { ...settings, voiceOn: 1 },
    { ...settings, language: 'de' },
    { ...settings, language: 'TR' },
    { ...settings, challenge: 'hard' },
    { ...settings, challenge: '' },
  ]) assert.throws(() => checkSettings(bad), refusedWith('play.problem.refused'));
  const choice = { gameId: 'dot-to-dot', level: 'easy', favourite: false };
  assert.deepEqual(checkChoice(choice), choice);
  for (const bad of [
    { ...choice, gameId: 'dot-to-dots' },
    { ...choice, gameId: '__proto__' },
    { ...choice, level: 'normal ' },
    { ...choice, level: 'medium' },
    { ...choice, favourite: 'yes' },
    { gameId: 'dot-to-dot', level: 'easy' },
    { ...choice, owner: 'x' },
  ]) assert.throws(() => checkChoice(bad), refusedWith('play.problem.refused'));
});

test('only the owner and a Helper save; a Member and a Viewer play without saving', () => {
  assert.equal(canChange('owner'), true);
  assert.equal(canChange('helper'), true);
  for (const role of ['member', 'viewer', 'Owner', '', null, undefined, 'admin']) assert.equal(canChange(role), false, String(role));
});

test('the settings address saves for the app’s owner and answers what was saved', async () => {
  const response = await post(settingsRoute, '/api/settings', settings);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('access-control-allow-origin'), null);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.deepEqual(await response.json(), { settings });
  assert.deepEqual(await readSettingsFor(currentOwner()), settings);
});

test('the choices address saves one game for the app’s owner', async () => {
  const choice = { gameId: 'letter-flowers', level: 'hard', favourite: true };
  const response = await post(choicesRoute, '/api/choices', choice);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { choice });
  assert.deepEqual(await readChoiceFor(currentOwner(), 'letter-flowers'), { level: 'hard', favourite: true });
});

test('a Member or a Viewer is refused with "You cannot change this." and nothing changes', async () => {
  const before = await readSettingsFor(currentOwner());
  for (const role of ['member', 'viewer']) {
    globalThis[PERSON] = async () => ({ id: `p_${'v'.repeat(22)}`, name: null, role });
    const response = await post(settingsRoute, '/api/settings', { ...settings, soundOn: !before.soundOn });
    assert.equal(response.status, 403);
    const { problem } = await response.json();
    assert.equal(problem, 'error.cannotChange');
    assert.equal(t(problem, 'en'), 'You cannot change this.');
    const choice = await post(choicesRoute, '/api/choices', { gameId: 'shape-box', level: 'hard', favourite: true });
    assert.equal(choice.status, 403);
  }
  assert.deepEqual(await readSettingsFor(currentOwner()), before);
  assert.deepEqual(await readChoiceFor(currentOwner(), 'shape-box'), CHOICE_DEFAULTS);
});

test('a host that cannot say who is asking saves nothing', async () => {
  const before = await readSettingsFor(currentOwner());
  globalThis[PERSON] = async () => { throw new Error('door closed'); };
  const response = await post(settingsRoute, '/api/settings', { ...settings, voiceOn: !before.voiceOn });
  assert.equal(response.status, 503);
  assert.equal((await response.json()).problem, 'error.storageUnreadable');
  assert.deepEqual(await readSettingsFor(currentOwner()), before);
});

test('anything but small JSON is refused before it is read, and nothing is saved', async () => {
  const before = await readSettingsFor(currentOwner());
  const flipped = { ...settings, soundOn: !before.soundOn };
  for (const [body, type] of [
    [JSON.stringify(flipped), 'text/plain'],
    [JSON.stringify(flipped), 'application/x-www-form-urlencoded'],
    ['{not json', 'application/json'],
    [JSON.stringify({ ...flipped, pad: 'x'.repeat(MAX_BODY_BYTES) }), 'application/json'],
  ]) {
    const response = await post(settingsRoute, '/api/settings', body, type);
    assert.equal(response.status, 415);
    assert.equal((await response.json()).problem, 'play.problem.refused');
  }
  const wrongShape = await post(settingsRoute, '/api/settings', { ...flipped, challenge: 'brutal' });
  assert.equal(wrongShape.status, 400);
  assert.deepEqual(await readSettingsFor(currentOwner()), before);
  const options = settingsRoute.OPTIONS();
  assert.equal(options.status, 405);
  assert.equal(options.headers.get('access-control-allow-origin'), null);
});

test('the page reads stay inside Tellop’s records bounds', async () => {
  for (const id of GAME_IDS) await saveChoiceFor(owner, { gameId: id, level: 'hard', favourite: true });
  const home = await measured(async () => {
    await readSettingsFor(owner);
    await readChoicesFor(owner);
  });
  bounded(home, 'the home page reads', 2);
  const game = await measured(async () => {
    await readSettingsFor(owner);
    await readChoiceFor(owner, 'dot-to-dot');
  });
  bounded(game, 'a game page reads', 2);
});
