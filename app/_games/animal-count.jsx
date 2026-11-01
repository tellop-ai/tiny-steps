'use client';

/**
 * Animal count: animals of one kind walk into a meadow
 * one by one and settle without covering each other; the child may tap each to
 * count it, then picks how many came.
 *
 * Where the animals rest is `meadowSpots` (`lib/games/animal-count.js`). Their
 * walk is a CSS transition: the places are written through the CSSOM in an
 * effect (`--ac-x`, `--ac-y`), never as a style object while the screen renders.
 */

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

import { t } from '../../lib/i18n/index.js';
import { ANIMALS, entryPlan, makeRound, meadowSpots, scaleMeadow } from '../../lib/games/animal-count.js';

import { Choice, ChoiceGrid, Prompt, useLater } from './parts.jsx';

/** How long a right answer shows before the next animals come, in milliseconds. */
const NEXT_ROUND_MS = 1500;

/** A short rest after the last animal settles before the question, in milliseconds. */
const SETTLE_MS = 200;

/** A size change smaller than this many pixels does not move the animals. */
const RESIZE_SLACK_PX = 2;

/**
 * Writes where each animal is, through the CSSOM.
 *
 * @param {HTMLElement[]} animals
 * @param {{ size: number, spots: { x: number, y: number }[] }} layout
 */
function placeAll(animals, layout) {
  layout.spots.forEach((spot, at) => {
    const animal = animals[at];
    if (!animal) return;
    animal.style.setProperty('--ac-x', `${spot.x - layout.size / 2}px`);
    animal.style.setProperty('--ac-y', `${spot.y - layout.size / 2}px`);
  });
}

/** @param {{ level: string, locale: string, play: any, over: boolean }} props */
export default function AnimalCount({ level, locale, play, over }) {
  const [round, setRound] = useState(() => ({ ...makeRound(level, null), key: 0 }));
  const [phase, setPhase] = useState(/** @type {'walk' | 'ask'} */ ('walk'));
  /** The animals tapped so far, in the order they were counted. */
  const [counted, setCounted] = useState(/** @type {number[]} */ ([]));
  /** Each answer's state this round: 'right' | 'wrong'. */
  const [marks, setMarks] = useState(/** @type {Record<number, 'right' | 'wrong'>} */ ({}));
  const later = useLater();
  const busy = useRef(false);
  const countedRef = useRef(/** @type {number[]} */ ([]));
  const roundKey = useRef(0);
  const meadowRef = useRef(/** @type {HTMLDivElement | null} */ (null));

  const one = t(`games.animal-count.one.${round.animal}`, locale);
  const many = t(`games.animal-count.many.${round.animal}`, locale);
  const prompt =
    phase === 'walk'
      ? t('games.animal-count.watch', locale)
      : t('games.animal-count.ask', locale, { one, many });

  // Say what to do when the animals start walking, and the question once they are in.
  useEffect(() => {
    play.say(prompt);
    // Only when the round or its step changes; `prompt` follows them.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round, phase, play]);

  // Walk the animals in: each starts just outside the nearer side, then walks to its spot.
  useLayoutEffect(() => {
    const meadow = meadowRef.current;
    if (!meadow) return undefined;
    roundKey.current = round.key;
    const animals = /** @type {HTMLElement[]} */ ([...meadow.querySelectorAll('.ac-animal')]);
    const plan = entryPlan(round.count);
    let box = { width: meadow.clientWidth, height: meadow.clientHeight };
    let frame = 0;
    /** @type {ReturnType<typeof meadowSpots> | null} */
    let layout = null;

    if (box.width > 0 && box.height > 0) {
      layout = meadowSpots(round.count, box);
      meadow.style.setProperty('--ac-size', `${layout.size}px`);
      layout.spots.forEach((spot, at) => {
        const animal = animals[at];
        if (!animal) return;
        const startX = spot.from === 'left' ? -layout.size * 1.3 : box.width + layout.size * 0.3;
        animal.style.setProperty('--ac-delay', `${plan.delays[at]}ms`);
        animal.style.setProperty('--ac-walk', `${plan.walkMs}ms`);
        animal.style.setProperty('--ac-x', `${startX}px`);
        animal.style.setProperty('--ac-y', `${spot.y - layout.size / 2}px`);
      });
      // Let the start places take hold, then walk.
      meadow.getBoundingClientRect();
      const walking = layout;
      frame = requestAnimationFrame(() => {
        for (const animal of animals) animal.setAttribute('data-go', 'true');
        placeAll(animals, walking);
      });
    }

    later(() => {
      if (roundKey.current === round.key) setPhase('ask');
    }, plan.totalMs + SETTLE_MS);

    // If the window changes size, the animals keep their places relative to the meadow.
    const watcher = new ResizeObserver(() => {
      const now = { width: meadow.clientWidth, height: meadow.clientHeight };
      if (now.width <= 0 || now.height <= 0) return;
      if (Math.abs(now.width - box.width) <= RESIZE_SLACK_PX && Math.abs(now.height - box.height) <= RESIZE_SLACK_PX) return;
      layout = layout ? scaleMeadow(layout, box, now) : meadowSpots(round.count, now);
      box = now;
      meadow.style.setProperty('--ac-size', `${layout.size}px`);
      for (const animal of animals) {
        animal.style.setProperty('--ac-delay', '0ms');
        animal.setAttribute('data-go', 'true');
      }
      placeAll(animals, layout);
    });
    watcher.observe(meadow);

    return () => {
      cancelAnimationFrame(frame);
      watcher.disconnect();
    };
  }, [round, later]);

  const next = useCallback(() => {
    busy.current = false;
    countedRef.current = [];
    setCounted([]);
    setMarks({});
    setPhase('walk');
    setRound((current) => ({ ...makeRound(level, current.animal), key: current.key + 1 }));
  }, [level]);

  function count(at) {
    if (over || busy.current || countedRef.current.includes(at)) return;
    countedRef.current = [...countedRef.current, at];
    setCounted(countedRef.current);
    play.sound('tap');
    play.say(String(countedRef.current.length));
  }

  function choose(value) {
    if (over || busy.current || phase !== 'ask' || marks[value]) return;
    if (value === round.count) {
      busy.current = true;
      setMarks((all) => ({ ...all, [value]: 'right' }));
      play.praise();
      play.right();
      later(() => {
        if (!play.isOver()) next();
      }, NEXT_ROUND_MS);
    } else {
      setMarks((all) => ({ ...all, [value]: 'wrong' }));
      play.say(t('play.tryAgain', locale));
      play.miss();
    }
  }

  return (
    <div className="ac" data-phase={phase}>
      <div className="ac-meadow" ref={meadowRef} role="group" aria-label={t('games.animal-count.meadow', locale)}>
        {Array.from({ length: round.count }, (_, at) => {
          const badge = counted.indexOf(at) + 1;
          return (
            <div
              key={`${round.key}-${at}`}
              className="ac-animal"
              role="button"
              tabIndex={over ? -1 : 0}
              aria-label={
                badge > 0
                  ? t('games.animal-count.counted', locale, { one, n: String(badge) })
                  : t('games.animal-count.animal', locale, { one })
              }
              data-counted={badge > 0 || undefined}
              onClick={() => count(at)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  count(at);
                }
              }}
            >
              <span className="ac-body" aria-hidden="true">
                {ANIMALS[round.animal]}
              </span>
              {badge > 0 ? (
                <span className="ac-badge" aria-hidden="true">
                  {badge}
                </span>
              ) : null}
            </div>
          );
        })}
      </div>
      <Prompt text={prompt} locale={locale} onHear={() => play.say(prompt)} className="ac-prompt" />
      <div className="ac-answer-area" data-waiting={phase === 'walk' || undefined}>
        <ChoiceGrid count={round.answers.length} className="ac-answers">
          {round.answers.map((value) => (
            <Choice
              key={`${round.key}-${value}`}
              label={String(value)}
              state={marks[value] ?? 'idle'}
              disabled={over || phase !== 'ask'}
              onPress={() => choose(value)}
            >
              <span className="ac-number" data-answer={value === round.count ? 'true' : 'false'}>
                {value}
              </span>
            </Choice>
          ))}
        </ChoiceGrid>
      </div>
    </div>
  );
}
