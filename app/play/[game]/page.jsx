import { notFound } from 'next/navigation';

import { DataError } from '../../../lib/data/index.js';
import { CHOICE_DEFAULTS, SETTINGS_DEFAULTS, readChoiceFor, readSettingsFor } from '../../../lib/data/play.js';
import { currentPerson } from '../../../lib/data/person.js';
import { getLocale } from '../../../lib/i18n/index.js';
import { gameById } from '../../../lib/play/catalog.js';
import { currentOwner } from '../../../lib/play/owner.js';
import { canChange } from '../../../lib/play/roles.js';
import { PlaySettingsProvider } from '../../play-settings.jsx';
import { GameFrame } from '../game-frame.jsx';

/**
 * One game. An id that is not one of the fifteen answers the
 * not-found page. Opening it only reads: the settings and this game's level and
 * star, or the defaults.
 *
 * Previous and Next move between games without leaving this page, so the
 * frame is keyed by the game: each game starts at its start card with its own
 * saved level, never in the middle of the last game's run.
 */
export const dynamic = 'force-dynamic';

export default async function GamePage({ params }) {
  const { game: id } = await params;
  const game = gameById(id);
  if (game === null) notFound();
  const appLocale = getLocale();
  let saving = false;
  let problem = null;
  let settings = { ...SETTINGS_DEFAULTS };
  let choice = { ...CHOICE_DEFAULTS };
  try {
    const person = await currentPerson();
    settings = await readSettingsFor(currentOwner());
    choice = await readChoiceFor(currentOwner(), game.id);
    saving = canChange(person.role);
  } catch (error) {
    problem = error instanceof DataError ? error.messageKey : 'error.storageUnreadable';
    saving = false;
  }
  return (
    <main className="game-page" data-tellop-app-marker="ok" data-game={game.id}>
      <PlaySettingsProvider key={game.id} initialSettings={settings} initialChoices={{ [game.id]: choice }} canChange={saving} appLocale={appLocale}>
        <GameFrame gameId={game.id} problem={problem} />
      </PlaySettingsProvider>
    </main>
  );
}
