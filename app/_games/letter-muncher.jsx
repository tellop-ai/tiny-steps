'use client';

/**
 * Letter muncher: a round one-eyed monster asks for a letter in its
 * speech bubble; the child drags that letter's tile into its mouth (or taps
 * the tile, then the monster). The screen shows the letter; the voice says
 * its name (`nameOf`), since a bare capital is often read as a word. The
 * monster is drawn from simple shapes in the look's own tokens; its mood
 * (hungry, chomp, no) is a class, never a style.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import { t } from '../../lib/i18n/index.js';
import { nameOf } from '../../lib/games/letters.js';
import { isRight, makeRound, tileOf } from '../../lib/games/letter-muncher.js';

import { Prompt, useDrag, useFlash, useLater } from './parts.jsx';

/** How long a right answer shows before the next letter, in milliseconds. */
const NEXT_ROUND_MS = 1400;
/** How long the monster shakes its head after a wrong tile, in milliseconds. */
const NO_MS = 800;

/** @param {{ level: string, locale: string, play: any, over: boolean }} props */
export default function LetterMuncher({ level, locale, play, over }) {
  const [round, setRound] = useState(() => makeRound(level, locale, null));
  const [turn, setTurn] = useState(0);
  /** The tile the monster ate this round, or null. */
  const [eaten, setEaten] = useState(/** @type {string | null} */ (null));
  /** The tile just refused, for a moment. */
  const [refused, setRefused] = useFlash(NO_MS);
  const later = useLater();
  const busy = useRef(false);

  const wantedName = nameOf(round.wanted, locale);
  const shownPrompt = t('games.letter-muncher.ask', locale, { letter: round.shown });
  const spokenPrompt = t('games.letter-muncher.ask', locale, { letter: wantedName });
  const mood = eaten !== null ? 'chomp' : refused !== null ? 'no' : 'hungry';

  // Say the question when a round starts.
  useEffect(() => {
    play.say(spokenPrompt);
    // Only when the round changes; the words follow the round.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round, play]);

  const next = useCallback(() => {
    busy.current = false;
    setEaten(null);
    setRefused(null);
    setRound((current) => makeRound(level, locale, current.wanted));
    setTurn((count) => count + 1);
  }, [level, locale, setRefused]);

  function feed(tileId) {
    if (over || busy.current || play.isOver()) return;
    const tile = tileOf(round, tileId);
    if (tile === null) return;
    if (isRight(round, tileId)) {
      busy.current = true;
      setRefused(null);
      setEaten(tileId);
      play.right();
      later(() => {
        if (!play.isOver()) next();
      }, NEXT_ROUND_MS);
    } else {
      setRefused(tileId);
      play.say(t('games.letter-muncher.notThat', locale, { name: nameOf(tile.letter, locale), wanted: wantedName }));
      play.miss();
    }
  }

  const drag = useDrag({ onDrop: (pieceId) => feed(pieceId), disabled: over });

  return (
    <div className="lm" data-mood={mood}>
      <div className="lm-scene">
        <div className="lm-monster" {...drag.targetProps('mouth', t('games.letter-muncher.monster', locale))}>
          <svg className="lm-art" viewBox="0 0 220 214" aria-hidden="true">
            <path className="lm-stalk" d="M88 52 Q78 32 66 20 M132 52 Q142 32 154 20" />
            <circle className="lm-bobble" cx="64" cy="18" r="11" />
            <circle className="lm-bobble" cx="156" cy="18" r="11" />
            <ellipse className="lm-foot" cx="76" cy="200" rx="24" ry="11" />
            <ellipse className="lm-foot" cx="144" cy="200" rx="24" ry="11" />
            <path className="lm-arm" d="M30 128 Q8 120 12 98 M190 128 Q212 120 208 98" />
            <circle className="lm-body" cx="110" cy="118" r="84" />
            <circle className="lm-spot" cx="46" cy="96" r="9" />
            <circle className="lm-spot" cx="176" cy="150" r="8" />
            <circle className="lm-spot" cx="58" cy="160" r="6" />
            <circle className="lm-spot" cx="170" cy="82" r="6" />
            <g className="lm-eye-open">
              <circle className="lm-eye" cx="110" cy="76" r="28" />
              <circle className="lm-pupil" cx="110" cy="82" r="13" />
              <circle className="lm-shine" cx="115" cy="76" r="4.5" />
              <path className="lm-lid" d="M80 72 A30 30 0 0 1 140 72 Z" />
            </g>
            <path className="lm-eye-happy" d="M84 82 Q110 54 136 82" />
            <g className="lm-mouth">
              <path className="lm-mouth-inside" d="M58 122 Q110 116 162 122 Q158 186 110 188 Q62 186 58 122 Z" />
              <ellipse className="lm-tongue" cx="110" cy="172" rx="26" ry="11" />
              <path className="lm-tooth" d="M80 121 L96 120 L88 136 Z M124 120 L140 121 L132 136 Z" />
            </g>
          </svg>
        </div>
        <div className="lm-bubble" key={turn} aria-hidden="true">
          <span className="lm-bubble-letter">{round.shown}</span>
        </div>
      </div>
      <Prompt text={shownPrompt} locale={locale} onHear={() => play.say(spokenPrompt)} />
      <div className="lm-tray" data-count={round.tiles.length} key={`tray-${turn}`}>
        {round.tiles.map((tile, index) => (
          <div
            key={tile.id}
            {...drag.piece(tile.id, tile.shown)}
            className="drag-piece lm-tile"
            data-mark={`chart-${((index + 2) % 5) + 1}`}
            data-answer={tile.letter === round.wanted ? 'true' : 'false'}
            data-eaten={eaten === tile.id || undefined}
            data-refused={refused === tile.id || undefined}
          >
            <span className="lm-tile-letter">{tile.shown}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
