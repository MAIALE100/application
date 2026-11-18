import test from 'node:test';
import assert from 'node:assert/strict';
import {AudioRack} from '../web/audio.mjs';

class Param {
  constructor(value=0){this.value=value;}
  setValueAtTime(value){this.value=value;}
  setTargetAtTime(value){this.value=value;}
  linearRampToValueAtTime(value){this.value=value;}
  cancelAndHoldAtTime(){}
}
class Node {
  connect(node){this.destination=node;return node;}
  disconnect(){this.disconnected=true;}
}
class Buffer {
  constructor(channels=1,length=128,rate=32000){this.numberOfChannels=channels;this.length=length;this.sampleRate=rate;this.duration=length/rate;this.data=Array.from({length:channels},()=>new Float32Array(length).fill(.1));}
  getChannelData(i){return this.data[i];}
}
class Context {
  constructor(){this.state='running';this.currentTime=0;this.destination=new Node();this.sources=[];}
  resume(){this.state='running';return Promise.resolve();}
  createGain(){return Object.assign(new Node(),{gain:new Param()});}
  createDynamicsCompressor(){return Object.assign(new Node(),Object.fromEntries(['threshold','knee','ratio','attack','release'].map(k=>[k,new Param()])));}
  createWaveShaper(){return new Node();}
  createBuffer(channels,length,rate){return new Buffer(channels,length,rate);}
  createBufferSource(){
    const node=Object.assign(new Node(),{playbackRate:new Param(),starts:[],start(time,offset){assert(Number.isFinite(time)&&Number.isFinite(offset));this.starts.push({time,offset});},stop(){this.stopped=true;}});
    this.sources.push(node);return node;
  }
}
const catalog={instruments:[{id:'piano',kind:'pluck',attack:.004,release:.28,gain:1,samples:[{file:'piano.ogg',midi:60,layer:4,gain:1}]}]};
function globals(t){
  const originals={AudioContext:globalThis.AudioContext,OfflineAudioContext:globalThis.OfflineAudioContext};
  globalThis.AudioContext=Context;
  globalThis.OfflineAudioContext=class {decodeAudioData(){return Promise.resolve(new Buffer());}};
  t.after(()=>{for(const[k,v]of Object.entries(originals)){if(v===undefined)delete globalThis[k];else globalThis[k]=v;}});
}
function spatialContext(){
  const ctx=new Context();
  ctx.listener=Object.fromEntries(['positionX','positionY','positionZ','forwardX','forwardY','forwardZ','upX','upY','upZ'].map(name=>[name,new Param()]));
  ctx.createPanner=()=>Object.assign(new Node(),{positionX:new Param(),positionY:new Param(),positionZ:new Param()});
  return ctx;
}

test('release tails count toward the real source cap during rapid retriggers',t=>{
  globals(t);const ctx=new Context(),rack=new AudioRack(catalog,ctx);rack.buffers.set('piano.ogg',new Buffer(1,32000*8));
  for(let id=1;id<=400;id++){
    rack.sync('local',{instrument:'piano',volume:.75,notes:[{id,pitch:60,velocity:100,age:0}]});
    rack.sync('local',{instrument:'piano',volume:.75,notes:[]});
    assert(rack.stats().nodes<=128);
  }
  assert.equal(rack.stats().voices,0);assert.equal(rack.stats().nodes,128);
  assert.equal(ctx.sources.filter(s=>s.disconnected).length,272);
  for(const source of ctx.sources)source.onended();
  assert.equal(rack.stats().nodes,0);rack.stopAll();
});

test('stalled audio resume times out and can be retried',async t=>{
  globals(t);t.mock.timers.enable({apis:['setTimeout']});
  const ctx=new Context();ctx.state='suspended';ctx.resume=()=>new Promise(()=>{});
  const rack=new AudioRack(catalog,ctx),pending=rack.unlock();
  const rejected=assert.rejects(pending,/もう一度/);t.mock.timers.tick(3000);await rejected;
  ctx.resume=Context.prototype.resume;assert.equal(await rack.unlock(),true);
});

test('closed audio context is recreated without retaining old source nodes',async t=>{
  globals(t);const ctx=new Context(),rack=new AudioRack(catalog,ctx);
  const previousGuard=rack.peakGuard;
  rack.buffers.set('piano.ogg',new Buffer(1,32000*8));
  rack.sync('local',{instrument:'piano',volume:.75,notes:[{id:1,pitch:60,velocity:100,age:0}]});
  ctx.state='closed';assert.equal(await rack.unlock(),true);
  assert.notEqual(rack.ctx,ctx);assert.equal(rack.stats().nodes,0);assert.equal(rack.slots.size,0);
  assert.equal(rack.buffers.size,1);assert(ctx.sources[0].stopped&&ctx.sources[0].disconnected);
  assert(previousGuard.disconnected);assert.notEqual(rack.peakGuard,previousGuard);
});

test('final peak guard is symmetric, bounded and transparent below its soft knee',t=>{
  globals(t);const ctx=new Context(),rack=new AudioRack(catalog,ctx),curve=rack.peakGuard.curve;
  assert.equal(rack.master.destination,rack.limiter);assert.equal(rack.limiter.destination,rack.peakGuard);
  assert.equal(rack.peakGuard.destination,ctx.destination);assert.equal(curve.length,4097);
  for(let i=0;i<curve.length;i++){
    const x=(i-2048)/2048;
    assert(Number.isFinite(curve[i])&&Math.abs(curve[i])<.98);
    assert(Math.abs(curve[i]+curve[curve.length-1-i])<1e-7);
    if(i)assert(curve[i]>=curve[i-1]);
    if(Math.abs(x)<=.9)assert.equal(curve[i],x);
  }
});

test('saved mute remains effective on first creation and context recovery',async t=>{
  globals(t);const rack=new AudioRack(catalog);rack.setMute(true);
  await rack.unlock();assert.equal(rack.master.gain.value,0);
  rack.ctx.state='closed';await rack.unlock();assert.equal(rack.master.gain.value,0);
});

test('stalled sample fetch is aborted, clears its cache promise, then retries',async t=>{
  globals(t);t.mock.timers.enable({apis:['setTimeout']});let signal;
  t.mock.method(globalThis,'fetch',(_file,options)=>{signal=options.signal;return new Promise(()=>{});});
  const rack=new AudioRack(catalog,new Context()),pending=rack.load('piano');
  const rejected=assert.rejects(pending,/再試行/);t.mock.timers.tick(8000);await rejected;
  assert(signal.aborted);assert.equal(rack.loading.size,0);assert.equal(rack.buffers.size,0);
  globalThis.fetch.mock.mockImplementation(async()=>({ok:true,arrayBuffer:async()=>new ArrayBuffer(4)}));
  await rack.load('piano');assert.equal(rack.buffers.size,1);assert.equal(rack.loading.size,0);
});

test('stalled sample decode also times out and remains retryable',async t=>{
  globals(t);t.mock.timers.enable({apis:['setTimeout']});
  t.mock.method(globalThis,'fetch',async()=>({ok:true,arrayBuffer:async()=>new ArrayBuffer(4)}));
  const rack=new AudioRack(catalog,new Context());rack.decoder.decodeAudioData=()=>new Promise(()=>{});
  const pending=rack.load('piano'),rejected=assert.rejects(pending,/再試行/);
  await Promise.resolve();await Promise.resolve();t.mock.timers.tick(8000);await rejected;
  assert.equal(rack.loading.size,0);
  rack.decoder.decodeAudioData=async()=>new Buffer();await rack.load('piano');assert.equal(rack.buffers.size,1);
});


test('remote audio applies one manual distance curve with panner rolloff disabled',t=>{
  globals(t);const ctx=new Context();
  ctx.listener=Object.fromEntries(['positionX','positionY','positionZ','forwardX','forwardY','forwardZ','upX','upY','upZ'].map(name=>[name,new Param()]));
  ctx.createPanner=()=>Object.assign(new Node(),{positionX:new Param(),positionY:new Param(),positionZ:new Param(),rolloffFactor:1});
  const rack=new AudioRack(catalog,ctx),listener={x:0,y:0,z:0,fx:0,fy:1,fz:0};
  const slot=rack.slot(2,'piano',15,'range15');slot.volume=.8;
  assert.equal(slot.gain.destination,slot.panner);assert.equal(slot.panner.destination,rack.master);
  assert.equal(slot.panner.panningModel,'HRTF');assert.equal(slot.panner.distanceModel,'inverse');
  assert.equal(slot.panner.rolloffFactor,0);assert.equal(slot.panner.refDistance,1);assert.equal(slot.panner.maxDistance,15);
  assert.equal(slot.gain.gain.value,0,'remote source stays silent before its position is known');
  for(const [distance,scale]of [[1,1],[3,144/196],[7,64/196],[10,25/196],[15,0],[20,0]]){
    rack.positions(listener,[{player:2,x:distance,y:0,z:0}]);
    assert.equal(slot.distance,distance);
    assert(Math.abs(slot.gain.gain.value-.8*scale)<1e-12,`${distance}m gain should use the distance curve once`);
  }
  rack.positions(listener,[]);assert.equal(slot.gain.gain.value,0,'missing source position silences remote audio');
  const legacy=rack.slot(3,'piano',7,'legacy7');legacy.volume=.5;
  rack.positions(listener,[{player:3,x:3,y:0,z:0}]);
  assert.equal(legacy.range,7);assert.equal(legacy.panner.maxDistance,7);assert.equal(legacy.panner.rolloffFactor,0);
  assert(Math.abs(legacy.gain.gain.value-.5*4/9)<1e-12,'explicit legacy range keeps its previous gain');
  const local=rack.slot('local','piano',15);local.volume=.6;rack.updateGain('local',local);
  assert.equal(local.panner,null);assert.equal(local.gain.gain.value,.6,'local monitoring receives no distance attenuation');
});

test('listener mix is per performer and survives source volume and position updates',t=>{
  globals(t);const ctx=new Context();
  ctx.listener=Object.fromEntries(['positionX','positionY','positionZ','forwardX','forwardY','forwardZ','upX','upY','upZ'].map(n=>[n,new Param()]));
  ctx.createPanner=()=>Object.assign(new Node(),{positionX:new Param(),positionY:new Param(),positionZ:new Param()});
  const rack=new AudioRack(catalog,ctx),listener={x:0,y:0,z:0,fx:0,fy:1,fz:0};rack.buffers.set('piano.ogg',new Buffer());
  const a=rack.slot(2,'piano',15,'a'),b=rack.slot(3,'piano',15,'b');a.volume=.8;b.volume=.6;
  rack.positions(listener,[{player:2,x:3,y:0,z:0},{player:3,x:1,y:0,z:0}]);
  const master=rack.master.gain.value,other=b.gain.gain.value;
  assert(rack.setSourceVolume(2,.25,'a'));assert(Math.abs(a.gain.gain.value-.8*.25*144/196)<1e-12);
  assert.equal(b.gain.gain.value,other);assert.equal(rack.master.gain.value,master);
  rack.sync(2,{instrument:'piano',session:'a',range:15,notes:[],volume:.4});
  rack.positions(listener,[{player:2,x:1,y:0,z:0},{player:3,x:1,y:0,z:0}]);
  assert.equal(a.listenVolume,.25);assert.equal(a.gain.gain.value,.1);assert.equal(a.volume,.4);
  assert(!rack.setSourceVolume(2,NaN,'a'));assert(!rack.setSourceVolume(2,Infinity,'a'));assert(!rack.setSourceVolume('local',0));
  assert(rack.setSourceVolume(2,-1,'a'));assert.equal(a.gain.gain.value,0);
  assert(rack.setSourceVolume(2,2,'a'));assert.equal(a.gain.gain.value,.4);
  const replacement=rack.slot(2,'piano',15,'new');assert.equal(replacement.listenVolume,1);
  assert(!rack.setSourceVolume(2,0,'a'));assert.equal(replacement.listenVolume,1);
  rack.remove(2);assert(!rack.setSourceVolume(2,.5,'new'));rack.stopAll();
});

test('listener mute preserves a held note phase and cannot alter another performer',t=>{
  globals(t);const ctx=new Context();
  ctx.listener=Object.fromEntries(['positionX','positionY','positionZ','forwardX','forwardY','forwardZ','upX','upY','upZ'].map(n=>[n,new Param()]));
  ctx.createPanner=()=>Object.assign(new Node(),{positionX:new Param(),positionY:new Param(),positionZ:new Param()});
  const rack=new AudioRack(catalog,ctx);rack.buffers.set('piano.ogg',new Buffer());
  rack.sync(2,{instrument:'piano',session:'a',range:15,volume:.7,notes:[{id:1,pitch:60,velocity:100,held:true,age:0}]});
  rack.positions({x:0,y:0,z:0,fx:0,fy:1,fz:0},[{player:2,x:1,y:0,z:0}]);
  const slot=rack.slots.get(2),source=slot.voices.get(1).source;
  assert(rack.setSourceVolume(2,0,'a'));assert.equal(slot.gain.gain.value,0);
  assert.equal(slot.voices.get(1).source,source);assert(!source.stopped);
  assert(rack.setSourceVolume(2,.8,'a'));assert(Math.abs(slot.gain.gain.value-.56)<1e-12);
  assert.equal(slot.voices.get(1).source,source);assert.equal(ctx.sources.length,1);
  rack.remove(2);
  rack.sync(2,{instrument:'piano',session:'a',range:15,volume:.7,notes:[{id:1,pitch:60,velocity:100,held:true,age:500}]},0);
  rack.positions({x:0,y:0,z:0,fx:0,fy:1,fz:0},[{player:2,x:1,y:0,z:0}]);
  assert.equal(rack.slots.get(2).listenVolume,0);assert.equal(rack.slots.get(2).gain.gain.value,0,'healing snapshot must apply the listener mute before rendering');rack.stopAll();
});

test('an existing listener at 20m adopts an expanded 25m range and starts the held note at its current age',t=>{
  globals(t);const ctx=spatialContext(),rack=new AudioRack(catalog,ctx),buffer=new Buffer(1,32000*8);
  let time=0;rack.now=()=>time;rack.buffers.set('piano.ogg',buffer);
  const listener={x:0,y:0,z:0,fx:0,fy:1,fz:0},note={id:1,pitch:60,velocity:100,held:true,age:1000};
  const state={instrument:'piano',session:'range-change',range:15,volume:.8,notes:[note]};
  rack.sync(2,state,.25);rack.positions(listener,[{player:2,x:20,y:0,z:0}]);
  const slot=rack.slots.get(2),gain=slot.gain,panner=slot.panner;
  assert.equal(slot.gain.gain.value,0);assert.equal(slot.voices.size,0);assert.equal(ctx.sources.length,0);
  time=500;ctx.currentTime=.5;rack.sync(2,{...state,range:25,notes:[{...note,age:1500}]});
  assert.equal(rack.slots.get(2),slot);assert.equal(slot.gain,gain);assert.equal(slot.panner,panner);assert.equal(slot.range,25);assert.equal(panner.maxDistance,25);
  assert(Math.abs(slot.gain.gain.value-.8*.25*25/576)<1e-12);assert(slot.gain.gain.value>0);
  const voice=slot.voices.get(1),source=voice.source;assert.equal(source.buffer,buffer);assert.deepEqual(source.starts,[{time:.5,offset:1.5}]);
  time=1000;ctx.currentTime=1;rack.sync(2,{...state,range:25,notes:[{...note,age:2000}]});
  assert.equal(slot.voices.get(1),voice);assert.equal(voice.source,source);assert.equal(ctx.sources.length,1);assert.equal(source.starts.length,1);assert.equal(voice.startedAt,.5);
  rack.positions(listener,[{player:2,x:3,y:0,z:0}]);rack.sync(2,{...state,range:5,notes:[{...note,age:2000}]});
  assert.equal(slot.range,5);assert.equal(panner.maxDistance,5);assert(Math.abs(slot.gain.gain.value-.8*.25*.25)<1e-12);
  assert.equal(slot.voices.get(1),voice);assert.equal(ctx.sources.length,1);assert.equal(source.starts.length,1);assert.equal(slot.listenVolume,.25);rack.stopAll();
});

test('nearby held voices retain identity timing local mix and other performers during 15 to 25 to 5m updates',t=>{
  globals(t);const ctx=spatialContext(),rack=new AudioRack(catalog,ctx),buffer=new Buffer(1,32000*8);
  let time=0;rack.now=()=>time;rack.buffers.set('piano.ogg',buffer);
  const note={id:1,pitch:60,velocity:100,held:true,age:0},state={instrument:'piano',session:'a',range:15,volume:.8,notes:[note]};
  rack.sync(2,state,.37);rack.sync(3,{...state,session:'b',volume:.6});rack.sync('local',{...state,session:'local',volume:.5});
  rack.positions({x:0,y:0,z:0,fx:0,fy:1,fz:0},[{player:2,x:3,y:0,z:0},{player:3,x:1,y:0,z:0}]);
  const slot=rack.slots.get(2),voice=slot.voices.get(1),source=voice.source,other=rack.slots.get(3),local=rack.slots.get('local');
  const before={startedAt:voice.startedAt,attackEnd:voice.attackEnd,otherGain:other.gain.gain.value,otherVoice:other.voices.get(1),localGain:local.gain.gain.value,localVoice:local.voices.get(1),master:rack.master.gain.value};
  for(const [range,curve]of [[25,121/144],[5,.25]]){
    time+=300;ctx.currentTime+=.3;rack.sync(2,{...state,range,notes:[{...note,age:time}]});
    assert.equal(rack.slots.get(2),slot);assert.equal(slot.range,range);assert.equal(slot.panner.maxDistance,range);assert.equal(slot.panner.rolloffFactor,0);
    assert(Math.abs(slot.gain.gain.value-.8*.37*curve)<1e-12);assert.equal(slot.listenVolume,.37);assert.equal(slot.volume,.8);assert.equal(slot.session,'a');
    assert.equal(slot.voices.get(1),voice);assert.equal(voice.source,source);assert.equal(voice.startedAt,before.startedAt);assert.equal(voice.attackEnd,before.attackEnd);assert.equal(source.starts.length,1);
    assert.equal(source.buffer,buffer);assert.equal(rack.buffers.get('piano.ogg'),buffer);assert.equal(ctx.sources.length,3);
    assert.equal(other.range,15);assert.equal(other.gain.gain.value,before.otherGain);assert.equal(other.voices.get(1),before.otherVoice);
    assert.equal(local.range,15);assert.equal(local.panner,null);assert.equal(local.gain.gain.value,before.localGain);assert.equal(local.voices.get(1),before.localVoice);assert.equal(rack.master.gain.value,before.master);
  }
  assert(!source.stopped);rack.stopAll();
});

test('invalid or omitted range cannot corrupt an existing slot and out-of-range positions still stop its voice',t=>{
  globals(t);const ctx=spatialContext(),rack=new AudioRack(catalog,ctx);rack.buffers.set('piano.ogg',new Buffer(1,32000*8));
  const listener={x:0,y:0,z:0,fx:0,fy:1,fz:0},state={instrument:'piano',session:'range-guard',range:25,volume:.7,notes:[{id:1,pitch:60,velocity:100,held:true,age:0}]};
  rack.sync(2,state,.4);rack.positions(listener,[{player:2,x:3,y:0,z:0}]);
  const slot=rack.slots.get(2),voice=slot.voices.get(1),gain=slot.gain.gain.value;
  for(const range of [NaN,Infinity,-Infinity,0,-5,'5',null,undefined]){
    rack.sync(2,{...state,range});assert.equal(slot.range,25);assert.equal(slot.panner.maxDistance,25);assert.equal(slot.gain.gain.value,gain);
    assert.equal(slot.voices.get(1),voice);assert.equal(voice.source.starts.length,1);assert.equal(slot.listenVolume,.4);
  }
  const legacy=rack.slot(3,'piano');assert.equal(legacy.range,7);assert.equal(legacy.panner.maxDistance,7);
  rack.sync(2,{...state,range:5});assert.equal(slot.range,5);assert.equal(slot.panner.maxDistance,5);
  rack.positions(listener,[{player:2,x:5,y:0,z:0}]);
  assert.equal(slot.gain.gain.value,0);assert.equal(slot.voices.size,0);assert.equal(slot.done.size,0);assert.equal(slot.deferred.length,0);assert(voice.released&&voice.source.stopped);
  assert.equal(voice.source.starts.length,1);assert.equal(ctx.sources.length,1);rack.stopAll();
});
