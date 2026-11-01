'use client';

/**
 * Toy room: toys shaped like solids (a ball, a cube, a cone …) stand on a round
 * rug in a small 3D room. The voice asks for one ("Where is the cone?") and the
 * child taps that toy. Dragging the rug (or the arrow keys) turns it, so each toy
 * can be seen from its other sides; on Hard the rug also turns slowly by itself.
 *
 * The scene is drawn by three.js (`toy-scene.js`), loaded only when this game
 * opens. Each toy has a real tap target over it, so a press, a key or a screen
 * reader reaches the toy the eye sees. A computer that cannot draw in 3D gets a
 * plain line that says so.
 */

import { useEffect, useRef, useState } from 'react';

import { t } from '../../lib/i18n/index.js';
import { capitalFirst, isRight, makeRound, rulesFor, toyOf } from '../../lib/games/toy-room.js';

import { Prompt, useLater } from './parts.jsx';
import { createToyScene } from './toy-scene.js';

/** How long the found toy hops before the next round, in milliseconds. */
const NEXT_ROUND_MS = 1100;
/** After the run ends, the scene stops once the last hop or wobble has played (they last 750 ms at most). */
const FREEZE_AFTER_MS = 800;
/** How far a press may move before it turns the rug instead of picking a toy, in CSS pixels. */
const DRAG_START_PX = 8;
/** One arrow key press turns the rug this far, in radians. */
const KEY_TURN = Math.PI / 8;

/** @param {{ level: string, locale: string, play: any, over: boolean, paused?: boolean }} props */
export default function ToyRoom({ level, locale, play, over, paused = false }) {
  /** The round, numbered so each round's tap targets are new elements (a reused one would change its label unheard). */
  const [round, setRound] = useState(() => ({ ...makeRound(level), serial: 0 }));
  /** The toys tapped by mistake this round: they wobble, then rest dimmed. */
  const [missed, setMissed] = useState(() => /** @type {Set<string>} */ (new Set()));
  const [found, setFound] = useState(/** @type {string | null} */ (null));
  /** 'loading' while three.js arrives, 'ready', or 'no3d' when this computer cannot draw in 3D. */
  const [status, setStatus] = useState(/** @type {'loading' | 'ready' | 'no3d'} */ ('loading'));
  const stageRef = useRef(/** @type {HTMLDivElement | null} */ (null));
  const spots = useRef(/** @type {Map<string, HTMLElement>} */ (new Map()));
  const sceneRef = useRef(/** @type {ReturnType<typeof createToyScene> | null} */ (null));
  /** A press on the stage: where it started, and whether it became a turn of the rug. */
  const press = useRef(/** @type {{ pointer: number, x: number, last: number, turning: boolean } | null} */ (null));
  /** The press that just ended turned the rug, so the click that follows picks nothing. */
  const turned = useRef(false);
  const waiting = useRef(false);
  /** A toy had the keyboard's focus when the round ended: the next round's first toy takes it. */
  const refocus = useRef(false);
  const later = useLater();

  const word = (kind) => t(`games.toy-room.solid.${kind}`, locale);
  const fill = (kind) => ({ shape: word(kind), Shape: capitalFirst(word(kind), locale) });
  const prompt = t('games.toy-room.prompt', locale, fill(round.wanted));

  // Build the scene once; three.js loads here, so no other game's page carries it.
  useEffect(() => {
    let gone = false;
    let scene = null;
    (async () => {
      try {
        const [THREE, box, room] = await Promise.all([
          import('three'),
          import('three/addons/geometries/RoundedBoxGeometry.js'),
          import('three/addons/environments/RoomEnvironment.js'),
        ]);
        const stage = stageRef.current;
        if (gone || !stage) return;
        scene = createToyScene({
          THREE,
          RoundedBoxGeometry: box.RoundedBoxGeometry,
          RoomEnvironment: room.RoomEnvironment,
          stage,
          spots: spots.current,
          still: typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
          turning: rulesFor(level).turning,
          onFrames: (count) => {
            stage.dataset.frames = String(count);
          },
        });
        sceneRef.current = scene;
        setStatus('ready');
      } catch {
        if (!gone) setStatus('no3d');
      }
    })();
    return () => {
      gone = true;
      sceneRef.current = null;
      scene?.dispose();
    };
    // Once for the game; the level is fixed for a run.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Each round: the toys come onto the rug and the question is asked.
  useEffect(() => {
    if (status !== 'ready') return;
    sceneRef.current?.show(round);
    if (refocus.current) {
      refocus.current = false;
      stageRef.current?.querySelector('.ty-spot')?.focus();
    }
    play.say(prompt);
    // Only when the round changes or the scene becomes ready; `prompt` follows the round.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round, status, play]);

  // The grown-ups window is open: everything holds still (the frame asks every game that moves on its own).
  useEffect(() => {
    if (status === 'ready') sceneRef.current?.pause(paused);
  }, [paused, status]);

  // The run is over: once the last hop or wobble has played, the rug stops where it is.
  useEffect(() => {
    if (!over) return undefined;
    const timer = setTimeout(() => sceneRef.current?.freeze(), FREEZE_AFTER_MS);
    return () => clearTimeout(timer);
  }, [over]);

  function pick(toyId) {
    if (over || waiting.current || missed.has(toyId) || status !== 'ready') return;
    const toy = toyOf(round, toyId);
    if (!toy) return;
    if (isRight(round, toyId)) {
      waiting.current = true;
      setFound(toyId);
      sceneRef.current?.hop(toyId);
      play.say(t('games.toy-room.yes', locale, fill(toy.kind)));
      play.right();
      later(() => {
        if (play.isOver()) return;
        waiting.current = false;
        refocus.current = Boolean(stageRef.current?.contains(document.activeElement));
        setFound(null);
        setMissed(new Set());
        setRound((current) => ({ ...makeRound(level, current.wanted), serial: current.serial + 1 }));
      }, NEXT_ROUND_MS);
    } else {
      setMissed((all) => new Set(all).add(toyId));
      sceneRef.current?.wobble(toyId);
      play.say(`${t('games.toy-room.wrong', locale, fill(toy.kind))} ${prompt}`);
      play.miss();
    }
  }

  const stageEvents = {
    onPointerDown(event) {
      if (event.button > 0 || over) return;
      turned.current = false;
      press.current = { pointer: event.pointerId, x: event.clientX, last: event.clientX, turning: false };
    },
    onPointerMove(event) {
      const now = press.current;
      if (!now || now.pointer !== event.pointerId) return;
      // A mouse released outside the stage before the turn began: that press is over.
      if (event.buttons === 0) {
        press.current = null;
        event.currentTarget.removeAttribute('data-turning');
        return;
      }
      if (!now.turning) {
        if (Math.abs(event.clientX - now.x) < DRAG_START_PX) return;
        now.turning = true;
        // Held from here on, so the turn goes on outside the stage and no toy takes the click.
        event.currentTarget.setPointerCapture?.(event.pointerId);
        event.currentTarget.setAttribute('data-turning', 'true');
      }
      const width = Math.max(1, event.currentTarget.clientWidth);
      sceneRef.current?.turnBy(((event.clientX - now.last) / width) * Math.PI * 1.4);
      now.last = event.clientX;
    },
    onPointerUp(event) {
      const now = press.current;
      if (!now || now.pointer !== event.pointerId) return;
      press.current = null;
      turned.current = now.turning;
      event.currentTarget.removeAttribute('data-turning');
    },
    onPointerCancel(event) {
      if (press.current?.pointer !== event.pointerId) return;
      press.current = null;
      event.currentTarget.removeAttribute('data-turning');
    },
    onLostPointerCapture(event) {
      if (press.current?.pointer !== event.pointerId) return;
      press.current = null;
      event.currentTarget.removeAttribute('data-turning');
    },
    onKeyDown(event) {
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault();
        sceneRef.current?.turnBy(event.key === 'ArrowLeft' ? -KEY_TURN : KEY_TURN);
      }
    },
  };

  // A mark for the review driver only (invisible): one toy that is not the asked one.
  const wrongToy = round.toys.find((toy) => toy.kind !== round.wanted && !missed.has(toy.id));

  // Nothing to ask about when the toys cannot be drawn.
  if (status === 'no3d') {
    return (
      <div className="ty">
        <p className="ty-no3d" role="status">
          {t('games.toy-room.no3d', locale)}
        </p>
      </div>
    );
  }

  return (
    <div className="ty">
      <Prompt text={prompt} locale={locale} onHear={() => play.say(prompt)} />
      <div
        ref={stageRef}
        className="ty-stage"
        role="group"
        aria-label={t('games.toy-room.stage', locale)}
        aria-busy={status === 'loading' || undefined}
        data-level={level}
        {...stageEvents}
      >
        {/* The scene puts its own canvas first in here. */}
        {status === 'ready'
          ? round.toys.map((toy) => {
              const state = found === toy.id ? 'right' : missed.has(toy.id) ? 'wrong' : 'idle';
              return (
                <div
                  key={`${round.serial}-${toy.id}`}
                  ref={(element) => {
                    spots.current.set(toy.id, element);
                    return () => {
                      if (spots.current.get(toy.id) === element) spots.current.delete(toy.id);
                    };
                  }}
                  className="ty-spot"
                  role="button"
                  tabIndex={over || state !== 'idle' ? -1 : 0}
                  aria-label={t('games.toy-room.toy', locale, fill(toy.kind))}
                  aria-disabled={state !== 'idle' || undefined}
                  data-state={state}
                  data-kind={toy.kind}
                  data-answer={toy.kind === round.wanted || undefined}
                  data-wrong={wrongToy?.id === toy.id || undefined}
                  onClick={() => {
                    if (turned.current) {
                      turned.current = false;
                      return;
                    }
                    pick(toy.id);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      pick(toy.id);
                    }
                  }}
                />
              );
            })
          : null}
      </div>
    </div>
  );
}
