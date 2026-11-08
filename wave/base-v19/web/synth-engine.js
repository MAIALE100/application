// WAVE SYNTH v11 - shared native Web Audio subtractive/FM instrument.
// Same code runs inside Studio (LB Phone + expanded) and resource-owned Library player.
// Tone.js is intentionally NOT loaded in this first, low-risk compatibility build.
(()=>{'use strict';
const WAVEFORMS=new Set(['sine','triangle','sawtooth','square']);
const NUM={attack:[.005,2],decay:[.01,2],sustain:[0,1],release:[.02,3],cutoff:[150,16000],resonance:[.1,16],detune:[0,18],fmRatio:[0,8],fmDepth:[0,800]};
const PRESETS=Object.freeze({
 warm_pad:{wave:'sawtooth',attack:.35,decay:.3,sustain:.72,release:1.2,cutoff:1800,resonance:.6,detune:5,fmRatio:0,fmDepth:0},
 synth_bass:{wave:'sawtooth',attack:.01,decay:.18,sustain:.55,release:.16,cutoff:850,resonance:2.5,detune:0,fmRatio:0,fmDepth:0},
 lead:{wave:'sawtooth',attack:.012,decay:.08,sustain:.8,release:.13,cutoff:5800,resonance:.8,detune:4,fmRatio:0,fmDepth:0},
 super_saw:{wave:'sawtooth',attack:.04,decay:.15,sustain:.7,release:.28,cutoff:3300,resonance:.85,detune:12,fmRatio:0,fmDepth:0},
 fm_bell:{wave:'sine',attack:.005,decay:.65,sustain:.06,release:.9,cutoff:12000,resonance:.1,detune:0,fmRatio:2.9,fmDepth:210},
 retro:{wave:'square',attack:.006,decay:.04,sustain:.72,release:.08,cutoff:8500,resonance:.1,detune:0,fmRatio:0,fmDepth:0},
 pluck:{wave:'triangle',attack:.005,decay:.18,sustain:.04,release:.13,cutoff:4400,resonance:.5,detune:0,fmRatio:0,fmDepth:0},
 soft_keys:{wave:'triangle',attack:.018,decay:.23,sustain:.38,release:.5,cutoff:2900,resonance:.2,detune:0,fmRatio:0,fmDepth:0}
});
const validPreset=key=>Object.prototype.hasOwnProperty.call(PRESETS,key)?key:'warm_pad';
const clamp=(value,min,max,fallback)=>{const n=Number(value);return Number.isFinite(n)?Math.max(min,Math.min(max,n)):fallback;};
function normalize(input){
 const data=input&&typeof input==='object'?input:{};
 const preset=validPreset(data.preset),defaults=PRESETS[preset],result={preset,wave:WAVEFORMS.has(data.wave)?data.wave:defaults.wave};
 for(const [key,[min,max]] of Object.entries(NUM))result[key]=clamp(data[key],min,max,defaults[key]);
 return result;
}
const defaultPreset=name=>normalize({preset:validPreset(name),...PRESETS[validPreset(name)]});
const active=new WeakMap();
function schedule(context,instrument,pitch,time,duration,volume=.7,pan=0,register=()=>{},destination=context.destination,configuration=null){
 if(instrument!=='synth')return false;
 const midi=Number(pitch),level=Number(volume),noteLen=Number(duration);
 if(!Number.isFinite(midi)||midi<20||midi>110||!Number.isFinite(level)||level<=0)return true;
 if(!context||typeof context.createOscillator!=='function')return true;
 const config=normalize(configuration);
 let voices=active.get(context);if(!voices){voices=new Set();active.set(context,voices);}
 // Voice cap prevents unbounded NUI CPU use under pathological polyphony.
 if(voices.size>=64)return true;
 const token={};voices.add(token);
 const start=Math.max(Number(context.currentTime)||0,Number(time)||0)+.001;
 const held=clamp(noteLen,.04,20,.25),end=start+held;
 const frequency=440*Math.pow(2,(midi-69)/12);
 const attack=Math.min(config.attack,held*.85),decay=Math.min(config.decay,Math.max(.005,held-attack)),release=config.release;
 const output=destination||context.destination;
 const envelope=context.createGain(),filter=context.createBiquadFilter();
 const panner=typeof context.createStereoPanner==='function'?context.createStereoPanner():null;
 const peak=Math.max(.0001,Math.min(.16,level*.13));
 filter.type='lowpass';filter.frequency.setValueAtTime(config.cutoff,start);filter.Q.setValueAtTime(config.resonance,start);
 envelope.gain.setValueAtTime(.00001,start);
 envelope.gain.linearRampToValueAtTime(peak,start+Math.max(.002,attack));
 const decEnd=start+Math.max(.003,attack)+Math.max(.004,decay);
 const sus=peak*config.sustain;
 if(decEnd<end)envelope.gain.linearRampToValueAtTime(sus,decEnd);
 envelope.gain.setValueAtTime(decEnd<end?sus:peak,end);
 envelope.gain.linearRampToValueAtTime(.00001,end+release);
 filter.connect(envelope);
 if(panner){panner.pan.setValueAtTime(clamp(pan,-1,1,0),start);envelope.connect(panner);panner.connect(output);}
 else envelope.connect(output);
 const carrier=context.createOscillator();carrier.type=config.wave;
 carrier.frequency.setValueAtTime(frequency,start);carrier.connect(filter);
 let secondary=null,auxGain=null;
 if(config.fmRatio>0&&config.fmDepth>0){
  secondary=context.createOscillator();auxGain=context.createGain();secondary.type='sine';
  secondary.frequency.setValueAtTime(frequency*config.fmRatio,start);
  auxGain.gain.setValueAtTime(config.fmDepth,start);
  secondary.connect(auxGain);auxGain.connect(carrier.frequency);
 }else if(config.detune>0){
  secondary=context.createOscillator();auxGain=context.createGain();secondary.type=config.wave;
  secondary.frequency.setValueAtTime(frequency,start);secondary.detune.setValueAtTime(config.detune,start);
  auxGain.gain.setValueAtTime(.45,start);secondary.connect(auxGain);auxGain.connect(filter);
 }
 const nodes=[carrier,secondary,auxGain,filter,envelope,panner].filter(Boolean);
 let cleaned=false;
 function cleanup(){if(cleaned)return;cleaned=true;voices.delete(token);for(const node of nodes){try{node.disconnect();}catch(_){}}}
 carrier.addEventListener?.('ended',cleanup,{once:true});
 try{
  const stopAt=end+release+.03;
  carrier.start(start);carrier.stop(stopAt);register(carrier);
  if(secondary){secondary.start(start);secondary.stop(stopAt);register(secondary);}
 }catch(error){cleanup();console.warn('[WAVE] synth voice scheduling failed:',String(error?.message||error));}
 return true;
}
globalThis.WaveSynth={presets:PRESETS,normalize,defaultPreset,schedule,version:11};
})();
