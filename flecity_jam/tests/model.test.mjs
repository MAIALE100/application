import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {Performance,Replicas,DEFAULT_KEYS,LEGACY_KEYS,EXPANDED_KEYS,PIANO_KEYS,validBindings,recommendedExpandedOctave,recommendedPianoOctave,keyLabel,attenuation,selectSample} from '../web/model.mjs';
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
test('legacy 18-key bindings remain valid and expanded 36-key rows are distinct',()=>{
  assert.deepEqual(LEGACY_KEYS,['KeyA','KeyW','KeyS','KeyE','KeyD','KeyF','KeyT','KeyG','KeyY','KeyH','KeyU','KeyJ','KeyK','KeyO','KeyL','KeyP','Semicolon','Quote']);
  assert.deepEqual(DEFAULT_KEYS,LEGACY_KEYS);assert.equal(EXPANDED_KEYS.length,36);assert.equal(new Set(EXPANDED_KEYS).size,36);
  assert(validBindings(DEFAULT_KEYS,[],'legacy'));assert(validBindings(EXPANDED_KEYS,[],'expanded'));
  assert(!validBindings(DEFAULT_KEYS,[],'expanded'));assert(!validBindings(EXPANDED_KEYS,[],'legacy'));
  assert(!validBindings(EXPANDED_KEYS,['Digit1']));
  for(const code of ['KeyN','CapsLock','F8','F11','AltLeft','Space','ArrowUp','ArrowDown']){
    const proposal=[...EXPANDED_KEYS];proposal[0]=code;assert(!validBindings(proposal),code);
  }
  const custom=[...EXPANDED_KEYS];custom[0]='IntlYen';custom[1]='IntlRo';assert(validBindings(custom,[],'expanded'));
  assert.equal(keyLabel('Minus'),'-');assert.equal(keyLabel('Equal'),'=');assert.equal(keyLabel('IntlYen'),'¥');assert.equal(keyLabel('IntlRo'),'ろ');
});

test('piano layout separates consecutive white rows and their black keys without voice or JIS punctuation conflicts',()=>{
  assert.equal(PIANO_KEYS.length,25);assert.equal(new Set(PIANO_KEYS).size,25);
  const whites=PIANO_KEYS.filter((_,pitch)=>![1,3,6,8,10].includes(pitch%12));
  const blacks=PIANO_KEYS.filter((_,pitch)=>[1,3,6,8,10].includes(pitch%12));
  assert.deepEqual(whites,['KeyZ','KeyX','KeyC','KeyV','KeyB','KeyQ','KeyW','KeyE','KeyR','KeyT','KeyY','KeyU','KeyI','KeyO','KeyP']);
  assert.deepEqual(blacks,['KeyS','KeyD','KeyG','KeyH','Digit2','Digit4','Digit5','Digit7','Digit8','Digit9']);
  assert(validBindings(PIANO_KEYS,['KeyN','CapsLock'],'piano'));
  assert(PIANO_KEYS.every(code=>/^(Key[A-Z]|Digit[0-9])$/.test(code)));
  assert(!validBindings(PIANO_KEYS,[],'legacy'));assert(!validBindings(PIANO_KEYS,[],'expanded'));
  assert(!validBindings(EXPANDED_KEYS,[],'piano'));
  for(const code of ['KeyN','CapsLock','Space','ArrowUp','ArrowDown']){
    const custom=[...PIANO_KEYS];custom[0]=code;assert(!validBindings(custom,[],'piano'),code);
  }
  const custom=[...PIANO_KEYS];custom[0]='IntlYen';assert(validBindings(custom,[],'piano'));
});

test('piano keyboard opens in a playable two-octave range while retaining instrument limits',()=>{
  const expected={piano:[3,25],guitar:[3,25],bass:[1,16],clarinet:[4,25],drums:[2,8]};
  for(const instrument of catalog.instruments){
    const [octave,notes]=expected[instrument.id];assert.equal(recommendedPianoOctave(instrument),octave,instrument.id);
    if(instrument.kind==='drums')continue;
    const p=new Performance(instrument,()=>{});p.bindings=[...PIANO_KEYS];p.octave=octave;
    let played=0;
    for(const code of PIANO_KEYS){
      const pitch=p.pitch(code),valid=pitch>=instrument.min&&pitch<=instrument.max;
      assert.equal(p.press('key:'+code,pitch),valid,instrument.id+':'+code);
      if(valid){played++;p.release('key:'+code);}
    }
    assert.equal(played,notes,instrument.id);assert.equal(p.notes.size,0);
  }
});

test('piano low and high chords retain note IDs through an octave change and sustain release',()=>{
  const ops=[],p=new Performance(spec,op=>ops.push(op));p.bindings=[...PIANO_KEYS];p.octave=recommendedPianoOctave(spec);
  const chord=['KeyZ','KeyC','KeyB','KeyE','KeyT','KeyU','KeyP'];
  assert.deepEqual(chord.map(code=>p.pitch(code)),[48,52,55,60,64,67,72]);
  for(const code of chord)assert(p.press('key:'+code,p.pitch(code)));
  assert.equal(p.notes.size,7);p.pedal(true);p.shift(1);
  for(const code of chord)p.release('key:'+code);
  assert.equal(p.notes.size,7);p.pedal(false);assert.equal(p.notes.size,0);
  assert.deepEqual(ops.filter(op=>op.kind==='off').map(op=>op.id),ops.filter(op=>op.kind==='on').map(op=>op.id));
});
test('expanded octave maximizes each pitched instrument range while drums stay unchanged',()=>{
  const expected={piano:[3,36],guitar:[3,36],bass:[1,16],clarinet:[3,34],drums:[2,8]};
  for(const instrument of catalog.instruments){
    const [octave,notes]=expected[instrument.id];assert.equal(recommendedExpandedOctave(instrument),octave,instrument.id);
    if(instrument.kind==='drums')continue;
    const first=(octave+1)*12;
    const available=Array.from({length:EXPANDED_KEYS.length},(_,offset)=>first+offset)
      .filter(pitch=>pitch>=instrument.min&&pitch<=instrument.max).length;
    assert.equal(available,notes,instrument.id);
  }
});
test('expanded low middle and high keys can be held together and release across shifts',()=>{
  const operations=[],p=new Performance(spec,operation=>operations.push(operation));
  p.bindings=[...EXPANDED_KEYS];p.octave=recommendedExpandedOctave(spec);
  assert.equal(p.pitch('KeyA'),48);assert.equal(p.pitch('KeyQ'),60);
  assert.equal(p.pitch('Digit1'),72);assert.equal(p.pitch('Equal'),83);
  for(const code of ['KeyA','KeyQ','Digit1','Equal'])assert(p.press('key:'+code,p.pitch(code)));
  assert.equal(p.notes.size,4);p.shift(1);
  for(const code of ['KeyA','KeyQ','Digit1','Equal'])p.release('key:'+code);
  assert.equal(p.notes.size,0);
  assert.deepEqual(operations.filter(op=>op.kind==='on').map(op=>op.pitch),[48,60,72,83]);
  assert.equal(operations.filter(op=>op.kind==='off').length,4);
});
test('expanded keyboard still obeys the 16-note polyphony limit',()=>{
  const operations=[],p=new Performance(spec,operation=>operations.push(operation));
  p.bindings=[...EXPANDED_KEYS];p.octave=recommendedExpandedOctave(spec);
  for(const code of EXPANDED_KEYS.slice(0,20))assert(p.press('key:'+code,p.pitch(code)));
  assert.equal(p.notes.size,16);assert.equal(p.keys.size,16);
  assert.equal(operations.filter(op=>op.kind==='kill').length,4);
  for(const code of EXPANDED_KEYS.slice(0,20))p.release('key:'+code);
  assert.equal(p.notes.size,0);assert.equal(p.keys.size,0);
  const drums=catalog.instruments.find(instrument=>instrument.id==='drums');
  const drum=new Performance(drums,()=>{});drum.bindings=[...EXPANDED_KEYS];
  assert.equal(drum.pitch('KeyA'),36);assert.equal(drum.pitch('KeyS'),38);assert.equal(drum.pitch('Digit1'),undefined);
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
