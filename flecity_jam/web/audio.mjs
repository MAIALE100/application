import {attenuation,selectSample} from './model.mjs';

// Avoid replaying uncached remote notes so late that a band sounds out of time.
const DEFERRED_NOTE_MS=250;
const DEFERRED_NOTE_LIMIT=16;

async function bounded(promise,ms,message,cancel=()=>{}) {
  let timer;
  try {
    return await Promise.race([promise,new Promise((_,reject)=>{
      timer=setTimeout(()=>{cancel();reject(Error(message));},ms);
    })]);
  } finally {clearTimeout(timer);}
}

export class AudioRack {
  constructor(catalog, context=null, onError=()=>{}) {
    this.catalog=new Map(catalog.instruments.map(s=>[s.id,s]));this.ctx=context;this.onError=onError;
    this.buffers=new Map();this.loading=new Map();this.slots=new Map();this.masterVolume=.65;this.muted=false;
    this.listener={x:0,y:0,z:0,fx:0,fy:1,fz:0};this.voiceLimit=128;this.aliveVoices=new Set();
    this.maxCacheBytes=64*1024*1024;this.cacheBytes=0;
    this.now=()=>performance.now();
    if(context)this.init();
  }
  init() {
    if(this.master && this.ctx.state!=='closed')return;
    if(this.master) {
      for(const voice of [...this.aliveVoices])this.terminate(voice);
      for(const slot of this.slots.values()){slot.gain.disconnect();slot.panner?.disconnect();}
      this.slots.clear();this.master.disconnect();this.limiter.disconnect();
      this.master=null;this.ctx=null;
    }
    this.ctx ||= new AudioContext({latencyHint:'interactive',sampleRate:48000});
    this.decoder=new OfflineAudioContext(1,1,32000);
    this.master=this.ctx.createGain();this.master.gain.value=this.muted?0:this.masterVolume;
    this.limiter=this.ctx.createDynamicsCompressor();
    this.limiter.threshold.value=-8;this.limiter.knee.value=4;this.limiter.ratio.value=12;
    this.limiter.attack.value=.003;this.limiter.release.value=.12;
    this.master.connect(this.limiter).connect(this.ctx.destination);
  }
  async unlock() {
    this.init();
    if(this.ctx.state!=='running')await bounded(this.ctx.resume(),3000,'音声を開始できません。「演奏する」をもう一度押してください。');
    if(this.ctx.state==='running')for(const [key,slot] of this.slots)if(key!=='local')this.reconcile(key,slot);
    return this.ctx.state==='running';
  }
  setVolume(value) {this.masterVolume=Math.max(0,Math.min(1,value));this.applyMaster();}
  setMute(value) {this.muted=Boolean(value);this.applyMaster();}
  applyMaster() {if(this.master)this.master.gain.setTargetAtTime(this.muted?0:this.masterVolume,this.ctx.currentTime,.02);}
  async load(id) {
    this.init();const spec=this.catalog.get(id);if(!spec)throw Error('Unknown instrument');
    const loadSample=async s=>{
      if(this.buffers.has(s.file))return;
      if(!this.loading.has(s.file))this.loading.set(s.file,(async()=>{
        const abort=new AbortController();
        const decoded=await bounded((async()=>{
          const response=await fetch(s.file,{signal:abort.signal});
          if(!response.ok)throw Error('音源を読み込めません。「演奏する」で再試行してください。');
          return await this.decoder.decodeAudioData(await response.arrayBuffer());
        })(),8000,'音源の準備が時間内に終わりませんでした。「演奏する」で再試行してください。',()=>abort.abort());
        if(!decoded.length || !decoded.numberOfChannels || !Number.isFinite(decoded.sampleRate))throw Error('音源を読み取れませんでした。JAMを開き直して再試行してください。');
        const data=this.ctx.createBuffer(1,decoded.length,decoded.sampleRate),mono=data.getChannelData(0);
        for(let channel=0;channel<decoded.numberOfChannels;channel++) {
          const pcm=decoded.getChannelData(channel);
          for(let i=0;i<pcm.length;i++)mono[i]+=pcm[i]/decoded.numberOfChannels;
        }
        const bytes=data.length*data.numberOfChannels*4;
        if(this.cacheBytes+bytes>this.maxCacheBytes)throw Error('音源キャッシュ上限を超えました');
        this.buffers.set(s.file,data);this.cacheBytes+=bytes;
      })().finally(()=>this.loading.delete(s.file)));
      await this.loading.get(s.file);
    };
    for(let i=0;i<spec.samples.length;i+=4)await Promise.all(spec.samples.slice(i,i+4).map(loadSample));
  }
  slot(key,instrument,range=7,session=null) {
    let slot=this.slots.get(key);
    if(slot && (slot.instrument!==instrument || (session && slot.session && slot.session!==session))){this.remove(key);slot=null;}
    if(!slot) {
      const gain=this.ctx.createGain();gain.gain.value=key==='local'?1:0;
      let panner=null;
      if(key!=='local') {
        panner=this.ctx.createPanner();panner.panningModel='HRTF';panner.distanceModel='inverse';
        panner.rolloffFactor=0;panner.refDistance=1;panner.maxDistance=range;
        gain.connect(panner).connect(this.master);
      }else gain.connect(this.master);
      slot={instrument,session,range,gain,panner,voices:new Map(),done:new Set(),desired:new Map(),deferred:[],deferredTimer:null,volume:.75,listenVolume:1,seen:this.now(),position:null};
      this.slots.set(key,slot);
    }
    if(session)slot.session=session;
    return slot;
  }
  sync(key,state,listenVolume) {
    this.init();const spec=this.catalog.get(state.instrument);if(!spec)return;
    const slot=this.slot(key,state.instrument,state.range,state.session);
    if(key!=='local'&&Number.isFinite(listenVolume))slot.listenVolume=Math.max(0,Math.min(1,listenVolume));
    const next=new Map(state.notes instanceof Map ? state.notes : state.notes.map(n=>[n.id,n]));
    const now=this.now();
    this.pruneDeferred(slot);
    if(key!=='local' && (slot.loading || !slot.position))for(const [id,n] of slot.desired)if(!next.has(id) && !slot.voices.has(id) && !slot.done.has(id)) {
      const age=n.age+Math.max(0,now-slot.seen);
      if(age<=DEFERRED_NOTE_MS){
        slot.deferred.push({id,n:{...n,age},at:now});
        if(slot.deferred.length>DEFERRED_NOTE_LIMIT)slot.deferred.shift();
        this.scheduleDeferredExpiry(slot);
      }
    }
    slot.volume=state.volume;slot.desired=next;slot.seen=now;
    for(const[id,v]of slot.voices)if(!slot.desired.has(id)){this.release(v,spec.kind==='drums'?null:spec.release);slot.voices.delete(id);}
    for(const id of slot.done)if(!slot.desired.has(id))slot.done.delete(id);
    this.updateGain(key,slot);
    if(spec.samples.every(s=>this.buffers.has(s.file)))this.reconcile(key,slot);
    else if(!slot.loading){
      slot.loading=true;
      this.load(spec.id).then(()=>{slot.loading=false;if(this.slots.get(key)===slot)this.reconcile(key,slot);})
        .catch(error=>{slot.loading=false;this.clearDeferred(slot);if(this.slots.get(key)===slot)this.onError(error.message);});
    }
  }
  pruneDeferred(slot) {slot.deferred=slot.deferred.filter(entry=>entry.n.age+Math.max(0,this.now()-entry.at)<=DEFERRED_NOTE_MS);}
  clearDeferred(slot) {slot.deferred=[];clearTimeout(slot.deferredTimer);slot.deferredTimer=null;}
  scheduleDeferredExpiry(slot) {
    clearTimeout(slot.deferredTimer);
    if(!slot.deferred.length)return;
    const now=this.now();
    const delay=Math.max(1,Math.min(...slot.deferred.map(entry=>DEFERRED_NOTE_MS-entry.n.age-Math.max(0,now-entry.at)))+1);
    slot.deferredTimer=setTimeout(()=>{
      slot.deferredTimer=null;this.pruneDeferred(slot);
      if(slot.deferred.length)this.scheduleDeferredExpiry(slot);
    },delay);
  }
  reconcile(key,slot) {
    if(key!=='local' && (!slot.position || attenuation(slot.distance,slot.range)===0))return;
    const spec=this.catalog.get(slot.instrument);
    const time=this.now();
    // OfflineAudioContext schedules sources before startRendering(), while a
    // suspended live AudioContext must not queue notes that may sound later.
    const ready=this.ctx.state==='running' || typeof this.ctx.startRendering==='function';
    // Completed taps can be recovered if decoding finished almost immediately.
    // Never retain them for a later listener, context resume, or distant player.
    this.pruneDeferred(slot);
    if(ready && !slot.loading) {
      const deferred=slot.deferred;this.clearDeferred(slot);
      for(const entry of deferred)if(!slot.desired.has(entry.id)) {
        const voice=this.startVoice(slot,spec,entry.id,{...entry.n,age:entry.n.age+time-entry.at},true);
        if(voice && spec.kind!=='drums')voice.releaseTimer=setTimeout(()=>this.release(voice,spec.release),20);
      }
    }
    if(key!=='local' && !ready)return;
    for(const[id,n]of slot.desired) {
      if(slot.voices.has(id)||slot.done.has(id))continue;
      this.startVoice(slot,spec,id,{...n,age:n.age+Math.max(0,time-slot.seen)});
    }
  }
  startVoice(slot,spec,id,n,transient=false) {
    const sample=selectSample(spec,n.pitch,n.velocity);if(!sample)return null;
    const buffer=this.buffers.get(sample.file);if(!buffer)return null;
    const age=n.age/1000;
    const rate=2**((n.pitch-sample.midi)/12+(sample.tune||0)/1200);
    let offset=age*rate;
    if(sample.loopEnd && offset>=sample.loopEnd)offset=sample.loopStart+(offset-sample.loopStart)%(sample.loopEnd-sample.loopStart);
    if(offset>=buffer.duration){if(!transient)slot.done.add(id);return null;}
    while(this.aliveVoices.size>=this.voiceLimit) {
      const victim=[...this.aliveVoices].find(v=>v.released)||this.aliveVoices.values().next().value;
      this.terminate(victim);
    }
    const source=this.ctx.createBufferSource(),gain=this.ctx.createGain(),now=this.ctx.currentTime;
    source.buffer=buffer;source.playbackRate.value=rate;
    if(sample.loopEnd){source.loop=true;source.loopStart=sample.loopStart;source.loopEnd=sample.loopEnd;}
    const level=(n.velocity/127)**1.4*spec.gain*(sample.gain||1)*.26;
    const attackEnd=now+(age>.1?.012:spec.attack);
    gain.gain.setValueAtTime(0,now);gain.gain.linearRampToValueAtTime(level,attackEnd);
    source.connect(gain).connect(slot.gain);
    const voice={source,gain,slot,id,released:false,releaseTimer:null,startedAt:now,attackEnd};
    if(!transient)slot.voices.set(id,voice);
    this.aliveVoices.add(voice);
    source.onended=()=>{
      clearTimeout(voice.releaseTimer);source.disconnect();gain.disconnect();this.aliveVoices.delete(voice);
      if(slot.voices.get(id)===voice){slot.voices.delete(id);if(slot.desired.has(id))slot.done.add(id);}
    };
    source.start(now,offset);
    return voice;
  }
  release(v,seconds) {
    if(v.released)return;
    if(seconds===null){return;} // Drum tails finish naturally; teardown still stops them through aliveVoices.
    clearTimeout(v.releaseTimer);v.releaseTimer=null;
    v.released=true;
    // A transport batch can contain both edges of a short tap. Let its attack
    // sound before releasing, instead of cancelling the envelope at zero gain.
    const releaseAt=Math.max(this.ctx.currentTime,v.startedAt+.02,v.attackEnd);
    v.gain.gain.cancelAndHoldAtTime(releaseAt);v.gain.gain.linearRampToValueAtTime(0,releaseAt+seconds);
    try{v.source.stop(releaseAt+seconds+.005);}catch{}
    // Count release tails until onended, so rapid taps cannot evade the source cap.
  }
  terminate(v) {
    clearTimeout(v.releaseTimer);v.releaseTimer=null;
    v.released=true;
    try{v.source.stop();}catch{}
    v.source.disconnect();v.gain.disconnect();this.aliveVoices.delete(v);
    if(v.slot.voices.get(v.id)===v){v.slot.voices.delete(v.id);if(v.slot.desired.has(v.id))v.slot.done.add(v.id);}
  }
  // Listener-only mix. Session guard prevents a stale control from muting a reused player ID.
  setSourceVolume(key,value,session) {
    const slot=this.slots.get(key);
    if(key==='local'||!slot||!Number.isFinite(value)||(session&&slot.session!==session))return false;
    slot.listenVolume=Math.max(0,Math.min(1,value));this.updateGain(key,slot);return true;
  }
  updateGain(key,slot) {
    const scale=key==='local'?1:slot.position?attenuation(slot.distance,slot.range):0;
    slot.gain.gain.setTargetAtTime(slot.volume*scale*(slot.listenVolume??1),this.ctx.currentTime,.02);
  }
  positions(listener,sources) {
    if(!this.ctx)return;this.listener=listener;
    const l=this.ctx.listener,now=this.ctx.currentTime;
    // GTA uses Z-up. Rotate all coordinates to WebAudio's Y-up convention.
    for(const[name,value]of Object.entries({positionX:listener.x,positionY:listener.z,positionZ:-listener.y,
      forwardX:listener.fx,forwardY:listener.fz,forwardZ:-listener.fy,upX:0,upY:1,upZ:0}))l[name].setValueAtTime(value,now);
    const present=new Set();
    for(const p of Array.isArray(sources)?sources:[]) {
      const slot=this.slots.get(p.player);if(!slot)continue;present.add(p.player);
      slot.position=p;slot.distance=Math.hypot(p.x-listener.x,p.y-listener.y,p.z-listener.z);
      for(const[name,value]of Object.entries({positionX:p.x,positionY:p.z,positionZ:-p.y}))slot.panner[name].setTargetAtTime(value,now,.04);
      this.updateGain(p.player,slot);this.reconcile(p.player,slot);
      if(slot.distance>=slot.range){for(const v of slot.voices.values())this.release(v,.02);slot.voices.clear();slot.done.clear();this.clearDeferred(slot);}
    }
    for(const[key,slot]of this.slots)if(key!=='local'&&!present.has(key)){
      slot.position=null;this.updateGain(key,slot);
      for(const v of slot.voices.values())this.release(v,.02);slot.voices.clear();slot.done.clear();this.pruneDeferred(slot);
    }
  }
  remove(key) {
    const slot=this.slots.get(key);if(!slot)return;
    for(const v of [...this.aliveVoices])if(v.slot===slot){v.released=false;this.release(v,.012);}
    slot.desired.clear();slot.voices.clear();slot.done.clear();this.clearDeferred(slot);this.slots.delete(key);
    slot.gain.gain.setTargetAtTime(0,this.ctx.currentTime,.005);
    setTimeout(()=>{slot.gain.disconnect();slot.panner?.disconnect();},40);
  }
  stopAll() {for(const key of [...this.slots.keys()])this.remove(key);}
  stats() {return {voices:[...this.aliveVoices].filter(v=>!v.released).length,nodes:this.aliveVoices.size,performers:this.slots.size,cacheBytes:this.cacheBytes,state:this.ctx?.state||'closed'};}
}
