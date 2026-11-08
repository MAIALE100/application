// WAVE persistent resource-owned music engine (v8).
// This script runs in the FiveM WAVE resource ui_page, not the disposable
// LB Phone app iframe. All sound is local to the player, never world-spatial.
(()=>{'use strict';
const state = {currentNodes:new Set()};
const volumeStorageKey='flecity_wave_listener_volume_v1';
function clampVolume(value){const number=Number(value);return Number.isFinite(number)?Math.max(0,Math.min(1,number)):1;}
function restoredVolume(){try {const value=localStorage.getItem(volumeStorageKey);return value===null?1:clampVolume(value);}catch(_){return 1;}}
function listenerBus(c){return globalThis.WaveSamples?.output?.(c)||c.destination;}
function applyListenerVolume(){
 if(player.ctx&&globalThis.WaveSamples?.setMaster)globalThis.WaveSamples.setMaster(player.ctx,player.projectMasterVolume*player.volume);
}

const player={session:0,queue:[],index:-1,playing:false,paused:false,loading:false,sequence:0,
  ctx:null,timer:null,events:[],eventIndex:0,startAt:0,endAt:0,lastStartAt:null,
  repeatMode:"off",shuffle:false,order:[],orderPos:0,playGeneration:0,volume:restoredVolume(),projectMasterVolume:1};
function audio(){
  if(!player.ctx){player.ctx=new (window.AudioContext||window.webkitAudioContext)();applyListenerVolume();}
  return player.ctx;
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
  const destination=globalThis.WaveSamples?.output(c)||c.destination;
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

function scheduleVoice(c, inst, pitch, time, duration, volume = 0.7, pan = 0, articulation='legacy', synthConfig=null) {
  const destination=globalThis.WaveSamples?.output(c)||c.destination;
  if(globalThis.WaveSynth?.schedule(c,inst,pitch,time,duration,volume,pan,keepAudioNode,destination,synthConfig))return;
  if(globalThis.WaveSamples?.schedule(c,inst,pitch,time,duration,volume,pan,keepAudioNode,destination,articulation))return;
  if(inst==='acoustic_drums')inst='drums';
  if(inst==='electric_bass')inst='bass';
  if(inst==='acoustic_guitar')inst='pluck';
  if (inst === 'drums') { scheduleDrum(c, pitch, time, volume); return; }
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


// A playback order is separate from the immutable album/playlist queue.
function resetOrder(newQueue=false){
  const count=player.queue.length;
  const previous=(!newQueue&&player.shuffle&&player.order.length===count)
    ?player.order.slice(0,player.orderPos+1):[];
  player.order=Array.from({length:count},(_,i)=>i);
  player.orderPos=Math.max(0,player.index);
  if(player.shuffle&&count>1){
    const prefix=previous.length&&previous.at(-1)===player.index?previous:[player.index];
    const seen=new Set(prefix);
    const remaining=player.order.filter(i=>!seen.has(i));
    for(let i=remaining.length-1;i>0;i--){
      const j=Math.floor(Math.random()*(i+1));
      [remaining[i],remaining[j]]=[remaining[j],remaining[i]];
    }
    player.order=[...prefix,...remaining]; player.orderPos=prefix.length-1;
  }
}
function moveQueue(direction,manual=false,wrap=true){
  if(!player.queue.length)return false;
  if(player.repeatMode==='one'&&!manual&&direction>0)return true;
  let pos=player.orderPos+direction;
  if(pos<0||pos>=player.order.length){
    if(manual&&!wrap)return false;
    if(!manual&&player.repeatMode!=='all')return false;
    if(player.shuffle&&direction>0){
      // Regenerate each cycle, preserving today's first item only at start.
      const next=player.order.slice();
      for(let i=next.length-1;i>0;i--){
        const j=Math.floor(Math.random()*(i+1));[next[i],next[j]]=[next[j],next[i]];
      }
      if(next.length>1&&next[0]===player.index){[next[0],next[1]]=[next[1],next[0]];}
      player.order=next;
    }
    pos=direction>0?0:player.order.length-1;
  }
  player.orderPos=pos;
  player.index=player.order[pos];
  return true;
}
function track(){return player.queue[player.index]||null;}
function info(){
 const t=track();return t?{
  id:t.id,title:t.title,artist_name:t.artist_name,preview:t.preview===true,
  favorite:t.favorite===true
 }:null;
}
function send(event,body={}){
 const resource=typeof GetParentResourceName==='function'?GetParentResourceName():'wave';
 const payload={session:player.session,event,...body};
 try{
  void fetch('https://'+resource+'/wave:playerEvent',{
   method:'POST',headers:{'Content-Type':'application/json; charset=UTF-8'},body:JSON.stringify(payload)
  }).catch(()=>{});
 }catch(_){ /* The in-game client can be restarting. */ }
}
function publish(error=''){
 send('status',{error,playing:player.playing,paused:player.paused,loading:player.loading,index:player.index,
  sequence:++player.sequence,track:info(),repeatMode:player.repeatMode,shuffle:player.shuffle,volume:player.volume});
}
function recordCurrent(){
 const t=track();
 if(!t||player.lastStartAt===null||!player.ctx)return;
 const seconds=Math.max(0,Math.min(600,Math.floor(player.ctx.currentTime-player.lastStartAt)));
 player.lastStartAt=null;
 if(seconds>0)send('stream',{trackId:t.id,validSeconds:seconds});
}
function clearSound(){
 player.playGeneration++;
 if(player.timer!==null){clearInterval(player.timer);player.timer=null;}
 state.currentNodes.forEach(n=>{try{n.stop();}catch(_){}});
 state.currentNodes.clear();
 player.events=[];player.eventIndex=0;player.endAt=0;
}
function endCurrent(){
 // Stream accounting is emitted exactly once per play segment.
 recordCurrent();
 clearSound();
 player.playing=false;
 player.paused=false;
}
function prepareProject(project){
 const bpm=Math.min(200,Math.max(60,Number(project.bpm)||120));
 const steps=Math.max(1,Math.min(128,Math.floor(Number(project.bars)||4)))*16;
 const duration=steps*60/bpm/4;
 const events=[];
 for(const t of Array.isArray(project.tracks)?project.tracks:[]){
  if(t.muted)continue;
  const notes=globalThis.WaveArticulation?.compilePhrases(t,steps)||t.notes||[];
  for(const n of notes){
   const step=Number(n.step);
   if(!Number.isFinite(step)||step<0||step>=steps)continue;
   const beat=60/bpm/4;
   const phrase=Array.isArray(n.segments)?n.segments.map(s=>({
     offset:(s.step-step)*beat,duration:s.length*beat,pitch:s.pitch,velocity:s.velocity
   })):null;
   events.push({at:step*beat,instrument:t.instrument||'sine',
    phrase:phrase&&phrase.length>1?phrase:null,
    pitch:Number(n.pitch)||60,duration:Math.max(.05,(Number(n.length)||1)*60/bpm/4),
    volume:Math.max(0,Math.min(1,Number(t.volume??.75)*Number(n.velocity??.85))),
    pan:Math.max(-1,Math.min(1,Number(t.pan)||0)),articulation:n.articulation||'legacy',synthConfig:t.synth});
  }
 }
 events.sort((a,b)=>a.at-b.at);
 return {duration,events};
}
function pump(){
 if(!player.playing||player.paused||!player.ctx)return;
 const c=player.ctx;
 const horizon=c.currentTime+1.5; // Hidden Chromium frames may throttle timers.
 while(player.eventIndex<player.events.length&&player.startAt+player.events[player.eventIndex].at<=horizon){
  const e=player.events[player.eventIndex++];
  const at=Math.max(c.currentTime+.001,player.startAt+e.at);
  if(e.phrase){
   if(e.instrument==='synth'){for(const segment of e.phrase){scheduleVoice(c,e.instrument,segment.pitch,at+segment.offset,segment.duration,e.volume*Number(segment.velocity??.85),e.pan,e.articulation,e.synthConfig);}continue;}
   const destination=globalThis.WaveSamples?.output(c)||c.destination;
   if(!globalThis.WaveSamples?.schedulePhrase(c,e.instrument,e.phrase,at,e.volume,e.pan,keepAudioNode,destination))
    globalThis.WaveArticulation?.scheduleSynthPhrase(c,e.instrument,e.phrase,at,e.volume,e.pan,keepAudioNode,destination);
  }else scheduleVoice(c,e.instrument,e.pitch,at,e.duration,e.volume,e.pan,e.articulation,e.synthConfig);
 }
 if(c.currentTime>=player.endAt){
  endCurrent();
  if(moveQueue(1,false,false)){void startAtIndex();}
  else publish();
 }
}
async function startAtIndex(){
 if(!track())return;
 clearSound();
 player.loading=true;publish();
 const generation=player.playGeneration;
 const project=track().project||{};
 const prepared=prepareProject(project);
 try{
  const c=audio();
  // Both factors use the SAME sample-engine bus: update them together at every track transition.
  player.projectMasterVolume=clampVolume(project.masterVolume??1);
  applyListenerVolume();
  if(c.state==='suspended')await c.resume();
  if(c.state==='suspended')throw Error('AUDIO_CONTEXT_BLOCKED');
  if(globalThis.WaveSamples)await globalThis.WaveSamples.preloadProject(c,project);
  if(generation!==player.playGeneration)return;
  player.events=prepared.events;player.eventIndex=0;
  player.startAt=c.currentTime+.07;
  player.lastStartAt=c.currentTime;
  player.endAt=player.startAt+prepared.duration;
  player.playing=true;player.paused=false;player.loading=false;
  pump();
  player.timer=setInterval(pump,120);
  publish();
 }catch(error){
  player.playing=false;player.paused=false;player.loading=false;
  publish('AUDIO_CONTEXT_BLOCKED');
  console.warn('[WAVE] background playback unavailable:',String(error?.message||error));
 }
}
async function execute(message){
 const command=message.command;
 if(command==='play'){
  endCurrent();
  player.session=Number(message.session)||0;
  player.queue=Array.isArray(message.queue)?message.queue:[];
  player.index=Math.max(0,Math.min(player.queue.length-1,Number(message.index)||0));
  player.sequence=0;
  resetOrder(true);
  await startAtIndex();
  return;
 }
 if(Number(message.session)!==player.session)return;
 if(command==='stop'){
  endCurrent();player.loading=false;publish();return;
 }
 if(command==='setVolume'){
  const value=Number(message.value);if(!Number.isFinite(value)||value<0||value>1)return;
  player.volume=value;
  try{localStorage.setItem(volumeStorageKey,String(value));}catch(_){/* Browser storage can be disabled. */}
  applyListenerVolume();
  publish();return;
 }
 if(command==='setRepeat'){
  if(!['off','all','one'].includes(message.value))return;
  player.repeatMode=message.value;publish();return;
 }
 if(command==='setShuffle'){
  if(typeof message.value!=='boolean')return;
  player.shuffle=message.value;resetOrder();publish();return;
 }
 if(command==='next'||command==='previous'){
  const direction=command==='next'?1:-1;
  if(!moveQueue(direction,true,message.wrap!==false))return;
  endCurrent();await startAtIndex();return;
 }
 if(command==='pause'||(command==='toggle'&&player.playing&&!player.paused)){
  if(player.playing&&!player.paused){
   player.paused=true;player.loading=true;publish();
   try{await audio().suspend();}catch(_){/* keep state consistent */}
   player.loading=false;
   publish();
  }
  return;
 }
 if(command==='toggle'){
  if(player.paused&&player.playing){
   player.loading=true;publish();
   try{await audio().resume();player.paused=false;player.loading=false;publish();pump();}
   catch(error){player.loading=false;publish('AUDIO_CONTEXT_BLOCKED');console.warn('[WAVE] resume failed:',error);}
  }else if(player.queue.length){await startAtIndex();}
 }
}
// Serialize commands so repeated taps cannot race the asynchronous AudioContext.
let commands=Promise.resolve();
window.addEventListener('message',({data})=>{
 if(!data||data.type!=='wavePlayerCommand')return;
 commands=commands.then(()=>execute(data)).catch(error=>{
  console.error('[WAVE] player command failed:',error);
 });
});
setTimeout(()=>publish(),300); // restore UI state from persisted listener settings.
window.WaveBackgroundPlayer={inspect(){return {index:player.index,queueSize:player.queue.length,
 playing:player.playing,paused:player.paused,session:player.session,sequence:player.sequence,
 repeatMode:player.repeatMode,shuffle:player.shuffle,volume:player.volume,order:[...player.order]};}};
})();
