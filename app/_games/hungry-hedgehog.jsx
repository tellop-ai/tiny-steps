'use client';

/**
 * Hungry hedgehog: the hedgehog holds up a sign with the number it
 * wants; the child drags that number's tile into it (or taps the tile, then
 * the hedgehog). The hedgehog is drawn from simple shapes in the look's own
 * tokens; its mood (hungry, happy, sad) is a class, never a style.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import { t } from '../../lib/i18n/index.js';
import { isRight, makeRound, tileOf } from '../../lib/games/hungry-hedgehog.js';

import { Prompt, useDrag, useFlash, useLater } from './parts.jsx';

/** How long a right answer shows before the next number, in milliseconds. */
const NEXT_ROUND_MS = 1000;
/** How long the sad face shows after a wrong tile, in milliseconds. */
const SAD_MS = 900;

/**
 * The spikes: a zigzag fan around the hedgehog's head, from one side over the
 * top to the other. Fixed geometry, worked out once.
 */
function spikes(cx, cy, rx, ry, inner, from, to, count) {
  const points = [];
  for (let step = 0; step <= count * 2; step += 1) {
    const angle = ((from + ((to - from) * step) / (count * 2)) * Math.PI) / 180;
    const reach = step % 2 === 0 ? inner : 1;
    points.push(`${(cx + rx * reach * Math.cos(angle)).toFixed(1)} ${(cy + ry * reach * Math.sin(angle)).toFixed(1)}`);
  }
  return `M${cx} ${cy} L${points.join(' L')} Z`;
}

const SPIKES_BACK = spikes(130, 122, 122, 104, 0.8, 160, 380, 16);
const SPIKES_FRONT = spikes(130, 126, 112, 94, 0.82, 166, 374, 17);

/** A four-pointed sparkle around a point. */
function sparkle(x, y, size) {
  return `M${x} ${y - size} Q${x} ${y} ${x + size} ${y} Q${x} ${y} ${x} ${y + size} Q${x} ${y} ${x - size} ${y} Q${x} ${y} ${x} ${y - size} Z`;
}

const SPARKLES = [sparkle(26, 56, 13), sparkle(236, 50, 12), sparkle(16, 146, 10), sparkle(246, 140, 11)];

/** @param {{ level: string, locale: string, play: any, over: boolean }} props */
export default function HungryHedgehog({ level, locale, play, over }) {
  const [round, setRound] = useState(() => makeRound(level, null));
  const [turn, setTurn] = useState(0);
  /** The tile the hedgehog ate this round, or null. */
  const [eaten, setEaten] = useState(/** @type {string | null} */ (null));
  /** The tile just refused, for a moment. */
  const [refused, setRefused] = useFlash(SAD_MS);
  const later = useLater();
  const busy = useRef(false);

  const prompt = t('games.hungry-hedgehog.prompt', locale, { n: round.wanted });
  const mood = eaten !== null ? 'happy' : refused !== null ? 'sad' : 'hungry';

  // Say the question when a round starts.
  useEffect(() => {
    play.say(prompt);
    // Only when the round changes; `prompt` follows the round.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round, play]);

  const next = useCallback(() => {
    busy.current = false;
    setEaten(null);
    setRefused(null);
    setRound((current) => makeRound(level, current.wanted));
    setTurn((count) => count + 1);
  }, [level, setRefused]);

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
      play.say(t('games.hungry-hedgehog.notThat', locale, { m: tile.value, n: round.wanted }));
      play.miss();
    }
  }

  const drag = useDrag({ onDrop: (pieceId) => feed(pieceId), disabled: over });

  return (
    <div className="hh" data-mood={mood}>
      <div className="hh-scene">
        <div className="hh-hedgehog" {...drag.targetProps('mouth', t('games.hungry-hedgehog.hedgehog', locale))}>
          <svg className="hh-art" viewBox="0 0 260 204" aria-hidden="true">
            {SPARKLES.map((path, index) => (
              <path key={index} className="hh-spark" d={path} />
            ))}
            <path className="hh-spikes-back" d={SPIKES_BACK} />
            <path className="hh-spikes" d={SPIKES_FRONT} />
            <ellipse className="hh-foot" cx="98" cy="194" rx="18" ry="8" />
            <ellipse className="hh-foot" cx="162" cy="194" rx="18" ry="8" />
            <circle className="hh-ear" cx="78" cy="78" r="14" />
            <circle className="hh-ear" cx="182" cy="78" r="14" />
            <circle className="hh-ear-inside" cx="78" cy="78" r="7" />
            <circle className="hh-ear-inside" cx="182" cy="78" r="7" />
            <ellipse className="hh-face" cx="130" cy="132" rx="82" ry="62" />
            <circle className="hh-cheek" cx="88" cy="148" r="11" />
            <circle className="hh-cheek" cx="172" cy="148" r="11" />
            <g className="hh-eyes-open">
              <circle className="hh-eye" cx="106" cy="118" r="10" />
              <circle className="hh-eye" cx="154" cy="118" r="10" />
              <circle className="hh-shine" cx="109" cy="114" r="3.5" />
              <circle className="hh-shine" cx="157" cy="114" r="3.5" />
            </g>
            <path className="hh-eyes-happy" d="M95 121 Q106 108 117 121 M143 121 Q154 108 165 121" />
            <path className="hh-brows" d="M95 107 L115 99 M165 107 L145 99" />
            <ellipse className="hh-snout" cx="130" cy="150" rx="30" ry="21" />
            <ellipse className="hh-nose" cx="130" cy="139" rx="10" ry="8" />
            <g className="hh-mouth">
              <ellipse className="hh-mouth-inside" cx="130" cy="166" rx="13" ry="10" />
              <ellipse className="hh-tongue" cx="130" cy="171" rx="7" ry="4" />
            </g>
            <path className="hh-frown" d="M118 172 Q130 161 142 172" />
          </svg>
        </div>
        <div className="hh-sign" key={turn} aria-hidden="true">
          <span className="hh-sign-number">{round.wanted}</span>
        </div>
      </div>
      <Prompt text={prompt} locale={locale} onHear={() => play.say(prompt)} />
      <div className="hh-tray" data-count={round.tiles.length} key={`tray-${turn}`}>
        {round.tiles.map((tile, index) => (
          <div
            key={tile.id}
            {...drag.piece(tile.id, t('games.hungry-hedgehog.tile', locale, { n: tile.value }))}
            className="drag-piece hh-tile"
            data-mark={`chart-${(index % 5) + 1}`}
            data-answer={tile.value === round.wanted ? 'true' : 'false'}
            data-eaten={eaten === tile.id || undefined}
            data-refused={refused === tile.id || undefined}
          >
            <span className="hh-tile-number">{tile.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
