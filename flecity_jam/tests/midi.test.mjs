import test from 'node:test';
import assert from 'node:assert/strict';
import {MidiInput} from '../web/midi.mjs';
function setup(){
  const log=[];const midi=new MidiInput(Object.fromEntries(['press','release','pedal','panic','status','devices'].map(name=>[name,(...args)=>log.push([name,...args])])));
  return {midi,log};
}
function navigatorFor(t,requestMIDIAccess){
  const previous=Object.getOwnPropertyDescriptor(globalThis,'navigator');
  Object.defineProperty(globalThis,'navigator',{configurable:true,value:{requestMIDIAccess}});
  t.after(()=>{if(previous)Object.defineProperty(globalThis,'navigator',previous);else delete globalThis.navigator;});
}
test('MIDI channels keep note identities separate and zero velocity releases',()=>{
  const {midi,log}=setup();midi.receive([0x90,60,40]);midi.receive([0x91,60,100]);midi.receive([0x90,60,0]);
  assert.deepEqual(log,[['press','midi:0:60',60,40],['press','midi:1:60',60,100],['release','midi:0:60']]);
});
test('malformed or non-note MIDI packets cannot alter notes or pedals',()=>{
  const {midi,log}=setup();for(const packet of [null,[],[0x90],[0x90,60],[0x90,60,128],[0x90,-1,70],[0x90,60,NaN],[0x90,60,1.5],[0xf8],[0xf0,60,1],[0x10,60,100]])midi.receive(packet);
  assert.deepEqual(log,[]);
});
test('sustain stays down until every MIDI channel releases its pedal',()=>{
  const {midi,log}=setup();midi.receive([0xb0,64,127]);midi.receive([0xb1,64,127]);midi.receive([0xb0,64,0]);midi.receive([0xb1,64,0]);
  assert.deepEqual(log,[['pedal',true],['pedal',true],['pedal',true],['pedal',false]]);
});
test('all-notes-off and disconnect clear every held pedal safely',async()=>{
  const {midi,log}=setup();midi.receive([0xb0,64,127]);midi.receive([0xb0,123,0]);assert.equal(midi.pedals.size,0);
  const port={state:'connected',onmidimessage:()=>{},close:()=>Promise.reject(Error('unplugged'))};midi.port=port;midi.detach();
  await Promise.resolve();assert.equal(port.onmidimessage,null);assert.equal(midi.port,null);assert(log.some(x=>x[0]==='panic'));
});
test('device switch detaches the old input before accepting a new one',()=>{
  const {midi,log}=setup(),first={state:'connected',id:'a',name:'A'},second={state:'connected',id:'b',name:'B'};
  midi.access={inputs:new Map([['a',first],['b',second]])};midi.select('a');midi.select('b');
  assert.equal(first.onmidimessage,null);assert.equal(midi.port,second);assert.equal(typeof second.onmidimessage,'function');assert(log.some(x=>x[0]==='panic'));
  second.state='disconnected';midi.refresh();assert.equal(midi.port,first);
});

test('concurrent connect requests share one task and replacement access releases old handlers',async t=>{
  const {midi}=setup(),resolvers=[];
  navigatorFor(t,options=>{assert.deepEqual(options,{sysex:false});return new Promise(resolve=>resolvers.push(resolve));});
  const first=midi.connect(),repeated=midi.connect();assert.equal(first,repeated);
  await Promise.resolve();assert.equal(resolvers.length,1);
  const oldPort={id:'old',name:'Old',state:'connected'},oldAccess={inputs:new Map([['old',oldPort]])};
  resolvers[0](oldAccess);await first;
  assert.equal(midi.access,oldAccess);assert.equal(midi.port,oldPort);assert.equal(typeof oldAccess.onstatechange,'function');
  const next=midi.connect();assert.equal(next,midi.connect());
  await Promise.resolve();assert.equal(resolvers.length,2);
  const newPort={id:'new',name:'New',state:'connected'},newAccess={inputs:new Map([['new',newPort]])};
  resolvers[1](newAccess);await next;
  assert.equal(oldAccess.onstatechange,null);assert.equal(oldPort.onmidimessage,null);
  assert.equal(midi.access,newAccess);assert.equal(midi.port,newPort);assert.equal(typeof newAccess.onstatechange,'function');
  const selectedHandler=newPort.onmidimessage,again=midi.connect();
  await Promise.resolve();resolvers[2]({inputs:new Map([['new',newPort]])});await again;
  assert.equal(newPort.onmidimessage,selectedHandler);assert.equal(midi.port,newPort);
  assert.equal(midi.connecting,null);
});

test('denied or synchronously failed MIDI access clears the task and allows retry',async t=>{
  const {midi,log}=setup(),access={inputs:new Map()};let calls=0;
  navigatorFor(t,()=>{calls++;if(calls===1)throw Error('permission unavailable');if(calls===2)return Promise.reject(Error('denied'));return Promise.resolve(access);});
  await midi.connect();assert.equal(midi.connecting,null);assert.equal(midi.access,null);
  await midi.connect();assert.equal(midi.connecting,null);assert.equal(midi.access,null);
  await midi.connect();assert.equal(calls,3);assert.equal(midi.access,access);assert.equal(midi.connecting,null);
  assert.equal(log.filter(row=>row[0]==='status'&&row[1].includes('許可されません')).length,2);
});

test('unsupported MIDI reports the limitation without changing musical input state',async t=>{
  const {midi,log}=setup();navigatorFor(t,undefined);
  await midi.connect();assert.equal(midi.access,null);assert.equal(midi.connecting,null);
  assert.equal(log.length,1);assert.equal(log[0][0],'status');assert(log[0][1].includes('対応していません'));
});

test('renewed MIDI access retains a selected device ID when port objects are replaced',async t=>{
  const {midi}=setup();let menu='';
  // Same selection-preserving device-list update as the application's MIDI select.
  midi.devices=ports=>{const previous=menu;menu=ports[0]?.id||'';if(ports.some(p=>p.id===previous))menu=previous;};
  const port=id=>({id,name:id.toUpperCase(),state:'connected',onmidimessage:null});
  const firstA=port('a'),firstB=port('b'),nextA=port('a'),nextB=port('b');
  const first={inputs:new Map([['a',firstA],['b',firstB]])},next={inputs:new Map([['a',nextA],['b',nextB]])};
  let calls=0;navigatorFor(t,async()=>[first,next][calls++]);
  await midi.connect();menu='b';midi.select('b');assert.equal(midi.port,firstB);
  await midi.connect();assert.equal(firstB.onmidimessage,null);assert.equal(midi.port,nextB);assert.equal(menu,'b');assert.equal(typeof nextB.onmidimessage,'function');
  const refreshedB=port('b');next.inputs.set('b',refreshedB);midi.refresh();
  assert.equal(nextB.onmidimessage,null);assert.equal(midi.port,refreshedB);assert.equal(menu,'b');
});

test('renewed MIDI access falls back to a visible device when the selected ID disappears',async t=>{
  const {midi}=setup();let menu='';
  midi.devices=ports=>{const previous=menu;menu=ports[0]?.id||'';if(ports.some(p=>p.id===previous))menu=previous;};
  const port=id=>({id,name:id.toUpperCase(),state:'connected',onmidimessage:null});
  const oldB=port('b'),newA=port('a'),newC=port('c');
  const accesses=[{inputs:new Map([['a',port('a')],['b',oldB]])},{inputs:new Map([['a',newA],['c',newC]])}];
  let calls=0;navigatorFor(t,async()=>accesses[calls++]);
  await midi.connect();menu='b';midi.select('b');await midi.connect();
  assert.equal(oldB.onmidimessage,null);assert.equal(midi.port,newA);assert.equal(menu,'a');assert.equal(typeof newA.onmidimessage,'function');
});
