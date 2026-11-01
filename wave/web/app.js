// WAVE_PUBLISH_DIAGNOSTICS_V023
// WAVE_SAFE_DIALOG_V022
const state = {
  bootstrap: null,
  view: 'home',
  tracks: [],
  homeSections: {},
  library: [],
  projects: [],
  playlists: [],
  albums: [],
  albumTracks: [],
  ownReleases: [],
  project: null,
  projectId: null,
  selectedTrack: 0,
  bar: 0,
  octave: 4,
  noteLength: 4,
  noteVelocity: 0.85,
  undoStack: [],
  redoStack: [],
  barClipboard: null,
  playing: false,
  currentTrack: null,
  queue: [],
  queueIndex: -1,
  currentNodes: new Set(),
  streamStartedAt: 0,
  endTimer: null,
  schedulerTimer: null,
  reportTrackId: null,
  dirty: false,
  localDraftTimer: null,
  publishing: false
};

function hasFetchNui() {
  return typeof fetchNui === 'function' || typeof globalThis.fetchNui === 'function';
}

async function phoneFetch(name, data) {
  if (typeof fetchNui === 'function') return await fetchNui(name, data);
  if (typeof globalThis.fetchNui === 'function') return await globalThis.fetchNui(name, data);
  throw new Error('fetchNui unavailable');
}

async function waitForPhoneBridge(timeoutMs = 5000) {
  if (hasFetchNui()) return true;

  const started = performance.now();
  return await new Promise(resolve => {
    let finished = false;

    const finish = value => {
      if (finished) return;
      finished = true;
      window.removeEventListener('message', onMessage);
      resolve(value);
    };

    const onMessage = event => {
      if (event.data === 'componentsLoaded' || hasFetchNui()) {
        if (hasFetchNui()) finish(true);
      }
    };

    window.addEventListener('message', onMessage);

    const poll = () => {
      if (hasFetchNui()) return finish(true);
      if (performance.now() - started >= timeoutMs) return finish(false);
      setTimeout(poll, 50);
    };

    poll();
  });
}

async function bridge(action, payload = {}) {
  const screen=window.WaveScreen,control=action.startsWith('waveScreen');
  if(screen?.parked&&!control&&!(screen.expanded&&action==='bootstrap'))return {ok:false,error:'APP_SUSPENDED'};
  if(screen&&!control)screen.begin();
  try{return await bridgeRequest(action,payload,screen);}finally{if(screen&&!control)screen.end();}
}

async function bridgeRequest(action,payload,screen) {
  const request = { action, payload, surface:screen?.surface||'phone', lease:screen?.lease||'' };

  // The independent fullscreen NUI has no LB Phone fetchNui injection. Waiting
  // for it used most of the client handoff deadline before the first callback.
  // FiveM exposes GetParentResourceName in the top-level NUI document, but
  // the independent WAVE editor runs one same-origin iframe deeper. Its
  // cfx-nui-wave origin is still the registered wave resource callback host.
  const resource = typeof GetParentResourceName === 'function'
    ? GetParentResourceName()
    : location.hostname === 'cfx-nui-wave' ? 'wave' : null;
  if (screen?.expanded && resource) {
    try {
      const response = await fetch('https://' + resource + '/wave:callback', {
        method: 'POST', headers: { 'Content-Type': 'application/json; charset=UTF-8' }, body: JSON.stringify(request)
      });
      return await response.json();
    } catch (error) { return { ok: false, error: 'NUI_FAILED', detail: String(error) }; }
  }

  const ready = await waitForPhoneBridge();
  if (ready && hasFetchNui()) {
    let lastError = null;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        return await Promise.race([
          phoneFetch('wave:callback', request),
          new Promise(resolve => setTimeout(() => resolve({ ok: false, error: 'NUI_TIMEOUT' }), 12000))
        ]);
      } catch (error) {
        lastError = error;
        if (attempt === 0) await new Promise(resolve => setTimeout(resolve, 150));
      }
    }
    if (typeof GetParentResourceName !== 'function') {
      return { ok: false, error: 'NUI_FAILED', detail: String(lastError || '') };
    }
  }

  if (typeof GetParentResourceName === 'function') {
    try {
      const response = await fetch('https://' + GetParentResourceName() + '/wave:callback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=UTF-8' },
        body: JSON.stringify(request)
      });
      return await response.json();
    } catch (error) {
      return { ok: false, error: 'NUI_FAILED', detail: String(error) };
    }
  }

  return { ok: false, error: 'NUI_UNAVAILABLE' };
}

const $ = id => document.getElementById(id);
const money = n => '$' + Number(n || 0).toLocaleString('ja-JP');

const ERROR_TEXT = {
  PLAYER_NOT_READY: 'プレイヤー情報の準備ができていません。',
  NUI_TIMEOUT: '通信がタイムアウトしました。もう一度お試しください。',
  RATE_LIMIT: '操作が早すぎます。少し待ってから再実行してください。',
  ARTIST_REQUIRED: '先にアーティストプロフィールを作成してください。',
  ARTIST_SUSPENDED: 'このアーティストは管理者により停止されています。',
  ARTIST_DELETED: 'このアーティストは削除されています。管理者へ確認してください。',
  WALLET_FROZEN: 'WAVE売上の受取が管理者により停止されています。',
  RIGHTS_CONFIRMATION_REQUIRED: '権利確認が必要です。',
  PROJECT_TOO_LARGE: 'プロジェクトが大きすぎます。',
  TOO_MANY_TRACKS: 'トラック数が上限を超えています。',
  TOO_MANY_NOTES: '1トラックのノート数が上限を超えています。',
  PROJECT_NOTE_LIMIT: '曲全体のノート数が上限を超えています。',
  PROJECT_EMPTY: 'ノートが1つもないため公開できません。',
  PUBLISH_DB_FAILED: '公開データの保存に失敗"しました。もう一度お試しください。',
  INSUFFICIENT_FUNDS: '銀行残高が足りません。',
  NOTHING_TO_WITHDRAW: '出金できる残高がありません。',
  TRACK_NOT_FOUND: '曲が見つからないか、現在利用できません。',
  TRACK_SUSPENDED: 'この曲は管理者により公開停止されています。',
  INVALID_ACTION: 'この操作は現在の状態では実行できません。',
  ARTIST_NOT_FOUND: 'アーティストが見つかりません。',
  OWN_ARTIST: '自分自身のアーティストはフォローできません。',
  PLAYLIST_NAME_REQUIRED: 'プレイリスト名を入力してください。',
  PLAYLIST_NOT_FOUND: 'プレイリストが見つかりません。',
  PLAYLIST_LIMIT: 'プレイリスト作成上限に達しています。',
  PLAYLIST_TRACK_LIMIT: 'このプレイリストは曲数上限に達しています。',
  ALBUM_TITLE_REQUIRED: 'EP/アルバムのタイトルを入力してください。',
  ALBUM_TRACKS_REQUIRED: 'EP/アルバムには2曲以上選んでください。',
  ALBUM_TRACK_LIMIT: 'EP/アルバムの曲数上限を超えています。',
  ALBUM_TRACK_INVALID: '選択した曲の中に利用できない曲があります。',
  ALBUM_NOT_FOUND: 'EP/アルバムが見つかりません。',
  FORBIDDEN: 'この操作を行う権限がありません。'
};
ERROR_TEXT.TRACK_STATE_CHANGED = '\u64cd\u4f5c\u4e2d\u306b\u66f2\u306e\u72b6\u614b\u304c\u5909\u308f\u308a\u307e\u3057\u305f\u3002\u518d\u8aad\u307f\u8fbc\u307f\u3057\u3066\u304a\u8a66\u3057\u304f\u3060\u3055\u3044\u3002';
ERROR_TEXT.PROJECT_ALREADY_RELEASED = '\u3053\u306e\u5236\u4f5c\u30d7\u30ed\u30b8\u30a7\u30af\u30c8\u306f\u3059\u3067\u306b\u30ea\u30ea\u30fc\u30b9\u6e08\u307f\u3067\u3059\u3002\u30d7\u30ed\u30d5\u30a3\u30fc\u30eb\u306e\u300c\u81ea\u5206\u306e\u30ea\u30ea\u30fc\u30b9\u300d\u304b\u3089\u7ba1\u7406\u3057\u3066\u304f\u3060\u3055\u3044\u3002';
ERROR_TEXT.PUBLISH_IN_PROGRESS = '\u3053\u306e\u66f2\u306f\u73fe\u5728\u516c\u958b\u51e6\u7406\u4e2d\u3067\u3059\u3002';
ERROR_TEXT.PROJECT_NOT_SAVED = '\u516c\u958b\u524d\u306b\u30d7\u30ed\u30b8\u30a7\u30af\u30c8\u3092\u4fdd\u5b58\u3057\u3066\u304f\u3060\u3055\u3044\u3002';

function errorText(code) {
  return ERROR_TEXT[code] || String(code || 'UNKNOWN_ERROR');
}

function status(text, bad = false) {
  const el = $('status');
  el.textContent = text || '';
  el.style.background = bad ? 'rgba(251,113,133,.14)' : 'rgba(14,165,233,.12)';
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[c]));
}

function showView(name) {
  state.view = name;
  document.querySelectorAll('.view').forEach(v => v.classList.toggle('active', v.id === 'view-' + name));
  document.querySelectorAll('.bottom-nav button').forEach(b => b.classList.toggle('active', b.dataset.view === name));
  if (name === 'library') loadLibrary();
  if (name === 'profile') { renderProfile(); loadOwnReleases(); loadOwnAlbums(); }
  if (name === 'admin') loadAdmin();
}

document.querySelectorAll('.bottom-nav button').forEach(b => b.addEventListener('click', () => showView(b.dataset.view)));
$('heroStudio').onclick = () => showView('studio');
$('adminButton').onclick = () => showView('admin');

function waveDialog(message, defaultValue = '', inputMode = false) {
  return new Promise(resolve => {
    let dialog = $('waveSafeDialog');
    if (!dialog) {
      dialog = document.createElement('dialog');
      dialog.id = 'waveSafeDialog';
      dialog.innerHTML = `<form method="dialog"><div class="eyebrow">WAVE</div><h3 id="waveSafeDialogTitle"></h3><input id="waveSafeDialogInput" maxlength="400"><div class="dialog-actions"><button type="button" id="waveSafeDialogOk">OK</button><button type="button" id="waveSafeDialogCancel" class="secondary">キャンセル</button></div></form>`;
      document.body.appendChild(dialog);
    }
    const title = $('waveSafeDialogTitle');
    const input = $('waveSafeDialogInput');
    const ok = $('waveSafeDialogOk');
    const cancel = $('waveSafeDialogCancel');
    title.textContent = message || '';
    input.hidden = !inputMode;
    input.value = inputMode ? String(defaultValue ?? '') : '';
    let finished = false;
    const finish = value => {
      if (finished) return;
      finished = true;
      dialog.removeEventListener('cancel', onCancel);
      if (dialog.open) dialog.close();
      resolve(value);
    };
    const onCancel = event => {
      event.preventDefault();
      finish(inputMode ? null : false);
    };
    dialog.addEventListener('cancel', onCancel);
    ok.onclick = () => finish(inputMode ? input.value : true);
    cancel.onclick = () => finish(inputMode ? null : false);
    if (!dialog.open) dialog.showModal();
    if (inputMode) setTimeout(() => { input.focus(); input.select(); }, 0);
  });
}

const waveConfirm = message => waveDialog(message, '', false);
const wavePrompt = (message, value = '') => waveDialog(message, value, true);

$('projectTitleInput').addEventListener('input', event => {
  const p = ensureProject();
  const title = String(event.currentTarget.value || '').slice(0, 80);
  if (p.title !== title) {
    p.title = title;
    markDirty();
  }
});
$('projectTitleInput').addEventListener('blur', event => {
  const p = ensureProject();
  const title = String(event.currentTarget.value || '').trim().slice(0, 80) || 'Untitled';
  p.title = title;
  event.currentTarget.value = title;
  if (!$('releaseTitle').value.trim()) $('releaseTitle').value = title === 'Untitled' ? '' : title;
});

function blankProject() {
  return {
    version: 1,
    title: 'Untitled',
    bpm: 120,
    bars: 4,
    tracks: Array.from({ length: 8 }, (_, i) => ({
      id: i + 1,
      name: ['LEAD', 'CHORD', 'BASS', 'DRUMS', 'PAD', 'PLUCK', 'BELL', 'FX'][i],
      instrument: ['saw', 'triangle', 'bass', 'drums', 'sine', 'pluck', 'bell', 'square'][i],
      volume: 0.75,
      pan: 0,
      muted: false,
      notes: []
    }))
  };
}

function ensureProject() {
  if (!state.project) state.project = blankProject();
  return state.project;
}

function projectSnapshot() {
  return JSON.parse(JSON.stringify(ensureProject()));
}

function pushUndo() {
  state.undoStack.push(projectSnapshot());
  if (state.undoStack.length > 40) state.undoStack.shift();
  state.redoStack = [];
  updateHistoryButtons();
}

function updateHistoryButtons() {
  $('undoProject').disabled = state.undoStack.length === 0;
  $('redoProject').disabled = state.redoStack.length === 0;
}

function restoreSnapshot(snapshot) {
  if (!snapshot) return;
  state.project = JSON.parse(JSON.stringify(snapshot));
  if (state.selectedTrack >= state.project.tracks.length) state.selectedTrack = 0;
  if (state.bar >= state.project.bars) state.bar = Math.max(0, state.project.bars - 1);
  markDirty();
  renderStudio();
}

function markDirty() {
  state.dirty = true;
  if (state.localDraftTimer) clearTimeout(state.localDraftTimer);
  state.localDraftTimer = setTimeout(saveLocalDraft, 350);
}

function saveLocalDraft() {
  try {
    localStorage.setItem('waveDraftV1', JSON.stringify({ projectId: state.projectId, project: ensureProject(), savedAt: Date.now() }));
  } catch (_) {}
}

function restoreLocalDraft() {
  try {
    const raw = localStorage.getItem('waveDraftV1');
    if (!raw) return false;
    const draft = JSON.parse(raw);
    if (!draft?.project || !Array.isArray(draft.project.tracks)) return false;
    state.project = draft.project;
    state.projectId = Number(draft.projectId) || null;
    state.dirty = true;
    return true;
  } catch (_) {
    return false;
  }
}

function pitchRows() {
  const track = getTrack();
  if (track?.instrument === 'drums') {
    return [
      { pitch: 60, label: 'KICK' },
      { pitch: 64, label: 'SNARE' },
      { pitch: 67, label: 'HAT' },
      { pitch: 69, label: 'CLAP' }
    ];
  }
  const base = 12 * (Number(state.octave || 4) + 1);
  return Array.from({ length: 12 }, (_, i) => {
    const pitch = base + 11 - i;
    return { pitch, label: midiName(pitch) };
  });
}

function midiName(m) {
  const names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  return names[m % 12] + (Math.floor(m / 12) - 1);
}

function getTrack() {
  const project = ensureProject();
  if (!project.tracks[state.selectedTrack]) state.selectedTrack = 0;
  return project.tracks[state.selectedTrack];
}

function trackHas(track, step, pitch) {
  return (track.notes || []).some(n => n.step === step && n.pitch === pitch);
}

function toggleNote(step, pitch) {
  pushUndo();
  const track = getTrack();
  const notes = track.notes || (track.notes = []);
  const i = notes.findIndex(n => n.step === step && n.pitch === pitch);
  if (i >= 0) notes.splice(i, 1);
  else notes.push({ step, pitch, length: Number(state.noteLength) || 1, velocity: Number(state.noteVelocity) || 0.85 });
  markDirty();
  renderGrid();
}

function renderStudio() {
  const p = ensureProject();
  const maxBars = Number(state.bootstrap?.config?.limits?.maxBars || 128);
  p.bars = Math.max(1, Math.min(maxBars, Number(p.bars) || 4));
  if (state.bar >= p.bars) state.bar = p.bars - 1;
  $('bpmInput').value = p.bpm;
  $('octaveSelect').value = String(state.octave);
  $('barsInput').max = String(maxBars);
  $('barsInput').value = p.bars;
  $('projectTitleInput').value = p.title || 'Untitled';
  $('barSelect').innerHTML = '';
  for (let i = 0; i < p.bars; i++) {
    const option = document.createElement('option');
    option.value = i;
    option.textContent = String(i + 1);
    if (i === state.bar) option.selected = true;
    $('barSelect').appendChild(option);
  }
  $('trackList').innerHTML = '';
  p.tracks.forEach((t, i) => {
    const button = document.createElement('button');
    button.className = 'track-button' + (i === state.selectedTrack ? ' active' : '');
    button.textContent = (i + 1) + ' ' + t.name + (t.muted ? ' · M' : '');
    button.onclick = () => { state.selectedTrack = i; renderStudio(); };
    $('trackList').appendChild(button);
  });
  const track = getTrack();
  $('trackName').value = track.name || '';
  $('instrumentSelect').value = track.instrument || 'sine';
  $('trackVolume').value = Number(track.volume ?? 0.75);
  $('trackPan').value = Number(track.pan || 0);
  $('trackMute').checked = track.muted === true;
  $('trackSolo').checked = track.solo === true;
  $('noteLength').value = String(state.noteLength);
  $('noteVelocity').value = Number(state.noteVelocity);
  updateHistoryButtons();
  renderGrid();
}

function renderGrid() {
  const grid = $('pianoGrid');
  grid.innerHTML = '';
  const start = state.bar * 16;
  pitchRows().forEach(row => {
    const label = document.createElement('div');
    label.className = 'pitch-label';
    label.textContent = row.label;
    grid.appendChild(label);
    for (let s = 0; s < 16; s++) {
      const cell = document.createElement('button');
      cell.className = 'step-cell' + (trackHas(getTrack(), start + s, row.pitch) ? ' on' : '');
      cell.title = 'step ' + (s + 1);
      cell.onclick = () => toggleNote(start + s, row.pitch);
      grid.appendChild(cell);
    }
  });
}

$('barSelect').onchange = e => { state.bar = Number(e.target.value); renderGrid(); };
$('octaveSelect').onchange = e => { state.octave = Number(e.target.value) || 4; renderGrid(); };
$('bpmInput').onchange = e => {
  ensureProject().bpm = Math.max(60, Math.min(200, Number(e.target.value) || 120));
  markDirty();
};
$('barsInput').onchange = e => {
  const maxBars = Number(state.bootstrap?.config?.limits?.maxBars || 128);
  const bars = Math.max(1, Math.min(maxBars, Number(e.target.value) || 4));
  const p = ensureProject();
  p.bars = bars;
  const maxStep = bars * 16;
  p.tracks.forEach(t => { t.notes = (t.notes || []).filter(n => Number(n.step) < maxStep); });
  if (state.bar >= bars) state.bar = bars - 1;
  markDirty();
  renderStudio();
};
$('trackName').onchange = e => { getTrack().name = e.target.value.trim() || getTrack().name || 'TRACK'; markDirty(); renderStudio(); };
$('instrumentSelect').onchange = e => { getTrack().instrument = e.target.value; markDirty(); renderStudio(); };
$('trackVolume').oninput = e => { getTrack().volume = Number(e.target.value); markDirty(); };
$('trackPan').oninput = e => { getTrack().pan = Number(e.target.value); markDirty(); };
$('trackMute').onchange = e => { getTrack().muted = e.target.checked; markDirty(); renderStudio(); };
$('trackSolo').onchange = e => { getTrack().solo = e.target.checked; markDirty(); renderStudio(); };
$('noteLength').onchange = e => { state.noteLength = Number(e.target.value) || 1; };
$('noteVelocity').oninput = e => { state.noteVelocity = Number(e.target.value) || 0.85; };
$('undoProject').onclick = () => {
  if (!state.undoStack.length) return;
  state.redoStack.push(projectSnapshot());
  restoreSnapshot(state.undoStack.pop());
  updateHistoryButtons();
};
$('redoProject').onclick = () => {
  if (!state.redoStack.length) return;
  state.undoStack.push(projectSnapshot());
  restoreSnapshot(state.redoStack.pop());
  updateHistoryButtons();
};
$('copyBar').onclick = () => {
  const start = state.bar * 16;
  state.barClipboard = (getTrack().notes || []).filter(n => n.step >= start && n.step < start + 16).map(n => ({
    step: n.step - start, pitch: n.pitch, length: n.length, velocity: n.velocity
  }));
  status(`小節をコピーしました（${state.barClipboard.length}ノート）`);
};
$('pasteBar').onclick = () => {
  if (!state.barClipboard) return status('先に小節をコピーしてください', true);
  pushUndo();
  const track = getTrack();
  const start = state.bar * 16;
  track.notes = (track.notes || []).filter(n => n.step < start || n.step >= start + 16);
  state.barClipboard.forEach(n => track.notes.push({ step: start + n.step, pitch: n.pitch, length: n.length, velocity: n.velocity }));
  markDirty(); renderGrid(); status('小節を貼り付けました');
};
$('clearBar').onclick = () => {
  const track = getTrack();
  const start = state.bar * 16;
  if (!(track.notes || []).some(n => n.step >= start && n.step < start + 16)) return;
  pushUndo();
  track.notes = track.notes.filter(n => n.step < start || n.step >= start + 16);
  markDirty(); renderGrid();
};
$('clearTrack').onclick = async () => {
  if (!await waveConfirm('選択中のトラックのノートをすべて消しますか？')) return;
  pushUndo();
  getTrack().notes = [];
  markDirty();
  renderGrid();
};
$('newProject').onclick = async () => {
  if (state.dirty && !await waveConfirm('未保存の変更があります。新しいプロジェクトを作りますか？')) return;
  stopAudio();
  state.project = blankProject();
  state.projectId = null;
  state.selectedTrack = 0;
  state.bar = 0;
  state.dirty = false;
  state.undoStack = []; state.redoStack = []; state.barClipboard = null;
  localStorage.removeItem('waveDraftV1');
  $('releaseTitle').value = '';
  renderStudio();
  status('新しいプロジェクトを作成しました');
};

let ctx = null;
function audio() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function freq(m) {
  return 440 * Math.pow(2, (m - 69) / 12);
}

function keepAudioNode(node) {
  state.currentNodes.add(node);
  node.addEventListener?.('ended', () => state.currentNodes.delete(node), { once: true });
  return node;
}

function scheduleDrum(c, pitch, time, volume) {
  if (pitch <= 62) {
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(140, time);
    o.frequency.exponentialRampToValueAtTime(45, time + 0.12);
    g.gain.setValueAtTime(volume * 0.35, time);
    g.gain.exponentialRampToValueAtTime(0.0001, time + 0.16);
    o.connect(g); g.connect(c.destination); o.start(time); o.stop(time + 0.18);
    keepAudioNode(o);
  } else {
    const hitLength = pitch >= 69 ? 0.16 : pitch >= 67 ? 0.05 : 0.12;
    const level = pitch >= 67 && pitch < 69 ? 0.11 : pitch >= 69 ? 0.16 : 0.2;
    const length = Math.floor(c.sampleRate * hitLength);
    const buffer = c.createBuffer(1, length, c.sampleRate);
    const d = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const source = c.createBufferSource();
    const gain = c.createGain();
    source.buffer = buffer;
    gain.gain.value = volume * level;
    source.connect(gain); gain.connect(c.destination); source.start(time);
    keepAudioNode(source);
  }
}

function scheduleVoice(c, inst, pitch, time, duration, volume = 0.7, pan = 0) {
  if (inst === 'drums') { scheduleDrum(c, pitch, time, volume); return; }
  const gain = c.createGain();
  const panner = c.createStereoPanner ? c.createStereoPanner() : null;
  const attack = inst === 'strings' ? 0.08 : 0.01;
  gain.gain.setValueAtTime(0.0001, time);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.02, volume * 0.22), time + attack);
  const decay = (inst === 'pluck' || inst === 'bell') ? 0.18 : inst === 'piano' ? Math.max(0.3, duration * 0.9) : Math.max(0.08, duration * 0.85);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + decay);
  let type = 'sine';
  if (inst === 'saw' || inst === 'strings') type = 'sawtooth';
  if (inst === 'triangle' || inst === 'piano') type = 'triangle';
  if (inst === 'square' || inst === 'bass' || inst === 'pluck') type = 'square';
  const oscillator = c.createOscillator();
  oscillator.type = type;
  oscillator.frequency.value = freq(inst === 'bass' ? pitch - 12 : pitch);
  oscillator.connect(gain);
  if (panner) { gain.connect(panner); panner.pan.value = pan; panner.connect(c.destination); }
  else gain.connect(c.destination);
  oscillator.start(time); oscillator.stop(time + Math.max(decay + 0.03, duration));
  keepAudioNode(oscillator);
  if (inst === 'bell') {
    const o2 = c.createOscillator();
    const g2 = c.createGain();
    o2.type = 'sine'; o2.frequency.value = freq(pitch) * 2.01;
    g2.gain.setValueAtTime(0.0001, time);
    g2.gain.exponentialRampToValueAtTime(volume * 0.08, time + 0.01);
    g2.gain.exponentialRampToValueAtTime(0.0001, time + 0.32);
    o2.connect(g2);
    if (panner) g2.connect(panner); else g2.connect(c.destination);
    o2.start(time); o2.stop(time + 0.38);
    keepAudioNode(o2);
  }
}

function stopAudio(recordStream = true) {
  if (state.endTimer) { clearTimeout(state.endTimer); state.endTimer = null; }
  if (state.schedulerTimer) { clearInterval(state.schedulerTimer); state.schedulerTimer = null; }
  state.currentNodes.forEach(n => { try { n.stop(); } catch (_) {} });
  state.currentNodes.clear();
  state.playing = false;
  $('playProject').textContent = '▶ 再生';
  $('miniPlay').textContent = '▶';
  if (recordStream && state.currentTrack && state.streamStartedAt) {
    const seconds = Math.floor((Date.now() - state.streamStartedAt) / 1000);
    if (seconds > 0) bridge('recordStream', { trackId: state.currentTrack.id, validSeconds: seconds });
  }
  state.streamStartedAt = 0;
}

function scheduleMetronome(c, time, accent) {
  const oscillator = c.createOscillator();
  const gain = c.createGain();
  oscillator.type = 'square';
  oscillator.frequency.value = accent ? 1100 : 780;
  gain.gain.setValueAtTime(accent ? 0.08 : 0.045, time);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.035);
  oscillator.connect(gain); gain.connect(c.destination);
  oscillator.start(time); oscillator.stop(time + 0.04);
  keepAudioNode(oscillator);
}

function scheduleProject(project, onEnd) {
  const c = audio();
  const bpm = Number(project.bpm) || 120;
  const stepDur = 60 / bpm / 4;
  const totalSteps = (Number(project.bars) || 4) * 16;
  const totalDuration = totalSteps * stepDur;
  const start = c.currentTime + 0.05;
  state.playing = true;
  const studioPlayback = !state.currentTrack;
  const hasSolo = studioPlayback && (project.tracks || []).some(t => t.solo === true);
  const events = [];
  (project.tracks || []).forEach(t => {
    if (t.muted || (hasSolo && !t.solo)) return;
    (t.notes || []).forEach(n => {
      const step = Number(n.step);
      if (!Number.isFinite(step) || step < 0 || step >= totalSteps) return;
      events.push({
        at: step * stepDur,
        instrument: t.instrument || 'sine',
        pitch: Number(n.pitch) || 60,
        duration: Math.max(0.05, (Number(n.length) || 1) * stepDur),
        volume: Number(t.volume ?? 0.75) * Number(n.velocity ?? 0.85),
        pan: Number(t.pan || 0)
      });
    });
  });
  events.sort((a, b) => a.at - b.at);
  let eventIndex = 0;
  let metroStep = 0;
  const metronome = studioPlayback && $('metronomeToggle')?.checked;
  const lookAhead = 0.45;

  const pump = () => {
    const horizon = c.currentTime + lookAhead;
    while (eventIndex < events.length && start + events[eventIndex].at <= horizon) {
      const e = events[eventIndex++];
      scheduleVoice(c, e.instrument, e.pitch, start + e.at, e.duration, e.volume, e.pan);
    }
    if (metronome) {
      while (metroStep < totalSteps && start + metroStep * stepDur <= horizon) {
        scheduleMetronome(c, start + metroStep * stepDur, metroStep % 16 === 0);
        metroStep += 4;
      }
    }
  };

  pump();
  state.schedulerTimer = setInterval(pump, 100);
  state.endTimer = setTimeout(() => {
    state.endTimer = null;
    if (state.schedulerTimer) { clearInterval(state.schedulerTimer); state.schedulerTimer = null; }
    stopAudio(true);
    if (onEnd) onEnd();
  }, Math.ceil(totalDuration * 1000) + 180);
}

$('playProject').onclick = () => {
  if (state.playing) return stopAudio();
  stopAudio();
  state.currentTrack = null;
  scheduleProject(ensureProject());
  $('playProject').textContent = '❚❚ 停止';
};
$('stopProject').onclick = () => stopAudio();

$('saveProject').onclick = async () => {
  const p = ensureProject();
  const title = String($('projectTitleInput').value || p.title || 'Untitled').trim().slice(0, 80) || 'Untitled';
  p.title = title;
  $('projectTitleInput').value = title;
  if (!$('releaseTitle').value.trim() && title !== 'Untitled') $('releaseTitle').value = title;
  status('保存中…');
  const r = await bridge('saveProject', { id: state.projectId, title, project: p });
  if (r.ok) {
    state.projectId = r.id;
    state.dirty = false;
    saveLocalDraft();
    renderStudio();
    status('保存しました');
  } else status('保存失敗: ' + errorText(r.error), true);
};

function setPublishFeedback(text = '', bad = false) {
  let el = $('publishFeedback');
  if (!el) {
    el = document.createElement('div');
    el.id = 'publishFeedback';
    el.className = 'publish-feedback muted';
    $('publishTrack').insertAdjacentElement('afterend', el);
  }
  el.textContent = text;
  el.classList.toggle('bad', bad);
}

function syncReleasePriceUi() {
  const paid = $('accessMode').value === 'purchase' || $('accessMode').value === 'both';
  $('releasePrice').disabled = !paid;
  $('releasePrice').classList.toggle('hidden', !paid);
  $('releasePrice').title = paid ? '販売価格' : '無料公開では価格は使用しません';
}
$('accessMode').addEventListener('change', syncReleasePriceUi);
syncReleasePriceUi();

async function saveProjectForPublish() {
  const p = ensureProject();
  const title = String($('projectTitleInput').value || p.title || 'Untitled').trim().slice(0, 80) || 'Untitled';
  p.title = title;
  $('projectTitleInput').value = title;

  if (state.projectId && !state.dirty) return { ok: true, id: state.projectId };

  setPublishFeedback('公開前にプロジェクトを保存しています…');
  const saved = await bridge('saveProject', { id: state.projectId, title, project: p });
  if (!saved?.ok) return saved || { ok: false, error: 'EMPTY_RESPONSE' };

  state.projectId = saved.id;
  state.dirty = false;
  saveLocalDraft();
  renderStudio();
  return saved;
}

$('publishTrack').onclick = async () => {
  if (state.publishing) return;
  const button = $('publishTrack');
  const originalText = button.textContent;
  setPublishFeedback('');

  if (!$('rightsConfirm').checked) {
    setPublishFeedback('権利確認にチェックしてください。', true);
    return status('権利確認にチェックしてください', true);
  }
  if (!state.bootstrap?.artist || state.bootstrap.artist.status !== 'active') {
    setPublishFeedback('公開可能なアーティストプロフィールが必要です。', true);
    return status('公開可能なアーティストプロフィールが必要です', true);
  }

  const title = $('releaseTitle').value.trim();
  if (!title) {
    setPublishFeedback('曲名を入力してください。', true);
    return status('曲名を入力してください', true);
  }

  state.publishing = true;
  button.disabled = true;
  button.textContent = '公開中…';

  try {
    const saved = await saveProjectForPublish();
    if (!saved?.ok) {
      const code = saved?.error || 'UNKNOWN_ERROR';
      const message = errorText(code);
      setPublishFeedback('保存失敗: ' + message + ' [' + code + ']', true);
      return status('公開前の保存に失敗しました: ' + message, true);
    }

    const p = ensureProject();
    setPublishFeedback('WAVEへ公開処理を送信しています…');
    status('公開中…');

    const requestId = 'pub-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
    const r = await bridge('publishTrack', {
      requestId,
      projectId: state.projectId,
      title,
      description: $('releaseDescription').value,
      genre: $('releaseGenre').value,
      accessMode: $('accessMode').value,
      price: Number($('releasePrice').value) || 0,
      rightsConfirmed: true,
      rights: {
        personal: true,
        ringtone: $('rightRingtone').checked,
        notification: $('rightNotification').checked,
        storeBgm: $('rightStore').checked,
        event: $('rightEvent').checked,
        remix: $('rightRemix').checked
      },
      project: p
    });

    if (r?.ok) {
      $('rightsConfirm').checked = false;
      setPublishFeedback('公開しました。HOMEの新着へ反映しました。');
      status('公開しました');
      await refreshHome();
      await loadLibrary();
      await loadOwnReleases();
    } else {
      const code = r?.error || 'UNKNOWN_ERROR';
      const message = errorText(code);
      setPublishFeedback('公開失敗: ' + message + ' [' + code + ']', true);
      status('公開失敗: ' + message, true);
    }
  } catch (error) {
    const detail = String(error?.message || error || 'UNKNOWN_ERROR');
    setPublishFeedback('公開処理でエラーが発生しました: ' + detail, true);
    status('公開処理エラー', true);
    console.error('[WAVE] publishTrack failed', error);
  } finally {
    state.publishing = false;
    button.disabled = false;
    button.textContent = originalText;
  }
};

function renderTrackList(el, tracks) {
  el.innerHTML = '';
  if (!tracks?.length) { el.innerHTML = '<div class="muted">まだ曲がありません。</div>'; return; }
  tracks.forEach((t, trackIndex) => {
    const row = document.createElement('div');
    row.className = 'track';
    const preview = t.preview ? '<span class="preview-badge">試聴</span>' : '';
    const access = t.owned ? '<span class="access-badge">購入済み</span>' : '';
    row.innerHTML = `<div class="cover">W</div><div class="track-meta clickable"><strong>${escapeHtml(t.title)} ${preview} ${access}</strong><span>${escapeHtml(t.artist_name || 'Unknown')} · ${escapeHtml(t.genre || '')}</span></div><div class="track-actions"><button data-play>▶</button><button data-more class="secondary">⋯</button></div>`;
    row.querySelector('[data-play]').onclick = () => playTrack(t, tracks, trackIndex);
    row.querySelector('[data-more]').onclick = () => openTrack(t);
    row.querySelector('.track-meta').onclick = () => t.artist_id && openArtist(t.artist_id);
    el.appendChild(row);
  });
}

function renderHomeSections(sections = {}) {
  const map = [
    ['homeRecentSection', 'homeRecentTracks', sections.recent || []],
    ['homeFollowingSection', 'homeFollowingTracks', sections.following || []],
    ['homeTrendingSection', 'homeTrendingTracks', sections.trending || []]
  ];
  map.forEach(([sectionId, listId, tracks]) => {
    $(sectionId).classList.toggle('hidden', !tracks.length);
    if (tracks.length) renderTrackList($(listId), tracks);
  });
  renderTrackList($('homeTracks'), sections.newest || state.tracks || []);
}

function renderArtistResults(artists = []) {
  $('searchArtistSection').classList.toggle('hidden', !artists.length);
  $('searchArtists').innerHTML = '';
  artists.forEach(a => {
    const button = document.createElement('button');
    button.className = 'artist-result';
    button.innerHTML = `<div class="artist-avatar">W</div><strong>${escapeHtml(a.artist_name)}</strong><span>${Number(a.track_count || 0)}曲 · ${Number(a.follower_count || 0)}フォロワー</span>`;
    button.onclick = () => openArtist(a.id);
    $('searchArtists').appendChild(button);
  });
}

async function refreshHome() {
  const r = await bridge('listHome');
  if (r.ok) {
    state.tracks = r.tracks || [];
    state.homeSections = r.sections || { newest: state.tracks };
    renderHomeSections(state.homeSections);
    status('');
  } else status('読み込み失敗: ' + errorText(r.error), true);
}
$('refreshHome').onclick = refreshHome;

$('searchButton').onclick = async () => {
  status('検索中…');
  const r = await bridge('search', { q: $('searchInput').value });
  if (r.ok) {
    renderArtistResults(r.artists || []);
    renderTrackList($('searchTracks'), r.tracks || []);
    status('');
  } else status('検索失敗: ' + errorText(r.error), true);
};
$('searchInput').addEventListener('keydown', e => { if (e.key === 'Enter') $('searchButton').click(); });

async function loadLibrary() {
  const r = await bridge('listLibrary');
  if (!r.ok) return status('ライブラリ取得失敗: ' + errorText(r.error), true);
  state.library = r.tracks || [];
  state.projects = r.projects || [];
  state.playlists = r.playlists || [];
  renderTrackList($('libraryTracks'), state.library);
  renderProjects();
  renderPlaylists();
}
$('refreshLibrary').onclick = loadLibrary;

function renderProjects() {
  const el = $('projectStrip');
  el.innerHTML = '';
  if (!state.projects.length) { el.innerHTML = '<div class="muted">保存プロジェクトはまだありません。</div>'; return; }
  state.projects.forEach(p => {
    const button = document.createElement('button');
    button.className = 'project-chip';
    button.innerHTML = `<strong>${escapeHtml(p.title)}</strong><span>${escapeHtml(p.updated_at || '')}</span><span class="project-delete" title="削除">×</span>`;
    button.onclick = () => openProject(p.id);
    button.querySelector('.project-delete').onclick = async event => {
      event.stopPropagation();
      if (!await waveConfirm('このプロジェクトを削除しますか？')) return;
      const r = await bridge('deleteProject', { id: p.id });
      if (r.ok) { status('プロジェクトを削除しました'); loadLibrary(); }
      else status('削除失敗: ' + errorText(r.error), true);
    };
    el.appendChild(button);
  });
}

function renderPlaylists() {
  const el = $('playlistStrip');
  el.innerHTML = '';
  if (!state.playlists.length) {
    el.innerHTML = '<div class="muted">プレイリストはまだありません。</div>';
    return;
  }
  state.playlists.forEach(p => {
    const button = document.createElement('button');
    button.className = 'playlist-chip';
    button.innerHTML = `<strong>${escapeHtml(p.name)}</strong><span>${Number(p.track_count || 0)}曲</span>`;
    button.onclick = () => openPlaylist(p.id);
    el.appendChild(button);
  });
}

$('createPlaylistButton').onclick = async () => {
  const name = $('playlistNameInput').value.trim();
  if (!name) return status('プレイリスト名を入力してください', true);
  const r = await bridge('savePlaylist', { name, description: '', isPublic: false });
  if (!r.ok) return status('プレイリスト作成失敗: ' + errorText(r.error), true);
  state.playlists = r.playlists || [];
  $('playlistNameInput').value = '';
  renderPlaylists();
  status('プレイリストを作成しました');
};

async function openPlaylist(id) {
  const r = await bridge('getPlaylist', { playlistId: id });
  if (!r.ok) return status('プレイリスト取得失敗: ' + errorText(r.error), true);
  const p = r.playlist;
  const tracks = r.tracks || [];
  $('dialogPlaylist').innerHTML = `<div class="eyebrow">PLAYLIST</div><h2>${escapeHtml(p.name)}</h2><p class="muted">${escapeHtml(p.description || '')}</p><div class="dialog-actions"><button type="button" id="playlistPlayAll">▶ 全曲再生</button><button type="button" id="playlistRename" class="secondary">編集</button><button type="button" id="playlistDelete" class="danger">削除</button></div><div id="playlistDialogTracks"></div>`;
  const list = $('playlistDialogTracks');
  if (!tracks.length) list.innerHTML = '<div class="muted">まだ曲がありません。</div>';
  tracks.forEach((t, playlistIndex) => {
    const row = document.createElement('div');
    row.className = 'playlist-track';
    row.innerHTML = `<div><strong>${escapeHtml(t.title)}</strong><span>${escapeHtml(t.artist_name || '')}</span></div><div><button data-play>▶</button><button data-remove class="secondary">×</button></div>`;
    row.querySelector('[data-play]').onclick = () => playTrack(t, tracks, playlistIndex);
    row.querySelector('[data-remove]').onclick = async () => {
      const rr = await bridge('removePlaylistTrack', { playlistId: p.id, trackId: t.id });
      if (rr.ok) openPlaylist(p.id); else status('削除失敗: ' + errorText(rr.error), true);
    };
    list.appendChild(row);
  });
  $('playlistPlayAll').disabled = !tracks.length;
  $('playlistPlayAll').onclick = () => { if (tracks.length) playTrack(tracks[0], tracks, 0); };
  $('playlistRename').onclick = async () => {
    const name = await wavePrompt('プレイリスト名', p.name);
    if (name === null) return;
    const description = await wavePrompt('説明', p.description || '');
    if (description === null) return;
    const rr = await bridge('savePlaylist', { id: p.id, name, description, isPublic: p.is_public === true });
    if (rr.ok) {
      state.playlists = rr.playlists || [];
      renderPlaylists();
      openPlaylist(p.id);
    } else status('更新失敗: ' + errorText(rr.error), true);
  };
  $('playlistDelete').onclick = async () => {
    if (!await waveConfirm('このプレイリストを削除しますか？')) return;
    const rr = await bridge('deletePlaylist', { playlistId: p.id });
    if (rr.ok) {
      state.playlists = rr.playlists || [];
      renderPlaylists();
      $('playlistDialog').close();
      status('プレイリストを削除しました');
    } else status('削除失敗: ' + errorText(rr.error), true);
  };
  if (!$('playlistDialog').open) $('playlistDialog').showModal();
}

async function openArtist(artistId) {
  const r = await bridge('artistDetail', { artistId });
  if (!r.ok) return status('アーティスト取得失敗: ' + errorText(r.error), true);
  const a = r.artist;
  $('dialogArtist').innerHTML = `<div class="artist-avatar">W</div><div class="eyebrow">ARTIST</div><h2>${escapeHtml(a.artist_name)}</h2><p>${escapeHtml(a.bio || '')}</p><div class="artist-stats"><span>${Number(a.track_count || 0)}曲</span><span>${Number(a.follower_count || 0)}フォロワー</span></div><div class="dialog-actions"><button type="button" id="artistFollow" class="${a.following ? 'secondary' : ''}">${a.following ? 'フォロー中' : 'フォローする'}</button></div><div id="artistAlbums" class="album-list"></div><div id="artistDialogTracks" class="track-list"></div>`;
  const albumList = $('artistAlbums');
  (r.albums || []).forEach(album => {
    const button = document.createElement('button');
    button.className = 'album-public-chip';
    button.innerHTML = `<strong>${escapeHtml(album.title)}</strong><span>${escapeHtml((album.release_type || 'album').toUpperCase())} · ${Number(album.track_count || 0)}曲</span>`;
    button.onclick = () => { $('artistDialog').close(); openAlbum(album.id); };
    albumList.appendChild(button);
  });
  renderTrackList($('artistDialogTracks'), r.tracks || []);
  if (a.is_owner) { $('artistFollow').textContent = 'あなたのアーティスト'; $('artistFollow').disabled = true; }
  $('artistFollow').onclick = async () => {
    if (a.is_owner) return;
    const rr = await bridge('toggleFollow', { artistId: a.id });
    if (!rr.ok) return status('フォロー操作失敗: ' + errorText(rr.error), true);
    a.following = rr.following;
    await refreshHome();
    openArtist(a.id);
  };
  if (!$('artistDialog').open) $('artistDialog').showModal();
}

async function loadOwnAlbums() {
  const artist = state.bootstrap?.artist;
  if (!artist || artist.status !== 'active') {
    state.albums = [];
    state.albumTracks = [];
    renderAlbumManager();
    return;
  }
  const r = await bridge('listOwnAlbums');
  if (!r.ok) return status('EP/アルバム取得失敗: ' + errorText(r.error), true);
  state.albums = r.albums || [];
  state.albumTracks = r.tracks || [];
  renderAlbumManager();
}

function renderAlbumManager() {
  const active = state.bootstrap?.artist?.status === 'active';
  $('albumTitle').disabled = !active;
  $('albumType').disabled = !active;
  $('albumDescription').disabled = !active;
  $('createAlbumButton').disabled = !active;
  $('refreshAlbums').disabled = !active;
  const choices = $('albumTrackChoices');
  choices.innerHTML = '';
  if (!active) {
    choices.innerHTML = '<div class="muted">アーティストプロフィールを作成するとEP/アルバムを公開できます。</div>';
  } else if (!state.albumTracks.length) {
    choices.innerHTML = '<div class="muted">先に2曲以上リリースしてください。</div>';
  } else {
    state.albumTracks.forEach(t => {
      const label = document.createElement('label');
      label.className = 'album-choice';
      label.innerHTML = `<input type="checkbox" value="${Number(t.id)}"><span>${escapeHtml(t.title)} · ${escapeHtml(t.genre || '')}</span>`;
      choices.appendChild(label);
    });
  }
  const own = $('ownAlbums');
  own.innerHTML = '';
  if (!state.albums.length) own.innerHTML = '<div class="muted">まだEP/アルバムはありません。</div>';
  state.albums.forEach(a => {
    const button = document.createElement('button');
    button.className = 'album-chip';
    button.innerHTML = `<strong>${escapeHtml(a.title)}</strong><span>${escapeHtml((a.release_type || 'album').toUpperCase())} · ${Number(a.track_count || 0)}曲</span><span class="project-delete" title="削除">×</span>`;
    button.onclick = () => openAlbum(a.id);
    button.querySelector('.project-delete').onclick = async event => {
      event.stopPropagation();
      if (!await waveConfirm('このEP/アルバムを削除しますか？ 楽曲自体は削除されません。')) return;
      const r = await bridge('deleteAlbum', { albumId: a.id });
      if (r.ok) { state.albums = r.albums || []; renderAlbumManager(); status('EP/アルバムを削除しました'); }
      else status('削除失敗: ' + errorText(r.error), true);
    };
    own.appendChild(button);
  });
}

$('refreshAlbums').onclick = loadOwnAlbums;
$('createAlbumButton').onclick = async () => {
  const title = $('albumTitle').value.trim();
  const trackIds = [...$('albumTrackChoices').querySelectorAll('input[type="checkbox"]:checked')].map(x => Number(x.value));
  if (!title) return status('EP/アルバムのタイトルを入力してください', true);
  if (trackIds.length < 2) return status('2曲以上選んでください', true);
  const r = await bridge('saveAlbum', {
    title,
    description: $('albumDescription').value,
    releaseType: $('albumType').value,
    trackIds
  });
  if (!r.ok) return status('公開失敗: ' + errorText(r.error), true);
  state.albums = r.albums || [];
  $('albumTitle').value = '';
  $('albumDescription').value = '';
  $('albumTrackChoices').querySelectorAll('input[type="checkbox"]').forEach(x => { x.checked = false; });
  renderAlbumManager();
  status('EP/アルバムを公開しました');
};

async function openAlbum(albumId) {
  const r = await bridge('albumDetail', { albumId });
  if (!r.ok) return status('EP/アルバム取得失敗: ' + errorText(r.error), true);
  const a = r.album;
  $('dialogAlbum').innerHTML = `<div class="cover" style="width:5rem;height:5rem;margin-bottom:.7rem">W</div><div class="eyebrow">${escapeHtml((a.release_type || 'album').toUpperCase())}</div><h2>${escapeHtml(a.title)}</h2><button type="button" id="albumArtist" class="text-button">${escapeHtml(a.artist_name || '')}</button><p class="muted">${escapeHtml(a.description || '')}</p><div id="albumDialogTracks" class="track-list"></div>`;
  const albumTracks = r.tracks || [];
  $('dialogAlbum').insertAdjacentHTML('beforeend', `<div class="dialog-actions"><button type="button" id="albumPlayAll">▶ 全曲再生</button></div>`);
  renderTrackList($('albumDialogTracks'), albumTracks);
  $('albumPlayAll').disabled = !albumTracks.length;
  $('albumPlayAll').onclick = () => { if (albumTracks.length) playTrack(albumTracks[0], albumTracks, 0); };
  $('albumArtist').onclick = () => { $('albumDialog').close(); openArtist(a.artist_id); };
  if (!$('albumDialog').open) $('albumDialog').showModal();
}

async function openProject(id) {
  if (state.dirty && !await waveConfirm('現在の未保存変更を破棄して読み込みますか？')) return;
  const r = await bridge('getProject', { id });
  if (!r.ok) return status('プロジェクト読込失敗: ' + errorText(r.error), true);
  state.project = r.project.data;
  state.project.title = r.project.title;
  state.projectId = r.project.id;
  state.selectedTrack = 0;
  state.bar = 0;
  state.dirty = false;
  state.undoStack = []; state.redoStack = []; state.barClipboard = null;
  saveLocalDraft();
  renderStudio();
  showView('studio');
  status('プロジェクトを読み込みました');
}

function playTrack(t, queue = null, queueIndex = null) {
  stopAudio(true);
  if (Array.isArray(queue) && queue.length) {
    state.queue = queue;
    state.queueIndex = Number.isInteger(queueIndex) ? queueIndex : Math.max(0, queue.findIndex(x => Number(x.id) === Number(t.id)));
  } else if (!state.queue.length || !state.queue.some(x => Number(x.id) === Number(t.id))) {
    state.queue = [t];
    state.queueIndex = 0;
  } else if (queueIndex === null) {
    const found = state.queue.findIndex(x => Number(x.id) === Number(t.id));
    if (found >= 0) state.queueIndex = found;
  }
  state.currentTrack = t;
  state.streamStartedAt = Date.now();
  scheduleProject(t.project || blankProject(), () => {
    if (state.queue.length > 1) playQueueStep(1, false);
  });
  $('miniPlayer').classList.remove('hidden');
  $('miniTitle').textContent = t.title;
  $('miniArtist').textContent = (t.artist_name || '') + (t.preview ? ' · 試聴' : '');
  $('miniPlay').textContent = '■';
  $('miniFavorite').textContent = t.favorite ? '♥' : '♡';
}

function playQueueStep(direction, wrap = true) {
  if (!state.queue.length) return;
  let next = state.queueIndex + direction;
  if (wrap) next = (next + state.queue.length) % state.queue.length;
  if (next < 0 || next >= state.queue.length) return;
  state.queueIndex = next;
  playTrack(state.queue[next], state.queue, next);
}

$('miniPrev').onclick = () => playQueueStep(-1, true);
$('miniNext').onclick = () => playQueueStep(1, true);
$('miniPlay').onclick = () => {
  if (state.playing) { stopAudio(); $('miniPlay').textContent = '▶'; }
  else if (state.currentTrack) playTrack(state.currentTrack, state.queue, state.queueIndex);
};
$('miniFavorite').onclick = async () => {
  if (!state.currentTrack) return;
  const r = await bridge('toggleFavorite', { trackId: state.currentTrack.id });
  if (r.ok) {
    state.currentTrack.favorite = r.favorite;
    $('miniFavorite').textContent = r.favorite ? '♥' : '♡';
  }
};
$('miniMore').onclick = () => state.currentTrack && openTrack(state.currentTrack);

function openTrack(t) {
  state.currentTrack = t;
  const owned = t.owned || t.is_owner;
  const buy = (t.access_mode === 'purchase' || t.access_mode === 'both') && !owned;
  const rights = t.rights || {};
  const accessText = t.access_mode === 'free' ? '無料' : money(t.price);
  const previewText = t.preview ? `<p class="muted">未購入のため最大${Number(state.bootstrap?.config?.subscription?.previewSeconds || 30)}秒の試聴です。</p>` : '';
  const playlistOptions = state.playlists.map(p => `<option value="${Number(p.id)}">${escapeHtml(p.name)}</option>`).join('');
  const playlistUi = state.playlists.length ? `<div class="playlist-add-row"><select id="dlgPlaylist">${playlistOptions}</select><button type="button" id="dlgAddPlaylist" class="secondary">追加</button></div>` : '<p class="muted">ライブラリでプレイリストを作ると、この曲を追加できます。</p>';
  $('dialogTrack').innerHTML = `<div class="cover" style="width:5rem;height:5rem;margin-bottom:.7rem">W</div><h2>${escapeHtml(t.title)}</h2><button type="button" id="dlgArtist" class="text-button">${escapeHtml(t.artist_name || '')}</button><p class="muted">${escapeHtml(t.description || '')}</p><p>${accessText}</p>${previewText}<div class="dialog-actions"><button type="button" id="dlgPlay">▶ 再生</button>${buy ? '<button type="button" id="dlgBuy">購入 ' + money(t.price) + '</button>' : ''}<button type="button" id="dlgFav" class="secondary">${t.favorite ? '♥ お気に入り済み' : '♡ お気に入り'}</button><button type="button" id="dlgReport" class="secondary">通報</button></div>${playlistUi}${rights.ringtone ? '<p class="muted">着信音利用可（LB Phone実連携は次段階）</p>' : ''}`;
  if (!$('trackDialog').open) $('trackDialog').showModal();
  $('dlgPlay').onclick = () => { playTrack(t); $('trackDialog').close(); };
  $('dlgArtist').onclick = () => { $('trackDialog').close(); if (t.artist_id) openArtist(t.artist_id); };
  if ($('dlgBuy')) $('dlgBuy').onclick = async () => {
    const r = await bridge('purchaseTrack', { trackId: t.id });
    if (r.ok) {
      status(r.alreadyOwned ? '購入済みです' : '購入しました');
      $('trackDialog').close();
      await loadLibrary();
      await refreshHome();
    } else status('購入失敗: ' + errorText(r.error), true);
  };
  $('dlgFav').onclick = async () => {
    const r = await bridge('toggleFavorite', { trackId: t.id });
    if (r.ok) { t.favorite = r.favorite; openTrack(t); }
  };
  if ($('dlgAddPlaylist')) $('dlgAddPlaylist').onclick = async () => {
    const playlistId = Number($('dlgPlaylist').value);
    const r = await bridge('addPlaylistTrack', { playlistId, trackId: t.id });
    if (r.ok) {
      status('プレイリストに追加しました');
      await loadLibrary();
      openTrack(t);
    } else status('追加失敗: ' + errorText(r.error), true);
  };
  $('dlgReport').onclick = () => { state.reportTrackId = t.id; $('trackDialog').close(); $('reportDialog').showModal(); };
}

$('sendReport').onclick = async () => {
  const r = await bridge('reportTrack', { trackId: state.reportTrackId, category: $('reportCategory').value, details: $('reportDetails').value });
  if (r.ok) {
    $('reportDialog').close();
    $('reportDetails').value = '';
    status(r.alreadyReported ? 'この曲はすでに通報済みです' : '通報を送信しました');
  } else status('通報失敗: ' + errorText(r.error), true);
};

async function loadOwnReleases() {
  const r = await bridge('listOwnTracks');
  if (!r?.ok) {
    $('ownReleases').innerHTML = '<div class="muted">リリース情報を取得できませんでした。</div>';
    return;
  }
  state.ownReleases = (r.tracks || []).filter(track => track.status !== 'deleted');
  renderOwnReleases();
}

function renderOwnReleases() {
  const el = $('ownReleases');
  el.innerHTML = '';
  if (!state.bootstrap?.artist) {
    el.innerHTML = '<div class="muted">アーティストプロフィール作成後に利用できます。</div>';
    return;
  }
  if (!state.ownReleases.length) {
    el.innerHTML = '<div class="muted">公開した曲はまだありません。</div>';
    return;
  }
  state.ownReleases.forEach(track => {
    const row = document.createElement('div');
    row.className = 'release-manager-row';
    const statusLabel = track.status === 'public' ? '公開中' : track.status === 'private' ? '非公開' : track.status === 'suspended' ? '管理停止' : '削除済み';
    const canRestore = track.status === 'private' && state.bootstrap?.artist?.status === 'active';
    const canUnpublish = track.status === 'public';
    row.innerHTML = `<div><strong>${escapeHtml(track.title)}</strong><span>${escapeHtml(track.genre || '')} · ${escapeHtml(statusLabel)} · ${money(track.price || 0)}</span></div><div class="release-manager-actions"></div>`;
    const actions = row.querySelector('.release-manager-actions');
    if (canUnpublish) {
      const b = document.createElement('button');
      b.className = 'secondary';
      b.textContent = '非公開';
      b.onclick = () => updateOwnRelease(track.id, 'unpublish', row, b);
      actions.appendChild(b);
    }
    if (canRestore) {
      const b = document.createElement('button');
      b.textContent = '再公開';
      b.onclick = () => updateOwnRelease(track.id, 'publish', row, b);
      actions.appendChild(b);
    }
    if (track.status !== 'deleted' && track.status !== 'suspended') {
      const b = document.createElement('button');
      b.className = 'danger';
      b.textContent = '削除';
      b.onclick = async () => {
        if (!await waveConfirm('この曲を削除しますか？ 購入履歴や取引履歴は保持されます。')) return;
        await updateOwnRelease(track.id, 'delete', row, b);
      };
      actions.appendChild(b);
    }
    el.appendChild(row);
  });
}

// WAVE_RELEASE_ACTION_FEEDBACK_V031
function ownReleaseFeedback(row, message, bad = false) {
  if (!row) return;
  let el = row.querySelector('.release-action-feedback');
  if (!el) {
    el = document.createElement('div');
    el.className = 'release-action-feedback';
    el.setAttribute('role', 'status');
    el.style.gridColumn = '1 / -1';
    el.style.fontSize = '.7rem';
    el.style.padding = '.4rem .55rem';
    el.style.borderRadius = '.45rem';
    row.appendChild(el);
  }
  el.style.color = bad ? '#fecdd3' : '#bae6fd';
  el.style.background = bad ? 'rgba(251,113,133,.12)' : 'rgba(34,211,238,.1)';
  el.textContent = message;
}

async function updateOwnRelease(trackId, action, row, button) {
  const labels = { publish: '再公開', unpublish: '非公開', delete: '削除' };
  const title = labels[action] || '更新';
  if (row?.dataset.busy === 'true') return;
  if (row) row.dataset.busy = 'true';
  const controls = row ? [...row.querySelectorAll('button')] : [];
  controls.forEach(control => { control.disabled = true; });
  if (button) button.textContent = title + '中…';
  ownReleaseFeedback(row, title + '処理中…');
  try {
    const r = await bridge('updateOwnTrack', { trackId, action });
    if (!r?.ok) {
      const code = String(r?.error || 'UNKNOWN_ERROR');
      const message = '更新失敗: ' + errorText(code) + ' [' + code + ']';
      ownReleaseFeedback(row, message, true);
      status(message, true);
      return;
    }
    const message = action === 'delete' ? '曲を削除しました' : action === 'publish' ? '曲を再公開しました' : '曲を非公開にしました';
    ownReleaseFeedback(row, message);
    status(message);
    // The published list is server-authoritative. A refresh also updates HOME and the library.
    const results = await Promise.allSettled([loadOwnReleases(), refreshHome(), loadLibrary()]);
    if (results.some(result => result.status === 'rejected')) {
      status(message + '（一覧の更新に失敗しました。更新を押してください）', true);
    }
  } catch (error) {
    const detail = String(error?.message || error || 'UNKNOWN_ERROR');
    ownReleaseFeedback(row, '通信エラー: ' + detail, true);
    status('リリース更新の通信エラー: ' + detail, true);
    console.error('[WAVE] updateOwnTrack failed:', { action, trackId, error });
  } finally {
    if (row) delete row.dataset.busy;
    controls.forEach(control => { control.disabled = false; });
    if (button) button.textContent = title;
  }
}
$('refreshOwnReleases').onclick = loadOwnReleases;

function renderProfile() {
  const a = state.bootstrap?.artist;
  const w = state.bootstrap?.wallet || {};
  $('artistCard').classList.toggle('hidden', !a);
  if (a) {
    $('artistCard').innerHTML = `<div class="eyebrow">ARTIST</div><h2>${escapeHtml(a.artist_name)}</h2><p>${escapeHtml(a.bio || '')}</p><p class="muted">状態: ${escapeHtml(a.status || 'active')} · 公開画面には制作者名を表示しません。</p>`;
    $('artistName').value = a.artist_name || '';
    $('artistBio').value = a.bio || '';
    $('artistEditorTitle').textContent = 'プロフィール編集';
  } else {
    $('artistName').value = '';
    $('artistBio').value = '';
    $('artistEditorTitle').textContent = 'アーティストプロフィール作成';
  }
  const editable = !a || a.status === 'active';
  $('artistName').disabled = !editable;
  $('artistBio').disabled = !editable;
  $('createArtist').disabled = !editable;
  $('walletBalance').textContent = money(w.balance);
  const min = Number(state.bootstrap?.config?.economy?.minimumWithdraw || 0);
  $('walletStats').textContent = `累計収益 ${money(w.lifetime_earned)} · 最低出金 ${money(min)}${Number(w.frozen || 0) === 1 ? ' · 出金停止中' : ''}`;
  $('withdrawButton').disabled = Number(w.frozen || 0) === 1;
}

$('createArtist').onclick = async () => {
  const r = await bridge('createArtist', { artistName: $('artistName').value, bio: $('artistBio').value });
  if (r.ok) {
    state.bootstrap.artist = r.artist;
    status('アーティストプロフィールを保存しました');
    renderProfile();
    loadOwnReleases();
    loadOwnAlbums();
  } else status('保存失敗: ' + errorText(r.error), true);
};

$('withdrawButton').onclick = async () => {
  const r = await bridge('withdraw');
  if (r.ok) {
    state.bootstrap.wallet = r.wallet;
    renderProfile();
    status(money(r.amount) + ' を銀行へ振り込みました');
  } else status('出金失敗: ' + errorText(r.error), true);
};

async function loadAdmin() {
  if (!state.bootstrap?.canAdmin) return showView('home');
  const r = await bridge('adminOverview');
  if (!r.ok) return status('管理画面取得失敗: ' + errorText(r.error), true);
  $('platformWallet').innerHTML = `<div class="eyebrow">WEAZEL PLATFORM BALANCE</div><div class="wallet-balance">${money(r.platformWallet.balance)}</div><div class="muted">累計 ${money(r.platformWallet.lifetime_earned)} · 会社口座への出金接続は会社口座仕様確認後</div>`;

  $('adminArtists').innerHTML = '';
  (r.artists || []).forEach(a => {
    const d = document.createElement('div');
    d.className = 'admin-row';
    d.innerHTML = `<strong>${escapeHtml(a.artist_name)}</strong><div>制作者: ${escapeHtml(a.creator_name)}</div><div class="muted">citizenid: ${escapeHtml(a.citizenid)} · ${escapeHtml(a.status)} · 曲 ${Number(a.track_count || 0)} · 残高 ${money(a.balance)} · ${Number(a.frozen || 0) === 1 ? '出金停止' : '出金可'}</div><div class="admin-actions"><button data-s class="danger">停止</button><button data-r class="ok">復元</button><button data-f class="secondary">出金停止</button><button data-u class="secondary">出金解除</button><button data-d class="secondary">削除</button></div>`;
    d.querySelector('[data-s]').onclick = () => adminArtistAction(a.id, 'suspend');
    d.querySelector('[data-r]').onclick = () => adminArtistAction(a.id, 'restore');
    d.querySelector('[data-f]').onclick = () => adminArtistAction(a.id, 'freeze');
    d.querySelector('[data-u]').onclick = () => adminArtistAction(a.id, 'unfreeze');
    d.querySelector('[data-d]').onclick = () => adminArtistAction(a.id, 'delete');
    $('adminArtists').appendChild(d);
  });

  $('adminTracks').innerHTML = '';
  (r.tracks || []).forEach(t => {
    const d = document.createElement('div');
    d.className = 'admin-row';
    d.innerHTML = `<strong>${escapeHtml(t.title)}</strong><div>${escapeHtml(t.artist_name)} / 制作者: ${escapeHtml(t.creator_name)}</div><div class="muted">citizenid: ${escapeHtml(t.creator_citizenid)} · ${escapeHtml(t.status)} · ${money(t.price)}</div><div class="admin-actions"><button data-s class="danger">公開停止</button><button data-r class="ok">復元</button><button data-d class="secondary">削除</button></div>`;
    d.querySelector('[data-s]').onclick = () => adminTrackAction(t.id, 'suspend');
    d.querySelector('[data-r]').onclick = () => adminTrackAction(t.id, 'restore');
    d.querySelector('[data-d]').onclick = () => adminTrackAction(t.id, 'delete');
    $('adminTracks').appendChild(d);
  });

  $('adminReports').innerHTML = '';
  (r.reports || []).forEach(x => {
    const d = document.createElement('div');
    d.className = 'admin-row';
    d.innerHTML = `<strong>#${x.id} ${escapeHtml(x.title)}</strong><div>${escapeHtml(x.category)} · ${escapeHtml(x.details)}</div><div class="muted">${escapeHtml(x.artist_name)} / 制作者: ${escapeHtml(x.creator_name)} / ${escapeHtml(x.creator_citizenid)}</div><div class="admin-actions"><button data-r class="ok">対応済み</button><button data-d class="secondary">却下</button></div>`;
    d.querySelector('[data-r]').onclick = () => adminReportAction(x.id, 'resolve');
    d.querySelector('[data-d]').onclick = () => adminReportAction(x.id, 'dismiss');
    $('adminReports').appendChild(d);
  });

  $('adminLogs').innerHTML = '';
  (r.logs || []).forEach(x => {
    const d = document.createElement('div');
    d.className = 'admin-row admin-log';
    d.innerHTML = `<strong>${escapeHtml(x.action)}</strong><div>${escapeHtml(x.admin_name)} → ${escapeHtml(x.target_type)} #${escapeHtml(x.target_id)}</div><div class="muted">${escapeHtml(x.reason || '')} · ${escapeHtml(x.created_at || '')}</div>`;
    $('adminLogs').appendChild(d);
  });
}

async function adminReason(defaultText = '') {
  return await wavePrompt('管理理由（監査ログに保存）', defaultText);
}

async function adminTrackAction(trackId, action) {
  const reason = await adminReason(); if (reason === null) return;
  const r = await bridge('adminTrackAction', { trackId, action, reason });
  if (r.ok) { status('管理操作を実行しました'); loadAdmin(); }
  else status('管理操作失敗: ' + errorText(r.error), true);
}

async function adminArtistAction(artistId, action) {
  const reason = await adminReason(); if (reason === null) return;
  const r = await bridge('adminArtistAction', { artistId, action, reason });
  if (r.ok) { status('アーティスト管理操作を実行しました'); loadAdmin(); }
  else status('管理操作失敗: ' + errorText(r.error), true);
}

async function adminReportAction(reportId, action) {
  const reason = await adminReason(action === 'resolve' ? '対応済み' : '却下'); if (reason === null) return;
  const r = await bridge('adminReportAction', { reportId, action, reason });
  if (r.ok) { status('通報を処理しました'); loadAdmin(); }
  else status('通報処理失敗: ' + errorText(r.error), true);
}
$('adminRefresh').onclick = loadAdmin;

async function boot() {
  status('WAVEを起動しています…');
  const r = await bridge('bootstrap');
  if (!r.ok) { status('起動失敗: ' + errorText(r.error), true); return false; }
  state.bootstrap = r;
  state.tracks = r.home || [];
  state.homeSections = r.homeSections || { newest: state.tracks };
  state.playlists = r.playlists || [];
  const restored = restoreLocalDraft();
  if (!restored) state.project = blankProject();
  $('releasePrice').value = r.config?.economy?.defaultTrackPrice || 5000;
  if (!r.config?.subscription?.enabled) {
    [...$('accessMode').options].forEach(o => { if (o.value === 'both' || o.value === 'subscription') o.disabled = true; });
    if ($('accessMode').value === 'both' || $('accessMode').value === 'subscription') $('accessMode').value = 'free';
  }
  syncReleasePriceUi();
  $('adminButton').classList.toggle('hidden', !r.canAdmin);
  renderHomeSections(state.homeSections);
  renderPlaylists();
  renderStudio();
  renderProfile();
  status(restored ? '端末内の未保存下書きを復元しました' : '');
  return true;
}

window.addEventListener('beforeunload', () => {
  if (state.dirty) saveLocalDraft();
  stopAudio(true);
});

window.WaveBoot=boot;
if(!window.WaveScreen?.expanded)window.WaveBootPromise=boot();
