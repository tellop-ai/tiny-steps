import { DataError } from '../lib/data/index.js';
import { CHOICE_DEFAULTS, SETTINGS_DEFAULTS, readChoicesFor, readSettingsFor } from '../lib/data/play.js';
import { currentPerson } from '../lib/data/person.js';
import { getLocale } from '../lib/i18n/index.js';
import { GAME_IDS } from '../lib/play/catalog.js';
import { currentOwner } from '../lib/play/owner.js';
import { canChange } from '../lib/play/roles.js';

import { HomeScreen } from './home-screen.jsx';
import { PlaySettingsProvider } from './play-settings.jsx';

/**
 * The home page: every game in its group, the favourites, the grown-ups window.
 *
 * `data-tellop-app-marker` is what Tellop's health probe looks for: keep it on
 * the outermost element of the first page.
 *
 * Opening it only reads (`AGENTS.md` rule 4a): the saved choices, or the
 * defaults when nothing is saved. When the host cannot say who is playing, or
 * the choices cannot be read, the games still play with the defaults, nothing
 * can be saved, and the page says why.
 */
export const dynamic = 'force-dynamic';

export default async function Page() {
  const appLocale = getLocale();
  let saving = false;
  let problem = null;
  let settings = { ...SETTINGS_DEFAULTS };
  let choices = Object.fromEntries(GAME_IDS.map((id) => [id, { ...CHOICE_DEFAULTS }]));
  try {
    const person = await currentPerson();
    settings = await readSettingsFor(currentOwner());
    choices = await readChoicesFor(currentOwner());
    saving = canChange(person.role);
  } catch (error) {
    problem = error instanceof DataError ? error.messageKey : 'error.storageUnreadable';
    saving = false;
  }
  return (
    <main className="home-page" data-tellop-app-marker="ok">
      <PlaySettingsProvider initialSettings={settings} initialChoices={choices} canChange={saving} appLocale={appLocale}>
        <HomeScreen problem={problem} />
      </PlaySettingsProvider>
    </main>
  );
}
