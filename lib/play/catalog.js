/**
 * The fifteen games, their four groups and the order they come in.
 *
 * Pure and fixed: nothing here is stored or read from a request. A game's words
 * live under `games.<id>.` in `lib/i18n/locales/`, a group's under
 * `category.<id>`. A group's `icon` names a `lucide-react` icon; a game's picture is
 * `public/art/games/<id>.webp` (`app/art.jsx`). `mark` names
 * the token (`app/tokens.css`) a group is tinted with; `gain` is how far one right
 * answer moves the meter (`./meter.js`).
 */

/** The four groups, in the order the home page shows them. */
export const CATEGORIES = Object.freeze([
  Object.freeze({ id: 'colours', icon: 'Palette', mark: 'chart-1' }),
  Object.freeze({ id: 'numbers', icon: 'Hash', mark: 'chart-4' }),
  Object.freeze({ id: 'shapes', icon: 'Shapes', mark: 'chart-3' }),
  Object.freeze({ id: 'letters', icon: 'ALargeSmall', mark: 'chart-5' }),
]);

/** The fifteen games, in the order home lists them and Previous/Next steps through them. */
export const GAMES = Object.freeze([
  Object.freeze({ id: 'colour-muncher', category: 'colours', gain: 10 }),
  Object.freeze({ id: 'rainbow-maker', category: 'colours', gain: 10 }),
  Object.freeze({ id: 'animal-count', category: 'numbers', gain: 10 }),
  Object.freeze({ id: 'number-hunt', category: 'numbers', gain: 10 }),
  Object.freeze({ id: 'number-pond', category: 'numbers', gain: 10 }),
  Object.freeze({ id: 'hungry-hedgehog', category: 'numbers', gain: 10 }),
  Object.freeze({ id: 'dot-to-dot', category: 'numbers', gain: 5 }),
  Object.freeze({ id: 'number-tracing', category: 'numbers', gain: 20 }),
  Object.freeze({ id: 'little-builder', category: 'shapes', gain: 5 }),
  Object.freeze({ id: 'shape-belt', category: 'shapes', gain: 10 }),
  Object.freeze({ id: 'shape-box', category: 'shapes', gain: 10 }),
  Object.freeze({ id: 'toy-room', category: 'shapes', gain: 10 }),
  Object.freeze({ id: 'letter-tracing', category: 'letters', gain: 20 }),
  Object.freeze({ id: 'letter-muncher', category: 'letters', gain: 10 }),
  Object.freeze({ id: 'letter-flowers', category: 'letters', gain: 10 }),
]);

/** Every game id, in order. */
export const GAME_IDS = Object.freeze(GAMES.map((game) => game.id));

/** A game's three levels, easiest first. */
export const LEVELS = Object.freeze(['easy', 'normal', 'hard']);

/** The level a game starts at until a grown-up picks another. */
export const DEFAULT_LEVEL = 'normal';

/**
 * The game with this id, or `null` for any other value.
 *
 * @param {unknown} id
 */
export function gameById(id) {
  return typeof id === 'string' ? (GAMES.find((game) => game.id === id) ?? null) : null;
}

/**
 * The games before and after this one, wrapping round at both ends.
 *
 * @param {string} id
 * @returns {{ previous: string, next: string } | null}
 */
export function neighbours(id) {
  const at = GAME_IDS.indexOf(id);
  if (at === -1) return null;
  return {
    previous: GAME_IDS[(at - 1 + GAME_IDS.length) % GAME_IDS.length],
    next: GAME_IDS[(at + 1) % GAME_IDS.length],
  };
}

/**
 * The games of one group, in order.
 *
 * @param {string} category
 */
export function gamesIn(category) {
  return GAMES.filter((game) => game.category === category);
}
