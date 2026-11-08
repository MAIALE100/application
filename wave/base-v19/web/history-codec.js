// WAVE screen handoff history codec v1.
// Lossless deltas allow a large score and its Undo/Redo history to cross
// the existing 1 MiB NUI state limit without truncating user edits.
(function (root) {
  'use strict';
  const copy = v => v === undefined ? undefined : JSON.parse(JSON.stringify(v));
  const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const sameNote = (a, b) => a === b || (!!a && !!b && a.step === b.step &&
    a.pitch === b.pitch && a.length === b.length && a.velocity === b.velocity &&
    (Object.keys(a).length === 4 && Object.keys(b).length === 4 || equal(a, b)));

  // Patch FROM base TO target. Array splices preserve the exact note order.
  function diff(base, target) {
    if (!base || !target || !Array.isArray(base.tracks) || !Array.isArray(target.tracks) ||
        base.tracks.length !== target.tracks.length) return { full: copy(target) };
    const patch = { props: {}, tracks: [] };
    for (const key of new Set([...Object.keys(base), ...Object.keys(target)])) {
      if (key === 'tracks') continue;
      if (!equal(base[key], target[key])) patch.props[key] = { present: Object.hasOwn(target, key), value: target[key] };
    }
    for (let i = 0; i < base.tracks.length; i++) {
      const a = base.tracks[i], b = target.tracks[i];
      if (!a || !b || !Array.isArray(a.notes) || !Array.isArray(b.notes)) return { full: copy(target) };
      const item = { index: i, props: {} };
      for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
        if (key === 'notes') continue;
        if (!equal(a[key], b[key])) item.props[key] = { present: Object.hasOwn(b, key), value: b[key] };
      }
      let prefix = 0;
      while (prefix < a.notes.length && prefix < b.notes.length && sameNote(a.notes[prefix], b.notes[prefix])) prefix++;
      let suffix = 0;
      while (suffix < a.notes.length - prefix && suffix < b.notes.length - prefix &&
          sameNote(a.notes[a.notes.length - suffix - 1], b.notes[b.notes.length - suffix - 1])) suffix++;
      if (prefix !== a.notes.length || prefix !== b.notes.length) {
        item.notes = [prefix, a.notes.length - prefix - suffix, b.notes.slice(prefix, b.notes.length - suffix)];
      }
      if (item.notes || Object.keys(item.props).length) patch.tracks.push(item);
    }
    return patch;
  }
  function apply(base, patch) {
    if (patch.full) return copy(patch.full);
    const result = copy(base);
    for (const [key, change] of Object.entries(patch.props || {})) {
      if (change.present) result[key] = copy(change.value); else delete result[key];
    }
    for (const item of patch.tracks || []) {
      const track = result.tracks[item.index];
      if (!track) throw Error('Invalid WAVE history track');
      for (const [key, change] of Object.entries(item.props || {})) {
        if (change.present) track[key] = copy(change.value); else delete track[key];
      }
      if (item.notes) {
        const [index, count, notes] = item.notes;
        track.notes.splice(index, count, ...copy(notes));
      }
    }
    return result;
  }
  // Stack order is oldest -> newest. Store reverse steps from active project,
  // so each successive patch is tiny when edits only affect one note.
  function pack(project, stack) {
    const patches = [];
    let previous = project;
    for (let i = (stack || []).length - 1; i >= 0; i--) {
      patches.push(diff(previous, stack[i]));
      previous = stack[i];
    }
    return { version: 1, patches };
  }
  function unpack(project, packed) {
    if (!packed || packed.version !== 1 || !Array.isArray(packed.patches) || packed.patches.length > 40)
      throw Error('Invalid WAVE history format');
    const reverse = [];
    let previous = project;
    for (const patch of packed.patches) {
      previous = apply(previous, patch);
      reverse.push(previous);
    }
    return reverse.reverse();
  }
  const api = { diff, apply, pack, unpack };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.WaveHistoryCodec = api;
})(typeof globalThis === 'undefined' ? this : globalThis);
