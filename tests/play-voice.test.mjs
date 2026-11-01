/**
 * The speaker: a development run mounts the game frame, cleans it up once and
 * mounts it again on the same speaker, so a stop must not silence it for good.
 */

import assert from 'node:assert/strict';
import { afterEach, beforeEach, mock, test } from 'node:test';

import { QUIET_MS, createSpeaker } from '../lib/play/voice.js';

/** A stand-in for the browser's speech: it records each line it is handed. */
function fakeSpeech() {
  const said = [];
  const synth = {
    speaking: false,
    pending: false,
    speak(utterance) {
      said.push(utterance.text);
    },
    cancel() {},
    resume() {},
    getVoices() {
      return [];
    },
  };
  class Utterance {
    constructor(text) {
      this.text = text;
    }
  }
  return { said, synth, Utterance };
}

let speech;
beforeEach(() => {
  mock.timers.enable({ apis: ['setTimeout'] });
  speech = fakeSpeech();
  globalThis.speechSynthesis = speech.synth;
  globalThis.SpeechSynthesisUtterance = speech.Utterance;
});
afterEach(() => {
  mock.timers.reset();
  delete globalThis.speechSynthesis;
  delete globalThis.SpeechSynthesisUtterance;
});

test('a line is said after the quiet gap, not before', () => {
  const speaker = createSpeaker({ enabled: () => true });
  speaker.say('Find 3!', 'en');
  mock.timers.tick(QUIET_MS - 1);
  assert.deepEqual(speech.said, []);
  mock.timers.tick(1);
  assert.deepEqual(speech.said, ['Find 3!']);
});

test('after stop, nothing is said until wake', () => {
  const speaker = createSpeaker({ enabled: () => true });
  speaker.stop();
  speaker.say('Find 3!', 'en');
  mock.timers.tick(QUIET_MS * 2);
  assert.deepEqual(speech.said, []);
});

test('mount, cleanup, mount again: the speaker still speaks', () => {
  const speaker = createSpeaker({ enabled: () => true });
  speaker.wake();
  speaker.stop();
  speaker.wake();
  speaker.say('Find 3!', 'en');
  mock.timers.tick(QUIET_MS);
  assert.deepEqual(speech.said, ['Find 3!']);
});

test('a stop drops a line that was still waiting', () => {
  const speaker = createSpeaker({ enabled: () => true });
  speaker.say('Find 3!', 'en');
  speaker.stop();
  speaker.wake();
  mock.timers.tick(QUIET_MS * 2);
  assert.deepEqual(speech.said, []);
});

test('with speaking off, nothing is said', () => {
  const speaker = createSpeaker({ enabled: () => false });
  speaker.say('Find 3!', 'en');
  mock.timers.tick(QUIET_MS);
  assert.deepEqual(speech.said, []);
});
