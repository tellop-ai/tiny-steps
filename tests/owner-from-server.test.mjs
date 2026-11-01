/**
 * Whose information a request reads or changes is decided on the server, never
 * by the request (`AGENTS.md` rule 1).
 *
 * The person using the app is `(await currentPerson()).id`, as the host names
 * them. An owner taken from the address (`?owner=`) or from a sent body lets a
 * Viewer read the owner's rows, or one member write as another, just by naming
 * them. So no file under `app/` may read either. This is a scan of the source,
 * on purpose: it guards a pattern that is easy to copy.
 */

import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const app = path.join(import.meta.dirname, '..', 'app');
// Each file is read whole, so a call or a pattern split across lines is still seen.
const FORBIDDEN = [
  // The address: `searchParams.get('owner')` or `'ownerId'`, on anything that holds it.
  /\.\s*get\(\s*['"`]owner(?:Id)?['"`]\s*\)/u,
  // A sent body by its usual names: `body.owner`, `payload?.ownerId`.
  /\b(?:payload|data|input|params|body)\s*\??\.\s*owner(?:Id)?\b/u,
  // A sent body taken apart: `const { owner } = await request.json()`, or `{ ownerId }`.
  /\{[^{}]*\bowner(?:Id)?\b[^{}]*\}\s*=/u,
];

function sources(folder) {
  return readdirSync(folder, { withFileTypes: true }).flatMap((entry) => {
    const at = path.join(folder, entry.name);
    if (entry.isDirectory()) return sources(at);
    return /\.(?:js|jsx|mjs|ts|tsx)$/u.test(entry.name) ? [at] : [];
  });
}

/** @param {string} text */
function matches(text) {
  return FORBIDDEN.flatMap((pattern) => [...text.matchAll(new RegExp(pattern.source, 'gu'))]);
}

test('no file under app/ takes the owner from the address or the body', () => {
  const found = sources(app).flatMap((file) => {
    const text = readFileSync(file, 'utf8');
    return matches(text).map((match) => `${path.relative(app, file)}:${text.slice(0, match.index).split('\n').length}: ${match[0].replace(/\s+/gu, ' ')}`);
  });
  assert.deepEqual(found, []);
});

test('the scan sees every shape, and not the server-held owner', () => {
  for (const text of [
    "const owner = address.searchParams.get('owner');", "address.searchParams\n    .get(\n      'owner'\n    )", "query.get('owner')",
    "searchParams.get('ownerId')", 'addNoteFor(body.owner, body.text)', 'body?.owner', 'payload.owner', 'data?.owner', 'input.owner',
    'params.owner', 'body.ownerId', 'data?.ownerId', 'const { owner } = await request.json();', 'const { ownerId, text } = body;',
    'const { text, owner: who } = payload;', 'const {\n  owner,\n  text,\n} = await request.json();',
  ]) assert.equal(matches(text).length > 0, true, text);
  for (const text of [
    'const owner = (await currentPerson()).id;', "searchParams.get('before')", 'body.ownerName', 'const { ownerName } = body;',
    'note.ownerId === person.id', "searchParams.get('ownerIds')",
    'return json({ notes, owner });', 'export async function GET(request) {\n  const owner = (await currentPerson()).id;\n  const { text } = payload;\n}',
  ]) assert.equal(matches(text).length, 0, text);
});
