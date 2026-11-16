import test from 'node:test';
import assert from 'node:assert/strict';
import {AudioRack} from '../web/audio.mjs';

class Param {
  constructor(){this.value=0;}
  setValueAtTime(value){this.value=value;}
  setTargetAtTime(value){this.value=value;}
  linearRampToValueAtTime(value){this.value=value;}
  cancelAndHoldAtTime(){}
}
class Node {
  connect(node){return node;}
  disconnect(){this.disconnected=true;}
}
class Context {
  constructor(){
    this.state='running';this.currentTime=0;this.destination=new Node();this.sources=[];
    this.listener=Object.fromEntries(['positionX','positionY','positionZ','forwardX','forwardY','forwardZ','upX','upY','upZ'].map(k=>[k,new Param()]));
  }
  resume(){this.state='running';return Promise.resolve();}
  createGain(){return Object.assign(new Node(),{gain:new Param()});}
  createDynamicsCompressor(){return Object.assign(new Node(),Object.fromEntries(['threshold','knee','ratio','attack','release'].map(k=>[k,new Param()])));}
  createPanner(){return Object.assign(new Node(),Object.fromEntries(['positionX','positionY','positionZ'].map(k=>[k,new Param()])));}
  createBufferSource(){
    const source=Object.assign(new Node(),{playbackRate:new Param(),start(_time,offset){this.offset=offset;},stop(){this.stopped=true;}});
    this.sources.push(source);return source;
  }
}
const catalog={instruments:[{id:'clarinet',kind:'sustain',attack:.015,release:.12,gain:1,
  samples:[{file:'tone.ogg',midi:60,layer:4,gain:1}]}]};
const note=id=>({id,pitch:60,velocity:100,held:true,age:0});
const state=(session,notes)=>({session,instrument:'clarinet',range:7,volume:.75,notes});
const listener={x:0,y:0,z:0,fx:0,fy:1,fz:0};
function setup(t){
  const original=globalThis.OfflineAudioContext;globalThis.OfflineAudioContext=class {};
  t.after(()=>{if(original===undefined)delete globalThis.OfflineAudioContext;else globalThis.OfflineAudioContext=original;});
  const ctx=new Context(),rack=new AudioRack(catalog,ctx),resolvers=[];
  rack.load=()=>new Promise(resolve=>resolvers.push(resolve));
  let time=0;rack.now=()=>time;
  const ready=()=>rack.buffers.set('tone.ogg',{duration:8});
  const positions=(distance=2)=>rack.positions(listener,[{player:2,x:0,y:distance,z:0}]);
  return {ctx,rack,resolvers,ready,positions,setTime:value=>{time=value;}};
}

test('brief note on/off during decode plays once if the sample arrives promptly',async t=>{
  const {ctx,rack,resolvers,ready,positions,setTime}=setup(t);
  rack.sync(2,state('first',[note(1)]));positions();
  setTime(30);rack.sync(2,state('first',[]));
  assert.equal(rack.slots.get(2).deferred.length,1);
  setTime(80);ready();resolvers.shift()();await Promise.resolve();
  assert.equal(ctx.sources.length,1);
  assert.equal(rack.slots.get(2).deferred.length,0);
  assert.equal(rack.slots.get(2).voices.size,0);
  assert(ctx.sources[0].offset>0 && ctx.sources[0].offset<.25);
  await new Promise(resolve=>setTimeout(resolve,30));
  assert(ctx.sources[0].stopped,'a released melodic tap must not sustain indefinitely');
  rack.stopAll();
});

test('cached sample waits briefly for the remote ped to stream into the position list',t=>{
  const {ctx,rack,ready,positions,setTime}=setup(t);ready();
  rack.sync(2,state('first',[note(1)]));
  rack.positions(listener,[]); // OneSync has the performer, but its ped is not streamed in yet.
  setTime(30);rack.sync(2,state('first',[]));
  assert.equal(ctx.sources.length,0);assert.equal(rack.slots.get(2).deferred.length,1);
  setTime(80);rack.positions(listener,[]);
  assert.equal(rack.slots.get(2).deferred.length,1);
  positions();assert.equal(ctx.sources.length,1);
  assert.equal(rack.slots.get(2).deferred.length,0);
  rack.stopAll();
});

test('remote held note waits for audio resume and starts only once',async t=>{
  const {ctx,rack,ready,positions}=setup(t);ready();ctx.state='suspended';
  rack.sync(2,state('first',[note(1)]));positions();
  assert.equal(ctx.sources.length,0,'suspended audio must not queue a remote source');
  assert.equal(await rack.unlock(),true);
  assert.equal(ctx.sources.length,1);
  assert.equal(rack.slots.get(2).voices.size,1);
  await rack.unlock();positions();
  assert.equal(ctx.sources.length,1,'resume and position refresh must not duplicate the voice');
  rack.stopAll();
});

test('offline rendering can schedule remote notes before rendering begins',t=>{
  const {ctx,rack,ready,positions}=setup(t);ready();
  ctx.state='suspended';ctx.startRendering=async()=>{};
  rack.sync(2,state('offline',[note(1)]));positions();
  assert.equal(ctx.sources.length,1);
  assert.equal(rack.slots.get(2).voices.size,1);
  rack.stopAll();
});

test('unknown position never arriving expires the note, and a far position drops it',t=>{
  t.mock.timers.enable({apis:['setTimeout']});
  const {ctx,rack,ready,positions,setTime}=setup(t);ready();
  rack.sync(2,state('first',[note(1)]));rack.sync(2,state('first',[]));
  setTime(100);positions(9);
  assert.equal(rack.slots.get(2).deferred.length,0);assert.equal(ctx.sources.length,0);
  rack.positions(listener,[]);
  rack.sync(2,state('first',[note(2)]));rack.sync(2,state('first',[]));
  assert.equal(rack.slots.get(2).deferred.length,1);
  setTime(400);t.mock.timers.tick(251);
  assert.equal(rack.slots.get(2).deferred.length,0);
  positions();assert.equal(ctx.sources.length,0,'an expired note must not be heard on re-entry');
  rack.stopAll();
});

test('late decode, out-of-range, and stop discard cached taps',async t=>{
  const {ctx,rack,resolvers,ready,positions,setTime}=setup(t);
  rack.sync(2,state('first',[note(1)]));positions();
  rack.sync(2,state('first',[]));setTime(300);ready();resolvers.shift()();await Promise.resolve();
  assert.equal(ctx.sources.length,0,'a 300ms-late note must not replay');

  rack.buffers.delete('tone.ogg');
  rack.sync(2,state('first',[note(2)]));rack.sync(2,state('first',[]));
  positions(9);assert.equal(rack.slots.get(2).deferred.length,0);
  ready();resolvers.shift()();await Promise.resolve();assert.equal(ctx.sources.length,0);

  rack.buffers.delete('tone.ogg');
  rack.sync(2,state('first',[note(3)]));rack.sync(2,state('first',[]));
  rack.remove(2);ready();resolvers.shift()();await Promise.resolve();
  assert.equal(ctx.sources.length,0);assert.equal(rack.slots.size,0);
});

test('new session with the same instrument cannot replay a prior session tap',async t=>{
  const {ctx,rack,resolvers,ready,positions}=setup(t);
  rack.sync(2,state('old',[note(1)]));rack.sync(2,state('old',[]));
  rack.sync(2,state('new',[note(1)]));positions();
  assert.equal(rack.slots.get(2).session,'new');
  ready();for(const resolve of resolvers)resolve();await Promise.resolve();
  assert.equal(ctx.sources.length,1);
  assert.equal(rack.slots.get(2).voices.size,1);
  rack.stopAll();
});

test('unloaded notes stay bounded under repeated input',t=>{
  const {rack}=setup(t);
  for(let id=1;id<=200;id++){
    rack.sync(2,state('first',[note(id)]));rack.sync(2,state('first',[]));
  }
  assert.equal(rack.slots.get(2).deferred.length,16);
  assert.equal(rack.slots.get(2).deferred[0].id,185);
  rack.stopAll();assert.equal(rack.slots.size,0);
});
