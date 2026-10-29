// WAVE_STUDIO_PRESETS_V033
// UI-only additions: do not alter existing project serialization.
(() => {
  const presets = [
    { id: 'ring10', label: '\u7740\u4fe1\u97f3\u30fb\u7d0410\u79d2', bars: 5, bpm: 120 },
    { id: 'ring30', label: '\u7740\u4fe1\u97f3\u30fb\u7d0430\u79d2', bars: 15, bpm: 120 },
    { id: 'song1', label: '\u697d\u66f2\u30fb\u7d041\u5206', bars: 30, bpm: 120 },
    { id: 'song3', label: '\u697d\u66f2\u30fb\u7d043\u5206', bars: 90, bpm: 120 },
    { id: 'song5', label: '\u697d\u66f2\u30fb\u7d045\u5206', bars: 125, bpm: 100 }
  ];


  // WAVE_BAR_NAVIGATOR_V034: the sequencer edits one bar at a time.
  // Make the entire 1-128 bar score navigable without changing project data.
  function bootBarNavigator() {
    const view = document.getElementById('view-studio');
    const transport = view?.querySelector('.transport');
    const barSelect = document.getElementById('barSelect');
    if (!view || !transport || !barSelect || document.getElementById('waveBarNavigator')) return;

    const host = document.createElement('section');
    host.id = 'waveBarNavigator';
    host.className = 'card wave-bar-navigator';
    host.innerHTML = [
      '<div class="wave-bar-head">',
      ' <strong>\u5c0f\u7bc0\u30ca\u30d3\u30b2\u30fc\u30bf\u30fc</strong>',
      ' <span id="waveBarCounter">1 / 1</span>',
      '</div>',
      '<div class="wave-bar-controls">',
      ' <button type="button" class="secondary" id="waveBarPrev" aria-label="\u524d\u306e\u5c0f\u7bc0">\u25c0</button>',
      ' <input type="range" id="waveBarRange" min="1" max="1" value="1" step="1" aria-label="\u5c0f\u7bc0\u306e\u4f4d\u7f6e">',
      ' <button type="button" class="secondary" id="waveBarNext" aria-label="\u6b21\u306e\u5c0f\u7bc0">\u25b6</button>',
      '</div>',
      '<div class="wave-bar-steps" id="waveBarSteps" aria-label="\u5c0f\u7bc0\u3092\u9078\u629e"></div>',
      '<p class="wave-bar-hint">\u9078\u3093\u3060\u5c0f\u7bc0\u3092\u97f3\u7b26\u30b0\u30ea\u30c3\u30c9\u3067\u7de8\u96c6\u3057\u307e\u3059\u3002\u97f3\u7b26\u306f\u5c0f\u7bc0\u3054\u3068\u306b\u4fdd\u5b58\u3055\u308c\u307e\u3059\u3002</p>'
    ].join('');
    // Put the navigator directly after the template card so it is visible
    // before the transport controls; the existing BAR dropdown still works.
    const templates = document.getElementById('waveTemplatePresets');
    if (templates) templates.insertAdjacentElement('afterend', host);
    else transport.insertAdjacentElement('beforebegin', host);
    const counter = host.querySelector('#waveBarCounter');
    const range = host.querySelector('#waveBarRange');
    const prev = host.querySelector('#waveBarPrev');
    const next = host.querySelector('#waveBarNext');
    const steps = host.querySelector('#waveBarSteps');
    const maxBars = () => {
      const p = typeof ensureProject === 'function' ? ensureProject() : null;
      return Math.max(1, Math.min(128, Math.floor(Number(p?.bars) || 1)));
    };
    const current = () => Math.max(0, Math.min(maxBars() - 1, Math.floor(Number(state.bar) || 0)));
    const jump = target => {
      const index = Math.max(0, Math.min(maxBars() - 1, Math.floor(target)));
      state.bar = index;
      if (typeof renderStudio === 'function') renderStudio();
      render();
    };
    function render() {
      if (!host.isConnected) return;
      const total = maxBars(), index = current();
      counter.textContent = (index + 1) + ' / ' + total + ' \u5c0f\u7bc0';
      range.max = String(total);
      range.value = String(index + 1);
      range.disabled = total <= 1;
      prev.disabled = index <= 0;
      next.disabled = index + 1 >= total;
      // A compact 8-bar window prevents the DOM from growing with a 5-minute score.
      const first = Math.floor(index / 8) * 8;
      steps.replaceChildren();
      for (let i = first; i < Math.min(first + 8, total); i++) {
        const item = document.createElement('button');
        item.type = 'button';
        item.className = i === index ? 'wave-bar-step active' : 'wave-bar-step secondary';
        item.textContent = String(i + 1);
        item.title = '\u5c0f\u7bc0 ' + (i + 1);
        item.setAttribute('aria-pressed', String(i === index));
        item.addEventListener('click', () => jump(i));
        steps.appendChild(item);
      }
    }
    prev.addEventListener('click', () => jump(current() - 1));
    next.addEventListener('click', () => jump(current() + 1));
    range.addEventListener('input', () => {
      counter.textContent = range.value + ' / ' + maxBars() + ' \u5c0f\u7bc0';
    });
    range.addEventListener('change', () => jump(Number(range.value) - 1));
    barSelect.addEventListener('change', () => {
      // BAR is the current editing position, not the total score length.
      // Synchronize even if the core app's listener order changes.
      queueMicrotask(() => {
        const selected = Number(barSelect.value);
        if (Number.isFinite(selected) && selected >= 0 && selected < maxBars()) {
          if (Number(state.bar) !== selected) state.bar = selected;
        }
        render();
      });
    });
    const barsInput = document.getElementById('barsInput');
    if (barsInput) barsInput.addEventListener('change', () => queueMicrotask(render));
    // renderStudio() rebuilds the BAR select whenever the project changes.
    if (typeof MutationObserver === 'function') {
      new MutationObserver(render).observe(barSelect, { childList: true });
    }
    render();
  }

  function bootPresets() {
    const barsInput = document.getElementById('barsInput');
    const transport = document.querySelector('#view-studio .transport');
    if (!barsInput || !transport || document.getElementById('waveTemplatePresets')) return;

    const host = document.createElement('section');
    host.id = 'waveTemplatePresets';
    host.className = 'card wave-template-card';
    const title = document.createElement('div');
    title.className = 'eyebrow';
    title.textContent = '\u5236\u4f5c\u30c6\u30f3\u30d7\u30ec\u30fc\u30c8';
    const controls = document.createElement('div');
    controls.className = 'wave-template-controls';
    const select = document.createElement('select');
    select.setAttribute('aria-label', '\u5236\u4f5c\u30c6\u30f3\u30d7\u30ec\u30fc\u30c8');
    for (const preset of presets) {
      const option = document.createElement('option');
      option.value = preset.id;
      option.textContent = preset.label;
      select.appendChild(option);
    }
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = '\u9069\u7528';
    const info = document.createElement('div');
    info.className = 'wave-template-info muted';
    info.textContent = '\u7a7a\u306e\u65b0\u898f\u30d7\u30ed\u30b8\u30a7\u30af\u30c8\u3067\u4f7f\u3048\u307e\u3059\u3002\u97f3\u7b26\u306f\u81ea\u52d5\u5165\u529b\u3055\u308c\u307e\u305b\u3093\u3002';
    controls.append(select, button);
    host.append(title, controls, info);
    transport.insertAdjacentElement('beforebegin', host);
    // Studio may be rendered before this optional script executes.
    // Mount the navigator immediately rather than relying on a later refresh.
    bootBarNavigator();

    button.addEventListener('click', () => {
      try {
        const p = typeof ensureProject === 'function' ? ensureProject() : null;
        if (!p) return;
        const hasNotes = Array.isArray(p.tracks) &&
          p.tracks.some(track => Array.isArray(track.notes) && track.notes.length > 0);
        if (state.projectId || hasNotes) {
          info.textContent = '\u7de8\u96c6\u4e2d\u306e\u66f2\u3092\u5b88\u308b\u305f\u3081\u9069\u7528\u3057\u307e\u305b\u3093\u3002\u5148\u306b\u300c\u65b0\u898f\u300d\u3092\u62bc\u3057\u3066\u304f\u3060\u3055\u3044\u3002';
          info.classList.add('wave-template-warning');
          return;
        }
        const chosen = presets.find(item => item.id === select.value);
        if (!chosen) return;
        const maxBars = Math.max(1, Number(barsInput.max) || 128);
        if (chosen.bars > maxBars) {
          info.textContent = '\u73fe\u5728\u306e\u8a2d\u5b9a\u3067\u306f\u3053\u306e\u9577\u3055\u3092\u4f7f\u3048\u307e\u305b\u3093\uff08\u6700\u5927' + maxBars + '\u5c0f\u7bc0\uff09\u3002';
          info.classList.add('wave-template-warning');
          return;
        }
        p.bars = chosen.bars;
        p.bpm = chosen.bpm;
        state.bar = 0;
        if (typeof markDirty === 'function') markDirty();
        if (typeof renderStudio === 'function') renderStudio();
        info.classList.remove('wave-template-warning');
        info.textContent = chosen.label + '\uff08' + chosen.bars + '\u5c0f\u7bc0 / BPM ' + chosen.bpm + '\uff09\u3092\u8a2d\u5b9a\u3057\u307e\u3057\u305f\u3002';
      } catch (error) {
        console.error('[WAVE] template initialization failed', error);
        info.textContent = '\u30c6\u30f3\u30d7\u30ec\u30fc\u30c8\u3092\u9069\u7528\u3067\u304d\u307e\u305b\u3093\u3067\u3057\u305f\u3002';
        info.classList.add('wave-template-warning');
      }
    });
  }

  // Add subtle harmonic layers to existing synthetic instruments, without remote
  // samples, copyright-sensitive audio assets, or changes to saved note data.
  function enhanceTimbres() {
    if (typeof scheduleVoice !== 'function') return;
    const original = scheduleVoice;
    if (original.__waveEnhanced) return;

    const profiles = {
      piano: { ratio: 2.002, volume: 0.055, attack: 0.003, release: 0.32 },
      strings: { ratio: 1.998, volume: 0.040, attack: 0.11, release: 0.28 },
      pluck: { ratio: 3.01, volume: 0.035, attack: 0.005, release: 0.16 },
      bass: { ratio: 2.00, volume: 0.045, attack: 0.008, release: 0.15 },
      bells: { ratio: 2.756, volume: 0.030, attack: 0.002, release: 0.58 }
    };
    const enhanced = function(ctx, instrument, pitch, when, duration, velocity) {
      const result = original.apply(this, arguments);
      const profile = profiles[String(instrument || '').toLowerCase()];
      if (!profile || !ctx || typeof ctx.createOscillator !== 'function') return result;
      const midi = Number(pitch), t = Number(when), d = Number(duration);
      if (!Number.isFinite(midi) || !Number.isFinite(t) || !Number.isFinite(d)) return result;
      if (midi < 24 || midi > 108 || d <= 0) return result;
      // A zero-velocity note is intentionally silent. The previous || fallback
      // treated 0 as 0.7 and added an audible harmonic to muted notes.
      const rawVelocity = velocity == null ? 0.7 : Number(velocity);
      const level = Number.isFinite(rawVelocity) ? Math.max(0, Math.min(1, rawVelocity)) : 0.7;
      if (level === 0) return result;

      // Web Audio can fail after one or both nodes have been allocated.
      // Keep references so partial voice construction can be cleaned up.
      let oscillator = null;
      let envelope = null;
      try {
        oscillator = ctx.createOscillator();
        envelope = ctx.createGain();
        const frequency = 440 * Math.pow(2, (midi - 69) / 12);
        oscillator.type = 'sine';
        oscillator.frequency.value = frequency * profile.ratio;
        oscillator.connect(envelope);
        envelope.connect(ctx.destination);
        const vol = level * profile.volume;
        const attackEnd = t + profile.attack;
        const end = Math.min(t + 2.5, t + Math.max(0.06, d) + profile.release);
        envelope.gain.setValueAtTime(0.0001, t);
        envelope.gain.linearRampToValueAtTime(vol, attackEnd);
        envelope.gain.exponentialRampToValueAtTime(0.0001, end);
        oscillator.onended = () => {
          try { oscillator.disconnect(); envelope.disconnect(); } catch (_) {}
        };
        oscillator.start(t);
        oscillator.stop(end + 0.02);
      } catch (error) {
        // A failed start/stop/connection must not retain a partial audio graph.
        try { if (oscillator) oscillator.disconnect(); } catch (_) {}
        try { if (envelope) envelope.disconnect(); } catch (_) {}
        console.warn('[WAVE] harmonic layer unavailable', error);
      }
      return result;
    };
    enhanced.__waveEnhanced = true;
    try { scheduleVoice = enhanced; } catch (_) { /* keep original audio intact */ }
  }

  function init() {
    bootPresets();
    bootBarNavigator();
    enhanceTimbres();
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else init();
})();
