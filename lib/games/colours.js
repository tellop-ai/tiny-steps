/**
 * The colours the colour games name, each shown by emoji whose colour is fixed
 * on every system (the colour rule): a swatch for the colour itself and
 * things that are plainly that colour. Words for each colour are
 * `colour.<id>` in `lib/i18n/locales/`. Pure and fixed.
 *
 * Every emoji here is from Unicode 13 or earlier, so it draws on every Mac
 * Tellop supports. An item belongs to one colour only.
 */

export const COLOURS = Object.freeze({
  red: Object.freeze({ swatch: '🔴', square: '🟥', items: Object.freeze(['🍎', '🍓', '🍒', '🍅', '🌹', '🚒', '🌶️']) }),
  orange: Object.freeze({ swatch: '🟠', square: '🟧', items: Object.freeze(['🍊', '🥕', '🎃', '🏀', '🦊']) }),
  yellow: Object.freeze({ swatch: '🟡', square: '🟨', items: Object.freeze(['🍌', '🍋', '🌻', '🐥', '🌽', '🧀']) }),
  green: Object.freeze({ swatch: '🟢', square: '🟩', items: Object.freeze(['🥦', '🐸', '🍏', '🥒', '🐢', '🌲', '🥝']) }),
  blue: Object.freeze({ swatch: '🔵', square: '🟦', items: Object.freeze(['🐳', '🫐', '🦋', '💎', '🧢', '🐋']) }),
  purple: Object.freeze({ swatch: '🟣', square: '🟪', items: Object.freeze(['🍇', '🍆', '🔮', '👾', '💜']) }),
  pink: Object.freeze({ swatch: '🌸', square: '🌸', items: Object.freeze(['🐷', '🎀', '🦩', '💗', '🌷']) }),
  brown: Object.freeze({ swatch: '🟤', square: '🟫', items: Object.freeze(['🐻', '🥔', '🌰', '🍪', '🐿️']) }),
  black: Object.freeze({ swatch: '⚫', square: '⬛', items: Object.freeze(['🎱', '🕷️', '🎩', '🖤', '🦇']) }),
  white: Object.freeze({ swatch: '⚪', square: '⬜', items: Object.freeze(['☁️', '⛄', '🥚', '🐑', '🦢', '🥛']) }),
});

/** Every colour id. */
export const COLOUR_IDS = Object.freeze(Object.keys(COLOURS));
