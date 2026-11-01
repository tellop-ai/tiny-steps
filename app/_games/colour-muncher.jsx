'use client';

/**
 * Colour muncher: a hungry monster asks for one colour; the child taps
 * the thing of that colour. The colour the monster names is shown as an emoji
 * swatch (its colour is fixed), never as a style; the monster itself is drawn
 * in the look's own tokens.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import { t } from '../../lib/i18n/index.js';
import { COLOURS } from '../../lib/games/colours.js';
import { isRight, makeRound } from '../../lib/games/colour-muncher.js';

import { Choice, ChoiceGrid, Glyph, Prompt, useLater } from './parts.jsx';

/** How long a right answer shows before the next round, in milliseconds. */
const NEXT_ROUND_MS = 900;

/** @param {{ level: string, locale: string, play: any, over: boolean }} props */
export default function ColourMuncher({ level, locale, play, over }) {
  const [round, setRound] = useState(() => makeRound(level, null));
  /** Each thing's state this round: 'right' | 'wrong'. */
  const [marks, setMarks] = useState(/** @type {Record<string, 'right' | 'wrong'>} */ ({}));
  const [mood, setMood] = useState(/** @type {'hungry' | 'chomp' | 'no'} */ ('hungry'));
  const later = useLater();
  const busy = useRef(false);

  const colourWord = t(`colour.${round.colour}`, locale);
  const prompt = t('games.colour-muncher.prompt', locale, { colour: colourWord });

  // Say the question when a round starts.
  useEffect(() => {
    play.say(prompt);
    // Only when the round changes; `prompt` follows the round.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round, play]);

  const next = useCallback(() => {
    busy.current = false;
    setMarks({});
    setMood('hungry');
    setRound((current) => makeRound(level, current.colour));
  }, [level]);

  function choose(thing) {
    if (over || busy.current || marks[thing.id]) return;
    if (isRight(round, thing.id)) {
      busy.current = true;
      setMarks((all) => ({ ...all, [thing.id]: 'right' }));
      setMood('chomp');
      play.say(t('games.colour-muncher.yum', locale, { colour: colourWord }));
      play.right();
      later(() => {
        if (!play.isOver()) next();
      }, NEXT_ROUND_MS);
    } else {
      setMarks((all) => ({ ...all, [thing.id]: 'wrong' }));
      setMood('no');
      later(() => setMood((now) => (now === 'no' ? 'hungry' : now)), 500);
      play.say(t('games.colour-muncher.notThat', locale, { colour: t(`colour.${thing.colour}`, locale) }));
      play.miss();
    }
  }

  return (
    <div className="cm" data-mood={mood}>
      <div className="cm-scene">
        <svg className="cm-monster" viewBox="0 0 220 190" role="img" aria-label={t('games.colour-muncher.monster', locale)}>
          <path className="cm-horn" d="M58 52 L44 8 L82 40 Z" />
          <path className="cm-horn" d="M162 52 L176 8 L138 40 Z" />
          <ellipse className="cm-body" cx="110" cy="112" rx="92" ry="74" />
          <ellipse className="cm-belly" cx="110" cy="138" rx="52" ry="34" />
          <circle className="cm-eye" cx="78" cy="88" r="19" />
          <circle className="cm-eye" cx="142" cy="88" r="19" />
          <circle className="cm-pupil" cx="81" cy="92" r="8" />
          <circle className="cm-pupil" cx="145" cy="92" r="8" />
          <ellipse className="cm-mouth" cx="110" cy="134" rx="34" ry="16" />
          <path className="cm-tooth" d="M92 120 L99 132 L106 120 Z" />
          <path className="cm-tooth" d="M114 120 L121 132 L128 120 Z" />
        </svg>
        <div className="cm-bubble" key={round.colour}>
          <Glyph size="large">{COLOURS[round.colour].swatch}</Glyph>
          <span className="cm-bubble-word">{colourWord}</span>
        </div>
      </div>
      <Prompt text={prompt} locale={locale} onHear={() => play.say(prompt)} />
      <ChoiceGrid count={round.things.length}>
        {round.things.map((thing) => (
          <Choice
            key={thing.id}
            label={thing.glyph}
            state={marks[thing.id] ?? 'idle'}
            disabled={over}
            onPress={() => choose(thing)}
          >
            <Glyph size="large">{thing.glyph}</Glyph>
          </Choice>
        ))}
      </ChoiceGrid>
    </div>
  );
}
