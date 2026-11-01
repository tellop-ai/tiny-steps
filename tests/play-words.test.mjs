/**
 * Every word key the pages and games name is in both languages, every game has
 * its start-card words, and no machinery word reaches a child or a parent
 * (`AGENTS.md` rule 5). The key scan reads literal keys in `t('…')` calls; keys
 * built at run time are checked by the games' own tests.
 */

import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const en = (await import('../lib/i18n/locales/en.json', { with: { type: 'json' } })).default;
const tr = (await import('../lib/i18n/locales/tr.json', { with: { type: 'json' } })).default;
const { GAME_IDS, LEVELS, CATEGORIES } = await import('../lib/play/catalog.js');

const root = path.join(import.meta.dirname, '..');

function sources(folder) {
  return readdirSync(folder, { withFileTypes: true }).flatMap((entry) => {
    const at = path.join(folder, entry.name);
    if (entry.isDirectory()) return entry.name === 'generated' ? [] : sources(at);
    return /\.(?:js|jsx)$/u.test(entry.name) ? [at] : [];
  });
}

test('both languages hold the same keys, none empty', () => {
  assert.deepEqual(Object.keys(en).sort(), Object.keys(tr).sort());
  for (const [key, value] of Object.entries(en)) assert.ok(typeof value === 'string' && value.trim() !== '', `en ${key}`);
  for (const [key, value] of Object.entries(tr)) assert.ok(typeof value === 'string' && value.trim() !== '', `tr ${key}`);
});

test('every literal key the app names exists', () => {
  const missing = [];
  for (const file of [...sources(path.join(root, 'app')), ...sources(path.join(root, 'lib'))]) {
    const text = readFileSync(file, 'utf8');
    for (const match of text.matchAll(/\bt\(\s*'([a-zA-Z0-9_.-]+)'/gu)) {
      if (!Object.hasOwn(en, match[1])) missing.push(`${path.relative(root, file)}: ${match[1]}`);
    }
  }
  assert.deepEqual(missing, []);
});

test('every game and group has its card and start-card words', () => {
  for (const id of GAME_IDS) {
    for (const part of ['name', 'blurb', 'howTo', ...LEVELS.map((level) => `levels.${level}`)]) {
      assert.ok(Object.hasOwn(en, `games.${id}.${part}`), `games.${id}.${part}`);
    }
  }
  for (const category of CATEGORIES) assert.ok(Object.hasOwn(en, `category.${category.id}`));
  for (const level of LEVELS) assert.ok(Object.hasOwn(en, `level.${level}`));
});

test('no machinery word is in either language', () => {
  const banned = /\b(?:table|column|migration|sql|schema|constraint|index|transaction|rollback|branch|commit|merge)s?\b/iu;
  const found = [];
  for (const [lang, words] of [['en', en], ['tr', tr]]) {
    for (const [key, value] of Object.entries(words)) if (banned.test(value)) found.push(`${lang} ${key}: ${value}`);
  }
  assert.deepEqual(found, []);
});
