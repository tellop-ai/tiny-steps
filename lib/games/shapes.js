/**
 * The ten shapes Shape box and Shape belt play with, as SVG outlines in a box
 * from 0 to 100 on both sides. Drawn for this app: round shapes as two arcs,
 * the boxes with soft corners, the even shapes as points around a centre. Pure.
 *
 * Every shape's word is `shape.<id>` in the locale files.
 */

/** One decimal place is plenty for a 100-unit box. */
function tidy(value) {
  return Math.round(value * 10) / 10;
}

/**
 * A closed outline through the points, in order.
 *
 * @param {Array<[number, number]>} points
 */
function outline(points) {
  return `M${points.map(([x, y]) => `${tidy(x)} ${tidy(y)}`).join(' L')} Z`;
}

/**
 * `count` points around a centre, the first at `start` degrees (0 points right,
 * -90 points up). Radii take turns, so two radii make a star.
 *
 * @param {number} count
 * @param {number} cx
 * @param {number} cy
 * @param {number[]} radii
 * @param {number} start
 * @returns {Array<[number, number]>}
 */
function around(count, cx, cy, radii, start) {
  return Array.from({ length: count }, (_, at) => {
    const angle = ((start + (at * 360) / count) * Math.PI) / 180;
    const radius = radii[at % radii.length];
    return [cx + radius * Math.cos(angle), cy + radius * Math.sin(angle)];
  });
}

/** A round shape centred in the box, as two half arcs. */
function ellipse(rx, ry) {
  const left = tidy(50 - rx);
  const right = tidy(50 + rx);
  return `M${left} 50 A${rx} ${ry} 0 1 1 ${right} 50 A${rx} ${ry} 0 1 1 ${left} 50 Z`;
}

/** A box with soft corners of radius `r`. */
function box(x, y, width, height, r) {
  const right = x + width;
  const bottom = y + height;
  return [
    `M${x + r} ${y}`,
    `H${right - r}`,
    `A${r} ${r} 0 0 1 ${right} ${y + r}`,
    `V${bottom - r}`,
    `A${r} ${r} 0 0 1 ${right - r} ${bottom}`,
    `H${x + r}`,
    `A${r} ${r} 0 0 1 ${x} ${bottom - r}`,
    `V${y + r}`,
    `A${r} ${r} 0 0 1 ${x + r} ${y}`,
    'Z',
  ].join(' ');
}

/** The shapes, in the order a grown-up would teach them. */
export const SHAPE_IDS = Object.freeze([
  'circle',
  'square',
  'triangle',
  'rectangle',
  'star',
  'heart',
  'oval',
  'diamond',
  'pentagon',
  'hexagon',
]);

/** Each shape's outline as SVG path data in a 0 to 100 box. */
export const SHAPES = Object.freeze({
  circle: ellipse(47, 47),
  square: box(7, 7, 86, 86, 8),
  triangle: outline([
    [50, 4],
    [97, 91],
    [3, 91],
  ]),
  rectangle: box(1, 24, 98, 52, 8),
  star: outline(around(10, 50, 54, [47, 19], -90)),
  heart:
    'M50 93 C20 72 3 55 3 33 C3 17 15 6 29 6 C39 6 46 12 50 22 C54 12 61 6 71 6 C85 6 97 17 97 33 C97 55 80 72 50 93 Z',
  oval: ellipse(48, 30),
  diamond: outline([
    [50, 1],
    [87, 50],
    [50, 99],
    [13, 50],
  ]),
  pentagon: outline(around(5, 50, 54, [47], -90)),
  hexagon: outline(around(6, 50, 50, [48], 0)),
});

/**
 * A shape's outline, or `null` for a name that is not a shape.
 *
 * @param {string} id
 * @returns {string | null}
 */
export function shapePath(id) {
  return Object.hasOwn(SHAPES, id) ? SHAPES[id] : null;
}
