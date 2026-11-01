'use client';

/**
 * The home screen: a friendly heading, All / Favourites, and the four
 * groups of games as big cards. Every word follows the chosen language at once.
 */

import { ALargeSmall, Hash, Palette, Shapes, Star } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { StatusRow } from '@/components/ui/toggle-group';

import { t } from '../lib/i18n/index.js';
import { CATEGORIES, gamesIn } from '../lib/play/catalog.js';

import { Decor, GameArt } from './art.jsx';
import { GrownUps, SaveProblem, usePlay } from './play-settings.jsx';

/** The group icons the catalog names, by name. */
export const ICONS = Object.freeze({ ALargeSmall, Hash, Palette, Shapes });

/** @param {{ problem: string | null }} props */
export function HomeScreen({ problem }) {
  const { locale, choices, changeChoice } = usePlay();
  const [show, setShow] = useState('all');
  const favourites = show === 'favourites';
  const anyFavourite = Object.values(choices).some((choice) => choice?.favourite);

  return (
    <div className="home">
      <header className="home-head">
        <div className="home-sky" aria-hidden="true">
          <Decor name="sun" className="home-sun" />
          <Decor name="cloud" className="home-cloud" />
        </div>
        <div className="home-hello">
          <Decor name="chick" className="home-chick" />
          <div className="home-title">
            <h1>{t('home.title', locale)}</h1>
            <p className="home-tagline">{t('home.tagline', locale)}</p>
          </div>
        </div>
        <GrownUps />
      </header>

      {problem !== null ? (
        <p className="save-problem" role="alert">
          {t(problem, locale)} {t('home.playsAnyway', locale)}
        </p>
      ) : null}
      <SaveProblem />

      <div className="home-filter">
        <StatusRow
          label={t('home.filterLabel', locale)}
          value={show}
          onValueChange={setShow}
          options={[
            { value: 'all', label: t('home.filter.all', locale) },
            { value: 'favourites', label: t('home.filter.favourites', locale) },
          ]}
        />
      </div>

      {favourites && !anyFavourite ? (
        <div className="home-empty">
          <Decor name="stars" className="home-empty-art" />
          <p>{t('home.noFavourites', locale)}</p>
        </div>
      ) : null}

      {CATEGORIES.map((category) => {
        const games = gamesIn(category.id).filter((game) => !favourites || choices[game.id]?.favourite);
        if (games.length === 0) return null;
        const CategoryIcon = ICONS[category.icon];
        return (
          <section key={category.id} className="home-group" data-mark={category.mark} aria-labelledby={`group-${category.id}`}>
            <h2 id={`group-${category.id}`} className="home-group-title">
              <span className="home-group-icon" aria-hidden="true">
                <CategoryIcon />
              </span>
              {t(`category.${category.id}`, locale)}
            </h2>
            <ul className="home-cards">
              {games.map((game) => {
                const name = t(`games.${game.id}.name`, locale);
                const favourite = choices[game.id]?.favourite === true;
                return (
                  <li key={game.id} className="game-card" data-mark={category.mark} data-game={game.id}>
                    <Link href={`/play/${game.id}`} className="game-card-link" aria-label={t('home.openGame', locale, { name })} />
                    <GameArt gameId={game.id} className="game-disc" />
                    <span className="game-card-words">
                      <span className="game-card-name">{name}</span>
                      <span className="game-card-blurb">{t(`games.${game.id}.blurb`, locale)}</span>
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-lg"
                      className="game-star"
                      data-on={favourite || undefined}
                      aria-pressed={favourite}
                      aria-label={t(favourite ? 'home.favourite.remove' : 'home.favourite.add', locale, { name })}
                      title={t(favourite ? 'home.favourite.remove' : 'home.favourite.add', locale, { name })}
                      onClick={() => changeChoice(game.id, { favourite: !favourite })}
                    >
                      <Star aria-hidden="true" />
                    </Button>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
