'use client';

/**
 * The trace board, shared by Number tracing and Letter tracing: a square
 * drawing surface with the glyph drawn faintly
 * in the app's own rounded face, ink that follows the pen (mouse, finger or
 * pen), a bar that fills as the glyph's centre line is covered, and Rub out,
 * Skip and Hear buttons. The rules are `lib/games/tracing.js`; this file only
 * draws and listens.
 *
 * - The board mounts once a glyph (the game gives it a new `key` each round).
 * - The glyph's mask comes from drawing it on a small offscreen canvas, so the
 *   drawn guide and the mask are the same shape, dots and cedillas included.
 * - Colours and the face are read from the look's tokens at run time
 *   (`getComputedStyle`), never written here.
 * - Nothing renders per pointer move: ink, the bar and the guide are drawn
 *   through the canvas and the CSSOM in the handlers.
 * - The first time a stroke leaves the allowed area calls `onLeave` once for
 *   that stroke. Rub out and Skip cost nothing.
 * - Its classes start with `tb-`; their rules live in `number-tracing.css`
 *   (one stylesheet a game in `app/games.css`, and this board is shared).
 */

import { Eraser, SkipForward } from 'lucide-react';
import { useCallback, useEffect, useRef } from 'react';

import { Button } from '@/components/ui/button';

import { PATHS, SUCCESS, fitGlyph, inside, maskFromAlpha, measure, prepare, stamp, startCoverage, stroke } from '../../lib/games/tracing.js';

import { Prompt } from './parts.jsx';

/** Cells along the board's side in the engine's grid. */
const GRID = 192;

/** CSS pixels kept free round the surface for its shadow. */
const SHADOW_ROOM = 10;

/** How full the bar may look while a part (a dot, a cedilla) is still missing. */
const MISSING_PART_BAR = 0.96;

/**
 * @typedef {{ x: number, y: number }} Point   a share of the board's side, 0 to 1
 * @typedef {{ pointer: number, points: Point[], left: boolean }} Stroke
 */

/** The board's colours, from the look's tokens. @param {Element} element */
function readColours(element) {
  const style = getComputedStyle(element);
  const read = (name, fallback) => style.getPropertyValue(name).trim() || style.getPropertyValue(fallback).trim();
  return {
    path: read('--muted', '--secondary'),
    edge: read('--muted-foreground', '--border'),
    guide: read('--muted-foreground', '--foreground'),
    ink: read('--primary', '--foreground'),
    off: read('--muted-foreground', '--foreground'),
    hint: read('--primary', '--foreground'),
    done: read('--chart-3', '--primary'),
  };
}

/** The look's display face and weight. @param {Element} element */
function readFace(element) {
  const style = getComputedStyle(element);
  return {
    family: style.getPropertyValue('--font-display').trim() || 'sans-serif',
    weight: style.getPropertyValue('--display-weight').trim() || '700',
  };
}

/**
 * Sets the canvas's face at a size. A face list the canvas cannot read leaves
 * its font as it was, so the plain sans-serif face stands in then.
 *
 * @param {CanvasRenderingContext2D} context
 * @param {{ family: string, weight: string }} face
 * @param {number} size
 */
function setFace(context, face, size) {
  context.font = '1px serif';
  const before = context.font;
  context.font = `${face.weight} ${size}px ${face.family}`;
  if (context.font === before) context.font = `${face.weight} ${size}px sans-serif`;
}

/**
 * Draws the glyph (fill and, on a wider path, an outline round it) with the
 * context's current colours.
 *
 * @param {CanvasRenderingContext2D} context
 * @param {string} glyph
 * @param {{ size: number, x: number, y: number }} layout
 * @param {{ family: string, weight: string }} face
 * @param {number} outline  extra outline width, in the layout's units
 */
function drawGlyph(context, glyph, layout, face, outline) {
  setFace(context, face, layout.size);
  context.textAlign = 'left';
  context.textBaseline = 'alphabetic';
  context.lineJoin = 'round';
  context.lineCap = 'round';
  if (outline > 0) {
    context.lineWidth = outline;
    context.strokeText(glyph, layout.x, layout.y);
  }
  context.fillText(glyph, layout.x, layout.y);
}

/**
 * @param {{
 *   glyph: string,
 *   path: 'wide' | 'middle' | 'narrow',
 *   guide: boolean,
 *   prompt: string,
 *   locale: string,
 *   words: { board: string, meter: string, redo: string, skip: string },
 *   over: boolean,
 *   onHear: () => void,
 *   onLeave: () => void,
 *   onMissingPart: () => void,
 *   onTraced: () => void,
 *   onSkip: () => void,
 * }} props
 */
export default function TraceBoard({ glyph, path, guide, prompt, locale, words, over, onHear, onLeave, onMissingPart, onTraced, onSkip }) {
  const boxRef = useRef(/** @type {HTMLDivElement | null} */ (null));
  const surfaceRef = useRef(/** @type {HTMLDivElement | null} */ (null));
  const guideRef = useRef(/** @type {HTMLCanvasElement | null} */ (null));
  const inkRef = useRef(/** @type {HTMLCanvasElement | null} */ (null));
  const meterRef = useRef(/** @type {HTMLDivElement | null} */ (null));
  const fillRef = useRef(/** @type {HTMLSpanElement | null} */ (null));

  /** Everything that changes while the pen moves; never React state. */
  const model = useRef({
    side: 0,
    /** @type {{ size: number, x: number, y: number } | null} */
    layout: null,
    /** @type {{ family: string, weight: string } | null} */
    face: null,
    /** @type {ReturnType<typeof readColours> | null} */
    colours: null,
    /** @type {ReturnType<typeof prepare> | null} */
    trace: null,
    /** @type {ReturnType<typeof startCoverage> | null} */
    coverage: null,
    /** @type {Stroke[]} */
    strokes: [],
    /** @type {Stroke | null} */
    active: null,
    hinted: false,
    done: false,
  });

  // The latest callbacks, read by the handlers without binding them again.
  const calls = useRef({ onLeave, onMissingPart, onTraced, onSkip });
  calls.current = { onLeave, onMissingPart, onTraced, onSkip };
  const overRef = useRef(over);
  overRef.current = over;

  const outlineWidth = useCallback(() => (model.current.layout ? PATHS[path].grow * model.current.layout.size : 0), [path]);

  /** Ink width in CSS pixels: about half the glyph's stroke. */
  const inkWidth = useCallback(() => {
    const { trace, side } = model.current;
    if (!trace || side === 0) return 8;
    return Math.max(6, (trace.strokeWidth * side) / GRID / 2);
  }, []);

  /** A canvas sized to the board and the screen's pixel ratio, cleared, in CSS pixels. */
  const fresh = useCallback((canvas) => {
    const { side } = model.current;
    const ratio = window.devicePixelRatio || 1;
    const size = Math.max(1, Math.round(side * ratio));
    if (canvas.width !== size) canvas.width = size;
    if (canvas.height !== size) canvas.height = size;
    const context = canvas.getContext('2d');
    if (!context) return null;
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, size, size);
    context.setTransform(size / side, 0, 0, size / side, 0, 0);
    return context;
  }, []);

  /** The faint glyph, its edge, the centre line (Easy) and any missing part's hint; filled when done. */
  const drawGuide = useCallback(() => {
    const canvas = guideRef.current;
    const { layout, face, colours, trace, coverage, side, done, hinted } = model.current;
    if (!canvas || !layout || !face || !colours || side === 0) return;
    const context = fresh(canvas);
    if (!context) return;
    const outline = outlineWidth();
    // A soft edge round the path, so it shows on the card.
    if (!done) {
      context.strokeStyle = colours.edge;
      context.fillStyle = colours.edge;
      context.globalAlpha = 0.4;
      drawGlyph(context, glyph, layout, face, outline + 5);
      context.globalAlpha = 1;
    }
    context.strokeStyle = done ? colours.done : colours.path;
    context.fillStyle = done ? colours.done : colours.path;
    drawGlyph(context, glyph, layout, face, outline);
    if (done || !trace || !coverage) return;
    const cell = side / GRID;
    const dots = (colour, radius, which) => {
      context.fillStyle = colour;
      context.beginPath();
      for (let index = 0; index < trace.points.length / 2; index += 1) {
        if (!which(index)) continue;
        const x = (trace.points[index * 2] + 0.5) * cell;
        const y = (trace.points[index * 2 + 1] + 0.5) * cell;
        context.moveTo(x + radius, y);
        context.arc(x, y, radius, 0, Math.PI * 2);
      }
      context.fill();
    };
    if (guide) {
      // The centre line as a dotted line: points at least `gap` cells apart.
      const gap = Math.max(4, trace.strokeWidth / 3);
      /** @type {number[]} */
      const chosen = [];
      for (let index = 0; index < trace.points.length / 2; index += 1) {
        const x = trace.points[index * 2];
        const y = trace.points[index * 2 + 1];
        if (chosen.every((other) => (trace.points[other * 2] - x) ** 2 + (trace.points[other * 2 + 1] - y) ** 2 >= gap * gap)) chosen.push(index);
      }
      const keep = new Set(chosen);
      context.globalAlpha = 0.6;
      dots(colours.guide, Math.max(3, cell * 1.6), (index) => keep.has(index));
      context.globalAlpha = 1;
    }
    if (hinted) {
      // A dashed ring round each part still missing (a dot, a cedilla), so the eye finds it.
      const { parts } = measure(trace, coverage);
      context.strokeStyle = colours.hint;
      context.lineWidth = Math.max(3, cell * 1.2);
      context.setLineDash([context.lineWidth * 2.5, context.lineWidth * 2]);
      parts.forEach((share, part) => {
        if (share >= SUCCESS) return;
        let left = Infinity;
        let right = -Infinity;
        let top = Infinity;
        let bottom = -Infinity;
        for (let index = 0; index < trace.points.length / 2; index += 1) {
          if (trace.pointPart[index] !== part) continue;
          left = Math.min(left, trace.points[index * 2]);
          right = Math.max(right, trace.points[index * 2]);
          top = Math.min(top, trace.points[index * 2 + 1]);
          bottom = Math.max(bottom, trace.points[index * 2 + 1]);
        }
        const radius = (Math.hypot(right - left, bottom - top) / 2 + trace.strokeWidth / 2 + 3) * cell;
        context.beginPath();
        context.arc(((left + right) / 2 + 0.5) * cell, ((top + bottom) / 2 + 0.5) * cell, radius, 0, Math.PI * 2);
        context.stroke();
      });
      context.setLineDash([]);
    }
  }, [fresh, glyph, guide, outlineWidth]);

  /** One piece of ink from `from` to `to` (shares of the side). */
  const drawInk = useCallback((context, from, to, off) => {
    const { colours, side } = model.current;
    if (!colours) return;
    context.strokeStyle = off ? colours.off : colours.ink;
    context.fillStyle = context.strokeStyle;
    // Ink off the path is thinner and grey: it shows where the pen went without looking like tracing.
    context.lineWidth = off ? Math.max(4, inkWidth() * 0.5) : inkWidth();
    context.lineCap = 'round';
    context.lineJoin = 'round';
    context.beginPath();
    if (from.x === to.x && from.y === to.y) {
      // A press without a move: a round dot.
      context.arc(from.x * side, from.y * side, context.lineWidth / 2, 0, Math.PI * 2);
      context.fill();
    } else {
      context.moveTo(from.x * side, from.y * side);
      context.lineTo(to.x * side, to.y * side);
      context.stroke();
    }
  }, [inkWidth]);

  const inkContext = useCallback(() => {
    const canvas = inkRef.current;
    const { side } = model.current;
    if (!canvas || side === 0) return null;
    const context = canvas.getContext('2d');
    if (!context) return null;
    const ratio = canvas.width / side;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    return context;
  }, []);

  /** The bar and the board's marks, from the coverage now; reports a finished glyph once. */
  const update = useCallback(() => {
    const { trace, coverage } = model.current;
    if (!trace || !coverage || model.current.done) return;
    const result = measure(trace, coverage);
    let share = Math.min(1, result.fraction / SUCCESS);
    if (!result.done) share = Math.min(share, MISSING_PART_BAR);
    if (result.done) share = 1;
    fillRef.current?.style.setProperty('transform', `scaleX(${share.toFixed(3)})`);
    meterRef.current?.setAttribute('aria-valuenow', String(Math.round(share * 100)));
    surfaceRef.current?.setAttribute('data-coverage', String(Math.round(result.fraction * 100)));
    if (result.done && !model.current.done) {
      model.current.done = true;
      model.current.active = null;
      model.current.strokes = [];
      surfaceRef.current?.setAttribute('data-state', 'done');
      const ink = inkRef.current;
      if (ink) fresh(ink);
      drawGuide();
      calls.current.onTraced();
    }
  }, [drawGuide, fresh]);

  /** Coverage and ink again from the kept strokes (after a size change); reports nothing. */
  const replay = useCallback(() => {
    const now = model.current;
    if (!now.trace) return;
    now.coverage = startCoverage(now.trace);
    const ink = inkRef.current;
    const context = ink ? fresh(ink) : null;
    for (const line of now.strokes) {
      const [first, ...rest] = line.points;
      stamp(now.trace, now.coverage, first.x * GRID, first.y * GRID);
      if (context) drawInk(context, first, first, !inside(now.trace, first.x * GRID, first.y * GRID));
      let last = first;
      for (const point of rest) {
        const step = stroke(now.trace, now.coverage, { x: last.x * GRID, y: last.y * GRID }, { x: point.x * GRID, y: point.y * GRID });
        if (context) drawInk(context, last, point, step.left);
        last = point;
      }
    }
  }, [drawInk, fresh]);

  // Size the board to its box, build the glyph's mask and draw; again on every size change.
  useEffect(() => {
    const box = boxRef.current;
    const surface = surfaceRef.current;
    if (!box || !surface) return undefined;
    let cancelled = false;
    let frame = 0;
    const build = async () => {
      const rect = box.getBoundingClientRect();
      // A little room round the surface for its shadow.
      const outer = Math.max(8, Math.floor(Math.min(rect.width, rect.height)) - SHADOW_ROOM);
      surface.style.setProperty('width', `${outer}px`);
      surface.style.setProperty('height', `${outer}px`);
      // The canvases fill the surface inside its border: that is the board's side.
      const side = Math.max(1, Math.min(surface.clientWidth, surface.clientHeight));
      if (side === model.current.side && model.current.trace) return;
      const face = readFace(surface);
      try {
        await document.fonts?.load(`${face.weight} 100px ${face.family}`, glyph);
      } catch {
        // A system face needs no loading; draw with what the screen has.
      }
      if (cancelled) return;
      const scratch = document.createElement('canvas');
      scratch.width = GRID;
      scratch.height = GRID;
      const context = scratch.getContext('2d', { willReadFrequently: true });
      if (!context) return;
      setFace(context, face, 100);
      const metrics = context.measureText(glyph);
      const grow = PATHS[path].grow;
      const layout = fitGlyph(
        {
          left: metrics.actualBoundingBoxLeft,
          right: metrics.actualBoundingBoxRight,
          ascent: metrics.actualBoundingBoxAscent,
          descent: metrics.actualBoundingBoxDescent,
        },
        side,
        grow,
      );
      // The mask: the same drawing on the grid, in the canvas's own first colour (its alpha is all we read).
      context.setTransform(GRID / side, 0, 0, GRID / side, 0, 0);
      drawGlyph(context, glyph, layout, face, grow * layout.size);
      const pixels = context.getImageData(0, 0, GRID, GRID).data;
      const tolerance = (PATHS[path].tolerance * layout.size * GRID) / side;
      const trace = prepare(maskFromAlpha(pixels, GRID, GRID), { tolerance });
      Object.assign(model.current, { side, layout, face, colours: readColours(surface), trace });
      replay();
      drawGuide();
      update();
    };
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => void build());
    });
    observer.observe(box);
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [drawGuide, glyph, path, replay, update]);

  const blocked = () => overRef.current || model.current.done || !model.current.trace;

  /** A pointer event's place as shares of the board's side. */
  const placeOf = (event) => {
    const canvas = inkRef.current;
    if (!canvas) return { x: -1, y: -1 };
    const rect = canvas.getBoundingClientRect();
    return { x: (event.clientX - rect.left) / Math.max(1, rect.width), y: (event.clientY - rect.top) / Math.max(1, rect.height) };
  };

  /** The stroke has left the allowed area: once a stroke. */
  const leave = (line) => {
    if (line.left) return;
    line.left = true;
    calls.current.onLeave();
  };

  function down(event) {
    if (blocked() || model.current.active || (event.pointerType === 'mouse' && event.button !== 0)) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    const now = model.current;
    const point = placeOf(event);
    /** @type {Stroke} */
    const line = { pointer: event.pointerId, points: [point], left: false };
    now.active = line;
    now.strokes.push(line);
    const off = !inside(now.trace, point.x * GRID, point.y * GRID);
    stamp(now.trace, now.coverage, point.x * GRID, point.y * GRID);
    const context = inkContext();
    if (context) drawInk(context, point, point, off);
    if (off) leave(line);
    update();
  }

  function move(event) {
    const now = model.current;
    const line = now.active;
    if (!line || line.pointer !== event.pointerId || blocked()) return;
    const native = event.nativeEvent;
    const events = typeof native.getCoalescedEvents === 'function' ? native.getCoalescedEvents() : [];
    const context = inkContext();
    for (const each of events.length > 0 ? events : [native]) {
      const point = placeOf(each);
      const last = line.points[line.points.length - 1];
      if (Math.abs(point.x - last.x) + Math.abs(point.y - last.y) < 0.0005) continue;
      const step = stroke(now.trace, now.coverage, { x: last.x * GRID, y: last.y * GRID }, { x: point.x * GRID, y: point.y * GRID });
      line.points.push(point);
      if (context) drawInk(context, last, point, step.left);
      if (step.left) leave(line);
    }
    update();
  }

  function up(event) {
    const now = model.current;
    if (!now.active || now.active.pointer !== event.pointerId) return;
    now.active = null;
    if (now.done || !now.trace || !now.coverage) return;
    // The whole is traced but a dot or a cedilla is not: show it, and say so once.
    if (measure(now.trace, now.coverage).missingPart && !now.hinted) {
      now.hinted = true;
      drawGuide();
      calls.current.onMissingPart();
    } else if (now.hinted) {
      drawGuide();
    }
  }

  function redo() {
    const now = model.current;
    if (blocked()) return;
    now.strokes = [];
    now.active = null;
    now.hinted = false;
    now.coverage = now.trace ? startCoverage(now.trace) : null;
    const ink = inkRef.current;
    if (ink) fresh(ink);
    drawGuide();
    update();
  }

  function skip() {
    if (overRef.current || model.current.done) return;
    calls.current.onSkip();
  }

  return (
    <div className="tb" data-path={path} data-guide={guide || undefined}>
      <Prompt text={prompt} locale={locale} onHear={onHear} className="tb-prompt" />
      <div className="tb-box" ref={boxRef}>
        <div className="tb-surface" ref={surfaceRef} data-state="tracing" data-glyph={glyph}>
          <canvas className="tb-guide" ref={guideRef} aria-hidden="true" />
          <canvas
            className="tb-ink"
            ref={inkRef}
            role="img"
            aria-label={words.board}
            onPointerDown={down}
            onPointerMove={move}
            onPointerUp={up}
            onPointerCancel={up}
            onLostPointerCapture={up}
          />
        </div>
      </div>
      <div className="tb-foot">
        <Button type="button" variant="outline" size="lg" className="tb-tool tb-redo" onClick={redo} disabled={over}>
          <Eraser aria-hidden="true" />
          {words.redo}
        </Button>
        <div
          className="tb-meter"
          ref={meterRef}
          role="progressbar"
          aria-label={words.meter}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={0}
        >
          <span className="tb-meter-fill" ref={fillRef} />
        </div>
        <Button type="button" variant="outline" size="lg" className="tb-tool tb-skip" onClick={skip} disabled={over}>
          <SkipForward aria-hidden="true" />
          {words.skip}
        </Button>
      </div>
    </div>
  );
}
