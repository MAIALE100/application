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
  // Current visible beat (0-based). Stored notes remain 16 steps per bar.
  waveViewBeat: null,
  playStartBar: 0,
  playBar: null,
  octave: 4,
  octaveRows: null,
  keyGuide: true,
  noteLength: 1,
  articulationMode: 'tongue',
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
  // Monotonic edit revision keeps mid-flight changes unsaved until a later save.
  editRevision: 0,
  saving: false,
  localDraftTimer: null,
  publishing: false,
  mixerOpen: false,
  trackBuses: new Map(),
  wavePitchOffset: 0,
  waveDrumDefaults: new Map(),
  waveMonitorLevel: null,
  synthUserPresets: [],
  synthUserPresetsBusy: false
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
  SAVE_IN_PROGRESS: '別の保存処理が進行中です。完了後にもう一度お試しください。',
  PROJECT_CHANGED_DURING_SAVE: '保存中に曲が編集されました。変更を保存し直してから公開してください。',
  RATE_LIMIT: '操作が早すぎます。少し待ってから再実行してください。',
  AUDIO_CONTEXT_BLOCKED: '音声の開始が制限されています。WAVEを開いて再生を押してください。',
  AUDIO_QUEUE_TOO_LARGE: '再生リストのデータ量が大きすぎます。曲数を減らしてください。',
  AUDIO_NOT_STARTED: '先に楽曲を再生してください。',
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
  PRESET_NAME_REQUIRED: '音色名を入力してください。',
  PRESET_NAME_EXISTS: '同じ名前の音色が既に保存されています。',
  PRESET_NOT_FOUND: '音色が見つかりません。再読み込みしてください。',
  PRESET_LIMIT: 'マイプリセットは最大32個です。不要なものを削除してください。',
  PRESET_BUSY: '保存処理中です。完了してから操作してください。',
  PLAYLIST_NAME_REQUIRED: 'プレイリスト名を入力してください。',
  PLAYLIST_NOT_FOUND: 'プレイリストが見つかりません。',
  PLAYLIST_LIMIT: 'プレイリスト作成上限に達しています。',
  PLAYLIST_TRACK_LIMIT: 'このプレイリストは曲数上限に達しています。',
  TRACK_NOT_IN_PLAYLIST: 'この曲はプレイリストにありません。更新して再度お試しください。',
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

let waveToastTimer;
function waveConfirmation(message){
  const toast = $('waveToast');
  if (toast){
    toast.textContent = '✓ ' + message;
    toast.classList.remove('hidden');
    clearTimeout(waveToastTimer);
    waveToastTimer = setTimeout(() => toast.classList.add('hidden'), 3200);
  }
  // Very quiet, short confirmation note. No downloaded audio file required.
  try {
    const Audio = window.AudioContext || window.webkitAudioContext;
    if(!Audio)return;
    const c=new Audio();
    const osc=c.createOscillator(),gain=c.createGain(),t=c.currentTime;
    osc.type='sine';osc.frequency.setValueAtTime(660,t);
    gain.gain.setValueAtTime(.0001,t);
    gain.gain.exponentialRampToValueAtTime(.035,t+.012);
    gain.gain.exponentialRampToValueAtTime(.0001,t+.12);
    osc.connect(gain);gain.connect(c.destination);osc.start(t);osc.stop(t+.14);
    osc.onended=()=>{void c.close().catch(()=>{});};
  }catch(_){ /* Never block the successful playlist operation. */ }
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[c]));
}

function showView(name) {
  state.view = name;
  document.body.classList.toggle('wave-studio-active',name==='studio');
  document.querySelectorAll('.view').forEach(v => v.classList.toggle('active', v.id === 'view-' + name));
  document.querySelectorAll('.bottom-nav button').forEach(b => b.classList.toggle('active', b.dataset.view === name));
  if (name === 'studio' && !window.WaveScreen?.parked) void loadSynthUserPresets();
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
    key: 'C:major',
    masterVolume: 1,
    tracks: Array.from({ length: 8 }, (_, i) => ({
      id: i + 1,
      name: ['メロディ', 'コード', 'ベース', 'ドラム', 'パッド', 'プラック', 'ベル', '効果音'][i],
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
  state.editRevision++;
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
  if (track?.instrument === 'drums' || track?.instrument === 'acoustic_drums') {
    if(track?.instrument === 'acoustic_drums')return [
      {pitch:60,label:'KICK'}, {pitch:64,label:'SNARE'},
      {pitch:67,label:'HAT'}, {pitch:68,label:'OPEN'},
      {pitch:69,label:'CLAP'}, {pitch:62,label:'TOM-L'},
      {pitch:65,label:'TOM-H'}, {pitch:71,label:'CRASH'}, {pitch:72,label:'RIDE'}
    ];
    return [
      { pitch: 60, label: 'KICK' },
      { pitch: 64, label: 'SNARE' },
      { pitch: 67, label: 'HAT' },
      { pitch: 69, label: 'CLAP' }
    ];
  }
  const base = 12 * (Number(state.octave || 4) + 1) + (Number(state.wavePitchOffset) || 0);
  const count=state.octaveRows===24||(state.octaveRows===null&&window.WaveScreen?.expanded)?24:12;
  return Array.from({ length: count }, (_, i) => {
    const pitch = base + count - 1 - i;
    return { pitch, label: midiName(pitch) };
  });
}

function midiName(m) {
  const names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  return names[m % 12] + (Math.floor(m / 12) - 1);
}

const waveKeyNotes=['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
const waveScales={major:[0,2,4,5,7,9,11],minor:[0,2,3,5,7,8,10]};
function currentKey(){
  const raw=String(ensureProject().key||'C:major');
  const [name,mode]=raw.split(':');
  return {root:Math.max(0,waveKeyNotes.indexOf(name)),mode:mode==='minor'?'minor':'major'};
}
function renderKeyOptions(){
  const select=$('keySelect');
  if(!select.childElementCount)for(const mode of ['major','minor'])for(const name of waveKeyNotes){
    const option=document.createElement('option');option.value=name+':'+mode;
    option.textContent=name+(mode==='major'?' メジャー':' マイナー');select.appendChild(option);
  }
  const key=currentKey();select.value=waveKeyNotes[key.root]+':'+key.mode;
  $('keyGuideToggle').checked=state.keyGuide;
}
function clampPlayStart(){
  const bars=Math.max(1,Number(ensureProject().bars)||1);
  state.playStartBar=Math.max(0,Math.min(bars-1,Math.floor(Number(state.playStartBar)||0)));
}
function renderPlayPosition(){
  clampPlayStart();
  const bars=Number(ensureProject().bars)||1;
  $('playStartValue').textContent=String(state.playStartBar+1)+' / '+bars;
  $('playBarNow').textContent=state.playBar===null?'':'再生中: '+(state.playBar+1)+'小節';
  $('playStartPrev').disabled=state.playStartBar===0;
  $('playStartNext').disabled=state.playStartBar>=bars-1;
}
function setPlayStartBar(value){
  state.playStartBar=value;clampPlayStart();
  if(state.playing){stopAudio(false);scheduleProject(ensureProject(),null,state.playStartBar);$('playProject').textContent='❚❚ 停止';}
  renderPlayPosition();
}

function getTrack() {
  const project = ensureProject();
  if (!project.tracks[state.selectedTrack]) state.selectedTrack = 0;
  return project.tracks[state.selectedTrack];
}

// Index note lookup by note-array identity. Replaced arrays (paste, clear,
// undo/redo, project load) automatically receive a fresh index; old arrays
// are weakly referenced and do not keep discarded project data alive.
const waveNoteIndices = new WeakMap();
function noteIndex(notes) {
  let index = waveNoteIndices.get(notes);
  if (!index) {
    index = new Map();
    for (const note of notes) index.set(Number(note.step) + ':' + Number(note.pitch), note);
    waveNoteIndices.set(notes, index);
  }
  return index;
}

function studioNoteLimits() {
  const limits = state.bootstrap?.config?.limits || {};
  return {
    total: Number(limits.maxNotesTotal) || 8192,
    track: Number(limits.maxNotesPerTrack) || 2048
  };
}
function allowedStudioNoteCount(track, replacing, adding) {
  const limits = studioNoteLimits();
  const total = ensureProject().tracks.reduce((sum, t) => sum + (t.notes || []).length, 0);
  if ((track.notes || []).length - replacing + adding > limits.track) {
    status('このトラックの音符数が上限です（' + limits.track + '音）。', true);
    return false;
  }
  if (total - replacing + adding > limits.total) {
    status('曲全体の音符数が上限です（' + limits.total + '音）。', true);
    return false;
  }
  return true;
}

function toggleNote(step, pitch) {
  const track = getTrack();
  const notes = track.notes || (track.notes = []);
  const index = noteIndex(notes);
  const key = step + ':' + pitch;
  const existing = index.get(key);
  if (!existing && !allowedStudioNoteCount(track, 0, 1)) return;
  pushUndo();
  if (existing) {
    if ((existing.articulation || 'tongue') !== state.articulationMode) {
      // A tap in the other mode changes just this note (including old projects).
      // The next tap in the same mode removes it, as in the original editor.
      existing.articulation = state.articulationMode;
    } else {
      // Legacy/imported projects can contain stacked duplicates. Clearing the
      // visible cell must remove every copy; Undo preserves the full original.
      for (let i = notes.length - 1; i >= 0; i--) {
        if (Number(notes[i].step) === step && Number(notes[i].pitch) === pitch) notes.splice(i, 1);
      }
      index.delete(key);
    }
  } else {
    const drumDefault = isWaveDrumTrack(track) ? state.waveDrumDefaults.get(waveDrumKey(track,pitch)) : null;
    const note = { step, pitch, length: Number(state.noteLength) || 1, velocity: Number.isFinite(drumDefault) ? drumDefault : Number(state.noteVelocity) || 0.85, articulation: state.articulationMode };
    notes.push(note);
    index.set(key, note);
  }
  markDirty();
  renderGrid();
}

// WAVE_STUDIO_EDITING_TEST_V2: UI affordances on top of the saved project format.
const WAVE_MAX_EDITOR_TRACKS = 16;
function isWaveDrumTrack(t){return t?.instrument==='drums'||t?.instrument==='acoustic_drums';}
function waveDrumKey(track,pitch){return String(track?.id)+':'+String(pitch);}
function waveStudioMonitor(){
  if(Number.isFinite(state.waveMonitorLevel))return state.waveMonitorLevel;
  try { const raw=localStorage.getItem('waveStudioMonitorVolumeV1');const x=raw===null?1:Number(raw);state.waveMonitorLevel=Number.isFinite(x)?Math.max(0,Math.min(1,x)):1; }
  catch(_){state.waveMonitorLevel=1;}
  return state.waveMonitorLevel;
}
function installWaveStudioEditor(){
  if($('waveAddTrack'))return;
  const style=document.createElement('style');style.id='wave-studio-editor-v1-css';
  style.textContent=`
    #waveTrackManager{display:flex;gap:.3rem;align-items:center;flex-wrap:wrap;margin-bottom:.35rem}
    #waveTrackManager span{font-size:.68rem;color:#acc9d6;margin-right:auto}
    #waveTrackManager button{padding:.4rem .55rem;font-size:.7rem}
    .wave-track-row{display:flex;align-items:stretch;gap:.15rem;margin:.15rem 0;min-width:0}
    .wave-track-row .track-button{flex:1;min-width:0;text-align:left;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .wave-track-row .wave-move{padding:.3rem .35rem;flex:0 0 auto;font-size:.7rem}
    #waveStudioMonitorBox{display:flex;align-items:center;gap:.45rem;min-width:8rem;font-size:.7rem;flex-wrap:wrap}
    #waveStudioMonitorBox input{width:6.5rem;min-width:4rem;flex:1;padding:0;accent-color:#72e5ff}
    #waveStudioMonitorValue{min-width:2.8rem;font-variant-numeric:tabular-nums}
    #waveDrumMixer{margin-top:.5rem;padding:.6rem;border-radius:.6rem;background:#0b1423}
    #waveDrumMixer strong{display:block;margin-bottom:.3rem;font-size:.74rem}
    #waveDrumMixer .wave-drum-row{display:grid;grid-template-columns:minmax(4rem,1fr) minmax(4rem,2fr) 2.5rem;align-items:center;gap:.4rem;margin:.3rem 0;font-size:.65rem}
    #waveDrumMixer input{padding:0;width:100%;accent-color:#72e5ff}
    .step-cell{position:relative;overflow:visible;isolation:auto}
    .step-cell.on{z-index:3}
    .step-cell .wave-note-body{position:absolute;display:block;left:0;top:17%;height:66%;border-radius:.22rem;background:linear-gradient(90deg,#42d3f2,#9677fc);box-shadow:0 0 .26rem #21bbeb55;z-index:4;pointer-events:none}
    .step-cell.articulation-legato .wave-note-body{background:linear-gradient(90deg,#22c99b,#19a88a)}
    .step-cell.articulation-tongue .wave-note-body{background:linear-gradient(90deg,#eaa34e,#d17830)}
    .step-cell .wave-note-resize{position:absolute;display:block;right:0;top:0;height:100%;width:.5rem;min-width:6px;background:#f6faff80;border-radius:.15rem;cursor:ew-resize;touch-action:none;pointer-events:auto;z-index:5}
    .step-cell .wave-note-body.wave-note-preview{box-shadow:0 0 0 1px #fff}
    .step-cell .wave-note-body.wave-note-continuation{opacity:.65;z-index:2}
    #wavePianoHorizontalNav{display:flex;gap:.4rem;align-items:center;flex-wrap:wrap;position:static;top:auto;z-index:auto;padding:.35rem .4rem;margin-bottom:0;border-radius:.5rem;background:#111e30;border:1px solid #364c65}
    #wavePianoHorizontalNav .wave-horizontal-title{color:#b9cbdc;font-size:.68rem;white-space:nowrap;font-weight:700}
    #wavePianoHorizontalNav button{font-size:.72rem;padding:.38rem .55rem;border-radius:.45rem}
    #wavePianoHorizontalNav button:disabled{opacity:.42;cursor:not-allowed}
    #wavePianoHorizontalNav input{width:auto;min-width:5rem;flex:1 1 8rem;accent-color:#72e5ff;height:1.25rem;padding:0;cursor:ew-resize;touch-action:pan-x}
    #wavePianoHorizontalNav button[aria-pressed="true"]{background:#16849e;color:#fff}
    #wavePianoHorizontalNav output{min-width:4rem;text-align:center;color:#f8fafc;font-size:.72rem;font-variant-numeric:tabular-nums;white-space:nowrap}
    #pianoGrid.wave-pan-enabled{cursor:grab;touch-action:none}
    #pianoGrid.wave-pan-enabled .step-cell,#pianoGrid.wave-pan-enabled .wave-note-resize{pointer-events:none}
    #pianoGrid.wave-pan-grabbing{cursor:grabbing}
    #pianoGrid .step-cell.wave-outside-song{opacity:.16;cursor:not-allowed;pointer-events:none}
    @media(max-width:32rem){#wavePianoHorizontalNav .wave-horizontal-title{width:100%}#wavePianoHorizontalNav input{flex-basis:6rem}}
    #wavePianoHint{font-size:.66rem;color:#a7bfce;margin-top:.4rem}
    @media(max-width:32rem){#waveStudioMonitorBox{min-width:100%}.wave-track-row .wave-move{padding:.25rem}}
  `;
  document.head.appendChild(style);
  const trackList=$('trackList');
  const composerDock=document.createElement('div');composerDock.className='wave-composer-dock';composerDock.setAttribute('aria-label','トラック選択と作曲操作');
  trackList.parentElement.insertBefore(composerDock,trackList);composerDock.appendChild(trackList);
  const controls=document.createElement('div');controls.id='waveTrackManager';
  controls.innerHTML='<span id="waveTrackCounter">8 / 16 トラック</span><button type="button" id="waveAddTrack" class="secondary">＋ 追加</button><button type="button" id="waveRemoveTrack" class="secondary">削除</button><button type="button" id="waveTrackSettingsOpen" class="secondary">⚙ 設定</button>';
  composerDock.insertBefore(controls,trackList);
  $('waveAddTrack').onclick=()=>{
    const p=ensureProject();if(p.tracks.length>=WAVE_MAX_EDITOR_TRACKS){status('最大16トラックです。',true);return;}
    if(state.playing)stopAudio(false);
    pushUndo();
    const id=p.tracks.reduce((max,t)=>Math.max(max,Number(t.id)||0),0)+1;
    p.tracks.splice(state.selectedTrack+1,0,{id,name:'新しいトラック',instrument:'piano',volume:.75,pan:0,muted:false,solo:false,notes:[]});
    state.selectedTrack++;markDirty();renderStudio();
  };
  $('waveRemoveTrack').onclick=async()=>{
    const p=ensureProject();if(p.tracks.length<=1){status('最低1トラックは必要です。',true);return;}
    const i=state.selectedTrack,t=p.tracks[i];
    if(!await waveConfirm('「'+(t.name||'トラック')+'」を削除しますか？ このトラックの音符も消えます。'))return;
    if(state.playing)stopAudio(false);
    pushUndo();p.tracks.splice(i,1);state.selectedTrack=Math.min(i,p.tracks.length-1);markDirty();renderStudio();
  };
  const transport=document.querySelector('#view-studio .transport');
  const monitor=document.createElement('label');monitor.id='waveStudioMonitorBox';
  monitor.innerHTML='再生音量 <input type="range" min="0" max="100" step="1" id="waveStudioMonitor" aria-label="Studioで聴く音量"><output id="waveStudioMonitorValue">100%</output>';
  (transport.querySelector('.wave-transport-settings-grid')||transport).appendChild(monitor);
  $('waveStudioMonitor').oninput=event=>{
    const value=Math.max(0,Math.min(1,Number(event.target.value)/100));
    state.waveMonitorLevel=value;
    try{localStorage.setItem('waveStudioMonitorVolumeV1',String(value));}catch(_){}
    $('waveStudioMonitorValue').textContent=Math.round(value*100)+'%';
    if(ctx && !state.currentTrack)globalThis.WaveSamples?.setMaster(ctx,(ensureProject().masterVolume??1)*value);
  };
  const editor=document.querySelector('#view-studio .track-editor');
  const drum=document.createElement('div');drum.id='waveDrumMixer';drum.hidden=true;editor.appendChild(drum);
  const synthOpen=document.createElement('button');synthOpen.type='button';synthOpen.id='waveSynthDesignerOpen';synthOpen.className='secondary';synthOpen.textContent='音色編集';synthOpen.disabled=true;
  $('instrumentPreview').insertAdjacentElement('afterend',synthOpen);
  const releaseOpen=document.createElement('button');releaseOpen.type='button';releaseOpen.id='waveReleaseOpen';releaseOpen.className='secondary';releaseOpen.textContent='公開';
  document.querySelector('#view-studio .studio-actions')?.appendChild(releaseOpen);
  const createStudioDialog=(id,title,content,variant)=>{
    const dialog=document.createElement('dialog');dialog.id=id;dialog.className='wave-studio-dialog '+variant;
    dialog.setAttribute('aria-labelledby',id+'Title');
    const header=document.createElement('div');header.className='wave-studio-dialog-head';
    const heading=document.createElement('strong');heading.id=id+'Title';heading.textContent=title;
    const close=document.createElement('button');close.type='button';close.className='secondary';close.textContent='閉じる';close.setAttribute('aria-label',title+'を閉じる');
    close.addEventListener('click',()=>dialog.close());header.append(heading,close);dialog.append(header,content);document.body.appendChild(dialog);
    dialog.addEventListener('click',event=>{if(event.target===dialog)dialog.close();});
    return {dialog,close};
  };
  const synthPanel=$('synthPanel');
  const synthDialog=createStudioDialog('waveSynthDesignerDialog','SYNTH DESIGNER',synthPanel,'wave-synth-dialog');
  const synthDisclosure=synthPanel.querySelector('.wave-synth-details');
  $('waveSynthDesignerOpen').onclick=()=>{
    if(getTrack().instrument!=='synth')return;
    if(synthDisclosure)synthDisclosure.open=true;
    if(!synthDialog.dialog.open)synthDialog.dialog.showModal();
  };
  synthDialog.dialog.addEventListener('close',()=>$('waveSynthDesignerOpen').focus());

  const trackSettings=createStudioDialog('waveTrackSettingsDialog','トラック設定',editor,'wave-track-dialog');
  $('waveTrackSettingsOpen').onclick=()=>{
    const disclosure=editor.querySelector('.wave-track-details');if(disclosure)disclosure.open=true;
    if(!trackSettings.dialog.open)trackSettings.dialog.showModal();
  };
  trackSettings.dialog.addEventListener('close',()=> $('waveTrackSettingsOpen').focus());

  const publishCard=document.querySelector('#view-studio .publish-card');
  const releaseDialog=createStudioDialog('waveReleaseDialog','曲を公開',publishCard,'wave-release-dialog');
  $('waveReleaseOpen').onclick=()=>{if(!releaseDialog.dialog.open)releaseDialog.dialog.showModal();};
  releaseDialog.dialog.addEventListener('close',()=> $('waveReleaseOpen').focus());
  const info=document.createElement('div');info.id='wavePianoHint';info.textContent='ホイール上下：音程移動 ／ Shift＋ホイールまたは横スクロール：小節移動 ／ 音符右端をドラッグ：長さ変更（最大1小節） ／ Space：再生・停止';
  $('pianoGrid').insertAdjacentElement('afterend',info);
  const wrap=$('pianoGrid').parentElement;
  const pianoWrap=wrap.parentElement;
  // Show 16 steps at a time; shift the viewport by one beat (4 steps).
  // This affects display only, never the saved score or playback start.
  const navigator=document.createElement('div');
  navigator.id='wavePianoHorizontalNav';
  navigator.innerHTML='<span class="wave-horizontal-title">横移動（1拍ずつ）</span><button type="button" id="wavePianoBarPrev" class="secondary" aria-label="前の拍">◀</button><input id="wavePianoBarRange" type="range" min="0" max="0" step="1" value="0" aria-label="表示する拍"><button type="button" id="wavePianoBarNext" class="secondary" aria-label="次の拍">▶</button><output id="wavePianoBarPosition">1小節目・1拍目</output><button type="button" id="wavePianoPanToggle" class="secondary" aria-pressed="false" title="ON時は楽譜を1拍単位で左右にドラッグできます" aria-label="楽譜ドラッグ移動">⇆ ドラッグ OFF</button>';
  const scoreControls=document.createElement('div');
  scoreControls.className='wave-score-controls';
  const pianoToolbar=pianoWrap.querySelector('.wave-piano-toolbar');
  if(pianoToolbar)scoreControls.append(pianoToolbar);
  const displayControls=document.createElement('div');displayControls.className='wave-score-display-controls';
  displayControls.setAttribute('role','group');displayControls.setAttribute('aria-label','楽譜の音域とズーム');
  const octaveLabel=$('octaveSelect').closest('label'),rowsLabel=$('octaveRowsSelect').closest('label');
  if(octaveLabel)displayControls.appendChild(octaveLabel);
  if(rowsLabel)displayControls.appendChild(rowsLabel);
  const panControl=navigator.querySelector('#wavePianoPanToggle');
  if(panControl)navigator.insertBefore(displayControls,panControl);
  scoreControls.append(navigator);
  const scoreDock=document.querySelector('#view-studio .wave-composer-dock');
  if(scoreDock)scoreDock.append(scoreControls);
  $('wavePianoBarPrev').onclick=()=>setWaveEditorBeat(waveViewBeat()-1);
  $('wavePianoBarNext').onclick=()=>setWaveEditorBeat(waveViewBeat()+1);
  let pendingBeat=null,beatFrame=0;
  $('wavePianoBarRange').addEventListener('input',event=>{
    pendingBeat=Number(event.target.value);
    if(beatFrame)return;
    beatFrame=requestAnimationFrame(()=>{beatFrame=0;const beat=pendingBeat;pendingBeat=null;setWaveEditorBeat(beat);});
  });
  const panToggle=$('wavePianoPanToggle');
  let panEnabled=false,panStart=null;
  panToggle.onclick=()=>{
    panEnabled=!panEnabled;
    panToggle.setAttribute('aria-pressed',String(panEnabled));
    panToggle.textContent=panEnabled?'⇆ ドラッグ ON':'⇆ ドラッグ OFF';
    $('pianoGrid').classList.toggle('wave-pan-enabled',panEnabled);
  };
  wrap.addEventListener('pointerdown',event=>{
    if(!panEnabled||state.view!=='studio'||event.button!==0||!event.target.closest?.('#pianoGrid'))return;
    event.preventDefault();event.stopPropagation();
    panStart={id:event.pointerId,x:event.clientX,beat:waveViewBeat()};
    $('pianoGrid').classList.add('wave-pan-grabbing');
    try{wrap.setPointerCapture(event.pointerId);}catch(_){}
  });
  wrap.addEventListener('pointermove',event=>{
    if(!panStart||event.pointerId!==panStart.id)return;
    event.preventDefault();
    const beatOffset=Math.round((panStart.x-event.clientX)/48);
    setWaveEditorBeat(panStart.beat+beatOffset);
  });
  const stopPan=event=>{
    if(!panStart||event.pointerId!==panStart.id)return;
    panStart=null;$('pianoGrid').classList.remove('wave-pan-grabbing');
    try{if(wrap.hasPointerCapture(event.pointerId))wrap.releasePointerCapture(event.pointerId);}catch(_){}
  };
  wrap.addEventListener('pointerup',stopPan);wrap.addEventListener('pointercancel',stopPan);
  $('wavePianoHint').textContent='横移動バー・矢印・ドラッグ・Shift＋ホイール：1拍ずつ移動 ／ ホイール上下：音域 ／ 音符右端ドラッグ：長さ ／ Space：再生・停止';
  let wheelX=0,wheelY=0;
  wrap.addEventListener('wheel',event=>{
    if(state.view!=='studio'||event.target?.closest?.('#wavePianoHorizontalNav'))return;
    const p=ensureProject();
    const horizontal=Math.abs(event.deltaX)>Math.abs(event.deltaY)||event.shiftKey;
    const delta=horizontal?(event.shiftKey ? event.deltaY:event.deltaX):event.deltaY;
    event.preventDefault();
    if(horizontal){
      wheelX+=delta;
      if(Math.abs(wheelX)>=28){const next=waveViewBeat()+(wheelX>0?1:-1);wheelX=0;
        setWaveEditorBeat(next);}
    }else if(!isWaveDrumTrack(getTrack())){
      wheelY+=delta;
      if(Math.abs(wheelY)>=32){const shift=wheelY>0?-1:1;wheelY=0;
        const rows=pitchRows(),base=rows[rows.length-1]?.pitch||60;
        const next=Math.max(24,Math.min(96-rows.length+1,base+shift));
        state.wavePitchOffset+=(next-base);renderGrid();
      }
    }
  },{passive:false});
  wrap.addEventListener('keydown',event=>{
    const cell=event.target?.closest?.('#pianoGrid .step-cell');
    if(!cell||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key))return;
    const grid=$('pianoGrid'),cells=grid.querySelectorAll('.step-cell'),index=Array.prototype.indexOf.call(cells,cell);
    if(index<0)return;
    const rows=pitchRows(),row=Math.floor(index/16),column=index%16;
    let nextRow=row,nextStep=waveViewBeat()*4+column;
    if(event.key==='ArrowUp')nextRow=Math.max(0,row-1);
    if(event.key==='ArrowDown')nextRow=Math.min(rows.length-1,row+1);
    if(event.key==='ArrowLeft')nextStep--;
    if(event.key==='ArrowRight')nextStep++;
    const maxStep=Math.max(0,Math.floor(Number(ensureProject().bars)||1)*16-1);
    if(nextStep<0||nextStep>maxStep)return;
    event.preventDefault();
    const oldBeat=waveViewBeat(),visibleStart=oldBeat*4,visibleEnd=visibleStart+15;
    if(nextStep<visibleStart)setWaveEditorBeat(Math.floor(nextStep/4));
    else if(nextStep>visibleEnd)setWaveEditorBeat(Math.min(Math.floor(maxStep/4),oldBeat+1));
    const nextColumn=Math.max(0,Math.min(15,nextStep-waveViewBeat()*4));
    requestAnimationFrame(()=>{const target=grid.querySelectorAll('.step-cell')[nextRow*16+nextColumn];if(target&&!target.disabled)target.focus();});
  });
  document.addEventListener('keydown',event=>{
    if(event.code!=='Space'||event.repeat||event.ctrlKey||event.altKey||event.metaKey||state.view!=='studio')return;
    const el=event.target;
    if(el?.closest?.('input,textarea,select,button,[contenteditable="true"],dialog[open]')||document.querySelector('dialog[open]'))return;
    if(window.WaveScreen?.parked)return;
    event.preventDefault();$('playProject').click();
  });
}
function renderWaveTrackManager(p){
  installWaveStudioEditor();
  $('waveTrackCounter').textContent=p.tracks.length+' / '+WAVE_MAX_EDITOR_TRACKS+' トラック';
  $('waveAddTrack').disabled=p.tracks.length>=WAVE_MAX_EDITOR_TRACKS;
  $('waveRemoveTrack').disabled=p.tracks.length<=1;
  $('waveSynthDesignerOpen').disabled=getTrack().instrument!=='synth';
  const list=$('trackList'),previousScroll=list.scrollLeft;list.replaceChildren();
  p.tracks.forEach((track,index)=>{
    const row=document.createElement('div');row.className='wave-track-row';
    const select=document.createElement('button');select.type='button';
    select.className='track-button'+(index===state.selectedTrack?' active':'');
    select.textContent=(index+1)+' '+(track.name||'トラック')+(track.muted?' · M':'');
    select.title=track.name||'トラック';select.onclick=()=>{state.selectedTrack=index;renderStudio();};
    row.appendChild(select);
    for(const [delta,caption] of [[-1,'↑'],[1,'↓']]){
      const move=document.createElement('button');move.type='button';move.className='secondary wave-move';move.textContent=caption;
      move.title=caption==='↑'?'上に移動':'下に移動';move.disabled=index+delta<0||index+delta>=p.tracks.length;
      move.onclick=()=>{if(state.playing)stopAudio(false);pushUndo();
        const [item]=p.tracks.splice(index,1);p.tracks.splice(index+delta,0,item);
        state.selectedTrack=index+delta;markDirty();renderStudio();};row.appendChild(move);
    }
    list.appendChild(row);
  });
  list.scrollLeft=Math.max(0,previousScroll);
  const activeRow=list.querySelector('.wave-track-row .track-button.active')?.parentElement;
  if(activeRow){
    const viewLeft=list.scrollLeft,viewRight=viewLeft+list.clientWidth;
    const rowLeft=activeRow.offsetLeft,rowRight=rowLeft+activeRow.offsetWidth;
    if(rowLeft<viewLeft)list.scrollLeft=rowLeft;
    else if(rowRight>viewRight)list.scrollLeft=Math.max(0,rowRight-list.clientWidth);
  }
}
function updateWaveStudioMonitor(){
  if(!$('waveStudioMonitor'))return;
  const v=Math.round(waveStudioMonitor()*100);
  if(document.activeElement!==$('waveStudioMonitor'))$('waveStudioMonitor').value=String(v);
  $('waveStudioMonitorValue').textContent=v+'%';
}
function renderWaveDrumMixer(){
  const box=$('waveDrumMixer');if(!box)return;
  const t=getTrack();box.hidden=!isWaveDrumTrack(t);if(box.hidden){box.replaceChildren();return;}
  box.replaceChildren();const title=document.createElement('strong');title.textContent='ドラム音別の強弱（音符のベロシティに反映・保存）';box.appendChild(title);
  const pitches=pitchRows();
  for(const item of pitches){
    const hits=(t.notes||[]).filter(note=>Number(note.pitch)===item.pitch);
    const avg=hits.length?hits.reduce((sum,n)=>sum+Number(n.velocity??.85),0)/hits.length:
      (state.waveDrumDefaults.get(waveDrumKey(t,item.pitch))??.85);
    const row=document.createElement('label');row.className='wave-drum-row';
    const label=document.createElement('span');label.textContent=item.label;
    const slider=document.createElement('input');slider.type='range';slider.min='5';slider.max='100';slider.step='1';slider.value=String(Math.round(avg*100));
    slider.setAttribute('aria-label',item.label+'の音量');
    const output=document.createElement('output');output.textContent=slider.value+'%';
    let saved=false,previous=avg;
    slider.addEventListener('input',()=>{
      const v=Math.max(.05,Math.min(1,Number(slider.value)/100));
      if(!saved){pushUndo();saved=true;}
      const ratio=previous>0?v/previous:1;
      for(const n of hits)n.velocity=Math.max(.05,Math.min(1,Number(n.velocity??.85)*ratio));
      previous=v;state.waveDrumDefaults.set(waveDrumKey(t,item.pitch),v);
      output.textContent=Math.round(v*100)+'%';markDirty();
    });
    slider.addEventListener('change',()=>{saved=false;renderWaveDrumMixer();});
    row.append(label,slider,output);box.appendChild(row);
  }
}
function renderWaveNoteLength(cell,note,pitch,column,barStart,notes){
  // Create a visual sustain bar on the existing 16-step row; no new note fields.
  cell.replaceChildren();
  let origin=note;
  let carried=false;
  if(!origin&&column===0){origin=notes.find(n=>Number(n.pitch)===pitch&&Number(n.step)<barStart&&Number(n.step)+Number(n.length)>barStart);carried=!!origin;}
  if(!origin)return;
  const startStep=Number(origin.step);
  const remaining=Number(origin.length)-Math.max(0,barStart-startStep);
  const shown=Math.max(1,Math.min(16-column,remaining));
  if(!(shown>0))return;
  const body=document.createElement('span');body.className='wave-note-body'+(carried?' wave-note-continuation':'');
  body.style.width=`calc(${shown*100}% + ${((shown-1)*.18).toFixed(3)}rem)`;
  if(origin.articulation==='legato')body.style.background='#22ba9a';
  if(origin.articulation==='tongue')body.style.background='#eaa34e';
  cell.appendChild(body);
  if(carried)return;
  const handle=document.createElement('span');handle.className='wave-note-resize';handle.setAttribute('role','presentation');body.appendChild(handle);
  handle.addEventListener('click',event=>{event.stopPropagation();event.preventDefault();});
  handle.addEventListener('pointerdown',event=>{
    if(event.button!==0)return;
    event.preventDefault();event.stopPropagation();
    const startX=event.clientX;
    const remainingSongSteps=Math.max(1,Math.floor(Number(ensureProject().bars)||1)*16-startStep);
    const maxLength=Math.min(16,remainingSongSteps);
    const initial=Math.max(1,Math.min(maxLength,Number(origin.length)||1));
    const stepWidth=cell.getBoundingClientRect().width+(parseFloat(getComputedStyle($('pianoGrid')).columnGap)||0);
    let candidate=initial;
    const move=e=>{
      candidate=Math.max(1,Math.min(maxLength,Math.round(initial+(e.clientX-startX)/Math.max(1,stepWidth))));
      const shownNow=Math.min(candidate,16-column);
      body.style.width=`calc(${shownNow*100}% + ${((shownNow-1)*.18).toFixed(3)}rem)`;
      body.classList.add('wave-note-preview');
      handle.title='ノート長：'+candidate+'ステップ（曲の末尾と1小節上限内）';
    };
    const finish=()=>{
      window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',finish);
      window.removeEventListener('pointercancel',cancel);
      if(candidate!==initial){pushUndo();origin.length=candidate;markDirty();}
      renderGrid();
    };
    const cancel=()=>{window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',finish);window.removeEventListener('pointercancel',cancel);renderGrid();};
    window.addEventListener('pointermove',move);window.addEventListener('pointerup',finish,{once:true});window.addEventListener('pointercancel',cancel,{once:true});
  });
}

function renderStudio() {
  const p = ensureProject();
  const maxBars = Number(state.bootstrap?.config?.limits?.maxBars || 128);
  p.bars = Math.max(1, Math.min(maxBars, Number(p.bars) || 4));
  if (state.bar >= p.bars) state.bar = p.bars - 1;
  renderPlayPosition();
  renderKeyOptions();
  $('octaveRowsSelect').value=String(state.octaveRows===null?(window.WaveScreen?.expanded?24:12):state.octaveRows);
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
  renderWaveTrackManager(p);
  const track = getTrack();
  $('trackName').value = track.name || '';
  window.WaveInstrumentPresets?.sync(track.instrument || 'sine');
  $('instrumentSelect').value = track.instrument || 'sine';
  renderSynthPanel();
  $('trackVolume').value = Number(track.volume ?? 0.75);
  $('trackPan').value = Number(track.pan || 0);
  $('trackMute').checked = track.muted === true;
  $('trackSolo').checked = track.solo === true;
  $('noteLength').value = String(state.noteLength);
  renderArticulationMode();
  $('noteVelocity').value = Number(state.noteVelocity);
  renderMixer();
  renderWaveDrumMixer();
  updateWaveStudioMonitor();
  updateHistoryButtons();
  renderGrid();
}

function renderArticulationMode(){
  const button=$('articulationToggle');
  button.dataset.mode=state.articulationMode;
  button.setAttribute('aria-pressed',String(state.articulationMode==='legato'));
  button.textContent=state.articulationMode==='legato'?'奏法：伸ばす（レガート）':'奏法：切る（タンギング）';
}
$('articulationToggle').onclick=()=>{
  state.articulationMode=state.articulationMode==='legato'?'tongue':'legato';
  renderArticulationMode();
};

// The mixer edits the established track volume, pan and mute fields. A saved
// 0.75 track level is displayed as 100%, so older projects keep their sound.
const mixerPercent = volume => Math.min(133,Math.max(0,Math.round(Number(volume ?? .75)/.75*100)));
const mixerStored = percent => Number(percent)>=133?1:Math.min(1,Math.max(0,Number(percent)*.0075));
function syncMixerAudio(){
  if(!ctx||!state.playing||state.currentTrack)return;
  const tracks=ensureProject().tracks||[];
  const hasSolo=tracks.some(track=>track.solo===true);
  tracks.forEach((track,index)=>{
    const bus=state.trackBuses.get(Number(track.id)||index+1);
    if(!bus)return;
    const value=track.muted||(hasSolo&&!track.solo)?0:Math.max(0,Math.min(1,Number(track.volume??.75)));
    if(bus.gain.setTargetAtTime)bus.gain.setTargetAtTime(value,ctx.currentTime,.012);
    else bus.gain.value=value;
  });
  globalThis.WaveSamples?.setMaster(ctx,(ensureProject().masterVolume??1)*waveStudioMonitor());
}
function renderMixer(){
  $('mixerPanel').classList.toggle('hidden',!state.mixerOpen);
  $('mixerToggle').setAttribute('aria-expanded',String(state.mixerOpen));
  if(!state.mixerOpen)return;
  const project=ensureProject(),master=Math.max(0,Math.min(1,Number(project.masterVolume??1)));
  $('masterVolume').value=String(Math.round(master*100));
  $('masterVolumeValue').textContent=`${Math.round(master*100)}%`;
  const container=$('mixerTracks');container.replaceChildren();
  project.tracks.forEach((track,index)=>{
    const option=[...$('instrumentSelect').options].find(item=>item.value===track.instrument);
    const row=document.createElement('div');
    row.className='mixer-row'+(index===state.selectedTrack?' active':'');
    row.innerHTML=`<button type="button" class="mixer-name" aria-label="${index+1}番トラックを選択">${index+1} ${escapeHtml(track.name||'トラック')}<small>${escapeHtml(option?.textContent||track.instrument||'音色')}</small></button><label class="mixer-mute">ミュート <input type="checkbox" ${track.muted?'checked':''}></label><label class="mixer-level">音量 <input type="range" min="0" max="133" step="1" value="${mixerPercent(track.volume)}" aria-label="${index+1}番トラックの音量"><output>${mixerPercent(track.volume)}%</output></label><label class="mixer-pan">左右 <input type="range" min="-1" max="1" step="0.05" value="${Math.max(-1,Math.min(1,Number(track.pan)||0))}" aria-label="${index+1}番トラックの左右バランス"></label>`;
    row.querySelector('.mixer-name').onclick=()=>{state.selectedTrack=index;renderStudio();};
    row.querySelector('.mixer-mute input').onchange=event=>{track.muted=event.target.checked;markDirty();syncMixerAudio();renderStudio();};
    row.querySelector('.mixer-level input').oninput=event=>{
      track.volume=mixerStored(event.target.value);row.querySelector('.mixer-level output').textContent=`${event.target.value}%`;
      if(index===state.selectedTrack)$('trackVolume').value=track.volume;
      markDirty();syncMixerAudio();
    };
    row.querySelector('.mixer-pan input').oninput=event=>{
      track.pan=Number(event.target.value);if(index===state.selectedTrack)$('trackPan').value=track.pan;
      markDirty();
    };
    container.appendChild(row);
  });
}
$('mixerToggle').onclick=()=>{state.mixerOpen=!state.mixerOpen;renderMixer();};
$('masterVolume').oninput=event=>{
  const project=ensureProject();project.masterVolume=Number(event.target.value)/100;
  $('masterVolumeValue').textContent=`${event.target.value}%`;
  markDirty();if(ctx)globalThis.WaveSamples?.setMaster(ctx,project.masterVolume*waveStudioMonitor());
};

// Reuse the 16-step cells while switching bars or editing notes. Only
// changing octave/instrument reconstructs the 12x16 grid, not every edit.
// A beat is 4 of the 16 saved sixteenth-note steps per bar.
// Allow panning up to the last beat. Out-of-song cells become disabled,
// so an editor can scroll by one beat even when the project has one bar.
function waveViewBeat(){
  const total=Math.max(1,Math.floor(Number(ensureProject().bars)||1));
  const max=total*4-1;
  const fallback=(Math.floor(Number(state.bar)||0))*4;
  const raw=state.waveViewBeat==null?fallback:Number(state.waveViewBeat);
  const beat=Math.max(0,Math.min(max,Math.round(Number.isFinite(raw)?raw:fallback)));
  state.waveViewBeat=beat;
  return beat;
}
function setWaveEditorBeat(value){
  const previous=waveViewBeat();
  const bars=Math.max(1,Math.floor(Number(ensureProject().bars)||1));
  const next=Math.max(0,Math.min(bars*4-1,Math.round(Number(value)||0)));
  state.waveViewBeat=next;
  const bar=Math.floor(next/4);
  state.bar=bar;
  if($('barSelect').value!==String(bar))$('barSelect').value=String(bar);
  if(next!==previous)renderGrid();
  else renderWaveHorizontalNav();
}
function renderWaveHorizontalNav(){
  const slider=$('wavePianoBarRange');
  if(!slider)return;
  const total=Math.max(1,Math.floor(Number(ensureProject().bars)||1));
  const beat=waveViewBeat();
  const max=total*4-1;
  slider.max=String(max);
  slider.value=String(beat);
  slider.disabled=max===0;
  $('wavePianoBarPosition').textContent=(Math.floor(beat/4)+1)+'小節目・'+(beat%4+1)+'拍目';
  $('wavePianoBarPrev').disabled=beat===0;
  $('wavePianoBarNext').disabled=beat===max;
}

let waveGridCache = null;
function renderGrid() {
  const grid = $('pianoGrid');
  const start = waveViewBeat() * 4;
  const rows = pitchRows();
  const key=currentKey(),scale=new Set(waveScales[key.mode].map(step=>(key.root+step)%12));
  const rowKey = rows.map(row => row.pitch + ':' + row.label).join('|');
  const track = getTrack();
  const notes = track.notes || (track.notes = []);
  const active = noteIndex(notes);
  if (!waveGridCache || waveGridCache.grid !== grid || waveGridCache.rowKey !== rowKey ||
      grid.childElementCount !== rows.length * 17) {
    const fragment = document.createDocumentFragment();
    const cells = [];
    rows.forEach(row => {
      const label = document.createElement('div');
      label.className = 'pitch-label';
      label.textContent = row.label;
      fragment.appendChild(label);
      for (let s = 0; s < 16; s++) {
        const cell = document.createElement('button');
        cell.className = 'step-cell';
        cell.title = 'step ' + (s + 1);
        // The 16 visible cells may straddle bars. Map clicks to absolute steps.
        cell.onclick = () => {const step=waveViewBeat()*4+s; if(step<ensureProject().bars*16)toggleNote(step,row.pitch);};
        fragment.appendChild(cell);
        cells.push({ cell, pitch: row.pitch, column: s });
      }
    });
    grid.replaceChildren(fragment);
    waveGridCache = { grid, rowKey, cells };
  }
  for (const { cell, pitch, column } of waveGridCache.cells) {
    const absoluteStep=start+column;
    if(absoluteStep>=Math.max(1,Number(ensureProject().bars)||1)*16){
      cell.disabled=true;cell.className='step-cell wave-outside-song';cell.title='曲の範囲外';
      cell.setAttribute('aria-label','曲の範囲外');cell.replaceChildren();
      continue;
    }
    cell.disabled=false;
    const note = active.get((start + column) + ':' + pitch);
    const enabled = !!note;
    const tone=pitch%12;
    const guide=state.keyGuide?(tone===key.root?' key-root':scale.has(tone)?' key-tone':''):'';
    const articulation=enabled?' articulation-'+(note.articulation==='legato'?'legato':'tongue'):'';
    const desired='step-cell'+guide+(enabled?' on':'')+articulation;
    if (cell.className !== desired) cell.className = desired;
    const title=enabled?(note.articulation==='legato'?'伸ばす（レガート）':'切る（タンギング）'):'音符を入力';
    if(cell.title!==title)cell.title=title;
    cell.setAttribute('aria-label',title+' '+midiName(pitch)+' 楽曲内'+(start+column+1)+'ステップ');
    renderWaveNoteLength(cell,note,pitch,column,start,notes);
  }
  for(let i=0;i<rows.length;i++){
    const label=grid.children[i*17];
    const tone=rows[i].pitch%12;
    const desired='pitch-label'+(state.keyGuide?(tone===key.root?' key-root':scale.has(tone)?' key-tone':''):'');
    if(label.className!==desired)label.className=desired;
  }
  renderWaveHorizontalNav();
}

$('barSelect').onchange = e => { setWaveEditorBeat(Number(e.target.value)*4); };
$('octaveSelect').onchange = e => { state.octave = Number(e.target.value) || 4; state.wavePitchOffset=0; renderGrid(); };
$('octaveRowsSelect').onchange=e=>{state.octaveRows=Number(e.target.value)===24?24:12;renderGrid();};
$('keySelect').onchange=e=>{ensureProject().key=e.target.value;markDirty();renderGrid();};
$('keyGuideToggle').onchange=e=>{state.keyGuide=e.target.checked;renderGrid();};
$('playStartPrev').onclick=()=>setPlayStartBar(state.playStartBar-1);
$('playStartNext').onclick=()=>setPlayStartBar(state.playStartBar+1);
$('playStartReset').onclick=()=>setPlayStartBar(0);
$('bpmInput').onchange = e => {
  ensureProject().bpm = Math.max(60, Math.min(200, Number(e.target.value) || 120));
  markDirty();
  if(state.playing){const at=state.playBar??state.playStartBar;stopAudio(false);scheduleProject(ensureProject(),null,at);$('playProject').textContent='❚❚ 停止';}
};
$('barsInput').onchange = e => {
  const maxBars = Number(state.bootstrap?.config?.limits?.maxBars || 128);
  const bars = Math.max(1, Math.min(maxBars, Number(e.target.value) || 4));
  const p = ensureProject();
  if (p.bars === bars) return;
  const wasPlaying=state.playing;
  if(wasPlaying)stopAudio(false);
  // Reducing bars can delete hundreds of notes. Preserve them via Undo first.
  pushUndo();
  p.bars = bars;
  const maxStep = bars * 16;
  p.tracks.forEach(t => { t.notes = (t.notes || []).filter(n => Number(n.step) < maxStep); });
  if (state.bar >= bars) state.bar = bars - 1;
  markDirty();
  renderStudio();
  if(wasPlaying){scheduleProject(p,null,state.playStartBar);$('playProject').textContent='❚❚ 停止';}
};
// SYNTH DESIGNER: audio settings live on a track, never in shared global state.
const synthParameters=['attack','decay','sustain','release','cutoff','resonance','detune','fmRatio','fmDepth'];
function synthSettings(track){return globalThis.WaveSynth?.normalize(track?.synth)||globalThis.WaveSynth?.defaultPreset('warm_pad');}
function renderSynthPanel(){
 const track=getTrack(),panel=$('synthPanel');
 panel.classList.toggle('hidden',track.instrument!=='synth');
 if(track.instrument!=='synth'||!globalThis.WaveSynth)return;
 const c=synthSettings(track);
 $('synthPreset').value=c.preset;$('synthWave').value=c.wave;
 for(const key of synthParameters){const id='synth'+key[0].toUpperCase()+key.slice(1),field=$(id);field.value=c[key];syncSynthKnobDisplay(field);}
 renderSynthVisualizer();
}
// v14: Read-only oscilloscope / ADSR reference drawn from the current knob values.
// Not a spectrum analyzer: rendering never creates audio nodes or changes synth data.
function renderSynthVisualizer(){
 const waveLine=$('synthVizWave'),adsrLine=$('synthVizEnvelope');
 if(!waveLine||!adsrLine||getTrack()?.instrument!=='synth')return;
 const getNum=(key)=>Number($('synth'+key[0].toUpperCase()+key.slice(1)).value)||0;
 const wave=$('synthWave').value,detune=getNum('detune'),fmDepth=getNum('fmDepth'),fmRatio=getNum('fmRatio');
 const waveFn=(r)=>{
  const cycle=((r/(Math.PI*2))%1+1)%1;
  if(wave==='triangle')return 1-4*Math.abs(cycle-.5);
  if(wave==='sawtooth')return 2*cycle-1;
  if(wave==='square')return cycle<.5?1:-1;
  return Math.sin(r);
 };
 const points=[];
 for(let i=0;i<=144;i++){
  const t=i/144,angle=t*Math.PI*2*3.3;
  const phase=fmRatio>0&&fmDepth>0?Math.min(3,fmDepth/190)*Math.sin(angle*fmRatio):0;
  const v=waveFn(angle+phase);
  const mixed=detune>0&&phase===0?(v*.75+waveFn(angle*(1+detune/1200))*.25):v;
  points.push(`${i?'L':'M'}${(10+300*t).toFixed(2)} ${(52-mixed*33).toFixed(2)}`);
 }
 const path=points.join(' ');
 waveLine.setAttribute('d',path);
 $('synthVizWaveArea').setAttribute('d',`${path} L310 52 L10 52 Z`);
 const name={sine:'サイン波',triangle:'三角波',sawtooth:'ノコギリ波',square:'矩形波'}[wave]||wave;
 $('synthVizWaveText').textContent=name+(fmRatio>0&&fmDepth>0?' · FM ON':detune>0?' · DETUNE':'');
 const a=getNum('attack'),d=getNum('decay'),ss=getNum('sustain'),rr=getNum('release');
 // Match Web Audio envelope's 2s reference hold, including attack/decay clamps.
 const hold=2,attack=Math.min(a,hold*.85),decay=Math.min(d,Math.max(.005,hold-attack));
 const total=hold+Math.max(.02,rr),toX=x=>10+300*x/total,toY=v=>85-70*v;
 const pp=[[0,0],[Math.max(.002,attack),1]];
 if(attack+decay<hold){pp.push([attack+decay,ss],[hold,ss]);}else pp.push([hold,1]);
 pp.push([total,0]);
 const env=pp.map(([t,v],i)=>`${i?'L':'M'}${toX(t).toFixed(2)} ${toY(v).toFixed(2)}`).join(' ');
 adsrLine.setAttribute('d',env);
 $('synthVizEnvelopeArea').setAttribute('d',`${env} L310 85 L10 85 Z`);
 $('synthVizGate').setAttribute('d',`M${toX(hold).toFixed(2)} 12 V85`);
 $('synthVizEnvelopeText').textContent=`A ${a.toFixed(2)}s / D ${d.toFixed(2)}s / S ${Math.round(ss*100)}% / R ${rr.toFixed(2)}s`;
}
// Synth v12: server-side personal presets keyed by citizenid, never localStorage.
let synthPresetListRevision=0;
function synthPresetFeedback(message,bad=false){
 const el=$('synthUserPresetFeedback');
 if(!el)return;
 el.textContent=message||'';
 el.style.color=bad?'#fb7185':'';
}
function renderSynthUserPresets(selectedId=null){
 const select=$('synthUserPresetSelect');
 if(!select)return;
 const previous=selectedId===null?Number(select.value||0):Number(selectedId||0);
 select.replaceChildren();
 const placeholder=document.createElement('option');placeholder.value='';
 placeholder.textContent=state.synthUserPresets.length?'保存した音色を選択':'保存された音色はありません';
 select.appendChild(placeholder);
 for(const preset of state.synthUserPresets){
  const option=document.createElement('option');
  option.value=String(preset.id);option.textContent=preset.name;
  select.appendChild(option);
 }
 select.value=state.synthUserPresets.some(x=>x.id===previous)?String(previous):'';
 const selected=!!select.value;
 const busy=state.synthUserPresetsBusy;
 $('synthUserPresetLoad').disabled=busy||!selected;
 $('synthUserPresetDelete').disabled=busy||!selected;
 $('synthUserPresetUpdate').disabled=busy||!selected;
 $('synthUserPresetSave').disabled=busy;
 select.disabled=busy;
 $('synthUserPresetName').disabled=busy;
}
// In expanded mode the server grants the presentation lease after bootstrap.
// A list request during the handoff returns APP_SUSPENDED; retry once the lease
// is active rather than treating this normal transition as a lost preset DB.
function retrySynthPresetsWhenReady(revision,attempt){
 if(revision!==synthPresetListRevision)return;
 const screen=window.WaveScreen;
 if(screen?.parked&&!screen.expanded)return; // Phone is intentionally inactive.
 if(attempt>=40){
  synthPresetFeedback('接続の確認に時間がかかっています。Studioを開き直すと再取得します。',true);
  return;
 }
 synthPresetFeedback('マイプリセットの接続を確認しています…');
 setTimeout(()=>{if(revision===synthPresetListRevision)void requestSynthUserPresets(revision,attempt+1);},350);
}
async function requestSynthUserPresets(revision,attempt=0){
 if(revision!==synthPresetListRevision)return;
 if(window.WaveScreen?.parked)return retrySynthPresetsWhenReady(revision,attempt);
 const response=await bridge('listSynthPresets');
 if(revision!==synthPresetListRevision)return;
 if(response?.error==='APP_SUSPENDED')return retrySynthPresetsWhenReady(revision,attempt);
 if(!response?.ok){
  synthPresetFeedback('音色一覧を取得できません: '+errorText(response?.error),true);
  return;
 }
 state.synthUserPresets=Array.isArray(response.presets)?response.presets:[];
 renderSynthUserPresets();
 synthPresetFeedback(state.synthUserPresets.length?`${state.synthUserPresets.length}件の保存済み音色を読み込みました。`:'音色を保存すると、別の曲でも使えます。');
}
async function loadSynthUserPresets(){return requestSynthUserPresets(++synthPresetListRevision);}

function selectedSynthUserPreset(){
 const id=Number($('synthUserPresetSelect').value);
 return state.synthUserPresets.find(p=>p.id===id)||null;
}
$('synthUserPresetSelect').onchange=()=>{
 const preset=selectedSynthUserPreset();
 if(preset)$('synthUserPresetName').value=preset.name;
 renderSynthUserPresets();
};
$('synthUserPresetLoad').onclick=()=>{
 if(getTrack().instrument!=='synth'||state.synthUserPresetsBusy)return;
 const preset=selectedSynthUserPreset();
 if(!preset)return synthPresetFeedback('保存した音色を選んでください。',true);
 pushUndo();getTrack().synth=globalThis.WaveSynth.normalize(preset.synth);
 markDirty();renderSynthPanel();
 synthPresetFeedback('「'+preset.name+'」をこのトラックに適用しました。曲を保存すると音色も保存されます。');
};
async function saveSynthUserPreset(overwrite){
 if(state.synthUserPresetsBusy||getTrack().instrument!=='synth')return;
 const name=$('synthUserPresetName').value.trim();
 if(!name)return synthPresetFeedback(errorText('PRESET_NAME_REQUIRED'),true);
 const existing=overwrite?selectedSynthUserPreset():null;
 if(overwrite&&!existing)return synthPresetFeedback('上書きする音色を選択してください。',true);
 if(overwrite&&!await waveConfirm('「'+existing.name+'」を現在の音色で上書きしますか？'))return;
 state.synthUserPresetsBusy=true;renderSynthUserPresets();
 try{
  const payload={name,synth:globalThis.WaveSynth.normalize(synthSettings(getTrack()))};
  if(overwrite)payload.id=existing.id;
  const response=await bridge('saveSynthPreset',payload);
  if(!response?.ok)return synthPresetFeedback('保存できません: '+errorText(response?.error),true);
  // Previous in-flight list requests cannot overwrite this fresh response.
  ++synthPresetListRevision;
  state.synthUserPresets=Array.isArray(response.presets)?response.presets:[];
  renderSynthUserPresets(response.id);
  synthPresetFeedback('「'+name+'」をマイプリセットに保存しました。');
 }finally{state.synthUserPresetsBusy=false;renderSynthUserPresets();}
}
$('synthUserPresetSave').onclick=()=>saveSynthUserPreset(false);
$('synthUserPresetUpdate').onclick=()=>saveSynthUserPreset(true);
$('synthUserPresetDelete').onclick=async()=>{
 if(state.synthUserPresetsBusy)return;
 const selected=selectedSynthUserPreset();if(!selected)return;
 if(!await waveConfirm('「'+selected.name+'」を削除しますか？ 保存済みの曲の音色は変わりません。'))return;
 state.synthUserPresetsBusy=true;renderSynthUserPresets();
 try{
  const response=await bridge('deleteSynthPreset',{id:selected.id});
  if(!response?.ok)return synthPresetFeedback('削除できません: '+errorText(response?.error),true);
  ++synthPresetListRevision;
  state.synthUserPresets=Array.isArray(response.presets)?response.presets:[];
  $('synthUserPresetName').value='';
  renderSynthUserPresets(0);
  synthPresetFeedback('「'+selected.name+'」を削除しました。保存済みの曲はそのままです。');
 }finally{state.synthUserPresetsBusy=false;renderSynthUserPresets();}
};

$('synthPreset').onchange=e=>{
 if(getTrack().instrument!=='synth'||!globalThis.WaveSynth)return;
 pushUndo();getTrack().synth=globalThis.WaveSynth.defaultPreset(e.target.value);markDirty();renderSynthPanel();
};
$('synthWave').onchange=e=>{
 if(getTrack().instrument!=='synth'||!globalThis.WaveSynth)return;
 pushUndo();getTrack().synth={...synthSettings(getTrack()),wave:e.target.value};markDirty();renderSynthPanel();
};
// v13: rotary controls retain the v12 synth patch schema and native range fields.
// One undo entry per committed pointer gesture; drag previews only the displayed number.
function formatSynthKnobValue(key,value){
 if(key==='cutoff')return `${Math.round(value)} Hz`;
 if(key==='sustain')return `${Math.round(value*100)}%`;
 if(['attack','decay','release'].includes(key))return `${value.toFixed(2)} s`;
 return value.toFixed(1);
}
function syncSynthKnobDisplay(field){
 if(!field)return;
 const control=field.closest('.wave-synth-knob-control');
 if(!control)return;
 const knob=control.querySelector('.wave-synth-knob');
 const key=control.dataset.synthParam;
 const value=Number(field.value),min=Number(field.min),max=Number(field.max);
 const fraction=Math.max(0,Math.min(1,(value-min)/(max-min||1)));
 const label=formatSynthKnobValue(key,value);
 knob.style.setProperty('--knob-angle',`${(270*fraction).toFixed(2)}deg`);
 knob.setAttribute('aria-valuenow',String(value));
 knob.setAttribute('aria-valuetext',label);
 $(field.id+'Value').textContent=label;
}
function changeSynthKnobValue(field,value,commit=false){
 const min=Number(field.min),max=Number(field.max),step=Number(field.step)||0.01;
 const normalized=Math.max(min,Math.min(max,Math.round((value-min)/step)*step+min));
 const next=Number(normalized.toFixed(5));
 if(Number(field.value)===next)return false;
 field.value=String(next);
 field.dispatchEvent(new Event('input',{bubbles:true}));
 if(commit)field.dispatchEvent(new Event('change',{bubbles:true}));
 return true;
}
for(const key of synthParameters){
 const id='synth'+key[0].toUpperCase()+key.slice(1),field=$(id);
 const control=field.closest('.wave-synth-knob-control');
 const knob=control.querySelector('.wave-synth-knob');
 field.addEventListener('input',()=>{syncSynthKnobDisplay(field);renderSynthVisualizer();});
 field.addEventListener('change',()=>{
  if(getTrack().instrument!=='synth'||!globalThis.WaveSynth)return;
  pushUndo();getTrack().synth=globalThis.WaveSynth.normalize({...synthSettings(getTrack()),[key]:Number(field.value)});markDirty();renderSynthPanel();
 });
 let drag=null;
 knob.addEventListener('pointerdown',event=>{
  if(event.button!==0||getTrack().instrument!=='synth')return;
  event.preventDefault();knob.focus({preventScroll:true});
  drag={pointerId:event.pointerId,y:event.clientY,value:Number(field.value),changed:false};
  knob.setPointerCapture(event.pointerId);
 });
 knob.addEventListener('pointermove',event=>{
  if(!drag||event.pointerId!==drag.pointerId)return;
  const range=Number(field.max)-Number(field.min);
  const sensitivity=event.shiftKey?480:160;
  const next=drag.value+(drag.y-event.clientY)*range/sensitivity;
  if(changeSynthKnobValue(field,next,false))drag.changed=true;
 });
 function finishDrag(event){
  if(!drag||event.pointerId!==drag.pointerId)return;
  const changed=Number(field.value)!==drag.value;
  drag=null;
  if(knob.hasPointerCapture(event.pointerId))knob.releasePointerCapture(event.pointerId);
  if(changed)field.dispatchEvent(new Event('change',{bubbles:true}));
 }
 knob.addEventListener('pointerup',finishDrag);
 knob.addEventListener('pointercancel',finishDrag);
 knob.addEventListener('keydown',event=>{
  const step=Number(field.step)||0.01;
  let next;
  switch(event.key){
   case 'ArrowUp':case 'ArrowRight':next=Number(field.value)+step;break;
   case 'ArrowDown':case 'ArrowLeft':next=Number(field.value)-step;break;
   case 'PageUp':next=Number(field.value)+step*10;break;
   case 'PageDown':next=Number(field.value)-step*10;break;
   case 'Home':next=Number(field.min);break;
   case 'End':next=Number(field.max);break;
   default:return;
  }
  event.preventDefault();changeSynthKnobValue(field,next,true);
 });
 control.querySelectorAll('[data-synth-step]').forEach(button=>{
  button.addEventListener('click',()=>changeSynthKnobValue(field,Number(field.value)+Number(button.dataset.synthStep)*Number(field.step),true));
 });
}
$('synthPreview').onclick=()=>$('instrumentPreview').click();

$('trackName').onchange = e => { getTrack().name = e.target.value.trim() || getTrack().name || 'トラック'; markDirty(); renderStudio(); };
$('instrumentSelect').onchange = e => { pushUndo(); const track=getTrack(); track.instrument = e.target.value; if(track.instrument==='synth'&&!track.synth)track.synth=globalThis.WaveSynth?.defaultPreset('warm_pad'); markDirty(); renderStudio(); if(track.instrument==='synth')$('waveSynthDesignerOpen').click(); };
$('trackVolume').oninput = e => { getTrack().volume = Number(e.target.value); markDirty(); syncMixerAudio();renderMixer(); };
$('trackPan').oninput = e => { getTrack().pan = Number(e.target.value); markDirty();renderMixer(); };
$('trackMute').onchange = e => { getTrack().muted = e.target.checked; markDirty(); syncMixerAudio();renderStudio(); };
$('trackSolo').onchange = e => { getTrack().solo = e.target.checked; markDirty(); syncMixerAudio();renderStudio(); };
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
    step: n.step - start, pitch: n.pitch, length: n.length, velocity: n.velocity, articulation: n.articulation
  }));
  status(`小節をコピーしました（${state.barClipboard.length}ノート）`);
};
$('pasteBar').onclick = () => {
  if (!state.barClipboard) return status('先に小節をコピーしてください', true);
  const track = getTrack();
  const start = state.bar * 16;
  const kept = (track.notes || []).filter(n => n.step < start || n.step >= start + 16);
  const fresh = state.barClipboard.map(n => ({ step: start + n.step, pitch: n.pitch, length: n.length, velocity: n.velocity, articulation: n.articulation }));
  if (!allowedStudioNoteCount(track, (track.notes || []).length - kept.length, fresh.length)) return;
  pushUndo();
  track.notes = kept.concat(fresh);
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
  state.waveViewBeat = 0;
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

function scheduleDrum(c, pitch, time, volume, destination=globalThis.WaveSamples?.output(c)||c.destination) {
  if (pitch <= 62) {
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(140, time);
    o.frequency.exponentialRampToValueAtTime(45, time + 0.12);
    g.gain.setValueAtTime(volume * 0.35, time);
    g.gain.exponentialRampToValueAtTime(0.0001, time + 0.16);
    o.connect(g); g.connect(destination); o.start(time); o.stop(time + 0.18);
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
    source.connect(gain); gain.connect(destination); source.start(time);
    keepAudioNode(source);
  }
}

function scheduleVoice(c, inst, pitch, time, duration, volume = 0.7, pan = 0, destination=globalThis.WaveSamples?.output(c)||c.destination, articulation='legacy', synthConfig=null) {
  if (globalThis.WaveSynth?.schedule(c,inst,pitch,time,duration,volume,pan,keepAudioNode,destination,synthConfig)) return;
  if (globalThis.WaveSamples?.schedule(c,inst,pitch,time,duration,volume,pan,keepAudioNode,destination,articulation)) return;
  if (inst === 'acoustic_drums') inst = 'drums';
  if (inst === 'electric_bass') inst = 'bass';
  if (inst === 'acoustic_guitar') inst = 'pluck';
  if (inst === 'electric_guitar') inst = 'pluck';
  if (inst === 'violin' || inst === 'cello') inst = 'strings';
  if (inst === 'flute') inst = 'sine';
  if (['trumpet','trombone','french_horn','tuba','timpani','cymbals'].includes(inst)) inst = 'saw';
  if (['clarinet','oboe','bassoon','tenor_sax','piccolo'].includes(inst)) inst = 'triangle';
  if (['marimba','xylophone','glockenspiel','vibraphone','harp'].includes(inst)) inst = 'bell';
  if(inst==='contrabass')inst='bass';
  if (inst === 'drums') { scheduleDrum(c, pitch, time, volume,destination); return; }
  const gain = c.createGain();
  const panner = c.createStereoPanner ? c.createStereoPanner() : null;
  const attack = articulation==='legato' ? .015 : inst === 'strings' ? 0.08 : 0.01;
  gain.gain.setValueAtTime(0.0001, time);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.02, volume * 0.22), time + attack);
  const decay = (inst === 'pluck' || inst === 'bell') ? 0.18 : inst === 'piano' ? Math.max(0.3, duration * 0.9) : articulation==='legato'?Math.max(.08,duration):Math.max(0.08, duration * 0.85);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + decay);
  let type = 'sine';
  if (inst === 'saw' || inst === 'strings') type = 'sawtooth';
  if (inst === 'triangle' || inst === 'piano') type = 'triangle';
  if (inst === 'square' || inst === 'bass' || inst === 'pluck') type = 'square';
  const oscillator = c.createOscillator();
  oscillator.type = type;
  oscillator.frequency.value = freq(inst === 'bass' ? pitch - 12 : pitch);
  oscillator.connect(gain);
  if (panner) { gain.connect(panner); panner.pan.value = pan; panner.connect(destination); }
  else gain.connect(destination);
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
    if (panner) g2.connect(panner); else g2.connect(destination);
    o2.start(time); o2.stop(time + 0.38);
    keepAudioNode(o2);
  }
}

function stopAudio(recordStream = true) {
  studioPlayRequest++;
  if (state.endTimer) { clearTimeout(state.endTimer); state.endTimer = null; }
  if (state.schedulerTimer) { clearInterval(state.schedulerTimer); state.schedulerTimer = null; }
  state.currentNodes.forEach(n => { try { n.stop(); } catch (_) {} });
  state.currentNodes.clear();
  state.trackBuses.forEach(bus=>{try{bus.disconnect();}catch(_){}});
  state.trackBuses.clear();
  state.playing = false;
  state.playBar = null;
  renderPlayPosition();
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

function scheduleProject(project, onEnd, startBar=0) {
  const c = audio();
  globalThis.WaveSamples?.setMaster(c,(project.masterVolume??1)*waveStudioMonitor());
  const bpm = Number(project.bpm) || 120;
  const stepDur = 60 / bpm / 4;
  const totalSteps = (Number(project.bars) || 4) * 16;
  const firstStep=Math.max(0,Math.min(totalSteps-16,Math.floor(Number(startBar)||0)*16));
  const remainingSteps=totalSteps-firstStep;
  const totalDuration = remainingSteps * stepDur;
  const start = c.currentTime + 0.05;
  state.playing = true;
  state.playBar=Math.floor(firstStep/16);
  renderPlayPosition();
  const studioPlayback = !state.currentTrack;
  if(studioPlayback){
    state.trackBuses.forEach(bus=>{try{bus.disconnect();}catch(_){}});
    state.trackBuses.clear();
    (project.tracks||[]).forEach((track,index)=>{
      const bus=c.createGain();bus.gain.value=0;
      bus.connect(globalThis.WaveSamples?.output(c)||c.destination);
      state.trackBuses.set(Number(track.id)||index+1,bus);
    });
  }
  const events = [];
  (project.tracks || []).forEach((t,index) => {
    if (!studioPlayback&&t.muted) return;
    const trackNotes=globalThis.WaveArticulation?.compilePhrases(t,totalSteps)||t.notes||[];
    trackNotes.forEach(n => {
      const step = Number(n.step),length=Math.max(.05,Number(n.length)||1);
      if (!Number.isFinite(step) || step >= totalSteps || step+length<=firstStep) return;
      // A tied note that began in an earlier bar is still audible at playback start.
      if(step<firstStep&&n.articulation!=='legato')return;
      const eventStep=Math.max(firstStep,step);
      const phrase=Array.isArray(n.segments)?n.segments.filter(s=>s.step+s.length>firstStep).map(s=>({
        offset:(Math.max(s.step,firstStep)-eventStep)*stepDur,
        duration:(s.step+s.length-Math.max(s.step,firstStep))*stepDur,
        pitch:s.pitch,velocity:s.velocity
      })):null;
      events.push({
        at: (eventStep-firstStep) * stepDur,
        phrase:phrase&&phrase.length>1?phrase:null,
        instrument: t.instrument || 'sine',
        pitch: Number(n.pitch) || 60,
        duration: Math.max(0.05,(length-(eventStep-step))*stepDur),
        volume: studioPlayback?Number(n.velocity??.85):Number(t.volume??.75)*Number(n.velocity??.85),
        pan: Number(t.pan || 0),track:t,trackId:Number(t.id)||index+1,
        articulation:n.articulation||'legacy',synthConfig:t.synth
      });
    });
  });
  events.sort((a, b) => a.at - b.at);
  if(studioPlayback)syncMixerAudio();
  let eventIndex = 0;
  let metroStep = 0;
  const metronome = studioPlayback && $('metronomeToggle')?.checked;
  const lookAhead = 0.45;

  const pump = () => {
    const horizon = c.currentTime + lookAhead;
    const bar=Math.min(Number(project.bars)-1,Math.floor(firstStep/16)+Math.max(0,Math.floor((c.currentTime-start)/(stepDur*16))));
    if(state.playBar!==bar){state.playBar=bar;renderPlayPosition();}
    while (eventIndex < events.length && start + events[eventIndex].at <= horizon) {
      const e = events[eventIndex++];
      const dest=studioPlayback?state.trackBuses.get(e.trackId):(globalThis.WaveSamples?.output(c)||c.destination);
      const pan=studioPlayback?Number(e.track.pan)||0:e.pan;
      if(e.phrase&&e.instrument==='synth'){
        for(const segment of e.phrase){scheduleVoice(c,e.instrument,segment.pitch,start+e.at+segment.offset,segment.duration,e.volume*Number(segment.velocity??.85),pan,dest,e.articulation,e.synthConfig);}
      }else if(e.phrase){
        if(!globalThis.WaveSamples?.schedulePhrase(c,e.instrument,e.phrase,start+e.at,e.volume,pan,keepAudioNode,dest))
          globalThis.WaveArticulation?.scheduleSynthPhrase(c,e.instrument,e.phrase,start+e.at,e.volume,pan,keepAudioNode,dest);
      }else scheduleVoice(c,e.instrument,e.pitch,start+e.at,e.duration,e.volume,pan,dest,e.articulation,e.synthConfig);
    }
    if (metronome) {
      while (metroStep < remainingSteps && start + metroStep * stepDur <= horizon) {
        scheduleMetronome(c, start + metroStep * stepDur, (firstStep+metroStep) % 16 === 0);
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

let studioPlayRequest = 0;
$('playProject').onclick = async () => {
  if (state.playing) return stopAudio();
  stopAudio();
  state.currentTrack = null;
  const request=studioPlayRequest;
  const project=ensureProject();
  if(globalThis.WaveSamples && project.tracks.some(track=>['grand_piano','acoustic_guitar','electric_bass','acoustic_drums','violin','cello','flute','trumpet','clarinet','trombone','french_horn','tuba','oboe','bassoon','tenor_sax','marimba','piccolo','xylophone','glockenspiel','contrabass','harp','vibraphone','timpani','cymbals','electric_guitar'].includes(track.instrument))){
    await globalThis.WaveSamples.preloadProject(audio(),project);
    if(request!==studioPlayRequest)return;
  }
  scheduleProject(project,null,state.playStartBar);
  $('playProject').textContent = '❚❚ 停止';
};
$('stopProject').onclick = () => stopAudio();
$('instrumentPreview').onclick = async () => {
  const track=getTrack(),instrument=track.instrument,c=audio();
  const previewPitch=({"french_horn":53,"tuba":43,"oboe":69,"bassoon":50,"tenor_sax":60,"marimba":60,"piccolo":84,"timpani":60,"xylophone":72,"glockenspiel":84,"cymbals":60,"contrabass":40,"harp":60,"vibraphone":60})[instrument]??60;
  if(['grand_piano','acoustic_guitar','electric_bass','acoustic_drums','violin','cello','flute','trumpet','clarinet','trombone','french_horn','tuba','oboe','bassoon','tenor_sax','marimba','piccolo','xylophone','glockenspiel','contrabass','harp','vibraphone','timpani','cymbals','electric_guitar'].includes(instrument)&&globalThis.WaveSamples){
    await globalThis.WaveSamples.preloadProject(c,{tracks:[{instrument,notes:[{pitch:previewPitch}]}]});
  }
  scheduleVoice(c,instrument,previewPitch,c.currentTime+.05,.35,Number(track.volume??.75),Number(track.pan)||0,globalThis.WaveSamples?.output(c)||c.destination,'legacy',track.synth);
};

$('saveProject').onclick = async () => {
  if (state.saving || state.publishing) return;
  const button=$('saveProject');
  const p=ensureProject();
  const title=String($('projectTitleInput').value || p.title || 'Untitled').trim().slice(0,80) || 'Untitled';
  if(p.title!==title){p.title=title;markDirty();}
  $('projectTitleInput').value=title;
  if (!$('releaseTitle').value.trim() && title !== 'Untitled') $('releaseTitle').value=title;
  const revision=state.editRevision, projectRef=state.project, projectId=state.projectId;
  const snapshot=JSON.parse(JSON.stringify(p));
  state.saving=true;button.disabled=true;
  status('保存中…');
  try{
    const r=await bridge('saveProject',{id:projectId,title,project:snapshot});
    if(!r?.ok){status('保存失敗: '+errorText(r?.error),true);return;}
    if(state.project!==projectRef||state.projectId!==projectId){
      status('以前のプロジェクトは保存されました。現在の編集画面は変更していません。');
      return;
    }
    state.projectId=r.id;
    const changed=state.editRevision!==revision;
    state.dirty=changed;
    saveLocalDraft();
    renderStudio();
    status(changed?'保存中に追加した編集が残っています。もう一度保存してください。':'保存しました');
  }catch(error){
    status('保存エラー: '+String(error?.message||error),true);
  }finally{
    state.saving=false;button.disabled=false;
  }
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
  if(state.saving) return {ok:false,error:'SAVE_IN_PROGRESS'};
  const p=ensureProject();
  const title=String($('projectTitleInput').value || p.title || 'Untitled').trim().slice(0,80) || 'Untitled';
  if(p.title!==title){p.title=title;markDirty();}
  $('projectTitleInput').value=title;
  if(state.projectId&&!state.dirty)return {ok:true,id:state.projectId};

  const revision=state.editRevision,projectRef=state.project,projectId=state.projectId;
  const snapshot=JSON.parse(JSON.stringify(p));
  setPublishFeedback('公開前にプロジェクトを保存しています…');
  state.saving=true;
  try{
    const saved=await bridge('saveProject',{id:projectId,title,project:snapshot});
    if(!saved?.ok)return saved||{ok:false,error:'EMPTY_RESPONSE'};
    if(state.project!==projectRef||state.projectId!==projectId)return {ok:false,error:'PROJECT_CHANGED_DURING_SAVE'};
    state.projectId=saved.id;
    const changed=state.editRevision!==revision;
    state.dirty=changed;
    saveLocalDraft();
    renderStudio();
    if(changed)return {ok:false,error:'PROJECT_CHANGED_DURING_SAVE'};
    return saved;
  }finally{state.saving=false;}
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
      project: JSON.parse(JSON.stringify(p))
    });

    if (r?.ok) {
      $('rightsConfirm').checked = false;
      // Publishing is complete at this point. Refresh errors must never be
      // described as a failed publish (which would encourage duplicate retries).
      const refreshResults=await Promise.allSettled([refreshHome(),loadLibrary(),loadOwnReleases()]);
      const needsRefresh=refreshResults.some(result=>result.status==='rejected'||result.value===false);
      const message=needsRefresh?'公開は成功しました。一覧を取得できないため、後で再読み込みしてください。':'公開しました。HOMEとLibraryを更新しました。';
      setPublishFeedback(message,needsRefresh);
      status(message,needsRefresh);
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

function syncTrackFavorite(trackId, favorite) {
  const id=Number(trackId);
  const apply=list=>{ if(Array.isArray(list)) list.forEach(track=>{ if(Number(track.id)===id) track.favorite=favorite; }); };
  apply(state.tracks);
  apply(state.library);
  apply(state.queue);
  if(state.currentTrack && Number(state.currentTrack.id)===id) state.currentTrack.favorite=favorite;
  if(state.homeSections) Object.values(state.homeSections).forEach(apply);
  if(state.currentTrack && Number(state.currentTrack.id)===id && $('miniFavorite')) $('miniFavorite').textContent=favorite?'♥':'♡';
}

function renderTrackList(el, tracks, options = {}) {
  el.innerHTML = '';
  if (!tracks?.length) { el.innerHTML = '<div class="muted">まだ曲がありません。</div>'; return; }
  tracks.forEach((t, trackIndex) => {
    const row = document.createElement('div');
    row.className = 'track';
    const preview = t.preview ? '<span class="preview-badge">試聴</span>' : '';
    const access = t.owned ? '<span class="access-badge">購入済み</span>' : '';
    const removeLibrary = options.library && t.favorite === true ? '<button data-remove-library class="secondary" title="ライブラリから外す" aria-label="ライブラリから外す">外す</button>' : '';
    row.innerHTML = `<div class="cover">W</div><div class="track-meta clickable"><strong>${escapeHtml(t.title)} ${preview} ${access}</strong><span>${escapeHtml(t.artist_name || 'Unknown')} · ${escapeHtml(t.genre || '')}</span></div><div class="track-actions">${removeLibrary}<button data-play>▶</button><button data-more class="secondary">⋯</button></div>`;
    row.querySelector('[data-play]').dataset.waveTrackId = String(t.id);
    row.querySelector('[data-play]').onclick = () => toggleWaveTrack(t, tracks, trackIndex);
    row.querySelector('[data-more]').onclick = () => openTrack(t);
    const removeButton=row.querySelector('[data-remove-library]');
    if(removeButton) removeButton.onclick=async()=>{
      removeButton.disabled=true;
      try {
        const result=await bridge('removeLibraryTrack',{trackId:t.id});
        if(!result?.ok) return status('ライブラリ解除失敗: '+errorText(result?.error),true);
        syncTrackFavorite(t.id,false);
        const refreshed=await loadLibrary();
        await refreshHome();
        status(refreshed?(result.removed?'ライブラリから外しました':'すでに保存解除済みです'):'ライブラリを更新できませんでした。更新を押してください',!refreshed);
      } catch(error) {
        status('ライブラリ解除の通信エラー: '+String(error?.message||error||'UNKNOWN_ERROR'),true);
      } finally { removeButton.disabled=false; }
    };
    row.querySelector('.track-meta').onclick = () => t.artist_id && openArtist(t.artist_id);
    el.appendChild(row);
  });
  updateWavePlaybackButtons();
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

// Newer HOME/Library/search requests take precedence over older network replies.
let waveHomeRequestId=0;
let waveLibraryRequestId=0;
let waveSearchRequestId=0;

async function refreshHome() {
  const requestId=++waveHomeRequestId;
  const r = await bridge('listHome');
  if(requestId!==waveHomeRequestId) return true;
  if (r.ok) {
    state.tracks = r.tracks || [];
    state.homeSections = r.sections || { newest: state.tracks };
    renderHomeSections(state.homeSections);
    status('');
  } else status('読み込み失敗: ' + errorText(r.error), true);
  return Boolean(r.ok);
}
$('refreshHome').onclick = refreshHome;

$('searchButton').onclick = async () => {
  const requestId=++waveSearchRequestId;
  const query=$('searchInput').value;
  status('検索中…');
  const r = await bridge('search', { q: query });
  if(requestId!==waveSearchRequestId || query!==$('searchInput').value) return;
  if (r.ok) {
    renderArtistResults(r.artists || []);
    renderTrackList($('searchTracks'), r.tracks || []);
    status('');
  } else status('検索失敗: ' + errorText(r.error), true);
};
$('searchInput').addEventListener('keydown', e => { if (e.key === 'Enter') $('searchButton').click(); });

async function loadLibrary() {
  const requestId=++waveLibraryRequestId;
  const r = await bridge('listLibrary');
  if(requestId!==waveLibraryRequestId) return true;
  if (!r.ok){status('ライブラリ取得失敗: ' + errorText(r.error), true);return false;}
  state.library = r.tracks || [];
  state.projects = r.projects || [];
  state.playlists = r.playlists || [];
  renderTrackList($('libraryTracks'), state.library, {library:true});
  renderProjects();
  renderPlaylists();
  return true;
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
  $('dialogPlaylist').innerHTML = `<div class="eyebrow">PLAYLIST</div><h2>${escapeHtml(p.name)}</h2><p class="muted">${escapeHtml(p.description || '')}</p><p class="muted playlist-help">↑↓で曲順を変更できます。「外す」はこのプレイリストへの登録だけを解除します。</p><div class="playlist-toolbar"><div class="playlist-main-actions"><button type="button" id="playlistPlayAll">▶ 全曲再生</button><button type="button" id="playlistRename" class="secondary">名前を変更</button><button type="button" id="playlistDelete" class="danger">プレイリストを削除</button></div><div class="playlist-mode-actions" aria-label="再生順とリピート"><button type="button" id="playlistShuffle" class="player-mode secondary" title="シャッフルOFF" aria-label="シャッフルOFF" aria-pressed="false">🔀</button><button type="button" id="playlistRepeat" class="player-mode secondary" title="リピートOFF" aria-label="リピートOFF">↻</button></div></div><div id="playlistDialogTracks"></div>`;
  updateWaveModeButtons();
  $('playlistShuffle').onclick = toggleWaveShuffle;
  $('playlistRepeat').onclick = cycleWaveRepeat;
  const list = $('playlistDialogTracks');
  if (!tracks.length) list.innerHTML = '<div class="muted">まだ曲がありません。</div>';
  tracks.forEach((t, playlistIndex) => {
    const row = document.createElement('div');
    row.className = 'playlist-track';
    row.innerHTML = `<div><strong>${escapeHtml(t.title)}</strong><span>${escapeHtml(t.artist_name || '')}</span></div><div class="playlist-track-actions"><div class="playlist-track-order"><button data-move="up" class="secondary" title="上へ移動" aria-label="${escapeHtml(t.title)}を上へ">↑</button><button data-move="down" class="secondary" title="下へ移動" aria-label="${escapeHtml(t.title)}を下へ">↓</button></div><div class="playlist-track-play-remove"><button data-play aria-label="${escapeHtml(t.title)}を再生">▶</button><button data-remove class="secondary" title="プレイリストから外す" aria-label="プレイリストから外す">外す</button></div></div>`;
    row.querySelector('[data-play]').dataset.waveTrackId = String(t.id);
    row.querySelector('[data-play]').onclick = () => toggleWaveTrack(t, tracks, playlistIndex);
    const moveUp=row.querySelector('[data-move="up"]');
    const moveDown=row.querySelector('[data-move="down"]');
    moveUp.disabled=playlistIndex===0;
    moveDown.disabled=playlistIndex===tracks.length-1;
    const move=async direction=>{
      moveUp.disabled=true;moveDown.disabled=true;
      try {
        const result=await bridge('movePlaylistTrack',{playlistId:p.id,trackId:t.id,direction});
        if(result?.ok){state.playlists=result.playlists||state.playlists;renderPlaylists();await openPlaylist(p.id);status(result.moved?'プレイリストの曲順を変更しました':'これ以上移動できません');}
        else{status('曲順変更失敗: '+errorText(result?.error),true);moveUp.disabled=playlistIndex===0;moveDown.disabled=playlistIndex===tracks.length-1;}
      } catch(error) {
        status('曲順変更の通信エラー: '+String(error?.message||error||'UNKNOWN_ERROR'),true);
        moveUp.disabled=playlistIndex===0;moveDown.disabled=playlistIndex===tracks.length-1;
      }
    };
    moveUp.onclick=()=>move('up');
    moveDown.onclick=()=>move('down');
    row.querySelector('[data-remove]').onclick = async event => {
      const button=event.currentTarget;
      button.disabled=true;
      try {
        const rr = await bridge('removePlaylistTrack', { playlistId: p.id, trackId: t.id });
        if (rr?.ok) {state.playlists=rr.playlists||state.playlists;renderPlaylists();await openPlaylist(p.id);status('プレイリストから曲を外しました。再生中の曲はそのまま再生します');}
        else status('プレイリストから外せませんでした: ' + errorText(rr?.error), true);
      } catch(error) {
        status('プレイリスト解除の通信エラー: '+String(error?.message||error||'UNKNOWN_ERROR'),true);
      } finally { if(button.isConnected) button.disabled=false; }
    };
    list.appendChild(row);
  });
  $('playlistPlayAll').disabled = !tracks.length;
  $('playlistPlayAll').onclick = () => { if (tracks.length) toggleWaveCollection(tracks); };
  $('playlistPlayAll').dataset.waveCollectionIds = tracks.map(t => t.id).join(',');
  updateWavePlaybackButtons();
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
    if (!await waveConfirm('このプレイリストと、登録した曲の一覧だけを削除します。曲本体・公開情報・販売記録・購入権利は残ります。削除しますか？')) return;
    const rr = await bridge('deletePlaylist', { playlistId: p.id });
    if (rr.ok) {
      state.playlists = rr.playlists || [];
      renderPlaylists();
      $('playlistDialog').close();
      status('プレイリストと登録曲一覧を削除しました。曲本体と購入権利は残っています');
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
  $('albumPlayAll').onclick = () => { if (albumTracks.length) toggleWaveCollection(albumTracks); };
  $('albumPlayAll').dataset.waveCollectionIds = albumTracks.map(t => t.id).join(',');
  updateWavePlaybackButtons();
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
  state.waveViewBeat = 0;
  state.dirty = false;
  state.undoStack = []; state.redoStack = []; state.barClipboard = null;
  saveLocalDraft();
  renderStudio();
  showView('studio');
  status('プロジェクトを読み込みました');
}

// Album, playlist and Library playback is owned by the resource's persistent
// NUI page, NOT the LB Phone iframe. Closing the handset must not end music.
let wavePlayerRequest = 0;
let wavePlayerApplied = 0;
let wavePlayerSessionSeen = 0;
let waveModePending = false;
let wavePlayerInfo = {playing:false,paused:false,loading:false,track:null};
let wavePlayPending = false;
// Listener volume applies ONLY to the persistent Library playback engine.
// Studio track/mixer/master levels and published project JSON remain unchanged.
let waveVolumeChangeSeq=0;let waveVolumeUpdateTimer=null;
(function installListenerVolumeControl(){
 const mini=$('miniPlayer');if(!mini||document.getElementById('waveListenerVolumeButton'))return;
 const style=document.createElement('style');style.id='wave-listener-volume-style';
 style.textContent=`
 .wave-listener-volume-button{min-width:2rem;max-width:2.6rem;padding:.4rem!important;background:var(--panel2)!important;color:#e6faff!important}
 .wave-listener-volume-panel{position:absolute;bottom:calc(100% + .4rem);right:0;width:min(17rem,calc(100vw - 1.2rem));padding:.65rem .8rem;border-radius:.85rem;border:1px solid rgba(114,229,255,.4);background:#101a2d;box-shadow:0 .3rem 1.4rem #000a;display:flex;align-items:center;gap:.5rem;z-index:15}
 .wave-listener-volume-panel[hidden]{display:none!important}
 .wave-listener-volume-panel label{white-space:nowrap;font-size:.73rem;color:#e2e8f0}
 .wave-listener-volume-panel input[type=range]{min-width:3.5rem;flex:1;width:100%;padding:0;accent-color:#72e5ff}
 .wave-listener-volume-panel output{white-space:nowrap;font-size:.74rem;min-width:2.5rem;text-align:right}
 `;
 document.head.appendChild(style);
 const button=document.createElement('button');button.id='waveListenerVolumeButton';button.type='button';button.className='secondary wave-listener-volume-button';
 button.textContent='🔊';button.title='聴く側の音量';button.setAttribute('aria-label','聴く側の音量');button.setAttribute('aria-expanded','false');
 const panel=document.createElement('div');panel.id='waveListenerVolumePanel';panel.className='wave-listener-volume-panel';panel.hidden=true;
 panel.innerHTML='<label for="waveListenerVolume">音量</label><input id="waveListenerVolume" type="range" min="0" max="100" step="1" value="100" aria-label="聴く側の音量"><output id="waveListenerVolumeValue" for="waveListenerVolume">100%</output>';
 const slider=panel.querySelector('input');const output=panel.querySelector('output');
 button.addEventListener('click',()=>{panel.hidden=!panel.hidden;button.setAttribute('aria-expanded',String(!panel.hidden));});
 document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!panel.hidden){panel.hidden=true;button.setAttribute('aria-expanded','false');}});
 const buttonBefore=$('miniFavorite');mini.insertBefore(button,buttonBefore||null);mini.appendChild(panel);
 slider.addEventListener('input',()=>{
  const volume=Math.max(0,Math.min(1,Number(slider.value)/100));
  output.textContent=Math.round(volume*100)+'%';button.textContent=volume===0?'🔇':volume<.5?'🔉':'🔊';
  const seq=++waveVolumeChangeSeq;
  clearTimeout(waveVolumeUpdateTimer);
  waveVolumeUpdateTimer=setTimeout(()=>{
   void wavePlayerCommand('setVolume',{value:volume}).then(ok=>{
    if(!ok&&seq===waveVolumeChangeSeq)void wavePlayerRefresh();
   });
  },65);
 });
})();
function updateWaveListenerVolume(info){
 const volume=Number(info?.volume);if(!Number.isFinite(volume))return;
 const slider=$('waveListenerVolume'),output=$('waveListenerVolumeValue'),button=$('waveListenerVolumeButton');
 if(!slider||!output||!button)return;
 if(document.activeElement===slider)return; // prevent status polling from fighting a drag
 const pct=Math.max(0,Math.min(100,Math.round(volume*100)));
 slider.value=String(pct);output.textContent=pct+'%';button.textContent=pct===0?'🔇':pct<50?'🔉':'🔊';
}

function wavePlaybackLabel(active, loading, longLabel=false) {
  if (loading) return '◌ 読み込み中';
  return active ? (longLabel ? '⏸ 一時停止' : '⏸') : (longLabel ? '▶ 再生' : '▶');
}
function updateWavePlaybackButtons() {
  const info=wavePlayerInfo;
  const current=Number(info.track?.id);
  const busy=info.loading===true || wavePlayPending;
  for (const button of document.querySelectorAll('[data-wave-track-id]')) {
    const same=Number(button.dataset.waveTrackId)===current;
    const active=same&&info.playing===true&&info.paused!==true;
    button.textContent=wavePlaybackLabel(active,same&&busy);
    button.disabled=busy;
    button.setAttribute('aria-label',same&&busy?'読み込み中':active?'一時停止':'再生');
    button.setAttribute('aria-busy',String(same&&busy));
  }
  for (const button of [$('playlistPlayAll'),$('albumPlayAll')]) {
    if (!button) continue;
    const ids=(button.dataset.waveCollectionIds||'').split(',').map(Number);
    const queued=Array.isArray(state.queue)?state.queue:[];
    const same=ids.length>0&&ids.length===queued.length&&ids.every((id,index)=>id===Number(queued[index]?.id));
    const active=same&&info.playing===true&&info.paused!==true;
    button.textContent=wavePlaybackLabel(active,same&&busy,true);
    button.disabled=busy||ids.length===0;
    button.setAttribute('aria-busy',String(same&&busy));
  }
  const mini=$('miniPlay');
  mini.textContent=wavePlaybackLabel(info.playing===true&&info.paused!==true,busy);
  mini.disabled=busy;
  mini.setAttribute('aria-label',busy?'読み込み中':info.playing===true&&info.paused!==true?'一時停止':'再生');
  mini.setAttribute('aria-busy',String(busy));
}
function toggleWaveTrack(track,queue,index) {
  if (wavePlayPending||wavePlayerInfo.loading) return;
  if (Number(wavePlayerInfo.track?.id)===Number(track.id)) void wavePlayerCommand('toggle');
  else void playTrack(track,queue,index);
}
function toggleWaveCollection(tracks) {
  if (wavePlayPending||wavePlayerInfo.loading||!tracks.length) return;
  const queued=Array.isArray(state.queue)?state.queue:[];
  const sameQueue=tracks.length===queued.length&&tracks.every((track,index)=>Number(track.id)===Number(queued[index]?.id));
  if (sameQueue&&tracks.some(t=>Number(t.id)===Number(wavePlayerInfo.track?.id))) void wavePlayerCommand('toggle');
  else void playTrack(tracks[0],tracks,0);
}
function updateWaveModeButtons() {
  const shuffle=state.waveShuffle===true;
  const repeat=['one','all'].includes(state.waveRepeatMode)?state.waveRepeatMode:'off';
  for (const button of [$('miniShuffle'),$('playlistShuffle')]) {
    if (!button) continue;
    button.classList.toggle('active',shuffle);
    button.setAttribute('aria-pressed',String(shuffle));
    button.title=shuffle?'シャッフルON':'シャッフルOFF';
    button.setAttribute('aria-label',button.title);
    button.disabled=waveModePending;
  }
  for (const button of [$('miniRepeat'),$('playlistRepeat')]) {
    if (!button) continue;
    button.textContent=repeat==='one'?'↻1':'↻';
    button.title=repeat==='one'?'1曲リピート':repeat==='all'?'全曲リピート':'リピートOFF';
    button.setAttribute('aria-label',button.title);
    button.classList.toggle('active',repeat!=='off');
    button.disabled=waveModePending;
  }
}
function applyWavePlayerStatus(info) {
  if (!info || typeof info !== 'object') return;
  const session=Number(info.session || 0);
  if (session < wavePlayerSessionSeen) return;
  if (session > wavePlayerSessionSeen) { wavePlayerSessionSeen=session;wavePlayerApplied=0; }
  const seq = Number(info.sequence || 0);
  if (seq && seq < wavePlayerApplied) return;
  if (seq) wavePlayerApplied = seq;
  wavePlayerInfo=info;
  updateWaveListenerVolume(info);
  if (info.error) status('再生エラー: ' + errorText(info.error), true);
  state.waveRepeatMode=['one','all'].includes(info.repeatMode)?info.repeatMode:'off';
  state.waveShuffle=info.shuffle===true;
  updateWaveModeButtons();
  const item = info.track;
  if (!item) {
    state.currentTrack = null;
    $('miniPlayer').classList.add('hidden');
    updateWavePlaybackButtons();
    return;
  }
  // Keep the Library's richer track object when it represents the same song.
  const old = state.currentTrack;
  state.currentTrack = old && Number(old.id) === Number(item.id) ? {...old, ...item} : item;
  state.queueIndex = Number.isInteger(info.index) ? info.index : -1;
  $('miniPlayer').classList.remove('hidden');
  $('miniTitle').textContent = item.title || '---';
  $('miniArtist').textContent = (item.artist_name || '') + (item.preview ? ' · 試聴' : '');
  updateWavePlaybackButtons();
  $('miniFavorite').textContent = state.currentTrack.favorite ? '♥' : '♡';
}
async function wavePlayerCommand(command, payload = {}) {
  if (['play','toggle','next','previous'].includes(command) && wavePlayPending) return false;
  const call = ++wavePlayerRequest;
  const controlsPlayback=['play','toggle','next','previous'].includes(command);
  if (controlsPlayback) { wavePlayPending=true;updateWavePlaybackButtons(); }
  let r;
  try { r = await bridge('wavePlayerCommand', {command, ...payload}); }
  catch (error) { r={ok:false,error:String(error)}; }
  finally { if (controlsPlayback) { wavePlayPending=false;updateWavePlaybackButtons(); } }
  if (!r?.ok) {
    if (call === wavePlayerRequest) status('音楽再生: ' + errorText(r?.error || 'NUI_FAILED'), true);
    void wavePlayerRefresh();
    return false;
  }
  if (r.player) applyWavePlayerStatus(r.player);
  if (r.player?.loading) setTimeout(() => { void wavePlayerRefresh(); }, 300);
  return true;
}
// A NUI response can outlive the next 2-second poll. Coalesce simultaneous
// requests so slow connections never build an unbounded queue of polls.
let wavePlayerRefreshInFlight = null;
async function wavePlayerRefresh() {
  if (window.WaveScreen?.parked) return;
  if (wavePlayerRefreshInFlight) return wavePlayerRefreshInFlight;
  const request = (async () => {
    try {
      const r = await bridge('wavePlayerStatus');
      if (r?.ok && !window.WaveScreen?.parked) applyWavePlayerStatus(r.player);
    } catch (_) {
      // The next refresh may recover; never leave the in-flight guard stuck.
    }
  })();
  wavePlayerRefreshInFlight = request;
  try { return await request; }
  finally { if (wavePlayerRefreshInFlight === request) wavePlayerRefreshInFlight = null; }
}
async function playTrack(t, queue = null, queueIndex = null) {
  if (!t) return;
  stopAudio(false); // Stop only Studio's local audio; background music is separate.
  const items = Array.isArray(queue) && queue.length ? queue : [t];
  const index = Number.isInteger(queueIndex) ? queueIndex : Math.max(0, items.findIndex(x => Number(x.id) === Number(t.id)));
  if (!items[index] || !items[index].project) return status('曲を読み込めません。', true);
  // A queue is an ordered snapshot of authorized tracks supplied by WAVE's
  // backend. The persistent player never asks for other users' private tracks.
  state.queue = items;
  state.queueIndex = index;
  const packedQueue = items.map(x => ({
    id: x.id, title: x.title, artist_name: x.artist_name, favorite: x.favorite === true,
    preview: x.preview === true, project: x.project
  }));
  if (JSON.stringify(packedQueue).length > 12 * 1024 * 1024) return status(errorText('AUDIO_QUEUE_TOO_LARGE'), true);
  const ok = await wavePlayerCommand('play', {queue: packedQueue, index});
  if (ok) await wavePlayerRefresh();
}
function playQueueStep(direction, wrap = true) {
  // The background player owns the live index; even after closing/reopening
  // the phone there is exactly one queue cursor.
  void wavePlayerCommand(direction < 0 ? 'previous' : 'next', {wrap});
}
$('miniPrev').onclick = () => playQueueStep(-1, true);
$('miniNext').onclick = () => playQueueStep(1, true);
$('miniPlay').onclick = () => { if (!wavePlayPending && !wavePlayerInfo.loading) void wavePlayerCommand('toggle'); };
async function changeWaveMode(command,value) {
  if (waveModePending) return;
  waveModePending=true;updateWaveModeButtons();
  try {
    if (!await wavePlayerCommand(command,{value})) await wavePlayerRefresh();
  } finally { waveModePending=false;updateWaveModeButtons(); }
}
function toggleWaveShuffle() { void changeWaveMode('setShuffle',state.waveShuffle!==true); }
function cycleWaveRepeat() {
  const order = {off:'all',all:'one',one:'off'};
  void changeWaveMode('setRepeat',order[state.waveRepeatMode || 'off'] || 'off');
}
$('miniShuffle').onclick = toggleWaveShuffle;
$('miniRepeat').onclick = cycleWaveRepeat;
// Active playback stays responsive (2 s); while idle use a 10-second poll.
// Screen focus and the existing boot refresh always request the current state.
// Parked / hidden screens issue no poll, avoiding repeated NUI traffic.
let waveIdlePollTick = 0;
setInterval(() => {
  if (document.visibilityState === 'hidden' || window.WaveScreen?.parked) return;
  const active = wavePlayerInfo.playing === true || wavePlayerInfo.loading === true || wavePlayPending;
  if (active) waveIdlePollTick = 0;
  else if (++waveIdlePollTick % 5 !== 0) return;
  void wavePlayerRefresh();
}, 2000);
window.addEventListener('focus', () => { waveIdlePollTick = 0; void wavePlayerRefresh(); });
$('miniFavorite').onclick = async () => {
  if (!state.currentTrack) return;
  const trackId=state.currentTrack.id;
  const r = await bridge('toggleFavorite', { trackId });
  if (r.ok) {
    syncTrackFavorite(trackId,r.favorite);
    if(document.getElementById('view-library')?.classList.contains('active')) await loadLibrary();
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
  $('dialogTrack').innerHTML = `<div class="cover" style="width:5rem;height:5rem;margin-bottom:.7rem">W</div><h2>${escapeHtml(t.title)}</h2><button type="button" id="dlgArtist" class="text-button">${escapeHtml(t.artist_name || '')}</button><p class="muted">${escapeHtml(t.description || '')}</p><p>${accessText}</p>${previewText}<div class="dialog-actions"><button type="button" id="dlgPlay">▶ 再生</button>${buy ? '<button type="button" id="dlgBuy">購入 ' + money(t.price) + '</button>' : ''}<button type="button" id="dlgFav" class="secondary">${t.favorite ? 'ライブラリから外す' : 'ライブラリに保存'}</button><button type="button" id="dlgReport" class="secondary">通報</button></div>${playlistUi}${rights.ringtone ? '<p class="muted">着信音利用可（LB Phone実連携は次段階）</p>' : ''}`;
  if (!$('trackDialog').open) $('trackDialog').showModal();
  $('dlgPlay').dataset.waveTrackId = String(t.id);
  $('dlgPlay').onclick = () => { toggleWaveTrack(t); $('trackDialog').close(); };
  updateWavePlaybackButtons();
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
    const r = t.favorite ? await bridge('removeLibraryTrack',{trackId:t.id}) : await bridge('toggleFavorite', { trackId: t.id });
    if (r.ok) { syncTrackFavorite(t.id,r.favorite); await loadLibrary(); openTrack(t); status(r.favorite?'ライブラリに保存しました':'ライブラリから外しました'); }
  };
  if ($('dlgAddPlaylist')) $('dlgAddPlaylist').onclick = async () => {
    const playlistId = Number($('dlgPlaylist').value);
    const r = await bridge('addPlaylistTrack', { playlistId, trackId: t.id });
    if (r.ok) {
      waveConfirmation(r.added===false?'この曲はプレイリストに登録済みです':'「' + String(t.title || '曲') + '」をプレイリストに追加しました');
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
    return false;
  }
  state.ownReleases = (r.tracks || []).filter(track => track.status !== 'deleted');
  renderOwnReleases();
  return true;
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
  renderSynthUserPresets();
  void loadSynthUserPresets();
  void wavePlayerRefresh();
  status(restored ? '端末内の未保存下書きを復元しました' : '');
  return true;
}

window.addEventListener('beforeunload', () => {
  if (state.dirty) saveLocalDraft();
  // Only Studio playback belongs to this iframe. WAVE music survives closing it.
  stopAudio(false);
});

window.WaveBoot=boot;
if(!window.WaveScreen?.expanded)window.WaveBootPromise=boot();
