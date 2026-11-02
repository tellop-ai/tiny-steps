import assert from 'node:assert/strict';
import { test } from 'node:test';

const { LEVELS, isRight, makeRound, tileOf } = await import('../lib/games/hungry-hedgehog.js');
const en = (await import('../lib/i18n/locales/en.json', { with: { type: 'json' } })).default;
const tr = (await import('../lib/i18n/locales/tr.json', { with: { type: 'json' } })).default;

/** A source of chance that always answers the same number. */
const always = (value) => () => value;
const LOWEST = always(0);
const HIGHEST = always(0.999999);

test('every level has its range and tray size', () => {
  assert.deepEqual({ ...LEVELS.easy }, { low: 1, high: 5, tiles: 4 });
  assert.deepEqual({ ...LEVELS.normal }, { low: 1, high: 10, tiles: 6 });
  assert.deepEqual({ ...LEVELS.hard }, { low: 1, high: 20, tiles: 8 });
  for (const level of Object.values(LEVELS)) assert.ok(level.tiles <= level.high - level.low + 1);
});

test('a round has exactly the level\'s number of distinct tiles, the wanted one among them, all in range', () => {
  for (const [name, rules] of Object.entries(LEVELS)) {
    const seen = new Set();
    for (let n = 0; n < 400; n += 1) {
      const round = makeRound(name, null);
      assert.equal(round.tiles.length, rules.tiles);
      assert.equal(new Set(round.tiles.map((tile) => tile.value)).size, rules.tiles);
      assert.equal(new Set(round.tiles.map((tile) => tile.id)).size, rules.tiles);
      assert.equal(round.tiles.filter((tile) => tile.value === round.wanted).length, 1);
      for (const tile of round.tiles) {
        assert.ok(Number.isInteger(tile.value));
        assert.ok(tile.value >= rules.low && tile.value <= rules.high, `${name} ${tile.value}`);
        seen.add(tile.value);
      }
    }
    // Both edges of the range turn up, and nothing one step outside it.
    assert.ok(seen.has(rules.low) && seen.has(rules.high), name);
    assert.equal(seen.has(rules.low - 1), false);
    assert.equal(seen.has(rules.high + 1), false);
    assert.equal(seen.size, rules.high - rules.low + 1);
  }
});

test('the wanted number reaches each edge of the range exactly, and one inside it', () => {
  for (const [name, rules] of Object.entries(LEVELS)) {
    assert.equal(makeRound(name, null, LOWEST).wanted, rules.low);
    assert.equal(makeRound(name, null, HIGHEST).wanted, rules.high);
    // With the top edge just asked, the highest chance gives the number one below it.
    assert.equal(makeRound(name, rules.high, HIGHEST).wanted, rules.high - 1);
    // With the bottom edge just asked, the lowest chance gives the number one above it.
    assert.equal(makeRound(name, rules.low, LOWEST).wanted, rules.low + 1);
  }
});

test('the wanted number never repeats the last one', () => {
  for (const level of Object.keys(LEVELS)) {
    let last = null;
    for (let n = 0; n < 300; n += 1) {
      const round = makeRound(level, last);
      assert.notEqual(round.wanted, last);
      last = round.wanted;
    }
  }
});

test('only the tile with the wanted number is right', () => {
  const round = makeRound('hard', null);
  for (const tile of round.tiles) {
    assert.equal(isRight(round, tile.id), tile.value === round.wanted);
    assert.equal(tileOf(round, tile.id), tile);
  }
  assert.equal(isRight(round, 'nothing'), false);
  assert.equal(tileOf(round, 'nothing'), null);
});

test('an unknown level plays as normal', () => {
  const round = makeRound('impossible', null);
  assert.equal(round.tiles.length, LEVELS.normal.tiles);
  assert.ok(round.wanted >= 1 && round.wanted <= 10);
});

test('the game\'s words are in both languages and fill their numbers', () => {
  for (const key of ['prompt', 'notThat', 'hedgehog', 'tile']) {
    const full = `games.hungry-hedgehog.${key}`;
    assert.ok(en[full] && tr[full], full);
  }
  for (const words of [en, tr]) {
    assert.match(words['games.hungry-hedgehog.prompt'], /\{n\}/u);
    assert.match(words['games.hungry-hedgehog.notThat'], /\{m\}.*\{n\}/u);
    assert.match(words['games.hungry-hedgehog.tile'], /\{n\}/u);
  }
});
