'use client';

/**
 * The pieces every game is built from, so the fifteen games look and
 * behave alike: a prompt with "Hear it again", big answer buttons, a grid for
 * them, and dragging a piece onto a target.
 *
 * Rules every game keeps (`AGENTS.md` rules 5, 6 and 6a):
 * - Words come from `lib/i18n` by key; nothing is written into a component.
 * - Colours are tokens by name, through the classes in `app/globals.css`. A colour
 *   the game names comes from an emoji, never from a style.
 * - A moving or held piece is placed through the CSSOM in an event handler or an
 *   effect (`element.style.setProperty('--drag-x', …)`), never a style object
 *   computed while the screen renders.
 * - Buttons are the kit's `Button`; a piece that is dragged is a `div` with
 *   `role="button"`, reachable by Tab and pressed with Enter or Space.
 */

import { Volume2 } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import { t } from '../../lib/i18n/index.js';

/**
 * The round's question in large words, with a button that says it again.
 *
 * @param {{ text: string, locale: string, onHear: () => void, children?: any, className?: string }} props
 */
export function Prompt({ text, locale, onHear, children, className }) {
  return (
    <div className={cn('play-prompt', className)}>
      <p className="play-prompt-text" aria-live="polite">
        {text}
        {children}
      </p>
      <Button
        type="button"
        variant="secondary"
        size="icon-lg"
        className="play-hear"
        onClick={onHear}
        aria-label={t('play.hearAgain', locale)}
        title={t('play.hearAgain', locale)}
      >
        <Volume2 aria-hidden="true" />
      </Button>
    </div>
  );
}

/**
 * One big answer. `state` drives the look and the motion: `idle`, `right` (a
 * bounce and a green ring), `wrong` (a shake, then dimmed and not pressable),
 * `done` (dimmed, not pressable).
 *
 * @param {{ children: any, label: string, state?: 'idle' | 'right' | 'wrong' | 'done', onPress: () => void, disabled?: boolean, className?: string }} props
 */
export function Choice({ children, label, state = 'idle', onPress, disabled = false, className }) {
  const blocked = disabled || state === 'wrong' || state === 'done';
  return (
    <Button
      type="button"
      variant="outline"
      className={cn('play-choice', className)}
      data-state={state}
      aria-label={label}
      aria-disabled={blocked || undefined}
      onClick={() => {
        if (!blocked) onPress();
      }}
    >
      {children}
    </Button>
  );
}

/**
 * A grid of answers that fits the screen: two, three or four across by how many
 * there are and how wide the screen is (`app/globals.css`, `.play-grid`).
 *
 * @param {{ children: any, count: number, className?: string }} props
 */
export function ChoiceGrid({ children, count, className }) {
  return (
    <div className={cn('play-grid', className)} data-count={Math.max(1, Math.min(12, count))}>
      {children}
    </div>
  );
}

/** A big emoji inside a choice or on the stage. Emoji are content here, never icons. */
export function Glyph({ children, size = 'large', className }) {
  return (
    <span className={cn('play-glyph', className)} data-size={size} aria-hidden="true">
      {children}
    </span>
  );
}

/** A game that is not built yet: says so in the play area. */
export function NotReady({ locale }) {
  return (
    <div className="play-not-ready">
      <p>{t('play.notReady', locale)}</p>
    </div>
  );
}

/** How far a press may move before it counts as a drag, in CSS pixels. */
const DRAG_START_PX = 8;

/**
 * Dragging pieces onto targets, by pointer (mouse, finger, pen) or by two
 * presses (press a piece, then press a target), which also works from the
 * keyboard. `onDrop(pieceId, targetId)` decides what happens; the piece always
 * springs back to its place afterwards, so a game shows a right drop by
 * removing or moving the piece in its own state.
 *
 * ```jsx
 * const drag = useDrag({ onDrop: (piece, target) => feed(piece, target), disabled: over });
 * <div ref={drag.target('mouth')} data-hover={drag.hover === 'mouth' || undefined} … />
 * <div {...drag.piece('7', t('…', locale))} className="drag-piece …">7</div>
 * ```
 *
 * The held piece moves through the CSS variables `--drag-x` and `--drag-y`
 * (`.drag-piece` in `app/globals.css`), written through the CSSOM.
 *
 * @param {{ onDrop: (pieceId: string, targetId: string) => void, disabled?: boolean }} options
 */
export function useDrag({ onDrop, disabled = false }) {
  /** @type {React.MutableRefObject<Map<string, HTMLElement>>} */
  const targets = useRef(new Map());
  const dropRef = useRef(onDrop);
  const disabledRef = useRef(disabled);
  const [held, setHeld] = useState(/** @type {string | null} */ (null));
  const [selected, setSelected] = useState(/** @type {string | null} */ (null));
  const [hover, setHover] = useState(/** @type {string | null} */ (null));
  /** @type {React.MutableRefObject<{ id: string, element: HTMLElement, pointer: number, x: number, y: number, moved: boolean } | null>} */
  const active = useRef(null);

  useEffect(() => {
    dropRef.current = onDrop;
  }, [onDrop]);
  useEffect(() => {
    disabledRef.current = disabled;
    if (disabled) {
      setSelected(null);
      setHover(null);
    }
  }, [disabled]);

  /** The target under a point, by the targets' boxes (the held piece itself is ignored). */
  const targetAt = useCallback((x, y) => {
    for (const [id, element] of targets.current) {
      const box = element.getBoundingClientRect();
      if (x >= box.left && x <= box.right && y >= box.top && y <= box.bottom) return id;
    }
    return null;
  }, []);

  const release = useCallback((element) => {
    element.style.setProperty('--drag-x', '0px');
    element.style.setProperty('--drag-y', '0px');
    element.removeAttribute('data-dragging');
  }, []);

  const drop = useCallback((pieceId, targetId) => {
    setSelected(null);
    setHover(null);
    if (!disabledRef.current) dropRef.current(pieceId, targetId);
  }, []);

  /** Props for a target element: its ref and the press that drops a selected piece. */
  const target = useCallback(
    (id) => (element) => {
      if (element) targets.current.set(id, element);
      else targets.current.delete(id);
    },
    [],
  );

  /** Press a target while a piece is selected (the two-press way). */
  const pressTarget = useCallback(
    (id) => {
      if (selected !== null) drop(selected, id);
    },
    [selected, drop],
  );

  /**
   * Props for a draggable piece.
   *
   * @param {string} id
   * @param {string} label  what the piece is, for a screen reader
   */
  const piece = (id, label) => ({
    role: 'button',
    tabIndex: disabled ? -1 : 0,
    'aria-label': label,
    'aria-pressed': selected === id,
    'data-selected': selected === id || undefined,
    'data-held': held === id || undefined,
    onPointerDown(event) {
      if (disabledRef.current || event.button > 0) return;
      const element = /** @type {HTMLElement} */ (event.currentTarget);
      element.setPointerCapture?.(event.pointerId);
      active.current = { id, element, pointer: event.pointerId, x: event.clientX, y: event.clientY, moved: false };
    },
    onPointerMove(event) {
      const now = active.current;
      if (!now || now.pointer !== event.pointerId) return;
      const dx = event.clientX - now.x;
      const dy = event.clientY - now.y;
      if (!now.moved && Math.hypot(dx, dy) < DRAG_START_PX) return;
      if (!now.moved) {
        now.moved = true;
        now.element.setAttribute('data-dragging', 'true');
        setHeld(now.id);
        setSelected(null);
      }
      now.element.style.setProperty('--drag-x', `${dx}px`);
      now.element.style.setProperty('--drag-y', `${dy}px`);
      setHover(targetAt(event.clientX, event.clientY));
    },
    onPointerUp(event) {
      const now = active.current;
      if (!now || now.pointer !== event.pointerId) return;
      active.current = null;
      release(now.element);
      setHeld(null);
      if (now.moved) {
        const over = targetAt(event.clientX, event.clientY);
        setHover(null);
        if (over !== null) drop(now.id, over);
      } else {
        // A press without a drag selects the piece; a second press on it puts it down.
        setSelected((current) => (current === now.id ? null : now.id));
      }
    },
    onPointerCancel(event) {
      const now = active.current;
      if (!now || now.pointer !== event.pointerId) return;
      active.current = null;
      release(now.element);
      setHeld(null);
      setHover(null);
    },
    onKeyDown(event) {
      if (disabledRef.current) return;
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        setSelected((current) => (current === id ? null : id));
      }
      if (event.key === 'Escape') setSelected(null);
    },
  });

  /** Props for a target that can also be pressed (the two-press way, and the keyboard). */
  const targetProps = (id, label) => ({
    ref: target(id),
    role: 'button',
    tabIndex: disabled || selected === null ? -1 : 0,
    'aria-label': label,
    'data-hover': hover === id || undefined,
    'data-ready': (selected !== null && !disabled) || undefined,
    onClick() {
      pressTarget(id);
    },
    onKeyDown(event) {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        pressTarget(id);
      }
    },
  });

  return { piece, target, targetProps, held, selected, hover, clear: () => setSelected(null) };
}

/**
 * A short-lived mark on one thing (a right answer's bounce, a wrong one's
 * shake) that clears itself after `ms`. Answers `[mark, set]`.
 *
 * @template T
 * @param {number} [ms]
 * @returns {[T | null, (value: T | null) => void]}
 */
export function useFlash(ms = 700) {
  const [mark, setMark] = useState(/** @type {T | null} */ (null));
  const timer = useRef(/** @type {ReturnType<typeof setTimeout> | null} */ (null));
  useEffect(() => () => {
    if (timer.current !== null) clearTimeout(timer.current);
  }, []);
  const set = useCallback(
    (value) => {
      if (timer.current !== null) clearTimeout(timer.current);
      setMark(value);
      if (value !== null) timer.current = setTimeout(() => setMark(null), ms);
    },
    [ms],
  );
  return [mark, set];
}

/**
 * Runs `work` after `ms` unless the game leaves first; the next round's wait.
 * Answers a function that starts the wait.
 *
 * @returns {(work: () => void, ms: number) => void}
 */
export function useLater() {
  const timers = useRef(/** @type {Set<ReturnType<typeof setTimeout>>} */ (new Set()));
  useEffect(() => {
    const all = timers.current;
    return () => {
      for (const timer of all) clearTimeout(timer);
      all.clear();
    };
  }, []);
  return useCallback((work, ms) => {
    const timer = setTimeout(() => {
      timers.current.delete(timer);
      work();
    }, ms);
    timers.current.add(timer);
  }, []);
}
