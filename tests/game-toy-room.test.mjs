import assert from 'node:assert/strict';
import { test } from 'node:test';

import { COLOURS, LEVELS, RUG_RADIUS, SOLIDS, TOY_RADIUS, capitalFirst, isRight, makeRound, rugPlaces, rulesFor, toyOf } from '../lib/games/toy-room.js';

/** A seeded stand-in for Math.random. */
function seeded(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
}

test('the levels: 3 toys of 3 solids, 4 of 5, 5 of all 6; only Hard turns by itself', () => {
  assert.deepEqual(SOLIDS, ['ball', 'cube', 'cone', 'cylinder', 'pyramid', 'ring']);
  assert.deepEqual([LEVELS.easy.count, LEVELS.normal.count, LEVELS.hard.count], [3, 4, 5]);
  assert.deepEqual(LEVELS.easy.kinds, ['ball', 'cube', 'cone']);
  assert.equal(LEVELS.normal.kinds.length, 5);
  assert.deepEqual(LEVELS.hard.kinds, SOLIDS);
  assert.deepEqual([LEVELS.easy.turning, LEVELS.normal.turning, LEVELS.hard.turning], [false, false, true]);
  assert.equal(rulesFor('nope'), LEVELS.normal);
  for (const level of Object.values(LEVELS)) assert.ok(level.count <= level.kinds.length && level.count <= COLOURS);
});

test('a round: the right number of toys, different solids and colours, the asked solid there exactly once', () => {
  for (const level of ['easy', 'normal', 'hard']) {
    const random = seeded(7);
    for (let at = 0; at < 300; at += 1) {
      const round = makeRound(level, null, random);
      assert.equal(round.toys.length, LEVELS[level].count);
      assert.equal(new Set(round.toys.map((toy) => toy.kind)).size, round.toys.length);
      assert.equal(new Set(round.toys.map((toy) => toy.colour)).size, round.toys.length);
      for (const toy of round.toys) {
        assert.ok(LEVELS[level].kinds.includes(toy.kind), toy.kind);
        assert.ok(Number.isInteger(toy.colour) && toy.colour >= 0 && toy.colour < COLOURS);
      }
      assert.equal(round.toys.filter((toy) => toy.kind === round.wanted).length, 1);
    }
  }
});

test('the asked solid never repeats the last one, on every level', () => {
  for (const level of ['easy', 'normal', 'hard']) {
    const random = seeded(11);
    let previous = null;
    for (let at = 0; at < 300; at += 1) {
      const round = makeRound(level, previous, random);
      assert.notEqual(round.wanted, previous);
      previous = round.wanted;
    }
  }
});

test('every solid gets asked for on its levels, and the rolls stay in range at the edges', () => {
  for (const level of ['easy', 'normal', 'hard']) {
    const asked = new Set();
    const random = seeded(3);
    for (let at = 0; at < 400; at += 1) asked.add(makeRound(level, null, random).wanted);
    assert.deepEqual([...asked].sort(), [...LEVELS[level].kinds].sort());
  }
  // A random source that answers 0 or just under 1 still makes a whole round.
  for (const edge of [() => 0, () => 0.9999999]) {
    const round = makeRound('hard', null, edge);
    assert.equal(round.toys.length, 5);
    assert.ok(round.toys.some((toy) => toy.kind === round.wanted));
  }
});

test('a right toy, a wrong toy and an unknown id', () => {
  const round = { toys: [{ id: 'toy-0', kind: 'cone', colour: 0 }, { id: 'toy-1', kind: 'ball', colour: 1 }], wanted: 'ball' };
  assert.equal(isRight(round, 'toy-1'), true);
  assert.equal(isRight(round, 'toy-0'), false);
  assert.equal(isRight(round, 'toy-9'), false);
  assert.equal(toyOf(round, 'toy-9'), null);
  assert.equal(toyOf(round, 'toy-0')?.kind, 'cone');
});

test('the toys stand round the rug, the first at the front, never touching', () => {
  for (const count of [1, 3, 4, 5, 6]) {
    const places = rugPlaces(count);
    assert.equal(places.length, count);
    assert.ok(Math.abs(places[0].x) < 1e-9 && Math.abs(places[0].z - RUG_RADIUS) < 1e-9, 'the first toy is at the front');
    for (const place of places) assert.ok(Math.abs(Math.hypot(place.x, place.z) - RUG_RADIUS) < 1e-9);
    for (let a = 0; a < count; a += 1) {
      for (let b = a + 1; b < count; b += 1) {
        assert.ok(Math.hypot(places[a].x - places[b].x, places[a].z - places[b].z) > 2 * TOY_RADIUS, `${count}: ${a} and ${b} touch`);
      }
    }
  }
  for (const bad of [0, -1, 2.5, Number.NaN]) assert.throws(() => rugPlaces(bad), RangeError);
});

test('a filled-in word starting a sentence takes its language\'s capital', () => {
  assert.equal(capitalFirst('ball', 'en'), 'Ball');
  assert.equal(capitalFirst('ikizkenar', 'tr'), 'İkizkenar');
  assert.equal(capitalFirst('ıslak', 'tr'), 'Islak');
  assert.equal(capitalFirst('koni', 'tr'), 'Koni');
  assert.equal(capitalFirst('', 'en'), '');
});
