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

console.log('WAVE long-score tools and 4/8-bar range editing: PASS');
