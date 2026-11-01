import assert from 'node:assert/strict';
import { test } from 'node:test';

const { COLOURS, COLOUR_IDS } = await import('../lib/games/colours.js');
const { LEVELS, isRight, makeRound } = await import('../lib/games/colour-muncher.js');
const en = (await import('../lib/i18n/locales/en.json', { with: { type: 'json' } })).default;
const tr = (await import('../lib/i18n/locales/tr.json', { with: { type: 'json' } })).default;

test('every level asks among the right number of colours and things', () => {
  assert.equal(LEVELS.easy.colours.length, 4);
  assert.equal(LEVELS.easy.choices, 3);
  assert.equal(LEVELS.normal.colours.length, 6);
  assert.equal(LEVELS.normal.choices, 4);
  assert.equal(LEVELS.hard.colours.length, 8);
  assert.equal(LEVELS.hard.choices, 6);
  for (const level of Object.values(LEVELS)) assert.ok(level.choices <= level.colours.length);
});

test('a round has exactly one thing of the asked colour, and the rest each of another colour', () => {
  for (const level of ['easy', 'normal', 'hard']) {
    for (let n = 0; n < 200; n += 1) {
      const round = makeRound(level, null);
      assert.equal(round.things.length, LEVELS[level].choices);
      assert.ok(LEVELS[level].colours.includes(round.colour));
      assert.equal(round.things.filter((thing) => thing.colour === round.colour).length, 1);
      assert.equal(new Set(round.things.map((thing) => thing.colour)).size, round.things.length);
      for (const thing of round.things) assert.ok(COLOURS[thing.colour].items.includes(thing.glyph));
      assert.equal(new Set(round.things.map((thing) => thing.id)).size, round.things.length);
    }
  }
});

test('the asked colour never repeats the last one', () => {
  let last = null;
  for (let n = 0; n < 300; n += 1) {
    const round = makeRound('easy', last);
    assert.notEqual(round.colour, last);
    last = round.colour;
  }
});

test('only the thing of the asked colour is right', () => {
  const round = makeRound('normal', null);
  for (const thing of round.things) assert.equal(isRight(round, thing.id), thing.colour === round.colour);
  assert.equal(isRight(round, 'nothing'), false);
});

test('an unknown level plays as normal', () => {
  assert.equal(makeRound('impossible', null).things.length, LEVELS.normal.choices);
});

test('no thing belongs to two colours, and every colour has words in both languages', () => {
  const seen = new Map();
  for (const id of COLOUR_IDS) {
    for (const glyph of COLOURS[id].items) {
      assert.equal(seen.has(glyph), false, `${glyph} is in ${seen.get(glyph)} and ${id}`);
      seen.set(glyph, id);
    }
    assert.ok(en[`colour.${id}`] && tr[`colour.${id}`], id);
  }
});
