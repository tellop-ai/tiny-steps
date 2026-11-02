/**
 * The app's own pictures: every game has its icon, every decoration the code
 * names is there, each file is a real WebP of the right size and small, and
 * nothing else sits in the folder.
 */

import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { GAMES } from '../lib/play/catalog.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public', 'art');
const DECOR = ['chick', 'cloud', 'sun', 'trophy', 'teddy', 'stars', 'basket-teddy'];

/**
 * A WebP file's width, height and whether it carries a see-through layer, read
 * from its header (simple, lossless or extended form).
 *
 * @param {Buffer} bytes
 */
function webpInfo(bytes) {
  assert.equal(bytes.toString('ascii', 0, 4), 'RIFF', 'not a RIFF file');
  assert.equal(bytes.toString('ascii', 8, 12), 'WEBP', 'not a WebP file');
  assert.equal(bytes.readUInt32LE(4) + 8, bytes.length, 'the RIFF length does not match the file');
  const chunk = bytes.toString('ascii', 12, 16);
  if (chunk === 'VP8X') {
    const flags = bytes[20];
    return { width: 1 + bytes.readUIntLE(24, 3), height: 1 + bytes.readUIntLE(27, 3), alpha: (flags & 0x10) !== 0, metadata: (flags & 0x0c) !== 0 };
  }
  if (chunk === 'VP8 ') {
    return { width: bytes.readUInt16LE(26) & 0x3fff, height: bytes.readUInt16LE(28) & 0x3fff, alpha: false, metadata: false };
  }
  if (chunk === 'VP8L') {
    const bits = bytes.readUInt32LE(21);
    return { width: 1 + (bits & 0x3fff), height: 1 + ((bits >> 14) & 0x3fff), alpha: ((bits >> 28) & 1) === 1, metadata: false };
  }
  throw new Error(`unknown WebP chunk ${chunk}`);
}

test('every game has its icon: 256 x 256, opaque, no metadata, at most 24 KB', () => {
  for (const game of GAMES) {
    const bytes = readFileSync(path.join(root, 'games', `${game.id}.webp`));
    const info = webpInfo(bytes);
    assert.deepEqual([info.width, info.height], [256, 256], game.id);
    assert.equal(info.alpha, false, `${game.id} should be opaque`);
    assert.equal(info.metadata, false, `${game.id} carries metadata`);
    assert.ok(bytes.length <= 24 * 1024, `${game.id} is ${bytes.length} bytes`);
  }
});

test('every decoration is there: 384 x 384, see-through, no metadata, at most 48 KB', () => {
  for (const name of DECOR) {
    const bytes = readFileSync(path.join(root, 'decor', `${name}.webp`));
    const info = webpInfo(bytes);
    assert.deepEqual([info.width, info.height], [384, 384], name);
    assert.equal(info.alpha, true, `${name} should be see-through`);
    assert.equal(info.metadata, false, `${name} carries metadata`);
    assert.ok(bytes.length <= 48 * 1024, `${name} is ${bytes.length} bytes`);
  }
});

test('the picture folders hold exactly those files', () => {
  assert.deepEqual(readdirSync(root).sort(), ['decor', 'games']);
  assert.deepEqual(readdirSync(path.join(root, 'games')).sort(), GAMES.map((game) => `${game.id}.webp`).sort());
  assert.deepEqual(readdirSync(path.join(root, 'decor')).sort(), DECOR.map((name) => `${name}.webp`).sort());
});

test('the code names the same decorations as this test', () => {
  // node cannot load JSX, so read the list from the source.
  const source = readFileSync(path.join(root, '..', '..', 'app', 'art.jsx'), 'utf8');
  const list = source.match(/DECOR = Object\.freeze\(\[([^\]]*)\]\)/u)?.[1] ?? '';
  assert.deepEqual([...list.matchAll(/'([a-z-]+)'/gu)].map((match) => match[1]), DECOR);
});

const publicRoot = path.join(root, '..');

test('the store logo: 256 x 256, no metadata, at most 12 KiB', () => {
  const bytes = readFileSync(path.join(publicRoot, 'store-picture.webp'));
  const info = webpInfo(bytes);
  assert.deepEqual([info.width, info.height], [256, 256]);
  assert.equal(info.metadata, false);
  assert.ok(bytes.length <= 12 * 1024, `the logo is ${bytes.length} bytes`);
});

test('the store pictures: two to six in each language, numbered from 1, each 2560 x 1600, no metadata, at most 256 KiB', () => {
  const names = readdirSync(path.join(publicRoot, 'store-pictures')).sort();
  for (const language of ['en', 'tr']) {
    const mine = names.filter((name) => name.startsWith(`${language}-`));
    assert.ok(mine.length >= 2 && mine.length <= 6, `${language}: ${mine.length} pictures`);
    assert.deepEqual(mine, mine.map((_, at) => `${language}-${at + 1}.webp`).sort());
    for (const name of mine) {
      const bytes = readFileSync(path.join(publicRoot, 'store-pictures', name));
      const info = webpInfo(bytes);
      assert.deepEqual([info.width, info.height], [2560, 1600], name);
      assert.equal(info.metadata, false, name);
      assert.ok(bytes.length <= 256 * 1024, `${name} is ${bytes.length} bytes`);
    }
  }
  assert.equal(names.length, names.filter((name) => /^(en|tr)-[1-6]\.webp$/u.test(name)).length, 'a stray file in store-pictures');
});
