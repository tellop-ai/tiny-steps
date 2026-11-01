/**
 * The letters the letter games use, per app language.
 * Pure and fixed: game content, like a course's lessons, so it lives
 * here rather than in the locale files (which hold the interface's words).
 *
 * - `ALPHABETS`: English A to Z (26); Turkish has 29 letters, with Ç Ğ I İ Ö Ş Ü
 *   and without Q W X.
 * - `NAMES`: how the voice should say each letter's name. A bare capital is often
 *   read as a word ("A" as "uh"), so the voice gets the name.
 * - `EXAMPLES`: one word a small child knows, with an emoji (Unicode 13 or
 *   earlier). `inside: true` marks a word that holds the letter without starting
 *   with it: no Turkish word starts with Ğ, and X is best heard in "fox".
 * - Case changes use the language's own rules (`tr`: I/ı, İ/i).
 */

export const ALPHABETS = Object.freeze({
  en: Object.freeze([...'ABCDEFGHIJKLMNOPQRSTUVWXYZ']),
  tr: Object.freeze(['A', 'B', 'C', 'Ç', 'D', 'E', 'F', 'G', 'Ğ', 'H', 'I', 'İ', 'J', 'K', 'L', 'M', 'N', 'O', 'Ö', 'P', 'R', 'S', 'Ş', 'T', 'U', 'Ü', 'V', 'Y', 'Z']),
});

export const NAMES = Object.freeze({
  en: Object.freeze({
    A: 'ay', B: 'bee', C: 'see', D: 'dee', E: 'ee', F: 'eff', G: 'gee', H: 'aitch', I: 'eye', J: 'jay', K: 'kay', L: 'ell', M: 'em',
    N: 'en', O: 'oh', P: 'pee', Q: 'cue', R: 'ar', S: 'ess', T: 'tee', U: 'you', V: 'vee', W: 'double you', X: 'ex', Y: 'why', Z: 'zed',
  }),
  tr: Object.freeze({
    A: 'a', B: 'be', C: 'ce', Ç: 'çe', D: 'de', E: 'e', F: 'fe', G: 'ge', Ğ: 'yumuşak ge', H: 'he', I: 'ı', İ: 'i', J: 'je', K: 'ke',
    L: 'le', M: 'me', N: 'ne', O: 'o', Ö: 'ö', P: 'pe', R: 're', S: 'se', Ş: 'şe', T: 'te', U: 'u', Ü: 'ü', V: 've', Y: 'ye', Z: 'ze',
  }),
});

/** @typedef {{ word: string, emoji: string, inside?: true }} Example */

export const EXAMPLES = Object.freeze({
  en: Object.freeze({
    A: { word: 'apple', emoji: '🍎' }, B: { word: 'ball', emoji: '⚽' }, C: { word: 'cat', emoji: '🐱' }, D: { word: 'dog', emoji: '🐶' },
    E: { word: 'egg', emoji: '🥚' }, F: { word: 'fish', emoji: '🐟' }, G: { word: 'grapes', emoji: '🍇' }, H: { word: 'hat', emoji: '🎩' },
    I: { word: 'ice cream', emoji: '🍦' }, J: { word: 'juice', emoji: '🧃' }, K: { word: 'kite', emoji: '🪁' }, L: { word: 'lion', emoji: '🦁' },
    M: { word: 'moon', emoji: '🌙' }, N: { word: 'nose', emoji: '👃' }, O: { word: 'orange', emoji: '🍊' }, P: { word: 'pig', emoji: '🐷' },
    Q: { word: 'queen', emoji: '👸' }, R: { word: 'rabbit', emoji: '🐰' }, S: { word: 'sun', emoji: '☀️' }, T: { word: 'tiger', emoji: '🐯' },
    U: { word: 'umbrella', emoji: '☂️' }, V: { word: 'van', emoji: '🚐' }, W: { word: 'whale', emoji: '🐳' }, X: { word: 'fox', emoji: '🦊', inside: true },
    Y: { word: 'yo-yo', emoji: '🪀' }, Z: { word: 'zebra', emoji: '🦓' },
  }),
  tr: Object.freeze({
    A: { word: 'arı', emoji: '🐝' }, B: { word: 'balık', emoji: '🐟' }, C: { word: 'ceket', emoji: '🧥' }, Ç: { word: 'çilek', emoji: '🍓' },
    D: { word: 'dondurma', emoji: '🍦' }, E: { word: 'elma', emoji: '🍎' }, F: { word: 'fil', emoji: '🐘' }, G: { word: 'gözlük', emoji: '👓' },
    Ğ: { word: 'dağ', emoji: '⛰️', inside: true }, H: { word: 'horoz', emoji: '🐓' }, I: { word: 'ışık', emoji: '💡' }, İ: { word: 'inek', emoji: '🐄' },
    J: { word: 'jöle', emoji: '🍮' }, K: { word: 'kedi', emoji: '🐱' }, L: { word: 'limon', emoji: '🍋' }, M: { word: 'muz', emoji: '🍌' },
    N: { word: 'nota', emoji: '🎵' }, O: { word: 'otobüs', emoji: '🚌' }, Ö: { word: 'ördek', emoji: '🦆' }, P: { word: 'pasta', emoji: '🎂' },
    R: { word: 'roket', emoji: '🚀' }, S: { word: 'saat', emoji: '⏰' }, Ş: { word: 'şemsiye', emoji: '☂️' }, T: { word: 'tavşan', emoji: '🐰' },
    U: { word: 'uçak', emoji: '✈️' }, Ü: { word: 'üzüm', emoji: '🍇' }, V: { word: 'vapur', emoji: '⛴️' }, Y: { word: 'yıldız', emoji: '⭐' },
    Z: { word: 'zürafa', emoji: '🦒' },
  }),
});

/** The language's own case rules. @param {string} locale */
const tag = (locale) => (locale === 'tr' ? 'tr-TR' : 'en-US');

/** The alphabet of an app language; English for any other value. @param {string} locale */
export function alphabetFor(locale) {
  return ALPHABETS[locale] ?? ALPHABETS.en;
}

/** A letter as a small letter, by the language's rules. @param {string} letter @param {string} locale */
export function small(letter, locale) {
  return letter.toLocaleLowerCase(tag(locale));
}

/** A letter as a capital, by the language's rules. @param {string} letter @param {string} locale */
export function capital(letter, locale) {
  return letter.toLocaleUpperCase(tag(locale));
}

/** What the voice says for a letter (capital or small). @param {string} letter @param {string} locale */
export function nameOf(letter, locale) {
  const names = NAMES[locale] ?? NAMES.en;
  return names[capital(letter, locale)] ?? letter;
}

/** The example word for a letter (capital or small), or null. @param {string} letter @param {string} locale */
export function exampleOf(letter, locale) {
  const examples = EXAMPLES[locale] ?? EXAMPLES.en;
  return examples[capital(letter, locale)] ?? null;
}
