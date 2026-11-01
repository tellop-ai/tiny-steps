'use client';

/**
 * Dot to dot: numbered dots on a square
 * board; the child taps them in order, a line joins each to the last, and the
 * last dot closes the picture, which fills softly and is named. Drawn in SVG
 * from the look's tokens; dots have a tap area larger than the dot itself.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { t } from '../../lib/i18n/index.js';
import { PICTURES, dotSizes, glows, isComplete, markOf, nextPicture, tapResult } from '../../lib/games/dot-to-dot.js';

import { Prompt, useFlash, useLater } from './parts.jsx';

/** How long a finished picture shows before the next one, in milliseconds. */
const NEXT_PICTURE_MS = 1800;

/** @param {{ level: string, locale: string, play: any, over: boolean }} props */
export default function DotToDot({ level, locale, play, over }) {
  const [picture, setPicture] = useState(() => nextPicture(level, null));
  const [joined, setJoined] = useState(0);
  const [shaking, setShaking] = useFlash(450);
  const later = useLater();
  const busy = useRef(false);

  const count = picture.points.length;
  const done = isComplete(joined, count);
  const sizes = useMemo(() => dotSizes(picture.points), [picture]);
  const fillMark = `chart-${(PICTURES.indexOf(picture) % 5) + 1}`;
  const glow = glows(level) && !done;

  const name = t(`games.dot-to-dot.pic.${picture.id}`, locale);
  const prompt = done
    ? name
    : joined === 0
      ? t('games.dot-to-dot.start', locale)
      : t('games.dot-to-dot.next', locale, { n: String(joined + 1) });

  // Say how to start when a picture starts.
  useEffect(() => {
    play.say(t('games.dot-to-dot.start', locale));
    // Only when the picture changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [picture, play]);

  const next = useCallback(() => {
    busy.current = false;
    setJoined(0);
    setPicture((current) => nextPicture(level, current.id));
  }, [level]);

  function tap(index) {
    if (over || busy.current || play.isOver()) return;
    const result = tapResult(joined, index, count);
    if (result === 'done') return;
    if (result === 'miss') {
      setShaking(index);
      play.say(t('games.dot-to-dot.notThat', locale, { m: String(index + 1), n: String(joined + 1) }));
      play.miss();
      return;
    }
    const now = joined + 1;
    setJoined(now);
    play.right();
    if (isComplete(now, count)) {
      busy.current = true;
      play.say(name);
      later(() => {
        if (!play.isOver()) next();
      }, NEXT_PICTURE_MS);
    } else {
      play.say(String(now));
    }
  }

  const points = picture.points;
  const lines = [];
  for (let index = 1; index < Math.min(joined, count); index += 1) lines.push(index);

  return (
    <div className="dd" data-done={done || undefined}>
      <Prompt text={prompt} locale={locale} onHear={() => play.say(prompt)} />
      <div className="dd-stage">
        <svg
          className="dd-board"
          viewBox="0 0 100 100"
          role="group"
          aria-label={done ? name : t('games.dot-to-dot.board', locale)}
          data-picture={picture.id}
        >
          {done ? (
            <polygon className="dd-fill" data-mark={fillMark} points={points.map((point) => point.join(',')).join(' ')} />
          ) : null}
          {lines.map((index) => (
            <line
              key={`${picture.id}-${index}`}
              className="dd-line"
              data-mark={`chart-${markOf(index)}`}
              pathLength="1"
              x1={points[index - 1][0]}
              y1={points[index - 1][1]}
              x2={points[index][0]}
              y2={points[index][1]}
            />
          ))}
          {done ? (
            <line
              className="dd-line"
              data-mark={`chart-${markOf(count)}`}
              pathLength="1"
              x1={points[count - 1][0]}
              y1={points[count - 1][1]}
              x2={points[0][0]}
              y2={points[0][1]}
            />
          ) : null}
          {points.map(([x, y], index) => {
            const state = index < joined ? 'done' : index === joined ? 'next' : 'todo';
            const label = t('games.dot-to-dot.dot', locale, { n: String(index + 1) });
            return (
              <g
                key={`${picture.id}-${index}`}
                className="dd-dot"
                role="button"
                tabIndex={over || state === 'done' ? -1 : 0}
                aria-label={label}
                aria-disabled={state === 'done' || over || undefined}
                data-n={index + 1}
                data-state={state}
                data-shake={shaking === index || undefined}
                data-answer={state === 'next' || undefined}
                onClick={() => tap(index)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    tap(index);
                  }
                }}
              >
                <circle className="dd-hit" cx={x} cy={y} r={sizes.hit} />
                {glow && state === 'next' ? <circle className="dd-glow" cx={x} cy={y} r={sizes.dot + 1.8} /> : null}
                <circle className="dd-disc" cx={x} cy={y} r={sizes.dot} />
                <text className="dd-num" x={x} y={y} fontSize={index + 1 > 9 ? sizes.dot * 1.05 : sizes.dot * 1.25}>
                  {index + 1}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
