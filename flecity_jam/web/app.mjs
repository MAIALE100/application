import {Performance,Replicas,DEFAULT_KEYS,DRUM_KEYS,DRUM_PITCHES,RESERVED,validBindings,noteName,keyLabel} from './model.mjs';
import {AudioRack} from './audio.mjs';
import {MidiInput} from './midi.mjs';

const $=id=>document.getElementById(id);
const preview=typeof GetParentResourceName!=='function';
const resource=preview?'flecity_jam':GetParentResourceName();
let catalog,model,audio,session=null,shown=false,starting=false,startGeneration=0,sequence=0;
let pending=[],flushTimer=0,transport={session:null,queue:Promise.resolve(),queued:0},capture=null,reserved=[],keys=[...DEFAULT_KEYS];
let listen=.65,muted=false,metronome=null,nextBeat=0,beat=0,noticeTimer=0;
let listenOnlyOpen=false,listenCheck=0;
const pedalSources=new Set();
const now=()=>performance.now();
const resumeAudioButton=document.createElement('button');
resumeAudioButton.id='resumeAudio';resumeAudioButton.type='button';resumeAudioButton.hidden=true;
resumeAudioButton.textContent='JAMの音声を有効にする';resumeAudioButton.style.pointerEvents='auto';
$('feedback').append(resumeAudioButton);
function error(message='') {$('error').textContent=message;$('error').hidden=!message;}
function notice(message) {$('notice').textContent=message;$('notice').hidden=false;clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>$('notice').hidden=true,6000);}
function save() {try{localStorage.setItem('flecity-jam-v1',JSON.stringify({keys,listen,muted}));}catch{}}
try {const prefs=JSON.parse(localStorage.getItem('flecity-jam-v1')||'{}');if(validBindings(prefs.keys))keys=prefs.keys;
  if(Number.isFinite(prefs.listen))listen=Math.max(0,Math.min(1,prefs.listen));muted=prefs.muted===true;}catch{}

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
function failTransport() {
  stop();error('演奏の通信が途切れました。音を止めました。もう一度「演奏する」を押してください。');
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
  if(session)audio.sync('local',{instrument:model.spec.id,...model.snapshot()});
}
function choose(id) {
  const spec=catalog.instruments.find(s=>s.id===id)||catalog.instruments[0];
  model=new Performance(spec,emit,redraw);model.bindings=[...keys];model.volume=Number($('performVolume').value)/100;
  $('instrument').value=spec.id;$('sustain').disabled=spec.kind==='drums';$('octDown').disabled=spec.kind==='drums';$('octUp').disabled=spec.kind==='drums';
  drawKeys();redraw();
}
function drawKeys() {
  const drums=model.spec.kind==='drums',keyboard=$('keyboard');keyboard.replaceChildren();keyboard.classList.toggle('drums',drums);
  const codes=drums?DRUM_KEYS:keys;
  let white=0;
  const whites=codes.filter((_,i)=>![1,3,6,8,10].includes(i%12)).length;
  codes.forEach((code,i)=>{
    const pitch=drums?DRUM_PITCHES[i]:(model.octave+1)*12+i;
    const black=!drums&&[1,3,6,8,10].includes(pitch%12),button=document.createElement('button');
    button.type='button';button.className='key'+(black?' black':'');button.dataset.pitch=pitch;button.tabIndex=-1;
    if(black)button.style.left=`${white/whites*100-2.75}%`;else white++;
    const valid=pitch>=model.spec.min&&pitch<=model.spec.max;
    button.classList.toggle('out-of-range',!valid);button.disabled=!valid;
    const label=drums?model.spec.samples.find(s=>s.midi===pitch)?.label:noteName(pitch);
    const title=document.createElement('span'),key=document.createElement('kbd');title.textContent=label;key.textContent=keyLabel(code);
    button.append(key,title);button.setAttribute('aria-label',`${label} (${keyLabel(code)})`);
    button.addEventListener('pointerdown',e=>{
      e.preventDefault();if(!session)return;
      button.setPointerCapture(e.pointerId);model.press('pointer:'+e.pointerId,pitch);$('playArea').focus({preventScroll:true});
    });
    for(const type of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(type,e=>model.release('pointer:'+e.pointerId));
    keyboard.append(button);
  });
  $('rangeText').textContent=drums?'8 PADS  /  GM':'音域 '+noteName(model.spec.min)+' — '+noteName(model.spec.max);
}
function bindings() {
  $('bindings').replaceChildren();keys.forEach((code,i)=>{
    const b=document.createElement('button');b.textContent=noteName(60+i)+' · '+keyLabel(code);b.classList.toggle('capturing',capture===i);
    b.addEventListener('click',()=>{panic();capture=i;bindings();$('status').textContent='割り当てるキーを押してください。Escで中止。';});$('bindings').append(b);
  });
}
async function start() {
  if(session){stop();return;}
  if(starting)return;
  const generation=++startGeneration;starting=true;$('start').disabled=true;$('start').setAttribute('aria-busy','true');$('instrument').disabled=true;error();$('status').textContent='音源を準備しています…';
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
  }catch{if(generation===startGeneration){stop();error({
    audio:'音声を開始できませんでした。JAMを開き直して、もう一度お試しください。',
    samples:'音源を読み込めませんでした。少し待ってから、もう一度お試しください。',
    resume:'音声を再開できませんでした。JAMを開き直して、もう一度お試しください。',
    server:'演奏の通信を開始できませんでした。少し待ってから、もう一度お試しください。'
  }[stage]);}}
}
function control(data) {
  if(data.kind==='started') {
    if(!shown||!starting){bridge('stop').catch(()=>{});return;}
    listenOnlyOpen=false;listenCheck++;resumeAudioButton.hidden=true;
    session=data.session;transport={session,queue:Promise.resolve(),queued:0};sequence=0;pending=[];starting=false;model.limit=data.maxNotes||16;
    $('start').disabled=false;$('start').setAttribute('aria-busy','false');$('start').textContent='演奏を休む';$('lamp').classList.add('active');
    $('status').textContent=preview?'試奏モード · 周囲への共有なし':'演奏中 · 周囲に音が届きます';
    $('playArea').focus({preventScroll:true});syncInput();redraw();
  } else if(data.kind==='denied') {
    stop();const reason={permission:'この楽器を使用する権限・アイテムがありません。',capacity:'同時演奏人数の上限です。',cooldown:'少し待ってから開始してください。',unavailable:'現在は演奏できません。'};
    error(reason[data.reason]||'演奏を開始できませんでした。');
  } else if(data.session===session && data.kind==='stopped') {
    stop();error('演奏を終了しました。'+({rate:'入力が速すぎるため、安全停止しました。',expired:'応答または演奏状態を確認できませんでした。',unavailable:'現在は演奏できません。'}[data.reason]||''));
  } else if(data.session===session && data.kind==='resync')syncInput();
}
function stop() {
  const wasActive=session||starting;startGeneration++;session=null;starting=false;pending=[];clearTimeout(flushTimer);flushTimer=0;
  transport={session:null,queue:Promise.resolve(),queued:0};
  pedalSources.clear();model?.panic();audio?.remove('local');
  $('start').disabled=false;$('start').setAttribute('aria-busy','false');$('start').textContent='演奏する';$('instrument').disabled=false;$('lamp').classList.remove('active');
  $('status').textContent='楽器を選んで、演奏を始めよう。';
  if(wasActive)bridge('stop').catch(()=>{});
}
function panic() {pedalSources.clear();model?.panic();audio?.remove('local');flush();}
function pedal(source,down) {if(down)pedalSources.add(source);else pedalSources.delete(source);model.pedal(pedalSources.size>0);}
function close(tellGame=true) {stop();stopMetronome();capture=null;shown=false;listenOnlyOpen=false;listenCheck++;resumeAudioButton.hidden=true;$('panel').hidden=true;if(tellGame)bridge('close').catch(()=>{});}
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
  shown=true;listenOnlyOpen=data.listenOnly===true;listenCheck++;resumeAudioButton.hidden=true;$('panel').hidden=false;error();reserved=Array.isArray(data.reserved)?data.reserved:reserved;
  if(!validBindings(keys,reserved)){keys=[...DEFAULT_KEYS];save();}
  choose(data.instrument||$('instrument').value);$('rangeBadge').textContent=`共有範囲 ${data.range||7}m`;
  $('status').textContent=data.listenOnly?'「聴く音量」で周囲の演奏を調整できます。':'楽器を選んで、演奏を始めよう。';
  $('instrument').focus();
  if(listenOnlyOpen){
    try{audio.init();}catch{}
    promptListenAudio();checkListenAudio();
  }else audio.unlock().catch(()=>{});
}
function setMuted(value) {muted=value;audio.setMute(muted);$('mute').setAttribute('aria-pressed',String(muted));$('mute').textContent=muted?'消音中':'消音';save();}
function stopMetronome() {clearInterval(metronome);metronome=null;$('metro').setAttribute('aria-pressed','false');$('metro').textContent='メトロノーム OFF';}
async function toggleMetronome() {
  if(metronome){stopMetronome();return;}
  try{if(!await audio.unlock())throw Error('audio suspended');}catch{error('音声を開始できません。');return;}
  beat=0;nextBeat=audio.ctx.currentTime+.05;$('metro').setAttribute('aria-pressed','true');$('metro').textContent='メトロノーム ON';
  metronome=setInterval(()=>{
    const bpm=Math.max(40,Math.min(240,Number($('bpm').value)||100));
    nextBeat=Math.max(nextBeat,audio.ctx.currentTime);
    while(nextBeat<audio.ctx.currentTime+.1){
      const osc=audio.ctx.createOscillator(),gain=audio.ctx.createGain();osc.frequency.value=beat++%4===0?1200:800;
      gain.gain.setValueAtTime(.08,nextBeat);gain.gain.exponentialRampToValueAtTime(.0001,nextBeat+.04);
      osc.connect(gain).connect(audio.master);osc.start(nextBeat);osc.stop(nextBeat+.05);
      osc.onended=()=>{osc.disconnect();gain.disconnect();};nextBeat+=60/bpm;
    }
  },25);
}

const midi=new MidiInput({press:(...args)=>{if(session)model.press(...args);},release:key=>model?.release(key),pedal:down=>{if(session)pedal('midi',down);},panic,
  status:text=>$('midiStatus').textContent=text,devices:list=>{
    const select=$('midiDevice'),selected=select.value;select.replaceChildren();select.disabled=!list.length;
    if(!list.length)select.add(new Option('未接続',''));for(const p of list)select.add(new Option(p.name,p.id));
    if(list.some(p=>p.id===selected))select.value=selected;
  }});
const replicas=new Replicas((id,s)=>{audio?.sync(id,s);$('nearby').textContent=`周囲 ${replicas.states.size}人`;},id=>{audio?.remove(id);$('nearby').textContent=`周囲 ${replicas.states.size}人`;});

window.addEventListener('keydown',e=>{
  if(!shown){
    if(e.code==='Escape'&&!$('retryBoot').hidden){e.preventDefault();bootShown=false;early.length=0;$('retryBoot').hidden=true;bridge('close').catch(()=>{});}
    return;
  }
  if(e.code==='Escape'){e.preventDefault();if(capture!==null){capture=null;bindings();}else if(!$('settings').hidden){$('settingsToggle').click();}else close();return;}
  if(capture!==null){
    e.preventDefault();const proposal=[...keys];proposal[capture]=e.code;
    if(!validBindings(proposal,reserved)){error('そのキーは予約済み、重複、または使用できないキーです。');return;}
    keys=proposal;capture=null;model.bindings=[...keys];save();bindings();drawKeys();error();return;
  }
  if(!session||e.repeat||e.isComposing||e.ctrlKey||e.metaKey||e.altKey)return;
  if(['INPUT','SELECT','TEXTAREA'].includes(e.target.tagName))return;
  if(e.code==='Space' && e.target.tagName!=='BUTTON'){e.preventDefault();pedal('keyboard',true);return;}
  if(e.code==='KeyZ'||e.code==='KeyX'){e.preventDefault();model.shift(e.code==='KeyZ'?-1:1);drawKeys();redraw();return;}
  const pitch=model.pitch(e.code);if(pitch===undefined)return;e.preventDefault();model.press('key:'+e.code,pitch);
});
window.addEventListener('keyup',e=>{if(e.code==='Space')pedalSources.delete('keyboard');if(model){model.release('key:'+e.code);model.pedal(pedalSources.size>0);}});
window.addEventListener('blur',()=>{if(session)panic();stopMetronome();});
document.addEventListener('visibilitychange',()=>{if(document.hidden){if(shown)close();replicas.clear();audio?.stopAll();}});
window.addEventListener('pagehide',()=>{audio?.stopAll();});

$('start').onclick=start;$('close').onclick=()=>close();$('panic').onclick=panic;
$('instrument').onchange=()=>choose($('instrument').value);
$('octDown').onclick=()=>{model.shift(-1);drawKeys();redraw();$('playArea').focus();};
$('octUp').onclick=()=>{model.shift(1);drawKeys();redraw();$('playArea').focus();};
$('sustain').onclick=()=>{if(session)pedal('button',!pedalSources.has('button'));$('playArea').focus();};
$('performVolume').oninput=()=>{const v=Number($('performVolume').value);$('performValue').textContent=v+'%';model?.setVolume(v/100);};
$('listenVolume').oninput=()=>{listen=Number($('listenVolume').value)/100;$('listenValue').textContent=Math.round(listen*100)+'%';audio.setVolume(listen);save();};
$('mute').onclick=()=>setMuted(!muted);
$('compact').onclick=()=>{const compact=$('panel').classList.toggle('compact');$('compact').textContent=compact?'鍵盤を表示':'縮小';$('compact').setAttribute('aria-expanded',String(!compact));};
$('settingsToggle').onclick=()=>{panic();capture=null;const open=$('settings').hidden;$('settings').hidden=!open;$('settingsToggle').setAttribute('aria-expanded',String(open));if(open)bindings();};
$('resetKeys').onclick=()=>{panic();keys=[...DEFAULT_KEYS];model.bindings=[...keys];capture=null;save();bindings();drawKeys();};
$('midiConnect').onclick=()=>midi.connect();$('midiDevice').onchange=()=>midi.select($('midiDevice').value);$('metro').onclick=toggleMetronome;

function message(data) {
  if(!data||typeof data.type!=='string')return;
  if(data.type==='open')open(data);
  else if(data.type==='close')close(false);
  else if(data.type==='control')control(data.data);
  else if(data.type==='remote')replicas.accept(data.data);
  else if(data.type==='positions')audio.positions(data.listener,data.sources);
  else if(data.type==='expire'){const s=replicas.states.get(data.player);if(s?.session===data.session){replicas.states.delete(data.player);audio.remove(data.player);}}
  else if(data.type==='reset'){close(false);replicas.clear();audio.stopAll();}
  else if(data.type==='notice')notice(data.message);
  else if(data.type==='toggleMute'){setMuted(!muted);notice(muted?'JAMを消音しました。/jammute で解除。':'JAMの消音を解除しました。');}
  else if(data.type==='config'){reserved=data.reserved||[];}
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
  if(shown||bootShown)bridge('pulse').catch(()=>{if(session)failTransport();});
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
      $('listenVolume').value=Math.round(listen*100);$('listenValue').textContent=Math.round(listen*100)+'%';choose('piano');
    }
    await readyBridge();
    for(const data of early.splice(0))message(data);
    bootShown=false;
    // FiveM normally permits autoplay; if CEF blocks it, expose an explicit unlock command.
    audio.unlock().then(ok=>{if(listenOnlyOpen&&shown){if(ok)listenAudioReady();else promptListenAudio();}
      else if(!ok&&!preview)notice('周囲の演奏を聴くには /jamlisten を開いてください。');}).catch(()=>{});
    if(!preview&&!preloading){preloading=true;(async()=>{for(const spec of catalog.instruments)await audio.load(spec.id);})().catch(()=>notice('一部の音源を準備できませんでした。/jamlisten で確認してください。'));}
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
