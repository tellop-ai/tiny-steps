'use client';

/**
 * Letter flowers: the garden shows one letter big, on a button that says
 * it again; the child taps the tile with that letter. Each right answer in this
 * run grows the flower one stage (`growth()` in `lib/games/letter-flowers.js`):
 * the stem rises, the head grows, a petal is added and the petal mark moves on.
 * A wrong tile shakes and locks and the flower droops for a moment. The flower
 * is drawn here in the look's own tokens; its sizes are SVG geometry, set once
 * per answer. The drawing's frame is 150 wide (x 25 to 175) so a narrow garden
 * shows the flower big; the ground reaches past it to the garden's edges.
 */

import { Volume2 } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';

import { t } from '../../lib/i18n/index.js';
import { pick } from '../../lib/play/random.js';
import { nameOf } from '../../lib/games/letters.js';
import { GROUND_Y, growth, isRight, makeRound, splitWord } from '../../lib/games/letter-flowers.js';

import { Choice, ChoiceGrid, useLater } from './parts.jsx';

/** How long a right answer shows before the next round, in milliseconds. */
const NEXT_ROUND_MS = 400;
/** How long the flower droops after a wrong tile, in milliseconds. */
const DROOP_MS = 700;
/** The shared praise lines; one leads the next round's question after a right answer. */
const PRAISE = ['play.praise.1', 'play.praise.2', 'play.praise.3', 'play.praise.4'];

/** @param {{ level: string, locale: string, play: any, over: boolean }} props */
export default function LetterFlowers({ level, locale, play, over }) {
  /** The round, its number in the run, and the praise said before its question (after a right answer). */
  const [round, setRound] = useState(() => ({ ...makeRound(level, locale, null), n: 0, lead: /** @type {string | null} */ (null) }));
  /** Each tile's state this round: 'right' | 'wrong'. */
  const [marks, setMarks] = useState(/** @type {Record<string, 'right' | 'wrong'>} */ ({}));
  const [rights, setRights] = useState(0);
  const [mood, setMood] = useState(/** @type {'calm' | 'droop'} */ ('calm'));
  const later = useLater();
  const busy = useRef(false);

  const name = nameOf(round.letter, locale);
  const example = round.example
    ? t(round.example.inside ? 'letter.in' : 'letter.for', locale, { letter: name, word: round.example.word })
    : null;
  const ask = example
    ? t('games.letter-flowers.askWord', locale, { name, example })
    : t('games.letter-flowers.ask', locale, { name });
  const word = round.example ? splitWord(round.example.word, round.letter, locale) : null;
  const flower = growth(rights);
  /** One wrong tile, marked for the review driver the way the right one is (invisible to the child). */
  const decoy = round.tiles.find((tile) => tile.letter !== round.letter)?.id;

  // Say the question when a round starts, after the praise for the last answer.
  useEffect(() => {
    play.say(round.lead ? t('games.letter-flowers.then', locale, { praise: round.lead, ask }) : ask);
    // Only when the round changes; `ask` follows the round.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round, play]);

  const next = useCallback(() => {
    busy.current = false;
    setMarks({});
    setMood('calm');
    setRound((current) => ({
      ...makeRound(level, locale, current.letter),
      n: current.n + 1,
      lead: t(pick(PRAISE), locale),
    }));
  }, [level, locale]);

  function choose(tile) {
    if (over || busy.current || marks[tile.id]) return;
    if (isRight(round, tile.id)) {
      busy.current = true;
      setMarks((all) => ({ ...all, [tile.id]: 'right' }));
      setRights((count) => count + 1);
      setMood('calm');
      play.right();
      later(() => {
        if (!play.isOver()) next();
      }, NEXT_ROUND_MS);
    } else {
      setMarks((all) => ({ ...all, [tile.id]: 'wrong' }));
      setMood('droop');
      later(() => setMood((now) => (now === 'droop' ? 'calm' : now)), DROOP_MS);
      play.say(t('games.letter-flowers.notThat', locale, { name: nameOf(tile.letter, locale), wanted: name }));
      play.miss();
    }
  }

  return (
    <div className="lf" data-mood={mood} data-level={level}>
      <div className="lf-garden">
        <svg
          className="lf-flower"
          viewBox="25 0 150 300"
          preserveAspectRatio="xMidYMax meet"
          role="img"
          aria-label={t('games.letter-flowers.flower', locale, { n: String(flower.petals) })}
          data-stage={flower.stage}
        >
          <ellipse className="lf-ground" cx="100" cy="304" rx="220" ry="48" />
          <path className="lf-grass" d="M46 268 l-6 -16 l10 12 l2 -18 l5 20 M146 270 l-4 -18 l9 14 l4 -16 l2 20" />
          <g className="lf-plant">
            <path
              className="lf-stem"
              d={`M100 ${GROUND_Y} C 88 ${GROUND_Y - flower.stem * 0.35}, 112 ${GROUND_Y - flower.stem * 0.7}, 100 ${flower.headY}`}
            />
            {flower.leaves >= 1 ? (
              <path className="lf-leaf" d="M0 0 C 12 -16, 32 -14, 42 -4 C 30 6, 12 8, 0 0 Z" transform={`translate(98 ${GROUND_Y - flower.stem * 0.3})`} />
            ) : null}
            {flower.leaves >= 2 ? (
              <path className="lf-leaf" d="M0 0 C 12 -16, 32 -14, 42 -4 C 30 6, 12 8, 0 0 Z" transform={`translate(103 ${GROUND_Y - flower.stem * 0.58}) scale(-1 1)`} />
            ) : null}
            <g transform={`translate(100 ${flower.headY}) scale(${flower.head})`}>
              <g className="lf-bloom" key={flower.stage} data-mark={flower.mark}>
                {flower.angles.map((angle) => (
                  <ellipse key={angle} className="lf-petal" cx="0" cy="-29" rx="10" ry="21" transform={`rotate(${angle})`} />
                ))}
                <circle className="lf-centre" r="17" />
                <circle className="lf-eye" cx="-6" cy="-4" r="2.4" />
                <circle className="lf-eye" cx="6" cy="-4" r="2.4" />
                <path className="lf-mouth" d={mood === 'droop' ? 'M-6 8 Q0 3 6 8' : 'M-6 4 Q0 10 6 4'} />
              </g>
            </g>
          </g>
        </svg>
      </div>

      <div className="lf-ask">
        <p className="lf-find">{t('games.letter-flowers.find', locale)}</p>
        <Button
          key={round.n}
          type="button"
          variant="outline"
          className="lf-wanted"
          onClick={() => {
            if (!over) play.say(ask);
          }}
          aria-label={t('games.letter-flowers.hear', locale, { letter: round.glyph })}
          title={t('games.letter-flowers.hear', locale, { letter: round.glyph })}
        >
          <span className="lf-wanted-letter" aria-hidden="true">
            {round.glyph}
          </span>
          <Volume2 className="lf-wanted-sound" aria-hidden="true" />
        </Button>
        {round.example && word ? (
          <p className="lf-example" key={`word-${round.n}`}>
            <span className="lf-example-emoji" aria-hidden="true">
              {round.example.emoji}
            </span>
            <span className="lf-example-word">
              {word.before}
              <span className="lf-example-letter">{word.match}</span>
              {word.after}
            </span>
          </p>
        ) : null}
      </div>

      <ChoiceGrid count={round.tiles.length} className="lf-tiles">
        {round.tiles.map((tile) => (
          <Choice
            key={`${round.n}-${tile.id}`}
            className="lf-tile"
            label={tile.glyph}
            state={marks[tile.id] ?? 'idle'}
            disabled={over}
            onPress={() => choose(tile)}
          >
            <span
              className="lf-tile-letter"
              data-answer={tile.letter === round.letter || undefined}
              data-decoy={tile.id === decoy || undefined}
            >
              {tile.glyph}
            </span>
          </Choice>
        ))}
      </ChoiceGrid>
    </div>
  );
}
