'use client';

/**
 * Colour basket (id `colour-muncher`, kept so saved favourites still find it):
 * a teddy with an empty basket asks for one colour; the child taps the thing
 * of that colour and it drops into the basket. The colour is shown as an emoji
 * swatch (its colour is fixed), never as a style. A right answer shows a
 * thank-you line and the frame plays its tune; only the question and a wrong
 * answer are spoken.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import { t } from '../../lib/i18n/index.js';
import { COLOURS } from '../../lib/games/colours.js';
import { isRight, makeRound } from '../../lib/games/colour-muncher.js';
import { Decor } from '../art.jsx';

import { Choice, ChoiceGrid, Glyph, Prompt, useLater } from './parts.jsx';

/** How long a right answer shows before the next round, in milliseconds. */
const NEXT_ROUND_MS = 900;

/** @param {{ level: string, locale: string, play: any, over: boolean }} props */
export default function ColourBasket({ level, locale, play, over }) {
  const [round, setRound] = useState(() => makeRound(level, null));
  /** Each thing's state this round: 'right' | 'wrong'. */
  const [marks, setMarks] = useState(/** @type {Record<string, 'right' | 'wrong'>} */ ({}));
  const [mood, setMood] = useState(/** @type {'ask' | 'thanks' | 'no'} */ ('ask'));
  /** The last thing put in the basket (it stays until the next) and how many went in. */
  const [basket, setBasket] = useState(/** @type {{ glyph: string | null, count: number }} */ ({ glyph: null, count: 0 }));
  const later = useLater();
  const busy = useRef(false);

  const colourWord = t(`colour.${round.colour}`, locale);
  const prompt = t('games.colour-muncher.prompt', locale, { colour: colourWord });
  const shown = mood === 'thanks' ? t('games.colour-muncher.thanks', locale, { colour: colourWord }) : prompt;
  /** One wrong thing, marked for the review driver the way the right one is (invisible to the child). */
  const decoy = round.things.find((thing) => thing.colour !== round.colour)?.id;

  // Say the question when a round starts.
  useEffect(() => {
    play.say(prompt);
    // Only when the round changes; `prompt` follows the round.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round, play]);

  const next = useCallback(() => {
    busy.current = false;
    setMarks({});
    setMood('ask');
    setRound((current) => makeRound(level, current.colour));
  }, [level]);

  function choose(thing) {
    if (over || busy.current || marks[thing.id]) return;
    if (isRight(round, thing.id)) {
      busy.current = true;
      setMarks((all) => ({ ...all, [thing.id]: 'right' }));
      setMood('thanks');
      setBasket((now) => ({ glyph: thing.glyph, count: now.count + 1 }));
      play.right();
      later(() => {
        if (!play.isOver()) next();
      }, NEXT_ROUND_MS);
    } else {
      setMarks((all) => ({ ...all, [thing.id]: 'wrong' }));
      setMood('no');
      later(() => setMood((now) => (now === 'no' ? 'ask' : now)), 500);
      play.say(t('games.colour-muncher.notThat', locale, { colour: t(`colour.${thing.colour}`, locale) }));
      play.miss();
    }
  }

  return (
    <div className="cm" data-mood={mood}>
      <div className="cm-scene">
        <div className="cm-friend">
          <Decor name="basket-teddy" className="cm-teddy" />
          {basket.glyph ? (
            <span className="cm-in-basket" key={basket.count} aria-hidden="true">
              <span className="cm-in-basket-thing">{basket.glyph}</span>
            </span>
          ) : null}
        </div>
        <div className="cm-bubble" key={round.colour}>
          <Glyph size="large">{COLOURS[round.colour].swatch}</Glyph>
          <span className="cm-bubble-word">{colourWord}</span>
        </div>
      </div>
      <Prompt text={shown} locale={locale} onHear={() => play.say(prompt)} />
      <ChoiceGrid count={round.things.length}>
        {round.things.map((thing) => (
          <Choice
            key={thing.id}
            label={thing.glyph}
            state={marks[thing.id] ?? 'idle'}
            disabled={over}
            onPress={() => choose(thing)}
          >
            <span className="cm-thing" data-answer={thing.colour === round.colour || undefined} data-decoy={thing.id === decoy || undefined}>
              <Glyph size="large">{thing.glyph}</Glyph>
            </span>
          </Choice>
        ))}
      </ChoiceGrid>
    </div>
  );
}
