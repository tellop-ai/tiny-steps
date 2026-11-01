import assert from 'node:assert/strict';
import { test } from 'node:test';

const { SHAPE_IDS } = await import('../lib/games/shapes.js');
const { LEVELS, MARKS, fits, isFull, makeRound, shapeCount } = await import('../lib/games/shape-box.js');

/** A fixed source of chance that always answers the same number. */
const always = (value) => () => value;

test('each level plays with its own number of shapes', () => {
  assert.equal(shapeCount('easy'), 3);
  assert.equal(shapeCount('normal'), 4);
  assert.equal(shapeCount('hard'), 6);
  assert.equal(shapeCount('impossible'), 4, 'an unknown level plays as normal');
  assert.equal(LEVELS.hard.shapes <= SHAPE_IDS.length, true);
});

test('a round has distinct shapes, the same in the holes and the tray, each piece a mark', () => {
  for (const level of ['easy', 'normal', 'hard']) {
    for (let n = 0; n < 200; n += 1) {
      const round = makeRound(level);
      const count = LEVELS[level].shapes;
      assert.equal(round.holes.length, count);
      assert.equal(new Set(round.holes).size, count, 'holes are distinct');
      for (const hole of round.holes) assert.ok(SHAPE_IDS.includes(hole));
      assert.equal(round.pieces.length, count);
      assert.deepEqual(round.pieces.map((piece) => piece.kind).sort(), [...round.holes].sort());
      assert.equal(new Set(round.pieces.map((piece) => piece.id)).size, count, 'piece ids are distinct');
      for (const piece of round.pieces) assert.ok(MARKS.includes(piece.mark));
      // Marks repeat only once all five are used.
      assert.equal(new Set(round.pieces.map((piece) => piece.mark)).size, Math.min(count, MARKS.length));
    }
  }
});

test('the tray is never in the same order as the holes', () => {
  for (const level of ['easy', 'normal', 'hard']) {
    for (let n = 0; n < 300; n += 1) {
      const round = makeRound(level);
      assert.notDeepEqual(round.pieces.map((piece) => piece.kind), round.holes);
    }
  }
  // Even a source of chance that never changes cannot line them up.
  const stuck = makeRound('easy', null, always(0));
  assert.notDeepEqual(stuck.pieces.map((piece) => piece.kind), stuck.holes);
});

test('a new round is not the same set of shapes as the last one', () => {
  let last = null;
  for (let n = 0; n < 300; n += 1) {
    const round = makeRound('easy', last);
    if (last) assert.notDeepEqual([...round.holes].sort(), [...last].sort());
    last = round.holes;
  }
});

test('a piece fits only the hole of its own shape', () => {
  const round = makeRound('hard');
  for (const piece of round.pieces) {
    for (const hole of round.holes) assert.equal(fits(round, piece.id, hole), piece.kind === hole);
  }
  assert.equal(fits(round, 'nothing', round.holes[0]), false);
  const missing = SHAPE_IDS.find((id) => !round.holes.includes(id));
  assert.equal(fits(round, round.pieces[0].id, missing), false, 'a shape with no hole fits nowhere');
});

test('the box is full only when every hole is filled', () => {
  const round = makeRound('normal');
  const filled = [];
  for (const hole of round.holes) {
    assert.equal(isFull(round, filled), false, `${filled.length} of ${round.holes.length}`);
    filled.push(hole);
  }
  assert.equal(isFull(round, filled), true);
  assert.equal(isFull(round, filled.slice(0, -1)), false, 'one short');
});
