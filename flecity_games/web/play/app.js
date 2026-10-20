const statusEl=document.getElementById('status');
const gamesEl=document.getElementById('games');
const homeEl=document.getElementById('home');
const quickEl=document.getElementById('quickTap');
const tapMessage=document.getElementById('tapMessage');
const tapButton=document.getElementById('tapButton');
const tapBack=document.getElementById('tapBack');

let tapState='idle',tapShownAt=0,tapStartedAt=0,tapTimer=null,tapSession=null;

function setStatus(text,type){statusEl.textContent=text;statusEl.className='status '+(type||'');}
function showHome(){clearTimeout(tapTimer);tapState='idle';tapSession=null;quickEl.classList.add('hidden');homeEl.classList.remove('hidden');}
function showQuick(){homeEl.classList.add('hidden');quickEl.classList.remove('hidden');tapMessage.textContent='READY?';tapButton.textContent='START';tapButton.disabled=false;tapState='idle';}
function renderGames(games){
  gamesEl.innerHTML='';
  (games||[]).filter(g=>g.app==='play'&&g.enabled).forEach(game=>{
    const btn=document.createElement('button');
    btn.className='game';
    btn.innerHTML='<span class="tag">'+game.category+'</span><strong>'+game.name+'</strong><span class="muted">'+game.description+'</span>';
    btn.onclick=()=>{if(game.id==='quick_tap')showQuick();else setStatus(game.name+' CORE registered — gameplay arrives in Phase 2.','warn');};
    gamesEl.appendChild(btn);
  });
}
async function bootstrap(){
  const res=await FlecityBridge.call('playBootstrap',{});
  if(!res.ok){setStatus('Could not load PLAY: '+res.error,'error');return;}
  renderGames(res.games);setStatus('PLAY CORE ready.','good');
}
tapButton.onclick=async()=>{
  if(tapState==='waiting'){
    clearTimeout(tapTimer);tapState='idle';tapSession=null;tapMessage.textContent='FLYING!';tapButton.textContent='TRY AGAIN';return;
  }
  if(tapState==='shown'){
    const reaction=performance.now()-tapShownAt;tapState='submitting';tapButton.disabled=true;
    const duration=Math.max(0,Math.round(performance.now()-tapStartedAt));
    const res=await FlecityBridge.call('playSubmitScore',{sessionToken:tapSession.sessionToken,score:reaction,durationMs:duration});
    if(res.ok){tapMessage.textContent=Number(res.score).toFixed(3)+' ms';setStatus('Score accepted.','good');}
    else{tapMessage.textContent='NOT SAVED';setStatus('Score rejected: '+res.error,'error');}
    tapState='idle';tapSession=null;tapButton.textContent='AGAIN';tapButton.disabled=false;return;
  }
  if(tapState!=='idle')return;
  tapButton.disabled=true;
  const res=await FlecityBridge.call('playStartSession',{gameId:'quick_tap'});
  if(!res.ok){tapButton.disabled=false;setStatus('Could not start: '+res.error,'error');return;}
  tapSession=res;tapState='waiting';tapStartedAt=performance.now();tapMessage.textContent='WAIT';tapButton.textContent='WAIT…';tapButton.disabled=false;
  tapTimer=setTimeout(()=>{if(tapState!=='waiting')return;tapState='shown';tapShownAt=performance.now();tapMessage.textContent='TAP!';tapButton.textContent='TAP!';},
    Math.max(250,Number(res.challenge&&res.challenge.delayMs)||1500));
};
tapBack.onclick=showHome;
bootstrap();
