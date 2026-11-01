import assert from 'node:assert/strict';
import { test } from 'node:test';

const {
  BOARD, LEVELS, MARGIN, MAX_HIT, MIN_GAP, PICTURES, dotSizes, glows, isComplete, levelOfCount, markOf, nearestGap,
  nextPicture, picturesFor, tapResult,
} = await import('../lib/games/dot-to-dot.js');
const en = (await import('../lib/i18n/locales/en.json', { with: { type: 'json' } })).default;
const tr = (await import('../lib/i18n/locales/tr.json', { with: { type: 'json' } })).default;

/** A fixed sequence of chances, for picks that must be repeatable. */
function fixed(...values) {
  let at = 0;
  return () => values[at++ % values.length];
}

/** The distance from a point to a line segment. */
function segmentGap([px, py], [ax, ay], [bx, by]) {
  const dx = bx - ax;
  const dy = by - ay;
  const along = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - ax - along * dx, py - ay - along * dy);
}

/** Whether two segments cross (touching ends do not count; the checks only pass segments that share no end). */
function crosses(a, b, c, d) {
  const side = (p, q, r) => Math.sign((q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]));
  return side(a, b, c) !== side(a, b, d) && side(c, d, a) !== side(c, d, b);
}

test('a level takes pictures of its own number of dots, tested on each edge and one each side', () => {
  assert.deepEqual(LEVELS.easy, { min: 5, max: 8, glow: true });
  assert.deepEqual(LEVELS.normal, { min: 9, max: 12, glow: false });
  assert.deepEqual(LEVELS.hard, { min: 13, max: 20, glow: false });
  const expected = { 4: null, 5: 'easy', 6: 'easy', 7: 'easy', 8: 'easy', 9: 'normal', 11: 'normal', 12: 'normal', 13: 'hard', 14: 'hard', 19: 'hard', 20: 'hard', 21: null, 0: null };
  for (const [count, level] of Object.entries(expected)) assert.equal(levelOfCount(Number(count)), level, `count ${count}`);
});

test('every level has several pictures, and every picture plays at exactly one level', () => {
  for (const level of Object.keys(LEVELS)) {
    const pictures = picturesFor(level);
    assert.ok(pictures.length >= 5, `${level} has ${pictures.length}`);
    for (const each of pictures) {
      assert.ok(each.points.length >= LEVELS[level].min && each.points.length <= LEVELS[level].max, each.id);
    }
  }
  const all = Object.keys(LEVELS).flatMap((level) => picturesFor(level).map((each) => each.id));
  assert.deepEqual([...all].sort(), PICTURES.map((each) => each.id).sort());
  assert.equal(new Set(all).size, PICTURES.length);
  assert.ok(PICTURES.length >= 15);
  assert.deepEqual(picturesFor('impossible'), picturesFor('normal'));
});

test('every dot is on the board with a margin, so its tap area stays on the board', () => {
  assert.ok(MAX_HIT <= MARGIN);
  for (const each of PICTURES) {
    for (const [x, y] of each.points) {
      assert.ok(Number.isFinite(x) && Number.isFinite(y), each.id);
      assert.ok(x >= MARGIN && x <= BOARD - MARGIN && y >= MARGIN && y <= BOARD - MARGIN, `${each.id} ${x},${y}`);
    }
    const { hit } = dotSizes(each.points);
    for (const [x, y] of each.points) assert.ok(x - hit >= 0 && x + hit <= BOARD && y - hit >= 0 && y + hit <= BOARD, each.id);
  }
});

test('dots are far enough apart that tap areas never overlap', () => {
  assert.ok(MIN_GAP >= 11);
  for (const each of PICTURES) {
    const gap = nearestGap(each.points);
    assert.ok(gap >= MIN_GAP, `${each.id}: two dots ${gap.toFixed(1)} apart`);
    const { dot, hit } = dotSizes(each.points);
    assert.ok(hit * 2 <= gap, `${each.id}: tap areas overlap`);
    assert.ok(dot <= hit, `${each.id}: a dot is bigger than its tap area`);
    assert.ok(dot >= 3.6 && hit <= MAX_HIT, each.id);
  }
});

test('the outline never crosses itself and no line runs over another dot', () => {
  for (const each of PICTURES) {
    const points = each.points;
    const count = points.length;
    const { dot } = dotSizes(points);
    for (let from = 0; from < count; from += 1) {
      const a = points[from];
      const b = points[(from + 1) % count];
      for (let other = 0; other < count; other += 1) {
        if (other === from || other === (from + 1) % count) continue;
        assert.ok(segmentGap(points[other], a, b) >= dot + 3, `${each.id}: line ${from + 1} runs over dot ${other + 1}`);
      }
      for (let later = from + 2; later < count; later += 1) {
        if (from === 0 && later === count - 1) continue;
        assert.equal(crosses(a, b, points[later], points[(later + 1) % count]), false, `${each.id}: lines ${from + 1} and ${later + 1} cross`);
      }
    }
  }
});

test('every picture has a name in both languages, and the game has its words', () => {
  for (const each of PICTURES) {
    assert.ok(en[`games.dot-to-dot.pic.${each.id}`], `en ${each.id}`);
    assert.ok(tr[`games.dot-to-dot.pic.${each.id}`], `tr ${each.id}`);
  }
  for (const key of ['start', 'next', 'notThat', 'board', 'dot']) {
    assert.ok(en[`games.dot-to-dot.${key}`] && tr[`games.dot-to-dot.${key}`], key);
  }
  assert.match(en['games.dot-to-dot.next'], /\{n\}/u);
  assert.match(tr['games.dot-to-dot.notThat'], /\{m\}.*\{n\}/u);
});

test('the next picture is one of the level\'s and never the same twice in a row', () => {
  for (const level of Object.keys(LEVELS)) {
    let last = null;
    for (let n = 0; n < 200; n += 1) {
      const each = nextPicture(level, last);
      assert.notEqual(each.id, last);
      assert.equal(levelOfCount(each.points.length), level);
      last = each.id;
    }
  }
  const first = nextPicture('easy', null, fixed(0));
  assert.notEqual(nextPicture('easy', first.id, fixed(0)).id, first.id);
});

test('a tap is right only on the next dot; a joined dot does nothing; any other dot is a miss', () => {
  // Nothing joined yet: only dot 1 (index 0) is right.
  assert.equal(tapResult(0, 0, 5), 'right');
  assert.equal(tapResult(0, 1, 5), 'miss');
  assert.equal(tapResult(0, 4, 5), 'miss');
  // Three joined: index 3 is next, 2 is just done, 4 is one past.
  assert.equal(tapResult(3, 3, 5), 'right');
  assert.equal(tapResult(3, 2, 5), 'done');
  assert.equal(tapResult(3, 4, 5), 'miss');
  assert.equal(tapResult(3, 0, 5), 'done');
  // The last dot, and out-of-range taps.
  assert.equal(tapResult(4, 4, 5), 'right');
  assert.equal(tapResult(5, 4, 5), 'done');
  assert.equal(tapResult(0, 5, 5), 'done');
  assert.equal(tapResult(0, -1, 5), 'done');
  assert.equal(tapResult(0, 1.5, 5), 'done');
});

test('a picture is complete exactly when every dot is joined', () => {
  assert.equal(isComplete(4, 5), false);
  assert.equal(isComplete(5, 5), true);
  assert.equal(isComplete(6, 5), true);
});

test('only Easy makes the next dot glow; lines cycle the five marks', () => {
  assert.equal(glows('easy'), true);
  assert.equal(glows('normal'), false);
  assert.equal(glows('hard'), false);
  assert.equal(glows('impossible'), false);
  assert.deepEqual([1, 2, 3, 4, 5, 6, 7].map(markOf), [2, 3, 4, 5, 1, 2, 3]);
});
