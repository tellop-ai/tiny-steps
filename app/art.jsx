/**
 * The app's own finished pictures, shipped in `public/art/`: one icon for each
 * game (`games/<id>.webp`, 256 x 256) and a few decorations (`decor/<name>.webp`,
 * 384 x 384 with a see-through background). They are made outside the app (the
 * repository's `art/` folder says how) and are not picture places for Tellop to
 * draw (`AGENTS.md` 6b): they ship finished, and the decorations need a
 * see-through background.
 *
 * Every one only decorates: the words beside it say the same thing, so each has
 * an empty `alt` and screen readers pass over it.
 */

/** The decorations the app ships. */
export const DECOR = Object.freeze(['chick', 'cloud', 'sun', 'trophy', 'teddy', 'stars', 'basket-teddy']);

/** @param {string[]} names */
const classes = (...names) => names.filter(Boolean).join(' ');

/** A game's icon. @param {{ gameId: string, className?: string }} props */
export function GameArt({ gameId, className }) {
  return (
    <img
      src={`/art/games/${gameId}.webp`}
      alt=""
      width={256}
      height={256}
      draggable={false}
      decoding="async"
      className={classes('game-art', className)}
    />
  );
}

/** One decoration. @param {{ name: string, className?: string }} props */
export function Decor({ name, className }) {
  return (
    <img
      src={`/art/decor/${name}.webp`}
      alt=""
      width={384}
      height={384}
      draggable={false}
      decoding="async"
      className={classes('decor', className)}
    />
  );
}
