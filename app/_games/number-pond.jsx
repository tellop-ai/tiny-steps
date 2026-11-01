'use client';

/**
 * Number pond: fish swim across a pond,
 * each in its own lane, wrapping round and bobbing; each carries a number.
 * The game asks for one number and the child catches the fish carrying it.
 *
 * Motion is one `requestAnimationFrame` loop that writes each fish's place
 * through the CSSOM (`element.style.transform`), so React renders once per
 * round, never per frame. The loop stops when the run is over and when the
 * game leaves. Lanes, speeds and the numbers are in `lib/games/number-pond.js`.
 */

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

import { t } from '../../lib/i18n/index.js';
import {
  NEXT_ROUND_MS,
  bobAt,
  bodyShare,
  isRight,
  makeRound,
  makeSchool,
  middleInView,
  pickCarrier,
  progressAt,
} from '../../lib/games/number-pond.js';

import { Prompt, useFlash, useLater } from './parts.jsx';

/** How long a wrong fish wiggles, in milliseconds. */
const WIGGLE_MS = 500;
/** How far a fish bobs, as a share of its own height. */
const BOB_SHARE = 0.07;
/** A first guess at a fish's share of its trip, until the pond has been measured. */
const FIRST_SHARE = 0.25;

/** @param {{ level: string, locale: string, play: any, over: boolean }} props */
export default function NumberPond({ level, locale, play, over }) {
  const [school] = useState(() => makeSchool(level));
  const [round, setRound] = useState(() => ({ id: 0, ...makeRound(level, null, pickCarrier(school, 0, FIRST_SHARE)) }));
  const [caught, setCaught] = useState(/** @type {number | null} */ (null));
  const [wiggling, setWiggling] = useFlash(WIGGLE_MS);
  const later = useLater();
  const busy = useRef(false);

  /** When the fish started swimming (`performance.now()`), and how fast time runs for them. */
  const clock = useRef({ startedAt: 0, pace: 1, started: false });
  /** The latest measured share of a trip a fish's body takes. */
  const share = useRef(FIRST_SHARE);
  /** @type {React.MutableRefObject<(HTMLElement | null)[]>} */
  const fishes = useRef([]);
  const pond = useRef(/** @type {HTMLDivElement | null} */ (null));

  const prompt = t('games.number-pond.prompt', locale, { n: String(round.wanted) });

  const swimSeconds = useCallback(() => {
    const now = clock.current;
    return now.started ? ((performance.now() - now.startedAt) / 1000) * now.pace : 0;
  }, []);

  // Say the question when a round starts.
  useEffect(() => {
    play.say(prompt);
    // Only when the round changes; `prompt` follows the round.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round.id, play]);

  // The swimming: one loop, placing every fish through the CSSOM. Placed once
  // before the first paint, then every frame until the run is over or the game leaves.
  useLayoutEffect(() => {
    if (over) return undefined;
    if (!clock.current.started) {
      const still = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      clock.current = { startedAt: performance.now(), pace: still ? 0.5 : 1, started: true };
    }
    const still = clock.current.pace < 1;
    let frame = 0;
    const place = () => {
      const seconds = swimSeconds();
      const pondWidth = pond.current?.clientWidth ?? 0;
      school.forEach((fish, index) => {
        const element = fishes.current[index];
        if (!element) return;
        const fishWidth = element.offsetWidth;
        const progress = progressAt(fish, seconds);
        const x = progress * (pondWidth + fishWidth) - fishWidth;
        const y = still ? 0 : bobAt(fish, seconds) * element.offsetHeight * BOB_SHARE;
        element.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
        const fishShare = bodyShare(pondWidth, fishWidth);
        if (fishShare > 0) share.current = fishShare;
        const inView = middleInView(progress, fishShare);
        if (inView && !element.hasAttribute('data-in-view')) element.setAttribute('data-in-view', 'true');
        else if (!inView && element.hasAttribute('data-in-view')) element.removeAttribute('data-in-view');
      });
    };
    const loop = () => {
      place();
      frame = requestAnimationFrame(loop);
    };
    place();
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [over, school, swimSeconds]);

  /** The next round: new numbers on every fish, the wanted one on a fish that stays to be caught. */
  function next(lastWanted) {
    busy.current = false;
    setCaught(null);
    const fresh = makeRound(level, lastWanted, pickCarrier(school, swimSeconds(), share.current));
    setRound((current) => ({ id: current.id + 1, ...fresh }));
  }

  function choose(index) {
    if (over || busy.current) return;
    if (isRight(round, index)) {
      busy.current = true;
      setCaught(index);
      play.praise();
      play.right();
      later(() => {
        if (!play.isOver()) next(round.wanted);
      }, NEXT_ROUND_MS);
    } else {
      setWiggling(index);
      play.say(t('games.number-pond.notThat', locale, { n: String(round.numbers[index]) }));
      play.miss();
    }
  }

  return (
    <div className="np">
      <Prompt text={prompt} locale={locale} onHear={() => play.say(prompt)} />
      <div
        ref={pond}
        className="np-pond"
        data-count={school.length}
        role="group"
        aria-label={t('games.number-pond.pond', locale)}
      >
        {school.map((fish, index) => {
          const number = round.numbers[index];
          let state = 'idle';
          if (caught === index) state = 'caught';
          else if (wiggling === index) state = 'wrong';
          return (
            <div
              key={fish.lane}
              ref={(element) => {
                fishes.current[index] = element;
              }}
              className="np-fish"
              role="button"
              tabIndex={over ? -1 : 0}
              aria-label={t('games.number-pond.fish', locale, { n: String(number) })}
              aria-disabled={over || undefined}
              data-lane={fish.lane}
              data-mark={fish.mark}
              data-dir={fish.direction > 0 ? 'right' : 'left'}
              data-state={state}
              data-answer={number === round.wanted ? 'true' : 'false'}
              onPointerDown={(event) => {
                if (event.button > 0) return;
                choose(index);
              }}
              onClick={(event) => {
                // A click with no pointer press (a screen reader's): the pointer way already chose.
                if (event.detail === 0) choose(index);
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  choose(index);
                }
              }}
            >
              <div className="np-body" key={round.id}>
                <svg className="np-shape" viewBox="0 0 160 100" aria-hidden="true">
                  <path className="np-tail" d="M6 16 Q24 50 6 84 L48 50 Z" />
                  <path className="np-fin" d="M66 20 Q88 -2 114 20 Z" />
                  <path className="np-fin" d="M74 84 Q88 100 104 86 Z" />
                  <ellipse className="np-skin" cx="90" cy="52" rx="62" ry="38" />
                  <circle className="np-eye" cx="128" cy="42" r="9" />
                  <circle className="np-pupil" cx="130" cy="42" r="4.5" />
                  <path className="np-mouth" d="M147 60 Q141 65 134 62" />
                  <circle className="np-badge" cx="80" cy="54" r="27" />
                </svg>
                <span className="np-number" aria-hidden="true">
                  {number}
                </span>
              </div>
              {state === 'caught' ? <span className="np-splash" aria-hidden="true" /> : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
