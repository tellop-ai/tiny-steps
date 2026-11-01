'use client';

/**
 * Rainbow maker: a belt brings one thing in from the
 * left; the child taps the paint pot of its colour. Each right answer fills one
 * more arc of the rainbow over the belt (five, then it starts again).
 *
 * The colour a pot names is its square emoji (`lib/games/colours.js`), never a
 * style; the belt's stripes and the rainbow's arcs are the look's own tokens,
 * decoration that is never named. The belt moves by CSS alone.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import { t } from '../../lib/i18n/index.js';
import { COLOURS } from '../../lib/games/colours.js';
import { ARCS, arcsShown, isRight, nextThing, rulesFor } from '../../lib/games/rainbow-maker.js';

import { Choice, ChoiceGrid, Glyph, Prompt, useLater } from './parts.jsx';

/** How long a sorted thing takes to leave before the next one comes, in milliseconds. */
const NEXT_THING_MS = 1200;

/** The arcs, outermost first: each one's radius in the 200 × 100 drawing and its mark. */
const ARC_RADII = Object.freeze([88, 76, 64, 52, 40]);

/** @param {number} radius */
function arcPath(radius) {
  return `M ${100 - radius} 100 A ${radius} ${radius} 0 0 1 ${100 + radius} 100`;
}

/** @param {{ level: string, locale: string, play: any, over: boolean }} props */
export default function RainbowMaker({ level, locale, play, over }) {
  const rules = rulesFor(level);
  const [thing, setThing] = useState(() => ({ ...nextThing(level, null), key: 0 }));
  /** Each pot's state for this thing: 'right' | 'wrong'. */
  const [marks, setMarks] = useState(/** @type {Record<string, 'right' | 'wrong'>} */ ({}));
  const [leaving, setLeaving] = useState(false);
  const [rights, setRights] = useState(0);
  const later = useLater();
  const busy = useRef(false);

  const prompt = t('games.rainbow-maker.prompt', locale);
  const shown = arcsShown(rights);

  // Ask when a new thing arrives.
  useEffect(() => {
    play.say(prompt);
    // Only when the thing changes; `prompt` is the same line each time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [thing, play]);

  const next = useCallback(() => {
    busy.current = false;
    setMarks({});
    setLeaving(false);
    setThing((current) => ({ ...nextThing(level, current), key: current.key + 1 }));
  }, [level]);

  function choose(pot) {
    if (over || busy.current || marks[pot]) return;
    const word = t(`colour.${pot}`, locale);
    if (isRight(thing, pot)) {
      busy.current = true;
      setMarks((all) => ({ ...all, [pot]: 'right' }));
      setLeaving(true);
      setRights((count) => count + 1);
      play.say(t('games.rainbow-maker.right', locale, { colour: word }));
      play.right();
      later(() => {
        if (!play.isOver()) next();
      }, NEXT_THING_MS);
    } else {
      setMarks((all) => ({ ...all, [pot]: 'wrong' }));
      play.say(t('games.rainbow-maker.notThat', locale, { colour: word }));
      play.miss();
    }
  }

  return (
    <div className="rm" data-over={over || undefined}>
      <div className="rm-scene">
        <svg
          className="rm-rainbow"
          viewBox="0 0 200 100"
          preserveAspectRatio="xMidYMax meet"
          role="img"
          aria-label={t('games.rainbow-maker.rainbow', locale, { n: String(shown) })}
          data-full={shown === ARCS || undefined}
          key={shown === ARCS ? `full-${rights}` : 'filling'}
        >
          {ARC_RADII.map((radius, at) => (
            <path
              key={radius}
              className="rm-arc"
              d={arcPath(radius)}
              data-mark={`chart-${at + 1}`}
              data-on={at < shown || undefined}
            />
          ))}
        </svg>
        <div className="rm-belt">
          <div className="rm-thing" key={thing.key} data-leaving={leaving || undefined}>
            <span className="rm-plate">
              <Glyph size="large">{thing.glyph}</Glyph>
            </span>
          </div>
          <div className="rm-band" aria-hidden="true">
            <span className="rm-roller" />
            <span className="rm-roller" />
          </div>
        </div>
      </div>
      <Prompt text={prompt} locale={locale} onHear={() => play.say(prompt)} />
      <ChoiceGrid count={rules.pots.length} className="rm-pots">
        {rules.pots.map((pot) => (
          <Choice
            key={pot}
            className="rm-pot"
            label={t('games.rainbow-maker.pot', locale, { colour: t(`colour.${pot}`, locale) })}
            state={marks[pot] ?? 'idle'}
            disabled={over}
            onPress={() => choose(pot)}
          >
            <span className="rm-pot-face" data-answer={isRight(thing, pot) ? 'true' : 'false'}>
              <Glyph size={rules.names ? 'medium' : 'large'}>{COLOURS[pot].square}</Glyph>
              {rules.names ? <span className="rm-pot-name">{t(`colour.${pot}`, locale)}</span> : null}
            </span>
          </Choice>
        ))}
      </ChoiceGrid>
    </div>
  );
}
