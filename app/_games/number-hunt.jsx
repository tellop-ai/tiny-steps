'use client';

/**
 * Number hunt: a board of number tiles
 * 1 to N in a random layout; the game asks for one number and the child taps
 * its tile. The ask order (in order, random, random with the tiles moving) is
 * in `lib/games/number-hunt.js`. A right tile bursts; a wrong tile shakes and
 * stays pressable (it may be the next ask). An ask with no right answer for
 * eight seconds makes the wanted tile glow softly until it is found.
 */

import { useEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';

import { t } from '../../lib/i18n/index.js';
import { HINT_MS, NEXT_ASK_MS, isRight, markOf, nextHunt, rulesFor, startHunt } from '../../lib/games/number-hunt.js';

import { Prompt, useFlash, useLater } from './parts.jsx';

/** How long a wrong tile shakes, in milliseconds. */
const SHAKE_MS = 450;

/** @param {{ level: string, locale: string, play: any, over: boolean }} props */
export default function NumberHunt({ level, locale, play, over }) {
  const rules = rulesFor(level);
  const [hunt, setHunt] = useState(() => startHunt(level));
  /** Counts the asks, so the spoken question and the glow's wait start again with each one. */
  const [ask, setAsk] = useState(0);
  /** Counts the layouts, so the tiles pop in again when they change places. */
  const [board, setBoard] = useState(0);
  const [found, setFound] = useState(/** @type {number | null} */ (null));
  const [shaking, setShaking] = useFlash(SHAKE_MS);
  const [hint, setHint] = useState(false);
  const later = useLater();
  const busy = useRef(false);

  const prompt = t('games.number-hunt.prompt', locale, { n: String(hunt.wanted) });

  // Say the question when an ask starts.
  useEffect(() => {
    play.say(prompt);
    // Only when the ask changes; `prompt` follows the ask.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ask, play]);

  // The glow's wait: it starts again with each ask and stops when the run is over.
  useEffect(() => {
    if (over) return undefined;
    const timer = setTimeout(() => setHint(true), HINT_MS);
    return () => clearTimeout(timer);
  }, [ask, over]);

  /** The next ask after `done` was found (nothing else changes the hunt while a find shows). */
  function next(done) {
    const following = nextHunt(level, done);
    busy.current = false;
    setFound(null);
    setHint(false);
    if (following.layout !== done.layout) setBoard((count) => count + 1);
    setHunt(following);
    setAsk((count) => count + 1);
  }

  function choose(number) {
    if (over || busy.current) return;
    if (isRight(hunt, number)) {
      busy.current = true;
      setFound(number);
      play.say(t('games.number-hunt.found', locale, { n: String(number) }));
      play.right();
      later(() => {
        if (!play.isOver()) next(hunt);
      }, NEXT_ASK_MS);
    } else {
      setShaking(number);
      play.say(t('games.number-hunt.notThat', locale, { n: String(number) }));
      play.miss();
    }
  }

  return (
    <div className="nh">
      <Prompt text={prompt} locale={locale} onHear={() => play.say(prompt)} />
      <div className="nh-board" data-count={rules.count} role="group" aria-label={t('games.number-hunt.board', locale)}>
        {hunt.layout.map((number) => {
          const wanted = number === hunt.wanted;
          let state = 'idle';
          if (found === number) state = 'right';
          else if (shaking === number) state = 'wrong';
          return (
            <Button
              key={`${board}-${number}`}
              type="button"
              variant="outline"
              className="nh-tile"
              data-mark={markOf(number)}
              data-state={state}
              data-hint={(hint && wanted && !over && found === null) || undefined}
              data-answer={wanted ? 'true' : 'false'}
              aria-label={String(number)}
              aria-disabled={over || undefined}
              onClick={() => choose(number)}
            >
              <span className="nh-number">{number}</span>
            </Button>
          );
        })}
      </div>
    </div>
  );
}
