/**
 * The star meter, the game list and the picking helpers: pure rules,
 * checked at every edge.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

const { CHALLENGES, METER_START, MISS_LOSS, afterMiss, afterRight, startMeter } = await import('../lib/play/meter.js');
const { CATEGORIES, GAMES, GAME_IDS, LEVELS, gameById, gamesIn, neighbours } = await import('../lib/play/catalog.js');
const { below, pick, pickOther, range, sample, shuffle } = await import('../lib/play/random.js');

test('a run starts at 10 and playing', () => {
  assert.deepEqual(startMeter(), { value: 10, state: 'playing' });
  assert.equal(METER_START, 10);
});

test('a right answer adds the gain and wins exactly at 100, never above', () => {
  assert.deepEqual(afterRight({ value: 89, state: 'playing' }, 10), { value: 99, state: 'playing' });
  assert.deepEqual(afterRight({ value: 90, state: 'playing' }, 10), { value: 100, state: 'won' });
  assert.deepEqual(afterRight({ value: 91, state: 'playing' }, 10), { value: 100, state: 'won' });
  assert.deepEqual(afterRight({ value: 99, state: 'playing' }, 1), { value: 100, state: 'won' });
  // A gain that is not a whole number above zero moves nothing.
  for (const gain of [0, -5, 2.5, Number.NaN, '10']) assert.deepEqual(afterRight({ value: 50, state: 'playing' }, gain), { value: 50, state: 'playing' });
});

test('a miss takes the challenge loss and loses exactly at 0, never below', () => {
  assert.deepEqual(MISS_LOSS, { gentle: 0, normal: 5, strict: 10 });
  assert.deepEqual(CHALLENGES, ['gentle', 'normal', 'strict']);
  assert.deepEqual(afterMiss({ value: 10, state: 'playing' }, 'gentle'), { value: 10, state: 'playing' });
  assert.deepEqual(afterMiss({ value: 6, state: 'playing' }, 'normal'), { value: 1, state: 'playing' });
  assert.deepEqual(afterMiss({ value: 5, state: 'playing' }, 'normal'), { value: 0, state: 'lost' });
  assert.deepEqual(afterMiss({ value: 4, state: 'playing' }, 'normal'), { value: 0, state: 'lost' });
  assert.deepEqual(afterMiss({ value: 11, state: 'playing' }, 'strict'), { value: 1, state: 'playing' });
  assert.deepEqual(afterMiss({ value: 10, state: 'playing' }, 'strict'), { value: 0, state: 'lost' });
  // An unknown challenge is the kindest one.
  assert.deepEqual(afterMiss({ value: 10, state: 'playing' }, 'brutal'), { value: 10, state: 'playing' });
  assert.deepEqual(afterMiss({ value: 10, state: 'playing' }, '__proto__'), { value: 10, state: 'playing' });
});

test('a finished run does not move again', () => {
  const won = { value: 100, state: 'won' };
  const lost = { value: 0, state: 'lost' };
  assert.equal(afterRight(won, 10), won);
  assert.equal(afterMiss(won, 'strict'), won);
  assert.equal(afterRight(lost, 10), lost);
  assert.equal(afterMiss(lost, 'strict'), lost);
});

test('the gentle challenge can never lose, however many misses', () => {
  let meter = startMeter();
  for (let miss = 0; miss < 50; miss += 1) meter = afterMiss(meter, 'gentle');
  assert.deepEqual(meter, startMeter());
});

test('the catalog has fifteen games in four groups, each with words-safe ids and a gain', () => {
  assert.equal(GAMES.length, 15);
  assert.deepEqual(CATEGORIES.map((c) => c.id), ['colours', 'numbers', 'shapes', 'letters']);
  assert.deepEqual(GAMES.map((g) => g.category).filter((c, i, all) => all.indexOf(c) === i), ['colours', 'numbers', 'shapes', 'letters']);
  assert.equal(new Set(GAME_IDS).size, 15);
  for (const game of GAMES) {
    assert.match(game.id, /^[a-z]+(?:-[a-z]+)*$/u);
    assert.ok(Number.isSafeInteger(game.gain) && game.gain > 0 && game.gain <= 100 - METER_START, game.id);
    assert.ok(gamesIn(game.category).includes(game));
  }
  assert.deepEqual(LEVELS, ['easy', 'normal', 'hard']);
  assert.equal(gameById('number-pond')?.category, 'numbers');
  for (const value of ['', 'nope', null, 3, '__proto__', 'constructor']) assert.equal(gameById(value), null);
});

test('previous and next wrap round at both ends', () => {
  const last = GAME_IDS.length - 1;
  assert.deepEqual(neighbours(GAME_IDS[0]), { previous: GAME_IDS[last], next: GAME_IDS[1] });
  assert.deepEqual(neighbours(GAME_IDS[last]), { previous: GAME_IDS[last - 1], next: GAME_IDS[0] });
  assert.deepEqual(neighbours(GAME_IDS[5]), { previous: GAME_IDS[4], next: GAME_IDS[6] });
  assert.equal(neighbours('nope'), null);
});

test('picking at random stays inside the list and avoids the last answer', () => {
  const fixed = (...values) => { let at = 0; return () => values[at++ % values.length]; };
  assert.equal(below(3, fixed(0)), 0);
  assert.equal(below(3, fixed(0.999999)), 2);
  assert.equal(below(1, fixed(0.5)), 0);
  assert.throws(() => below(0));
  assert.throws(() => below(2.5));
  assert.equal(pick(['a', 'b', 'c'], fixed(0.5)), 'b');
  for (let n = 0; n < 50; n += 1) assert.notEqual(pickOther(['a', 'b', 'c'], 'b'), 'b');
  assert.equal(pickOther(['a'], 'a'), 'a');
  const shuffled = shuffle([1, 2, 3, 4, 5]);
  assert.deepEqual([...shuffled].sort(), [1, 2, 3, 4, 5]);
  assert.equal(sample([1, 2, 3], 5).length, 3);
  assert.equal(new Set(sample(range(1, 20), 6)).size, 6);
  assert.deepEqual(range(1, 3), [1, 2, 3]);
  assert.deepEqual(range(3, 2), []);
});
