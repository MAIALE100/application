// A presentation lease keeps the phone and expanded editor from writing at once.
(()=>{'use strict';
const params=new URLSearchParams(location.search),expanded=params.get('surface')==='expanded';
let lease=params.get('lease')||'',phase=expanded?'waiting':'active',busy=false,flight=0,lastImport='',claiming=false;
const toggle=document.getElementById('waveScreenToggle');
toggle.textContent=expanded?'スマホへ戻る':'大画面で開く';
document.body.classList.toggle('wave-expanded',expanded);
const fields=['releaseTitle','releaseGenre','accessMode','releasePrice','releaseDescription','rightsConfirm','rightRingtone','rightNotification','rightStore','rightEvent','rightRemix'];
function setPhase(value){phase=value;document.body.classList.toggle('wave-screen-parked',value!=='active');toggle.disabled=value!=='active';}
function notice(message){const el=document.getElementById('status');el.textContent=message;}
function snapshot(){
 if(typeof state==='undefined'||!state.project)throw Error('WAVE editor not ready');
 const inputs=Object.fromEntries(fields.map(id=>{const el=document.getElementById(id);return [id,el.type==='checkbox'?el.checked:el.value];}));
 const codec=window.WaveHistoryCodec;
 if(!codec)throw Error('WAVE history codec missing');
 const value={view:state.view,project:state.project,projectId:state.projectId,selectedTrack:state.selectedTrack,bar:state.bar,playStartBar:state.playStartBar,octave:state.octave,octaveRows:state.octaveRows,keyGuide:state.keyGuide,noteLength:state.noteLength,noteVelocity:state.noteVelocity,undoPack:codec.pack(state.project,state.undoStack),redoPack:codec.pack(state.project,state.redoStack),barClipboard:state.barClipboard,dirty:state.dirty,inputs};
 const encoded=JSON.stringify(value);if(encoded.length>1048576)throw Error('WAVE screen state is too large');return JSON.parse(encoded);
}
function restore(value,show=true){
 if(!value||typeof value!=='object'||!value.project||typeof value.view!=='string')throw Error('Invalid WAVE screen state');
 state.project=value.project;state.projectId=value.projectId||null;state.selectedTrack=value.selectedTrack||0;state.bar=value.bar||0;
 state.octave=value.octave||4;state.octaveRows=value.octaveRows===24?24:value.octaveRows===12?12:null;state.keyGuide=value.keyGuide!==false;state.playStartBar=value.playStartBar||0;state.noteLength=value.noteLength||4;state.noteVelocity=value.noteVelocity||.85;
 const codec=window.WaveHistoryCodec;
 if((value.undoPack||value.redoPack)&&!codec)throw Error('WAVE history codec missing');
 state.undoStack=value.undoPack?codec.unpack(state.project,value.undoPack):(Array.isArray(value.undoStack)?value.undoStack:[]);
 state.redoStack=value.redoPack?codec.unpack(state.project,value.redoPack):(Array.isArray(value.redoStack)?value.redoStack:[]);
 state.barClipboard=value.barClipboard||null;state.dirty=value.dirty===true;
 renderStudio();
 for(const id of fields){const el=document.getElementById(id);if(!el||value.inputs?.[id]===undefined)continue;if(el.type==='checkbox')el.checked=value.inputs[id]===true;else el.value=value.inputs[id];}
 if(show)showView(['home','search','library','studio','profile','admin'].includes(value.view)?value.view:'home');
}
async function control(action,payload={}){return await bridge(action,{...payload,lease});}
async function importState(value,id){
 if(lastImport===id)return;lease=id;
 try{
  // The host may receive the iframe's first message before app.js defines
  // WaveBoot. Wait for all synchronous scripts before starting the handoff.
  for(let attempt=0;typeof window.WaveBoot!=='function'&&attempt<30;attempt++)await new Promise(resolve=>setTimeout(resolve,50));
  if(typeof window.WaveBoot!=='function')throw Error('WAVE scripts did not initialize');
  if(!await window.WaveBoot())throw Error('WAVE bootstrap failed');
  restore(value,false);
  const reply=await control('waveScreenReady');
  if(!reply?.ok)throw Error('WAVE screen acknowledgement failed');
  lastImport=id;setPhase('active');showView(value.view);notice('');
 }catch(error){
  console.warn('[WAVE] expanded handoff failed:',String(error?.message||error).slice(0,120));
  setPhase('waiting');notice('大画面への切替に失敗しました。スマホへ復帰します。');
  void control('waveScreenFailed');
 }
}
async function claim(){
 if(claiming)return;
 claiming=true;
 try{
 const reply=await control('waveScreenClaim');
 if(reply?.ok&&reply.state&&reply.lease){
  lease=reply.lease;
  let booted=await window.WaveBootPromise;
  if(!booted&&typeof window.WaveBoot==='function')booted=await window.WaveBoot();
  if(!booted){notice('スマホ画面の起動に失敗しました。もう一度お試しください。');return;}
  const acknowledged=await control('waveScreenReturned');
  if(!acknowledged?.ok)return;
  // The lease is already returned to the phone. Unpark before showView starts
  // its Library/Home callbacks, otherwise the phone rejects them locally.
  setPhase('active');restore(reply.state);notice('');
 }else if(reply?.parked){setPhase('parked');notice('大画面で操作中');}
 }finally{claiming=false;}
}
toggle.addEventListener('click',async()=>{
 if(busy||phase!=='active'||flight||state.publishing){notice('処理が終わってから切り替えてください。');return;}
 busy=true;let saved;
 try{saved=snapshot();stopAudio(true);setPhase('parked');}
 catch(_){busy=false;notice('切替用の編集データを保存できませんでした。');return;}
 try{
  const reply=await control(expanded?'waveScreenClose':'waveScreenOpen',{state:saved});
  if(!reply?.ok){setPhase('active');notice('切替を確認できませんでした。');}
  else{lease=reply.lease||lease;notice(expanded?'スマホへ戻しています…':'大画面で操作中');}
 }catch(_){setPhase('active');notice('切替を確認できませんでした。');}
 busy=false;
});
window.addEventListener('keydown',event=>{
 if(expanded&&event.key==='Escape'&&!event.isComposing&&!document.querySelector('dialog[open]')){event.preventDefault();event.stopImmediatePropagation();toggle.click();}
 else if(phase!=='active'&&event.key!=='Escape'){event.stopImmediatePropagation();}
},true);
window.addEventListener('message',event=>{
 const data=event.data;
 if(expanded&&event.source===parent&&event.origin===location.origin&&data?.type==='waveScreenImport'&&data.lease===lease&&phase==='waiting')void importState(data.state,lease);
 else if(!expanded&&(data?.type==='waveScreenReturn'||data?.type==='waveScreenRestore'))void claim();
});
window.WaveScreen={expanded,get surface(){return expanded?'expanded':'phone';},get lease(){return lease;},get parked(){return phase!=='active';},begin(){flight++;},end(){flight=Math.max(0,flight-1);},claim};
if(expanded)window.addEventListener('DOMContentLoaded',()=>parent.postMessage({type:'waveScreenLoaded'},location.origin),{once:true});
else window.addEventListener('load',()=>void claim(),{once:true});
})();
