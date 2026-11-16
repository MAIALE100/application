import test from 'node:test';
import assert from 'node:assert/strict';
import {MidiInput} from '../web/midi.mjs';
function setup(){
  const log=[];const midi=new MidiInput(Object.fromEntries(['press','release','pedal','panic','status','devices'].map(name=>[name,(...args)=>log.push([name,...args])])));
  return {midi,log};
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
