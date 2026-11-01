import assert from 'node:assert/strict';
import { test } from 'node:test';

const {
  ANIMALS, ANIMAL_IDS, ANSWER_SPREAD, LEVELS, MAX_ANIMALS, MAX_ENTRY_MS, MAX_GAP_MS, MAX_SIZE, WALK_MS,
  entryPlan, makeAnswers, makeRound, meadowSpots, rulesFor, scaleMeadow,
} = await import('../lib/games/animal-count.js');
const en = (await import('../lib/i18n/locales/en.json', { with: { type: 'json' } })).default;
const tr = (await import('../lib/i18n/locales/tr.json', { with: { type: 'json' } })).default;

/** A repeatable source of chance (mulberry32). */
function seeded(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let x = state;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

/** A source of chance that always answers one value. */
const always = (value) => () => value;

/** Meadow sizes measured on the play screen, in CSS pixels. */
const PHONE = { width: 340, height: 430 };
const LAPTOP = { width: 1180, height: 400 };
/** The smallest tap target a small finger hits well: 3.5rem. */
const SMALLEST_TARGET = 56;

test('each level counts up to its most and offers its number of answers', () => {
  assert.equal(LEVELS.easy.most, 5);
  assert.equal(LEVELS.easy.answers, 3);
  assert.equal(LEVELS.normal.most, 10);
  assert.equal(LEVELS.normal.answers, 4);
  assert.equal(LEVELS.hard.most, 20);
  assert.equal(LEVELS.hard.answers, 4);
  assert.equal(rulesFor('impossible'), LEVELS.normal);
});

test('a round brings 1 to the level most, never fewer and never more', () => {
  for (const level of ['easy', 'normal', 'hard']) {
    const most = LEVELS[level].most;
    // The edges: the lowest and the highest chance.
    assert.equal(makeRound(level, null, always(0)).count, 1);
    assert.equal(makeRound(level, null, always(0.999999)).count, most);
    const random = seeded(7);
    const seen = new Set();
    for (let n = 0; n < 2000; n += 1) {
      const round = makeRound(level, null, random);
      assert.ok(round.count >= 1 && round.count <= most, `${level} ${round.count}`);
      seen.add(round.count);
    }
    assert.equal(seen.size, most, `${level} reaches every count`);
  }
});

test('the animal kind never comes twice in a row', () => {
  const random = seeded(11);
  let last = null;
  for (let n = 0; n < 500; n += 1) {
    const round = makeRound('normal', last, random);
    assert.notEqual(round.animal, last);
    assert.ok(ANIMAL_IDS.includes(round.animal));
    last = round.animal;
  }
  assert.notEqual(makeRound('easy', 'dog', always(0)).animal, 'dog');
});

test('answers are distinct whole numbers of at least 1, within 3, rising, the right one among them', () => {
  const random = seeded(3);
  for (const size of [3, 4]) {
    for (let count = 1; count <= 20; count += 1) {
      for (let n = 0; n < 60; n += 1) {
        const answers = makeAnswers(count, size, random);
        assert.equal(answers.length, size, `${count} ${size}`);
        assert.equal(new Set(answers).size, size);
        assert.ok(answers.includes(count));
        for (const value of answers) {
          assert.ok(Number.isSafeInteger(value) && value >= 1, `${value}`);
          assert.ok(Math.abs(value - count) <= ANSWER_SPREAD, `${value} near ${count}`);
        }
        assert.deepEqual(answers, [...answers].sort((a, b) => a - b));
      }
    }
  }
  // At the bottom edge there is exactly room for four: 1 to 4.
  assert.deepEqual(makeAnswers(1, 4, random), [1, 2, 3, 4]);
  assert.throws(() => makeAnswers(0, 3), RangeError);
});

test('a round carries answers of its level size', () => {
  const random = seeded(5);
  for (const level of ['easy', 'normal', 'hard']) {
    for (let n = 0; n < 200; n += 1) {
      const round = makeRound(level, null, random);
      assert.equal(round.answers.length, LEVELS[level].answers);
      assert.ok(round.answers.includes(round.count));
    }
  }
});

test('the walk-in takes at most about 4 s in all, the animals one after another', () => {
  for (const count of [0, 1, 2, 5, 9, 10, 11, 19, 20, 21]) {
    const plan = entryPlan(count);
    assert.equal(plan.delays.length, count);
    assert.ok(plan.totalMs <= MAX_ENTRY_MS && MAX_ENTRY_MS <= 4000, `${count}: ${plan.totalMs}`);
    if (count > 0) {
      assert.equal(plan.delays[0], 0);
      assert.equal(plan.totalMs, plan.delays[count - 1] + WALK_MS);
    }
    for (let at = 1; at < count; at += 1) {
      const gap = plan.delays[at] - plan.delays[at - 1];
      assert.ok(gap > 0 && gap <= MAX_GAP_MS + 1, `${count}: gap ${gap}`);
    }
  }
  assert.equal(entryPlan(1).totalMs, WALK_MS);
  assert.equal(entryPlan(0).totalMs, 0);
  assert.throws(() => entryPlan(-1), RangeError);
});

/** Checks one layout: right count, inside the box, spaced, big enough. */
function checkMeadow(count, box, layout) {
  const { size, spacing, spots } = layout;
  assert.equal(spots.length, count);
  if (count === 0) return;
  assert.ok(size > 0 && size <= MAX_SIZE, `size ${size}`);
  assert.ok(spacing >= size, 'spacing never below the size');
  for (const spot of spots) {
    assert.ok(spot.x - size / 2 >= -1e-9 && spot.x + size / 2 <= box.width + 1e-9, `x ${spot.x} in ${box.width}`);
    assert.ok(spot.y - size / 2 >= -1e-9 && spot.y + size / 2 <= box.height + 1e-9, `y ${spot.y} in ${box.height}`);
    assert.equal(spot.from, spot.x < box.width / 2 ? 'left' : 'right');
  }
  for (let a = 0; a < spots.length; a += 1) {
    for (let b = a + 1; b < spots.length; b += 1) {
      const apart = Math.hypot(spots[a].x - spots[b].x, spots[a].y - spots[b].y);
      assert.ok(apart >= spacing - 1e-9, `${count} in ${box.width}x${box.height}: ${apart} < ${spacing}`);
    }
  }
}

test('the meadow keeps 1, 5, 10 and 20 animals inside and apart, at phone and laptop sizes', () => {
  for (const box of [PHONE, LAPTOP]) {
    for (const count of [1, 5, 10, 20]) {
      const random = seeded(count * 31 + box.width);
      for (let n = 0; n < 300; n += 1) checkMeadow(count, box, meadowSpots(count, box, random));
      // The extremes of chance still land inside and apart.
      checkMeadow(count, box, meadowSpots(count, box, always(0)));
      checkMeadow(count, box, meadowSpots(count, box, always(0.999999)));
      // Every animal stays a big enough target, even twenty on a phone.
      assert.ok(meadowSpots(count, box).size >= SMALLEST_TARGET, `${count} on ${box.width}: ${meadowSpots(count, box).size}`);
    }
  }
});

test('the meadow takes every count a level can bring, and odd boxes', () => {
  for (let count = 0; count <= 21; count += 1) {
    for (const box of [PHONE, LAPTOP, { width: 300, height: 300 }, { width: 2000, height: 120 }, { width: 120, height: 900 }]) {
      checkMeadow(count, box, meadowSpots(count, box, seeded(count)));
    }
  }
  checkMeadow(MAX_ANIMALS, LAPTOP, meadowSpots(MAX_ANIMALS, LAPTOP, seeded(1)));
});

test('a roomy meadow draws the animals no bigger than the largest size', () => {
  assert.equal(meadowSpots(1, LAPTOP).size, MAX_SIZE);
  assert.equal(meadowSpots(1, PHONE).size, MAX_SIZE);
});

test('the meadow refuses counts and boxes it cannot lay out', () => {
  assert.throws(() => meadowSpots(-1, LAPTOP), RangeError);
  assert.throws(() => meadowSpots(1.5, LAPTOP), RangeError);
  assert.throws(() => meadowSpots(MAX_ANIMALS + 1, LAPTOP), RangeError);
  assert.throws(() => meadowSpots(3, { width: 0, height: 400 }), RangeError);
  assert.throws(() => meadowSpots(3, { width: 400, height: -1 }), RangeError);
  assert.throws(() => meadowSpots(3, { width: Number.NaN, height: 400 }), RangeError);
  assert.throws(() => meadowSpots(3, null), RangeError);
  assert.deepEqual(meadowSpots(0, LAPTOP), { size: 0, spacing: 0, spots: [] });
});

test('every animal is named for one and for several, in both languages', () => {
  assert.equal(ANIMAL_IDS.length, 12);
  assert.equal(new Set(Object.values(ANIMALS)).size, ANIMAL_IDS.length);
  for (const id of ANIMAL_IDS) {
    for (const form of ['one', 'many']) {
      const key = `games.animal-count.${form}.${id}`;
      assert.ok(en[key] && tr[key], key);
    }
  }
  // The question uses the English plural and the Turkish singular after "kaç tane".
  assert.match(en['games.animal-count.ask'], /\{many\}/u);
  assert.match(tr['games.animal-count.ask'], /\{one\}/u);
  // While they walk in, the line names no animal and no number: a plural would be
  // wrong for one animal, and a singular would give the answer away.
  for (const words of [en, tr]) {
    assert.doesNotMatch(words['games.animal-count.watch'], /\{(one|many)\}/u);
  }
});

test('a resized meadow keeps every animal inside and apart', () => {
  assert.equal(typeof scaleMeadow, 'function');
  const boxes = [PHONE, LAPTOP, { width: 300, height: 260 }, { width: 1280, height: 520 }, { width: 340, height: 380 }];
  for (const from of boxes) {
    for (const to of boxes) {
      for (const count of [1, 5, 10, 20]) {
        const layout = meadowSpots(count, from, seeded(count + from.width));
        checkMeadow(count, to, scaleMeadow(layout, from, to));
      }
    }
  }
  // The prompt growing by one line shrinks the meadow a little: the animals barely move.
  const before = meadowSpots(10, PHONE, seeded(2));
  const after = scaleMeadow(before, PHONE, { width: PHONE.width, height: PHONE.height - 30 });
  for (const [at, spot] of after.spots.entries()) assert.ok(Math.abs(spot.y - before.spots[at].y) <= 30);
  assert.throws(() => scaleMeadow(before, PHONE, { width: 0, height: 10 }), RangeError);
});
