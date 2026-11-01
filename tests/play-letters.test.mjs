import assert from 'node:assert/strict';
import { test } from 'node:test';

const { ALPHABETS, EXAMPLES, NAMES, alphabetFor, capital, exampleOf, nameOf, small } = await import('../lib/games/letters.js');

test('English has 26 letters and Turkish 29, with its own letters and without Q W X', () => {
  assert.equal(ALPHABETS.en.length, 26);
  assert.equal(ALPHABETS.tr.length, 29);
  for (const letter of ['Ç', 'Ğ', 'I', 'İ', 'Ö', 'Ş', 'Ü']) assert.ok(ALPHABETS.tr.includes(letter), letter);
  for (const letter of ['Q', 'W', 'X']) assert.equal(ALPHABETS.tr.includes(letter), false, letter);
  assert.equal(alphabetFor('de'), ALPHABETS.en);
});

test('every letter has a spoken name and an example in its own language', () => {
  for (const locale of ['en', 'tr']) {
    for (const letter of ALPHABETS[locale]) {
      assert.ok(NAMES[locale][letter], `${locale} ${letter} name`);
      const example = EXAMPLES[locale][letter];
      assert.ok(example?.word && example?.emoji, `${locale} ${letter} example`);
      const word = capital(example.word, locale);
      if (example.inside) assert.ok(word.includes(letter) && !word.startsWith(letter), `${locale} ${letter} inside ${example.word}`);
      else assert.ok(word.startsWith(letter), `${locale} ${letter} starts ${example.word}`);
    }
    assert.equal(Object.keys(NAMES[locale]).length, ALPHABETS[locale].length);
    assert.equal(Object.keys(EXAMPLES[locale]).length, ALPHABETS[locale].length);
  }
});

test('Turkish case follows Turkish rules: I and ı, İ and i', () => {
  assert.equal(small('I', 'tr'), 'ı');
  assert.equal(small('İ', 'tr'), 'i');
  assert.equal(capital('i', 'tr'), 'İ');
  assert.equal(capital('ı', 'tr'), 'I');
  assert.equal(small('I', 'en'), 'i');
  assert.equal(nameOf('ı', 'tr'), 'ı');
  assert.equal(nameOf('i', 'tr'), 'i');
  assert.equal(nameOf('ğ', 'tr'), 'yumuşak ge');
  assert.equal(nameOf('b', 'en'), 'bee');
  assert.equal(exampleOf('ç', 'tr')?.word, 'çilek');
  assert.equal(exampleOf('q', 'tr'), null);
});
