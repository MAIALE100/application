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

      try {
        const oscillator = ctx.createOscillator();
        const envelope = ctx.createGain();
        const frequency = 440 * Math.pow(2, (midi - 69) / 12);
        oscillator.type = 'sine';
        oscillator.frequency.value = frequency * profile.ratio;
        oscillator.connect(envelope);
        envelope.connect(ctx.destination);
        const vol = Math.max(0.0001, Math.min(1, Number(velocity) || 0.7)) * profile.volume;
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
        console.warn('[WAVE] harmonic layer unavailable', error);
      }
      return result;
    };
    enhanced.__waveEnhanced = true;
    try { scheduleVoice = enhanced; } catch (_) { /* keep original audio intact */ }
  }

  function init() {
    bootPresets();
    enhanceTimbres();
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else init();
})();
