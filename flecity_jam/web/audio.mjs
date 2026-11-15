import {attenuation,selectSample} from './model.mjs';

export class AudioRack {
  constructor(catalog, context=null, onError=()=>{}) {
    this.catalog=new Map(catalog.instruments.map(s=>[s.id,s]));this.ctx=context;this.onError=onError;
    this.buffers=new Map();this.loading=new Map();this.slots=new Map();this.masterVolume=.65;this.muted=false;
    this.listener={x:0,y:0,z:0,fx:0,fy:1,fz:0};this.voiceLimit=128;this.aliveVoices=new Set();
    this.maxCacheBytes=64*1024*1024;this.cacheBytes=0;
    if(context)this.init();
  }
  init() {
    if(this.master)return;
    this.ctx ||= new AudioContext({latencyHint:'interactive',sampleRate:48000});
    this.decoder=new OfflineAudioContext(1,1,32000);
    this.master=this.ctx.createGain();this.master.gain.value=this.masterVolume;
    this.limiter=this.ctx.createDynamicsCompressor();
    this.limiter.threshold.value=-8;this.limiter.knee.value=4;this.limiter.ratio.value=12;
    this.limiter.attack.value=.003;this.limiter.release.value=.12;
    this.master.connect(this.limiter).connect(this.ctx.destination);
  }
  async unlock() {this.init();await this.ctx.resume();return this.ctx.state==='running';}
  setVolume(value) {this.masterVolume=Math.max(0,Math.min(1,value));this.applyMaster();}
  setMute(value) {this.muted=Boolean(value);this.applyMaster();}
  applyMaster() {if(this.master)this.master.gain.setTargetAtTime(this.muted?0:this.masterVolume,this.ctx.currentTime,.02);}
  async load(id) {
    this.init();const spec=this.catalog.get(id);if(!spec)throw Error('Unknown instrument');
    const loadSample=async s=>{
      if(this.buffers.has(s.file))return;
      if(!this.loading.has(s.file))this.loading.set(s.file,(async()=>{
        const response=await fetch(s.file);if(!response.ok)throw Error('音源を読み込めません: '+s.file);
        const decoded=await this.decoder.decodeAudioData(await response.arrayBuffer());
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
  slot(key,instrument,range=7) {
    let slot=this.slots.get(key);
    if(slot?.instrument!==instrument){this.remove(key);slot=null;}
    if(!slot) {
      const gain=this.ctx.createGain();gain.gain.value=key==='local'?1:0;
      let panner=null;
      if(key!=='local') {
        panner=this.ctx.createPanner();panner.panningModel='HRTF';panner.distanceModel='inverse';
        panner.rolloffFactor=0;panner.refDistance=1;panner.maxDistance=range;
        gain.connect(panner).connect(this.master);
      }else gain.connect(this.master);
      slot={instrument,range,gain,panner,voices:new Map(),done:new Set(),desired:new Map(),volume:.75,seen:performance.now(),position:null};
      this.slots.set(key,slot);
    }
    return slot;
  }
  sync(key,state) {
    this.init();const spec=this.catalog.get(state.instrument);if(!spec)return;
    const slot=this.slot(key,state.instrument,state.range);
    slot.volume=state.volume;slot.desired=new Map(state.notes instanceof Map ? state.notes : state.notes.map(n=>[n.id,n]));
    slot.seen=performance.now();
    for(const[id,v]of slot.voices)if(!slot.desired.has(id)){this.release(v,spec.kind==='drums'?null:spec.release);slot.voices.delete(id);}
    for(const id of slot.done)if(!slot.desired.has(id))slot.done.delete(id);
    this.updateGain(key,slot);
    if(spec.samples.every(s=>this.buffers.has(s.file)))this.reconcile(key,slot);
    else if(!slot.loading){
      slot.loading=true;
      this.load(spec.id).then(()=>{slot.loading=false;if(this.slots.get(key)===slot)this.reconcile(key,slot);})
        .catch(error=>{slot.loading=false;this.onError(error.message);});
    }
  }
  reconcile(key,slot) {
    if(key!=='local' && (!slot.position || attenuation(slot.distance,slot.range)===0))return;
    const spec=this.catalog.get(slot.instrument);
    for(const[id,n]of slot.desired) {
      if(slot.voices.has(id)||slot.done.has(id))continue;
      const sample=selectSample(spec,n.pitch,n.velocity);if(!sample)continue;
      const buffer=this.buffers.get(sample.file);if(!buffer)continue;
      const age=(n.age+Math.max(0,performance.now()-slot.seen))/1000;
      const rate=2**((n.pitch-sample.midi)/12+(sample.tune||0)/1200);
      let offset=age*rate;
      if(sample.loopEnd && offset>=sample.loopEnd)offset=sample.loopStart+(offset-sample.loopStart)%(sample.loopEnd-sample.loopStart);
      if(offset>=buffer.duration){slot.done.add(id);continue;}
      while(this.aliveVoices.size>=this.voiceLimit)this.release(this.aliveVoices.values().next().value,.01);
      const source=this.ctx.createBufferSource(),gain=this.ctx.createGain(),now=this.ctx.currentTime;
      source.buffer=buffer;source.playbackRate.value=rate;
      if(sample.loopEnd){source.loop=true;source.loopStart=sample.loopStart;source.loopEnd=sample.loopEnd;}
      const level=(n.velocity/127)**1.4*spec.gain*(sample.gain||1)*.26;
      gain.gain.setValueAtTime(0,now);gain.gain.linearRampToValueAtTime(level,now+(age>.1?.012:spec.attack));
      source.connect(gain).connect(slot.gain);
      const voice={source,gain,slot,id,released:false};slot.voices.set(id,voice);this.aliveVoices.add(voice);
      source.onended=()=>{
        source.disconnect();gain.disconnect();this.aliveVoices.delete(voice);
        if(slot.voices.get(id)===voice){slot.voices.delete(id);if(slot.desired.has(id))slot.done.add(id);}
      };
      source.start(now,offset);
    }
  }
  release(v,seconds) {
    if(v.released)return;
    if(seconds===null){return;} // Drum tails finish naturally; teardown still stops them through aliveVoices.
    v.released=true;
    const now=this.ctx.currentTime;
    v.gain.gain.cancelAndHoldAtTime(now);v.gain.gain.linearRampToValueAtTime(0,now+seconds);
    try{v.source.stop(now+seconds+.005);}catch{}
    this.aliveVoices.delete(v);
  }
  updateGain(key,slot) {
    const scale=key==='local'?1:slot.position?attenuation(slot.distance,slot.range):0;
    slot.gain.gain.setTargetAtTime(slot.volume*scale,this.ctx.currentTime,.02);
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
      if(slot.distance>=slot.range){for(const v of slot.voices.values())this.release(v,.02);slot.voices.clear();slot.done.clear();}
    }
    for(const[key,slot]of this.slots)if(key!=='local'&&!present.has(key)){
      slot.position=null;this.updateGain(key,slot);
      for(const v of slot.voices.values())this.release(v,.02);slot.voices.clear();slot.done.clear();
    }
  }
  remove(key) {
    const slot=this.slots.get(key);if(!slot)return;
    for(const v of [...this.aliveVoices])if(v.slot===slot){v.released=false;this.release(v,.012);}
    slot.desired.clear();slot.voices.clear();slot.done.clear();this.slots.delete(key);
    slot.gain.gain.setTargetAtTime(0,this.ctx.currentTime,.005);
    setTimeout(()=>{slot.gain.disconnect();slot.panner?.disconnect();},40);
  }
  stopAll() {for(const key of [...this.slots.keys()])this.remove(key);}
  stats() {return {voices:this.aliveVoices.size,performers:this.slots.size,cacheBytes:this.cacheBytes,state:this.ctx?.state||'closed'};}
}
