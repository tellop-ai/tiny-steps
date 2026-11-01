'use client';

/**
 * Little builder: a picture of empty
 * slots, drawn as dashed outlines in the look's tokens; the game asks for one
 * piece by colour and shape, and the child taps it in the tray. Pieces are
 * emoji with fixed colours, from `PIECES` only; a placed piece is the emoji
 * itself, popping into its slot.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import { t } from '../../lib/i18n/index.js';
import { blinks, isRight, makeTray, nextPicture, pieceFor } from '../../lib/games/little-builder.js';

import { Choice, Glyph, Prompt, useLater } from './parts.jsx';

/** How long a finished picture shows before the next one, in milliseconds. */
const NEXT_PICTURE_MS = 2000;
/**
 * How big an emoji is drawn against its slot's size, so its visible shape fills the
 * dashed outline. Most piece emoji fill their whole box; the triangle is drawn
 * smaller inside its box (about 0.69 wide and 0.60 high), so it is drawn larger.
 */
const GLYPH_SCALE = Object.freeze({ triangle: 1.3 });
const glyphScale = (shape) => GLYPH_SCALE[shape] ?? 0.9;

/** A heart inside a box of side 1, centred on 0,0. */
const HEART = [
  [0, 0.42],
  [-0.46, 0.08, -0.5, -0.16, -0.36, -0.33],
  [-0.22, -0.47, -0.04, -0.42, 0, -0.26],
  [0.04, -0.42, 0.22, -0.47, 0.36, -0.33],
  [0.5, -0.16, 0.46, 0.08, 0, 0.42],
];

const round = (n) => Math.round(n * 100) / 100;

/** The dashed outline of an empty slot, as SVG geometry in board units. */
function Outline({ slot, asked }) {
  const { shape, x, y, size } = slot;
  const props = { className: 'lb-slot', 'data-asked': asked || undefined, 'data-shape': shape };
  if (shape === 'circle') return <circle {...props} cx={x} cy={y} r={round(size * 0.46)} />;
  if (shape === 'square') {
    const half = size * 0.45;
    return <rect {...props} x={round(x - half)} y={round(y - half)} width={round(half * 2)} height={round(half * 2)} />;
  }
  if (shape === 'heart') {
    const at = (dx, dy) => `${round(x + dx * size)} ${round(y + dy * size)}`;
    const [start, ...curves] = HEART;
    const d = `M ${at(start[0], start[1])} ${curves.map((c) => `C ${at(c[0], c[1])}, ${at(c[2], c[3])}, ${at(c[4], c[5])}`).join(' ')} Z`;
    return <path {...props} d={d} />;
  }
  let corners;
  if (shape === 'triangle') corners = [[0, -0.4], [0.46, 0.38], [-0.46, 0.38]];
  else if (shape === 'diamond') corners = [[0, -0.45], [0.45, 0], [0, 0.45], [-0.45, 0]];
  else {
    corners = [];
    for (let k = 0; k < 10; k += 1) {
      const angle = -Math.PI / 2 + (k * Math.PI) / 5;
      const r = k % 2 === 0 ? 0.45 : 0.19;
      corners.push([r * Math.cos(angle), r * Math.sin(angle) + 0.02]);
    }
  }
  return <polygon {...props} points={corners.map(([dx, dy]) => `${round(x + dx * size)},${round(y + dy * size)}`).join(' ')} />;
}

/** @param {{ level: string, locale: string, play: any, over: boolean }} props */
export default function LittleBuilder({ level, locale, play, over }) {
  const [round_, setRound] = useState(() => {
    const picture = nextPicture(null);
    return { picture, placed: 0, tray: makeTray(level, picture.slots[0]) };
  });
  /** Each tray piece's state this ask: 'wrong'. */
  const [marks, setMarks] = useState(/** @type {Record<string, 'wrong'>} */ ({}));
  const later = useLater();
  const busy = useRef(false);
  const now = useRef(round_);
  useEffect(() => {
    now.current = round_;
  }, [round_]);

  const { picture, placed, tray } = round_;
  const done = placed >= picture.slots.length;
  const asked = done ? null : picture.slots[placed];
  const pictureName = t(`games.little-builder.pic.${picture.id}`, locale);
  const pieceWords = (piece) => ({ colour: t(`colour.${piece.colour}`, locale), shape: t(`shape.${piece.shape}`, locale) });
  const prompt = asked ? t('games.little-builder.prompt', locale, pieceWords(asked)) : t('games.little-builder.built', locale, { picture: pictureName });

  // Say the ask whenever it changes (a new piece or a new picture).
  useEffect(() => {
    if (asked) play.say(prompt);
    // Only when the ask changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [picture, placed, play]);

  // The next picture, once this one is built (the wait and a tap on the board both come here).
  const next = useCallback(() => {
    const current = now.current;
    if (play.isOver() || current.placed < current.picture.slots.length) return;
    busy.current = false;
    setMarks({});
    const picture = nextPicture(current.picture.id);
    setRound({ picture, placed: 0, tray: makeTray(level, picture.slots[0]) });
  }, [level, play]);

  function choose(piece) {
    if (over || busy.current || !asked || marks[piece.id]) return;
    if (isRight(asked, piece)) {
      const filled = placed + 1;
      setMarks({});
      play.right();
      if (filled >= picture.slots.length) {
        busy.current = true;
        setRound({ picture, placed: filled, tray: [] });
        play.say(t('games.little-builder.built', locale, { picture: pictureName }));
        later(next, NEXT_PICTURE_MS);
      } else {
        setRound({ picture, placed: filled, tray: makeTray(level, picture.slots[filled]) });
      }
    } else {
      setMarks((all) => ({ ...all, [piece.id]: 'wrong' }));
      play.say(t('games.little-builder.notThat', locale, pieceWords(asked)));
      play.miss();
    }
  }

  const blink = blinks(level);

  return (
    <div className="lb" data-done={done || undefined}>
      <Prompt text={prompt} locale={locale} onHear={() => play.say(prompt)} />
      <div className="lb-stage">
        <svg
          className="lb-board"
          viewBox="0 0 100 100"
          role={done ? 'button' : 'img'}
          tabIndex={done && !over ? 0 : undefined}
          aria-label={done ? t('games.little-builder.nextPicture', locale) : t('games.little-builder.board', locale, { picture: pictureName })}
          data-picture={picture.id}
          onClick={done ? next : undefined}
          onKeyDown={(event) => {
            if (done && (event.key === 'Enter' || event.key === ' ')) {
              event.preventDefault();
              next();
            }
          }}
        >
          {picture.slots.map((slot, index) =>
            index < placed ? (
              <text
                key={`${picture.id}-${index}`}
                className="lb-piece"
                data-new={index === placed - 1 || undefined}
                x={slot.x}
                y={slot.y}
                fontSize={round(slot.size * glyphScale(slot.shape))}
              >
                {pieceFor(slot.shape, slot.colour)?.glyph}
              </text>
            ) : (
              <Outline key={`${picture.id}-${index}`} slot={slot} asked={blink && index === placed} />
            ),
          )}
        </svg>
      </div>
      <div className="lb-tray" data-count={tray.length}>
        {tray.map((piece) => {
          const words = pieceWords(piece);
          return (
            <Choice
              key={`${placed}-${piece.id}`}
              className="lb-choice"
              label={t('games.little-builder.piece', locale, words)}
              state={marks[piece.id] ?? 'idle'}
              disabled={over}
              onPress={() => choose(piece)}
            >
              <span className="lb-face" data-shape={piece.shape} data-answer={(asked && isRight(asked, piece)) || undefined}>
                <Glyph size="large">{piece.glyph}</Glyph>
              </span>
            </Choice>
          );
        })}
      </div>
    </div>
  );
}
