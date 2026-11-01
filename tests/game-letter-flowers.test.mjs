import assert from 'node:assert/strict';
import { test } from 'node:test';

const { ALPHABETS, EXAMPLES, small } = await import('../lib/games/letters.js');
const {
  FULL_BLOOM, GROUND_Y, HEAD_BIGGEST, HEAD_SMALLEST, LEVELS, PETALS_FEWEST, PETALS_MOST, SMALL_LOOK_ALIKE, STEM_SHORTEST, STEM_TALLEST,
  growth, isRight, makeRound, splitWord,
} = await import('../lib/games/letter-flowers.js');

/** A fixed source of chance (a small linear congruential sequence), so a run is the same every time. */
function seeded(seed) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
}

const LOCALES = ['en', 'tr'];
const LEVEL_IDS = ['easy', 'normal', 'hard'];

test('each level has its tile count and letter case: 4 capitals, 6 capitals with a word, 9 small letters', () => {
  assert.deepEqual(LEVELS.easy, { tiles: 4, small: false, example: false });
  assert.deepEqual(LEVELS.normal, { tiles: 6, small: false, example: true });
  assert.deepEqual(LEVELS.hard, { tiles: 9, small: true, example: false });
  for (const locale of LOCALES) for (const level of LEVEL_IDS) assert.ok(LEVELS[level].tiles <= ALPHABETS[locale].length);
});

test('a round has distinct tiles of its own alphabet, exactly one of them the wanted letter, in the level\'s case', () => {
  const random = seeded(7);
  for (const locale of LOCALES) {
    const alphabet = ALPHABETS[locale];
    for (const level of LEVEL_IDS) {
      for (let n = 0; n < 300; n += 1) {
        const round = makeRound(level, locale, null, random);
        assert.equal(round.tiles.length, LEVELS[level].tiles);
        assert.ok(alphabet.includes(round.letter));
        assert.equal(round.tiles.filter((tile) => tile.letter === round.letter).length, 1);
        assert.equal(new Set(round.tiles.map((tile) => tile.letter)).size, round.tiles.length);
        assert.equal(new Set(round.tiles.map((tile) => tile.glyph)).size, round.tiles.length, 'glyphs differ');
        assert.equal(new Set(round.tiles.map((tile) => tile.id)).size, round.tiles.length);
        for (const tile of round.tiles) {
          assert.ok(alphabet.includes(tile.letter), `${tile.letter} is in the ${locale} alphabet`);
          assert.equal(tile.glyph, LEVELS[level].small ? small(tile.letter, locale) : tile.letter);
        }
        assert.equal(round.glyph, LEVELS[level].small ? small(round.letter, locale) : round.letter);
      }
    }
  }
});

test('the wanted letter is never the same twice in a row, at every level and in both alphabets', () => {
  const random = seeded(11);
  for (const locale of LOCALES) {
    for (const level of LEVEL_IDS) {
      let last = null;
      for (let n = 0; n < 500; n += 1) {
        const round = makeRound(level, locale, last, random);
        assert.notEqual(round.letter, last);
        last = round.letter;
      }
    }
  }
  // Even when chance always says "the first one", and when the last letter comes in the small case.
  const first = () => 0;
  assert.equal(makeRound('easy', 'en', null, first).letter, 'A');
  assert.equal(makeRound('easy', 'en', 'A', first).letter, 'B');
  assert.equal(makeRound('hard', 'en', 'a', first).letter, 'B');
  assert.equal(makeRound('hard', 'tr', 'i', () => 0.99).letter, 'Z');
  assert.notEqual(makeRound('hard', 'tr', 'i', seeded(3)).letter, 'İ');
});

test('every letter of both alphabets is asked for sometimes, Ğ and Q included', () => {
  for (const locale of LOCALES) {
    const random = seeded(5);
    const asked = new Set();
    let last = null;
    for (let n = 0; n < 3000; n += 1) {
      last = makeRound('normal', locale, last, random).letter;
      asked.add(last);
    }
    assert.deepEqual([...asked].sort(), [...ALPHABETS[locale]].sort());
  }
});

test('chance at its extremes still makes a valid round', () => {
  for (const random of [() => 0, () => 0.999999999]) {
    for (const locale of LOCALES) {
      for (const level of LEVEL_IDS) {
        const round = makeRound(level, locale, null, random);
        assert.equal(new Set(round.tiles.map((tile) => tile.glyph)).size, LEVELS[level].tiles);
        assert.equal(round.tiles.filter((tile) => tile.letter === round.letter).length, 1);
      }
    }
  }
});

test('Turkish small letters keep I and İ apart: ı and i', () => {
  const smalls = ALPHABETS.tr.map((letter) => small(letter, 'tr'));
  assert.equal(new Set(smalls).size, ALPHABETS.tr.length);
  assert.ok(smalls.includes('ı') && smalls.includes('i'));
  // With chance picking the last letter for the wanted one, Turkish hard shows small z, never a lone capital.
  const round = makeRound('hard', 'tr', null, () => 0.999999999);
  assert.equal(round.letter, 'Z');
  assert.equal(round.glyph, 'z');
});

test('a round of small letters never shows l and ı together, and both are still asked for', () => {
  assert.deepEqual(SMALL_LOOK_ALIKE.map((pair) => [...pair]), [['l', 'ı']]);
  const random = seeded(13);
  const asked = new Set();
  let last = null;
  let lOrDotless = 0;
  for (let n = 0; n < 4000; n += 1) {
    const round = makeRound('hard', 'tr', last, random);
    const glyphs = round.tiles.map((tile) => tile.glyph);
    assert.ok(!(glyphs.includes('l') && glyphs.includes('ı')), glyphs.join(' '));
    assert.equal(round.tiles.length, 9);
    if (glyphs.includes('l') || glyphs.includes('ı')) lOrDotless += 1;
    asked.add(round.letter);
    last = round.letter;
  }
  assert.ok(asked.has('L') && asked.has('I'));
  assert.ok(lOrDotless > 0);
  // Capitals keep their own look: L and I may share a round (I has no look-alike among capitals).
  let together = 0;
  for (let n = 0; n < 2000; n += 1) {
    const letters = makeRound('normal', 'tr', null, random).tiles.map((tile) => tile.letter);
    if (letters.includes('L') && letters.includes('I')) together += 1;
  }
  assert.ok(together > 0);
});

test('only Normal shows the example word, and every letter in both alphabets has one', () => {
  for (const locale of LOCALES) {
    for (const letter of ALPHABETS[locale]) {
      const pick = () => ALPHABETS[locale].indexOf(letter) / ALPHABETS[locale].length + 1e-9;
      const round = makeRound('normal', locale, null, pick);
      assert.equal(round.letter, letter);
      assert.deepEqual(round.example, EXAMPLES[locale][letter]);
      assert.equal(makeRound('easy', locale, null, pick).example, null);
      assert.equal(makeRound('hard', locale, null, pick).example, null);
    }
  }
});

test('the example word splits around its letter for every example, start or inside', () => {
  for (const locale of LOCALES) {
    for (const letter of ALPHABETS[locale]) {
      const { word, inside } = EXAMPLES[locale][letter];
      const parts = splitWord(word, letter, locale);
      assert.equal(parts.before + parts.match + parts.after, word);
      assert.equal(parts.match, small(letter, locale), `${locale} ${letter} in ${word}`);
      assert.equal(parts.before === '', !inside, `${locale} ${letter}: starts with it unless marked inside`);
    }
  }
  assert.deepEqual(splitWord('fox', 'X', 'en'), { before: 'fo', match: 'x', after: '' });
  assert.deepEqual(splitWord('dağ', 'Ğ', 'tr'), { before: 'da', match: 'ğ', after: '' });
  assert.deepEqual(splitWord('ışık', 'I', 'tr'), { before: '', match: 'ı', after: 'şık' });
  assert.deepEqual(splitWord('inek', 'İ', 'tr'), { before: '', match: 'i', after: 'nek' });
  assert.deepEqual(splitWord('moon', 'Z', 'en'), { before: 'moon', match: '', after: '' });
});

test('only the tile with the wanted letter is right', () => {
  const round = makeRound('hard', 'tr', null, seeded(9));
  for (const tile of round.tiles) assert.equal(isRight(round, tile.id), tile.letter === round.letter);
  assert.equal(isRight(round, 'nothing'), false);
});

test('an unknown level plays as Normal and an unknown language uses the English alphabet', () => {
  const round = makeRound('impossible', 'fr', null, seeded(2));
  assert.equal(round.tiles.length, LEVELS.normal.tiles);
  assert.ok(round.example !== null);
  for (const tile of round.tiles) assert.ok(ALPHABETS.en.includes(tile.letter));
});

test('the flower starts as a bud: 4 petals in chart-2, the shortest stem, the smallest head, no leaves', () => {
  for (const rights of [0, -1, -50, Number.NaN, Number.POSITIVE_INFINITY * -1, undefined, null]) {
    const bud = growth(/** @type {any} */ (rights));
    assert.equal(bud.stage, 0, String(rights));
    assert.equal(bud.petals, PETALS_FEWEST);
    assert.equal(bud.stem, STEM_SHORTEST);
    assert.equal(bud.headY, GROUND_Y - STEM_SHORTEST);
    assert.equal(bud.head, HEAD_SMALLEST);
    assert.equal(bud.mark, 'chart-2');
    assert.equal(bud.leaves, 0);
  }
  assert.equal(PETALS_FEWEST, 4);
  assert.equal(PETALS_MOST, 12);
});

test('each right answer adds one petal, from 4 up to 12 at full bloom and no further', () => {
  assert.equal(FULL_BLOOM, PETALS_MOST - PETALS_FEWEST);
  for (let rights = 0; rights <= FULL_BLOOM; rights += 1) assert.equal(growth(rights).petals, 4 + rights);
  assert.equal(growth(FULL_BLOOM - 1).petals, 11);
  assert.equal(growth(FULL_BLOOM).petals, 12);
  assert.equal(growth(FULL_BLOOM + 1).petals, 12);
  assert.equal(growth(1000).petals, 12);
  assert.equal(growth(Number.POSITIVE_INFINITY).stage, 0, 'not a whole number counts as none');
  assert.equal(growth(2.9).stage, 2, 'part of an answer does not count');
});

test('the stem rises and the head grows at every stage, ending tallest and biggest', () => {
  for (let rights = 1; rights <= FULL_BLOOM; rights += 1) {
    const before = growth(rights - 1);
    const now = growth(rights);
    assert.ok(now.stem > before.stem, `stem at ${rights}`);
    assert.ok(now.headY < before.headY, `head rises at ${rights}`);
    assert.ok(now.head > before.head, `head at ${rights}`);
  }
  const bloom = growth(FULL_BLOOM);
  assert.equal(bloom.stem, STEM_TALLEST);
  assert.equal(bloom.head, HEAD_BIGGEST);
  assert.deepEqual(growth(FULL_BLOOM + 1), bloom);
  // The full flower stays inside its drawing (x 25 to 175, y from 0), even at the top of its pop (x1.12):
  // the petal tips reach 50 units out from the head's centre at x 100.
  const reach = 50 * bloom.head * 1.12;
  assert.ok(bloom.headY - reach >= 0);
  assert.ok(100 - reach >= 25 && 100 + reach <= 175);
});

test('the petal mark moves chart-2, then chart-1 from 3 right, then chart-5 from 6 right', () => {
  assert.equal(growth(2).mark, 'chart-2');
  assert.equal(growth(3).mark, 'chart-1');
  assert.equal(growth(4).mark, 'chart-1');
  assert.equal(growth(5).mark, 'chart-1');
  assert.equal(growth(6).mark, 'chart-5');
  assert.equal(growth(7).mark, 'chart-5');
  assert.equal(growth(FULL_BLOOM + 1).mark, 'chart-5');
});

test('leaves come at 2 and 5 right answers', () => {
  assert.equal(growth(1).leaves, 0);
  assert.equal(growth(2).leaves, 1);
  assert.equal(growth(4).leaves, 1);
  assert.equal(growth(5).leaves, 2);
  assert.equal(growth(6).leaves, 2);
});

test('the petals go evenly round the head', () => {
  for (let rights = 0; rights <= FULL_BLOOM; rights += 1) {
    const { angles, petals } = growth(rights);
    assert.equal(angles.length, petals);
    assert.equal(angles[0], 0);
    for (const [index, angle] of angles.entries()) assert.ok(Math.abs(angle - (index * 360) / petals) < 0.1);
  }
  assert.deepEqual(growth(0).angles, [0, 90, 180, 270]);
});
