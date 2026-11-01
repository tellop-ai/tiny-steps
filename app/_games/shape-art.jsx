'use client';

/**
 * One shape from `lib/games/shapes.js`, drawn as SVG, shared by Shape box and
 * Shape belt. It writes no colour: each game colours the parts through its own
 * classes, which start with the `prefix` it passes (`sb`, `belt`):
 *
 * - `piece`: the shape filled — `<prefix>-art-fill` (a game fills it with `var(--mark)`).
 * - `hole`: the shape sunk into a surface — `<prefix>-art-rim` (the shape and its
 *   edge) and `<prefix>-art-floor` (the bottom, set a little lower and clipped to
 *   the shape, so the rim shows as a shadow along the top inside edge).
 * - `mouth`: the shape as an opening — `<prefix>-art-lip`.
 *
 * Every variant uses the same view box, so a piece fits its hole exactly. The
 * root is an `<svg>`, so it can sit inside another SVG with `x`, `y`, `width`
 * and `height` (a monster's mouth).
 */

import { useId } from 'react';

import { shapePath } from '../../lib/games/shapes.js';

/** Room around the 0 to 100 box for the edge strokes. */
const VIEW_BOX = '-6 -6 112 112';

/**
 * @param {{ kind: string, variant?: 'piece' | 'hole' | 'mouth', prefix: string, className?: string, [key: string]: any }} props
 */
export function ShapeArt({ kind, variant = 'piece', prefix, className, ...rest }) {
  const clip = `${prefix}-clip-${useId().replace(/[^A-Za-z0-9_-]/gu, '')}`;
  const d = shapePath(kind);
  if (d === null) return null;
  return (
    <svg
      viewBox={VIEW_BOX}
      className={className ? `${prefix}-art ${className}` : `${prefix}-art`}
      data-variant={variant}
      data-kind={kind}
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {variant === 'hole' ? (
        <>
          <defs>
            <clipPath id={clip}>
              <path d={d} />
            </clipPath>
          </defs>
          <path className={`${prefix}-art-rim`} d={d} />
          <g clipPath={`url(#${clip})`}>
            <path className={`${prefix}-art-floor`} d={d} transform="translate(0 7)" />
          </g>
        </>
      ) : (
        <path className={`${prefix}-art-${variant === 'mouth' ? 'lip' : 'fill'}`} d={d} />
      )}
    </svg>
  );
}

export default ShapeArt;
