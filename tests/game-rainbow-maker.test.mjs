import assert from 'node:assert/strict';
import { test } from 'node:test';

const { COLOURS } = await import('../lib/games/colours.js');
const { ARCS, LEVELS, arcsShown, isRight, nextThing, rulesFor } = await import('../lib/games/rainbow-maker.js');
const en = (await import('../lib/i18n/locales/en.json', { with: { type: 'json' } })).default;
const tr = (await import('../lib/i18n/locales/tr.json', { with: { type: 'json' } })).default;

/** A fixed source of chance that walks through a list of values. */
function steps(...values) {
  let at = 0;
  return () => values[at++ % values.length];
}

test('each level has its pots, and names show on easy and normal only', () => {
  assert.deepEqual([...LEVELS.easy.pots], ['red', 'yellow', 'green', 'blue']);
  assert.deepEqual([...LEVELS.normal.pots], ['red', 'yellow', 'green', 'blue', 'orange', 'purple']);
  assert.deepEqual([...LEVELS.hard.pots], ['red', 'yellow', 'green', 'blue', 'orange', 'purple', 'brown', 'black', 'white']);
  assert.equal(LEVELS.easy.names, true);
  assert.equal(LEVELS.normal.names, true);
  assert.equal(LEVELS.hard.names, false);
  assert.equal(rulesFor('impossible'), LEVELS.normal);
});

test('every pot is a colour with its own square emoji, pink is never a pot, and each has words', () => {
  const squares = new Set();
  for (const level of Object.values(LEVELS)) {
    assert.equal(new Set(level.pots).size, level.pots.length);
    for (const pot of level.pots) {
      assert.ok(COLOURS[pot], pot);
      assert.notEqual(pot, 'pink');
      assert.notEqual(COLOURS[pot].square, COLOURS[pot].swatch, `${pot} has a square of its own`);
      assert.ok(en[`colour.${pot}`] && tr[`colour.${pot}`], pot);
    }
  }
  for (const pot of LEVELS.hard.pots) squares.add(COLOURS[pot].square);
  assert.equal(squares.size, LEVELS.hard.pots.length, 'no two pots look the same');
});

test("a thing is one of the level's colours, shown by an emoji of that colour", () => {
  for (const level of ['easy', 'normal', 'hard']) {
    let last = null;
    for (let n = 0; n < 400; n += 1) {
      const thing = nextThing(level, last);
      assert.ok(LEVELS[level].pots.includes(thing.colour), `${level} ${thing.colour}`);
      assert.ok(COLOURS[thing.colour].items.includes(thing.glyph));
      last = thing;
    }
  }
});

test('neither the colour nor the emoji repeats twice in a row', () => {
  for (const level of ['easy', 'normal', 'hard']) {
    let last = null;
    for (let n = 0; n < 400; n += 1) {
      const thing = nextThing(level, last);
      if (last) {
        assert.notEqual(thing.colour, last.colour);
        assert.notEqual(thing.glyph, last.glyph);
      }
      last = thing;
    }
  }
  // Even a source of chance that always lands on the first choice moves on.
  const first = nextThing('easy', null, steps(0));
  const second = nextThing('easy', first, steps(0));
  assert.equal(first.colour, 'red');
  assert.equal(second.colour, 'yellow');
  // And the last choice of the list is reachable.
  assert.equal(nextThing('hard', null, steps(0.999999)).colour, 'white');
});

test('only the pot of the thing colour is right', () => {
  const thing = { colour: 'green', glyph: COLOURS.green.items[0] };
  for (const pot of LEVELS.hard.pots) assert.equal(isRight(thing, pot), pot === 'green');
});

test('the rainbow fills one arc per right answer and starts again after five', () => {
  assert.equal(ARCS, 5);
  assert.equal(arcsShown(-1), 0);
  assert.equal(arcsShown(0), 0);
  assert.equal(arcsShown(1), 1);
  assert.equal(arcsShown(4), 4);
  assert.equal(arcsShown(5), 5);
  assert.equal(arcsShown(6), 1);
  assert.equal(arcsShown(9), 4);
  assert.equal(arcsShown(10), 5);
  assert.equal(arcsShown(11), 1);
  assert.equal(arcsShown(1.5), 0);
});

test('the game words are in both languages, with the colour filled in', () => {
  for (const key of ['prompt', 'right', 'notThat', 'pot', 'rainbow']) {
    const full = `games.rainbow-maker.${key}`;
    assert.ok(en[full] && tr[full], full);
  }
  for (const key of ['right', 'notThat', 'pot']) {
    assert.match(en[`games.rainbow-maker.${key}`], /\{colour\}/u);
    assert.match(tr[`games.rainbow-maker.${key}`], /\{colour\}/u);
  }
});
