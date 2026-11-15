export const DEFAULT_KEYS = ['KeyA','KeyW','KeyS','KeyE','KeyD','KeyF','KeyT','KeyG','KeyY','KeyH','KeyU','KeyJ','KeyK','KeyO','KeyL','KeyP','Semicolon','Quote'];
export const DRUM_KEYS = ['KeyA','KeyS','KeyD','KeyF','KeyG','KeyH','KeyJ','KeyK'];
export const DRUM_PITCHES = [36,38,42,46,45,50,49,51];
export const RESERVED = new Set(['Escape','Tab','Space','KeyZ','KeyX','KeyN','CapsLock','AltLeft','AltRight','ControlLeft','ControlRight','MetaLeft','MetaRight','F8','F11']);
export const noteName = n => ['C','C♯','D','D♯','E','F','F♯','G','G♯','A','A♯','B'][n%12]+(Math.floor(n/12)-1);
export const keyLabel = code => ({Semicolon:';',Quote:"'",Comma:',',Period:'.',Slash:'/',BracketLeft:'[',BracketRight:']',Backslash:'\\'}[code] || code.replace(/^(Key|Digit)/,''));
export function validBindings(keys, reserved=[]) {
  return Array.isArray(keys) && keys.length===DEFAULT_KEYS.length && new Set(keys).size===keys.length &&
    keys.every(k=>typeof k==='string' && /^(Key[A-Z]|Digit[0-9]|Semicolon|Quote|Comma|Period|Slash|BracketLeft|BracketRight|Backslash)$/.test(k) && !RESERVED.has(k) && !reserved.includes(k));
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

export class Replicas {
  constructor(update,remove,now=()=>performance.now()) { this.states=new Map();this.wires=new Map();this.update=update;this.remove=remove;this.now=now; }
  accept(p) {
    if(!p || !Number.isInteger(p.player) || typeof p.session!=='string' || !Number.isInteger(p.wire))return false;
    if(p.wire<=(this.wires.get(p.player)??-1))return false;
    this.wires.set(p.player,p.wire);
    let s=this.states.get(p.player);
    if(p.kind==='stop') { if(s?.session===p.session){this.states.delete(p.player);this.remove(p.player);} return true; }
    if(p.kind==='snapshot') {
      const notes=Array.isArray(p.notes)?p.notes:p.notes&&Object.keys(p.notes).length===0?[]:null;
      if(!notes)return false;
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
  clear() {for(const id of this.states.keys())this.remove(id);this.states.clear();this.wires.clear();}
}
