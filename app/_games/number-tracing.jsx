'use client';

/**
 * Number tracing: trace a number over its faint shape.
 * Easy 0 to 5 on a wide path with the centre line shown, Normal 0 to 9, Hard 10
 * to 20 on a narrow path. The board is the shared `trace-board.jsx`; this game
 * chooses the numbers and says them.
 *
 * A review case may name the first number in the address (`?glyph=1`); a number
 * the level does not have is ignored, and every later number is random.
 */

import { useCallback, useEffect, useState } from 'react';

import { t } from '../../lib/i18n/index.js';
import { firstGlyph, nextGlyph, rulesFor } from '../../lib/games/number-tracing.js';

import { useLater } from './parts.jsx';
import TraceBoard from './trace-board.jsx';

/** How long a traced number shows before the next, in milliseconds. */
const NEXT_MS = 1300;

/** The first glyph a review case asked for in the address, or null. */
function wantedGlyph() {
  if (typeof window === 'undefined') return null;
  return new URLSearchParams(window.location.search).get('glyph');
}

/** @param {{ level: string, locale: string, play: any, over: boolean }} props */
export default function NumberTracing({ level, locale, play, over }) {
  const rules = rulesFor(level);
  const [round, setRound] = useState(() => ({ id: 0, glyph: firstGlyph(level, wantedGlyph()) }));
  const later = useLater();

  const prompt = t('games.number-tracing.prompt', locale, { n: round.glyph });

  // Say the number when a round starts.
  useEffect(() => {
    play.say(prompt);
    // Only when the round changes; `prompt` follows the round.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round, play]);

  const next = useCallback(() => {
    setRound((current) => ({ id: current.id + 1, glyph: nextGlyph(level, current.glyph) }));
  }, [level]);

  const traced = useCallback(() => {
    play.right();
    play.praise();
    later(() => {
      if (!play.isOver()) next();
    }, NEXT_MS);
  }, [later, next, play]);

  const leave = useCallback(() => {
    play.miss();
    play.say(t('games.number-tracing.offPath', locale));
  }, [locale, play]);

  const missingPart = useCallback(() => play.say(t('games.number-tracing.littlePart', locale)), [locale, play]);

  return (
    <div className="nt" data-glyph={round.glyph}>
      <TraceBoard
        key={round.id}
        glyph={round.glyph}
        path={rules.path}
        guide={rules.guide}
        prompt={prompt}
        locale={locale}
        words={{
          board: t('games.number-tracing.board', locale, { n: round.glyph }),
          meter: t('games.number-tracing.meter', locale),
          redo: t('games.number-tracing.redo', locale),
          skip: t('games.number-tracing.skip', locale),
        }}
        over={over}
        onHear={() => play.say(prompt)}
        onLeave={leave}
        onMissingPart={missingPart}
        onTraced={traced}
        onSkip={next}
      />
    </div>
  );
}
