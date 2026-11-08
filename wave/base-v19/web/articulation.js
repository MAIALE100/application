// WAVE per-note articulation: shared by Studio and resource-owned Library player.
// "legato" ties contiguous or overlapping notes of identical pitch into one voice.
// "tongue" restarts each note and leaves a small breath; missing values are legacy.
(()=>{'use strict';
const percussion=new Set(['drums','acoustic_drums','cymbals','timpani']);
function mode(note){return note?.articulation==='legato'?'legato':note?.articulation==='tongue'?'tongue':'legacy';}
function compile(track,maxSteps){
  const all=[];const cap=Number.isFinite(maxSteps)?Math.max(1,Math.floor(maxSteps)):2048;
  (track?.notes||[]).forEach((n,order)=>{
    const start=Number(n?.step),pitch=Number(n?.pitch);
    if(!Number.isFinite(start)||!Number.isFinite(pitch)||start<0||start>=cap)return;
    const length=Math.max(1,Math.min(16,Number(n?.length)||1));
    const a=mode(n),end=a==='legacy'?start+length:Math.min(cap,start+length);
    all.push({start,end,pitch,velocity:Number(n?.velocity??.85),articulation:a,order});
  });
  const groups=new Map();
  for(const note of all){const list=groups.get(note.pitch)||[];list.push(note);groups.set(note.pitch,list);}
  const events=[];
  for(const group of groups.values()){
    group.sort((a,b)=>a.start-b.start||a.order-b.order);
    let previous=null;
    for(const note of group){
      // A continuously entered phrase never re-attacks its own pitch.
      if(!percussion.has(track?.instrument)&&previous?.articulation==='legato'&&note.articulation==='legato'&&note.start<=previous.end){
        previous.end=Math.max(previous.end,note.end);continue;
      }
      // Explicitly articulated notes take precedence over overlapping earlier
      // explicit notes. Never touch legacy notes from existing songs.
      if(previous&&previous.articulation!=='legacy'&&note.articulation!=='legacy'&&previous.end>note.start){
        previous.end=Math.max(previous.start+.05,note.start);
      }
      const fresh={...note};events.push(fresh);previous=fresh;
    }
  }
  return events.sort((a,b)=>a.start-b.start||a.order-b.order).map(n=>({
    step:n.start,pitch:n.pitch,velocity:n.velocity,articulation:n.articulation,
    // Tonguing creates separation between notes. Legacy tracks retain their duration.
    length:Math.max(.05,(n.end-n.start)*(n.articulation==='tongue'?.82:1))
  }));
}
// Link only monophonic, contiguous legato notes. Chords and percussion remain
// independent voices, and tongue/legacy never join a new phrase.
const sustained=new Set(['clarinet','trombone','flute','violin','cello','trumpet',
 'french_horn','tuba','oboe','bassoon','tenor_sax','piccolo','contrabass',
 'sine','square','triangle','saw','pad','strings']);
function compilePhrases(track,maxSteps){
 const notes=compile(track,maxSteps);
 if(!sustained.has(track?.instrument)||notes.length<2)return notes;
 const occupancy=new Map(),atStart=new Map();
 for(const n of notes){
  const s=Number(n.step),e=s+Number(n.length);
  atStart.set(s,(atStart.get(s)||0)+1);
  for(let k=Math.floor(s);k<e;k++)occupancy.set(k,(occupancy.get(k)||0)+1);
 }
 const used=new Set(),result=[];
 const starts=new Map();
 notes.forEach((n,i)=>{const group=starts.get(n.step)||[];group.push(i);starts.set(n.step,group);});
 for(let i=0;i<notes.length;i++){
  if(used.has(i))continue;
  const first=notes[i];used.add(i);
  const joined=[first];let last=first;
  while(last.articulation==='legato'){
   const end=last.step+last.length;
   // Exact shared boundary; do not turn an intentional rest into legato.
   const candidates=(starts.get(end)||[]).filter(j=>!used.has(j)&&notes[j].articulation==='legato');
   if(candidates.length!==1||atStart.get(last.step)!==1||atStart.get(end)!==1)break;
   const next=notes[candidates[0]];
   if((occupancy.get(Math.floor(end-0.0001))||0)!==1||(occupancy.get(Math.floor(end))||0)!==1)break;
   used.add(candidates[0]);joined.push(next);last=next;
  }
  if(joined.length>1){
   result.push({...first,length:last.step+last.length-first.step,segments:joined.map(n=>({step:n.step,pitch:n.pitch,length:n.length,velocity:n.velocity}))});
  }else result.push(first);
 }
 return result.sort((a,b)=>a.step-b.step||a.pitch-b.pitch);
}
function scheduleSynthPhrase(context,instrument,segments,time,volume,pan,register,destination){
 if(!Array.isArray(segments)||segments.length<2)return false;
 const names={flute:'sine',clarinet:'triangle',oboe:'triangle',bassoon:'triangle',tenor_sax:'triangle',piccolo:'sine',
  trumpet:'saw',trombone:'saw',french_horn:'saw',tuba:'saw',violin:'strings',cello:'strings'};
 const kind=names[instrument]||instrument;
 const type=['saw','strings'].includes(kind)?'sawtooth':kind==='square'?'square':kind==='triangle'?'triangle':'sine';
 const start=Math.max(context.currentTime+.002,Number(time)||context.currentTime);
 const total=Math.max(.05,...segments.map(s=>Number(s.offset)+Number(s.duration)));
 const source=context.createOscillator(),gain=context.createGain();
 const panner=context.createStereoPanner?.()||null;
 source.type=type;
 const freq=midi=>440*Math.pow(2,(Number(midi)-69)/12);
 const first=segments[0];source.frequency.setValueAtTime(freq(first.pitch),start);
 for(let i=1;i<segments.length;i++){
  const prev=segments[i-1],s=segments[i],at=start+Number(s.offset);
  const slide=Math.min(.038,Math.max(.005,Number(prev.duration)*.3),Math.max(.005,Number(s.duration)*.3));
  source.frequency.setValueAtTime(freq(prev.pitch),at-slide/2);
  source.frequency.exponentialRampToValueAtTime(freq(s.pitch),at+slide/2);
 }
 const level=Math.max(.0001,Math.min(.6,Number(volume)*.22));
 gain.gain.setValueAtTime(.0001,start);
 gain.gain.linearRampToValueAtTime(level,start+.018);
 gain.gain.setValueAtTime(level,Math.max(start+.018,start+total-.09));
 gain.gain.exponentialRampToValueAtTime(.0001,start+total+.065);
 source.connect(gain);
 if(panner){gain.connect(panner);panner.pan.value=Math.max(-1,Math.min(1,Number(pan)||0));panner.connect(destination);}
 else gain.connect(destination);
 source.start(start);source.stop(start+total+.075);register(source);return true;
}
const API=Object.freeze({compile,compilePhrases,mode,scheduleSynthPhrase});
globalThis.WaveArticulation=API;
if(typeof module!=='undefined'&&module.exports)module.exports=API;
})();
