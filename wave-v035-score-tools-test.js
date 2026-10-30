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

// Jumping to the current bar (including a typed Go request) must not
// rebuild the 125/128-bar editor; invalid targets remain rejected.
const { changedJumpTarget } = require('./wave-v035-score-tools.js');
assert.equal(changedJumpTarget(0,0,125),null);
assert.equal(changedJumpTarget(0,4,125),4);
assert.equal(changedJumpTarget(117,117,125),null);
assert.equal(changedJumpTarget(117,120,125),120);
assert.equal(changedJumpTarget(124,124,125),null);
assert.equal(changedJumpTarget(124,117,125),117);
assert.equal(changedJumpTarget(127,127,128),null);
assert.equal(changedJumpTarget(127,120,128),120);
assert.equal(changedJumpTarget(127,128,128),null);
assert.equal(changedJumpTarget(0,-1,125),null);
assert.equal(changedJumpTarget(0,NaN,125),null);
assert.equal(changedJumpTarget(0,3.5,125),null);
assert.equal(changedJumpTarget('4',4,125),4);

// The final full 4/8-bar window is not the final single bar.
// A 125-bar song should land on bar 122 or 118 (one-based).
const { lastRangeStart } = require('./wave-v035-score-tools.js');
assert.equal(lastRangeStart(125,4),121);
assert.equal(lastRangeStart(125,8),117);
assert.equal(lastRangeStart(128,8),120);
assert.equal(lastRangeStart(8,8),0);
assert.equal(lastRangeStart(4,4),0);
assert.equal(lastRangeStart(4,8),null);
assert.equal(lastRangeStart(3,4),null);
assert.equal(lastRangeStart(125,6),null);
assert.equal(lastRangeStart(125,'4'),null);
assert.equal(lastRangeStart(0,4),null);


// Jump straight back to the first complete selection without scanning
// intermediate bars, including after visiting the 125-bar tail.
const { firstRangeStart } = require('./wave-v035-score-tools.js');
assert.equal(firstRangeStart(125,4),0);
assert.equal(firstRangeStart(125,8),0);
assert.equal(firstRangeStart(128,8),0);
assert.equal(firstRangeStart(8,8),0);
assert.equal(firstRangeStart(4,4),0);
assert.equal(firstRangeStart(4,8),null);
assert.equal(firstRangeStart(3,4),null);
assert.equal(firstRangeStart(0,4),null);
assert.equal(firstRangeStart(125,6),null);
assert.equal(firstRangeStart(125,'4'),null);

// First/last buttons must disable at their destination, avoiding a
// redundant render of a 125-bar score. A manual jump past the final complete
// window must still allow a one-click recovery to the valid edit window.
const { rangeEdgeTarget } = require('./wave-v035-score-tools.js');
assert.equal(rangeEdgeTarget(0,125,4,'first'),null);
assert.equal(rangeEdgeTarget(64,125,4,'first'),0);
assert.equal(rangeEdgeTarget(124,125,8,'first'),0);
assert.equal(rangeEdgeTarget(121,125,4,'last'),null);
assert.equal(rangeEdgeTarget(120,125,4,'last'),121);
assert.equal(rangeEdgeTarget(124,125,8,'last'),117);
assert.equal(rangeEdgeTarget(117,125,8,'last'),null);
assert.equal(rangeEdgeTarget(0,8,8,'last'),null);
assert.equal(rangeEdgeTarget(3,4,8,'last'),null);
assert.equal(rangeEdgeTarget(4,4,4,'first'),null);
assert.equal(rangeEdgeTarget(-1,125,4,'first'),null);
assert.equal(rangeEdgeTarget(0,125,4,'middle'),null);
assert.equal(rangeEdgeTarget(3.5,125,4,'last'),null);
assert.equal(rangeEdgeTarget(NaN,125,4,'last'),null);
assert.equal(rangeEdgeTarget(0,128,8,'last'),120);
assert.equal(rangeEdgeTarget(120,128,8,'last'),null);
assert.equal(rangeEdgeTarget(119,128,8,'last'),120);
assert.equal(rangeEdgeTarget(0,125,6,'first'),null);

// Switching the selected edit size at the tail keeps a complete window.
const { rangeSelectionTarget } = require('./wave-v035-score-tools.js');
assert.equal(rangeSelectionTarget(121,125,8),117);
assert.equal(rangeSelectionTarget(124,125,8),117);
assert.equal(rangeSelectionTarget(124,125,4),121);
assert.equal(rangeSelectionTarget(120,125,4),120);
assert.equal(rangeSelectionTarget(116,125,8),116);
assert.equal(rangeSelectionTarget(0,125,8),0);
assert.equal(rangeSelectionTarget(127,128,8),120);
assert.equal(rangeSelectionTarget(7,8,8),0);
assert.equal(rangeSelectionTarget(3,4,8),null);
assert.equal(rangeSelectionTarget(0,3,4),null);
assert.equal(rangeSelectionTarget(-1,125,8),null);
assert.equal(rangeSelectionTarget(125,125,8),null);
assert.equal(rangeSelectionTarget(2.5,125,8),null);
assert.equal(rangeSelectionTarget(NaN,125,8),null);
assert.equal(rangeSelectionTarget(120,125,6),null);
assert.equal(rangeSelectionTarget(120,125,'8'),null);

// Range-specific navigation must land only on complete 4/8-bar windows.
// General 4/8-bar navigation remains free to reach any single bar.
const { rangeStepTarget } = require('./wave-v035-score-tools.js');
assert.equal(rangeStepTarget(0,125,4,-1),null);
assert.equal(rangeStepTarget(0,125,4,1),4);
assert.equal(rangeStepTarget(118,125,4,1),121);
assert.equal(rangeStepTarget(121,125,4,1),null);
assert.equal(rangeStepTarget(121,125,4,-1),117);
assert.equal(rangeStepTarget(117,125,8,1),null);
assert.equal(rangeStepTarget(112,125,8,1),117);
assert.equal(rangeStepTarget(117,125,8,-1),109);
assert.equal(rangeStepTarget(124,125,8,-1),117);
assert.equal(rangeStepTarget(124,125,8,1),null);
// Manual single-bar navigation can leave a partial window at the end.
// The first backward range step must recover the last *complete* window,
// not skip it; subsequent steps still advance by exactly 4/8 bars.
assert.equal(rangeStepTarget(118,125,8,-1),117);
assert.equal(rangeStepTarget(120,125,8,-1),117);
assert.equal(rangeStepTarget(124,125,4,-1),121);
assert.equal(rangeStepTarget(127,128,8,-1),120);
assert.equal(rangeStepTarget(7,8,8,-1),0);
assert.equal(rangeStepTarget(3,4,4,-1),0);
assert.equal(rangeStepTarget(116,125,8,-1),108);
assert.equal(rangeStepTarget(7,8,8,1),null);
assert.equal(rangeStepTarget(0,4,4,1),null);
assert.equal(rangeStepTarget(0,8,8,1),null);
assert.equal(rangeStepTarget(0,8,4,1),4);
assert.equal(rangeStepTarget(4,8,4,1),null);
assert.equal(rangeStepTarget(2,125,6,1),null);
assert.equal(rangeStepTarget(2,125,4,0),null);
assert.equal(rangeStepTarget(-1,125,4,1),null);
assert.equal(rangeStepTarget(125,125,4,-1),null);
assert.equal(rangeStepTarget(2,125,4,NaN),null);
assert.equal(rangeStepTarget(0,3,4,1),null);

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
assert.deepEqual(rangeBounds(lastRangeStart(125,8),8,125),{start:1872,end:2000});
assert.deepEqual(rangeBounds(lastRangeStart(125,4),4,125),{start:1936,end:2000});
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
// Reordered chords used to scan a long track three times: initial ordered
// check, another ordered check in sameRange, and the multiset comparison.
// Keep the exact duplicate-note semantics while requiring only two passes.
function twoPassNotes(notes) {
  let scans = 0;
  return {
    notes: new Proxy(notes, {
      get(target, key, receiver) {
        if (key === Symbol.iterator) return function* () {
          if (++scans > 2) throw new Error('reordered paste scanned track more than twice');
          yield* target;
        };
        return Reflect.get(target, key, receiver);
      }
    }),
    scans: () => scans
  };
}
const reorderedPreviewTwoPass = twoPassNotes(reorderedTarget);
assert.equal(rangePreview(reorderedPreviewTwoPass.notes,reorderedClip,4,16).wouldChange,false);
assert.equal(reorderedPreviewTwoPass.scans(),2);
const reorderedPasteTwoPass = twoPassNotes(reorderedTarget);
assert.equal(pasteRange(reorderedPasteTwoPass.notes,reorderedClip,4,16),reorderedPasteTwoPass.notes);
assert.equal(reorderedPasteTwoPass.scans(),2);
const reorderedDifferentTwoPass = twoPassNotes(differentDuplicate);
assert.equal(rangePreview(reorderedDifferentTwoPass.notes,reorderedClip,4,16).wouldChange,true);
assert.equal(reorderedDifferentTwoPass.scans(),2);
const longReordered = Array.from({length:8190},(_,i)=>({step:128+(i%16),pitch:60}));
longReordered.unshift({step:1,pitch:64},{step:0,pitch:60});
const longReorderedClip = {bars:4,notes:[{step:0,pitch:60},{step:1,pitch:64}]};
const longReorderedPreview = twoPassNotes(longReordered);
assert.equal(rangePreview(longReorderedPreview.notes,longReorderedClip,0,16).wouldChange,false);
assert.equal(longReorderedPreview.scans(),2);
const longReorderedPaste = twoPassNotes(longReordered);
assert.equal(pasteRange(longReorderedPaste.notes,longReorderedClip,0,16),longReorderedPaste.notes);
assert.equal(longReorderedPaste.scans(),2);

const countMismatchPreview = onePassNotes([{step:0,pitch:60},{step:1,pitch:61}]);
assert.equal(rangePreview(countMismatchPreview.notes,oneNoteClip,0,16).wouldChange,true);
assert.equal(countMismatchPreview.scans(),1);
const capExceededPreview = onePassNotes(full);
assert.equal(rangePreview(capExceededPreview.notes,oneNoteClip,0,16).withinLimit,false);
assert.equal(capExceededPreview.scans(),1);
const countMismatchPaste = onePassNotes([{step:0,pitch:60},{step:1,pitch:61}]);
assert.deepEqual(pasteRange(countMismatchPaste.notes,oneNoteClip,0,16),[{step:0,pitch:70}]);
assert.equal(countMismatchPaste.scans(),1);

// The UI's combined preview must not rescan a long track when the chosen
// range matches the clipboard size; different sizes keep independent bounds.
const { rangeEditPreview } = require('./wave-v035-score-tools.js');
const combinedOnePass = onePassNotes([{step:0,pitch:60},{step:1,pitch:61}]);
const combined = rangeEditPreview(combinedOnePass.notes,0,4,16,oneNoteClip);
assert.deepEqual(combined.selectedRange,{startBar:1,endBar:4,notes:2,total:2});
assert.equal(combined.pasteTarget.wouldChange,true);
assert.equal(combinedOnePass.scans(),1);
assert.deepEqual(rangeEditPreview(source,0,8,16,clip4).selectedRange,
  {startBar:1,endBar:8,notes:4,total:5});
assert.deepEqual(rangeEditPreview(source,0,4,16,null).selectedRange,
  rangeSummary(source,0,4,16));
assert.equal(rangeEditPreview(source,13,4,16,clip4).selectedRange,null);
assert.equal(rangeEditPreview(source,13,4,16,clip4).pasteTarget,null);


// When no track is selected, even a large clipboard must not be inspected.
// This also avoids accessing malformed clipboards while STUDIO switches tracks.
let noTrackClipboardReads = 0;
const noTrackClipboard = {bars:8,notes:new Proxy(Array(8192).fill({step:0,pitch:60}),{
  get(target,key,receiver) {
    if (key === '0') {
      noTrackClipboardReads++;
      throw new Error('no selected track must not read clipboard notes');
    }
    return Reflect.get(target,key,receiver);
  }
})};
assert.deepEqual(rangeEditPreview(null,0,4,125,noTrackClipboard),
  {selectedRange:null,pasteTarget:null});
assert.deepEqual(rangeEditPreview(undefined,0,8,125,noTrackClipboard),
  {selectedRange:null,pasteTarget:null});
assert.deepEqual(rangeEditPreview('invalid',0,4,125,noTrackClipboard),
  {selectedRange:null,pasteTarget:null});
assert.equal(noTrackClipboardReads,0);
assert.deepEqual(rangeEditPreview(null,0,4,125,null),
  {selectedRange:null,pasteTarget:null});

// Switching the 4/8-bar selector while a differently sized clip is held
// must also count both windows in one pass on long scores.
const mixedFourToEight = onePassNotes([{step:0,pitch:60},{step:1,pitch:61},{step:64,pitch:62}]);
const mixedFourToEightPreview = rangeEditPreview(mixedFourToEight.notes,0,8,16,oneNoteClip);
assert.deepEqual(mixedFourToEightPreview.selectedRange,
  {startBar:1,endBar:8,notes:3,total:3});
assert.equal(mixedFourToEightPreview.pasteTarget.overwritten,2);
assert.equal(mixedFourToEightPreview.pasteTarget.wouldChange,true);
assert.equal(mixedFourToEight.scans(),1);
const eightNoteClip = {bars:8,notes:[{step:0,pitch:70}]};
const mixedEightToFour = onePassNotes([{step:0,pitch:60},{step:64,pitch:61}]);
const mixedEightToFourPreview = rangeEditPreview(mixedEightToFour.notes,0,4,16,eightNoteClip);
assert.deepEqual(mixedEightToFourPreview.selectedRange,
  {startBar:1,endBar:4,notes:1,total:2});
assert.equal(mixedEightToFourPreview.pasteTarget.overwritten,2);
assert.equal(mixedEightToFourPreview.pasteTarget.wouldChange,true);
assert.equal(mixedEightToFour.scans(),1);
assert.equal(rangeEditPreview(source,13,4,16,eightNoteClip).selectedRange,null);
assert.equal(rangeEditPreview(source,13,4,16,eightNoteClip).pasteTarget,null);


// Identical ordered regions should preview and paste in one track iteration,
// including a mixed 4/8-bar selector. Reordered chords still use the fallback.
const unchangedClip = { bars: 4, notes: [{ step: 0, pitch: 60 }] };
const unchangedPreview = onePassNotes([{ step: 0, pitch: 60 }]);
assert.equal(rangePreview(unchangedPreview.notes, unchangedClip, 0, 16).wouldChange, false);
assert.equal(unchangedPreview.scans(), 1);
const unchangedPaste = onePassNotes([{ step: 0, pitch: 60 }]);
assert.equal(pasteRange(unchangedPaste.notes, unchangedClip, 0, 16), unchangedPaste.notes);
assert.equal(unchangedPaste.scans(), 1);
const mixedUnchanged = onePassNotes([{ step: 0, pitch: 60 }, { step: 64, pitch: 70 }]);
const mixedUnchangedResult = rangeEditPreview(mixedUnchanged.notes, 0, 8, 16, unchangedClip);
assert.equal(mixedUnchangedResult.selectedRange.notes, 2);
assert.equal(mixedUnchangedResult.pasteTarget.wouldChange, false);
assert.equal(mixedUnchanged.scans(), 1);
assert.equal(rangeEditPreview([], 0, 8, 16, { bars: 4, notes: null }).pasteTarget, null);



// Sparse clipboard arrays are malformed even though Array.some() skips holes.
// Never propagate holes into a project track or advertise the paste as valid.
const sparseClip = { bars: 4, notes: new Array(2) };
sparseClip.notes[1] = { step: 1, pitch: 60 };
assert.equal(rangePreview([], sparseClip, 0, 16), null);
assert.equal(pasteRange([], sparseClip, 0, 16), null);
const sparseMixedPreview = rangeEditPreview(source, 0, 8, 16, sparseClip);
assert.deepEqual(sparseMixedPreview.selectedRange, rangeSummary(source, 0, 8, 16));
assert.equal(sparseMixedPreview.pasteTarget, null);
// Empty but dense clipboards remain valid, including no-op pastes.
assert.equal(rangePreview([], { bars: 4, notes: [] }, 0, 16).wouldChange, false);
// A prototype-inherited note is not an owned array entry and is also rejected.
const inheritedNotes = new Array(1);
const inheritedPrototype = Object.create(Array.prototype);
inheritedPrototype[0] = { step: 0, pitch: 60 };
Object.setPrototypeOf(inheritedNotes, inheritedPrototype);
assert.equal(rangePreview([], { bars: 4, notes: inheritedNotes }, 0, 16), null);
assert.equal(pasteRange([], { bars: 4, notes: inheritedNotes }, 0, 16), null);


// Avoid a second full-track scan when clearing an early 4/8-bar window.
const clearNoHelpers = new Proxy([{step:0,pitch:60},{step:128,pitch:61}], {
  get(target,key,receiver) {
    if (key === 'some' || key === 'filter') throw new Error('redundant range scan');
    return Reflect.get(target,key,receiver);
  }
});
assert.deepEqual(clearRange(clearNoHelpers,0,4,16),[{step:128,pitch:61}]);
const longClearSource = Array.from({length:8192},(_,i) => ({step:i===0?0:128,pitch:60}));
let longClearReads = 0;
const longClearTrack = new Proxy(longClearSource,{
  get(target,key,receiver) {
    if (typeof key === 'string' && /^[0-9]+$/.test(key)) longClearReads++;
    return Reflect.get(target,key,receiver);
  }
});
assert.equal(clearRange(longClearTrack,0,4,16).length,8191);
assert.equal(longClearReads,8192);
const sparseClear = [{step:0,pitch:60}, , {step:128,pitch:61}];
assert.deepEqual(clearRange(sparseClear,0,4,16),[{step:128,pitch:61}]);
const sparseUnchanged = [, {step:128,pitch:61}];
assert.equal(clearRange(sparseUnchanged,0,4,16),sparseUnchanged);
const inheritedClear = new Array(2);
const inheritedClearProto = Object.create(Array.prototype);
inheritedClearProto[0] = {step:0,pitch:60};
Object.setPrototypeOf(inheritedClear,inheritedClearProto);
inheritedClear[1] = {step:128,pitch:61};
assert.deepEqual(clearRange(inheritedClear,0,4,16),[{step:128,pitch:61}]);


// A corrupt/oversized clipboard must not be dereferenced by the combined
// 4/8-bar preview. A malformed clip is not pasteable, but the selected
// range should still be displayed after exactly one scan of a long track.
const oversizedPreviewNotes = new Proxy(new Array(8193), {
  get(target, key, receiver) {
    if (typeof key === 'string' && /^[0-9]+$/.test(key)) {
      throw new Error('oversized clipboard notes must not be inspected');
    }
    return Reflect.get(target, key, receiver);
  }
});
const oversizedPreviewTrack = onePassNotes([{step:0,pitch:60},{step:64,pitch:61}]);
const oversizedMixed = rangeEditPreview(oversizedPreviewTrack.notes,0,8,16,
  {bars:4,notes:oversizedPreviewNotes});
assert.deepEqual(oversizedMixed.selectedRange,
  {startBar:1,endBar:8,notes:2,total:2});
assert.equal(oversizedMixed.pasteTarget,null);
assert.equal(oversizedPreviewTrack.scans(),1);
const invalidTypeMixed = rangeEditPreview(source,0,8,16,{bars:4,notes:'invalid'});
assert.deepEqual(invalidTypeMixed.selectedRange,rangeSummary(source,0,8,16));
assert.equal(invalidTypeMixed.pasteTarget,null);

// Successful pastes should append clipboard clones without building an extra
// temporary map() array, preserving order, source notes and Undo semantics.
const noClipboardMap = { bars: 4, notes: new Proxy([
  { step: 0, pitch: 70 }, { step: 1, pitch: 72 }
], {
  get(target, key, receiver) {
    if (key === 'map') throw new Error('clipboard map() must not allocate a temporary array');
    return Reflect.get(target, key, receiver);
  }
}) };
const originalPasteTrack = [{ step: 0, pitch: 60 }, { step: 128, pitch: 65 }];
const appendedPaste = pasteRange(originalPasteTrack, noClipboardMap, 0, 16);
assert.deepEqual(appendedPaste, [
  { step: 128, pitch: 65 }, { step: 0, pitch: 70 }, { step: 1, pitch: 72 }
]);
assert.notEqual(appendedPaste, originalPasteTrack);
assert.notEqual(appendedPaste[1], noClipboardMap.notes[0]);
assert.equal(noClipboardMap.notes[0].step, 0);
assert.equal(originalPasteTrack[0].pitch, 60);
assert.equal(appendedPaste.length, 3);

// Invalid mixed-size clipboards must be rejected before comparing track fields.
const hostileSelectedNote = new Proxy({step:0,pitch:60}, {
  ownKeys() { throw new Error('invalid clipboard must not compare note fields'); }
});
const malformedMixedClip = {bars:4,notes:[{step:0,pitch:60}, ,]};
const malformedMixedResult = rangeEditPreview([hostileSelectedNote],0,8,16,malformedMixedClip);
assert.deepEqual(malformedMixedResult.selectedRange,
  {startBar:1,endBar:8,notes:1,total:1});
assert.equal(malformedMixedResult.pasteTarget,null);
// Do not read clipboard slots once for comparison and again for validation.
let malformedReads = 0;
const countedMalformedNotes = new Proxy([{step:0,pitch:60}, ,], {
  get(target,key,receiver) {
    if (key === '0') malformedReads++;
    return Reflect.get(target,key,receiver);
  }
});
const countedMalformed = rangeEditPreview([{step:0,pitch:60}],0,8,16,
  {bars:4,notes:countedMalformedNotes});
assert.equal(countedMalformed.pasteTarget,null);
assert.equal(countedMalformed.selectedRange.notes,1);
assert.equal(malformedReads,1);
const validMixedResult = rangeEditPreview([{step:0,pitch:60}],0,8,16,
  {bars:4,notes:[{step:0,pitch:60}]});
assert.equal(validMixedResult.pasteTarget.wouldChange,false);
assert.equal(validMixedResult.pasteTarget.withinLimit,true);
assert.equal(rangePreview([{step:0,pitch:60}],malformedMixedClip,0,16),null);

// A malformed clipboard bar count must be rejected before reading its slots.
 // Valid 4/8-bar selection counts must remain visible without a paste target.
const invalidBarNotes = new Proxy([{step:0,pitch:60}], {
  get(target,key,receiver) {
    if (key === '0') throw new Error('invalid bar count must not read clipboard slots');
    return Reflect.get(target,key,receiver);
  }
});
const invalidBarClipboard = {bars:6,notes:invalidBarNotes};
const invalidBarTrack = onePassNotes([{step:0,pitch:60},{step:64,pitch:62}]);
const invalidBarCombined = rangeEditPreview(invalidBarTrack.notes,0,8,16,invalidBarClipboard);
assert.deepEqual(invalidBarCombined.selectedRange,{startBar:1,endBar:8,notes:2,total:2});
assert.equal(invalidBarCombined.pasteTarget,null);
assert.equal(invalidBarTrack.scans(),1);
assert.equal(rangePreview(source,invalidBarClipboard,0,16),null);
assert.equal(pasteRange(source,invalidBarClipboard,0,16),null);


// At the 125-bar project boundary, 4/8-bar edits must use the last full
// window and reject partial windows without changing the source track.
assert.deepEqual(rangeBounds(117,8,125),{start:1872,end:2000});
assert.deepEqual(rangeBounds(121,4,125),{start:1936,end:2000});
assert.equal(rangeBounds(118,8,125),null);
assert.equal(rangeBounds(122,4,125),null);
const finalBars = [{step:1872,pitch:60},{step:1999,pitch:64}];
const finalClip = copyRange(finalBars,117,8,125);
assert.deepEqual(finalClip.notes.map(note=>note.step),[0,127]);
assert.equal(rangePreview(finalBars,finalClip,117,125).wouldChange,false);
assert.equal(pasteRange(finalBars,finalClip,117,125),finalBars);
assert.equal(pasteRange(finalBars,finalClip,118,125),null);

// Deterministic differential regression: the optimized combined 4/8-bar
// preview must always agree with independent selection and paste previews.
// Exercise empty windows, chord duplicates, reordered notes and end bounds.
let previewSeed = 0x57415645;
function previewRandom(limit) {
  previewSeed = (Math.imul(previewSeed,1664525) + 1013904223) >>> 0;
  return Math.floor((previewSeed / 4294967296) * limit);
}
for (let trial = 0; trial < 256; trial++) {
  const bars = 8 + previewRandom(118);
  const selectedBars = previewRandom(2) ? 4 : 8;
  const copiedBars = previewRandom(2) ? 4 : 8;
  const start = previewRandom(bars + 3) - 1;
  const track = Array.from({length:previewRandom(48)}, () => ({
    step:previewRandom(bars * 16), pitch:48 + previewRandom(36),
    velocity:previewRandom(5) / 4
  }));
  const from = previewRandom(bars);
  const clipboard = copyRange(track,from,copiedBars,bars) || {bars:copiedBars,notes:[]};
  const combinedPreview = rangeEditPreview(track,start,selectedBars,bars,clipboard);
  assert.deepEqual(combinedPreview.selectedRange,rangeSummary(track,start,selectedBars,bars));
  assert.deepEqual(combinedPreview.pasteTarget,rangePreview(track,clipboard,start,bars));
  const originalTrack = track.map(note=>({...note}));
  const pastedTrack = pasteRange(track,clipboard,start,bars);
  assert.deepEqual(track,originalTrack);
  if (!combinedPreview.pasteTarget) {
    assert.equal(pastedTrack,null);
  } else {
    assert.equal(pastedTrack !== null,true);
    assert.equal(pastedTrack.length,combinedPreview.pasteTarget.totalAfter);
    assert.equal(pastedTrack === track,!combinedPreview.pasteTarget.wouldChange);
  }
}

// Near the end of a 125-bar score, an 8-bar clip cannot fit at bar 121.
// Do not inspect thousands of clipboard notes before rejecting that target.
// The valid 4-bar selection must still be summarized with a single scan.
let unreachableClipboardReads = 0;
const unreachableClipboardNotes = new Proxy([{step:0,pitch:70}], {
  get(target,key,receiver) {
    if (key === '0') {
      unreachableClipboardReads++;
      throw new Error('out-of-bounds clipboard must not be inspected');
    }
    return Reflect.get(target,key,receiver);
  }
});
const unreachableClipboard = {bars:8,notes:unreachableClipboardNotes};
const endWindowTrack = onePassNotes([{step:1920,pitch:60}]);
const endWindowPreview = rangeEditPreview(endWindowTrack.notes,120,4,125,unreachableClipboard);
assert.deepEqual(endWindowPreview.selectedRange,
  {startBar:121,endBar:124,notes:1,total:1});
assert.equal(endWindowPreview.pasteTarget,null);
assert.equal(unreachableClipboardReads,0);
assert.equal(endWindowTrack.scans(),1);
// When neither window fits, skip both the track and clipboard scans.
const invalidEndTrack = onePassNotes([{step:1999,pitch:60}]);
const invalidEndPreview = rangeEditPreview(invalidEndTrack.notes,124,4,125,unreachableClipboard);
assert.equal(invalidEndPreview.selectedRange,null);
assert.equal(invalidEndPreview.pasteTarget,null);
assert.equal(unreachableClipboardReads,0);
assert.equal(invalidEndTrack.scans(),0);
// An in-bounds target still performs the normal exact no-op comparison.
const validEndPreview = rangeEditPreview([{step:1872,pitch:60}],117,8,125,
  {bars:8,notes:[{step:0,pitch:60}]});
assert.equal(validEndPreview.pasteTarget.wouldChange,false);


// A public preview must never trust a stale/caller-supplied summary.
// The combined preview alone owns its internally computed summary.
const forgedEmptySummary = {startBar:1,endBar:4,notes:0,total:0,ordered:true};
const summaryTrack = [{step:0,pitch:60}];
const summaryClip = {bars:4,notes:[]};
assert.deepEqual(
  rangePreview(summaryTrack,summaryClip,0,16,forgedEmptySummary),
  rangePreview(summaryTrack,summaryClip,0,16)
);
assert.equal(rangePreview(summaryTrack,summaryClip,0,16,forgedEmptySummary).wouldChange,true);
const forgedLimitSummary = {startBar:1,endBar:4,notes:0,total:0,ordered:false};
assert.deepEqual(
  rangePreview(full,oneNoteClip,0,16,forgedLimitSummary),
  rangePreview(full,oneNoteClip,0,16)
);
assert.equal(rangePreview(full,oneNoteClip,0,16,forgedLimitSummary).withinLimit,false);

// Sparse legacy track arrays can have a length at the note cap while
// containing very few actual entries. filter() discards holes on paste;
// preview and paste must agree on the resulting count at the 8192 limit.
const sparseAtLimit = new Array(8192);
sparseAtLimit[8191] = {step:128,pitch:65};
const sparseLimitClip = {bars:4,notes:[{step:0,pitch:70}]};
const sparseLimitPreview = rangePreview(sparseAtLimit,sparseLimitClip,0,125);
assert.equal(sparseLimitPreview.totalAfter,2);
assert.equal(sparseLimitPreview.withinLimit,true);
assert.equal(sparseLimitPreview.wouldChange,true);
const sparseLimitCombined = rangeEditPreview(sparseAtLimit,0,8,125,sparseLimitClip);
assert.deepEqual(sparseLimitCombined.pasteTarget,sparseLimitPreview);
const sparseLimitPasted = pasteRange(sparseAtLimit,sparseLimitClip,0,125);
assert.deepEqual(sparseLimitPasted,[{step:128,pitch:65},{step:0,pitch:70}]);
assert.equal(sparseAtLimit.length,8192);
assert.equal(sparseAtLimit[8191].pitch,65);
// Inherited slots are visited by filter(), unlike holes. The fallback
// must count them as retained entries and preserve them after the paste.
const inheritedAtLimit = new Array(8192);
const inheritedAtLimitProto = Object.create(Array.prototype);
inheritedAtLimitProto[1] = {step:128,pitch:62};
Object.setPrototypeOf(inheritedAtLimit,inheritedAtLimitProto);
inheritedAtLimit[8191] = {step:128,pitch:64};
const inheritedLimitPreview = rangePreview(inheritedAtLimit,sparseLimitClip,0,125);
assert.equal(inheritedLimitPreview.totalAfter,3);
assert.equal(inheritedLimitPreview.withinLimit,true);
assert.deepEqual(pasteRange(inheritedAtLimit,sparseLimitClip,0,125),
  [{step:128,pitch:62},{step:128,pitch:64},{step:0,pitch:70}]);


// Short sparse tracks must report exact post-paste counts too, not their
// allocated array length. A second full-track scan is unnecessary.
const shortSparse = new Array(32);
shortSparse[31] = {step:128,pitch:65};
const shortSparseClip = {bars:4,notes:[{step:0,pitch:70}]};
assert.equal(rangePreview(shortSparse,shortSparseClip,0,125).totalAfter,2);
assert.equal(rangeEditPreview(shortSparse,0,8,125,shortSparseClip).pasteTarget.totalAfter,2);
assert.equal(pasteRange(shortSparse,shortSparseClip,0,125).length,2);
// Explicit undefined and inherited slots survive filter() and must count.
const explicitUndefinedTrack = [undefined,{step:128,pitch:65}];
assert.equal(rangePreview(explicitUndefinedTrack,shortSparseClip,0,125).totalAfter,3);
assert.deepEqual(pasteRange(explicitUndefinedTrack,shortSparseClip,0,125),
  [undefined,{step:128,pitch:65},{step:0,pitch:70}]);
const shortInherited = new Array(32);
const shortInheritedProto = Object.create(Array.prototype);
shortInheritedProto[1] = {step:128,pitch:62};
Object.setPrototypeOf(shortInherited,shortInheritedProto);
shortInherited[31] = {step:128,pitch:65};
assert.equal(rangePreview(shortInherited,shortSparseClip,0,125).totalAfter,3);
assert.equal(rangeEditPreview(shortInherited,0,8,125,shortSparseClip).pasteTarget.totalAfter,3);
assert.equal(pasteRange(shortInherited,shortSparseClip,0,125).length,3);

// Deterministic sparse/legacy long-score differential regression.
// Dense-only fuzzing misses holes, inherited entries and explicit undefined,
// which must agree between read-only previews and actual 4/8-bar edits.
let sparseSeed = 0x53a9b125;
function sparseRandom(limit) {
  sparseSeed = (Math.imul(sparseSeed, 1664525) + 1013904223) >>> 0;
  // Use high bits: LCG low bits alternate, excluding 4/4 and 8/8 cases.
  return Math.floor((sparseSeed / 4294967296) * limit);
}
const sparseWindowCoverage = { '4/4': 0, '4/8': 0, '8/4': 0, '8/8': 0 };
const sparseLengthCoverage = { 8: 0, 125: 0, 128: 0 };
for (let trial = 0; trial < 256; trial++) {
  const bars = [8, 125, 128][sparseRandom(3)];
  const selectedBars = sparseRandom(2) ? 4 : 8;
  const copiedBars = sparseRandom(2) ? 4 : 8;
  sparseWindowCoverage[selectedBars + '/' + copiedBars]++;
  sparseLengthCoverage[bars]++;
  const start = [0, bars - selectedBars, bars - 1, sparseRandom(bars)][sparseRandom(4)];
  const notes = new Array(8 + sparseRandom(96));
  for (let i = 0; i < notes.length; i++) {
    if (sparseRandom(4) === 0) {
      notes[i] = { step: sparseRandom(bars * 16), pitch: 48 + sparseRandom(36) };
    } else if (sparseRandom(11) === 0) {
      notes[i] = undefined; // Own undefined entries survive Array.filter().
    } else if (sparseRandom(13) === 0) {
      notes[i] = null;
    }
  }
  if (notes.length > 1 && trial % 3 === 0) {
    const proto = Object.create(Array.prototype);
    proto[1] = { step: sparseRandom(bars * 16), pitch: 67 };
    delete notes[1];
    Object.setPrototypeOf(notes, proto); // Inherited entries are not holes.
  }
  const sourceStart = sparseRandom(bars - copiedBars + 1);
  const clip = copyRange(notes, sourceStart, copiedBars, bars);
  assert.notEqual(clip, null);
  const before = Array.from({ length: notes.length }, (_, i) => [i in notes, notes[i]]);
  const beforeClip = clip.notes.map(note => ({ ...note }));
  const combined = rangeEditPreview(notes, start, selectedBars, bars, clip);
  const individual = rangePreview(notes, clip, start, bars);
  assert.deepEqual(combined.selectedRange, rangeSummary(notes, start, selectedBars, bars));
  assert.deepEqual(combined.pasteTarget, individual);
  const pasted = pasteRange(notes, clip, start, bars);
  if (individual === null) {
    assert.equal(pasted, null);
  } else {
    assert.notEqual(pasted, null);
    assert.equal(pasted === notes, !individual.wouldChange);
    if (pasted !== notes) assert.equal(pasted.length, individual.totalAfter);
  }
  const cleared = clearRange(notes, start, selectedBars, bars);
  if (combined.selectedRange === null) assert.equal(cleared, null);
  else assert.equal(cleared === notes, combined.selectedRange.notes === 0);
  assert.deepEqual(Array.from({ length: notes.length }, (_, i) => [i in notes, notes[i]]), before);
  assert.deepEqual(clip.notes, beforeClip);
}

// Keep deterministic fuzzing honest: exercise both same-size and mixed-size
// copy/paste across short, 125-bar and 128-bar project boundaries.
for (const count of Object.values(sparseWindowCoverage)) assert.equal(count > 0, true);
for (const count of Object.values(sparseLengthCoverage)) assert.equal(count > 0, true);


// Exhaustively check every 4/8-bar navigation position for all supported
// 1..128-bar songs. The oracle uses only arithmetic, not the target helpers:
// this guards against off-by-one regressions in 125/128-bar edit windows.
for (let songBars = 1; songBars <= 128; songBars++) {
  for (const windowBars of [4, 8]) {
    const finalStart = songBars >= windowBars ? songBars - windowBars : null;
    assert.equal(lastRangeStart(songBars, windowBars), finalStart);
    assert.equal(firstRangeStart(songBars, windowBars),
      finalStart === null ? null : 0);
    for (let index = 0; index < songBars; index++) {
      const unavailable = finalStart === null;
      assert.equal(rangeSelectionTarget(index, songBars, windowBars),
        unavailable ? null : Math.min(index, finalStart));
      assert.equal(rangeEdgeTarget(index, songBars, windowBars, 'first'),
        unavailable || index === 0 ? null : 0);
      assert.equal(rangeEdgeTarget(index, songBars, windowBars, 'last'),
        unavailable || index === finalStart ? null : finalStart);
      assert.equal(rangeStepTarget(index, songBars, windowBars, 1),
        unavailable || index >= finalStart ? null :
          Math.min(finalStart, index + windowBars));
      assert.equal(rangeStepTarget(index, songBars, windowBars, -1),
        unavailable || index === 0 ? null :
          index > finalStart ? finalStart : Math.max(0, index - windowBars));
      assert.deepEqual(rangeBounds(index, windowBars, songBars),
        unavailable || index > finalStart ? null :
          { start: index * 16, end: (index + windowBars) * 16 });
      assert.equal(changedJumpTarget(index, index, songBars), null);
    }
  }
}


/* UI event regression: 125-bar range editing, Undo/dirty, project isolation.
 * Fake DOM only; no FiveM server, audio or browser runtime required.
 */
function runScoreUiRegression(sourceCode) {
  // Exercise browser event wiring without deploying to FiveM/CEF.
  class UiElement {
    constructor(id = '') {
      this.id = id; this.listeners = Object.create(null);
      this.isConnected = true; this.disabled = false;
      this.value = '1'; this.textContent = '';
    }
    addEventListener(type, listener) { (this.listeners[type] ||= []).push(listener); }
    trigger(type) { for (const listener of this.listeners[type] || []) listener({}); }
    click() { this.trigger('click'); }
    blur() {}
    querySelector(selector) { return this.nodes ? this.nodes[selector.slice(1)] || null : null; }
    appendChild(child) { this.child = child; child.isConnected = true; }
    set innerHTML(html) {
      this.nodes = Object.create(null);
      for (const match of html.matchAll(/id="([^"]+)"/g)) {
        this.nodes[match[1]] = new UiElement(match[1]);
      }
      this.nodes.waveRangeBars.value = '4';
    }
  }
  const navigator = new UiElement('waveBarNavigator');
  const counter = new UiElement('waveBarCounter');
  const view = new UiElement('view-studio');
  const elements = { waveBarNavigator: navigator, waveBarCounter: counter, 'view-studio': view };
  const document = {
    readyState: 'complete', activeElement: null,
    getElementById(id) { return elements[id] || null; },
    createElement() { return new UiElement(); },
    addEventListener() {}
  };
  const firstTrack = { notes: [
    { step: 0, pitch: 60 }, { step: 1, pitch: 62 },
    { step: 64, pitch: 70 }, { step: 1920, pitch: 75 }
  ] };
  const active = { project: { bars: 125, bpm: 120 }, track: firstTrack };
  const state = { bar: 0 };
  let renders = 0, undoCalls = 0, dirtyCalls = 0;
  const isolatedModule = { exports: {} };
  new Function('document', 'MutationObserver', 'ensureProject', 'getTrack',
    'state', 'renderStudio', 'pushUndo', 'markDirty', 'queueMicrotask',
    'module', 'exports', sourceCode)(
    document, class { observe() {} }, () => active.project, () => active.track,
    state, () => { renders++; }, () => { undoCalls++; },
    () => { dirtyCalls++; }, fn => fn(), isolatedModule, isolatedModule.exports
  );
  const host = navigator.child;
  assert.equal(Boolean(host), true);
  const ui = host.nodes;
  assert.equal(ui.waveRangeCopy.disabled, false);
  ui.waveRangeCopy.click();
  assert.equal(ui.waveScoreMessage.textContent.includes('4小節をコピー'), true);
  ui.waveRangeNext.click();
  assert.equal(state.bar, 4);
  ui.waveRangePaste.click();
  assert.deepEqual(firstTrack.notes.filter(n => n.step >= 64 && n.step < 128)
    .map(n => [n.step, n.pitch]), [[64, 60], [65, 62]]);
  assert.equal(undoCalls, 1);
  assert.equal(dirtyCalls, 1);
  assert.equal(ui.waveRangePaste.disabled, true);
  ui.waveRangePaste.click(); // Programmatic no-op must not create Undo.
  assert.equal(undoCalls, 1);
  assert.equal(dirtyCalls, 1);
  ui.waveBarJump.value = '125';
  ui.waveBarJumpGo.click();
  assert.equal(state.bar, 124);
  ui.waveRangeBars.value = '8';
  ui.waveRangeBars.trigger('change');
  assert.equal(state.bar, 117);
  assert.equal(ui.waveRangeNext.disabled, true);
  assert.equal(ui.waveRangeLast.disabled, true);
  ui.waveRangeCopy.click();
  const secondTrack = { notes: [{ step: 0, pitch: 99 }] };
  active.project = { bars: 125, bpm: 120 };
  active.track = secondTrack;
  host.trigger('focusin'); // Project switch must invalidate copied notes.
  assert.equal(ui.waveRangePaste.disabled, true);
  ui.waveRangePaste.click();
  assert.deepEqual(secondTrack.notes, [{ step: 0, pitch: 99 }]);
  assert.equal(undoCalls, 1);
  active.project = { bars: 125, bpm: 120 };
  active.track = firstTrack;
  host.trigger('focusin');
  ui.waveRangeClear.click();
  assert.equal(firstTrack.notes.some(n => n.step === 1920), false);
  assert.equal(undoCalls, 2);
  assert.equal(dirtyCalls, 2);
  ui.waveRangeClear.click();
  assert.equal(undoCalls, 2);
  active.track = null;
  host.trigger('focusin');
  assert.equal(ui.waveRangeCopy.disabled, true);
  assert.equal(ui.waveRangeClear.disabled, true);
  assert.equal(ui.waveRangePaste.disabled, true);
  active.track = firstTrack;
  host.trigger('focusin');
  ui.waveRangeFirst.click();
  assert.equal(state.bar, 0);
  const rendersBeforeNoop = renders;
  ui.waveRangeFirst.click();
  assert.equal(renders, rendersBeforeNoop);

  // 8-bar copy/paste through the UI: no dirty state on copy or identical paste.
  const originalSource = firstTrack.notes.map(n => ({ ...n }));
  ui.waveRangeBars.value = '8';
  ui.waveRangeBars.trigger('change');
  ui.waveRangeCopy.click();
  assert.equal(ui.waveScoreMessage.textContent.includes('8小節をコピー'), true);
  assert.equal(undoCalls, 2);
  assert.equal(dirtyCalls, 2);
  ui.waveRangeNext.click();
  assert.equal(state.bar, 8);
  ui.waveRangePaste.click();
  assert.deepEqual(firstTrack.notes.filter(n => n.step >= 128 && n.step < 256)
    .map(n => [n.step, n.pitch]),
    [[128, 60], [129, 62], [192, 60], [193, 62]]);
  assert.equal(undoCalls, 3);
  assert.equal(dirtyCalls, 3);
  ui.waveRangePaste.click();
  assert.equal(undoCalls, 3);
  assert.equal(dirtyCalls, 3);
  assert.deepEqual(firstTrack.notes.filter(n => n.step < 128), originalSource);

  // A clipboard belongs to the project, not the selected track.
  active.track = secondTrack;
  host.trigger('focusin');
  assert.equal(ui.waveRangePaste.disabled, false);
  ui.waveRangePaste.click();
  assert.deepEqual(secondTrack.notes.map(n => [n.step, n.pitch]),
    [[0, 99], [128, 60], [129, 62], [192, 60], [193, 62]]);
  assert.equal(undoCalls, 4);
  assert.equal(dirtyCalls, 4);
  assert.deepEqual(firstTrack.notes.filter(n => n.step < 128), originalSource);

  // 8-bar paste at bar 125 must fail, then succeed in the final full window.
  ui.waveBarJump.value = '125';
  ui.waveBarJumpGo.click();
  assert.equal(state.bar, 124);
  assert.equal(ui.waveRangePaste.disabled, true);
  ui.waveRangePaste.click();
  assert.equal(undoCalls, 4);
  assert.equal(dirtyCalls, 4);
  ui.waveRangeLast.click();
  assert.equal(state.bar, 117);
  ui.waveRangePaste.click();
  assert.deepEqual(secondTrack.notes.filter(n => n.step >= 1872)
    .map(n => [n.step, n.pitch]),
    [[1872, 60], [1873, 62], [1936, 60], [1937, 62]]);
  assert.equal(undoCalls, 5);
  assert.equal(dirtyCalls, 5);

  // Mixed 4-bar clipboard / 8-bar selection: only the first 4 bars change.
  active.track = firstTrack;
  host.trigger('focusin');
  ui.waveRangeBars.value = '4';
  ui.waveRangeBars.trigger('change');
  ui.waveRangeFirst.click();
  assert.equal(state.bar, 0);
  ui.waveRangeCopy.click();
  ui.waveRangeBars.value = '8';
  ui.waveRangeBars.trigger('change');
  ui.waveRangeNext.click();
  assert.equal(state.bar, 8);
  const followingBars = firstTrack.notes.filter(n => n.step >= 192 && n.step < 256)
    .map(n => ({ ...n }));
  ui.waveRangePaste.click(); // Existing 4 bars are already identical.
  assert.deepEqual(firstTrack.notes.filter(n => n.step >= 192 && n.step < 256), followingBars);
  assert.equal(undoCalls, 5);
  assert.equal(dirtyCalls, 5);
  const mixedTrack = { notes: [{ step: 128, pitch: 99 }, { step: 192, pitch: 88 }] };
  active.track = mixedTrack;
  host.trigger('focusin');
  assert.equal(ui.waveRangePaste.disabled, false);
  ui.waveRangePaste.click();
  assert.deepEqual(mixedTrack.notes.map(n => [n.step, n.pitch]),
    [[192, 88], [128, 60], [129, 62]]);
  assert.equal(undoCalls, 6);
  assert.equal(dirtyCalls, 6);
  ui.waveRangePaste.click();
  assert.equal(undoCalls, 6);
  assert.equal(dirtyCalls, 6);
  assert.deepEqual(mixedTrack.notes.filter(n => n.step >= 192), [{ step: 192, pitch: 88 }]);

  // Changing projects invalidates the clip even when the track stays selected.
  active.project = { bars: 125, bpm: 120 };
  host.trigger('focusin');
  assert.equal(ui.waveRangePaste.disabled, true);
  ui.waveRangePaste.click();
  assert.equal(undoCalls, 6);
  assert.equal(dirtyCalls, 6);


  // Walk the real UI controls across a full 125-bar project, not just a
  // single click. A final partial stride must stop at the last *complete*
  // edit window; reversing from that window must not skip any valid stop.
  // Disabled boundary buttons must never trigger a redundant render.
  for (const windowBars of [4, 8]) {
    ui.waveRangeBars.value = String(windowBars);
    ui.waveRangeBars.trigger('change');
    ui.waveRangeFirst.click();
    assert.equal(state.bar, 0);
    const last = 125 - windowBars;
    const expectedForward = [];
    for (let cursor = 0; cursor < last;) {
      cursor = Math.min(last, cursor + windowBars);
      expectedForward.push(cursor);
    }
    const actualForward = [];
    for (let i = 0; i < expectedForward.length; i++) {
      const beforeRender = renders;
      ui.waveRangeNext.click();
      actualForward.push(state.bar);
      assert.equal(renders, beforeRender + 1);
    }
    assert.deepEqual(actualForward, expectedForward);
    assert.equal(state.bar, last);
    assert.equal(ui.waveRangeNext.disabled, true);
    assert.equal(ui.waveRangeLast.disabled, true);
    const atLastRenders = renders;
    ui.waveRangeNext.click();
    ui.waveRangeLast.click();
    assert.equal(renders, atLastRenders);

    const expectedBackward = [];
    for (let cursor = last; cursor > 0;) {
      cursor = Math.max(0, cursor - windowBars);
      expectedBackward.push(cursor);
    }
    const actualBackward = [];
    for (let i = 0; i < expectedBackward.length; i++) {
      const beforeRender = renders;
      ui.waveRangePrev.click();
      actualBackward.push(state.bar);
      assert.equal(renders, beforeRender + 1);
    }
    assert.deepEqual(actualBackward, expectedBackward);
    assert.equal(state.bar, 0);
    assert.equal(ui.waveRangePrev.disabled, true);
    assert.equal(ui.waveRangeFirst.disabled, true);
    const atFirstRenders = renders;
    ui.waveRangePrev.click();
    ui.waveRangeFirst.click();
    assert.equal(renders, atFirstRenders);
  }


  // Short projects have no complete 4/8-bar edit window. Even synthetic
  // clicks on disabled controls must not mutate tracks or create Undo entries.
  const undoBeforeShort = undoCalls;
  const dirtyBeforeShort = dirtyCalls;
  const shortProjectTrack = { notes: [{ step: 0, pitch: 40 }] };
  active.project = { bars: 3, bpm: 120 };
  active.track = shortProjectTrack;
  state.bar = 0;
  host.trigger('focusin');
  assert.equal(ui.waveRangeCopy.disabled, true);
  assert.equal(ui.waveRangePaste.disabled, true);
  assert.equal(ui.waveRangeClear.disabled, true);
  assert.equal(ui.waveRangeFirst.disabled, true);
  assert.equal(ui.waveRangeLast.disabled, true);
  assert.equal(ui.waveRangePrev.disabled, true);
  assert.equal(ui.waveRangeNext.disabled, true);
  ui.waveRangeCopy.click();
  ui.waveRangePaste.click();
  ui.waveRangeClear.click();
  ui.waveRangeLast.click();
  assert.deepEqual(shortProjectTrack.notes, [{ step: 0, pitch: 40 }]);
  assert.equal(undoCalls, undoBeforeShort);
  assert.equal(dirtyCalls, dirtyBeforeShort);
  assert.equal(state.bar, 0);

  // The 128-bar boundary must preserve the final 8-bar copy, including the
  // last bar, and paste it at the first window with exactly one Undo entry.
  const longProjectTrack = { notes: [
    { step: 0, pitch: 48 }, { step: 1920, pitch: 72 }
  ] };
  active.project = { bars: 128, bpm: 120 };
  active.track = longProjectTrack;
  host.trigger('focusin');
  ui.waveRangeLast.click();
  assert.equal(state.bar, 120);
  assert.equal(ui.waveRangeCopy.disabled, false);
  ui.waveRangeCopy.click();
  assert.equal(undoCalls, undoBeforeShort);
  ui.waveRangeFirst.click();
  assert.equal(state.bar, 0);
  assert.equal(ui.waveRangePaste.disabled, false);
  ui.waveRangePaste.click();
  assert.deepEqual(longProjectTrack.notes,
    [{ step: 1920, pitch: 72 }, { step: 0, pitch: 72 }]);
  assert.equal(undoCalls, undoBeforeShort + 1);
  assert.equal(dirtyCalls, dirtyBeforeShort + 1);
  ui.waveRangeBars.value = '4';
  ui.waveRangeBars.trigger('change');
  ui.waveRangeLast.click();
  assert.equal(state.bar, 124);
  assert.equal(ui.waveRangeNext.disabled, true);
  ui.waveRangePrev.click();
  assert.equal(state.bar, 120);

}
runScoreUiRegression(require('node:fs').readFileSync(
  require.resolve('./wave-v035-score-tools.js'), 'utf8'));

console.log('WAVE long-score tools and 4/8-bar range editing: PASS');
