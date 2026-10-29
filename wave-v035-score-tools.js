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

  // Compare the target's actual note data, not just its note count.
  // A self-paste or identical destination must not dirty the project.
  function sameRange(notes, clipboard, bounds) {
    let seen = 0;
    for (const note of notes) {
      if (!note || !Number.isInteger(note.step) ||
          note.step < bounds.start || note.step >= bounds.end) continue;
      const copied = clipboard.notes[seen++];
      if (!copied) return false;
      const keys = Object.keys(note);
      if (keys.length !== Object.keys(copied).length) return false;
      for (const key of keys) {
        if (!Object.prototype.hasOwnProperty.call(copied, key) ||
            (key === 'step' ? note.step - bounds.start !== copied.step :
              !Object.is(note[key], copied[key]))) return false;
      }
    }
    return seen === clipboard.notes.length;
  }

  function pasteRange(notes, clipboard, startBar, totalBars) {
    if (!clipboard || !Array.isArray(clipboard.notes) || clipboard.notes.length > 8192 ||
        !Array.isArray(notes)) return null;
    const bounds = rangeBounds(startBar, clipboard.bars, totalBars);
    if (!bounds || clipboard.notes.some(n => !n || !Number.isInteger(n.step) ||
        n.step < 0 || n.step >= clipboard.bars * 16)) return null;
    // Count overwritten notes without allocating a replacement array. This
    // keeps rejected and identical pastes allocation-free on long scores.
    let overwritten = 0;
    for (const note of notes) {
      if (note && Number.isInteger(note.step) &&
          note.step >= bounds.start && note.step < bounds.end) overwritten++;
    }
    // Preserve the existing 8192-note cap, including malformed legacy notes.
    if (notes.length - overwritten + clipboard.notes.length > 8192) return null;
    // The UI uses unchanged array identity to avoid redundant Undo/dirty flags.
    if (sameRange(notes, clipboard, bounds)) return notes;
    const remaining = notes.filter(n => !n || !Number.isInteger(n.step) ||
      n.step < bounds.start || n.step >= bounds.end);
    return remaining.concat(clipboard.notes.map(n => ({ ...n, step: bounds.start + n.step })));
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

  function rangePreview(notes, clipboard, startBar, totalBars) {
    if (!clipboard || !Array.isArray(clipboard.notes) || clipboard.notes.length > 8192) return null;
    const summary = rangeSummary(notes, startBar, clipboard.bars, totalBars);
    if (!summary || clipboard.notes.some(n => !n || !Number.isInteger(n.step) ||
        n.step < 0 || n.step >= clipboard.bars * 16)) return null;
    const totalAfter = summary.total - summary.notes + clipboard.notes.length;
    return { startBar: summary.startBar, endBar: summary.endBar,
      overwritten: summary.notes, inserted: clipboard.notes.length,
      totalAfter, withinLimit: totalAfter <= 8192,
      wouldChange: !sameRange(notes, clipboard, rangeBounds(startBar, clipboard.bars, totalBars)) };
  }

  function clearRange(notes, startBar, count, totalBars) {
    const bounds = rangeBounds(startBar, count, totalBars);
    if (!bounds || !Array.isArray(notes)) return null;
    // Empty windows are common in long scores: preserve array identity and
    // avoid allocating a replacement array when nothing will be deleted.
    const hasNotes = notes.some(n => n && Number.isInteger(n.step) &&
      n.step >= bounds.start && n.step < bounds.end);
    if (!hasNotes) return notes;
    return notes.filter(n => !n || !Number.isInteger(n.step) ||
      n.step < bounds.start || n.step >= bounds.end);
  }

  // Pure functions exportable to Node tests, no browser dependency.
  const api = { validBars, validIndex, jumpTarget, durationSeconds, durationLabel, rangeBounds, copyRange, pasteRange, clearRange, rangeSummary, rangePreview };
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
      const selectedRange = track && rangeSummary(track.notes, index, selectedCount, bars);
      const pasteTarget = track && rangeClipboard &&
        rangePreview(track.notes, rangeClipboard, index, bars);
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
