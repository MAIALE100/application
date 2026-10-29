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


const { rangeBounds, copyRange, pasteRange, clearRange, rangeSummary, rangePreview } = require('./wave-v035-score-tools.js');
const source = [
  { step: 0, pitch: 60, length: 2, velocity: 0.8 },
  { step: 63, pitch: 64, length: 1, velocity: 0.7 },
  { step: 64, pitch: 67, length: 1, velocity: 0.6 },
  { step: 127, pitch: 72, length: 1, velocity: 0.5 },
  { step: 128, pitch: 74, length: 1, velocity: 0.4 }
];
assert.deepEqual(rangeBounds(0,4,8),{start:0,end:64});
assert.equal(rangeBounds(5,4,8),null);
assert.equal(rangeBounds(0,3,8),null);
assert.equal(rangeBounds(-1,4,8),null);
assert.equal(copyRange(source,5,4,8),null);
const clip4 = copyRange(source,0,4,16);
assert.deepEqual(clip4.notes.map(n=>n.step),[0,63]);
assert.equal(clip4.bars,4);
assert.equal(source[0].step,0);
assert.deepEqual(rangeSummary(source,0,4,16),{startBar:1,endBar:4,notes:2,total:5});
assert.deepEqual(rangeSummary(source,4,4,16),{startBar:5,endBar:8,notes:2,total:5});
assert.equal(rangeSummary(source,13,4,16),null);
assert.deepEqual(rangePreview(source,clip4,4,16),{
  startBar:5,endBar:8,overwritten:2,inserted:2,totalAfter:5,withinLimit:true,wouldChange:true
});
assert.equal(rangePreview(source,clip4,13,16),null);
assert.equal(rangePreview(source,{bars:4,notes:[{step:64}]},0,16),null);
const pasted = pasteRange(source,clip4,4,16);
assert.deepEqual(pasted.map(n=>n.step),[0,63,128,64,127]);
assert.deepEqual(pasted.slice(-2).map(n=>n.pitch),[60,64]);
assert.equal(source.length,5);
assert.equal(pasteRange(source,clip4,13,16),null);
assert.equal(pasteRange(source,{bars:4,notes:[{step:64}]},0,16),null);
const empty = copyRange([],0,8,16);
assert.deepEqual(pasteRange(source,empty,0,16).map(n=>n.step),[128]);
assert.deepEqual(clearRange(source,0,8,16).map(n=>n.step),[128]);
assert.equal(clearRange(source,9,8,16),null);
// Clearing an already empty window must not allocate, dirty, or create Undo.
const emptyWindow = [ { step: 128, pitch: 70 } ];
assert.equal(rangeSummary(emptyWindow,0,4,16).notes,0);
assert.equal(clearRange(emptyWindow,0,4,16),emptyWindow);
assert.equal(clearRange([],0,4,16).length,0);
const changedWindow = clearRange(source,0,4,16);
assert.notEqual(changedWindow,source);
assert.deepEqual(changedWindow.map(n=>n.step),[64,127,128]);
assert.equal(source.length,5);
const clip8 = copyRange(source,0,8,16);
assert.deepEqual(clip8.notes.map(n=>n.step),[0,63,64,127]);
assert.deepEqual(pasteRange([],clip8,8,16).map(n=>n.step),[128,191,192,255]);
assert.equal(pasteRange([],clip8,9,16),null);

// Copy must avoid intermediate filter/map arrays and preserve source notes.
const noArrayHelpers = new Proxy(source, {
  get(target, key, receiver) {
    if (key === 'filter' || key === 'map') throw new Error('copy must not allocate intermediate arrays');
    return Reflect.get(target, key, receiver);
  }
});
const efficientCopy = copyRange(noArrayHelpers, 0, 4, 16);
assert.deepEqual(efficientCopy, clip4);
assert.notEqual(efficientCopy.notes[0], source[0]);
assert.equal(source[0].step, 0);
// The cap is inclusive; reject the next selected note without cloning any.
const copyExactlyFull = copyRange(Array.from({length:8192}, () => ({step:0,pitch:60})),0,4,16);
assert.equal(copyExactlyFull.notes.length,8192);
assert.equal(copyRange(Array(8193).fill({step:0,pitch:60}),0,4,16),null);


// A small clipboard must not push a long track past the same 8192-note cap.
// Reject before allocating a new track and leave the existing notes untouched.
const almostFull = Array.from({ length: 8191 }, (_, i) => ({ step: 128 + (i % 16), pitch: 60 }));
const full = almostFull.concat({ step: 129, pitch: 64 });
const oneNoteClip = { bars: 4, notes: [{ step: 0, pitch: 70 }] };
assert.equal(rangePreview(full,oneNoteClip,0,16).withinLimit,false);
assert.equal(rangePreview(full,oneNoteClip,0,16).wouldChange,true);
assert.equal(rangePreview(full,oneNoteClip,0,16).totalAfter,8193);
assert.equal(rangePreview(almostFull,oneNoteClip,0,16).withinLimit,true);
assert.equal(pasteRange(full, oneNoteClip, 0, 16), null);
assert.equal(full.length, 8192);
assert.equal(full[8191].pitch, 64);
const atLimit = pasteRange(almostFull, oneNoteClip, 0, 16);
assert.equal(atLimit.length, 8192);
assert.equal(atLimit[8191].pitch, 70);
assert.equal(almostFull.length, 8191);
assert.deepEqual(pasteRange([], oneNoteClip, 0, 16), [{ step: 0, pitch: 70 }]);

// Empty-to-empty paste must not create a redundant Undo/dirty state.
const emptyTrack = [];
const emptyClipboard = copyRange(emptyTrack,0,4,16);
assert.equal(rangePreview(emptyTrack,emptyClipboard,0,16).wouldChange,false);
assert.equal(pasteRange(emptyTrack,emptyClipboard,0,16),emptyTrack);
assert.equal(rangePreview(source,emptyClipboard,0,16).wouldChange,true);
const erased = pasteRange(source,emptyClipboard,0,16);
assert.notEqual(erased,source);
assert.deepEqual(erased.map(n=>n.step),[64,127,128]);
assert.equal(rangePreview(emptyTrack,oneNoteClip,0,16).wouldChange,true);
assert.notEqual(pasteRange(emptyTrack,oneNoteClip,0,16),emptyTrack);


// Copying onto the same unchanged region, or an identical destination, is a no-op.
const selfClip = copyRange(source, 0, 4, 16);
assert.equal(rangePreview(source, selfClip, 0, 16).wouldChange, false);
assert.equal(pasteRange(source, selfClip, 0, 16), source);
const identicalTarget = [
  { step: 0, pitch: 60, length: 2, velocity: 0.8 },
  { step: 64, pitch: 60, length: 2, velocity: 0.8 }
];
const identicalClip = copyRange(identicalTarget, 0, 4, 16);
assert.equal(rangePreview(identicalTarget, identicalClip, 4, 16).wouldChange, false);
assert.equal(pasteRange(identicalTarget, identicalClip, 4, 16), identicalTarget);
const changedVelocity = identicalTarget.map(n => ({ ...n }));
changedVelocity[1].velocity = 0.2;
assert.equal(rangePreview(changedVelocity, identicalClip, 4, 16).wouldChange, true);
assert.notEqual(pasteRange(changedVelocity, identicalClip, 4, 16), changedVelocity);


// Long-score no-op and rejected pastes must not allocate a filtered array.
const forbidFilter = array => new Proxy(array, {
  get(target, key, receiver) {
    if (key === 'filter') throw new Error('paste must not allocate a filtered array');
    return Reflect.get(target, key, receiver);
  }
});
const identicalNoAllocation = forbidFilter(identicalTarget);
assert.equal(pasteRange(identicalNoAllocation, identicalClip, 4, 16), identicalNoAllocation);
const overLimitNoAllocation = forbidFilter(full);
assert.equal(pasteRange(overLimitNoAllocation, oneNoteClip, 0, 16), null);
// Over-limit source tracks may still be repaired by replacing a dense region.
const denseReplace = Array.from({ length: 8193 }, () => ({ step: 0, pitch: 60 }));
assert.deepEqual(pasteRange(denseReplace, oneNoteClip, 0, 16), [{ step: 0, pitch: 70 }]);



// Note order is not part of the project format. Reordered chords with the
// same notes are a no-op; a changed duplicate must still produce an edit.
const reorderedTarget = [
  { step: 65, pitch: 64, velocity: 0.8 },
  { step: 64, pitch: 60, velocity: 0.7 },
  { step: 64, pitch: 60, velocity: 0.7 }
];
const reorderedClip = { bars: 4, notes: [
  { step: 0, pitch: 60, velocity: 0.7 },
  { step: 1, pitch: 64, velocity: 0.8 },
  { step: 0, pitch: 60, velocity: 0.7 }
]};
assert.equal(rangePreview(reorderedTarget,reorderedClip,4,16).wouldChange,false);
assert.equal(pasteRange(reorderedTarget,reorderedClip,4,16),reorderedTarget);
assert.equal(rangePreview(reorderedTarget,{...reorderedClip,notes:[...reorderedClip.notes].reverse()},4,16).wouldChange,false);
const differentDuplicate = reorderedTarget.map(n => ({...n}));
differentDuplicate[2].velocity = 0.9;
assert.equal(rangePreview(differentDuplicate,reorderedClip,4,16).wouldChange,true);
assert.notEqual(pasteRange(differentDuplicate,reorderedClip,4,16),differentDuplicate);
// Object.is equality must not collapse signed zero or NaN when notes reorder.
const specialTarget = [{step:65,pitch:61,velocity:NaN},{step:64,pitch:60,velocity:-0}];
const specialClip = {bars:4,notes:[{step:0,pitch:60,velocity:-0},{step:1,pitch:61,velocity:NaN}]};
assert.equal(rangePreview(specialTarget,specialClip,4,16).wouldChange,false);
assert.equal(pasteRange(specialTarget,specialClip,4,16),specialTarget);
assert.equal(rangePreview(specialTarget,{bars:4,notes:[{step:0,pitch:60,velocity:0},{step:1,pitch:61,velocity:NaN}]},4,16).wouldChange,true);


// Long scores: preview and paste must not scan the track again when the
// overwritten count differs, or when the final count exceeds the hard cap.
function onePassNotes(notes) {
  let scans = 0;
  return {
    notes: new Proxy(notes, {
      get(target, key, receiver) {
        if (key === Symbol.iterator) return function* () {
          if (++scans > 1) throw new Error('unnecessary full-track rescan');
          yield* target;
        };
        return Reflect.get(target, key, receiver);
      }
    }),
    scans: () => scans
  };
}
const countMismatchPreview = onePassNotes([{step:0,pitch:60},{step:1,pitch:61}]);
assert.equal(rangePreview(countMismatchPreview.notes,oneNoteClip,0,16).wouldChange,true);
assert.equal(countMismatchPreview.scans(),1);
const capExceededPreview = onePassNotes(full);
assert.equal(rangePreview(capExceededPreview.notes,oneNoteClip,0,16).withinLimit,false);
assert.equal(capExceededPreview.scans(),1);
const countMismatchPaste = onePassNotes([{step:0,pitch:60},{step:1,pitch:61}]);
assert.deepEqual(pasteRange(countMismatchPaste.notes,oneNoteClip,0,16),[{step:0,pitch:70}]);
assert.equal(countMismatchPaste.scans(),1);

console.log('WAVE long-score tools and 4/8-bar range editing: PASS');
