// WAVE_LONG_SCORE_TOOLS_V035
// Navigation only: never mutate notes, project data or saved releases.
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

  function durationSeconds(bars, bpm) {
    const tempo = Number(bpm);
    const safeTempo = Number.isFinite(tempo) && tempo >= 60 && tempo <= 200 ? tempo : 120;
    return Math.round(validBars(bars) * 4 * 60 / safeTempo);
  }

  function durationLabel(bars, bpm) {
    const seconds = durationSeconds(bars, bpm);
    return Math.floor(seconds / 60) + ':' + String(seconds % 60).padStart(2, '0');
  }

  // Pure functions exportable to Node tests, no browser dependency.
  const api = { validBars, validIndex, durationSeconds, durationLabel };
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
      '  <button type="button" class="secondary" id="waveSkipPrev">\u25c0 8\u5c0f\u7bc0</button>',
      '  <button type="button" class="secondary" id="waveSkipNext">8\u5c0f\u7bc0 \u25b6</button>',
      '</div>',
      '<div class="wave-score-quick-row">',
      '  <label for="waveBarJump">\u5c0f\u7bc0\u756a\u53f7</label>',
      '  <input id="waveBarJump" type="number" inputmode="numeric" step="1" min="1" max="128" value="1" />',
      '  <button type="button" id="waveBarJumpGo">\u79fb\u52d5</button>',
      '</div>',
      '<div id="waveScoreEstimate" class="muted" aria-live="polite"></div>',
      '<div id="waveScoreMessage" class="muted" role="status"></div>'
    ].join('');
    const hint = navigator.querySelector('.wave-bar-hint');
    if (hint) hint.insertAdjacentElement('beforebegin', host);
    else navigator.appendChild(host);

    const previous = host.querySelector('#waveSkipPrev');
    const next = host.querySelector('#waveSkipNext');
    const input = host.querySelector('#waveBarJump');
    const go = host.querySelector('#waveBarJumpGo');
    const estimate = host.querySelector('#waveScoreEstimate');
    const message = host.querySelector('#waveScoreMessage');
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
      input.max = String(bars);
      // Do not overwrite a typed target while the input has focus.
      if (document.activeElement !== input) input.value = String(index + 1);
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

    previous.addEventListener('click', () => jump(Math.max(0, current() - 8)));
    next.addEventListener('click', () => jump(Math.min(totals().bars - 1, current() + 8)));
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
