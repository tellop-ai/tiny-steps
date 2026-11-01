import assert from 'node:assert/strict';
import { test } from 'node:test';

const {
  LEVELS,
  NEXT_ROUND_MS,
  SPEED_SPREAD,
  bobAt,
  bodyShare,
  goodToCarry,
  isRight,
  makeRound,
  makeSchool,
  middleInView,
  pickCarrier,
  progressAt,
  rulesFor,
  travelLeft,
  wrap,
} = await import('../lib/games/number-pond.js');
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

const always = (value) => () => value;
const LAST = 0.999999;

/** A fish for the place checks: speed 0.1 trips a second. */
const fish = (direction, start = 0) => ({ lane: 0, direction, speed: 0.1, start, bob: 0, mark: 'chart-1' });

test('each level has its fish, its numbers and its speed; harder is quicker', () => {
  assert.deepEqual([LEVELS.easy.fish, LEVELS.easy.high], [4, 5]);
  assert.deepEqual([LEVELS.normal.fish, LEVELS.normal.high], [6, 10]);
  assert.deepEqual([LEVELS.hard.fish, LEVELS.hard.high], [8, 20]);
  assert.ok(LEVELS.easy.speed < LEVELS.normal.speed && LEVELS.normal.speed < LEVELS.hard.speed);
  // The slowest Hard fish is still quicker than the quickest Easy one.
  assert.ok(LEVELS.hard.speed * (1 - SPEED_SPREAD) > LEVELS.easy.speed * (1 + SPEED_SPREAD));
  for (const level of Object.values(LEVELS)) assert.ok(level.fish <= level.high);
  assert.equal(NEXT_ROUND_MS, 900);
  assert.equal(rulesFor('impossible'), LEVELS.normal);
});

test('a school has one fish per lane, lanes swimming in turn left and right, speeds within a fifth', () => {
  for (const level of ['easy', 'normal', 'hard']) {
    const random = seeded(11);
    for (let n = 0; n < 50; n += 1) {
      const school = makeSchool(level, random);
      assert.equal(school.length, LEVELS[level].fish);
      assert.deepEqual(school.map((one) => one.lane), [...school.keys()]);
      for (const [at, one] of school.entries()) {
        if (at > 0) assert.equal(one.direction, -school[at - 1].direction);
        assert.ok(one.speed >= LEVELS[level].speed * (1 - SPEED_SPREAD) - 1e-12);
        assert.ok(one.speed <= LEVELS[level].speed * (1 + SPEED_SPREAD) + 1e-12);
        assert.ok(one.start >= 0 && one.start < 1);
        assert.match(one.mark, /^chart-[1-5]$/u);
      }
    }
  }
  // Speeds at the edges of chance: a fifth below and a fifth above.
  const slowest = makeSchool('easy', always(0));
  assert.ok(Math.abs(slowest[0].speed - LEVELS.easy.speed * (1 - SPEED_SPREAD)) < 1e-12);
  const quickest = makeSchool('easy', always(LAST));
  assert.ok(Math.abs(quickest[0].speed - LEVELS.easy.speed * (1 + SPEED_SPREAD)) < 1e-5);
  assert.equal(slowest[0].direction, 1);
  assert.equal(quickest[0].direction, -1);
});

test('wrapping keeps a place in [0, 1), at its edges and past them', () => {
  assert.equal(wrap(0), 0);
  assert.equal(wrap(1), 0);
  assert.equal(wrap(2), 0);
  assert.ok(Math.abs(wrap(0.999) - 0.999) < 1e-12);
  assert.ok(Math.abs(wrap(1.001) - 0.001) < 1e-9);
  assert.ok(Math.abs(wrap(-0.001) - 0.999) < 1e-9);
  assert.equal(wrap(-1), 0);
  assert.ok(wrap(-1e-20) < 1, 'a tiny step below 0 never lands on 1');
});

test('a fish swimming right wraps from the right side back to the left, and one swimming left the other way', () => {
  const right = fish(1, 0.95);
  assert.ok(Math.abs(progressAt(right, 0.49) - 0.999) < 1e-9);
  assert.equal(progressAt(right, 0.5), 0);
  assert.ok(Math.abs(progressAt(right, 0.51) - 0.001) < 1e-9);
  const left = fish(-1, 0.05);
  assert.ok(Math.abs(progressAt(left, 0.49) - 0.001) < 1e-9);
  assert.equal(progressAt(left, 0.5), 0);
  assert.ok(Math.abs(progressAt(left, 0.51) - 0.999) < 1e-9);
  // Whole trips later a fish is where it started.
  assert.ok(Math.abs(progressAt(right, 10) - 0.95) < 1e-9);
  const random = seeded(12);
  for (const one of makeSchool('hard', random)) {
    for (let seconds = 0; seconds < 120; seconds += 0.37) {
      const place = progressAt(one, seconds);
      assert.ok(place >= 0 && place < 1);
      assert.ok(Math.abs(bobAt(one, seconds)) <= 1);
    }
  }
});

test('a fish body share and the middle-in-view test hold at their edges', () => {
  assert.equal(bodyShare(300, 100), 0.25);
  assert.equal(bodyShare(0, 100), 0);
  assert.equal(bodyShare(300, 0), 0);
  // Share 0.2: the middle is in view from 0.1 to 0.9.
  assert.equal(middleInView(0.0999, 0.2), false);
  assert.equal(middleInView(0.1, 0.2), true);
  assert.equal(middleInView(0.5, 0.2), true);
  assert.equal(middleInView(0.9, 0.2), true);
  assert.equal(middleInView(0.9001, 0.2), false);
});

test('a fish is good to carry the wanted number only whole in the pond and in the first half of its crossing', () => {
  // Share 0.2: whole in the pond from 0.2 to 0.8; the crossing's middle is 0.5.
  const right = fish(1);
  assert.equal(goodToCarry(right, 0.1999, 0.2), false);
  assert.equal(goodToCarry(right, 0.2, 0.2), true);
  assert.equal(goodToCarry(right, 0.5, 0.2), true);
  assert.equal(goodToCarry(right, 0.5001, 0.2), false);
  const left = fish(-1);
  assert.equal(goodToCarry(left, 0.4999, 0.2), false);
  assert.equal(goodToCarry(left, 0.5, 0.2), true);
  assert.equal(goodToCarry(left, 0.8, 0.2), true);
  assert.equal(goodToCarry(left, 0.8001, 0.2), false);
  assert.ok(Math.abs(travelLeft(right, 0.3, 0.2) - 0.5) < 1e-12);
  assert.ok(Math.abs(travelLeft(left, 0.3, 0.2) - 0.1) < 1e-12);
  assert.equal(travelLeft(right, 0.1, 0.2), 0);
  assert.equal(travelLeft(left, 0.9, 0.2), 0);
});

test('the carrier is a good fish when there is one, else the one with the most crossing left', () => {
  const school = [fish(1, 0.85), fish(-1, 0.3), fish(1, 0.35), fish(-1, 0.6)];
  // Good at share 0.2: fish 2 (right, 0.35) and fish 3 (left, 0.6).
  assert.equal(pickCarrier(school, 0, 0.2, always(0)), 2);
  assert.equal(pickCarrier(school, 0, 0.2, always(LAST)), 3);
  // No good fish: fish 0 is leaving (none left), fish 1 (left at 0.35) has 0.15 left, fish 2 (right at 0.7) 0.1.
  const leaving = [fish(1, 0.85), fish(-1, 0.35), fish(1, 0.7)];
  assert.equal(pickCarrier(leaving, 0, 0.2, always(0)), 1);
  assert.equal(pickCarrier(leaving, 0, 0.2, always(LAST)), 1);
  const random = seeded(13);
  for (let n = 0; n < 200; n += 1) {
    const many = makeSchool('hard', random);
    const seconds = random() * 60;
    const carrier = pickCarrier(many, seconds, 0.2, random);
    assert.ok(carrier >= 0 && carrier < many.length);
    const anyGood = many.some((one) => goodToCarry(one, progressAt(one, seconds), 0.2));
    if (anyGood) assert.ok(goodToCarry(many[carrier], progressAt(many[carrier], seconds), 0.2));
  }
});

test('a round puts distinct numbers on the fish, inside the range, with the wanted one on the carrier', () => {
  const random = seeded(14);
  for (const level of ['easy', 'normal', 'hard']) {
    const { fish: count, high } = LEVELS[level];
    const seen = new Set();
    let last = null;
    for (let n = 0; n < 400; n += 1) {
      const carrier = n % count;
      const round = makeRound(level, last, carrier, random);
      assert.equal(round.numbers.length, count);
      assert.equal(new Set(round.numbers).size, count, 'distinct');
      for (const number of round.numbers) assert.ok(Number.isInteger(number) && number >= 1 && number <= high);
      assert.equal(round.numbers[carrier], round.wanted);
      assert.equal(round.numbers.filter((number) => number === round.wanted).length, 1);
      assert.notEqual(round.wanted, last);
      for (const number of round.numbers) seen.add(number);
      last = round.wanted;
    }
    assert.equal(seen.size, high, `${level}: every number from 1 to ${high} shows in time`);
  }
});

test('the wanted number reaches both ends of its range', () => {
  for (const level of ['easy', 'normal', 'hard']) {
    const { high } = LEVELS[level];
    assert.equal(makeRound(level, null, 0, always(0)).wanted, 1);
    assert.equal(makeRound(level, null, 0, always(LAST)).wanted, high);
    assert.equal(makeRound(level, 1, 0, always(0)).wanted, 2, 'never the last one again');
    assert.equal(makeRound(level, high, 0, always(LAST)).wanted, high - 1);
  }
});

test('Easy shows four of the five numbers, and the carrier outside the school falls back to the first fish', () => {
  const random = seeded(15);
  for (let n = 0; n < 100; n += 1) {
    const round = makeRound('easy', null, 3, random);
    assert.equal(round.numbers.length, 4);
    assert.equal([1, 2, 3, 4, 5].filter((number) => !round.numbers.includes(number)).length, 1);
  }
  for (const carrier of [-1, 4, 1.5, null]) {
    const round = makeRound('easy', null, carrier, random);
    assert.equal(round.numbers[0], round.wanted, `carrier ${carrier}`);
  }
});

test('only the fish carrying the wanted number is right', () => {
  const round = { wanted: 7, numbers: [3, 7, 1] };
  assert.equal(isRight(round, 1), true);
  assert.equal(isRight(round, 0), false);
  assert.equal(isRight(round, 2), false);
  assert.equal(isRight(round, 5), false);
});

test('the game has its words in both languages, and Turkish puts no ending after the number', () => {
  for (const key of ['prompt', 'notThat', 'fish', 'pond']) {
    assert.ok(en[`games.number-pond.${key}`], `en ${key}`);
    assert.ok(tr[`games.number-pond.${key}`], `tr ${key}`);
  }
  for (const key of ['prompt', 'notThat', 'fish']) {
    for (const words of [en, tr]) assert.match(words[`games.number-pond.${key}`], /\{n\}/u);
    assert.doesNotMatch(tr[`games.number-pond.${key}`], /\{n\}['’]?[a-zçğıöşü]/iu, key);
  }
});
