'use client';

/**
 * Shape belt: monsters stand in a row, each with a mouth cut in a
 * shape; a belt along the bottom carries shapes left to right. The child drags
 * a shape (or taps it, then a monster) to the monster with the same mouth.
 *
 * The belt moves in one `requestAnimationFrame` loop that writes each shape's
 * place through the CSSOM (`style.transform` on its holder); React renders only
 * when a shape comes on or goes, never per frame. A shape that is held or
 * picked stops where it is. The loop stops on unmount and once the game is over.
 * While the grown-ups window is open the belt waits: nothing moves, comes on or
 * rides off. When the belt's width changes, every shape keeps its share of the
 * way, so a narrower window does not push several shapes off at once.
 */

import { useEffect, useRef, useState } from 'react';

import { t } from '../../lib/i18n/index.js';
import { pick } from '../../lib/play/random.js';
import {
  FIRST_WAIT_SECONDS,
  MARKS,
  beltSpeed,
  canSpawn,
  feeds,
  groupNumber,
  isNewGroup,
  makeGroup,
  nextKind,
  ridesOff,
  spawnWait,
} from '../../lib/games/shape-belt.js';

import { Prompt, useDrag, useFlash, useLater } from './parts.jsx';
import { ShapeArt } from './shape-art.jsx';

/** The longest step one frame may take, in seconds (a hidden window pauses frames). */
const MAX_STEP_SECONDS = 0.05;
/** The belt's stripes repeat every this many pixels (`.belt-track` in the stylesheet). */
const STRIPE_PX = 40;
/** How long the last right feed of a group shows before the new group comes, in milliseconds. */
const NEW_GROUP_MS = 700;

/** @param {{ level: string, locale: string, play: any, over: boolean, paused?: boolean }} props */
export default function ShapeBelt({ level, locale, play, over, paused = false }) {
  const [group, setGroup] = useState(() => makeGroup(level));
  const [groupNo, setGroupNo] = useState(1);
  /** The shapes on the belt, oldest first (their places live in `places`, not here). */
  const [items, setItems] = useState(/** @type {{ id: string, kind: string, mark: string }[]} */ ([]));
  const [chomping, setChomping] = useFlash(600);
  const [shaking, setShaking] = useFlash(450);
  const [banner, setBanner] = useFlash(1800);
  const later = useLater();

  const track = useRef(/** @type {HTMLElement | null} */ (null));
  /** Each shape's holder element and its left edge on the belt, in pixels. */
  const holders = useRef(/** @type {Map<string, HTMLElement>} */ (new Map()));
  const places = useRef(/** @type {Map<string, number>} */ (new Map()));
  const mouths = useRef(group.map((monster) => monster.kind));
  const stopped = useRef(/** @type {{ held: string | null, selected: string | null }} */ ({ held: null, selected: null }));
  const lastKind = useRef(/** @type {string | null} */ (null));
  const nextId = useRef(0);
  const rightFeeds = useRef(0);
  const pausedRef = useRef(paused);
  pausedRef.current = paused;

  const prompt = t('games.shape-belt.prompt', locale);
  const word = (kind) => t(`shape.${kind}`, locale);

  // Say the question when the game starts.
  useEffect(() => {
    play.say(prompt);
    // Once; a new group says its round instead.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [play]);

  /** Takes shapes off the belt. */
  function remove(ids) {
    for (const id of ids) places.current.delete(id);
    setItems((list) => list.filter((item) => !ids.includes(item.id)));
  }

  function newGroup() {
    const next = makeGroup(level, mouths.current);
    mouths.current = next.map((monster) => monster.kind);
    const number = groupNumber(rightFeeds.current);
    setGroup(next);
    setGroupNo(number);
    setBanner(number);
    // Shapes no monster can eat any more leave the belt; they are nobody's miss.
    setItems((list) => {
      const keep = list.filter((item) => mouths.current.includes(item.kind));
      for (const item of list) if (!keep.includes(item)) places.current.delete(item.id);
      return keep;
    });
    play.say(t('games.shape-belt.round', locale, { n: String(number) }));
  }

  function feed(pieceId, mouth) {
    if (over || !places.current.has(pieceId)) return;
    const item = items.find((one) => one.id === pieceId);
    if (!item) return;
    // Right or wrong, the shape is used up.
    remove([pieceId]);
    if (feeds(item.kind, mouth)) {
      setChomping(mouth);
      play.right();
      rightFeeds.current += 1;
      if (isNewGroup(rightFeeds.current)) {
        later(() => {
          if (!play.isOver()) newGroup();
        }, NEW_GROUP_MS);
      }
    } else {
      setShaking(mouth);
      play.say(t('play.tryAgain', locale));
      play.miss();
    }
  }

  const drag = useDrag({ onDrop: feed, disabled: over });

  // A held or picked shape stops on the belt; the loop reads this.
  useEffect(() => {
    stopped.current = { held: drag.held, selected: drag.selected };
  }, [drag.held, drag.selected]);

  // Picking a shape up (dragging it or tapping it) says its name.
  const picked = drag.held ?? drag.selected;
  useEffect(() => {
    if (picked === null) return;
    const item = items.find((one) => one.id === picked);
    if (item) play.say(word(item.kind));
    // Only when another shape is picked up.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [picked]);

  // The belt: one animation loop for the whole run, stopped when the game is over or leaves.
  useEffect(() => {
    if (over) return undefined;
    let frame = 0;
    let last = /** @type {number | null} */ (null);
    let waited = 0;
    let wait = FIRST_WAIT_SECONDS;
    let stripes = 0;
    let lastWidth = 0;

    const tick = (now) => {
      const step = last === null ? 0 : Math.min(MAX_STEP_SECONDS, Math.max(0, (now - last) / 1000));
      last = now;
      const belt = track.current;
      if (!belt) {
        frame = requestAnimationFrame(tick);
        return;
      }
      const width = belt.clientWidth;
      if (width > 0 && lastWidth > 0 && width !== lastWidth) {
        const share = width / lastWidth;
        for (const [id, x] of places.current) {
          const moved = x * share;
          places.current.set(id, moved);
          const holder = holders.current.get(id);
          if (holder) holder.style.transform = `translateX(${moved}px)`;
        }
      }
      if (width > 0) lastWidth = width;
      // A hidden belt (no width) or an open grown-ups window: wait, and count no time.
      if (width === 0 || pausedRef.current) {
        frame = requestAnimationFrame(tick);
        return;
      }
      const speed = beltSpeed(level, width);
      const sample = holders.current.values().next().value;
      const size = sample ? sample.offsetWidth : belt.clientHeight;
      const { held, selected } = stopped.current;
      let nearest = /** @type {number | null} */ (null);
      const gone = [];
      for (const [id, x] of places.current) {
        const moved = id === held || id === selected ? x : x + speed * step;
        if (moved !== x) {
          places.current.set(id, moved);
          const holder = holders.current.get(id);
          if (holder) holder.style.transform = `translateX(${moved}px)`;
        }
        if (ridesOff(moved, width)) gone.push(id);
        else nearest = nearest === null ? moved : Math.min(nearest, moved);
      }
      stripes = (stripes + speed * step) % STRIPE_PX;
      belt.style.backgroundPositionX = `${stripes}px`;

      if (gone.length > 0) {
        remove(gone);
        // Each shape that rode off is a miss; stop as soon as the meter says the game is over.
        for (let count = 0; count < gone.length && !play.isOver(); count += 1) play.miss();
        if (play.isOver()) return;
      }

      waited += step;
      if (canSpawn(waited, wait, nearest, size)) {
        const kind = nextKind(mouths.current, lastKind.current);
        lastKind.current = kind;
        const id = `s${nextId.current}`;
        nextId.current += 1;
        places.current.set(id, -size);
        setItems((list) => [...list, { id, kind, mark: pick(MARKS) }]);
        waited = 0;
        wait = spawnWait(level);
      }
      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
    // `remove` only touches refs and state setters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [over, level, play]);

  /** Keeps a shape's holder, placed where the loop last put it. */
  const holderRef = (id) => (element) => {
    if (element) {
      holders.current.set(id, element);
      element.style.transform = `translateX(${places.current.get(id) ?? 0}px)`;
    } else {
      holders.current.delete(id);
    }
  };

  // Marks for the review driver only (invisible): the shape to feed, its monster, and a monster it does not fit.
  const aim = items.find((item) => item.id === drag.selected) ?? items[0] ?? null;
  const wrongMouth = aim ? group.find((monster) => monster.kind !== aim.kind)?.kind : undefined;

  return (
    <div className="belt" data-count={group.length}>
      <Prompt text={prompt} locale={locale} onHear={() => play.say(prompt)} />
      <div className="belt-monsters" key={groupNo}>
        {group.map((monster) => (
          <div
            key={monster.kind}
            className="belt-monster"
            data-mark={monster.mark}
            data-chomp={chomping === monster.kind || undefined}
            data-shake={shaking === monster.kind || undefined}
            data-answer={aim?.kind === monster.kind || undefined}
            data-wrong={wrongMouth === monster.kind || undefined}
            {...drag.targetProps(monster.kind, t('games.shape-belt.monster', locale, { shape: word(monster.kind) }))}
          >
            <svg className="belt-creature" viewBox="0 0 120 142" preserveAspectRatio="xMidYMax meet" aria-hidden="true">
              <circle className="belt-ear" cx="24" cy="30" r="13" />
              <circle className="belt-ear" cx="96" cy="30" r="13" />
              <ellipse className="belt-foot" cx="38" cy="131" rx="17" ry="9" />
              <ellipse className="belt-foot" cx="82" cy="131" rx="17" ry="9" />
              <path
                className="belt-body"
                d="M60 14 C93 14 110 34 110 64 L110 104 C110 120 99 130 84 130 L36 130 C21 130 10 120 10 104 L10 64 C10 34 27 14 60 14 Z"
              />
              <circle className="belt-eye" cx="40" cy="45" r="12" />
              <circle className="belt-eye" cx="80" cy="45" r="12" />
              <circle className="belt-pupil" cx="42" cy="48" r="5.5" />
              <circle className="belt-pupil" cx="78" cy="48" r="5.5" />
              <g className="belt-jaw">
                <ShapeArt kind={monster.kind} variant="mouth" prefix="belt" x="28" y="62" width="64" height="64" />
              </g>
            </svg>
          </div>
        ))}
      </div>
      <div className="belt-track" ref={track} role="group" aria-label={t('games.shape-belt.belt', locale)}>
        {items.map((item) => (
          <div key={item.id} className="belt-item" ref={holderRef(item.id)}>
            <div
              {...drag.piece(item.id, word(item.kind))}
              className="belt-shape drag-piece"
              data-mark={item.mark}
              data-first={item === items[0] || undefined}
            >
              <ShapeArt kind={item.kind} prefix="belt" />
            </div>
          </div>
        ))}
      </div>
      {banner === null ? null : (
        <p className="belt-banner" key={banner} aria-live="polite">
          {t('games.shape-belt.round', locale, { n: String(banner) })}
        </p>
      )}
    </div>
  );
}
