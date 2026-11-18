export const LEGACY_KEYS = ['KeyA','KeyW','KeyS','KeyE','KeyD','KeyF','KeyT','KeyG','KeyY','KeyH','KeyU','KeyJ','KeyK','KeyO','KeyL','KeyP','Semicolon','Quote'];
export const DEFAULT_KEYS = LEGACY_KEYS;
// White keys use two uninterrupted physical rows; black keys sit above them.
// The lower row stops at G so N remains available as a reserved voice key.
export const PIANO_KEYS = [
  'KeyZ','KeyS','KeyX','KeyD','KeyC','KeyV','KeyG','KeyB','KeyH',
  'KeyQ','Digit2','KeyW','KeyE','Digit4','KeyR','Digit5','KeyT',
  'KeyY','Digit7','KeyU','Digit8','KeyI','Digit9','KeyO','KeyP'
];
// Three physical rows, each covering a chromatic octave from left to right.
export const EXPANDED_KEYS = [
  'KeyA','KeyS','KeyD','KeyF','KeyG','KeyH','KeyJ','KeyK','KeyL','Semicolon','Quote','Backslash',
  'KeyQ','KeyW','KeyE','KeyR','KeyT','KeyY','KeyU','KeyI','KeyO','KeyP','BracketLeft','BracketRight',
  'Digit1','Digit2','Digit3','Digit4','Digit5','Digit6','Digit7','Digit8','Digit9','Digit0','Minus','Equal'
];
export const DRUM_KEYS = ['KeyA','KeyS','KeyD','KeyF','KeyG','KeyH','KeyJ','KeyK'];
export const DRUM_PITCHES = [36,38,42,46,45,50,49,51];
export const RESERVED = new Set(['Escape','Tab','Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','KeyN','CapsLock','AltLeft','AltRight','ControlLeft','ControlRight','MetaLeft','MetaRight','F8','F11']);
export const noteName = n => ['C','C♯','D','D♯','E','F','F♯','G','G♯','A','A♯','B'][n%12]+(Math.floor(n/12)-1);
export const keyLabel = code => ({Semicolon:';',Quote:":/'",Comma:',',Period:'.',Slash:'/',BracketLeft:'[',BracketRight:']',Backslash:'\\',Minus:'-',Equal:'=',IntlYen:'¥',IntlRo:'ろ'}[code] || code.replace(/^(Key|Digit)/,''));
export function validBindings(keys, reserved=[], mode) {
  const lengths=(mode==='legacy'||mode==='home18')?[LEGACY_KEYS.length]:mode==='expanded'?[EXPANDED_KEYS.length]:mode==='piano'?[PIANO_KEYS.length]:mode===undefined?[LEGACY_KEYS.length,EXPANDED_KEYS.length,PIANO_KEYS.length]:[];
  return Array.isArray(keys) && lengths.includes(keys.length) && new Set(keys).size===keys.length &&
    keys.every(k=>typeof k==='string' && /^(Key[A-Z]|Digit[0-9]|Semicolon|Quote|Comma|Period|Slash|BracketLeft|BracketRight|Backslash|Minus|Equal|IntlYen|IntlRo)$/.test(k) && !RESERVED.has(k) && !reserved.includes(k));
}
export function recommendedExpandedOctave(spec) {
  return recommendedOctave(spec,EXPANDED_KEYS.length);
}
export function recommendedPianoOctave(spec) {
  return recommendedOctave(spec,PIANO_KEYS.length,spec.kind==='drums'?spec.octave:spec.octave-1);
}
export function recommendedHomeOctave(spec) {
  return recommendedOctave(spec,DEFAULT_KEYS.length,spec.kind==='drums'?spec.octave:spec.octave-1);
}
function recommendedOctave(spec,keyCount,preferredOctave=spec.octave) {
  const preferred=Math.max(0,Math.min(7,Number.isInteger(preferredOctave)?preferredOctave:4));
  if(spec.kind==='drums')return preferred;
  let best=preferred, overlap=-1;
  for(let octave=0;octave<=7;octave++) {
    const first=(octave+1)*12, last=first+keyCount-1;
    const count=Math.max(0,Math.min(spec.max,last)-Math.max(spec.min,first)+1);
    if(count>overlap || (count===overlap && Math.abs(octave-preferred)<Math.abs(best-preferred))) {
      best=octave;overlap=count;
    }
  }
  return best;
}
export function attenuation(distance, range) {
  if (!Number.isFinite(distance) || !Number.isFinite(range) || range<=0 || distance>=range) return 0;
  const t = Math.max(0,distance-1)/Math.max(1,range-1);
  return (1-t)**2;
}
export function selectSample(spec,pitch,velocity) {
  if (spec.kind==='drums') return spec.samples.find(s=>s.midi===pitch);
  const layer = spec.samples.some(s=>s.layer===2) && velocity<75 ? 2 : 4;
  return spec.samples.filter(s=>s.layer===layer).reduce((a,b)=>!a||Math.abs(b.midi-pitch)<Math.abs(a.midi-pitch)?b:a,null);
}

export class Performance {
  constructor(spec, emit, change=()=>{}, now=()=>performance.now()) {
    this.spec=spec; this.emit=emit; this.change=change; this.now=now;
    this.notes=new Map(); this.keys=new Map(); this.nextId=0; this.sustain=false; this.volume=.75;
    this.octave=spec.octave; this.bindings=[...DEFAULT_KEYS]; this.limit=16;
  }
  pitch(code) {
    if (this.spec.kind==='drums') return DRUM_PITCHES[DRUM_KEYS.indexOf(code)];
    const offset=this.bindings.indexOf(code);
    return offset<0 ? undefined : (this.octave+1)*12+offset;
  }
  press(key,pitch,velocity=100) {
    if (this.keys.has(key) || !Number.isInteger(pitch) || pitch<this.spec.min || pitch>this.spec.max || !selectSample(this.spec,pitch,velocity)) return false;
    if (this.notes.size>=this.limit) {
      const victim=[...this.notes.values()].find(n=>!n.held) || this.notes.values().next().value;
      this.notes.delete(victim.id);
      for(const [k,id]of this.keys) if(id===victim.id)this.keys.delete(k);
      this.emit({kind:'kill',id:victim.id});
    }
    const n={id:++this.nextId,pitch,velocity:Math.max(1,Math.min(127,Math.round(velocity))),held:true,at:this.now()};
    this.keys.set(key,n.id); this.notes.set(n.id,n);
    this.emit({kind:'on',id:n.id,pitch:n.pitch,velocity:n.velocity}); this.change(); return true;
  }
  release(key) {
    const id=this.keys.get(key); this.keys.delete(key);
    const n=this.notes.get(id); if(!n)return;
    n.held=false; if(!this.sustain || this.spec.kind==='drums')this.notes.delete(id);
    this.emit({kind:'off',id}); this.change();
  }
  pedal(down) {
    down=Boolean(down) && this.spec.kind!=='drums'; if(this.sustain===down)return;
    this.sustain=down;
    if(!down)for(const [id,n]of this.notes)if(!n.held)this.notes.delete(id);
    this.emit({kind:'pedal',down}); this.change();
  }
  setVolume(value) { this.volume=Math.max(0,Math.min(1,value)); this.emit({kind:'volume',value:this.volume}); this.change(); }
  panic() {this.keys.clear();this.notes.clear();this.sustain=false;this.emit({kind:'panic'});this.change();}
  shift(amount) { this.octave=Math.max(0,Math.min(7,this.octave+amount)); this.change(); }
  snapshot() { return {notes:[...this.notes.values()].map(({at,...n})=>({...n,age:Math.max(0,this.now()-at)})),sustain:this.sustain,volume:this.volume}; }
}

const remoteInteger = (n,min=0,max=Number.MAX_SAFE_INTEGER) => Number.isSafeInteger(n) && n>=min && n<=max;
const remoteNumber = (n,min,max=Infinity) => Number.isFinite(n) && n>=min && n<=max;
const remoteObject = value => value!==null && typeof value==='object' && !Array.isArray(value);
const remoteNote = n => remoteObject(n) && remoteInteger(n.id,1,2147483647) && remoteInteger(n.pitch,0,127) && remoteInteger(n.velocity,1,127);
function snapshotNotes(notes) {
  if(Array.isArray(notes))return notes;
  // Lua serializes an empty notes table as {}, not necessarily [].
  return remoteObject(notes) && Object.keys(notes).length===0 ? [] : null;
}
function validRemotePacket(p) {
  if(!remoteObject(p) || !remoteInteger(p.player,1) || typeof p.session!=='string' || !p.session || !remoteInteger(p.wire,1))return false;
  if(p.kind==='stop')return p.rev===undefined || remoteInteger(p.rev);
  if(!remoteInteger(p.rev))return false;
  if(p.kind==='snapshot') {
    const notes=snapshotNotes(p.notes),ids=new Set();
    if(!notes || typeof p.instrument!=='string' || !p.instrument || !remoteNumber(p.volume,0,1) || typeof p.sustain!=='boolean' || !Number.isFinite(p.range) || p.range<=0)return false;
    for(const n of notes) {
      if(!remoteNote(n) || typeof n.held!=='boolean' || !remoteNumber(n.age,0) || ids.has(n.id))return false;
      ids.add(n.id);
    }
    return true;
  }
  if(p.kind!=='delta' || !Array.isArray(p.ops))return false;
  for(const op of p.ops) {
    if(!remoteObject(op))return false;
    if(op.kind==='on') {if(!remoteNote(op))return false;}
    else if(op.kind==='off' || op.kind==='kill') {if(!remoteInteger(op.id,1,2147483647))return false;}
    else if(op.kind==='pedal') {if(typeof op.down!=='boolean')return false;}
    else if(op.kind==='volume') {if(!remoteNumber(op.value,0,1))return false;}
    else if(op.kind!=='panic')return false;
  }
  return true;
}

export class Replicas {
  constructor(update,remove,now=()=>performance.now()) { this.states=new Map();this.wires=new Map();this.update=update;this.remove=remove;this.now=now; }
  accept(p) {
    // Validate the whole packet before advancing replay protection or changing notes.
    if(!validRemotePacket(p))return false;
    if(p.wire<=(this.wires.get(p.player)??-1))return false;
    this.wires.set(p.player,p.wire);
    let s=this.states.get(p.player);
    if(p.kind==='stop') { if(s?.session===p.session){this.states.delete(p.player);this.remove(p.player);} return true; }
    if(p.kind==='snapshot') {
      const notes=snapshotNotes(p.notes);
      if(s && s.session!==p.session)this.remove(p.player);
      s={...p,notes:new Map(notes.map(n=>[n.id,{...n}])),seen:this.now(),desynced:false}; this.states.set(p.player,s);
    } else if(p.kind==='delta') {
      if(!s || s.session!==p.session || s.desynced)return false;
      if(p.rev!==s.rev+1){s.desynced=true;this.remove(p.player);return false;}
      // Age survives intervening deltas; snapshot ages are measured at receipt.
      const elapsed=this.now()-s.seen;
      for(const n of s.notes.values())n.age+=elapsed;
      s.seen=this.now();
      for(const op of p.ops) {
        if(op.kind==='on')s.notes.set(op.id,{id:op.id,pitch:op.pitch,velocity:op.velocity,held:true,age:0});
        else if(op.kind==='off') {const n=s.notes.get(op.id);if(n){n.held=false;if(!s.sustain)s.notes.delete(op.id);}}
        else if(op.kind==='kill')s.notes.delete(op.id);
        else if(op.kind==='panic'){s.notes.clear();s.sustain=false;}
        else if(op.kind==='pedal'){s.sustain=op.down;if(!op.down)for(const[id,n]of s.notes)if(!n.held)s.notes.delete(id);}
        else if(op.kind==='volume')s.volume=op.value;
        // Preserve an on/off pair within one transport batch, especially a drum tap.
        this.update(p.player,s);
      }
      s.rev=p.rev;return true;
    } else return false;
    this.update(p.player,s);return true;
  }
  expire() {for(const[id,s]of this.states)if(this.now()-s.seen>3500){this.states.delete(id);this.remove(id);}}
  clear() {const ids=[...this.states.keys()];this.states.clear();this.wires.clear();for(const id of ids)this.remove(id);}
}
