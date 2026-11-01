'use client';

/**
 * Shape box: a box with holes cut in shapes, and a tray of the same
 * shapes as pieces. The child drags each piece into its hole (or taps the
 * piece, then the hole). Pieces are coloured with random marks of the look, so
 * the colour gives nothing away; the shape is the only clue.
 */

import { useEffect, useRef, useState } from 'react';

import { t } from '../../lib/i18n/index.js';
import { fits, isFull, makeRound } from '../../lib/games/shape-box.js';

import { Prompt, useDrag, useFlash, useLater } from './parts.jsx';
import { ShapeArt } from './shape-art.jsx';

/** How long a full box shows before the next round, in milliseconds. */
const NEXT_ROUND_MS = 800;

/** @param {{ level: string, locale: string, play: any, over: boolean }} props */
export default function ShapeBox({ level, locale, play, over }) {
  const [round, setRound] = useState(() => makeRound(level));
  /** The holes filled this round, each with the mark of the piece in it. */
  const [filled, setFilled] = useState(/** @type {Record<string, string>} */ ({}));
  const [shaking, setShaking] = useFlash(450);
  const later = useLater();
  const full = useRef(false);

  const prompt = t('games.shape-box.prompt', locale);
  const word = (kind) => t(`shape.${kind}`, locale);

  // Say the question when a round starts.
  useEffect(() => {
    play.say(prompt);
    // Only when the round changes; `prompt` follows the language.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round, play]);

  function place(pieceId, hole) {
    if (over || full.current || filled[hole]) return;
    const piece = round.pieces.find((one) => one.id === pieceId);
    if (!piece || filled[piece.kind]) return;
    if (fits(round, pieceId, hole)) {
      const next = { ...filled, [hole]: piece.mark };
      setFilled(next);
      play.say(t('games.shape-box.fits', locale, { shape: word(hole) }));
      play.right();
      if (isFull(round, Object.keys(next))) {
        full.current = true;
        later(() => {
          if (play.isOver()) return;
          full.current = false;
          setFilled({});
          setRound((current) => makeRound(level, current.holes));
        }, NEXT_ROUND_MS);
      }
    } else {
      setShaking(hole);
      play.say(t('play.tryAgain', locale));
      play.miss();
    }
  }

  const drag = useDrag({ onDrop: place, disabled: over });

  // Picking a piece up (dragging it or tapping it) says its shape.
  const picked = drag.held ?? drag.selected;
  useEffect(() => {
    if (picked === null) return;
    const piece = round.pieces.find((one) => one.id === picked);
    if (piece) play.say(word(piece.kind));
    // Only when another piece is picked up.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [picked]);

  const waiting = round.pieces.filter((piece) => !filled[piece.kind]);
  // Marks for the review driver only (invisible): the first waiting piece, its hole, and a hole it does not fit.
  const first = waiting[0] ?? null;
  const wrongHole = first ? round.holes.find((hole) => hole !== first.kind && !filled[hole]) : undefined;

  return (
    <div className="sb" data-count={round.holes.length}>
      <Prompt text={prompt} locale={locale} onHear={() => play.say(prompt)} />
      <div className="sb-box" role="group" aria-label={t('games.shape-box.board', locale)}>
        {round.holes.map((hole) => {
          const label = t('games.shape-box.hole', locale, { shape: word(hole) });
          const mark = filled[hole];
          const marks = {
            'data-shake': shaking === hole || undefined,
            'data-answer': (first && first.kind === hole) || undefined,
            'data-wrong': wrongHole === hole || undefined,
          };
          return mark ? (
            <div key={hole} className="sb-hole" data-filled="true" role="img" aria-label={label}>
              <ShapeArt kind={hole} variant="hole" prefix="sb" />
              <ShapeArt kind={hole} prefix="sb" className="sb-placed" data-mark={mark} />
            </div>
          ) : (
            <div key={hole} className="sb-hole" {...drag.targetProps(hole, label)} {...marks}>
              <ShapeArt kind={hole} variant="hole" prefix="sb" />
            </div>
          );
        })}
      </div>
      <div className="sb-tray" role="group" aria-label={t('games.shape-box.tray', locale)}>
        {round.pieces.map((piece) => (
          <div key={piece.id} className="sb-slot">
            {filled[piece.kind] ? null : (
              <div
                {...drag.piece(piece.id, word(piece.kind))}
                className="sb-piece drag-piece"
                data-mark={piece.mark}
                data-first={first?.id === piece.id || undefined}
              >
                <ShapeArt kind={piece.kind} prefix="sb" />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
