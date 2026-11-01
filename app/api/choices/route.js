import { DataError } from '../../../lib/data/index.js';
import { saveChoiceFor } from '../../../lib/data/play.js';
import { currentPerson } from '../../../lib/data/person.js';
import { REFUSED } from '../../../lib/play/limits.js';
import { currentOwner } from '../../../lib/play/owner.js';
import { canChange } from '../../../lib/play/roles.js';
import { readSmallJson } from '../../../lib/play/request.js';

/**
 * One game's level and favourite star, saved when a grown-up changes one.
 *
 * **Sharing with other websites is off, and it is off by omission.** No response
 * here carries `Access-Control-Allow-Origin`, so a browser refuses to hand this
 * app's answers to a page on another site. Only `POST` is answered: the pages
 * read the choices on the server as they open.
 *
 * The owner is chosen on the server, never taken from the request, and only a
 * role that may change the app's choices saves (`lib/play/roles.js`). Refusals
 * travel as message keys, never as sentences.
 */
export const dynamic = 'force-dynamic';

/**
 * @param {unknown} body
 * @param {number} status
 */
function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}

/** The status of a refusal, by its message key; any other is 400. */
const STATUS = Object.freeze({ 'error.saveUnconfirmed': 503, 'error.cannotChange': 403, 'error.storageUnreadable': 503, 'error.saveFailed': 500 });

/** @param {unknown} error */
function refusal(error) {
  if (error instanceof DataError) return json({ problem: error.messageKey }, STATUS[error.messageKey] ?? 400);
  return json({ problem: 'error.saveFailed' }, 500);
}

/** @param {Request} request */
export async function POST(request) {
  const payload = await readSmallJson(request);
  if (payload === undefined) return json({ problem: REFUSED }, 415);
  try {
    const person = await currentPerson();
    if (!canChange(person.role)) return json({ problem: 'error.cannotChange' }, 403);
    return json({ choice: await saveChoiceFor(currentOwner(), payload) });
  } catch (error) {
    return refusal(error);
  }
}

/** No cross-origin preflight is answered: another site's request gets no sharing header. */
export function OPTIONS() {
  return new Response(null, { status: 405, headers: { allow: 'POST' } });
}
