/**
 * Speaking a short line aloud with the computer's own voice.
 *
 * Browser only: call it from a press or an effect in a client component. It uses
 * the browser's `speechSynthesis` (on a Mac, the Mac's own voices), never AI, so
 * nothing leaves the computer.
 *
 * **Never cancel-and-speak on every press.** Calling `cancel()` and then
 * `speak()` on each fast press can leave the browser's speech service stuck
 * "speaking", and then every app stays mute until Tellop restarts. So a
 * request only replaces the waiting line; the
 * line starts after a short quiet gap (`QUIET_MS`), `cancel()` runs only while
 * something is actually speaking or waiting, and at most one line is ever handed
 * to the browser at a time.
 */

/** The quiet gap before the latest line is spoken, in milliseconds. */
export const QUIET_MS = 90;

/** The voice tag for each app language. */
export const VOICE_TAGS = Object.freeze({ en: 'en-US', tr: 'tr-TR' });

/**
 * A speaker for one page. `enabled()` is read at the moment a line would start,
 * so turning Speaking off stops the next line at once.
 *
 * @param {{ enabled: () => boolean }} options
 */
export function createSpeaker({ enabled }) {
  /** @type {{ text: string, tag: string } | null} */
  let latest = null;
  /** @type {ReturnType<typeof setTimeout> | null} */
  let timer = null;
  /** @type {any[] | null} */
  let voices = null;
  const live = new Set();
  let stopped = false;

  function speech() {
    const synth = /** @type {any} */ (globalThis).speechSynthesis;
    return synth && typeof synth.speak === 'function' ? synth : null;
  }

  function refreshVoices() {
    try {
      const synth = speech();
      voices = synth && typeof synth.getVoices === 'function' ? Array.from(synth.getVoices() ?? []) : [];
    } catch {
      voices = [];
    }
  }

  /** The exact tag first, then the same language in another region. @param {string} tag */
  function bestVoice(tag) {
    if (voices === null || voices.length === 0) refreshVoices();
    const want = tag.toLowerCase();
    const language = want.split('-')[0];
    let near = null;
    for (const voice of voices ?? []) {
      const lang = String(voice?.lang ?? '').toLowerCase().replace('_', '-');
      if (lang === want) return voice;
      if (near === null && lang.split('-')[0] === language) near = voice;
    }
    return near;
  }

  function start() {
    timer = null;
    const line = latest;
    latest = null;
    const synth = speech();
    const Utterance = /** @type {any} */ (globalThis).SpeechSynthesisUtterance;
    if (!line || stopped || !synth || typeof Utterance !== 'function' || !enabled()) return;
    try {
      if (synth.speaking || synth.pending) synth.cancel();
      if (typeof synth.resume === 'function') synth.resume();
      const utterance = new Utterance(line.text);
      utterance.lang = line.tag;
      utterance.rate = 0.9;
      utterance.pitch = 1.2;
      utterance.volume = 1;
      const voice = bestVoice(line.tag);
      if (voice) utterance.voice = voice;
      live.add(utterance);
      const done = () => live.delete(utterance);
      utterance.onend = done;
      utterance.onerror = done;
      synth.speak(utterance);
    } catch {
      // Speech failed this once; the words are on the screen.
    }
  }

  return {
    /**
     * Say a line in the app's language (`'en'` or `'tr'`). A newer line replaces one still waiting.
     *
     * @param {string} text
     * @param {string} locale
     */
    say(text, locale) {
      if (stopped || typeof text !== 'string' || text.trim() === '') return;
      latest = { text: text.slice(0, 300), tag: VOICE_TAGS[locale] ?? VOICE_TAGS.en };
      if (timer === null) timer = setTimeout(start, QUIET_MS);
    },
    /** Wake the voice list on a press (some browsers fill it late). */
    prime() {
      refreshVoices();
    },
    /** Stop what is waiting and what is speaking; used when a run ends or the page leaves. */
    hush() {
      if (timer !== null) clearTimeout(timer);
      timer = null;
      latest = null;
      try {
        const synth = speech();
        if (synth && (synth.speaking || synth.pending)) synth.cancel();
      } catch {
        // Nothing was being said.
      }
    },
    /**
     * Ready to speak again. The frame calls it each time it mounts: a development
     * run mounts it, cleans up once and mounts it again on the same speaker.
     */
    wake() {
      stopped = false;
    },
    /** Hush and say nothing more until `wake()`; used when the frame leaves. */
    stop() {
      this.hush();
      stopped = true;
    },
  };
}
