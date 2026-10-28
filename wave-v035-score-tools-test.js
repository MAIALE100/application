'use strict';
const assert = require('node:assert/strict');
const { validBars, validIndex, durationSeconds, durationLabel } = require('./wave-v035-score-tools.js');

// Limits and malicious or malformed project metadata should never leave the
// 1-128 range.  The module is importable without a DOM/CEF instance.
assert.equal(validBars(0), 1);
assert.equal(validBars(-25), 1);
assert.equal(validBars(500), 128);
assert.equal(validBars('125'), 125);
assert.equal(validBars('invalid'), 1);
assert.equal(validIndex(-10,125),0);
assert.equal(validIndex(124,125),124);
assert.equal(validIndex(999,125),124);
assert.equal(validIndex(NaN,125),0);

// Four beats per bar, 16 steps/bar.  The values agree with existing presets.
assert.equal(durationSeconds(15,120),30);
assert.equal(durationLabel(15,120),'0:30');
assert.equal(durationSeconds(125,100),300);
assert.equal(durationLabel(125,100),'5:00');
assert.equal(durationSeconds(30,120),60);
assert.equal(durationLabel(30,120),'1:00');
assert.equal(durationSeconds(1,0),2);
assert.equal(durationSeconds(1,999),2);

console.log('WAVE long-score tools: PASS');
