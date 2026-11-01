import assert from 'node:assert/strict';
import { test } from 'node:test';

const { HINT_MS, LEVELS, NEXT_ASK_MS, isRight, markOf, newLayout, nextHunt, rulesFor, startHunt } = await import(
  '../lib/games/number-hunt.js'
);
const en = (await import('../lib/i18n/locales/en.json', { with: { type: 'json' } })).default;
const tr = (await import('../lib/i18n/locales/tr.json', { with: { type: 'json' } })).default;

/** A fixed source of chance (mulberry32), so a failing check fails the same way every time. */
function seeded(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

/** Always the same answer from chance: 0 picks the first, just under 1 the last. */
const always = (value) => () => value;

function isBoard(layout, count) {
  return layout.length === count && [...layout].sort((a, b) => a - b).every((n, at) => n === at + 1);
}

test('each level has its number of tiles, and the waits are as the level rules say', () => {
  assert.equal(LEVELS.easy.count, 5);
  assert.equal(LEVELS.normal.count, 10);
  assert.equal(LEVELS.hard.count, 20);
  assert.equal(HINT_MS, 8000);
  assert.equal(NEXT_ASK_MS, 600);
});

test('a layout holds each number from 1 to N exactly once', () => {
  const random = seeded(1);
  for (const count of [1, 2, 4, 5, 6, 9, 10, 11, 19, 20, 21]) {
    for (let n = 0; n < 50; n += 1) assert.ok(isBoard(newLayout(count, null, random), count), `count ${count}`);
  }
});

test('a new layout never repeats the last one, even when the shuffle gives it back', () => {
  // Chance just under 1 makes the shuffle keep every place: the same order as before.
  const same = [1, 2, 3, 4, 5];
  const fresh = newLayout(5, same, always(0.999999));
  assert.ok(isBoard(fresh, 5));
  assert.notDeepEqual(fresh, same);
  // Two tiles: the only other order.
  assert.deepEqual(newLayout(2, [1, 2], always(0.999999)), [2, 1]);
  // One tile has no other order.
  assert.deepEqual(newLayout(1, [1], always(0.5)), [1]);
  const random = seeded(2);
  for (const count of [5, 10, 20]) {
    let last = newLayout(count, null, random);
    for (let n = 0; n < 200; n += 1) {
      const next = newLayout(count, last, random);
      assert.notDeepEqual(next, last);
      last = next;
    }
  }
});

test('Easy starts at 1 and asks 1 to 5 in order on one board, then 1 again on a new board', () => {
  const random = seeded(3);
  let hunt = startHunt('easy', random);
  assert.equal(hunt.wanted, 1);
  assert.ok(isBoard(hunt.layout, 5));
  for (let round = 0; round < 4; round += 1) {
    const board = hunt.layout;
    const asked = [hunt.wanted];
    for (let step = 0; step < 4; step += 1) {
      hunt = nextHunt('easy', hunt, random);
      assert.equal(hunt.layout, board, 'the board stays while the count goes up');
      asked.push(hunt.wanted);
    }
    assert.deepEqual(asked, [1, 2, 3, 4, 5]);
    hunt = nextHunt('easy', hunt, random);
    assert.equal(hunt.wanted, 1, 'after 5 comes 1');
    assert.notDeepEqual(hunt.layout, board, 'and a new layout');
    assert.ok(isBoard(hunt.layout, 5));
  }
});

test('Easy at its edge: 4 goes to 5 on the same board, 5 goes back to 1 on a new one', () => {
  const layout = [3, 1, 5, 2, 4];
  const fromFour = nextHunt('easy', { layout, wanted: 4 }, seeded(4));
  assert.deepEqual(fromFour, { layout, wanted: 5 });
  assert.equal(fromFour.layout, layout);
  const fromFive = nextHunt('easy', { layout, wanted: 5 }, seeded(4));
  assert.equal(fromFive.wanted, 1);
  assert.notDeepEqual(fromFive.layout, layout);
});

test('Normal asks at random, never the same number twice in a row, on the same board', () => {
  const random = seeded(5);
  let hunt = startHunt('normal', random);
  const board = hunt.layout;
  const asked = new Set([hunt.wanted]);
  for (let n = 0; n < 500; n += 1) {
    const next = nextHunt('normal', hunt, random);
    assert.notEqual(next.wanted, hunt.wanted);
    assert.ok(next.wanted >= 1 && next.wanted <= 10);
    assert.equal(next.layout, board);
    asked.add(next.wanted);
    hunt = next;
  }
  assert.equal(asked.size, 10, 'every number from 1 to 10 is asked in time');
});

test('Hard asks at random, never twice in a row, and the tiles change places after each find', () => {
  const random = seeded(6);
  let hunt = startHunt('hard', random);
  assert.ok(isBoard(hunt.layout, 20));
  const asked = new Set([hunt.wanted]);
  for (let n = 0; n < 500; n += 1) {
    const next = nextHunt('hard', hunt, random);
    assert.notEqual(next.wanted, hunt.wanted);
    assert.ok(next.wanted >= 1 && next.wanted <= 20);
    assert.ok(isBoard(next.layout, 20));
    assert.notDeepEqual(next.layout, hunt.layout);
    asked.add(next.wanted);
    hunt = next;
  }
  assert.equal(asked.size, 20);
});

test('a random first ask reaches both ends of the range, and only them', () => {
  for (const level of ['normal', 'hard']) {
    const count = LEVELS[level].count;
    assert.equal(startHunt(level, always(0)).wanted, 1);
    assert.equal(startHunt(level, always(0.999999)).wanted, count);
    // The next ask from the top number at the lowest chance is 1; from 1 at the highest chance, the top.
    assert.equal(nextHunt(level, { layout: newLayout(count, null), wanted: count }, always(0)).wanted, 1);
    assert.equal(nextHunt(level, { layout: newLayout(count, null), wanted: 1 }, always(0.999999)).wanted, count);
  }
});

test('only the wanted number is right', () => {
  const hunt = { layout: [2, 1, 3], wanted: 2 };
  assert.equal(isRight(hunt, 2), true);
  assert.equal(isRight(hunt, 1), false);
  assert.equal(isRight(hunt, 3), false);
  assert.equal(isRight(hunt, '2'), false);
});

test('an unknown level plays as normal', () => {
  assert.equal(rulesFor('impossible'), LEVELS.normal);
  assert.equal(startHunt('impossible').layout.length, 10);
});

test('tile edges take the five marks in turn', () => {
  assert.equal(markOf(1), 'chart-1');
  assert.equal(markOf(4), 'chart-4');
  assert.equal(markOf(5), 'chart-5');
  assert.equal(markOf(6), 'chart-1');
  assert.equal(markOf(10), 'chart-5');
  assert.equal(markOf(11), 'chart-1');
  assert.equal(markOf(20), 'chart-5');
});

test('the game has its words in both languages, and Turkish puts no ending after the number', () => {
  for (const key of ['prompt', 'found', 'notThat', 'board']) {
    assert.ok(en[`games.number-hunt.${key}`], `en ${key}`);
    assert.ok(tr[`games.number-hunt.${key}`], `tr ${key}`);
  }
  for (const key of ['prompt', 'found', 'notThat']) {
    for (const words of [en, tr]) assert.match(words[`games.number-hunt.${key}`], /\{n\}/u);
    assert.doesNotMatch(tr[`games.number-hunt.${key}`], /\{n\}['’]?[a-zçğıöşü]/iu, key);
  }
});
