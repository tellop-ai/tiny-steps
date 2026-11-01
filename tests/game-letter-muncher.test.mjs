import assert from 'node:assert/strict';
import { test } from 'node:test';

const { ALPHABETS, nameOf, small } = await import('../lib/games/letters.js');
const { LEVELS, isRight, makeRound, tileOf } = await import('../lib/games/letter-muncher.js');
const en = (await import('../lib/i18n/locales/en.json', { with: { type: 'json' } })).default;
const tr = (await import('../lib/i18n/locales/tr.json', { with: { type: 'json' } })).default;

const always = (value) => () => value;
const LOWEST = always(0);
const HIGHEST = always(0.999999);

test('every level has its tile count, and only Hard shows small letters', () => {
  assert.deepEqual({ ...LEVELS.easy }, { tiles: 2, small: false });
  assert.deepEqual({ ...LEVELS.normal }, { tiles: 3, small: false });
  assert.deepEqual({ ...LEVELS.hard }, { tiles: 4, small: true });
});

test('a round has the level\'s number of distinct tiles from the language\'s alphabet, the wanted one among them', () => {
  for (const locale of ['en', 'tr']) {
    const alphabet = ALPHABETS[locale];
    for (const [name, rules] of Object.entries(LEVELS)) {
      const seen = new Set();
      for (let n = 0; n < 600; n += 1) {
        const round = makeRound(name, locale, null);
        assert.equal(round.tiles.length, rules.tiles);
        assert.equal(new Set(round.tiles.map((tile) => tile.letter)).size, rules.tiles);
        assert.equal(new Set(round.tiles.map((tile) => tile.shown)).size, rules.tiles);
        assert.equal(new Set(round.tiles.map((tile) => tile.id)).size, rules.tiles);
        assert.equal(round.tiles.filter((tile) => tile.letter === round.wanted).length, 1);
        assert.ok(alphabet.includes(round.wanted));
        for (const tile of round.tiles) {
          assert.ok(alphabet.includes(tile.letter), `${locale} ${tile.letter}`);
          assert.equal(tile.shown, rules.small ? small(tile.letter, locale) : tile.letter);
          seen.add(tile.letter);
        }
        assert.equal(round.shown, rules.small ? small(round.wanted, locale) : round.wanted);
      }
      // Every letter of the alphabet turns up, and no letter of another.
      assert.equal(seen.size, alphabet.length, `${locale} ${name}`);
    }
  }
});

test('Turkish uses its 29 letters, with Ç Ğ I İ Ö Ş Ü and never Q W X', () => {
  const seen = new Set();
  for (let n = 0; n < 800; n += 1) for (const tile of makeRound('hard', 'tr', null).tiles) seen.add(tile.letter);
  assert.equal(seen.size, 29);
  for (const letter of ['Ç', 'Ğ', 'I', 'İ', 'Ö', 'Ş', 'Ü']) assert.ok(seen.has(letter), letter);
  for (const letter of ['Q', 'W', 'X']) assert.equal(seen.has(letter), false, letter);
});

test('Hard shows Turkish small letters by Turkish rules: I as ı and İ as i', () => {
  const shown = new Map();
  for (let n = 0; n < 800; n += 1) for (const tile of makeRound('hard', 'tr', null).tiles) shown.set(tile.letter, tile.shown);
  assert.equal(shown.get('I'), 'ı');
  assert.equal(shown.get('İ'), 'i');
  assert.equal(shown.get('Ş'), 'ş');
  assert.equal(shown.get('Ğ'), 'ğ');
  const english = new Map();
  for (let n = 0; n < 400; n += 1) for (const tile of makeRound('hard', 'en', null).tiles) english.set(tile.letter, tile.shown);
  assert.equal(english.get('I'), 'i');
  assert.equal(english.get('Q'), 'q');
});

test('the wanted letter reaches each end of the alphabet, and one inside it', () => {
  for (const locale of ['en', 'tr']) {
    const alphabet = ALPHABETS[locale];
    const first = alphabet[0];
    const last = alphabet[alphabet.length - 1];
    assert.equal(makeRound('normal', locale, null, LOWEST).wanted, first);
    assert.equal(makeRound('normal', locale, null, HIGHEST).wanted, last);
    assert.equal(makeRound('normal', locale, last, HIGHEST).wanted, alphabet[alphabet.length - 2]);
    assert.equal(makeRound('normal', locale, first, LOWEST).wanted, alphabet[1]);
  }
});

test('the wanted letter never repeats the last one', () => {
  for (const locale of ['en', 'tr']) {
    for (const level of Object.keys(LEVELS)) {
      let last = null;
      for (let n = 0; n < 300; n += 1) {
        const round = makeRound(level, locale, last);
        assert.notEqual(round.wanted, last);
        last = round.wanted;
      }
    }
  }
});

test('only the tile with the wanted letter is right', () => {
  for (const locale of ['en', 'tr']) {
    const round = makeRound('hard', locale, null);
    for (const tile of round.tiles) {
      assert.equal(isRight(round, tile.id), tile.letter === round.wanted);
      assert.equal(tileOf(round, tile.id), tile);
    }
    assert.equal(isRight(round, 'nothing'), false);
  }
});

test('an unknown level plays as normal and an unknown language uses English letters', () => {
  assert.equal(makeRound('impossible', 'en', null).tiles.length, LEVELS.normal.tiles);
  for (let n = 0; n < 100; n += 1) assert.ok(ALPHABETS.en.includes(makeRound('easy', 'de', null).wanted));
});

test('the voice says a small letter\'s name, never the bare glyph', () => {
  assert.equal(nameOf(small('I', 'tr'), 'tr'), 'ı');
  assert.equal(nameOf(small('Ğ', 'tr'), 'tr'), 'yumuşak ge');
  assert.equal(nameOf(small('W', 'en'), 'en'), 'double you');
});

test('the game\'s words are in both languages and fill their letters', () => {
  for (const key of ['ask', 'yum', 'notThat', 'monster']) {
    const full = `games.letter-muncher.${key}`;
    assert.ok(en[full] && tr[full], full);
  }
  for (const words of [en, tr]) {
    assert.match(words['games.letter-muncher.ask'], /\{letter\}/u);
    assert.match(words['games.letter-muncher.yum'], /\{name\}/u);
    assert.match(words['games.letter-muncher.notThat'], /\{name\}.*\{wanted\}/u);
  }
});
