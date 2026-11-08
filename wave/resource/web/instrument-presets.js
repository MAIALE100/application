// WAVE music instrument catalog: UI-only filters (no instrument IDs, DB or saved notes altered).
(()=>{'use strict';
const SELECTOR='waveInstrumentTierV1';
const GROUPS=['鍵盤','ギター・ベース','木管楽器','金管楽器','弦楽器','ドラム・打楽器','シンセ・電子音'];
const INSTRUMENTS={
  piano:['鍵盤',1],grand_piano:['鍵盤',0],
  acoustic_guitar:['ギター・ベース',0],electric_guitar:['ギター・ベース',0],electric_bass:['ギター・ベース',0],
  flute:['木管楽器',0],clarinet:['木管楽器',1],piccolo:['木管楽器',2],oboe:['木管楽器',2],bassoon:['木管楽器',2],alto_sax:['木管楽器',1],tenor_sax:['木管楽器',2],
  trumpet:['金管楽器',0],trombone:['金管楽器',1],french_horn:['金管楽器',1],euphonium:['金管楽器',2],tuba:['金管楽器',1],
  violin:['弦楽器',0],cello:['弦楽器',1],strings:['弦楽器',1],
  contrabass:['弦楽器',2],harp:['弦楽器',1],cymbals:['ドラム・打楽器',1],vibraphone:['ドラム・打楽器',2],
  acoustic_drums:['ドラム・打楽器',0],drums:['ドラム・打楽器',2],timpani:['ドラム・打楽器',1],xylophone:['ドラム・打楽器',2],marimba:['ドラム・打楽器',1],glockenspiel:['ドラム・打楽器',2],
  synth:['シンセ・電子音',0],saw:['シンセ・電子音',0],triangle:['シンセ・電子音',1],sine:['シンセ・電子音',1],square:['シンセ・電子音',2],bass:['シンセ・電子音',1],pluck:['シンセ・電子音',2],bell:['シンセ・電子音',2]
};
const THRESHOLDS={easy:0,standard:1,all:2};
const DESCRIPTIONS={easy:'よく使う楽器だけ。音色をすぐ選べます。',standard:'バンド・吹奏楽で使う楽器も表示します。',all:'導入済みのすべての音色を表示します。'};
const presetEl=document.getElementById('instrumentPreset');
const instrumentEl=document.getElementById('instrumentSelect');
const hintEl=document.getElementById('instrumentPresetHelp');
if(!presetEl||!instrumentEl)return;
// Retain a stable source catalog, so future preset changes never lose options.
const catalog=[...instrumentEl.querySelectorAll('option')].filter(o=>o.value).map(o=>({value:o.value,name:o.textContent}));
const byId=new Map(catalog.map(e=>[e.value,e]));
function storedPreset(){try{return localStorage.getItem(SELECTOR)}catch(_){return null}}
let preset=Object.prototype.hasOwnProperty.call(THRESHOLDS,storedPreset())?storedPreset():'easy';
let previousSelected='';
function visibleIds(tier,selected=''){
 const max=THRESHOLDS[tier]??THRESHOLDS.easy;
 const ids=catalog.filter(e=>(INSTRUMENTS[e.value]?.[1]??2)<=max).map(e=>e.value);
 if(selected&&byId.has(selected)&&!ids.includes(selected))ids.push(selected);
 return ids;
}
function sync(selected){
 const current=selected||instrumentEl.value||previousSelected||catalog[0]?.value||'';
 previousSelected=current;
 const allowed=new Set(visibleIds(preset,current));
 instrumentEl.textContent='';
 for(const group of GROUPS){
  const choices=catalog.filter(e=>allowed.has(e.value)&&(INSTRUMENTS[e.value]?.[0]||'シンセ・電子音')===group);
  if(!choices.length)continue;
  const optgroup=document.createElement('optgroup');optgroup.label=group;
  for(const e of choices){const opt=document.createElement('option');opt.value=e.value;opt.textContent=e.name;optgroup.appendChild(opt)}
  instrumentEl.appendChild(optgroup);
 }
 instrumentEl.value=current;
 if(!instrumentEl.value&&catalog.length)instrumentEl.value=visibleIds(preset)[0]||catalog[0].value;
 presetEl.value=preset;
 const shown=allowed.size;
 const restored=byId.has(current)&&(INSTRUMENTS[current]?.[1]??2)>(THRESHOLDS[preset]??0);
 hintEl.textContent=`${DESCRIPTIONS[preset]} ${shown}音色${restored?'（現在のトラックの音色は例外表示）':''}`;
 return allowed;
}
presetEl.addEventListener('change',()=>{
 const next=presetEl.value;
 if(!Object.prototype.hasOwnProperty.call(THRESHOLDS,next))return;
 const current=instrumentEl.value||previousSelected;
 preset=next;
 try{localStorage.setItem(SELECTOR,preset)}catch(_){}
 sync(current);
});
sync(instrumentEl.value);
// Test diagnostics, no persistent state mutation or NUI network calls.
window.WaveInstrumentPresets={sync,visibleIds,available:()=>catalog.map(e=>e.value),tier:()=>preset};
})();
