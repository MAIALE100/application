'use strict';
const assert = require('node:assert/strict');

// Browser-free regression for the optional harmonic voice layer.
const previousDocument = global.document;
const previousVoice = global.scheduleVoice;
let originalCalls = 0;
const originalResult = {};
try {
  global.document = {
    readyState: 'complete',
    getElementById() { return null; },
    querySelector() { return null; }
  };
  global.scheduleVoice = function () {
    originalCalls++;
    return originalResult;
  };
  require('./wave-v033-studio-extras.js');
  const enhanced = global.scheduleVoice;
  assert.equal(enhanced.__waveEnhanced, true);

  let oscillators = 0;
  const amplitudes = [];
  const ctx = {
    destination: {},
    createOscillator() {
      oscillators++;
      return {
        frequency: { value: 0 },
        connect() {},
        start() {},
        stop() {}
      };
    },
    createGain() {
      return {
        connect() {},
        gain: {
          setValueAtTime() {},
          linearRampToValueAtTime(value) { amplitudes.push(value); },
          exponentialRampToValueAtTime() {}
        }
      };
    }
  };

  // Zero and negative velocity must remain silent, even for an instrument
  // with a harmonic profile. The original voice must still be invoked.
  for (const velocity of [0, -1, '0']) {
    assert.equal(enhanced(ctx, 'piano', 69, 1, 1, velocity), originalResult);
  }
  assert.equal(oscillators, 0);
  assert.deepEqual(amplitudes, []);

  assert.equal(enhanced(ctx, 'piano', 69, 1, 1, 0.5), originalResult);
  assert.equal(oscillators, 1);
  assert.equal(amplitudes[0], 0.5 * 0.055);

  // Missing or malformed velocity retains the existing default of 0.7.
  enhanced(ctx, 'piano', 69, 1, 1, undefined);
  enhanced(ctx, 'piano', 69, 1, 1, NaN);
  assert.equal(oscillators, 3);
  assert.equal(amplitudes[1], 0.7 * 0.055);
  assert.equal(amplitudes[2], 0.7 * 0.055);

  // Positive values above 1 are clamped; unsupported instruments and
  // out-of-range notes must not allocate additional audio nodes.
  enhanced(ctx, 'piano', 69, 1, 1, 2);
  assert.equal(amplitudes[3], 0.055);
  enhanced(ctx, 'unknown', 69, 1, 1, 1);
  enhanced(ctx, 'piano', 10, 1, 1, 1);
  enhanced(ctx, 'piano', 69, 1, 0, 1);
  assert.equal(oscillators, 4);
  assert.equal(originalCalls, 10);
} finally {
  if (previousDocument === undefined) delete global.document;
  else global.document = previousDocument;
  if (previousVoice === undefined) delete global.scheduleVoice;
  else global.scheduleVoice = previousVoice;
}
console.log('WAVE harmonic voice velocity regression: PASS');
