// Presentation leases and snapshots stay in memory. Never persist or log private game state.
(()=>{'use strict';
const params=new URLSearchParams(location.search),expanded=params.get('surface')==='expanded';
let lease=params.get('lease')||'',adapter=null,phase=expanded?'waiting':'active',busy=false,flight=0,lastImport='';
const app=location.pathname.includes('/party/')?'party':'play';
const bar=document.createElement('div');bar.id='screenBar';
const toggle=document.createElement('button');toggle.textContent=expanded?'スマホへ戻る':'大画面で開く';
const diag=document.createElement('button');diag.textContent='診断';
const notice=document.createElement('span');notice.id='screenNotice';bar.append(toggle,diag,notice);document.body.prepend(bar);
document.body.classList.toggle('screen-expanded',expanded);
const say=t=>{notice.textContent=t;};
function park(){phase='parked';adapter.pause();document.querySelector('main').inert=true;document.body.classList.add('screen-parked');window.dispatchEvent(new Event('blur'));}
function activate(state){adapter.restore(state);phase='active';document.querySelector('main').inert=false;document.body.classList.remove('screen-parked');}
async function call(action,payload={}){return await FlecityBridge.call(action,{...payload,app,lease});}
async function importState(state,id){
 if(lastImport===id)return;
 lease=id;activate(state);phase='waiting';
 const r=await call(expanded?'screenReady':'screenReturned');
 if(r.ok){lastImport=id;phase='active';say('');if(adapter.afterRestore)adapter.afterRestore();}else{park();say('切替の確認待ちです。');}
}
async function claim(){
 if(expanded||busy||!adapter)return false;
 const r=await call('screenClaim');
 if(r.ok&&r.state){await importState(r.state,r.lease);return true;}
 if(r.parked){if(phase!=='parked')park();say('大画面で操作中');return true;}
 return false;
}
toggle.onclick=async()=>{
 if(busy||phase!=='active'||flight||!adapter||(!expanded&&!adapter.canTransfer())){say('盤面・テトリス・お絵描きで、通信や操作が終わってから切り替えてください。');return;}
 busy=true;let snapshot;try{snapshot=adapter.snapshot();park();}catch(_){busy=false;say('切替を準備できませんでした。');return;}
 const r=await call(expanded?'screenClose':'screenOpen',{state:snapshot});
 if(!r.ok){
  // An uncertain acknowledgement must not create two active owners. Query the lease before resuming.
  const owner=await call('screenStatus');
  if(owner.ok&&owner.owner===(expanded?'expanded':'phone'))activate(snapshot);
  say('切替を確認できません。もう一度お試しください。');
 }else{lease=r.lease||lease;say(expanded?'スマホへ戻しています…':'大画面で操作中');}
 busy=false;
};
diag.onclick=async()=>{
 const r=await call('localDiagnostics');if(r.ok){FlecityDiagnostics.note('client-state',r.state);say('端末診断をメモリーに記録しました');}
};
window.addEventListener('keydown',e=>{
 if(phase!=='active'){e.stopImmediatePropagation();return;}
 if(expanded&&e.key==='Escape'&&!e.isComposing){e.preventDefault();e.stopImmediatePropagation();toggle.click();}
},true);
// Prevent stale pointer/click handlers even when a keyboard event targets the old body.
for(const type of ['pointerdown','pointerup','click'])window.addEventListener(type,e=>{if(phase!=='active'&&!bar.contains(e.target)){e.stopImmediatePropagation();e.preventDefault();}},true);
function receive(data){
 if(data?.type==='screenReturn'&&!expanded)void claim();
 if(data?.type==='screenRestore'&&!expanded){lastImport='';void claim();}
}
window.addEventListener('message',event=>{
 const d=event.data;
 if(expanded&&event.source===parent&&event.origin===location.origin&&d?.type==='screenImport'&&d.lease===lease&&phase==='waiting')void importState(d.state,lease);
 else if(!expanded)receive(d);
});
window.FlecityScreen={
 expanded,get parked(){return phase!=='active';},get transferring(){return phase!=='active';},
 get surface(){return expanded?'expanded':'phone';},get lease(){return lease;},
 begin(){flight++;},end(){flight=Math.max(0,flight-1);},
 async start(value,bootstrap){adapter=value;
  if(expanded){parent.postMessage({type:'screenLoaded'},location.origin);return;}
  if(typeof globalThis.onNuiEvent==='function')for(const type of ['screenReturn','screenRestore'])globalThis.onNuiEvent(type,receiveData=>receive({type,...receiveData}));
  if(!await claim())await bootstrap();
 }
};
})();