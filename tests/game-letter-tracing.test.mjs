import assert from 'node:assert/strict';
import { test } from 'node:test';

const { LEVELS, firstGlyph, glyphsFor, nextGlyph, rulesFor } = await import('../lib/games/letter-tracing.js');
const { PATHS } = await import('../lib/games/tracing.js');
const { nameOf } = await import('../lib/games/letters.js');
const en = (await import('../lib/i18n/locales/en.json', { with: { type: 'json' } })).default;
const tr = (await import('../lib/i18n/locales/tr.json', { with: { type: 'json' } })).default;
const { t } = await import('../lib/i18n/index.js');

test('Easy and Normal draw the capitals of the app language', () => {
  assert.equal(glyphsFor('easy', 'en').length, 26);
  assert.equal(glyphsFor('normal', 'tr').length, 29);
  assert.ok(glyphsFor('normal', 'en').every((letter) => letter === letter.toUpperCase()));
  for (const letter of ['Ç', 'Ğ', 'I', 'İ', 'Ö', 'Ş', 'Ü']) assert.ok(glyphsFor('easy', 'tr').includes(letter), letter);
  assert.equal(glyphsFor('normal', 'tr').includes('Q'), false);
});

test('Hard draws small letters by the language\'s own rules', () => {
  const english = glyphsFor('hard', 'en');
  assert.equal(english.length, 26);
  assert.ok(english.includes('i') && english.includes('j'));
  const turkish = glyphsFor('hard', 'tr');
  assert.equal(turkish.length, 29);
  // Turkish I is small ı (no dot), İ is small i (with a dot).
  assert.ok(turkish.includes('ı'), 'dotless ı');
  assert.ok(turkish.includes('i'), 'dotted i');
  for (const letter of ['ç', 'ğ', 'ö', 'ş', 'ü']) assert.ok(turkish.includes(letter), letter);
  assert.equal(new Set(turkish).size, 29, 'no two letters become one');
  assert.equal(turkish.includes('I'), false);
});

test('Easy has the wide path and the centre line; Hard the narrow path', () => {
  assert.equal(LEVELS.easy.path, 'wide');
  assert.equal(LEVELS.easy.guide, true);
  assert.equal(LEVELS.normal.guide, false);
  assert.equal(LEVELS.hard.path, 'narrow');
  for (const level of Object.values(LEVELS)) assert.ok(Object.hasOwn(PATHS, level.path));
});

test('a letter never comes twice in a row', () => {
  for (const locale of ['en', 'tr']) {
    for (const level of ['easy', 'normal', 'hard']) {
      let last = null;
      for (let n = 0; n < 300; n += 1) {
        const glyph = nextGlyph(level, locale, last);
        assert.notEqual(glyph, last);
        assert.ok(glyphsFor(level, locale).includes(glyph));
        last = glyph;
      }
    }
  }
});

test('the first letter is the one asked for only when the level has it', () => {
  assert.equal(firstGlyph('normal', 'en', 'I'), 'I');
  assert.equal(firstGlyph('normal', 'tr', 'İ'), 'İ');
  assert.equal(firstGlyph('hard', 'tr', 'ı'), 'ı');
  assert.ok(glyphsFor('normal', 'en').includes(firstGlyph('normal', 'en', 'Ş')), 'Ş is not English: random');
  assert.ok(glyphsFor('hard', 'en').includes(firstGlyph('hard', 'en', 'I')), 'a capital on Hard: random');
  assert.ok(glyphsFor('easy', 'tr').includes(firstGlyph('easy', 'tr', 'Q')));
  assert.ok(glyphsFor('easy', 'tr').includes(firstGlyph('easy', 'tr', null)));
});

test('an unknown level plays as normal', () => {
  assert.equal(rulesFor('impossible'), LEVELS.normal);
});

test('every word of the game is in both languages, and the prompts fill for every letter', () => {
  for (const part of ['prompt', 'promptSmall', 'board', 'meter', 'redo', 'skip', 'offPath', 'littlePart']) {
    assert.ok(en[`games.letter-tracing.${part}`], `en ${part}`);
    assert.ok(tr[`games.letter-tracing.${part}`], `tr ${part}`);
  }
  for (const locale of ['en', 'tr']) {
    for (const level of ['normal', 'hard']) {
      const key = rulesFor(level).small ? 'games.letter-tracing.promptSmall' : 'games.letter-tracing.prompt';
      for (const letter of glyphsFor(level, locale)) {
        const shown = t(key, locale, { letter });
        const spoken = t(key, locale, { letter: nameOf(letter, locale) });
        assert.ok(shown.includes(letter) && !shown.includes('{'), shown);
        assert.ok(!spoken.includes('{') && nameOf(letter, locale) !== '', spoken);
      }
    }
  }
  assert.equal(nameOf('ı', 'tr'), 'ı');
  assert.equal(nameOf('i', 'tr'), 'i');
});
