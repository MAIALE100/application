// WAVE_LONG_SCORE_TOOLS_V035
// Navigation and selected-track range edits; preserve the existing project save format.
(function (root) {
  'use strict';

  function validBars(bars) {
    const value = Math.floor(Number(bars));
    return Number.isFinite(value) ? Math.max(1, Math.min(128, value)) : 1;
  }

  function validIndex(index, bars) {
    const n = Math.floor(Number(index));
    return Number.isFinite(n) ? Math.max(0, Math.min(validBars(bars) - 1, n)) : 0;
  }

  function jumpTarget(index, bars, delta) {
    const change = Number(delta);
    const offset = Number.isFinite(change) ? Math.trunc(change) : 0;
    return validIndex(validIndex(index, bars) + offset, bars);
  }

  function durationSeconds(bars, bpm) {
    const tempo = Number(bpm);
    const safeTempo = Number.isFinite(tempo) && tempo >= 60 && tempo <= 200 ? tempo : 120;
    return Math.ceil(validBars(bars) * 4 * 60 / safeTempo);
  }

  function durationLabel(bars, bpm) {
    const seconds = durationSeconds(bars, bpm);
    return Math.floor(seconds / 60) + ':' + String(seconds % 60).padStart(2, '0');
  }


  // WAVE_RANGE_EDIT_V036: selected-track edits only; unchanged save format.
  function rangeBounds(startBar, count, totalBars) {
    if (!Number.isInteger(startBar) || (count !== 4 && count !== 8)) return null;
    const bars = validBars(totalBars);
    if (startBar < 0 || startBar + count > bars) return null;
    return { start: startBar * 16, end: (startBar + count) * 16 };
  }

  function copyRange(notes, startBar, count, totalBars) {
    const bounds = rangeBounds(startBar, count, totalBars);
    if (!bounds || !Array.isArray(notes)) return null;
    // Select once, then replace references with cloned relative-step notes.
    // This avoids a second array and never clones an oversized selection.
    const selected = [];
    for (const note of notes) {
      if (!note || !Number.isInteger(note.step) ||
          note.step < bounds.start || note.step >= bounds.end) continue;
      if (selected.length === 8192) return null;
      selected.push(note);
    }
    for (let i = 0; i < selected.length; i++) {
      const note = selected[i];
      selected[i] = { ...note, step: note.step - bounds.start };
    }
    return { bars: count, notes: selected };
  }

  // A range is unchanged even if the track stores equivalent notes in a
  // different array order (e.g. after editing chords or loading a draft).
  // Keep the common ordered case allocation-free; only build a multiset when
  // the order differs. Compare all own fields with Object.is semantics.
  function equivalentNote(note, copied, origin) {
    if (!copied) return false;
    const keys = Object.keys(note);
    if (keys.length !== Object.keys(copied).length) return false;
    for (const key of keys) {
      if (!Object.prototype.hasOwnProperty.call(copied, key) ||
          !Object.is(key === 'step' ? note.step - origin : note[key], copied[key])) return false;
    }
    return true;
  }

  function sameRange(notes, clipboard, bounds) {
    // scanRange already checked ordered equality and note count. On the
    // reordered fallback, build the multiset directly rather than repeating
    // that full-track scan before the count comparison below.
    // Nested Maps provide exact, order-independent counts, including duplicate
    // chord notes. Unlike JSON serialization, they retain object identity,
    // undefined, NaN and signed-zero distinctions from Object.is.
    const negativeZero = Symbol('negative zero');
    const countKey = Symbol('count');
    const counts = new Map();
    function adjust(note, origin, delta) {
      const keys = Object.keys(note).sort();
      const parts = [keys.length];
      for (const key of keys) {
        parts.push(key, key === 'step' ? note.step - origin : note[key]);
      }
      let node = counts;
      for (const part of parts) {
        const token = typeof part === 'number' && Object.is(part, -0) ? negativeZero : part;
        let next = node.get(token);
        if (!next) {
          if (delta < 0) return false;
          next = new Map();
          node.set(token, next);
        }
        node = next;
      }
      const count = node.get(countKey) || 0;
      if (count + delta < 0) return false;
      node.set(countKey, count + delta);
      return true;
    }
    for (const copied of clipboard.notes) adjust(copied, 0, 1);
    let seen = 0;
    for (const note of notes) {
      if (note && Number.isInteger(note.step) &&
          note.step >= bounds.start && note.step < bounds.end) {
        seen++;
        if (!adjust(note, bounds.start, -1)) return false;
      }
    }
    return seen === clipboard.notes.length;
  }

  // Count and check ordered identity in the same pass. The common unchanged
  // paste/preview now avoids a second scan of a long track. Reordered chords
  // still use the exact multiset fallback in sameRange().
  function scanRange(notes, clipboard, bounds) {
    let overwritten = 0;
    let ordered = true;
    for (const note of notes) {
      if (!note || !Number.isInteger(note.step) ||
          note.step < bounds.start || note.step >= bounds.end) continue;
      if (ordered && !equivalentNote(note, clipboard.notes[overwritten], bounds.start)) ordered = false;
      overwritten++;
    }
    return { overwritten, ordered: ordered && overwritten === clipboard.notes.length };
  }

  // Array.some() skips sparse holes. Reject them explicitly so malformed
  // clipboards cannot insert missing note entries into saved tracks.
  function invalidClipboardNotes(clipboard) {
    for (let i = 0; i < clipboard.notes.length; i++) {
      if (!Object.prototype.hasOwnProperty.call(clipboard.notes, i)) return true;
      const note = clipboard.notes[i];
      if (!note || !Number.isInteger(note.step) ||
          note.step < 0 || note.step >= clipboard.bars * 16) return true;
    }
    return false;
  }

  function pasteRange(notes, clipboard, startBar, totalBars) {
    if (!clipboard || !Array.isArray(clipboard.notes) || clipboard.notes.length > 8192 ||
        !Array.isArray(notes)) return null;
    const bounds = rangeBounds(startBar, clipboard.bars, totalBars);
    if (!bounds || invalidClipboardNotes(clipboard)) return null;
    // Count overwritten notes without allocating a replacement array. This
    // keeps rejected and identical pastes allocation-free on long scores.
    const { overwritten, ordered } = scanRange(notes, clipboard, bounds);
    // Preserve the existing 8192-note cap, including malformed legacy notes.
    if (notes.length - overwritten + clipboard.notes.length > 8192) return null;
    // Differing note counts cannot be identical; skip the second track scan.
    // The UI uses unchanged array identity to avoid redundant Undo/dirty flags.
    if (overwritten === clipboard.notes.length && (ordered || sameRange(notes, clipboard, bounds))) return notes;
    const remaining = notes.filter(n => !n || !Number.isInteger(n.step) ||
      n.step < bounds.start || n.step >= bounds.end);
    // Append clones directly: avoid a second temporary array on successful pastes.
    // Keep filter() semantics for sparse/inherited source slots and note order.
    for (const note of clipboard.notes) {
      remaining.push({ ...note, step: bounds.start + note.step });
    }
    return remaining;
  }

  // Read-only preview; never modifies the project or its clipboard.
  function rangeSummary(notes, startBar, count, totalBars) {
    const bounds = rangeBounds(startBar, count, totalBars);
    if (!bounds || !Array.isArray(notes)) return null;
    let selected = 0;
    for (const note of notes) {
      if (note && Number.isInteger(note.step) &&
          note.step >= bounds.start && note.step < bounds.end) selected++;
    }
    return { startBar: startBar + 1, endBar: startBar + count, notes: selected, total: notes.length };
  }

  // Validate clipboards before inspecting track note fields. Combined previews
  // can reuse this private helper without validating the same clipboard twice.
  function previewValidatedRange(notes, clipboard, startBar, bounds, precomputedSummary) {
    const scan = precomputedSummary ? null : scanRange(notes, clipboard, bounds);
    const summary = precomputedSummary || { startBar: startBar + 1,
      endBar: startBar + clipboard.bars, notes: scan.overwritten, total: notes.length };
    const totalAfter = summary.total - summary.notes + clipboard.notes.length;
    const ordered = scan ? scan.ordered : precomputedSummary.ordered === true;
    return { startBar: summary.startBar, endBar: summary.endBar,
      overwritten: summary.notes, inserted: clipboard.notes.length,
      totalAfter, withinLimit: totalAfter <= 8192,
      wouldChange: totalAfter > 8192 || summary.notes !== clipboard.notes.length ||
        !(ordered || sameRange(notes, clipboard, bounds)) };
  }

  function rangePreview(notes, clipboard, startBar, totalBars, precomputedSummary) {
    if (!clipboard || !Array.isArray(clipboard.notes) || clipboard.notes.length > 8192 ||
        !Array.isArray(notes)) return null;
    const bounds = rangeBounds(startBar, clipboard.bars, totalBars);
    if (!bounds || invalidClipboardNotes(clipboard)) return null;
    return previewValidatedRange(notes, clipboard, startBar, bounds, precomputedSummary);
  }

  // Combine selected-range and paste previews so the common 4/8-bar case
  // reuses the paste scan instead of scanning the whole track a second time.
  function rangeEditPreview(notes, startBar, count, totalBars, clipboard) {
    // Reject invalid bar counts and oversized/non-array clipboards before
    // reading any note slots or comparing track fields.
    // Keep the selected-window summary available without changing the song.
    // Check the destination bounds before walking clipboard notes. Near the
    // end of a long score, a 4/8-bar clip may not fit; skip potentially
    // thousands of clipboard reads when paste is impossible.
    const selectedBounds = rangeBounds(startBar, count, totalBars);
    const pasteBounds = clipboard && rangeBounds(startBar, clipboard.bars, totalBars);
    if (clipboard && (!pasteBounds || !Array.isArray(clipboard.notes) ||
        clipboard.notes.length > 8192 || invalidClipboardNotes(clipboard))) {
      return { selectedRange: rangeSummary(notes, startBar, count, totalBars), pasteTarget: null };
    }
    // A copied 4-bar region can be previewed while the editor selects 8 bars
    // (and vice versa). Count both windows in one track scan rather than two.
    if (Array.isArray(notes) && selectedBounds && pasteBounds && clipboard.bars !== count) {
      let selected = 0;
      let overwritten = 0;
      let pasteOrdered = Array.isArray(clipboard.notes);
      for (const note of notes) {
        if (!note || !Number.isInteger(note.step)) continue;
        if (note.step >= selectedBounds.start && note.step < selectedBounds.end) selected++;
        if (note.step >= pasteBounds.start && note.step < pasteBounds.end) {
          if (pasteOrdered && !equivalentNote(note, clipboard.notes[overwritten], pasteBounds.start)) pasteOrdered = false;
          overwritten++;
        }
      }
      const selectedRange = { startBar: startBar + 1, endBar: startBar + count,
        notes: selected, total: notes.length };
      const pasteSummary = { startBar: startBar + 1, endBar: startBar + clipboard.bars,
        notes: overwritten, total: notes.length,
        ordered: pasteOrdered && overwritten === clipboard.notes.length };
      return { selectedRange,
        pasteTarget: previewValidatedRange(notes, clipboard, startBar, pasteBounds, pasteSummary) };
    }
    const pasteTarget = clipboard && Array.isArray(notes) && pasteBounds
      ? previewValidatedRange(notes, clipboard, startBar, pasteBounds) : null;
    const selectedRange = pasteTarget && clipboard.bars === count
      ? { startBar: pasteTarget.startBar, endBar: pasteTarget.endBar,
          notes: pasteTarget.overwritten, total: notes.length }
      : rangeSummary(notes, startBar, count, totalBars);
    return { selectedRange, pasteTarget };
  }

  function clearRange(notes, startBar, count, totalBars) {
    const bounds = rangeBounds(startBar, count, totalBars);
    if (!bounds || !Array.isArray(notes)) return null;
    // Preserve the input array when the range is empty. Once a matching
    // note is found, copy the untouched prefix and stream the remainder
    // instead of rescanning the full track with filter().
    // The "in" check matches Array.filter's sparse/inherited-slot behavior.
    let remaining = null;
    for (let i = 0; i < notes.length; i++) {
      if (!(i in notes)) continue;
      const note = notes[i];
      const selected = note && Number.isInteger(note.step) &&
        note.step >= bounds.start && note.step < bounds.end;
      if (selected && remaining === null) {
        remaining = [];
        for (let j = 0; j < i; j++) {
          if (j in notes) remaining.push(notes[j]);
        }
      } else if (!selected && remaining !== null) {
        remaining.push(note);
      }
    }
    return remaining === null ? notes : remaining;
  }

  // Pure functions exportable to Node tests, no browser dependency.
  const api = { validBars, validIndex, jumpTarget, durationSeconds, durationLabel, rangeBounds, copyRange, pasteRange, clearRange, rangeSummary, rangePreview, rangeEditPreview };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;

  function init() {
    const navigator = document.getElementById('waveBarNavigator');
    if (!navigator || document.getElementById('waveScoreQuickTools')) return;
    const counter = document.getElementById('waveBarCounter');
    const view = document.getElementById('view-studio');
    if (!counter || !view) return;

    const host = document.createElement('div');
    host.id = 'waveScoreQuickTools';
    host.className = 'wave-score-quick';
    host.innerHTML = [
      '<div class="wave-score-quick-row">',
      '  <button type="button" class="secondary" id="waveSkipPrevFour">\u25c0 4\u5c0f\u7bc0</button>',
      '  <button type="button" class="secondary" id="waveSkipNextFour">4\u5c0f\u7bc0 \u25b6</button>',
      '  <button type="button" class="secondary" id="waveSkipPrev">\u25c0 8\u5c0f\u7bc0</button>',
      '  <button type="button" class="secondary" id="waveSkipNext">8\u5c0f\u7bc0 \u25b6</button>',
      '</div>',
      '<div class="wave-score-quick-row">',
      '  <label for="waveBarJump">\u5c0f\u7bc0\u756a\u53f7</label>',
      '  <input id="waveBarJump" type="number" inputmode="numeric" step="1" min="1" max="128" value="1" />',
      '  <button type="button" id="waveBarJumpGo">\u79fb\u52d5</button>',
      '</div>',
      '<div class="wave-score-quick-row" id="waveRangeTools">',
      '  <label for="waveRangeBars">範囲</label>',
      '  <select id="waveRangeBars" aria-label="編集する小節数"><option value="4">4小節</option><option value="8">8小節</option></select>',
      '  <button type="button" class="secondary" id="waveRangeCopy">コピー</button>',
      '  <button type="button" class="secondary" id="waveRangePaste">貼り付け</button>',
      '  <button type="button" class="secondary" id="waveRangeClear">範囲削除</button>',
      '</div>',
      '<div id="waveRangePreview" class="muted" aria-label="範囲編集のプレビュー"></div>',
      '<div id="waveScoreEstimate" class="muted" aria-live="polite"></div>',
      '<div id="waveScoreMessage" class="muted" role="status"></div>'
    ].join('');
    const hint = navigator.querySelector('.wave-bar-hint');
    if (hint) hint.insertAdjacentElement('beforebegin', host);
    else navigator.appendChild(host);

    const previousFour = host.querySelector('#waveSkipPrevFour');
    const nextFour = host.querySelector('#waveSkipNextFour');
    const previous = host.querySelector('#waveSkipPrev');
    const next = host.querySelector('#waveSkipNext');
    const input = host.querySelector('#waveBarJump');
    const go = host.querySelector('#waveBarJumpGo');
    const estimate = host.querySelector('#waveScoreEstimate');
    const message = host.querySelector('#waveScoreMessage');
    const rangeSelect = host.querySelector('#waveRangeBars');
    const rangeCopy = host.querySelector('#waveRangeCopy');
    const rangePaste = host.querySelector('#waveRangePaste');
    const rangeClear = host.querySelector('#waveRangeClear');
    const preview = host.querySelector('#waveRangePreview');
    let rangeClipboard = null;
    let rangeProject = null;
    const project = () => (typeof ensureProject === 'function' ? ensureProject() : null);

    function totals() {
      const p = project();
      return { bars: validBars(p?.bars), bpm: p?.bpm };
    }

    function current() {
      return validIndex(typeof state !== 'undefined' ? state.bar : 0, totals().bars);
    }

    function refresh() {
      if (!host.isConnected) return;
      const { bars, bpm } = totals();
      const index = current();
      if (rangeProject !== project()) { rangeClipboard = null; rangeProject = null; }
      const selectedCount = Number(rangeSelect.value);
      const track = selectedNotes();
      const { selectedRange, pasteTarget } = rangeEditPreview(
        track && track.notes, index, selectedCount, bars, rangeClipboard);
      rangeCopy.disabled = !selectedRange;
      rangeClear.disabled = !selectedRange || selectedRange.notes === 0;
      rangePaste.disabled = !pasteTarget || !pasteTarget.withinLimit || !pasteTarget.wouldChange;
      preview.textContent = selectedRange
        ? selectedRange.startBar + '〜' + selectedRange.endBar + '小節：' + selectedRange.notes + '音符。'
        : 'この位置では選択範囲を編集できません。';
      if (rangeClipboard) {
        if (!pasteTarget) {
          preview.textContent += ' コピー済み' + rangeClipboard.bars + '小節はここに貼り付けできません。';
        } else {
          preview.textContent += ' コピー済み' + rangeClipboard.bars + '小節：既存' +
            pasteTarget.overwritten + '音符を置換し、' + pasteTarget.inserted + '音符を配置。';
          if (!pasteTarget.withinLimit) preview.textContent += ' 音符上限（8192）を超えるため貼り付け不可。';
          else if (!pasteTarget.wouldChange) preview.textContent += ' 変更対象の音符がないため貼り付け不要。';
        }
      }
      input.max = String(bars);
      // Do not overwrite a typed target while the input has focus.
      if (document.activeElement !== input) input.value = String(index + 1);
      previousFour.disabled = index === 0;
      nextFour.disabled = index === bars - 1;
      previous.disabled = index === 0;
      next.disabled = index === bars - 1;
      estimate.textContent = '\u5168' + bars + '\u5c0f\u7bc0 / \u63a8\u5b9a\u518d\u751f\u6642\u9593 ' +
        durationLabel(bars, bpm) + ' \uff08\u97f3\u7b26\u304c\u306a\u3044\u5c0f\u7bc0\u3082\u542b\u3080\uff09';
    }

    function jump(index) {
      const { bars } = totals();
      if (!Number.isInteger(index) || index < 0 || index >= bars) {
        message.textContent = '\u79fb\u52d5\u5148\u306f1\u304b\u3089' + bars + '\u5c0f\u7bc0\u3067\u6307\u5b9a\u3057\u3066\u304f\u3060\u3055\u3044\u3002';
        return;
      }
      message.textContent = '';
      if (typeof state === 'undefined' || typeof renderStudio !== 'function') {
        message.textContent = '\u5c0f\u7bc0\u7de8\u96c6\u753b\u9762\u3092\u958b\u3044\u3066\u304f\u3060\u3055\u3044\u3002';
        return;
      }
      state.bar = index;
      renderStudio();
      refresh();
    }


    function selectedNotes() {
      if (typeof getTrack !== 'function') return null;
      const track = getTrack();
      return track && Array.isArray(track.notes) ? track : null;
    }

    rangeCopy.addEventListener('click', () => {
      const track = selectedNotes();
      const count = Number(rangeSelect.value);
      const clip = track && copyRange(track.notes, current(), count, totals().bars);
      if (!clip) {
        message.textContent = 'この位置では範囲をコピーできません。';
        return;
      }
      rangeClipboard = clip;
      rangeProject = project();
      message.textContent = count + '小節をコピーしました（' + clip.notes.length + '音符）。';
      refresh();
    });

    rangePaste.addEventListener('click', () => {
      const track = selectedNotes();
      const next = track && rangeProject === project() &&
        pasteRange(track.notes, rangeClipboard, current(), totals().bars);
      if (!next || typeof pushUndo !== 'function' ||
          typeof markDirty !== 'function' || typeof renderStudio !== 'function') {
        message.textContent = '貼り付けできません。曲の範囲・コピー元・音符数の上限を確認してください。';
        return;
      }
      if (next === track.notes) {
        message.textContent = '貼り付け先に変更はありません。';
        refresh();
        return;
      }
      pushUndo();
      track.notes = next;
      markDirty();
      renderStudio();
      message.textContent = rangeClipboard.bars + '小節を貼り付けました。元に戻すこともできます。';
      refresh();
    });

    rangeClear.addEventListener('click', () => {
      const track = selectedNotes();
      const count = Number(rangeSelect.value);
      const next = track && clearRange(track.notes, current(), count, totals().bars);
      if (!next || typeof pushUndo !== 'function' ||
          typeof markDirty !== 'function' || typeof renderStudio !== 'function') {
        message.textContent = 'この位置では範囲を削除できません。';
        return;
      }
      if (next === track.notes) {
        message.textContent = '選択範囲に音符はありません。';
        return;
      }
      pushUndo();
      track.notes = next;
      markDirty();
      renderStudio();
      message.textContent = count + '小節の音符を削除しました。元に戻すこともできます。';
      refresh();
    });
    rangeSelect.addEventListener('change', refresh);
    // Track changes may not update the bar counter; refresh on interaction.
    host.addEventListener('focusin', refresh);
    host.addEventListener('pointerenter', refresh);

    previousFour.addEventListener('click', () => jump(jumpTarget(current(), totals().bars, -4)));
    nextFour.addEventListener('click', () => jump(jumpTarget(current(), totals().bars, 4)));
    previous.addEventListener('click', () => jump(jumpTarget(current(), totals().bars, -8)));
    next.addEventListener('click', () => jump(jumpTarget(current(), totals().bars, 8)));
    go.addEventListener('click', () => {
      const numeric = Number(input.value);
      if (!Number.isInteger(numeric)) return jump(NaN);
      jump(numeric - 1);
      input.blur();
    });
    input.addEventListener('keydown', event => {
      if (event.key === 'Enter') {
        event.preventDefault();
        go.click();
      }
    });
    const observer = new MutationObserver(refresh);
    observer.observe(counter, { childList: true, characterData: true, subtree: true });
    const barsInput = document.getElementById('barsInput');
    if (barsInput) barsInput.addEventListener('change', refresh);
    const bpmInput = document.getElementById('bpmInput');
    if (bpmInput) bpmInput.addEventListener('change', refresh);
    const barSelect = document.getElementById('barSelect');
    if (barSelect) barSelect.addEventListener('change', () => queueMicrotask(refresh));
    refresh();
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init, { once: true });
    } else {
      init();
    }
  }
})(typeof globalThis === 'undefined' ? this : globalThis);
