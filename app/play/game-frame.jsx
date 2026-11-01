'use client';

/**
 * The frame every game plays in: the bar, the star meter, the
 * start card, the play area and the end card.
 *
 * The frame owns the meter, the sounds and the voice. A game gets four props
 * and reports each answer with `play.right()` or `play.miss()`:
 *
 * - `level`: 'easy' | 'normal' | 'hard', fixed for the run
 * - `locale`: 'en' | 'tr', the words and the voice
 * - `play`: stable for the run: `right()`, `miss()`, `say(text)`, `praise()`,
 *   `sound(name)` ('tap' | 'pop' | 'right' | 'miss' | 'win'), `isOver()`
 * - `over`: true once the run is won or lost; the game takes no more input
 * - `paused`: true while the grown-ups window is open; a game that moves on
 *   its own stops its clock (no movement, no miss)
 *
 * Play again remounts the game, so a run always starts fresh.
 */

import { ChevronLeft, ChevronRight, House, Play, RotateCcw, Star } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Button, buttonVariants } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { StatusRow } from '@/components/ui/toggle-group';

import { t } from '../../lib/i18n/index.js';
import { CATEGORIES, LEVELS, gameById, neighbours } from '../../lib/play/catalog.js';
import { afterMiss, afterRight, startMeter } from '../../lib/play/meter.js';
import { createSounds } from '../../lib/play/sounds.js';
import { createSpeaker } from '../../lib/play/voice.js';
import { Decor, GameArt } from '../art.jsx';
import { GrownUps, SaveProblem, usePlay } from '../play-settings.jsx';

import { GAME_COMPONENTS } from './games.js';

/** How long the last right answer's motion plays before the end card shows, in milliseconds. */
const END_PAUSE_MS = 700;
/** How many praise lines the words hold (`play.praise.1` …). */
const PRAISE_LINES = 4;
/** Confetti pieces on the win card; each piece's place and colour is a class in `app/globals.css`. */
const CONFETTI = 24;

/** @param {{ gameId: string, problem: string | null }} props */
export function GameFrame({ gameId, problem }) {
  const { settingsRef, settings, choices, locale, changeChoice, grownUpsOpen } = usePlay();
  const game = gameById(gameId);
  const category = CATEGORIES.find((entry) => entry.id === game.category);
  const around = neighbours(gameId);
  const Game = GAME_COMPONENTS[gameId];
  const name = t(`games.${gameId}.name`, locale);
  const level = choices[gameId]?.level ?? 'normal';
  /** The running game's level, fixed at Play: a save that fails later puts the old choice back on the start card only. */
  const [runLevel, setRunLevel] = useState(level);

  const [phase, setPhase] = useState(/** @type {'start' | 'playing' | 'won' | 'lost'} */ ('start'));
  const [run, setRun] = useState(0);
  const [meter, setMeter] = useState(startMeter);
  const meterRef = useRef(meter);
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const localeRef = useRef(locale);
  localeRef.current = locale;

  const speaker = useMemo(() => createSpeaker({ enabled: () => settingsRef.current.voiceOn }), [settingsRef]);
  const sounds = useMemo(() => createSounds({ enabled: () => settingsRef.current.soundOn }), [settingsRef]);
  useEffect(() => {
    speaker.wake();
    return () => {
      speaker.stop();
      sounds.close();
    };
  }, [speaker, sounds]);
  // Turning Speaking off stops what is being said now.
  useEffect(() => {
    if (!settings.voiceOn) speaker.hush();
  }, [settings.voiceOn, speaker]);

  const endTimer = useRef(/** @type {ReturnType<typeof setTimeout> | null} */ (null));
  useEffect(() => () => {
    if (endTimer.current !== null) clearTimeout(endTimer.current);
  }, []);

  const finish = useCallback(
    (/** @type {'won' | 'lost'} */ how) => {
      if (endTimer.current !== null) clearTimeout(endTimer.current);
      endTimer.current = setTimeout(() => {
        endTimer.current = null;
        setPhase(how);
        if (how === 'won') {
          sounds.play('win');
          speaker.say(t('play.wonSay', localeRef.current), localeRef.current);
        } else {
          speaker.say(t('play.lostSay', localeRef.current), localeRef.current);
        }
      }, END_PAUSE_MS);
    },
    [sounds, speaker],
  );

  const setMeterBoth = useCallback((next) => {
    meterRef.current = next;
    setMeter(next);
  }, []);

  // One play object for each run: its methods read the latest values through refs.
  const play = useMemo(
    () => ({
      right() {
        const now = meterRef.current;
        if (now.state !== 'playing') return;
        const next = afterRight(now, game.gain);
        setMeterBoth(next);
        sounds.play('right');
        if (next.state === 'won') finish('won');
      },
      miss() {
        const now = meterRef.current;
        if (now.state !== 'playing') return;
        const next = afterMiss(now, settingsRef.current.challenge);
        setMeterBoth(next);
        sounds.play('miss');
        if (next.state === 'lost') finish('lost');
      },
      say(text) {
        if (meterRef.current.state === 'playing' || phaseRef.current === 'playing') speaker.say(text, localeRef.current);
      },
      praise() {
        const line = 1 + Math.floor(Math.random() * PRAISE_LINES);
        speaker.say(t(`play.praise.${line}`, localeRef.current), localeRef.current);
      },
      sound(soundName) {
        sounds.play(soundName);
      },
      isOver() {
        return meterRef.current.state !== 'playing';
      },
    }),
    // A new object for each run, so a game's effects that depend on it start again with it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [run, game.gain, finish, setMeterBoth, sounds, speaker, settingsRef],
  );

  function begin() {
    sounds.wake();
    speaker.prime();
    speaker.hush();
    setRunLevel(level);
    setMeterBoth(startMeter());
    setRun((value) => value + 1);
    setPhase('playing');
  }

  function backToStart() {
    if (endTimer.current !== null) clearTimeout(endTimer.current);
    endTimer.current = null;
    speaker.hush();
    setMeterBoth(startMeter());
    setPhase('start');
  }

  const over = meter.state !== 'playing';
  const levelWords = t(`games.${gameId}.levels.${level}`, locale);

  return (
    <div className="game-shell" data-mark={category?.mark} data-phase={phase}>
      <nav className="play-bar" aria-label={name}>
        <Link href="/" className={buttonVariants({ variant: 'ghost', size: 'icon-lg', className: 'play-bar-button' })} aria-label={t('play.allGames', locale)} title={t('play.allGames', locale)}>
          <House aria-hidden="true" />
        </Link>
        <Link href={`/play/${around.previous}`} className={buttonVariants({ variant: 'ghost', size: 'icon-lg', className: 'play-bar-button' })} aria-label={t('play.previous', locale, { name: t(`games.${around.previous}.name`, locale) })} title={t('play.previous', locale, { name: t(`games.${around.previous}.name`, locale) })}>
          <ChevronLeft aria-hidden="true" />
        </Link>
        <h1 className="play-bar-title">
          <GameArt gameId={gameId} className="play-bar-icon" />
          <span className="play-bar-name">{name}</span>
        </h1>
        <Link href={`/play/${around.next}`} className={buttonVariants({ variant: 'ghost', size: 'icon-lg', className: 'play-bar-button' })} aria-label={t('play.next', locale, { name: t(`games.${around.next}.name`, locale) })} title={t('play.next', locale, { name: t(`games.${around.next}.name`, locale) })}>
          <ChevronRight aria-hidden="true" />
        </Link>
        <Button type="button" variant="ghost" size="icon-lg" className="play-bar-button" onClick={backToStart} aria-label={t('play.restart', locale)} title={t('play.restart', locale)}>
          <RotateCcw aria-hidden="true" />
        </Button>
        <GrownUps compact />
      </nav>

      <div className="play-meter" data-state={meter.state}>
        <Progress value={meter.value} aria-label={t('play.meter', locale, { value: String(meter.value) })} className="play-meter-bar" />
        <span className="play-meter-star" aria-hidden="true">
          <Star />
        </span>
        <span className="play-meter-value" aria-hidden="true">{meter.value}</span>
      </div>

      {problem !== null ? (
        <p className="save-problem" role="alert">
          {t(problem, locale)} {t('home.playsAnyway', locale)}
        </p>
      ) : null}
      <SaveProblem />

      <section className="play-area" aria-label={name}>
        {phase === 'start' ? (
          <div className="start-card">
            <GameArt gameId={gameId} className="start-disc" />
            <h2 className="start-name">{name}</h2>
            <p className="start-how">{t(`games.${gameId}.howTo`, locale)}</p>
            <div className="start-level">
              <StatusRow
                label={t('play.level', locale)}
                value={level}
                onValueChange={(value) => changeChoice(gameId, { level: value })}
                options={LEVELS.map((value) => ({ value, label: t(`level.${value}`, locale) }))}
              />
              <span className="start-level-words">{levelWords}</span>
            </div>
            <Button type="button" size="lg" className="start-play" onClick={begin}>
              <Play aria-hidden="true" />
              {t('play.start', locale)}
            </Button>
          </div>
        ) : (
          <div className="play-stage" data-over={over || undefined}>
            <Game key={run} level={runLevel} locale={locale} play={play} over={over} paused={grownUpsOpen} />
          </div>
        )}

        {phase === 'won' ? (
          <div className="end-card" role="dialog" aria-modal="false" aria-labelledby="end-title">
            <div className="confetti" aria-hidden="true">
              {Array.from({ length: CONFETTI }, (_, index) => (
                <span key={index} />
              ))}
            </div>
            <Decor name="trophy" className="end-art" />
            <h2 id="end-title" className="end-title">{t('play.won', locale)}</h2>
            <p className="end-line">{t('play.wonLine', locale)}</p>
            <div className="end-actions">
              <Button type="button" size="lg" onClick={begin}>
                <RotateCcw aria-hidden="true" />
                {t('play.again', locale)}
              </Button>
              <Link href={`/play/${around.next}`} className={buttonVariants({ variant: 'secondary', size: 'lg' })}>
                {t('play.nextGame', locale)}
                <ChevronRight aria-hidden="true" />
              </Link>
              <Link href="/" className={buttonVariants({ variant: 'outline', size: 'lg' })}>
                <House aria-hidden="true" />
                {t('play.allGames', locale)}
              </Link>
            </div>
          </div>
        ) : null}
        {phase === 'lost' ? (
          <div className="end-card" role="dialog" aria-modal="false" aria-labelledby="end-title">
            <Decor name="teddy" className="end-art" />
            <h2 id="end-title" className="end-title">{t('play.lost', locale)}</h2>
            <p className="end-line">{t('play.lostLine', locale)}</p>
            <div className="end-actions">
              <Button type="button" size="lg" onClick={begin}>
                <RotateCcw aria-hidden="true" />
                {t('play.again', locale)}
              </Button>
              <Link href="/" className={buttonVariants({ variant: 'outline', size: 'lg' })}>
                <House aria-hidden="true" />
                {t('play.allGames', locale)}
              </Link>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}
