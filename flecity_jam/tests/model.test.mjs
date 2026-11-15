import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {Performance,Replicas,DEFAULT_KEYS,validBindings,attenuation,selectSample} from '../web/model.mjs';
const catalog=JSON.parse(fs.readFileSync(new URL('../web/catalog.json',import.meta.url)));
const spec=catalog.instruments[0];
test('note off preserves pitch across octave changes',()=>{
  const ops=[],p=new Performance(spec,x=>ops.push(x));p.press('a',p.pitch('KeyA'));p.shift(1);p.release('a');assert.equal(ops[0].pitch,60);assert.equal(ops[1].id,ops[0].id);assert.equal(p.notes.size,0);
});
test('repeat events, chords and independently held same pitch',()=>{
  const p=new Performance(spec,()=>{});p.press('a',60);p.press('a',60);p.press('s',64);p.press('midi',60);assert.equal(p.notes.size,3);p.release('a');assert.equal(p.notes.size,2);p.panic();assert.equal(p.notes.size,0);
});
test('sustain and retriggers clean up on pedal up',()=>{
  const p=new Performance(spec,()=>{});p.pedal(true);for(let i=0;i<12;i++){p.press('a',60);p.release('a');}assert.equal(p.notes.size,12);p.pedal(false);assert.equal(p.notes.size,0);
});
test('voice stealing stays bounded even with sustain',()=>{
  const ops=[],p=new Performance(spec,x=>ops.push(x));p.pedal(true);for(let i=0;i<300;i++){p.press('a',60);p.release('a');}assert.equal(p.notes.size,16);assert.equal(ops.filter(x=>x.kind==='kill').length,284);p.panic();assert.equal(p.keys.size,0);
});
test('bindings reject duplicates reserved system and PTT keys',()=>{
  assert(validBindings(DEFAULT_KEYS));for(const value of ['KeyN','Escape','KeyA','F8','AltLeft','x']){const k=[...DEFAULT_KEYS];k[1]=value;assert(!validBindings(k));}assert(!validBindings(DEFAULT_KEYS,['KeyA']));
});
test('attenuation ends exactly at range and rejects invalid inputs',()=>{
  assert.equal(attenuation(0,7),1);assert(attenuation(3,7)>attenuation(5,7));assert.equal(attenuation(7,7),0);assert.equal(attenuation(100,7),0);assert.equal(attenuation(NaN,7),0);
});
test('sample layers and range stay consistent',()=>{
  assert.equal(selectSample(spec,60,50).layer,2);assert.equal(selectSample(spec,60,110).layer,4);
  for(const s of catalog.instruments)for(let n=s.min;n<=s.max;n++)if(s.kind!=='drums')assert(Math.abs(selectSample(s,n,100).midi-n)<=3,`${s.id}: ${n} exceeds 3 semitones`);
});
test('replicas reject old wire data, heal gaps, permit range re-entry',()=>{
  let t=0;const events=[],r=new Replicas((id,s)=>events.push(s),id=>events.push('stop'),()=>t);
  const snapshot={player:2,session:'a',kind:'snapshot',rev:0,wire:1,instrument:'piano',volume:1,sustain:false,range:7,notes:[{id:1,pitch:60,velocity:90,held:true,age:0}]};
  assert(r.accept(snapshot));t=100;assert(r.accept({player:2,session:'a',kind:'delta',rev:1,wire:2,ops:[]}));assert.equal(r.states.get(2).notes.get(1).age,100);
  assert(!r.accept(snapshot));assert(!r.accept({player:2,session:'a',kind:'delta',rev:3,wire:3,ops:[]}));assert.equal(events.at(-1),'stop');
  assert(r.accept({...snapshot,rev:3,wire:4}));r.accept({player:2,session:'a',kind:'stop',wire:5});assert.equal(r.states.size,0);assert(r.accept({...snapshot,rev:3,wire:6}));
  t=4000;r.expire();assert.equal(r.states.size,0);
});
test('16-voice 8-performer simulation is isolated and cleans up',()=>{
  const r=new Replicas(()=>{},()=>{});let wire=0;
  for(let id=1;id<=8;id++)r.accept({kind:'snapshot',player:id,session:'s'+id,wire:++wire,rev:0,instrument:'piano',notes:[{id:1,pitch:60+id,velocity:90,held:true,age:0}]});
  r.accept({kind:'stop',player:1,session:'s1',wire:++wire});assert.equal(r.states.size,7);assert.equal(r.states.get(2).notes.get(1).pitch,62);r.clear();assert.equal(r.states.size,0);
});
test('Lua empty tables initialize silent peers before the first delta',()=>{
  const r=new Replicas(()=>{},()=>{});
  assert(r.accept({kind:'snapshot',player:2,session:'s',wire:1,rev:0,notes:{},volume:.5,sustain:false}));
  assert(r.accept({kind:'delta',player:2,session:'s',wire:2,rev:1,ops:[{kind:'on',id:1,pitch:60,velocity:90}]}));
  assert.equal(r.states.get(2).notes.size,1);
});
test('short taps in one network batch retain their on and off edges',()=>{
  const sizes=[],r=new Replicas((id,s)=>sizes.push(s.notes.size),()=>{});
  r.accept({kind:'snapshot',player:2,session:'s',wire:1,rev:0,notes:[],volume:1,sustain:false});
  r.accept({kind:'delta',player:2,session:'s',wire:2,rev:1,ops:[{kind:'on',id:1,pitch:38,velocity:100},{kind:'off',id:1}]});
  assert.deepEqual(sizes,[0,1,0]);
});
