// On-demand recorded instruments shared by Studio and the persistent resource NUI.
(()=>{'use strict';
const base=new URL('.',document.currentScript.src);
const supported=new Set(['grand_piano','acoustic_guitar','electric_bass','acoustic_drums','violin','cello','flute','trumpet','clarinet','trombone','french_horn','tuba','oboe','bassoon','tenor_sax','marimba','piccolo','xylophone','glockenspiel','contrabass','harp','vibraphone','timpani','cymbals','electric_guitar']);
const banks=new Map(),loaders=new Map(),cache=new Map(),active=[];
const maxBuffers=64,maxVoices=40,maxDecodedBytes=96*1024*1024;
// Measured median RMS is in SAMPLE_LEVELS_BEFORE.json. Keep the recorded
// files and saved note velocities untouched; compensate only at playback.
const instrumentGain=Object.freeze({grand_piano:1,acoustic_guitar:.65,electric_bass:.55,
 acoustic_drums:1,violin:3,cello:2,flute:1,trumpet:1,electric_guitar:.55});
const outputs=new WeakMap();
// Recorded breath on each discrete woodwind attack can overpower short notes.
const breathSensitive=new Set(['clarinet','oboe','bassoon','tenor_sax','flute','piccolo','trumpet','trombone','french_horn','tuba']);
// WAVE audio engine v6. Wind-bank recordings were supplied at radically
// different mastering levels (clarinet ~0.53 steady RMS; tenor sax ~0.024).
// Calibrate a decoded recording to a common, conservative sustained RMS,
// with a peak ceiling. Calculated once per AudioBuffer; no source assets,
// velocities, note data, mixer state or project JSON are modified.
const balancedWinds=new Set(['clarinet','trombone','french_horn','tuba','oboe','bassoon','tenor_sax','piccolo']);
const balanceCache=new WeakMap();
function balanceFor(audio,instrument){
 if(!audio||!balancedWinds.has(instrument))return 1;
 const previous=balanceCache.get(audio);if(previous!==undefined)return previous;
 // IMPORTANT: many CC0 wind recordings are stereo and wildly different
 // between left/right. Using just channel 0 produced 3x volume changes
 // at sax bank boundaries. Measure BOTH channels in the sustained section.
 const rate=Math.max(8000,Number(audio.sampleRate)||44100);
 const start=Math.floor(Math.min(Math.max(.6,sustainStats(audio,instrument).onset+.1),2)*rate);
 const stop=Math.min(audio.length,start+Math.floor(rate*2.25));
 const stride=Math.max(1,Math.floor(Math.max(1,stop-start)/16000));
 let sum=0,count=0,peak=0;
 for(let channel=0;channel<Math.min(2,Number(audio.numberOfChannels)||1);channel++){
  const data=audio.getChannelData(channel);
  for(let i=start;i<stop;i+=stride){const v=data[i];sum+=v*v;count++;}
  const peakStride=Math.max(1,Math.floor(data.length/25000));
  for(let i=0;i<data.length;i+=peakStride)peak=Math.max(peak,Math.abs(data[i]));
 }
 const rms=Math.sqrt(sum/Math.max(1,count));
 // Aim for ~0.13 RMS, but never multiply a file with a large recorded
 // transient beyond ~0.7 peak. Cap gain to prevent pathological quiet files.
 const gain=Math.max(.18,Math.min(7.5,.13/Math.max(.0001,rms),.67/Math.max(.0001,peak)));
 balanceCache.set(audio,gain);return gain;
}


// Sustain-only onset analysis. Recorded samples include their own attack / air
// envelope, which should NOT play a second time when a legato line changes pitch.
// A small number of coarse RMS readings are cached per decoded audio buffer.
const sustainStatsCache=new WeakMap();
function sustainStats(audio,instrument){
 const saved=sustainStatsCache.get(audio);if(saved)return saved;
 const duration=Number(audio?.duration)||0,rate=Number(audio?.sampleRate)||0;
 let info={onset:0,rms:.2};
 if(!rate||duration<.32||typeof audio.getChannelData!=='function'){sustainStatsCache.set(audio,info);return info;}
 // Stereo wind banks can have a much quieter left channel. An attack
 // detector using left only can pick a release/transition as an onset.
 const channelCount=Math.min(2,audio.numberOfChannels||1);
 const data=Array.from({length:channelCount},(_,channel)=>audio.getChannelData(channel));
 const hop=Math.max(128,Math.round(rate*.025)),windowSize=Math.max(192,Math.round(rate*.05));
 const rms=[];
 for(let at=0;at+windowSize<=audio.length;at+=hop){
  let sum=0,count=0;
  for(const samples of data)for(let i=at;i<at+windowSize;i+=8){
   const value=samples[i];sum+=value*value;count++;
  }
  rms.push(Math.sqrt(sum/Math.max(1,count)));
 }
 if(rms.length<9){sustainStatsCache.set(audio,info);return info;}
 const left=Math.floor(rms.length*.22),right=Math.max(left+1,Math.floor(rms.length*.68));
 const sorted=rms.slice(left,right).sort((a,b)=>a-b);
 const ref=Math.max(.00001,sorted[Math.floor(sorted.length*.5)]);
 // Winds begin at a stable sustain plateau; bowed strings have a shorter
 // minimum skip to retain the bow sound without re-triggering on every note.
 const minSeconds=Math.min(duration*.25,breathSensitive.has(instrument)?.52:.28);
 const minIndex=Math.ceil(minSeconds*rate/hop);
 const maxIndex=Math.min(rms.length-6,Math.floor(Math.min(duration*.44,3.2)*rate/hop));
 const threshold=ref*.90;
 let candidate=minIndex;
 for(let i=minIndex;i<maxIndex;i++){
  if(rms[i]>=threshold&&rms[i+1]>=threshold&&rms[i+2]>=threshold&&rms[i+3]>=threshold){candidate=i;break;}
 }
 info={onset:Math.min(duration*.45,candidate*hop/rate),rms:ref};
 sustainStatsCache.set(audio,info);return info;
}
function instrumentReferenceRms(instrument){
 const prefix=instrument+'/',values=[];
 for(const [key,entry] of cache){if(key.startsWith(prefix)&&entry.buffer)values.push(sustainStats(entry.buffer,instrument).rms);}
 if(!values.length)return null;
 values.sort((a,b)=>a-b);
 return values[Math.floor(values.length/2)];
}
// Equal-power rather than exponential fade curves avoid a volume hole at the
// pitch/sample boundary. Apply short curves to active GainNodes only.
const fadeSteps=24;
function crossfade(gain,from,to,at,duration,fadeIn){
 const length=Math.max(.008,duration);
 if(typeof gain.setValueCurveAtTime==='function'){
  const curve=new Float32Array(fadeSteps+1);
  for(let i=0;i<=fadeSteps;i++){
   const fraction=i/fadeSteps;
   curve[i]=Math.max(.0001,fadeIn?Math.sin(fraction*Math.PI/2)*to:Math.cos(fraction*Math.PI/2)*from);
  }
  gain.setValueCurveAtTime(curve,at,length);
 }else{
  gain.setValueAtTime(fadeIn?.0001:from,at);
  gain.linearRampToValueAtTime(fadeIn?to:.0001,at+length);
 }
}

function output(context){
 let bus=outputs.get(context);if(bus)return bus;
 bus=context.createGain();bus.gain.value=1;
 if(context.createDynamicsCompressor){
  const limiter=context.createDynamicsCompressor();
  limiter.threshold.value=-9;limiter.knee.value=6;limiter.ratio.value=12;
  limiter.attack.value=.003;limiter.release.value=.18;
  bus.connect(limiter);
  if(context.createWaveShaper){
   const ceiling=context.createWaveShaper(),curve=new Float32Array(2049);
   for(let index=0;index<curve.length;index++){
    const x=index/(curve.length-1)*2-1,absolute=Math.abs(x);
    curve[index]=absolute<=.8?x:Math.sign(x)*(.8+.18*(1-Math.exp(-(absolute-.8)/.18)));
   }
   ceiling.curve=curve;limiter.connect(ceiling);ceiling.connect(context.destination);
  }else{const safety=context.createGain();safety.gain.value=.8;limiter.connect(safety);safety.connect(context.destination);}
 }else bus.connect(context.destination);
 outputs.set(context,bus);return bus;
}
function setMaster(context,value){
 const numeric=Number(value);
 const level=Math.max(0,Math.min(1,Number.isFinite(numeric)?numeric:1));
 const gain=output(context).gain;
 if(gain.setTargetAtTime)gain.setTargetAtTime(level,context.currentTime,.015);
 else gain.value=level;
}
const folder=instrument=>instrument==='grand_piano'?'grand-piano':instrument;
function decodedBytes(){let size=0;for(const entry of cache.values())if(entry.buffer)size+=entry.buffer.length*entry.buffer.numberOfChannels*4;return size;}
function bank(instrument){
 if(!supported.has(instrument))return Promise.resolve(null);
 if(!loaders.has(instrument)){
  const request=fetch(new URL(`samples/${folder(instrument)}/map.json`,base))
   .then(response=>{if(!response.ok)throw Error('SAMPLE_MAP_UNAVAILABLE');return response.json();})
   .then(value=>{if(value.instrument!==instrument||!Array.isArray(value.samples)||!value.samples.length)throw Error('SAMPLE_MAP_INVALID');banks.set(instrument,value);return value;})
   .catch(error=>{loaders.delete(instrument);console.warn('[WAVE] instrument map fallback',instrument,error);return null;});
  loaders.set(instrument,request);
 }
 return loaders.get(instrument);
}
function nearest(instrument,pitch,velocity=.7){
 const mapping=banks.get(instrument),midi=Number(pitch);
 if(!mapping||!Number.isFinite(midi))return null;
 if(mapping.mode==='kit')return mapping.samples.find(item=>item.midi===midi)||null;
 const target=midi+(Number(mapping.pitchOffset)||0);
 const layer=Number(velocity)<.55?2:4;
 const preferred=mapping.samples.filter(item=>item.layer===layer);
 const samples=preferred.length?preferred:mapping.samples;
 return samples.reduce((best,item)=>!best||Math.abs(item.midi-target)<Math.abs(best.midi-target)?item:best,null);
}
function buffer(context,instrument,item){
 const key=instrument+'/'+item.file;
 if(cache.has(key)){const entry=cache.get(key);cache.delete(key);cache.set(key,entry);return entry;}
 const entry={buffer:null,promise:null};
 entry.promise=fetch(new URL(`samples/${folder(instrument)}/${encodeURIComponent(item.file)}`,base))
  .then(response=>{if(!response.ok)throw Error('SAMPLE_NOT_FOUND');return response.arrayBuffer();})
  .then(bytes=>context.decodeAudioData(bytes))
  .then(decoded=>{
   entry.buffer=decoded;
   while((cache.size>maxBuffers||decodedBytes()>maxDecodedBytes)&&cache.size>1){
    const oldest=cache.keys().next().value;
    if(oldest===key){cache.delete(key);cache.set(key,entry);continue;}
    cache.delete(oldest);
   }
   return decoded;
  })
  .catch(error=>{cache.delete(key);console.warn('[WAVE] instrument sample fallback',key,error);return null;});
 cache.set(key,entry);return entry;
}
// Loop explicit legato samples only if the recorded file would otherwise end.
// Prefer zero crossings with similar slopes instead of looping from the attack.
const waveLoopCache=new WeakMap();
function waveLoopPoints(buffer){
 if(waveLoopCache.has(buffer))return waveLoopCache.get(buffer);
 const length=buffer.length,rate=buffer.sampleRate;
 if(length<rate*.35){waveLoopCache.set(buffer,null);return null;}
 const data=buffer.getChannelData(0);
 const candidates=(lo,hi)=>{
  const found=[];let stride=0;
  for(let i=Math.max(2,Math.floor(length*lo));i<Math.min(length-2,Math.floor(length*hi));i++){
   if(data[i-1]<=0&&data[i]>0&&++stride%5===0)found.push({i,slope:data[i]-data[i-1]});
   if(found.length>=240)break;
  }
  return found;
 };
 const starts=candidates(.22,.42),ends=candidates(.64,.87);
 let best=null,bestScore=Infinity;
 for(const a of starts)for(const b of ends){
  const score=Math.abs(a.slope-b.slope)+Math.abs(data[a.i]-data[b.i])*.8;
  if(score<bestScore){bestScore=score;best=[a.i/rate,b.i/rate];}
 }
 waveLoopCache.set(buffer,best);return best;
}
async function preloadProject(context,project){
 const used=new Map();
 for(const track of project?.tracks||[]){
  if(!supported.has(track?.instrument))continue;
  const notes=used.get(track.instrument)||[];
  for(const note of track.notes||[])notes.push([Number(note.pitch),Number(note.velocity??.85)*Number(track.volume??.75)]);
  used.set(track.instrument,notes);
 }
 if(!used.size)return {requested:0,loaded:0};
 await Promise.all([...used.keys()].map(bank));
 const samples=new Map();
 for(const [instrument,notes] of used)for(const [pitch,velocity] of notes){
  const item=nearest(instrument,pitch,velocity);if(item)samples.set(instrument+'/'+item.file,[instrument,item]);
 }
 const loaded=await Promise.all([...samples.values()].map(([instrument,item])=>buffer(context,instrument,item).promise));
 return {requested:samples.size,loaded:loaded.filter(Boolean).length,fallback:loaded.some(value=>!value)||[...used.keys()].some(inst=>!banks.has(inst))};
}
function schedule(context,instrument,pitch,time,duration,volume=.7,pan=0,register=()=>{},destination=output(context),articulation='legacy'){
 if(!supported.has(instrument))return false;
 if(Number(volume)<=0)return true;
 const item=nearest(instrument,pitch,volume),audio=item&&cache.get(instrument+'/'+item.file)?.buffer;
 if(!audio)return false;
 const mapping=banks.get(instrument);
 if(articulation==='legato'&&breathSensitive.has(instrument)&&
   scheduleContinuousWind(context,instrument,[{offset:0,duration:Number(duration)||.2,pitch:Number(pitch),velocity:.85}],time,volume,pan,register,destination))return true;
 const target=Number(pitch)+(Number(mapping.pitchOffset)||0);
 const rate=mapping.mode==='kit'?1:Math.pow(2,(target-item.midi+(Number(item.tune)||0)/100)/12);
 const start=Math.max(context.currentTime+.001,Number(time)||context.currentTime);
 const hold=Math.max(.05,Number(duration)||.2);
 const release=mapping.mode==='kit' ? .08 : articulation==='tongue' ? .035 : articulation==='legato' ? .09 : Math.max(.08,Math.min(.45,hold*.4));
 // Legacy notes keep their original sample bound and envelope. Explicit legato
 // can sustain beyond a short recorded attack via a matching waveform loop.
 const extended=articulation==='legato'&&mapping.mode!=='kit';
 const end=mapping.mode==='kit'?start+audio.duration/rate:extended?start+hold+release:Math.min(start+audio.duration/rate,start+hold+release);
 if(end<=start+.02)return false;
 const releaseSpan=Math.min(release,(end-start)/2);
 const source=context.createBufferSource(),gain=context.createGain();
 const panner=context.createStereoPanner?context.createStereoPanner():null;
 source.buffer=audio;source.playbackRate.value=rate;
 if(extended&&end-start>audio.duration/rate-.02){
  const points=waveLoopPoints(audio);
  if(points){source.loop=true;source.loopStart=points[0];source.loopEnd=points[1];}
 }
 const level=Math.max(.0001,Math.min(balancedWinds.has(instrument)?5:.85,Math.max(0,Number(volume))*(mapping.mode==='kit'?.75:.72)*(instrumentGain[instrument]||1)*balanceFor(audio,instrument)));
 gain.gain.setValueAtTime(.0001,start);
 const attack=articulation==='legato'?.016:.008;
 gain.gain.linearRampToValueAtTime(level,start+attack);
 gain.gain.setValueAtTime(level,Math.max(start+attack+.001,end-releaseSpan));
 gain.gain.exponentialRampToValueAtTime(.0001,end);
 source.connect(gain);
 if(panner){gain.connect(panner);panner.pan.value=Math.max(-1,Math.min(1,Number(pan)||0));panner.connect(destination);}
 else gain.connect(destination);
 if(active.length>=maxVoices){const oldest=active.shift();try{oldest.stop(start);}catch(_){}}
 active.push(source);
 source.addEventListener('ended',()=>{
  const index=active.indexOf(source);if(index>=0)active.splice(index,1);
  try{source.disconnect();gain.disconnect();panner?.disconnect();}catch(_){ }
 },{once:true});
 register(source);
 const onsetSkip=articulation==='legato'&&mapping.mode!=='kit'
  ?sustainStats(audio,instrument).onset
  :articulation==='tongue'&&breathSensitive.has(instrument)?Math.min(.035,audio.duration*.025):0;
 source.start(start,onsetSkip);source.stop(end+.01);return true;
}

// Recorded-sample legato. IMPORTANT: these are CC0 single-note recordings,
// NOT recordings of the true fingered transitions between two different pitches.
// Keep one actual sample playing across a connected phrase. Only its playback
// rate changes, so repeated sample attacks/breath noise cannot recur per step.
// Tonguing and the original (non-articulated) notes still use the original
// one-shot sample player above. No PeriodicWave / synthetic oscillator here.
const recordedLoopCache=new WeakMap();
function smoothRecordedLoop(context,audio,instrument){
 const existing=recordedLoopCache.get(audio);if(existing)return existing;
 const duration=Number(audio.duration)||0,rate=Number(audio.sampleRate)||0;
 if(!rate||duration<1.6||typeof context.createBuffer!=='function'||typeof audio.getChannelData!=='function')return null;
 // The original files are several seconds long. Only create a loop when the
 // whole phrase would overrun the unmodified recording. Prepare once per clip.
 const stable=sustainStats(audio,instrument),startSeconds=Math.max(.7,stable.onset+.4);
 const endSeconds=Math.min(duration-.32,Math.max(startSeconds+1.0,duration-.42));
 const begin=Math.floor(startSeconds*rate),fade=Math.floor(rate*.055);
 let end=Math.floor(endSeconds*rate);
 if(end-begin<fade*5||begin<0||end+1>=audio.length)return null;
 // Correlation-match the outgoing sustain tail with the incoming sustain
 // head BEFORE overlapping. An arbitrary splice can phase-cancel the reed.
 const channels=Math.min(2,audio.numberOfChannels||1);
 const pcm=Array.from({length:channels},(_,c)=>audio.getChannelData(c));
 let bestScore=-Infinity,bestEnd=end;
 const scan=Math.min(Math.floor(rate*.3),Math.max(0,end-begin-fade*6));
 for(let candidate=end-scan;candidate<=end;candidate+=12){
  let ab=0,aa=0,bb=0;
  for(let j=0;j<fade;j+=9)for(const data of pcm){
   const a=data[candidate-fade+j],b=data[begin+j];
   ab+=a*b;aa+=a*a;bb+=b*b;
  }
  if(aa<.000001||bb<.000001)continue;
  const corr=ab/Math.sqrt(aa*bb);
  const powerPenalty=Math.abs(Math.log(Math.sqrt(aa/bb)))*.14;
  const score=corr-powerPenalty;
  if(score>bestScore){bestScore=score;bestEnd=candidate;}
 }
 end=bestEnd;
 try{
  const channels=audio.numberOfChannels,copy=context.createBuffer(channels,audio.length,rate);
  for(let ch=0;ch<channels;ch++){
   const from=audio.getChannelData(ch),to=copy.getChannelData(ch);to.set(from);
   // Tail of the recording flows into the next iteration's first 55ms.
   // After that overlap, loopStart is begin+fade, avoiding repeated attacks.
   for(let j=0;j<fade;j++){
    const v=j/Math.max(1,fade-1);
    const smooth=v*v*(3-2*v);
    to[end-fade+j]=from[end-fade+j]*(1-smooth)+from[begin+j]*smooth;
   }
  }
  const result={audio:copy,loopStart:(begin+fade)/rate,loopEnd:end/rate};
  recordedLoopCache.set(audio,result);return result;
 }catch(error){console.warn('[WAVE] recorded legato loop fallback',instrument,error);return null;}
}
// Put the chosen recording near the middle of the melodic range. The first
// note is often an extreme (e.g. C4 -> C5), and starting on its recording
// would force an unnecessary large pitch shift or mid-phrase sample change.
function phraseSample(instrument,notes){
 const mapping=banks.get(instrument);
 if(!mapping||!Array.isArray(mapping.samples))return null;
 const targetPitches=notes.map(n=>Number(n.pitch)+(Number(mapping.pitchOffset)||0));
 const firstVelocity=Number(notes[0].velocity??.85);
 const layer=firstVelocity<.55?2:4;
 const preferred=mapping.samples.filter(s=>s.layer===layer);
 const candidates=preferred.length?preferred:mapping.samples;
 let best=null,score=Infinity;
 for(const item of candidates){
  const audio=cache.get(instrument+'/'+item.file)?.buffer;
  if(!audio)continue;
  const maxError=Math.max(...targetPitches.map(p=>Math.abs(p-item.midi)));
  const averageError=targetPitches.reduce((sum,p)=>sum+Math.abs(p-item.midi),0)/targetPitches.length;
  // Reject pitch outliers preferentially, then minimise average coloration.
  const cost=maxError+averageError*.08;
  if(cost<score){score=cost;best={item,audio};}
 }
 return best;
}
function scheduleContinuousWind(context,instrument,notes,time,volume,pan,register,destination){
 if(!breathSensitive.has(instrument)||!Array.isArray(notes)||!notes.length||
    typeof context.createBufferSource!=='function')return false;
 const mapping=banks.get(instrument);if(!mapping||mapping.mode==='kit')return false;
 if(notes.some(n=>!Number.isFinite(Number(n.pitch))||!Number.isFinite(Number(n.offset))||
    !Number.isFinite(Number(n.duration))||Number(n.duration)<=0)||Number(notes[0].offset)!==0)return false;
 const selected=phraseSample(instrument,notes);if(!selected)return false;
 const {item,audio}=selected;
 const first=notes[0];
 const start=Math.max(context.currentTime+.002,Number(time)||context.currentTime);
 const total=Math.max(.06,...notes.map(n=>Number(n.offset)+Number(n.duration)));
 const targetPitch=n=>Number(n.pitch)+(Number(mapping.pitchOffset)||0);
 const rateOf=n=>Math.pow(2,(targetPitch(n)-Number(item.midi)+(Number(item.tune)||0)/100)/12);
 const rates=notes.map(rateOf),maxRate=Math.max(...rates);
 // Preserve continuity even for a broad connected phrase; restarting a
 // second recording would reintroduce a breath/phase dip. For >~2 octaves,
 // timbre is necessarily compromised by realtime playbackRate transposition.
 // Unavailable/out-of-range audio is handled by the existing fallback path.
 const source=context.createBufferSource(),gain=context.createGain(),
  panner=context.createStereoPanner?context.createStereoPanner():null;
 const onset=Math.min(audio.duration*.45,Math.max(.12,sustainStats(audio,instrument).onset+.08));
 const requiredTime=total*maxRate+onset+.18;
 const needLoop=requiredTime>audio.duration;
 if(needLoop){
  const processed=smoothRecordedLoop(context,audio,instrument);
  if(processed){
   source.buffer=processed.audio;source.loop=true;
   source.loopStart=processed.loopStart;source.loopEnd=processed.loopEnd;
  }else{
   const points=waveLoopPoints(audio);
   source.buffer=audio;
   if(points){source.loop=true;source.loopStart=points[0];source.loopEnd=points[1];}
   else return false;
  }
 }else source.buffer=audio;
 // Use the real recording's phase-continuous waveform for every note in the
 // phrase; Web Audio resamples without restarting it. This is *not* formant-
 // preserving pitch shift, and should not be labeled true sampled legato.
 source.playbackRate.setValueAtTime(rates[0],start);
 for(let i=1;i<notes.length;i++){
  const now=notes[i],at=start+Number(now.offset);
  // Pitch-locked sampled legato: retain a SINGLE continuous recorded waveform.
  // An interpolated playbackRate slide made every step sound like "fua/fua".
  // Rapid fingering changes pitch but MUST NOT duck the sound or glide.
  source.playbackRate.setValueAtTime(rates[i],at);
 }
 const initialVelocity=Math.max(.05,Number(first.velocity??.85));
 const level=Math.max(.0001,Math.min(balancedWinds.has(instrument)?5:.85,Math.max(0,Number(volume))*.72*(instrumentGain[instrument]||1)*balanceFor(audio,instrument)));
 gain.gain.setValueAtTime(.0001,start);
 gain.gain.linearRampToValueAtTime(level,start+.026);
 let lastLevel=level;
 for(let i=1;i<notes.length;i++){
  const note=notes[i],prev=notes[i-1],at=start+Number(note.offset);
  if(Math.abs(Number(note.velocity??initialVelocity)-Number(prev.velocity??initialVelocity))>.018){
   lastLevel=Math.max(.0001,Math.min(balancedWinds.has(instrument)?5:.85,level*Number(note.velocity??initialVelocity)/initialVelocity));
   gain.gain.setTargetAtTime(lastLevel,at,.07);
  }
 }
 const release=Math.min(.12,Math.max(.055,Number(notes[notes.length-1].duration)*.22));
 const end=start+total+release;
 gain.gain.setValueAtTime(lastLevel,Math.max(start+.026,start+total-.025));
 gain.gain.exponentialRampToValueAtTime(.0001,end);
 source.connect(gain);
 if(panner){gain.connect(panner);panner.pan.value=Math.max(-1,Math.min(1,Number(pan)||0));panner.connect(destination);}
 else gain.connect(destination);
 if(active.length>=maxVoices){const oldest=active.shift();try{oldest.stop(start);}catch(_){}}
 active.push(source);register(source);
 source.addEventListener('ended',()=>{
  const i=active.indexOf(source);if(i>=0)active.splice(i,1);
  try{source.disconnect();gain.disconnect();panner?.disconnect();}catch(_){ }
 },{once:true});
 source.start(start,onset);source.stop(end+.01);
 return true;
}

// Natural melodic phrases with one sustained source for nearby pitches.
// Changes of recording bank are launched from the STEADY portion of the new
// sample, with equal-power overlap and measured-RMS matching, not a second
// recorded breath attack. Legacy, percussion, explicit tongue stay unchanged.
function schedulePhrase(context,instrument,segments,time,volume=.7,pan=0,register=()=>{},destination=output(context)){
 if(!supported.has(instrument)||!Array.isArray(segments)||segments.length<2)return false;
 const mapping=banks.get(instrument);
 if(!mapping||mapping.mode==='kit')return false;
 const first=segments[0],notes=segments.map(s=>({
  offset:Number(s.offset),duration:Number(s.duration),pitch:Number(s.pitch),velocity:Number(s.velocity??first.velocity??.85)
 }));
 if(notes.some(n=>!Number.isFinite(n.offset)||!Number.isFinite(n.duration)||n.duration<=0||!Number.isFinite(n.pitch))||notes[0].offset!==0)return false;
 // No mid-phrase sample replacement for winds. Even equal-power overlapping
 // samples beat against each other (especially during pitch changes), which
 // makes the repeated "fua" wobble. Use one measured, centered sustain sample
 // with phase continuous playback rate stepping at every legato note boundary.
 // The individual recording stays audible, NOT an oscillator/synthetic tone.
 if(breathSensitive.has(instrument))return scheduleContinuousWind(
  context,instrument,notes,time,volume,pan,register,destination);
 // For >=2 notes, prefer a few adjacent real recordings over resampling
 // one clarinet sample across an octave. Switching happens ONLY when
 // required by pitch distance, and starts after the recorded attack.
 // Single legato notes retain the continuous recorded source in schedule().
 const start=Math.max(context.currentTime+.002,Number(time)||context.currentTime);
 const total=Math.max(...notes.map(n=>n.offset+n.duration));
 const parts=[];let current=null;
 // Stay on the same recording longer to minimize audible colour changes.
 const sourceRange=breathSensitive.has(instrument)?3.4:6.5;
 for(let i=0;i<notes.length;i++){
  const note=notes[i],target=note.pitch+(Number(mapping.pitchOffset)||0);
  if(!current||Math.abs(target-current.item.midi)>sourceRange){
   const item=nearest(instrument,note.pitch,note.velocity),audio=item&&cache.get(instrument+'/'+item.file)?.buffer;
   if(!audio)return false; // No halfway-played phrases when an asset failed to preload.
   // Sparse instruments may have no closer sample; do not restart the
   // exact same recording at every new note when that happens.
   if(current&&item.file===current.item.file){current.to=i;continue;}
   current={item,audio,from:i,to:i};parts.push(current);
  }else current.to=i;
 }
 const originalVelocity=Math.max(.01,Number(first.velocity??.85));
 const gainOf=(note,part)=>Math.max(.0001,Math.min(balancedWinds.has(instrument)?5:.85,
   Math.max(0,Number(volume))*(note.velocity/originalVelocity)*.72*
   (instrumentGain[instrument]||1)*balanceFor(part.audio,instrument)));
 const rateOf=(note,item)=>Math.pow(2,(note.pitch+(Number(mapping.pitchOffset)||0)-item.midi+(Number(item.tune)||0)/100)/12);
 const panned=context.createStereoPanner?context.createStereoPanner():null;
 if(panned){panned.pan.value=Math.max(-1,Math.min(1,Number(pan)||0));panned.connect(destination);}
 const finalOut=panned||destination;
 let unfinished=parts.length;
 for(let partIndex=0;partIndex<parts.length;partIndex++){
  const part=parts[partIndex],note=notes[part.from],next=parts[partIndex+1];
  const prev=parts[partIndex-1];
  const inCross=prev?Math.min(.095,Math.max(.035,notes[part.from].duration*.65),Math.max(.035,notes[part.from-1].duration*.65)):0;
  const outCross=next?Math.min(.095,Math.max(.035,notes[next.from].duration*.65),Math.max(.035,notes[next.from-1].duration*.65)):0;
  const partStart=start+note.offset-inCross/2;
  const boundary=next?start+notes[next.from].offset:start+total;
  const partEnd=boundary+(next?outCross/2:.09);
  const source=context.createBufferSource(),gain=context.createGain();
  const firstRate=rateOf(note,part.item);
  source.playbackRate.setValueAtTime(firstRate,partStart);
  const stable=sustainStats(part.audio,instrument);
  const skip=Math.min(part.audio.duration*.45,stable.onset+(balancedWinds.has(instrument)?.10:0));
  // An upward line runs through the source faster than its FIRST note.
  // Using firstRate alone could exhaust the recording before a later note
  // reaches its release, causing a very audible mid-phrase drop-out.
  let fastestRate=firstRate;
  for(let k=part.from+1;k<=part.to;k++)fastestRate=Math.max(fastestRate,rateOf(notes[k],part.item));
  const needsLoop=(partEnd-partStart)*fastestRate+skip+.05>part.audio.duration;
  let playbackBuffer=part.audio;
  if(needsLoop){
   // The raw zero-crossing loop may match in one channel yet click in the
   // other. Use a once-per-sample, two-channel overlapping sustain loop.
   const processed=smoothRecordedLoop(context,part.audio,instrument);
   if(processed){
    playbackBuffer=processed.audio;source.loop=true;
    source.loopStart=processed.loopStart;source.loopEnd=processed.loopEnd;
   }else{
    const points=waveLoopPoints(part.audio);
    if(points){source.loop=true;source.loopStart=points[0];source.loopEnd=points[1];}
   }
  }
  source.buffer=playbackBuffer;
  let level=gainOf(note,part);
  if(prev){crossfade(gain.gain,0,level,partStart,inCross,true);}
  else{
   gain.gain.setValueAtTime(.0001,partStart);
   gain.gain.linearRampToValueAtTime(level,partStart+.024);
  }
  for(let k=part.from+1;k<=part.to;k++){
   const previous=notes[k-1],now=notes[k];
   const at=start+now.offset;
   // Clarinet/flute fingering changes are quick, not a wide portamento.
   const slide=Math.min(.023,Math.max(.007,Math.min(previous.duration,now.duration)*.12));
   source.playbackRate.setValueAtTime(rateOf(previous,part.item),at-slide/2);
   source.playbackRate.exponentialRampToValueAtTime(rateOf(now,part.item),at+slide/2);
   if(Math.abs(now.velocity-previous.velocity)>.01){
    level=gainOf(now,part);
    gain.gain.setTargetAtTime(level,at,.035);
   }
  }
  if(next){
   const fadeStart=boundary-outCross/2;
   crossfade(gain.gain,level,0,fadeStart,outCross,false);
  }else{
   const fadeStart=Math.max(partStart+.026,boundary-.055);
   gain.gain.setValueAtTime(level,fadeStart);
   gain.gain.exponentialRampToValueAtTime(.0001,partEnd);
  }
  source.connect(gain);gain.connect(finalOut);
  source.addEventListener('ended',()=>{
   const index=active.indexOf(source);if(index>=0)active.splice(index,1);
   try{source.disconnect();gain.disconnect();}catch(_){}
   if(--unfinished===0)try{panned?.disconnect();}catch(_){}
  },{once:true});
  if(active.length>=maxVoices){const oldest=active.shift();try{oldest.stop(start);}catch(_){}}
  active.push(source);register(source);
  source.start(partStart,skip);source.stop(partEnd+.01);
 }
 return true;
}
const engineVersion='continuous-recorded-pitchlock-v7';
function showEngineVersion(){
 if(typeof document.querySelector!=='function'||typeof document.createElement!=='function')return;
 const heading=document.querySelector('.topbar .eyebrow');
 if(!heading||document.getElementById('wave-audio-engine-version'))return;
 const tag=document.createElement('span');tag.id='wave-audio-engine-version';
 tag.textContent=' · AUDIO v7';tag.title='録音音量補正・切替時の息揺れ防止・ピッチロック v7';
 tag.style.cssText='color:#6ee7b7;font-size:.62rem;font-weight:800;letter-spacing:.02em';
 heading.appendChild(tag);
}
if(typeof document.addEventListener==='function'){
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',showEngineVersion,{once:true});
 else showEngineVersion();
}
globalThis.WaveSamples={preloadProject,schedule,schedulePhrase,output,setMaster,instrumentGain,
 stats:()=>({legatoEngine:engineVersion,balancedWinds:true,hybridRecordedSamples:true,buffers:cache.size,decodedBytes:decodedBytes(),voices:active.length,maxBuffers,maxVoices,maxDecodedBytes})};
})();
