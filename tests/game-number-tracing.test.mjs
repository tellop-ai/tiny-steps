import assert from 'node:assert/strict';
import { test } from 'node:test';

const { LEVELS, firstGlyph, nextGlyph, rulesFor } = await import('../lib/games/number-tracing.js');
const { PATHS } = await import('../lib/games/tracing.js');
const en = (await import('../lib/i18n/locales/en.json', { with: { type: 'json' } })).default;
const tr = (await import('../lib/i18n/locales/tr.json', { with: { type: 'json' } })).default;
const { t } = await import('../lib/i18n/index.js');

test('each level draws exactly its range, edges included', () => {
  const has = (level, n) => LEVELS[level].glyphs.includes(String(n));
  // Easy 0 to 5.
  assert.equal(has('easy', -1), false);
  assert.equal(has('easy', 0), true);
  assert.equal(has('easy', 5), true);
  assert.equal(has('easy', 6), false);
  assert.equal(LEVELS.easy.glyphs.length, 6);
  // Normal 0 to 9.
  assert.equal(has('normal', 0), true);
  assert.equal(has('normal', 9), true);
  assert.equal(has('normal', 10), false);
  assert.equal(LEVELS.normal.glyphs.length, 10);
  // Hard 10 to 20.
  assert.equal(has('hard', 9), false);
  assert.equal(has('hard', 10), true);
  assert.equal(has('hard', 20), true);
  assert.equal(has('hard', 21), false);
  assert.equal(LEVELS.hard.glyphs.length, 11);
});

test('Easy has the wide path and the centre line; Hard the narrow path', () => {
  assert.equal(LEVELS.easy.path, 'wide');
  assert.equal(LEVELS.easy.guide, true);
  assert.equal(LEVELS.normal.guide, false);
  assert.equal(LEVELS.hard.path, 'narrow');
  assert.equal(LEVELS.hard.guide, false);
  for (const level of Object.values(LEVELS)) assert.ok(Object.hasOwn(PATHS, level.path));
});

test('a number never comes twice in a row', () => {
  for (const level of ['easy', 'normal', 'hard']) {
    let last = null;
    for (let n = 0; n < 300; n += 1) {
      const glyph = nextGlyph(level, last);
      assert.notEqual(glyph, last);
      assert.ok(LEVELS[level].glyphs.includes(glyph));
      last = glyph;
    }
  }
});

test('every number of a level comes up', () => {
  for (const level of ['easy', 'normal', 'hard']) {
    const seen = new Set();
    let last = null;
    for (let n = 0; n < 500; n += 1) seen.add((last = nextGlyph(level, last)));
    assert.equal(seen.size, LEVELS[level].glyphs.length, level);
  }
});

test('the first number is the one asked for only when the level has it', () => {
  assert.equal(firstGlyph('normal', '1'), '1');
  assert.equal(firstGlyph('hard', '20'), '20');
  assert.equal(firstGlyph('easy', '6', () => 0), nextGlyph('easy', null, () => 0), 'outside the level: a random one');
  assert.ok(LEVELS.easy.glyphs.includes(firstGlyph('easy', '6')));
  assert.ok(LEVELS.hard.glyphs.includes(firstGlyph('hard', '1')));
  assert.ok(LEVELS.normal.glyphs.includes(firstGlyph('normal', null)));
  assert.ok(LEVELS.normal.glyphs.includes(firstGlyph('normal', '<b>')));
});

test('an unknown level plays as normal', () => {
  assert.equal(rulesFor('impossible'), LEVELS.normal);
  assert.ok(LEVELS.normal.glyphs.includes(nextGlyph('impossible', null)));
});

test('every word of the game is in both languages, and the prompt fills for every number', () => {
  for (const part of ['prompt', 'board', 'meter', 'redo', 'skip', 'offPath', 'littlePart']) {
    assert.ok(en[`games.number-tracing.${part}`], `en ${part}`);
    assert.ok(tr[`games.number-tracing.${part}`], `tr ${part}`);
  }
  for (const level of Object.values(LEVELS)) {
    for (const n of level.glyphs) {
      for (const locale of ['en', 'tr']) {
        const line = t('games.number-tracing.prompt', locale, { n });
        assert.ok(line.includes(n) && !line.includes('{'), `${locale} ${line}`);
      }
    }
  }
});
