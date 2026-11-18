import {Performance,Replicas,DEFAULT_KEYS,PIANO_KEYS,EXPANDED_KEYS,recommendedPianoOctave,recommendedHomeOctave,recommendedExpandedOctave,DRUM_KEYS,DRUM_PITCHES,RESERVED,validBindings,remapBinding,noteName,keyLabel} from './model.mjs';
import {AudioRack} from './audio.mjs';
import {MidiInput} from './midi.mjs';
import {panelWindow} from './panel-window.mjs';

const $=id=>document.getElementById(id);
const preview=typeof GetParentResourceName!=='function';
const resource=preview?'flecity_jam':GetParentResourceName();
let catalog,model,audio,session=null,shown=false,starting=false,startGeneration=0,sequence=0;
let pending=[],flushTimer=0,transport={session:null,queue:Promise.resolve(),queued:0},capture=null,reserved=[];
let layout='home18',keySets={home18:[...DEFAULT_KEYS],piano:[...PIANO_KEYS],legacy:[...DEFAULT_KEYS],expanded:[...EXPANDED_KEYS],drums:[...DRUM_KEYS]},keys,zoom=100;
let velocity=100,performVolume=75,showGuide=true;
let keyboardBounds='',keyboardWhites=0,viewWidth=0,viewUnit=0,viewAnchor=0,legacyImported=false;
let listen=.65,muted=false,metronome=null,metroPending=false,metroGeneration=0,nextBeat=0,beat=0,noticeTimer=0;
let listenOnlyOpen=false,listenCheck=0;
const queuedNotes=new Map();
let automaticVoice=true;
const pedalSources=new Set();
const metroVoices=new Set();
const voiceSources=new Set();
let voiceToken=null,voiceEnabled=false,voiceSeq=0,voiceTimer=0,voiceTalking=false,voiceLane={pending:false};
const now=()=>performance.now();
const resumeAudioButton=document.createElement('button');
resumeAudioButton.id='resumeAudio';resumeAudioButton.type='button';resumeAudioButton.hidden=true;
resumeAudioButton.textContent='JAMの音声を有効にする';resumeAudioButton.style.pointerEvents='auto';
$('feedback').append(resumeAudioButton);
function error(message='') {$('error').textContent=message;$('error').hidden=!message;}
function notice(message) {$('notice').textContent=message;$('notice').hidden=false;clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>$('notice').hidden=true,6000);}
function save() {
  keySets[layout]=[...keys];
  try{localStorage.setItem('flecity-jam-v5',JSON.stringify({version:5,layout,bindings:keySets,listen,muted,zoom,velocity,performVolume,showGuide}));return true;}catch{notice('設定を端末へ保存できませんでした。今回の演奏には使用できます。');return false;}
}
function readPrefs(name) {try{const value=JSON.parse(localStorage.getItem(name)||'{}');return value&&typeof value==='object'?value:{};}catch{return {};}}
const legacyPrefs=readPrefs('flecity-jam-v1'),previousPrefs=readPrefs('flecity-jam-v2'),version3Prefs=readPrefs('flecity-jam-v3'),version4Prefs=readPrefs('flecity-jam-v4'),prefs=readPrefs('flecity-jam-v5');
if(validBindings(legacyPrefs.keys,[],'legacy')){
  keySets.legacy=[...legacyPrefs.keys];
  if(legacyPrefs.keys.some((code,i)=>code!==DEFAULT_KEYS[i])){layout='legacy';legacyImported=true;}
}
for(const mode of ['legacy','expanded'])if(validBindings(previousPrefs.bindings?.[mode],[],mode))keySets[mode]=[...previousPrefs.bindings[mode]];
const previousKeys=['legacy','expanded'].includes(previousPrefs.layout)?keySets[previousPrefs.layout]:undefined,previousDefault=previousPrefs.layout==='legacy'?DEFAULT_KEYS:EXPANDED_KEYS;
if(previousKeys){layout=previousKeys.some((code,i)=>code!==previousDefault[i])?previousPrefs.layout:'home18';if(layout!=='home18')legacyImported=true;}
for(const mode of ['piano','legacy','expanded'])if(validBindings(version3Prefs.bindings?.[mode],[],mode))keySets[mode]=[...version3Prefs.bindings[mode]];
if(['piano','legacy','expanded'].includes(version3Prefs.layout)&&validBindings(version3Prefs.bindings?.[version3Prefs.layout],[],version3Prefs.layout)){
  const stockPiano=version3Prefs.layout==='piano'&&version3Prefs.bindings.piano.every((code,i)=>code===PIANO_KEYS[i]);
  layout=stockPiano?'home18':version3Prefs.layout;
}
for(const source of [version4Prefs,prefs]){
  for(const mode of ['home18','piano','legacy','expanded','drums'])if(validBindings(source.bindings?.[mode],[],mode))keySets[mode]=[...source.bindings[mode]];
  if(['home18','piano','legacy','expanded'].includes(source.layout)&&validBindings(source.bindings?.[source.layout],[],source.layout))layout=source.layout;
}
for(const source of [legacyPrefs,previousPrefs,version3Prefs,version4Prefs,prefs]){
  if(Number.isFinite(source.listen))listen=Math.max(0,Math.min(1,source.listen));
  if(typeof source.muted==='boolean')muted=source.muted;
  if(Number.isFinite(source.zoom))zoom=Math.max(70,Math.min(160,source.zoom));
  if(Number.isInteger(source.velocity)&&source.velocity>=1&&source.velocity<=127)velocity=source.velocity;
  if(Number.isFinite(source.performVolume)&&source.performVolume>=0&&source.performVolume<=100)performVolume=Math.round(source.performVolume);
  if(typeof source.showGuide==='boolean')showGuide=source.showGuide;
}
keys=[...keySets[layout]];

function focusAfterPointer(event) {
  if(event.detail>0||event.type==='pointerup')($('panel').classList.contains('compact')?$('panel'):$('playArea')).focus({preventScroll:true});
}

async function bridge(name,data={}) {
  if(preview) {
    if(name==='start')setTimeout(()=>control({kind:'started',session:'preview:'+Date.now(),instrument:data.instrument,maxNotes:16,maxNoteMs:120000}),10);
    return {ok:true};
  }
  const abort=new AbortController(),timeout=setTimeout(()=>abort.abort(),1800);
  try {
    const response=await fetch(`https://${resource}/${name}`,{method:'POST',headers:{'Content-Type':'application/json; charset=UTF-8'},body:JSON.stringify(data),signal:abort.signal});
    if(!response.ok)throw Error('NUI connection');return await response.json();
  }finally{clearTimeout(timeout);}
}
function drawVoice() {
  const held=voiceSources.size>0;
  $('voice').disabled=!voiceEnabled;$('voice').setAttribute('aria-pressed',String(automaticVoice));
  $('voice').querySelector('kbd').textContent=automaticVoice?'ON':'OFF';
  $('voiceStatus').textContent=preview?'試奏・マイク送信なし':!voiceEnabled?'会話入力 停止':voiceTalking?'送信状態を検出':voiceSources.has('automatic')?'自動会話入力 ON':held?'Nキーの会話入力中':automaticVoice?'演奏開始後に自動ON':'自動会話 OFF';
}
function releaseVoice(tellGame=true) {
  const wasHeld=voiceSources.size>0;voiceSources.clear();clearInterval(voiceTimer);voiceTimer=0;
  if(wasHeld&&tellGame)sendVoice(false);drawVoice();
}
function configureVoice(voice) {
  const enabled=voice?.enabled===true&&typeof voice.token==='string'&&voice.token.length>0;
  if(voiceToken!==voice?.token||!enabled){if(!enabled||(voiceToken!==null&&voiceToken!==voice?.token))automaticVoice=false;releaseVoice(false);voiceSeq=0;voiceTalking=false;voiceLane={pending:false};}
  voiceToken=enabled?voice.token:null;voiceEnabled=enabled;drawVoice();if(enabled&&automaticVoice&&session)syncAutomaticVoice();
}
function syncAutomaticVoice(){voiceSource('automatic',Boolean(shown&&session&&automaticVoice&&voiceEnabled));}
function sendVoice(held) {
  if(held&&voiceSources.has('automatic')&&(document.hidden||!document.hasFocus())){automaticVoice=false;releaseVoice();return;}
  const token=voiceToken,lane=voiceLane;if(!token||(held&&lane.pending))return;
  const seq=++voiceSeq;lane.pending=true;
  const fail=()=>{
    if(voiceToken!==token||voiceSeq!==seq||!held)return;
    automaticVoice=false;releaseVoice(false);voiceEnabled=false;drawVoice();
    bridge('voice',{token,seq:++voiceSeq,held:false}).catch(()=>{});
    error('会話入力の応答を確認できません。Escで閉じて会話し、JAMを開き直してください。');
  };
  const automatic=held&&voiceSources.has('automatic');
  bridge('voice',{token,seq,held,...(automatic?{automatic:true,session}: {})}).then(result=>{if(!result.ok)fail();}).catch(fail).finally(()=>{lane.pending=false;});
}
function voiceSource(source,down) {
  if(down&&(!shown||!voiceEnabled))return;
  const wasHeld=voiceSources.size>0;
  if(down)voiceSources.add(source);else voiceSources.delete(source);
  const held=voiceSources.size>0;
  if(held!==wasHeld){clearInterval(voiceTimer);voiceTimer=held?setInterval(()=>{if(voiceSources.size>0)sendVoice(true);},200):0;sendVoice(held);}
  drawVoice();
}
function failTransport() {
  automaticVoice=false;stop();error('演奏の通信が途切れました。音と自動会話を止めました。キーを離して、もう一度鍵盤を押してください。');
}
function requestNote(key,pitch,strength=velocity){
  if(!shown||!model||!Number.isInteger(pitch)||pitch<model.spec.min||pitch>model.spec.max)return;
  if(session){model.press(key,pitch,strength);return;}
  if(!queuedNotes.has(key)&&queuedNotes.size>=16)queuedNotes.delete(queuedNotes.keys().next().value);
  queuedNotes.set(key,{pitch,strength,at:now()});if(!starting)start();
}
function releaseNote(key,cancel=false){
  const pendingNote=queuedNotes.get(key);
  if(pendingNote){
    if(cancel){if(pendingNote.releasedAt===undefined)queuedNotes.delete(key);}
    else pendingNote.releasedAt=now();
  }
  model?.release(key);
}
function send(packet) {
  const expected=session,lane=transport,created=now();
  if(!expected||lane.session!==expected)return;
  packet.session=expected;packet.seq=++sequence;
  if(++lane.queued>20){lane.queued--;failTransport();return;}
  lane.queue=lane.queue.then(async()=>{
    if(session!==expected||transport!==lane)return;
    if(now()-created>1500)throw Error('stale queue');
    const result=await bridge('input',packet);if(!result.ok)throw Error('input rejected');
  }).catch(()=>{if(session===expected&&transport===lane)failTransport();}).finally(()=>lane.queued--);
}
function flush() {
  clearTimeout(flushTimer);flushTimer=0;
  if(!session){pending=[];return;}
  while(pending.length)send({kind:'ops',ops:pending.splice(0,32)});
}
function emit(op) {
  if(!session)return;
  pending.push(op);
  if(!flushTimer)flushTimer=setTimeout(flush,8);
}
function syncInput() {
  if(!session||!model)return;
  flush();send({kind:'sync',...model.snapshot()});
}
function redraw() {
  if(!model)return;
  $('octave').textContent=model.octave;
  $('pedalState').textContent=model.sustain?'ON':'OFF';$('sustain').setAttribute('aria-pressed',String(model.sustain));
  $('voiceCount').textContent=model.notes.size+'音';
  const pitches=new Set([...model.notes.values()].map(n=>n.pitch));
  for(const button of $('keyboard').children){button.classList.toggle('pressed',pitches.has(Number(button.dataset.pitch)));button.setAttribute('aria-pressed',String(pitches.has(Number(button.dataset.pitch))));}
  for(const cell of $('physicalLayout').querySelectorAll('[data-pitch]'))cell.classList.toggle('pressed',pitches.has(Number(cell.dataset.pitch)));
  if(session)audio.sync('local',{instrument:model.spec.id,...model.snapshot()});
}
function choose(id) {
  capture=null;
  const spec=catalog.instruments.find(s=>s.id===id)||catalog.instruments[0];
  model=new Performance(spec,emit,redraw);model.bindings=[...keys];model.drumBindings=[...keySets.drums];model.volume=Number($('performVolume').value)/100;
  if(layout==='expanded')model.octave=recommendedExpandedOctave(spec);
  if(layout==='piano')model.octave=recommendedPianoOctave(spec);
  if(layout==='home18')model.octave=recommendedHomeOctave(spec);
  $('instrument').value=spec.id;$('sustain').disabled=spec.kind==='drums';$('octDown').disabled=spec.kind==='drums';$('octUp').disabled=spec.kind==='drums';
  $('keyLayout').value=layout;$('keyLayout').disabled=spec.kind==='drums';
  drawKeys(true);redraw();if(!$('settings').hidden)bindings();
}
function drawKeys(center=false) {
  const drums=model.spec.kind==='drums',keyboard=$('keyboard'),base=(model.octave+1)*12;
  const firstPitch=Math.max(0,Math.min(Math.floor(model.spec.min/12)*12,base));
  const lastPitch=Math.min(127,Math.max(Math.ceil(model.spec.max/12)*12,base+36));
  const pitches=drums?DRUM_PITCHES:Array.from({length:lastPitch-firstPitch+1},(_,i)=>firstPitch+i);
  const bounds=(drums?'drums:':'piano:')+pitches.join(',');
  keyboard.classList.toggle('drums',drums);$('keyboardViewControls').hidden=drums;
  if(drums){keyboard.style.removeProperty('width');$('keyboardViewport').scrollLeft=0;viewAnchor=0;}
  if(bounds!==keyboardBounds){
    keyboardBounds=bounds;keyboard.replaceChildren();let white=0;
    for(const pitch of pitches){
      const black=!drums&&[1,3,6,8,10].includes(pitch%12),button=document.createElement('button');
      button.type='button';button.className='key'+(black?' black':'');button.dataset.pitch=pitch;button.tabIndex=-1;
      button.style.setProperty('--key-position',String(black?white-.32:white++));
      button.append(document.createElement('kbd'),document.createElement('span'));
      button.addEventListener('pointerdown',e=>{
        if(e.button!==0)return;e.preventDefault();
        button.setPointerCapture(e.pointerId);requestNote('pointer:'+e.pointerId,pitch,velocity);$('playArea').focus({preventScroll:true});
      });
      button.addEventListener('pointerup',e=>releaseNote('pointer:'+e.pointerId));
      for(const type of ['pointercancel','lostpointercapture'])button.addEventListener(type,e=>releaseNote('pointer:'+e.pointerId,true));
      keyboard.append(button);
    }
    keyboardWhites=white;
  }
  for(const button of keyboard.children){
    const pitch=Number(button.dataset.pitch),i=drums?DRUM_PITCHES.indexOf(pitch):pitch-base;
    const code=drums?keySets.drums[i]:keys[i],valid=pitch>=model.spec.min&&pitch<=model.spec.max;
    const assigned=Boolean(code)&&!reserved.includes(code),label=drums?model.spec.samples.find(s=>s.midi===pitch)?.label:noteName(pitch);
    button.classList.toggle('out-of-range',!valid);button.disabled=!valid;
    if(assigned)button.dataset.code=code;else delete button.dataset.code;
    button.classList.toggle('mapped',assigned);button.classList.toggle('bank-middle',!drums&&layout==='expanded'&&i>=12&&i<24);button.classList.toggle('bank-high',!drums&&layout==='expanded'&&i>=24&&i<36);
    button.children[0].textContent=assigned?keyLabel(code):'·';button.children[1].textContent=label;
    button.setAttribute('aria-label',`${label}${valid?'':' 音域外'} (${assigned?keyLabel(code):'マウス・MIDI'})`);
  }
  $('rangeText').textContent=drums?'8 PADS / GM':'楽器 '+noteName(model.spec.min)+' — '+noteName(model.spec.max);
  const count=drums?keySets.drums.filter(code=>!reserved.includes(code)).length:keys.filter((code,i)=>base+i>=model.spec.min&&base+i<=model.spec.max&&!reserved.includes(code)).length;
  $('mappedRange').textContent=drums?'8パッド':`PC ${keys.length}音割当（音域内${count}音） ${noteName(base)} — ${noteName(base+keys.length-1)}`;
  $('layoutHelp').textContent=drums?'8つのドラムパッド：'+keySets.drums.map(keyLabel).join(' ')+'。「キー配置を変更」で自分用に設定できます。':layout==='legacy'?'従来18音の配置を使用中。旧設定は保持されています。':keys.every((code,i)=>code===EXPANDED_KEYS[i])?'下段 A〜\\ / 中段 Q〜] / 上段 1〜=：横は半音、各段は1オクターブ':'カスタム36音：鍵盤に表示されたPCキーで演奏';
  const standardPiano=layout==='piano'&&keys.every((code,i)=>code===PIANO_KEYS[i]);
  const homeGuide=['home18','legacy'].includes(layout)&&keys.every((code,i)=>code===DEFAULT_KEYS[i]);
  const hasGuide=standardPiano||homeGuide;
  if(layout==='piano'&&!drums)$('layoutHelp').textContent=standardPiano?'旧25音：Z/Qの2段。両手が重なる場合は「両手ホーム段18音」へ。↑↓で音域変更。':'カスタム25音：鍵盤上のPCキー表示で演奏。↑↓で音域変更。';
  if(layout==='home18'&&!drums)$('layoutHelp').textContent=homeGuide?'白鍵は A S D F G ｜ H J K L ; :/\'。黒鍵は W E T Y U O P。Yは左右の境界で押しやすい手を使います。18音（C〜次のF）。↑↓で音域変更。':'カスタム18音：鍵盤上のPCキー表示で演奏。↑↓で音域変更。';
  $('physicalLayout').hidden=drums||!hasGuide||!showGuide;
  $('guideToggle').disabled=drums||!hasGuide;
  $('guideToggle').setAttribute('aria-expanded',String(!drums&&hasGuide&&showGuide));
  $('guideToggle').textContent=drums||!hasGuide?'配列ガイド（標準配列用）':showGuide?'配列ガイドを隠す':'配列ガイドを表示';
  if(!drums&&hasGuide){
    $('physicalLayout').replaceChildren();
    const banks=homeGuide?[[0,18,'白鍵：左手 A S D F G ｜ 右手 H J K L ; :/\'']]:[[0,9,'低音段 Z〜B · ド〜ソ'],[9,25,'高音段 Q〜P · ラ〜ド']];
    for(const [first,last,title] of banks){
      const bank=document.createElement('div'),heading=document.createElement('strong'),grid=document.createElement('div');
      bank.className='physical-bank'+(homeGuide?' home18':'');heading.textContent=title;grid.className='physical-keys';let white=0;
      for(let i=first;i<last;i++){
        const pitch=base+i,black=[1,3,6,8,10].includes(pitch%12),cell=document.createElement('span');
        cell.className='pc-key'+(black?' black':'');cell.dataset.code=keys[i];cell.dataset.pitch=base+i;
        if(homeGuide)cell.dataset.hand=i<9?'left':'right';
        cell.style.gridRow=black?'1':'2';cell.style.gridColumn=String(black?white*2:++white*2-1);
        const key=document.createElement('kbd'),note=document.createElement('small');key.textContent=keyLabel(keys[i]);note.textContent=noteName(pitch);cell.append(key,note);
        cell.classList.toggle('unavailable',pitch<model.spec.min||pitch>model.spec.max||reserved.includes(keys[i]));grid.append(cell);
      }
      bank.append(heading,grid);$('physicalLayout').append(bank);
    }
  }
  requestAnimationFrame(()=>fitKeyboard(center));
}
function fitKeyboard(center=false) {
  if(!model||model.spec.kind==='drums')return;
  const viewport=$('keyboardViewport');if(!viewport.clientWidth)return;
  const unit=Math.max(28,viewport.clientWidth/22)*zoom/100;
  if(center){const first=$('keyboard').querySelector('[data-code]');viewAnchor=first?Number(first.style.getPropertyValue('--key-position')):0;}
  viewWidth=viewport.clientWidth;viewUnit=unit;
  $('keyboard').style.setProperty('--white-width',unit+'px');$('keyboard').style.width=(keyboardWhites*unit)+'px';
  $('keyboardZoom').value=zoom;$('zoomValue').textContent=zoom+'%';
  viewport.scrollLeft=viewAnchor*unit;viewAnchor=viewport.scrollLeft/unit;
}
function shiftOctave(amount) {
  if(model.spec.kind==='drums')return;
  model.shift(amount);drawKeys(true);redraw();bindings();
}
function changeLayout(next) {
  if(!['home18','piano','legacy','expanded'].includes(next))return;
  panic();capture=null;keySets[layout]=[...keys];layout=next;keys=[...keySets[layout]];
  model.bindings=[...keys];model.octave=layout==='home18'?recommendedHomeOctave(model.spec):layout==='piano'?recommendedPianoOctave(model.spec):layout==='expanded'?recommendedExpandedOctave(model.spec):model.spec.octave;
  drawKeys(true);redraw();bindings();save();
}
function bindingMode() {return model.spec.kind==='drums'?'drums':layout;}
function activeBindings() {return bindingMode()==='drums'?keySets.drums:keys;}
function applyBindings(next) {
  if(bindingMode()==='drums'){keySets.drums=[...next];model.drumBindings=[...next];}
  else{keys=[...next];model.bindings=[...next];}
}
function bindings() {
  const drums=bindingMode()==='drums';
  $('bindingTarget').textContent=$('instrument').selectedOptions[0].textContent+' / '+(drums?'ドラム8パッド':$('keyLayout').selectedOptions[0].textContent);
  $('cancelBinding').hidden=capture===null;
  $('bindingStatus').textContent=capture===null?'このPCだけに自動保存。変更する音を選び、割り当てたいキーを押してください。':'割り当てたいキーを押してください。使用中のキーなら2音の割り当てを交換します。';
  $('bindings').replaceChildren();activeBindings().forEach((code,i)=>{
    const pitch=drums?DRUM_PITCHES[i]:(model.octave+1)*12+i;
    const label=drums?model.spec.samples.find(s=>s.midi===pitch)?.label||noteName(pitch):noteName(pitch);
    const b=document.createElement('button');b.type='button';b.textContent=label+' · '+keyLabel(code);b.dataset.bindingIndex=i;
    b.classList.toggle('binding-black',!drums&&[1,3,6,8,10].includes(pitch%12));b.classList.toggle('capturing',capture===i);b.setAttribute('aria-pressed',String(capture===i));
    b.addEventListener('click',()=>{releaseVoice();syncAutomaticVoice();panic();capture=i;bindings();$('bindings').children[i].focus({preventScroll:true});});$('bindings').append(b);
  });
}
function setSettings(open) {
  capture=null;if(open&&$('panel').classList.contains('compact'))$('compact').click();
  $('settings').hidden=!open;for(const id of ['settingsToggle','editKeys'])$(id).setAttribute('aria-expanded',String(open));
  if(open)bindings();
}
async function start() {
  if(session||starting||!shown)return;
  const generation=++startGeneration;starting=true;$('panel').setAttribute('aria-busy','true');$('instrument').disabled=true;error();$('status').textContent='音源を準備しています…';
  let stage='audio';
  try {
    if(!await audio.unlock())throw Error('audio unavailable');
    stage='samples';
    await audio.load(model.spec.id);
    if(generation!==startGeneration||!shown)return;
    stage='resume';
    if(!await audio.unlock())throw Error('audio suspended');
    if(generation!==startGeneration||!shown)return;
    stage='server';
    const result=await bridge('start',{instrument:model.spec.id});if(!result.ok)throw Error('演奏を開始できません。');
    setTimeout(()=>{if(starting&&generation===startGeneration){stop();error('サーバーから応答がありません。再度お試しください。');}},5000);
  }catch{if(generation===startGeneration&&starting){stop();error({
    audio:'音声を開始できませんでした。JAMを開き直して、もう一度お試しください。',
    samples:'音源を読み込めませんでした。少し待ってから、もう一度お試しください。',
    resume:'音声を再開できませんでした。JAMを開き直して、もう一度お試しください。',
    server:'演奏の通信を開始できませんでした。少し待ってから、もう一度お試しください。'
  }[stage]);}}
}
function control(data) {
  if(data.kind==='started') {
    if(!shown||!starting){bridge('stop').catch(()=>{});return;}
    listenOnlyOpen=false;listenCheck++;resumeAudioButton.hidden=true;resumeAudioButton.disabled=false;
    session=data.session;transport={session,queue:Promise.resolve(),queued:0};sequence=0;pending=[];starting=false;model.limit=data.maxNotes||16;
    $('panel').setAttribute('aria-busy','false');$('panel').dataset.performing='true';$('instrument').disabled=false;$('lamp').classList.add('active');
    $('status').textContent=preview?'試奏モード · 周囲への共有なし':'演奏中 · 周囲に音が届きます';
    $('playArea').focus({preventScroll:true});syncInput();
    for(const [key,note]of queuedNotes){
      // Preserve the first quick strike only within a small startup window, never replay an old burst after a long load.
      if(note.releasedAt!==undefined&&(now()-note.releasedAt>150||now()-note.at>250))continue;
      model.press(key,note.pitch,note.strength);if(note.releasedAt!==undefined)model.release(key);
    }
    queuedNotes.clear();redraw();syncAutomaticVoice();
  } else if(data.kind==='denied') {
    stop();const reason={permission:'この楽器を使用する権限・アイテムがありません。',capacity:'同時演奏人数の上限です。',cooldown:'少し待ってから開始してください。',unavailable:'現在は演奏できません。'};
    error(reason[data.reason]||'演奏を開始できませんでした。');
  } else if(data.session===session && data.kind==='stopped') {
    stop();error('演奏を終了しました。'+({rate:'入力が速すぎるため、安全停止しました。',expired:'応答または演奏状態を確認できませんでした。',unavailable:'現在は演奏できません。'}[data.reason]||''));
  } else if(data.session===session && data.kind==='resync')syncInput();
}
function stop(continueAutomatic=false) {
  const wasActive=session||starting;
  automaticVoice=continueAutomatic&&automaticVoice;
  releaseVoice();
  if(automaticVoice&&wasActive)voiceToken=null; // Only an active stop rotates the authenticated epoch in Lua.
  startGeneration++;session=null;starting=false;queuedNotes.clear();pending=[];clearTimeout(flushTimer);flushTimer=0;
  transport={session:null,queue:Promise.resolve(),queued:0};
  pedalSources.clear();model?.panic();audio?.remove('local');
  $('panel').setAttribute('aria-busy','false');$('panel').dataset.performing='false';$('instrument').disabled=false;$('lamp').classList.remove('active');
  $('status').textContent='鍵盤を押すと、そのまま演奏できます。';
  if(wasActive)bridge('stop').catch(()=>{});
}
function panic() {queuedNotes.clear();pedalSources.clear();model?.panic();audio?.remove('local');flush();}
function pedal(source,down) {if(down)pedalSources.add(source);else pedalSources.delete(source);model.pedal(pedalSources.size>0);}
function close(tellGame=true) {floatingPanel.cancelDrag();stop();configureVoice(null);stopMetronome();capture=null;shown=false;listenOnlyOpen=false;listenCheck++;resumeAudioButton.hidden=true;resumeAudioButton.disabled=false;$('settings').hidden=true;$('settingsToggle').setAttribute('aria-expanded','false');$('editKeys').setAttribute('aria-expanded','false');$('panel').hidden=true;if(tellGame)bridge('close').catch(()=>{});}
function promptListenAudio() {
  if(!shown||!listenOnlyOpen||audio.ctx?.state==='running')return;
  resumeAudioButton.hidden=false;
  $('status').textContent='音声が停止しています。右上の「JAMの音声を有効にする」を押してください。';
}
function listenAudioReady() {
  if(!shown||!listenOnlyOpen)return;
  resumeAudioButton.hidden=true;error();
  $('status').textContent='周囲のJAM演奏を聴けます。';
}
async function checkListenAudio(manual=false) {
  const check=listenCheck;
  if(manual){resumeAudioButton.disabled=true;error();$('status').textContent='音声の再開を確認しています…';}
  try {
    const ok=await audio.unlock();
    if(check!==listenCheck||!shown||!listenOnlyOpen)return;
    if(!ok&&audio.ctx?.state!=='running')throw Error('audio suspended');
    listenAudioReady();
    if(manual)notice('JAMの音声を有効にしました。');
  }catch{
    if(check!==listenCheck||!shown||!listenOnlyOpen)return;
    if(audio.ctx?.state==='running'){listenAudioReady();return;}
    promptListenAudio();
    if(manual)error('音声を再開できませんでした。もう一度「JAMの音声を有効にする」を押してください。');
  }finally{if(check===listenCheck)resumeAudioButton.disabled=false;}
}
resumeAudioButton.onclick=()=>checkListenAudio(true);
function open(data={}) {
  shown=true;listenOnlyOpen=data.listenOnly===true;listenCheck++;resumeAudioButton.hidden=true;resumeAudioButton.disabled=false;$('panel').hidden=false;error();reserved=Array.isArray(data.reserved)?data.reserved:reserved;
  $('panel').setAttribute('aria-busy',String(starting));$('panel').dataset.performing=String(Boolean(session));
  automaticVoice=true;
  configureVoice(data.voice||(preview?{token:'preview',enabled:true}:null));
  choose(data.instrument||$('instrument').value);$('rangeBadge').textContent=`共有範囲 ${data.range||15}m`;
  if(!validBindings(activeBindings(),reserved,bindingMode()))error('予約キーと重なる割り当ては演奏に使えません。キー設定で変更してください。');
  $('status').textContent=data.listenOnly?'「聴く音量」で周囲の演奏を調整できます。':'鍵盤を押すと演奏開始。自動会話は演奏中だけONになります。';
  $('playArea').focus({preventScroll:true});floatingPanel.layout();
  if(listenOnlyOpen){
    try{audio.init();}catch{}
    promptListenAudio();checkListenAudio();
  }else audio.unlock().catch(()=>{});
  if(legacyImported){legacyImported=false;notice('個人用のキー設定を保持しました。「PC配列」で両手ホーム段18音を選べます。音域変更は↑↓です。');}
}
function setMuted(value) {muted=value;audio.setMute(muted);$('mute').setAttribute('aria-pressed',String(muted));$('mute').textContent=muted?'消音中':'消音';save();}
function stopMetronome() {
  metroGeneration++;metroPending=false;clearInterval(metronome);metronome=null;
  for(const {osc,gain}of metroVoices){try{osc.stop();}catch{}osc.disconnect();gain.disconnect();}
  metroVoices.clear();$('metro').setAttribute('aria-busy','false');$('metro').setAttribute('aria-pressed','false');$('metro').textContent='メトロノーム OFF';
}
async function toggleMetronome() {
  if(metronome||metroPending){stopMetronome();return;}
  const generation=++metroGeneration;metroPending=true;$('metro').setAttribute('aria-busy','true');
  try{if(!await audio.unlock())throw Error('audio suspended');}catch{
    if(generation===metroGeneration){stopMetronome();error('音声を開始できません。');}return;
  }
  if(generation!==metroGeneration||!shown)return;
  metroPending=false;$('metro').setAttribute('aria-busy','false');
  beat=0;nextBeat=audio.ctx.currentTime+.05;$('metro').setAttribute('aria-pressed','true');$('metro').textContent='メトロノーム ON';
  metronome=setInterval(()=>{
    const bpm=Math.max(40,Math.min(240,Number($('bpm').value)||100));
    nextBeat=Math.max(nextBeat,audio.ctx.currentTime);
    while(nextBeat<audio.ctx.currentTime+.1){
      const osc=audio.ctx.createOscillator(),gain=audio.ctx.createGain();osc.frequency.value=beat++%4===0?1200:800;
      const click={osc,gain};metroVoices.add(click);
      gain.gain.setValueAtTime(.08,nextBeat);gain.gain.exponentialRampToValueAtTime(.0001,nextBeat+.04);
      osc.connect(gain).connect(audio.master);osc.start(nextBeat);osc.stop(nextBeat+.05);
      osc.onended=()=>{metroVoices.delete(click);osc.disconnect();gain.disconnect();};nextBeat+=60/bpm;
    }
  },25);
}

const floatingPanel=panelWindow($('panel'),$('panelDrag'),$('resetPanel'),$('panelSize'),()=>notice('画面位置を保存できませんでした。今回のみ使用できます。'));
const midi=new MidiInput({press:requestNote,release:releaseNote,pedal:down=>{if(shown)pedal('midi',down);},panic,
  status:text=>$('midiStatus').textContent=text,devices:list=>{
    const select=$('midiDevice'),selected=select.value;select.replaceChildren();select.disabled=!list.length;
    if(!list.length)select.add(new Option('未接続',''));for(const p of list)select.add(new Option(p.name,p.id));
    if(list.some(p=>p.id===selected))select.value=selected;
  }});
let peerMixSignature='';
const peerVolumes=new Map();
function refreshPeerMix() {
  const entries=[...replicas.states.entries()].sort(([a],[b])=>a-b);
  $('nearby').textContent=`周囲 ${entries.length}人`;
  const signature=JSON.stringify(entries.map(([id,s])=>[id,s.session,s.instrument]));
  if(signature===peerMixSignature)return;peerMixSignature=signature;
  const list=$('peerMix'),rows=new Map([...list.children].map(row=>[row.dataset.key,row])),active=new Set(entries.map(([id,state])=>JSON.stringify([id,state.session])));
  for(const [key,row] of rows)if(!active.has(key))row.remove();
  entries.forEach(([id,state],index)=>{
    const key=JSON.stringify([id,state.session]);active.add(key);let row=rows.get(key);
    if(!row){
      row=document.createElement('label');row.className='peer-mix-row';row.dataset.key=key;row.dataset.player=id;
      const title=document.createElement('span'),slider=document.createElement('input'),value=document.createElement('output');
      slider.type='range';slider.min=0;slider.max=100;slider.step=1;slider.value=Math.round((peerVolumes.get(key)??1)*100);
      slider.setAttribute('aria-label',`演奏者${id}の楽器音量`);value.textContent=slider.value+'%';
      slider.oninput=()=>{if(replicas.states.get(id)?.session===state.session){const level=Number(slider.value)/100;peerVolumes.set(key,level);audio.setSourceVolume(id,level,state.session);value.textContent=slider.value+'%';}};
      slider.addEventListener('pointerup',focusAfterPointer);row.append(title,slider,value);
    }
    row.children[0].textContent=`演奏者 ${id} · ${catalog.instruments.find(spec=>spec.id===state.instrument)?.name||'楽器'}`;
    if(list.children[index]!==row)list.insertBefore(row,list.children[index]||null);
  });
  for(const key of peerVolumes.keys())if(!active.has(key))peerVolumes.delete(key);
  $('peerMixEmpty').hidden=entries.length>0;$('resetPeerMix').disabled=entries.length===0;
}
const replicas=new Replicas((id,s)=>{audio?.sync(id,s,peerVolumes.get(JSON.stringify([id,s.session]))??1);refreshPeerMix();},id=>{audio?.remove(id);refreshPeerMix();});

window.addEventListener('keydown',e=>{
  if(!shown){
    if(e.code==='Escape'&&!$('retryBoot').hidden){e.preventDefault();bootShown=false;early.length=0;$('retryBoot').hidden=true;bridge('close').catch(()=>{});}
    return;
  }
  if(e.code==='Escape'){e.preventDefault();e.stopPropagation();close();return;}
  if(capture!==null){
    const target=e.target instanceof Element?e.target:null,action=target?.closest('#cancelBinding,#resetKeys,#settingsToggle,#editKeys');
    if(e.code==='Tab'||(e.code==='Enter'&&(action||target?.closest('#bindings button')))||(e.code==='Space'&&action))return;
    e.preventDefault();e.stopPropagation();if(e.repeat||e.isComposing||e.ctrlKey||e.metaKey||e.altKey)return;
    const selected=capture,current=activeBindings(),other=current.indexOf(e.code),proposal=remapBinding(current,selected,e.code,reserved,bindingMode());
    if(!proposal){error('そのキーは予約済み、または使用できません。文字・数字・記号のキーを1つ押してください。');return;}
    applyBindings(proposal);capture=null;const saved=save();bindings();drawKeys();error();
    $('bindingStatus').textContent=(other>=0&&other!==selected?'2音のキーを交換しました。':'キー配置を変更しました。')+(saved?'このPCに保存済みです。':'端末に保存できません。今回のみ使用できます。');
    $('bindings').children[selected].focus({preventScroll:true});return;
  }
  if(e.isComposing||e.ctrlKey||e.metaKey||e.altKey)return;
  if(e.code==='KeyN'&&(!['INPUT','SELECT','TEXTAREA'].includes(e.target.tagName)||(e.target.tagName==='INPUT'&&e.target.type==='range'))){e.preventDefault();e.stopPropagation();if(!e.repeat)voiceSource('keyboard',true);return;}
  if(['INPUT','SELECT','TEXTAREA'].includes(e.target.tagName))return;
  if(e.repeat){if(e.code==='Space'||e.code==='ArrowDown'||e.code==='ArrowUp'||model.pitch(e.code)!==undefined){e.preventDefault();e.stopPropagation();}return;}
  if(e.code==='Space' && e.target.tagName!=='BUTTON'){e.preventDefault();e.stopPropagation();pedal('keyboard',true);return;}
  if(e.code==='ArrowDown'||e.code==='ArrowUp'){e.preventDefault();e.stopPropagation();shiftOctave(e.code==='ArrowDown'?-1:1);return;}
  const pitch=reserved.includes(e.code)?undefined:model.pitch(e.code);if(pitch===undefined)return;e.preventDefault();e.stopPropagation();requestNote('key:'+e.code,pitch,velocity);
});
window.addEventListener('keyup',e=>{if(voiceSources.has('button:'+e.code)){e.preventDefault();e.stopPropagation();voiceSource('button:'+e.code,false);}if(e.code==='KeyN'&&voiceSources.has('keyboard')){e.preventDefault();e.stopPropagation();voiceSource('keyboard',false);}if(shown&&((e.code==='Space'&&pedalSources.has('keyboard'))||model?.keys.has('key:'+e.code))){e.preventDefault();e.stopPropagation();}if(e.code==='Space')pedalSources.delete('keyboard');if(model){releaseNote('key:'+e.code);model.pedal(pedalSources.size>0);}});
window.addEventListener('blur',()=>{if(shown)close();else stopMetronome();});
document.addEventListener('visibilitychange',()=>{if(document.hidden){if(shown)close();replicas.clear();audio?.stopAll();}});
window.addEventListener('pagehide',()=>{if(shown)close();audio?.stopAll();});

$('close').onclick=()=>close();$('panic').onclick=e=>{panic();focusAfterPointer(e);};
$('voice').onclick=e=>{automaticVoice=!automaticVoice;if(!automaticVoice)releaseVoice();else syncAutomaticVoice();drawVoice();focusAfterPointer(e);};
$('instrument').onchange=()=>{stop(true);choose($('instrument').value);};
$('octDown').onclick=e=>{shiftOctave(-1);focusAfterPointer(e);};
$('octUp').onclick=e=>{shiftOctave(1);focusAfterPointer(e);};
$('keyLayout').onchange=()=>changeLayout($('keyLayout').value);
$('keyboardZoom').oninput=()=>{zoom=Number($('keyboardZoom').value);fitKeyboard();save();};
$('viewLeft').onclick=e=>{$('keyboardViewport').scrollBy({left:-$('keyboardViewport').clientWidth*.8});focusAfterPointer(e);};
$('viewRight').onclick=e=>{$('keyboardViewport').scrollBy({left:$('keyboardViewport').clientWidth*.8});focusAfterPointer(e);};
$('viewHome').onclick=e=>{fitKeyboard(true);focusAfterPointer(e);};
$('guideToggle').onclick=e=>{showGuide=!showGuide;drawKeys();save();focusAfterPointer(e);};
$('keyboardViewport').onscroll=()=>{const viewport=$('keyboardViewport');if(viewUnit&&viewport.clientWidth===viewWidth)viewAnchor=viewport.scrollLeft/viewUnit;};
new ResizeObserver(()=>fitKeyboard()).observe($('keyboardViewport'));
$('sustain').onclick=e=>{if(shown)pedal('button',!pedalSources.has('button'));focusAfterPointer(e);};
$('velocity').oninput=()=>{velocity=Number($('velocity').value);$('velocityValue').textContent=velocity;save();};
$('performVolume').oninput=()=>{performVolume=Number($('performVolume').value);$('performValue').textContent=performVolume+'%';model?.setVolume(performVolume/100);save();};
$('listenVolume').oninput=()=>{listen=Number($('listenVolume').value)/100;$('listenValue').textContent=Math.round(listen*100)+'%';audio.setVolume(listen);save();};
$('mute').onclick=e=>{setMuted(!muted);focusAfterPointer(e);};
$('compact').onclick=e=>{const compact=$('panel').classList.toggle('compact');$('compact').textContent=compact?'鍵盤を表示':'縮小';$('compact').setAttribute('aria-expanded',String(!compact));if(compact){capture=null;$('settings').hidden=true;$('settingsToggle').setAttribute('aria-expanded','false');$('editKeys').setAttribute('aria-expanded','false');}else requestAnimationFrame(()=>fitKeyboard());focusAfterPointer(e);};
$('settingsToggle').onclick=e=>{setSettings($('settings').hidden);focusAfterPointer(e);};
$('editKeys').onclick=()=>{setSettings(true);$('bindings').children[0]?.focus({preventScroll:true});$('bindingTarget').scrollIntoView({block:'nearest'});};
$('cancelBinding').onclick=()=>{capture=null;bindings();error();$('bindings').children[0]?.focus({preventScroll:true});};
$('resetPeerMix').onclick=e=>{peerVolumes.clear();for(const[id,state]of replicas.states)audio.setSourceVolume(id,1,state.session);for(const row of $('peerMix').children){row.children[1].value=100;row.children[2].textContent='100%';}focusAfterPointer(e);};
$('resetKeys').onclick=e=>{panic();applyBindings(bindingMode()==='drums'?DRUM_KEYS:layout==='piano'?PIANO_KEYS:layout==='expanded'?EXPANDED_KEYS:DEFAULT_KEYS);capture=null;const saved=save();bindings();drawKeys();$('bindingStatus').textContent=saved?'この配列だけ初期化し、このPCに保存しました。他の配列は保持しています。':'この配列を初期化しましたが端末に保存できません。今回のみ使用できます。';focusAfterPointer(e);};
for(const id of ['velocity','performVolume','listenVolume','keyboardZoom'])$(id).addEventListener('pointerup',focusAfterPointer);
$('midiConnect').onclick=()=>midi.connect();$('midiDevice').onchange=()=>midi.select($('midiDevice').value);$('metro').onclick=e=>{toggleMetronome();focusAfterPointer(e);};

function message(data) {
  if(!data||typeof data.type!=='string')return;
  if(data.type==='open')open(data);
  else if(data.type==='close')close(false);
  else if(data.type==='control')control(data.data);
  else if(data.type==='remote')replicas.accept(data.data);
  else if(data.type==='positions')audio.positions(data.listener,data.sources);
  else if(data.type==='expire'){const s=replicas.states.get(data.player);if(s?.session===data.session){replicas.states.delete(data.player);audio.remove(data.player);refreshPeerMix();}}
  else if(data.type==='reset'){close(false);replicas.clear();audio.stopAll();}
  else if(data.type==='notice')notice(data.message);
  else if(data.type==='toggleMute'){setMuted(!muted);notice(muted?'JAMを消音しました。/jammute で解除。':'JAMの消音を解除しました。');}
  else if(data.type==='config'){reserved=data.reserved||[];}
  else if(data.type==='voiceState'&&shown){configureVoice(data.voice);voiceTalking=data.talking===true;if(data.expired===true){automaticVoice=false;releaseVoice(false);}drawVoice();}
}
let booting=false,bootReady=false,bootFailed=false,bootShown=false,preloading=false;
const early=[];window.addEventListener('message',e=>{
  const data=e.data;
  if(bootReady)message(data);
  else{
    if(data?.type==='reset'){bootShown=false;early.length=0;}
    else if(data?.type==='open'||data?.type==='close'){
      bootShown=data.type==='open';
      for(let i=early.length-1;i>=0;i--)if(early[i]?.type==='open'||early[i]?.type==='close')early.splice(i,1);
    }
    if(early.length>=16&&['open','close','reset'].includes(data?.type))early.shift();
    if(early.length<16)early.push(data);
    if(data?.type==='open'&&!booting)initialize();
  }
});
setInterval(()=>{
  replicas.expire();
  if(shown||bootShown){
    const check=listenCheck,generation=startGeneration,expected=session;
    bridge('pulse').catch(()=>{if(shown&&check===listenCheck&&generation===startGeneration&&session===expected&&session)failTransport();});
  }
  if(shown&&listenOnlyOpen&&audio?.ctx?.state!=='running'&&resumeAudioButton.hidden)promptListenAudio();
  if(session&&model){if([...model.notes.values()].some(n=>now()-n.at>115000)){panic();notice('長時間の持続音を安全停止しました。');}syncInput();}
},1000);
async function readyBridge() {
  for(let attempt=0;attempt<2;attempt++){
    try{const result=await bridge('ready');if(result?.ok===true)return;}catch{}
    if(attempt===0)await new Promise(resolve=>setTimeout(resolve,250));
  }
  throw Error('ready unavailable');
}
async function loadCatalog() {
  const abort=new AbortController(),timeout=setTimeout(()=>abort.abort(),6000);
  try {
    const response=await fetch('catalog.json',{signal:abort.signal});
    if(!response.ok)throw Error('catalog unavailable');
    const data=await response.json();
    if(!Array.isArray(data?.instruments)||!data.instruments.length)throw Error('invalid catalog');
    return data;
  }finally{clearTimeout(timeout);}
}
async function initialize() {
  if(booting||bootReady)return;
  booting=true;$('retryBoot').hidden=true;$('retryBoot').disabled=true;error();
  if(bootFailed){clearTimeout(noticeTimer);$('notice').textContent='JAMを再読み込みしています…';$('notice').hidden=false;}
  try {
    if(!audio){
      if(!catalog)catalog=await loadCatalog();
      $('instrument').replaceChildren();
      for(const s of catalog.instruments)$('instrument').add(new Option(s.name,s.id));
      audio=new AudioRack(catalog,null,()=>{const message='音源を再生できませんでした。少し待ってから再試行してください。';error(message);if(!shown)notice(message);});audio.setVolume(listen);setMuted(muted);
      $('listenVolume').value=Math.round(listen*100);$('listenValue').textContent=Math.round(listen*100)+'%';
      $('performVolume').value=performVolume;$('performValue').textContent=performVolume+'%';
      $('velocity').value=velocity;$('velocityValue').textContent=velocity;choose('piano');
    }
    await readyBridge();
    for(const data of early.splice(0))message(data);
    bootShown=false;
    // FiveM normally permits autoplay; if CEF blocks it, expose an explicit unlock command.
    audio.unlock().then(ok=>{if(listenOnlyOpen&&shown){if(ok)listenAudioReady();else promptListenAudio();}
      else if(!ok&&!preview)notice('周囲の演奏を聴くには /jamlisten を開いてください。');}).catch(()=>{});
    if(!preview&&!preloading){preloading=true;(async()=>{let failed=false;for(const spec of catalog.instruments){try{await audio.load(spec.id);}catch{failed=true;}}if(failed)notice('一部の音源を準備できませんでした。使う楽器で「演奏する」を押して再試行してください。');})();}
    if(preview){document.body.classList.add('preview');open();window.JAM={get model(){return model;},audio,replicas,message,midi,get session(){return session;},panic,stop};}
    bootReady=true;bootFailed=false;$('notice').hidden=true;$('notice').textContent='';
  }catch{
    bootFailed=true;
    if(bootShown){$('notice').hidden=false;$('notice').textContent='JAMを準備できませんでした。「JAMを再読み込み」を押すか、Escで閉じて再度開いてください。改善しない場合は管理者へ連絡してください。';$('retryBoot').hidden=false;}
    else{$('notice').hidden=true;$('retryBoot').hidden=true;}
  }
  finally{booting=false;$('retryBoot').disabled=false;}
}
$('retryBoot').onclick=initialize;
await initialize();
