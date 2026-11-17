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
  createBuffer(channels,length,rate){return new Buffer(channels,length,rate);}
  createBufferSource(){
    const node=Object.assign(new Node(),{playbackRate:new Param(),start(time,offset){assert(Number.isFinite(time)&&Number.isFinite(offset));},stop(){this.stopped=true;}});
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
  rack.buffers.set('piano.ogg',new Buffer(1,32000*8));
  rack.sync('local',{instrument:'piano',volume:.75,notes:[{id:1,pitch:60,velocity:100,age:0}]});
  ctx.state='closed';assert.equal(await rack.unlock(),true);
  assert.notEqual(rack.ctx,ctx);assert.equal(rack.stats().nodes,0);assert.equal(rack.slots.size,0);
  assert.equal(rack.buffers.size,1);assert(ctx.sources[0].stopped&&ctx.sources[0].disconnected);
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
