'use client';

/**
 * Letter tracing: trace a letter of the app language's
 * alphabet over its faint shape. Easy capitals on a wide path with the centre
 * line shown, Normal capitals, Hard small letters on a narrow path. The voice
 * says the letter's name (`nameOf`); a dot or a cedilla must be traced too. The
 * board is the shared `trace-board.jsx`; this game chooses the letters.
 *
 * A review case may name the first letter in the address (`?glyph=I`); a letter
 * the level does not have is ignored, and every later letter is random.
 */

import { useCallback, useEffect, useState } from 'react';

import { t } from '../../lib/i18n/index.js';
import { nameOf } from '../../lib/games/letters.js';
import { firstGlyph, nextGlyph, rulesFor } from '../../lib/games/letter-tracing.js';

import { useLater } from './parts.jsx';
import TraceBoard from './trace-board.jsx';

/** How long a traced letter shows before the next, in milliseconds. */
const NEXT_MS = 1300;

/** The first glyph a review case asked for in the address, or null. */
function wantedGlyph() {
  if (typeof window === 'undefined') return null;
  return new URLSearchParams(window.location.search).get('glyph');
}

/** @param {{ level: string, locale: string, play: any, over: boolean }} props */
export default function LetterTracing({ level, locale, play, over }) {
  const rules = rulesFor(level);
  const [round, setRound] = useState(() => ({ id: 0, glyph: firstGlyph(level, locale, wantedGlyph()) }));
  const later = useLater();

  const key = rules.small ? 'games.letter-tracing.promptSmall' : 'games.letter-tracing.prompt';
  const prompt = t(key, locale, { letter: round.glyph });
  const spoken = t(key, locale, { letter: nameOf(round.glyph, locale) });

  // Say the letter's name when a round starts.
  useEffect(() => {
    play.say(spoken);
    // Only when the round changes; `spoken` follows the round.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round, play]);

  const next = useCallback(() => {
    setRound((current) => ({ id: current.id + 1, glyph: nextGlyph(level, locale, current.glyph) }));
  }, [level, locale]);

  const traced = useCallback(() => {
    play.right();
    play.praise();
    later(() => {
      if (!play.isOver()) next();
    }, NEXT_MS);
  }, [later, next, play]);

  const leave = useCallback(() => {
    play.miss();
    play.say(t('games.letter-tracing.offPath', locale));
  }, [locale, play]);

  const missingPart = useCallback(() => play.say(t('games.letter-tracing.littlePart', locale)), [locale, play]);

  return (
    <div className="lt" data-glyph={round.glyph}>
      <TraceBoard
        key={round.id}
        glyph={round.glyph}
        path={rules.path}
        guide={rules.guide}
        prompt={prompt}
        locale={locale}
        words={{
          board: t('games.letter-tracing.board', locale, { letter: round.glyph }),
          meter: t('games.letter-tracing.meter', locale),
          redo: t('games.letter-tracing.redo', locale),
          skip: t('games.letter-tracing.skip', locale),
        }}
        over={over}
        onHear={() => play.say(spoken)}
        onLeave={leave}
        onMissingPart={missingPart}
        onTraced={traced}
        onSkip={next}
      />
    </div>
  );
}
