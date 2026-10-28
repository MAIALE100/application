'use strict';
const assert = require('node:assert/strict');
const { validBars, validIndex, jumpTarget, durationSeconds, durationLabel } = require('./wave-v035-score-tools.js');

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
assert.equal(jumpTarget(0,125,-4),0);
assert.equal(jumpTarget(0,125,4),4);
assert.equal(jumpTarget(0,125,8),8);
assert.equal(jumpTarget(123,125,4),124);
assert.equal(jumpTarget(124,125,-8),116);
assert.equal(jumpTarget(10,125,NaN),10);
assert.equal(jumpTarget(127,999,4),127);

// Four beats per bar, 16 steps/bar.  The values agree with existing presets.
assert.equal(durationSeconds(15,120),30);
assert.equal(durationLabel(15,120),'0:30');
assert.equal(durationSeconds(125,100),300);
assert.equal(durationLabel(125,100),'5:00');
assert.equal(durationSeconds(30,120),60);
assert.equal(durationLabel(30,120),'1:00');
assert.equal(durationSeconds(1,0),2);
assert.equal(durationSeconds(1,999),2);
// Match the server's math.ceil duration rounding for fractional seconds.
assert.equal(durationSeconds(1,170),2);
assert.equal(durationSeconds(15,119),31);

console.log('WAVE long-score tools: PASS');
