import assert from 'node:assert/strict';
import { test } from 'node:test';

const { SHAPE_IDS } = await import('../lib/games/shapes.js');
const belt = await import('../lib/games/shape-belt.js');
const {
  ENTRY_GAP, FEEDS_PER_GROUP, FIRST_WAIT_SECONDS, LEVELS, MARKS,
  beltSpeed, canSpawn, feeds, groupNumber, isNewGroup, makeGroup, nextKind, ridesOff, rulesFor, spawnWait,
} = belt;

test('each level has its monsters, its spawn time and its belt speed', () => {
  assert.deepEqual(
    ['easy', 'normal', 'hard'].map((level) => LEVELS[level].monsters),
    [3, 4, 5],
  );
  assert.deepEqual(
    ['easy', 'normal', 'hard'].map((level) => LEVELS[level].spawnSeconds),
    [1.7, 1.3, 1.0],
  );
  // Slow, steady, quick: the same belt runs faster each level up.
  assert.ok(beltSpeed('easy', 1000) < beltSpeed('normal', 1000));
  assert.ok(beltSpeed('normal', 1000) < beltSpeed('hard', 1000));
  assert.equal(rulesFor('impossible'), LEVELS.normal);
  assert.ok(FIRST_WAIT_SECONDS > 0 && FIRST_WAIT_SECONDS < LEVELS.hard.spawnSeconds);
});

test('the belt crosses its whole width in the level time, and an empty width stands still', () => {
  assert.equal(beltSpeed('easy', 900), 900 / LEVELS.easy.crossSeconds);
  assert.equal(beltSpeed('hard', 390), 390 / LEVELS.hard.crossSeconds);
  assert.equal(beltSpeed('normal', 0), 0);
  assert.equal(beltSpeed('normal', -5), 0);
  assert.equal(beltSpeed('normal', Number.NaN), 0);
});

test('a group has the level number of monsters, distinct mouths and distinct marks', () => {
  for (const level of ['easy', 'normal', 'hard']) {
    for (let n = 0; n < 200; n += 1) {
      const group = makeGroup(level);
      assert.equal(group.length, LEVELS[level].monsters);
      assert.equal(new Set(group.map((monster) => monster.kind)).size, group.length);
      assert.equal(new Set(group.map((monster) => monster.mark)).size, group.length);
      for (const monster of group) {
        assert.ok(SHAPE_IDS.includes(monster.kind));
        assert.ok(MARKS.includes(monster.mark));
      }
    }
  }
  assert.ok(LEVELS.hard.monsters <= MARKS.length, 'every monster can have its own mark');
});

test('a new group has a different set of mouths from the last', () => {
  let last = null;
  for (let n = 0; n < 300; n += 1) {
    const kinds = makeGroup('easy', last).map((monster) => monster.kind);
    if (last) assert.notDeepEqual([...kinds].sort(), [...last].sort());
    last = kinds;
  }
});

test('the belt carries only shapes the monsters have, never the same one twice in a row', () => {
  for (const level of ['easy', 'normal', 'hard']) {
    const kinds = makeGroup(level).map((monster) => monster.kind);
    let last = null;
    const seen = new Set();
    for (let n = 0; n < 400; n += 1) {
      const kind = nextKind(kinds, last);
      assert.ok(kinds.includes(kind), `${kind} is not a mouth`);
      assert.notEqual(kind, last);
      seen.add(kind);
      last = kind;
    }
    assert.equal(seen.size, kinds.length, 'every mouth gets shapes');
  }
  assert.equal(nextKind(['star'], 'star'), 'star', 'one monster: the same shape again');
});

test('a shape feeds only the monster with its mouth', () => {
  for (const shape of SHAPE_IDS) {
    for (const mouth of SHAPE_IDS) assert.equal(feeds(shape, mouth), shape === mouth);
  }
});

test('a new group comes after every 8 right feeds, exactly on the edge', () => {
  assert.equal(FEEDS_PER_GROUP, 8);
  assert.equal(isNewGroup(0), false);
  assert.equal(isNewGroup(1), false);
  assert.equal(isNewGroup(7), false);
  assert.equal(isNewGroup(8), true);
  assert.equal(isNewGroup(9), false);
  assert.equal(isNewGroup(15), false);
  assert.equal(isNewGroup(16), true);
  assert.equal(isNewGroup(17), false);
  assert.equal(isNewGroup(-8), false);
  assert.equal(isNewGroup(8.5), false);
  assert.equal(groupNumber(0), 1);
  assert.equal(groupNumber(7), 1);
  assert.equal(groupNumber(8), 2);
  assert.equal(groupNumber(9), 2);
  assert.equal(groupNumber(16), 3);
  assert.equal(groupNumber(-3), 1);
});

test('a shape waits about the level spawn time, from 85 % to 115 % of it', () => {
  for (const level of ['easy', 'normal', 'hard']) {
    const base = LEVELS[level].spawnSeconds;
    assert.ok(Math.abs(spawnWait(level, () => 0) - base * 0.85) < 1e-9);
    assert.ok(Math.abs(spawnWait(level, () => 0.5) - base) < 1e-9);
    assert.ok(spawnWait(level, () => 0.999999) < base * 1.15);
    for (let n = 0; n < 200; n += 1) {
      const wait = spawnWait(level);
      assert.ok(wait >= base * 0.85 && wait < base * 1.15);
    }
  }
});

test('a shape comes on only when its wait is over and the start of the belt is clear', () => {
  const size = 80;
  const clear = (ENTRY_GAP - 1) * size;
  // The wait, on its edge.
  assert.equal(canSpawn(1.29, 1.3, null, size), false);
  assert.equal(canSpawn(1.3, 1.3, null, size), true);
  assert.equal(canSpawn(1.31, 1.3, null, size), true);
  // The start of the belt, on its edge.
  assert.equal(canSpawn(5, 1.3, clear - 1, size), false);
  assert.equal(canSpawn(5, 1.3, clear, size), true);
  assert.equal(canSpawn(5, 1.3, clear + 1, size), true);
  // A shape still coming on blocks the next.
  assert.equal(canSpawn(5, 1.3, -size, size), false);
});

test('a shape rides off only once all of it is past the end', () => {
  assert.equal(ridesOff(399, 400), false);
  assert.equal(ridesOff(400, 400), false);
  assert.equal(ridesOff(401, 400), true);
  assert.equal(ridesOff(-80, 400), false);
});
