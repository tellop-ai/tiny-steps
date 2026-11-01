/**
 * Short sound effects made in code: no sound files, nothing fetched.
 *
 * Browser only. One audio context per page, made on the first press (browsers
 * allow sound only after one). `enabled()` is read on every sound, so turning
 * Sound effects off silences the next one at once.
 */

/** The notes of each sound: [frequency in Hz, start in seconds, length in seconds]. */
const SOUNDS = Object.freeze({
  tap: [[660, 0, 0.06]],
  pop: [[880, 0, 0.05], [1320, 0.04, 0.06]],
  right: [[660, 0, 0.09], [990, 0.08, 0.14]],
  miss: [[220, 0, 0.18]],
  win: [[523, 0, 0.12], [659, 0.1, 0.12], [784, 0.2, 0.12], [1047, 0.3, 0.3]],
});

/** The sound names a game may play. */
export const SOUND_NAMES = Object.freeze(Object.keys(SOUNDS));

/** @param {{ enabled: () => boolean }} options */
export function createSounds({ enabled }) {
  /** @type {any} */
  let context = null;

  function audio() {
    if (context) return context;
    const Context = /** @type {any} */ (globalThis).AudioContext ?? /** @type {any} */ (globalThis).webkitAudioContext;
    if (typeof Context !== 'function') return null;
    try {
      context = new Context();
    } catch {
      context = null;
    }
    return context;
  }

  return {
    /** Make (or wake) the audio context; call it from a press. */
    wake() {
      const ctx = audio();
      if (ctx && ctx.state === 'suspended' && typeof ctx.resume === 'function') ctx.resume().catch(() => undefined);
    },
    /** @param {string} name */
    play(name) {
      if (!enabled() || !Object.hasOwn(SOUNDS, name)) return;
      const ctx = audio();
      if (!ctx) return;
      try {
        const now = ctx.currentTime;
        for (const [frequency, at, length] of SOUNDS[name]) {
          const oscillator = ctx.createOscillator();
          const gain = ctx.createGain();
          oscillator.type = name === 'miss' ? 'triangle' : 'sine';
          oscillator.frequency.setValueAtTime(frequency, now + at);
          gain.gain.setValueAtTime(0.0001, now + at);
          gain.gain.exponentialRampToValueAtTime(0.18, now + at + 0.01);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + at + length);
          oscillator.connect(gain);
          gain.connect(ctx.destination);
          oscillator.start(now + at);
          oscillator.stop(now + at + length + 0.02);
        }
      } catch {
        // A sound failed this once; the game goes on.
      }
    },
    /** Close the context when the page leaves. */
    close() {
      try {
        context?.close?.();
      } catch {
        // Already closed.
      }
      context = null;
    },
  };
}
