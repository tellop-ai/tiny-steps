import assert from 'node:assert/strict';
import { test } from 'node:test';

const { SHAPES, SHAPE_IDS, shapePath } = await import('../lib/games/shapes.js');
const en = (await import('../lib/i18n/locales/en.json', { with: { type: 'json' } })).default;
const tr = (await import('../lib/i18n/locales/tr.json', { with: { type: 'json' } })).default;

const KINDS = ['circle', 'oval', 'square', 'rectangle', 'triangle', 'star', 'heart', 'diamond', 'pentagon', 'hexagon'];

test('the ten shapes are all there, once each, and nothing else', () => {
  assert.equal(SHAPE_IDS.length, 10);
  assert.deepEqual([...SHAPE_IDS].sort(), [...KINDS].sort());
  assert.deepEqual(Object.keys(SHAPES).sort(), [...KINDS].sort());
  assert.ok(Object.isFrozen(SHAPE_IDS) && Object.isFrozen(SHAPES));
});

test('every shape has a closed outline inside the 0 to 100 box', () => {
  for (const id of SHAPE_IDS) {
    const d = shapePath(id);
    assert.equal(typeof d, 'string', id);
    assert.match(d, /^M[\d.]+ [\d.]+ /u, `${id} starts with a move`);
    assert.match(d, / Z$/u, `${id} is closed`);
    assert.match(d, /^[MLHVACZ\d. -]+$/u, `${id} uses only plain path commands`);
    const numbers = d.match(/-?\d+(?:\.\d+)?/gu).map(Number);
    assert.ok(numbers.length >= 6, `${id} has points`);
    for (const value of numbers) assert.ok(value >= 0 && value <= 100, `${id}: ${value} is outside the box`);
  }
});

test('no two shapes share an outline', () => {
  assert.equal(new Set(SHAPE_IDS.map((id) => SHAPES[id])).size, SHAPE_IDS.length);
});

test('a name that is not a shape has no outline', () => {
  assert.equal(shapePath('cross'), null);
  assert.equal(shapePath('constructor'), null);
  assert.equal(shapePath(''), null);
});

test('every shape has a word in English and in Turkish', () => {
  for (const id of SHAPE_IDS) {
    assert.equal(typeof en[`shape.${id}`], 'string', `shape.${id} in English`);
    assert.equal(typeof tr[`shape.${id}`], 'string', `shape.${id} in Turkish`);
    assert.ok(en[`shape.${id}`].trim() && tr[`shape.${id}`].trim(), id);
  }
});
