import test from 'node:test';
import assert from 'node:assert/strict';
import {MidiInput} from '../web/midi.mjs';
import {Performance} from '../web/model.mjs';
function setup(){
  const log=[];const midi=new MidiInput(Object.fromEntries(['press','release','pedal','panic','status','devices'].map(name=>[name,(...args)=>log.push([name,...args])])));
  return {midi,log};
}
function navigatorFor(t,requestMIDIAccess){
  const previous=Object.getOwnPropertyDescriptor(globalThis,'navigator');
  Object.defineProperty(globalThis,'navigator',{configurable:true,value:{requestMIDIAccess}});
  t.after(()=>{if(previous)Object.defineProperty(globalThis,'navigator',previous);else delete globalThis.navigator;});
}
function performanceSetup(kind='pluck'){
  const operations=[],pitch=kind==='drums'?36:60;
  const model=new Performance({kind,min:36,max:96,octave:4,samples:[{midi:pitch,layer:4}]},operation=>operations.push(operation));
  const midi=new MidiInput({press:(...args)=>model.press(...args),release:key=>model.release(key),
    pedal:down=>model.pedal(down),panic:()=>model.panic(),status:()=>{},devices:()=>{}});
  return {midi,model,operations,pitch};
}

test('repeated MIDI Note On retriggers piano and drums with a fresh velocity and no initial release',()=>{
  for(const kind of ['pluck','drums']){
    const {midi,model,operations,pitch}=performanceSetup(kind);
    midi.receive([0x90,pitch,60]);assert.deepEqual(operations.map(op=>op.kind),['on']);
    midi.receive([0x90,pitch,120]);assert.deepEqual(operations.map(op=>op.kind),['on','off','on']);
    assert.equal(operations[1].id,operations[0].id);assert.notEqual(operations[2].id,operations[0].id);
    assert.equal(operations[2].velocity,120);assert.equal(model.notes.size,1);assert.equal(midi.activeKeys.size,1);
    midi.receive([0x80,pitch,0]);assert.equal(model.notes.size,0);assert.equal(midi.activeKeys.size,0);
  }
});

test('MIDI retrigger leaves other channels and held PC notes independent while PC repeat stays suppressed',()=>{
  const {midi,model,operations}=performanceSetup();
  model.press('key:Z',60);model.press('key:Z',60);assert.equal(operations.length,1);
  midi.receive([0x90,60,60]);midi.receive([0x91,60,70]);
  const other=model.keys.get('midi:1:60');midi.receive([0x90,60,120]);
  assert.equal(model.notes.size,3);assert.equal(model.keys.get('midi:1:60'),other);
  assert.equal(model.notes.get(other).velocity,70);assert(model.keys.has('key:Z'));
  assert.equal(operations.filter(op=>op.kind==='on').length,4);
  midi.receive([0x90,60,0]);assert.equal(model.notes.size,2);
  midi.receive([0x81,60,0]);model.release('key:Z');assert.equal(model.notes.size,0);assert.equal(midi.activeKeys.size,0);
});

test('MIDI sustain retains the old released strike while a repeated Note On owns the new key',()=>{
  const {midi,model}=performanceSetup();midi.receive([0xb0,64,127]);
  midi.receive([0x90,60,60]);const first=model.keys.get('midi:0:60');midi.receive([0x90,60,120]);
  const second=model.keys.get('midi:0:60');assert.notEqual(first,second);assert.equal(model.notes.size,2);
  assert.equal(model.notes.get(first).held,false);assert.equal(model.notes.get(second).held,true);
  midi.receive([0x90,60,0]);assert.equal(midi.activeKeys.size,0);assert.equal(model.notes.size,2);
  assert.equal(model.notes.get(second).held,false);midi.receive([0xb0,64,0]);assert.equal(model.notes.size,0);
});

test('MIDI active keys are bounded by valid channels and pitches and clear on global CC or detach',()=>{
  const {midi,log}=setup();
  for(let channel=0;channel<16;channel++)for(let pitch=0;pitch<128;pitch++)midi.receive([0x90+channel,pitch,90]);
  assert.equal(midi.activeKeys.size,2048);
  for(let pitch=0;pitch<128;pitch++)midi.receive([0x90,pitch,100]);assert.equal(midi.activeKeys.size,2048);
  for(const controller of [123,120]){
    midi.receive([0xb0,controller,0]);assert.equal(midi.activeKeys.size,0);
    const before=log.filter(row=>row[0]==='release').length;midi.receive([0x90,60,100]);
    assert.equal(log.filter(row=>row[0]==='release').length,before,'first strike after CC must not release a previous identity');
  }
  midi.port={state:'connected',onmidimessage:()=>{},close:()=>{}};midi.detach();assert.equal(midi.activeKeys.size,0);
});
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
