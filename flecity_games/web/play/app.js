const statusEl=document.getElementById('status'),gamesEl=document.getElementById('games'),homeEl=document.getElementById('home');
const rankingGame=document.getElementById('rankingGame'),rankingPeriod=document.getElementById('rankingPeriod'),rankingLoad=document.getElementById('rankingLoad'),rankingRows=document.getElementById('rankingRows');
const dailyCard=document.getElementById('dailyCard'),dailyGame=document.getElementById('dailyGame'),dailyDate=document.getElementById('dailyDate'),dailyPlay=document.getElementById('dailyPlay'),dailyBest=document.getElementById('dailyBest'),dailyRanking=document.getElementById('dailyRanking');
const statPlays=document.getElementById('statPlays'),statTime=document.getElementById('statTime'),achievementRows=document.getElementById('achievementRows');
const settingSound=document.getElementById('settingSound'),settingMotion=document.getElementById('settingMotion');
const quickEl=document.getElementById('quickTap'),tapMessage=document.getElementById('tapMessage'),tapButton=document.getElementById('tapButton'),tapBack=document.getElementById('tapBack');
const stopEl=document.getElementById('stopGame'),stopMessage=document.getElementById('stopMessage'),stopButton=document.getElementById('stopButton'),stopBack=document.getElementById('stopBack'),stopTarget=document.getElementById('stopTarget'),stopMarker=document.getElementById('stopMarker');
const blockEl=document.getElementById('blockGame'),blockBoard=document.getElementById('blockBoard'),blockPieces=document.getElementById('blockPieces'),blockScore=document.getElementById('blockScore');
const blockBack=document.getElementById('blockBack'),blockNew=document.getElementById('blockNew'),blockFinish=document.getElementById('blockFinish');
const mergeEl=document.getElementById('mergeGame'),mergeBoard=document.getElementById('mergeBoard'),mergeScore=document.getElementById('mergeScore'),mergeBack=document.getElementById('mergeBack'),mergeNew=document.getElementById('mergeNew'),mergeFinish=document.getElementById('mergeFinish');
const mergeUp=document.getElementById('mergeUp'),mergeDown=document.getElementById('mergeDown'),mergeLeft=document.getElementById('mergeLeft'),mergeRight=document.getElementById('mergeRight');
const minesEl=document.getElementById('minesGame'),minesBoard=document.getElementById('minesBoard'),minesTime=document.getElementById('minesTime'),minesBack=document.getElementById('minesBack'),minesMode=document.getElementById('minesMode'),minesNew=document.getElementById('minesNew');
const stackEl=document.getElementById('stackGame'),stackArena=document.getElementById('stackArena'),stackBase=document.getElementById('stackBase'),stackMover=document.getElementById('stackMover'),stackScore=document.getElementById('stackScore'),stackBack=document.getElementById('stackBack'),stackDrop=document.getElementById('stackDrop'),stackNew=document.getElementById('stackNew');
const nonogramEl=document.getElementById('nonogramGame'),nonogramBoard=document.getElementById('nonogramBoard'),nonogramTime=document.getElementById('nonogramTime'),nonogramBack=document.getElementById('nonogramBack'),nonogramCheck=document.getElementById('nonogramCheck'),nonogramNew=document.getElementById('nonogramNew');

let bootstrapData=null,saves={},appSettings={sound:true,reducedMotion:false},audioCtx=null;
let tapState='idle',tapShownAt=0,tapStartedAt=0,tapTimer=null,tapSession=null,tapDaily=false;
let stopState='idle',stopSession=null,stopStartedAt=0,stopRaf=null,stopDaily=false;
let block=null,merge=null,mines=null,minesClock=null,stackGame=null,stackRaf=null,nonogram=null,nonogramClock=null;

const SHAPES=[
 [[0,0]],[[0,0],[1,0]],[[0,0],[1,0],[2,0]],[[0,0],[0,1]],[[0,0],[0,1],[0,2]],
 [[0,0],[1,0],[0,1],[1,1]],[[0,0],[0,1],[1,1]],[[1,0],[0,1],[1,1]],[[0,0],[1,0],[2,0],[1,1]]
];

function tone(freq=660,duration=70){
 if(!appSettings.sound)return;
 try{
   audioCtx=audioCtx||new (window.AudioContext||window.webkitAudioContext)();
   const osc=audioCtx.createOscillator(),gain=audioCtx.createGain(),now=audioCtx.currentTime;
   osc.frequency.value=freq;gain.gain.setValueAtTime(.035,now);gain.gain.exponentialRampToValueAtTime(.001,now+duration/1000);
   osc.connect(gain);gain.connect(audioCtx.destination);osc.start(now);osc.stop(now+duration/1000);
 }catch(_){}
}
function applySettings(settings){
 appSettings={sound:settings&&settings.sound!==false,reducedMotion:settings&&settings.reducedMotion===true};
 settingSound.checked=appSettings.sound;settingMotion.checked=appSettings.reducedMotion;
 document.body.classList.toggle('reduced-motion',appSettings.reducedMotion);
}
async function loadSettings(){
 const res=await FlecityBridge.call('profileGetSettings',{});
 if(res.ok)applySettings(res.settings);
}
async function saveSettings(){
 const res=await FlecityBridge.call('profileUpdateSettings',{sound:settingSound.checked,reducedMotion:settingMotion.checked});
 if(res.ok){applySettings(res.settings);tone(520,55);}else setStatus('設定を保存できません: '+FlecityErrors.text(res.error),'error');
}
settingSound.onchange=saveSettings;settingMotion.onchange=saveSettings;
function setStatus(text,type){statusEl.textContent=text;statusEl.className='status '+(type||'');if(type==='good'&&!/ready/i.test(String(text)))tone();}
function hideAll(){homeEl.classList.add('hidden');quickEl.classList.add('hidden');stopEl.classList.add('hidden');blockEl.classList.add('hidden');mergeEl.classList.add('hidden');minesEl.classList.add('hidden');stackEl.classList.add('hidden');nonogramEl.classList.add('hidden');}
function showHome(){
 clearTimeout(tapTimer);cancelAnimationFrame(stopRaf);cancelAnimationFrame(stackRaf);clearInterval(minesClock);clearInterval(nonogramClock);minesClock=null;nonogramClock=null;
 tapState='idle';tapSession=null;stopState='idle';stopSession=null;
 hideAll();homeEl.classList.remove('hidden');renderGames(bootstrapData&&bootstrapData.games);
}
function gameById(id){return (bootstrapData&&bootstrapData.games||[]).find(g=>g.id===id);}
function formatGameScore(game,value){
 const n=Number(value);if(!Number.isFinite(n))return '---';
 return game&&game.rankingOrder==='asc'?(n>=1000?(n/1000).toFixed(3)+' s':n.toFixed(3)+' ms'):String(n);
}
function formatDuration(ms){
 const total=Math.max(0,Math.floor(Number(ms)||0)),minutes=Math.floor(total/60000),hours=Math.floor(minutes/60);
 return hours>0?hours+'h '+(minutes%60)+'m':minutes+'m';
}
const categoryLabels={quick:'クイック',arcade:'アーケード',endless:'エンドレス',puzzle:'パズル'};
const achievementLabels={
 first_play:'FIRST PLAY · 初めてゲームをクリア',
 '100_games':'100 GAMES · 100回プレイ',
 lightning:'LIGHTNING · QUICK TAP 200ms以下',
 stack_master:'STACK MASTER · STACK 25段以上',
 block_master:'BLOCK MASTER · BLOCK 5,000点以上'
};
function renderPlatform(data){
 const stats=data&&data.statistics||{totalPlayCount:0,totalPlayTimeMs:0};statPlays.textContent=String(stats.totalPlayCount||0);statTime.textContent=formatDuration(stats.totalPlayTimeMs);
 achievementRows.innerHTML='';const achievements=data&&data.achievements||[];
 if(!achievements.length)achievementRows.innerHTML='<div class="muted">まだ実績はありません。</div>';
 achievements.forEach(a=>{const d=document.createElement('div'),left=document.createElement('span'),right=document.createElement('strong');d.className='player';left.textContent=String(achievementLabels[a.achievement_id]||a.achievement_id);right.textContent='✓';d.append(left,right);achievementRows.appendChild(d);});
 const daily=data&&data.daily;
 if(!daily){dailyCard.classList.add('hidden');return;}
 dailyCard.classList.remove('hidden');dailyGame.textContent=daily.game&&daily.game.name||daily.gameId;dailyDate.textContent=String(daily.date||'');
 const game=daily.game||gameById(daily.gameId);dailyBest.textContent=daily.best?'今日のベスト · '+formatGameScore(game,daily.best.score):'今日の記録はまだありません。';
 dailyRanking.innerHTML='';(daily.ranking||[]).slice(0,5).forEach((r,i)=>{const d=document.createElement('div'),left=document.createElement('span'),right=document.createElement('strong');d.className='player';left.textContent='#'+(i+1)+' '+String(r.display_name||'Player');right.textContent=formatGameScore(game,r.score);d.append(left,right);dailyRanking.appendChild(d);});
}
async function refreshPlatform(){
 const res=await FlecityBridge.call('playStatistics',{});if(!res.ok)return;
 bootstrapData.statistics=res.statistics;bootstrapData.achievements=res.achievements;bootstrapData.daily=res.daily;renderPlatform(res);
}
async function launchDaily(){
 const daily=bootstrapData&&bootstrapData.daily;if(!daily)return;
 if(daily.gameId==='quick_tap')showQuick(true);
 else if(daily.gameId==='stop')openStop(true);
 else if(daily.gameId==='block')openBlock(true,true);
 else if(daily.gameId==='mines')openMines(true,true);
 else if(daily.gameId==='nonogram')openNonogram(true,true);
}
dailyPlay.onclick=launchDaily;

function renderGames(games){
 gamesEl.innerHTML='';
 (games||[]).filter(g=>g.app==='play'&&g.enabled).forEach(game=>{
   const btn=document.createElement('button');btn.className='game';
   const hasSave=!!saves[game.id];
   btn.innerHTML='<span class="tag">'+(categoryLabels[game.category]||game.category)+'</span><strong>'+game.name+'</strong><span class="muted">'+(hasSave?'途中から再開できます · ':'')+game.description+'</span>';
   btn.onclick=()=>{
     if(game.id==='quick_tap')showQuick();
     else if(game.id==='stop')openStop();
     else if(game.id==='block')openBlock(false);
     else if(game.id==='merge')openMerge(false);
     else if(game.id==='mines')openMines(false);
     else if(game.id==='stack')openStack();
     else if(game.id==='nonogram')openNonogram(false);
   };
   gamesEl.appendChild(btn);
 });
}
function populateRankingGames(games){
 const current=rankingGame.value;rankingGame.innerHTML='';
 (games||[]).filter(g=>g.app==='play'&&g.enabled&&g.supportsRanking).forEach(g=>{const o=document.createElement('option');o.value=g.id;o.textContent=g.name;rankingGame.appendChild(o);});
 if([...rankingGame.options].some(o=>o.value===current))rankingGame.value=current;
}
async function loadRanking(){
 const gameId=rankingGame.value;if(!gameId)return;
 rankingLoad.disabled=true;rankingRows.innerHTML='<div class="muted">読み込み中…</div>';
 const res=await FlecityBridge.call('playRanking',{gameId,period:rankingPeriod.value});
 rankingLoad.disabled=false;rankingRows.innerHTML='';
 if(!res.ok){rankingRows.innerHTML='<div class="status error">ランキング取得失敗: '+FlecityErrors.text(res.error)+'</div>';return;}
 if(!(res.rows||[]).length){rankingRows.innerHTML='<div class="muted">まだ記録がありません。</div>';return;}
 const game=(bootstrapData&&bootstrapData.games||[]).find(g=>g.id===gameId);
 res.rows.forEach((r,i)=>{
   const d=document.createElement('div');d.className='player';
   const left=document.createElement('span'),right=document.createElement('strong');
   left.textContent='#'+(i+1)+' '+String(r.display_name||'Player');
   right.textContent=formatGameScore(game,r.score);
   d.append(left,right);rankingRows.appendChild(d);
 });
}
rankingLoad.onclick=loadRanking;
rankingGame.onchange=()=>{rankingRows.innerHTML='';};
rankingPeriod.onchange=()=>{rankingRows.innerHTML='';};
async function bootstrap(){
 const res=await FlecityBridge.call('playBootstrap',{});
 if(!res.ok){
   const transient=['PLAYER_NOT_READY','NUI_REQUEST_FAILED','PHONE_CALLBACK_FAILED','CALLBACK_FAILED','NUI_UNAVAILABLE'];
   if(transient.includes(res.error)){
     setStatus(res.error==='PLAYER_NOT_READY'?'キャラクター読み込み待ち…':'PLAYへ再接続中…','warn');
     setTimeout(bootstrap,1000);
     return;
   }
   setStatus('PLAYを読み込めません: '+FlecityErrors.text(res.error),'error');
   return;
 }
 bootstrapData=res;saves={};(res.saves||[]).forEach(s=>saves[s.game_id]=s);renderGames(res.games);populateRankingGames(res.games);renderPlatform(res);await loadSettings();setStatus('PLAY 準備完了 · v'+String(res.version||'unknown'),'good');
}

/* QUICK TAP */
function showQuick(daily=false){tapDaily=daily===true;hideAll();quickEl.classList.remove('hidden');tapMessage.textContent=tapDaily?'今日のチャレンジ':'準備OK?';tapButton.textContent='スタート';tapButton.disabled=false;tapState='idle';}
tapButton.onclick=async()=>{
 if(tapState==='waiting'){
   clearTimeout(tapTimer);tapState='idle';tapMessage.textContent='フライング!';tapButton.textContent='もう一度';
   if(tapSession)await FlecityBridge.call('playCancelSession',{sessionToken:tapSession.sessionToken});tapSession=null;return;
 }
 if(tapState==='shown'){
   const reaction=performance.now()-tapShownAt;tapState='submitting';tapButton.disabled=true;
   const duration=Math.max(0,Math.round(performance.now()-tapStartedAt));
   const res=await FlecityBridge.call('playSubmitScore',{sessionToken:tapSession.sessionToken,score:reaction,durationMs:duration});
   if(res.ok){tapMessage.textContent=Number(res.score).toFixed(3)+' ms';setStatus(res.daily?'デイリースコアを保存しました。':'スコアを保存しました。','good');await refreshPlatform();}
   else{tapMessage.textContent='保存できませんでした';setStatus('スコア拒否: '+FlecityErrors.text(res.error),'error');}
   tapState='idle';tapSession=null;tapButton.textContent='もう一度';tapButton.disabled=false;return;
 }
 if(tapState!=='idle')return;
 tapButton.disabled=true;const res=await FlecityBridge.call('playStartSession',{gameId:'quick_tap',daily:tapDaily});
 if(!res.ok){tapButton.disabled=false;setStatus('開始できません: '+FlecityErrors.text(res.error),'error');return;}
 tapSession=res;tapState='waiting';tapStartedAt=performance.now();tapMessage.textContent='待って';tapButton.textContent='待って…';tapButton.disabled=false;
 tapTimer=setTimeout(()=>{if(tapState!=='waiting')return;tapState='shown';tapShownAt=performance.now();tapMessage.textContent='タップ!';tapButton.textContent='タップ!';},Math.max(250,Number(res.challenge&&res.challenge.delayMs)||1500));
};
tapBack.onclick=async()=>{
 if(tapSession)await FlecityBridge.call('playCancelSession',{sessionToken:tapSession.sessionToken});
 clearTimeout(tapTimer);tapSession=null;showHome();
};

/* STOP */
function trianglePosition(elapsedMs,periodMs,phaseMs){
 const period=Math.max(400,Number(periodMs)||1800),cycle=(Math.max(0,Number(elapsedMs)||0)+(Number(phaseMs)||0))%period,half=period/2;
 return cycle<=half?(cycle/half)*100:((period-cycle)/half)*100;
}
function animateStop(){
 if(stopState!=='running'||!stopSession)return;
 const elapsed=performance.now()-stopStartedAt;
 stopMarker.style.left=trianglePosition(elapsed,stopSession.challenge.periodMs,stopSession.challenge.phaseMs)+'%';
 stopRaf=requestAnimationFrame(animateStop);
}
function openStop(daily=false){
 stopDaily=daily===true;hideAll();stopEl.classList.remove('hidden');stopState='idle';stopSession=null;stopMessage.textContent=stopDaily?'今日のチャレンジ':'準備OK?';stopButton.textContent='スタート';stopButton.disabled=false;stopMarker.style.left='0%';stopTarget.style.left='50%';
}
stopButton.onclick=async()=>{
 if(stopState==='running'){
   stopState='submitting';cancelAnimationFrame(stopRaf);stopButton.disabled=true;
   const actionMs=Math.max(0,Math.round(performance.now()-stopStartedAt));
   const res=await FlecityBridge.call('playSubmitScore',{sessionToken:stopSession.sessionToken,score:0,durationMs:actionMs,actionMs});
   if(res.ok){
     const distance=res.details&&Number(res.details.distancePct);
     stopMessage.textContent=String(res.score);
     setStatus((res.daily?'デイリー ':'')+'STOP! スコア '+res.score+(Number.isFinite(distance)?' / '+distance.toFixed(2)+'%':''),'good');await refreshPlatform();
   }else{stopMessage.textContent='保存できませんでした';setStatus('STOP! スコア拒否: '+FlecityErrors.text(res.error),'error');}
   stopSession=null;stopState='idle';stopButton.disabled=false;stopButton.textContent='もう一度';return;
 }
 if(stopState!=='idle')return;
 stopButton.disabled=true;
 const res=await FlecityBridge.call('playStartSession',{gameId:'stop',daily:stopDaily});
 if(!res.ok){stopButton.disabled=false;setStatus('STOP!を開始できません: '+FlecityErrors.text(res.error),'error');return;}
 stopSession=res;stopState='running';stopStartedAt=performance.now();
 stopTarget.style.left=String(Number(res.challenge&&res.challenge.targetPct)||50)+'%';
 stopMessage.textContent='STOP!';stopButton.textContent='STOP';stopButton.disabled=false;animateStop();
};
stopBack.onclick=async()=>{
 cancelAnimationFrame(stopRaf);
 if(stopSession)await FlecityBridge.call('playCancelSession',{sessionToken:stopSession.sessionToken});
 stopSession=null;stopState='idle';showHome();
};

/* BLOCK */
function emptyBoard(){return Array.from({length:8},()=>Array(8).fill(0));}
function blockRand(){
 let x=Math.floor(Number(block.rngState)||1);if(x<=0||x>=2147483647)x=1;
 x=(x*16807)%2147483647;block.rngState=x;return (x-1)/2147483646;
}
function newPiece(){return {shape:Math.floor(blockRand()*SHAPES.length)};}
function refillPieces(){block.pieces=[newPiece(),newPiece(),newPiece()];block.selected=0;}
function elapsedBlock(){return (block?block.elapsedBase:0)+(block?performance.now()-block.sessionStarted:0);}
function canPlace(piece,x,y){
 if(!piece)return false;
 for(const [dx,dy] of SHAPES[piece.shape]){const xx=x+dx,yy=y+dy;if(xx<0||xx>=8||yy<0||yy>=8||block.board[yy][xx])return false;}
 return true;
}
function anyFit(piece){for(let y=0;y<8;y++)for(let x=0;x<8;x++)if(canPlace(piece,x,y))return true;return false;}
function blockGameOver(){return block.pieces.filter(Boolean).every(p=>!anyFit(p));}
function clearLines(){
 const rows=[],cols=[];
 for(let y=0;y<8;y++)if(block.board[y].every(Boolean))rows.push(y);
 for(let x=0;x<8;x++){let full=true;for(let y=0;y<8;y++)if(!block.board[y][x]){full=false;break;}if(full)cols.push(x);}
 const unique=new Set();rows.forEach(y=>{for(let x=0;x<8;x++)unique.add(y+':'+x)});cols.forEach(x=>{for(let y=0;y<8;y++)unique.add(y+':'+x)});
 unique.forEach(k=>{const [y,x]=k.split(':').map(Number);block.board[y][x]=0;});
 const lines=rows.length+cols.length;
 if(lines>0){block.combo+=1;block.score+=Math.round(lines*100*(1+Math.min(block.combo,8)*0.2));}else block.combo=0;
}
async function persistBlock(){
 if(!block||block.finished||block.daily)return;
 const state={board:block.board,pieces:block.pieces,score:block.score,combo:block.combo,rngState:block.rngState,history:block.history};
 const elapsedMs=Math.round(elapsedBlock());
 const res=await FlecityBridge.call('playSave',{gameId:'block',sessionToken:block.sessionToken,state,score:block.score,elapsedMs});
 if(res.ok)saves.block={game_id:'block',state:res.state||state,score:Number(res.score??block.score),elapsed_ms:Number(res.elapsedMs??elapsedMs)};
}
function renderBlock(){
 blockScore.textContent=String(block.score);blockBoard.innerHTML='';
 for(let y=0;y<8;y++)for(let x=0;x<8;x++){
   const cell=document.createElement('button');cell.className='block-cell'+(block.board[y][x]?' filled':'');cell.disabled=!!block.board[y][x];
   cell.onclick=()=>placeBlock(x,y);blockBoard.appendChild(cell);
 }
 blockPieces.innerHTML='';
 block.pieces.forEach((p,i)=>{
   const b=document.createElement('button');b.className='piece'+(block.selected===i?' selected':'');b.disabled=!p;
   if(p){const mini=document.createElement('div');mini.className='mini-piece';for(const [x,y] of SHAPES[p.shape]){const d=document.createElement('span');d.style.gridColumn=String(x+1);d.style.gridRow=String(y+1);mini.appendChild(d);}b.appendChild(mini);}
   else b.textContent='USED';
   b.onclick=()=>{block.selected=i;renderBlock();};blockPieces.appendChild(b);
 });
}
async function openBlock(forceNew,daily=false){
 hideAll();blockEl.classList.remove('hidden');
 const saved=!forceNew&&!daily&&saves.block;
 const payload={gameId:'block',daily:daily===true};if(saved)payload.resume=true;
 const session=await FlecityBridge.call('playStartSession',payload);
 if(!session.ok){setStatus('BLOCKを開始できません: '+session.error,'error');showHome();return;}
 if(saved&&saved.state&&Array.isArray(saved.state.board)){
   block={board:saved.state.board,pieces:saved.state.pieces||[],score:Number(saved.state.score||saved.score||0),combo:Number(saved.state.combo||0),selected:0,
     rngState:Number(saved.state.rngState||session.seed),history:Array.isArray(saved.state.history)?saved.state.history:[],elapsedBase:Number(session.baseElapsedMs||0),sessionStarted:performance.now(),sessionToken:session.sessionToken,seed:session.seed,finished:false,daily:false};
   if(!block.pieces.length)refillPieces();setStatus('BLOCKを途中保存から再開しました。','good');
 }else{
   block={board:emptyBoard(),pieces:[],score:0,combo:0,selected:0,rngState:Number(session.seed)||1,history:[],elapsedBase:0,sessionStarted:performance.now(),sessionToken:session.sessionToken,seed:session.seed,finished:false,daily:session.daily===true};
   refillPieces();setStatus(block.daily?'デイリーBLOCK開始。':'新しいBLOCKを開始しました。','good');
 }
 renderBlock();
}
async function placeBlock(x,y){
 if(!block||block.finished)return;
 const slot=block.selected,piece=block.pieces[slot];
 if(!canPlace(piece,x,y)){setStatus('そこには置けません。','warn');return;}
 block.history.push([slot,x,y]);
 for(const [dx,dy] of SHAPES[piece.shape])block.board[y+dy][x+dx]=1;
 block.score+=SHAPES[piece.shape].length*10;block.pieces[slot]=null;clearLines();
 if(block.pieces.every(p=>!p))refillPieces();else{const next=block.pieces.findIndex(Boolean);if(next>=0)block.selected=next;}
 renderBlock();await persistBlock();
 if(blockGameOver()){setStatus('置けるピースがありません。ゲーム終了。','warn');await finishBlock();}
}
async function finishBlock(){
 if(!block||block.finished)return;
 block.finished=true;
 const res=await FlecityBridge.call('playSubmitScore',{sessionToken:block.sessionToken,score:block.score,durationMs:Math.round(elapsedBlock()),history:block.history});
 if(res.ok){if(!block.daily)delete saves.block;setStatus((res.daily?'デイリー ':'')+'BLOCKスコア保存: '+res.score,'good');await refreshPlatform();}
 else{block.finished=false;setStatus('BLOCKを終了できません: '+FlecityErrors.text(res.error),'error');}
}
blockBack.onclick=async()=>{
 await persistBlock();
 if(block&&!block.finished)await FlecityBridge.call('playCancelSession',{sessionToken:block.sessionToken});
 block=null;showHome();
};
blockNew.onclick=async()=>{
 const wasDaily=!!(block&&block.daily);
 if(block&&!block.finished)await FlecityBridge.call('playCancelSession',{sessionToken:block.sessionToken});
 if(!wasDaily){
   const reset=await FlecityBridge.call('playResetSave',{gameId:'block'});
   if(!reset.ok){setStatus('BLOCKの保存をリセットできません: '+reset.error,'error');return;}
   delete saves.block;
 }
 block=null;await openBlock(true,wasDaily);
};
blockFinish.onclick=finishBlock;

/* MERGE */
function emptyMergeBoard(){return Array.from({length:4},()=>Array(4).fill(0));}
function elapsedMerge(){return (merge?merge.elapsedBase:0)+(merge?performance.now()-merge.sessionStarted:0);}
function mergeRand(){
 let x=Math.floor(Number(merge.rngState)||1);if(x<=0||x>=2147483647)x=1;
 x=(x*16807)%2147483647;merge.rngState=x;return (x-1)/2147483646;
}
function spawnMergeTile(){
 const empty=[];for(let y=0;y<4;y++)for(let x=0;x<4;x++)if(!merge.board[y][x])empty.push([x,y]);
 if(!empty.length)return false;
 const spot=empty[Math.floor(mergeRand()*empty.length)],value=mergeRand()<0.9?2:4;merge.board[spot[1]][spot[0]]=value;return true;
}
function compressMergeLine(line){
 const values=line.filter(Boolean),out=[];
 for(let i=0;i<values.length;i++){
   if(i+1<values.length&&values[i]===values[i+1]){const v=values[i]*2;out.push(v);merge.score+=v;i++;}
   else out.push(values[i]);
 }
 while(out.length<4)out.push(0);return out;
}
function mergeGameOver(){
 for(let y=0;y<4;y++)for(let x=0;x<4;x++){
   const v=merge.board[y][x];if(v===0)return false;
   if(x<3&&merge.board[y][x+1]===v)return false;
   if(y<3&&merge.board[y+1][x]===v)return false;
 }
 return true;
}
function renderMerge(){
 mergeScore.textContent=String(merge.score);mergeBoard.innerHTML='';
 for(let y=0;y<4;y++)for(let x=0;x<4;x++){
   const d=document.createElement('div'),v=Number(merge.board[y][x]||0);d.className='merge-cell'+(v?' filled':'');d.textContent=v?String(v):'';mergeBoard.appendChild(d);
 }
}
async function persistMerge(){
 if(!merge||merge.finished)return;
 const state={board:merge.board,score:merge.score,moves:merge.moves,rngState:merge.rngState,history:merge.history};
 const elapsedMs=Math.round(elapsedMerge());
 const res=await FlecityBridge.call('playSave',{gameId:'merge',sessionToken:merge.sessionToken,state,score:merge.score,elapsedMs});
 if(res.ok)saves.merge={game_id:'merge',state:res.state||state,score:Number(res.score??merge.score),elapsed_ms:Number(res.elapsedMs??elapsedMs)};
}
async function openMerge(forceNew){
 hideAll();mergeEl.classList.remove('hidden');
 const saved=!forceNew&&saves.merge,payload={gameId:'merge'};if(saved)payload.resume=true;
 const session=await FlecityBridge.call('playStartSession',payload);
 if(!session.ok){setStatus('MERGEを開始できません: '+session.error,'error');showHome();return;}
 if(saved&&saved.state&&Array.isArray(saved.state.board)&&saved.state.board.length===4){
   merge={board:saved.state.board,score:Number(saved.state.score||saved.score||0),moves:Number(saved.state.moves||0),rngState:Number(saved.state.rngState||session.seed),
     history:Array.isArray(saved.state.history)?saved.state.history:[],elapsedBase:Number(session.baseElapsedMs||0),sessionStarted:performance.now(),sessionToken:session.sessionToken,seed:session.seed,finished:false};
   setStatus('MERGEを途中保存から再開しました。','good');
 }else{
   merge={board:emptyMergeBoard(),score:0,moves:0,rngState:Number(session.seed)||1,history:[],elapsedBase:0,sessionStarted:performance.now(),sessionToken:session.sessionToken,seed:session.seed,finished:false};
   spawnMergeTile();spawnMergeTile();setStatus('新しいMERGEを開始しました。','good');
 }
 renderMerge();
}
async function moveMerge(direction){
 if(!merge||merge.finished)return;
 const before=JSON.stringify(merge.board);
 if(direction==='left'||direction==='right'){
   for(let y=0;y<4;y++){
     let row=merge.board[y].slice();if(direction==='right')row.reverse();row=compressMergeLine(row);if(direction==='right')row.reverse();merge.board[y]=row;
   }
 }else{
   for(let x=0;x<4;x++){
     let col=[];for(let y=0;y<4;y++)col.push(merge.board[y][x]);if(direction==='down')col.reverse();col=compressMergeLine(col);if(direction==='down')col.reverse();for(let y=0;y<4;y++)merge.board[y][x]=col[y];
   }
 }
 if(before===JSON.stringify(merge.board)){setStatus('タイルを動かせませんでした。','warn');return;}
 merge.moves+=1;merge.history.push(direction);spawnMergeTile();renderMerge();await persistMerge();
 if(mergeGameOver()){setStatus('動かせる場所がありません。ゲーム終了。','warn');await finishMerge();}
}
async function finishMerge(){
 if(!merge||merge.finished)return;
 merge.finished=true;
 const res=await FlecityBridge.call('playSubmitScore',{sessionToken:merge.sessionToken,score:merge.score,durationMs:Math.round(elapsedMerge()),history:merge.history});
 if(res.ok){delete saves.merge;setStatus('MERGEスコア保存: '+res.score,'good');await refreshPlatform();}
 else{merge.finished=false;setStatus('MERGEを終了できません: '+FlecityErrors.text(res.error),'error');}
}
mergeBack.onclick=async()=>{
 await persistMerge();
 if(merge&&!merge.finished)await FlecityBridge.call('playCancelSession',{sessionToken:merge.sessionToken});
 merge=null;showHome();
};
mergeNew.onclick=async()=>{
 if(merge&&!merge.finished)await FlecityBridge.call('playCancelSession',{sessionToken:merge.sessionToken});
 const reset=await FlecityBridge.call('playResetSave',{gameId:'merge'});
 if(!reset.ok){setStatus('MERGEの保存をリセットできません: '+reset.error,'error');return;}
 delete saves.merge;merge=null;await openMerge(true);
};
mergeFinish.onclick=finishMerge;
mergeUp.onclick=()=>moveMerge('up');mergeDown.onclick=()=>moveMerge('down');mergeLeft.onclick=()=>moveMerge('left');mergeRight.onclick=()=>moveMerge('right');

/* MINES */
function seededMines(seed,size,mineCount){
 let state=Math.floor(Number(seed)||1)%2147483647;if(state<=0)state=1;
 const result=new Set(),total=size*size;
 while(result.size<mineCount){state=(state*16807)%2147483647;result.add((state-1)%total);}
 return result;
}
function elapsedMines(){return (mines?mines.elapsedBase:0)+(mines?performance.now()-mines.sessionStarted:0);}
function mineNeighbors(index){
 const out=[],x=index%mines.size,y=Math.floor(index/mines.size);
 for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
   if(!dx&&!dy)continue;const xx=x+dx,yy=y+dy;if(xx>=0&&xx<mines.size&&yy>=0&&yy<mines.size)out.push(yy*mines.size+xx);
 }
 return out;
}
function mineCountAround(index){let n=0;mineNeighbors(index).forEach(i=>{if(mines.mineSet.has(i))n++;});return n;}
function updateMinesTime(){if(mines)minesTime.textContent=(elapsedMines()/1000).toFixed(1)+'s';}
function renderMines(){
 if(!mines)return;minesBoard.innerHTML='';updateMinesTime();
 for(let i=0;i<mines.size*mines.size;i++){
   const b=document.createElement('button'),revealed=mines.revealed.has(i),flagged=mines.flags.has(i);
   b.className='mines-cell'+(revealed?' revealed':'')+(flagged?' flagged':'');
   if(mines.lost&&mines.mineSet.has(i))b.textContent='✹';
   else if(flagged)b.textContent='⚑';
   else if(revealed){const n=mineCountAround(i);b.textContent=n?String(n):'';}
   b.disabled=mines.finished||revealed;b.onclick=()=>touchMine(i);minesBoard.appendChild(b);
 }
 minesMode.textContent='モード: '+(mines.mode==='flag'?'旗':'開く');
}
async function persistMines(){
 if(!mines||mines.finished||mines.daily)return;
 const state={revealed:[...mines.revealed],flags:[...mines.flags],mode:mines.mode};
 const elapsedMs=Math.round(elapsedMines());
 const res=await FlecityBridge.call('playSave',{gameId:'mines',sessionToken:mines.sessionToken,state,score:elapsedMs,elapsedMs});
 if(res.ok)saves.mines={game_id:'mines',state:res.state||state,score:Number(res.score??res.elapsedMs??elapsedMs),elapsed_ms:Number(res.elapsedMs??elapsedMs)};
}
async function openMines(forceNew,daily=false){
 hideAll();minesEl.classList.remove('hidden');clearInterval(minesClock);
 const saved=!forceNew&&!daily&&saves.mines;
 const payload={gameId:'mines',daily:daily===true};if(saved)payload.resume=true;
 const session=await FlecityBridge.call('playStartSession',payload);
 if(!session.ok){setStatus('MINESを開始できません: '+session.error,'error');showHome();return;}
 const size=Number(session.challenge&&session.challenge.size)||8,mineCount=Number(session.challenge&&session.challenge.mines)||10;
 if(saved&&saved.state){
   mines={size,mineCount,seed:Number(session.seed),mineSet:null,revealed:new Set(saved.state.revealed||[]),flags:new Set(saved.state.flags||[]),mode:saved.state.mode==='flag'?'flag':'reveal',
     elapsedBase:Number(session.baseElapsedMs||0),sessionStarted:performance.now(),sessionToken:session.sessionToken,finished:false,lost:false,daily:false};
   setStatus('MINESを途中保存から再開しました。','good');
 }else{
   mines={size,mineCount,seed:Number(session.seed),mineSet:null,revealed:new Set(),flags:new Set(),mode:'reveal',elapsedBase:0,sessionStarted:performance.now(),sessionToken:session.sessionToken,finished:false,lost:false,daily:session.daily===true};
   setStatus(mines.daily?'デイリーMINES開始。':'新しいMINESを開始しました。','good');
 }
 mines.mineSet=seededMines(mines.seed,mines.size,mines.mineCount);renderMines();minesClock=setInterval(updateMinesTime,250);
}
async function loseMines(index){
 if(!mines||mines.finished)return;mines.finished=true;mines.lost=true;clearInterval(minesClock);renderMines();setStatus('地雷を踏みました。ゲーム終了。','warn');
 if(mines.sessionToken)await FlecityBridge.call('playCancelSession',{sessionToken:mines.sessionToken});
 if(!mines.daily){await FlecityBridge.call('playResetSave',{gameId:'mines'});delete saves.mines;}mines.sessionToken=null;
}
async function touchMine(index){
 if(!mines||mines.finished)return;
 if(mines.mode==='flag'){
   if(mines.flags.has(index))mines.flags.delete(index);else mines.flags.add(index);renderMines();await persistMines();return;
 }
 if(mines.flags.has(index))return;
 if(mines.mineSet.has(index)){await loseMines(index);return;}
 const queue=[index];
 while(queue.length){
   const current=queue.shift();if(mines.revealed.has(current)||mines.flags.has(current)||mines.mineSet.has(current))continue;
   mines.revealed.add(current);
   if(mineCountAround(current)===0)mineNeighbors(current).forEach(n=>{if(!mines.revealed.has(n))queue.push(n);});
 }
 renderMines();
 if(mines.revealed.size===mines.size*mines.size-mines.mineCount){await finishMines();return;}
 await persistMines();
}
async function finishMines(){
 if(!mines||mines.finished)return;
 mines.finished=true;clearInterval(minesClock);const durationMs=Math.round(elapsedMines());
 const res=await FlecityBridge.call('playSubmitScore',{sessionToken:mines.sessionToken,score:durationMs,durationMs,revealed:[...mines.revealed]});
 if(res.ok){if(!mines.daily)delete saves.mines;setStatus((res.daily?'デイリー ':'')+'MINESクリア: '+(Number(res.score)/1000).toFixed(2)+'s','good');mines.sessionToken=null;await refreshPlatform();}
 else{mines.finished=false;minesClock=setInterval(updateMinesTime,250);setStatus('MINESクリア判定失敗: '+FlecityErrors.text(res.error),'error');}
 renderMines();
}
minesMode.onclick=()=>{if(!mines||mines.finished)return;mines.mode=mines.mode==='flag'?'reveal':'flag';renderMines();};
minesBack.onclick=async()=>{
 clearInterval(minesClock);minesClock=null;
 if(mines&&!mines.finished){await persistMines();if(mines.sessionToken)await FlecityBridge.call('playCancelSession',{sessionToken:mines.sessionToken});}
 mines=null;showHome();
};
minesNew.onclick=async()=>{
 clearInterval(minesClock);minesClock=null;const wasDaily=!!(mines&&mines.daily);
 if(mines&&!mines.finished&&mines.sessionToken)await FlecityBridge.call('playCancelSession',{sessionToken:mines.sessionToken});
 if(!wasDaily){const reset=await FlecityBridge.call('playResetSave',{gameId:'mines'});if(!reset.ok){setStatus('MINESをリセットできません: '+reset.error,'error');return;}delete saves.mines;}
 mines=null;await openMines(true,wasDaily);
};

/* STACK */
function elapsedStack(){return stackGame?performance.now()-stackGame.startedAt:0;}
function renderStack(){
 if(!stackGame)return;stackScore.textContent=String(stackGame.score);
 stackArena.querySelectorAll('.stack-layer').forEach(n=>n.remove());
 const visible=stackGame.layers.slice(-10),history=visible.slice(0,-1);
 history.forEach((layer,i)=>{
   const d=document.createElement('div');d.className='stack-layer';d.style.left=layer.x+'%';d.style.width=layer.width+'%';d.style.bottom=(18+i*20)+'px';stackArena.insertBefore(d,stackMover);
 });
 const top=stackGame.layers[stackGame.layers.length-1];
 stackBase.style.left=top.x+'%';stackBase.style.width=top.width+'%';stackBase.style.bottom=(18+history.length*20)+'px';
 stackMover.style.left=stackGame.x+'%';stackMover.style.width=stackGame.width+'%';stackMover.style.bottom=(38+history.length*20)+'px';
}
function stackPosition(elapsedMs,width,speed,reverse){
 const w=Math.max(.1,Math.min(100,Number(width)||72)),max=Math.max(0,100-w);
 if(max<=0)return 0;
 const distance=(Math.max(0,Number(elapsedMs)||0)/1000)*Math.max(1,Number(speed)||65),period=max*2,cycle=distance%period;
 let x=cycle<=max?cycle:period-cycle;
 if(reverse)x=max-x;
 return x;
}
function stackLoop(now){
 if(!stackGame||stackGame.finished)return;
 stackGame.x=stackPosition(now-stackGame.layerStartedAt,stackGame.width,stackGame.speed,stackGame.reverse);
 renderStack();stackRaf=requestAnimationFrame(stackLoop);
}
async function openStack(){
 hideAll();stackEl.classList.remove('hidden');cancelAnimationFrame(stackRaf);
 const session=await FlecityBridge.call('playStartSession',{gameId:'stack'});
 if(!session.ok){setStatus('STACKを開始できません: '+session.error,'error');showHome();return;}
 const width=Number(session.challenge&&session.challenge.initialWidthPct)||72;
 const startedAt=performance.now();
 stackGame={sessionToken:session.sessionToken,startedAt,layerStartedAt:startedAt,layers:[{x:(100-width)/2,width}],x:0,width,score:0,speed:Number(session.challenge&&session.challenge.speedPctPerSec)||65,reverse:false,history:[],finished:false};
 stackDrop.disabled=false;stackDrop.textContent='DROP';setStatus('STACK開始。','good');renderStack();stackRaf=requestAnimationFrame(stackLoop);
}
async function finishStack(){
 if(!stackGame||stackGame.finished)return;stackGame.finished=true;cancelAnimationFrame(stackRaf);stackDrop.disabled=true;stackDrop.textContent='終了';
 const durationMs=Math.round(elapsedStack());
 const res=await FlecityBridge.call('playSubmitScore',{sessionToken:stackGame.sessionToken,score:stackGame.score,durationMs,history:stackGame.history});
 if(res.ok){setStatus('STACKスコア保存: '+res.score,'good');stackGame.sessionToken=null;await refreshPlatform();}
 else{setStatus('STACKスコア拒否: '+FlecityErrors.text(res.error),'error');}
}
stackDrop.onclick=async()=>{
 if(!stackGame||stackGame.finished)return;
 const now=performance.now(),previous=stackGame.history.length?stackGame.history[stackGame.history.length-1]:0;
 const actionMs=Math.max(previous+1,Math.round(now-stackGame.startedAt));
 stackGame.x=stackPosition(now-stackGame.layerStartedAt,stackGame.width,stackGame.speed,stackGame.reverse);
 stackGame.history.push(actionMs);
 const base=stackGame.layers[stackGame.layers.length-1],left=Math.max(base.x,stackGame.x),right=Math.min(base.x+base.width,stackGame.x+stackGame.width),overlap=right-left;
 if(overlap<=.0001){await finishStack();return;}
 stackGame.layers.push({x:left,width:overlap});
 stackGame.score+=1;
 stackGame.width=overlap;
 stackGame.speed=Math.min(180,stackGame.speed+4);
 stackGame.reverse=(stackGame.score%2)===1;
 stackGame.layerStartedAt=now;
 stackGame.x=stackPosition(0,stackGame.width,stackGame.speed,stackGame.reverse);
 renderStack();
};
stackBack.onclick=async()=>{cancelAnimationFrame(stackRaf);if(stackGame&&!stackGame.finished&&stackGame.sessionToken)await FlecityBridge.call('playCancelSession',{sessionToken:stackGame.sessionToken});stackGame=null;showHome();};
stackNew.onclick=async()=>{cancelAnimationFrame(stackRaf);if(stackGame&&!stackGame.finished&&stackGame.sessionToken)await FlecityBridge.call('playCancelSession',{sessionToken:stackGame.sessionToken});stackGame=null;await openStack();};

/* NONOGRAM */
function seededNonogram(seed,size){
 let state=Math.floor(Number(seed)||1)%2147483647;if(state<=0)state=1;
 const filled=new Set();
 for(let i=0;i<size*size;i++){state=(state*16807)%2147483647;if(((state-1)%100)<45)filled.add(i);}
 if(!filled.size)filled.add(0);return filled;
}
function nonogramClue(values){
 const groups=[],n=values.length;let run=0;
 for(let i=0;i<n;i++){if(values[i])run++;else if(run){groups.push(run);run=0;}}
 if(run)groups.push(run);return groups.length?groups.join(' '):'0';
}
function elapsedNonogram(){return (nonogram?nonogram.elapsedBase:0)+(nonogram?performance.now()-nonogram.startedAt:0);}
function updateNonogramTime(){if(nonogram)nonogramTime.textContent=(elapsedNonogram()/1000).toFixed(1)+'s';}
function renderNonogram(){
 if(!nonogram)return;nonogramBoard.innerHTML='';updateNonogramTime();
 const blank=document.createElement('div');blank.className='nonogram-clue';nonogramBoard.appendChild(blank);
 for(let x=0;x<nonogram.size;x++){
   const vals=[];for(let y=0;y<nonogram.size;y++)vals.push(nonogram.solution.has(y*nonogram.size+x));
   const clue=document.createElement('div');clue.className='nonogram-clue';clue.textContent=nonogramClue(vals);nonogramBoard.appendChild(clue);
 }
 for(let y=0;y<nonogram.size;y++){
   const vals=[];for(let x=0;x<nonogram.size;x++)vals.push(nonogram.solution.has(y*nonogram.size+x));
   const clue=document.createElement('div');clue.className='nonogram-clue';clue.textContent=nonogramClue(vals);nonogramBoard.appendChild(clue);
   for(let x=0;x<nonogram.size;x++){
     const index=y*nonogram.size+x,b=document.createElement('button');b.className='nonogram-cell'+(nonogram.filled.has(index)?' filled':'')+(nonogram.crossed.has(index)?' crossed':'');
     b.textContent=nonogram.crossed.has(index)?'×':'';b.disabled=nonogram.finished;b.onclick=()=>touchNonogram(index);nonogramBoard.appendChild(b);
   }
 }
}
async function persistNonogram(){
 if(!nonogram||nonogram.finished||nonogram.daily)return;const elapsedMs=Math.round(elapsedNonogram());
 const state={filled:[...nonogram.filled],crossed:[...nonogram.crossed]};
 const res=await FlecityBridge.call('playSave',{gameId:'nonogram',sessionToken:nonogram.sessionToken,state,score:elapsedMs,elapsedMs});
 if(res.ok)saves.nonogram={game_id:'nonogram',state:res.state||state,score:Number(res.score??res.elapsedMs??elapsedMs),elapsed_ms:Number(res.elapsedMs??elapsedMs)};
}
async function openNonogram(forceNew,daily=false){
 hideAll();nonogramEl.classList.remove('hidden');clearInterval(nonogramClock);
 const saved=!forceNew&&!daily&&saves.nonogram,payload={gameId:'nonogram',daily:daily===true};if(saved)payload.resume=true;
 const session=await FlecityBridge.call('playStartSession',payload);
 if(!session.ok){setStatus('NONOGRAMを開始できません: '+session.error,'error');showHome();return;}
 const size=Number(session.challenge&&session.challenge.size)||5,seed=Number(session.seed);
 nonogram={size,seed,solution:seededNonogram(seed,size),filled:new Set(saved&&saved.state?saved.state.filled||[]:[]),crossed:new Set(saved&&saved.state?saved.state.crossed||[]:[]),
   elapsedBase:Number(session.baseElapsedMs||0),startedAt:performance.now(),sessionToken:session.sessionToken,finished:false,daily:session.daily===true};
 setStatus(saved?'NONOGRAMを途中保存から再開しました。':(nonogram.daily?'デイリーNONOGRAM開始。':'新しいNONOGRAMを開始しました。'),'good');renderNonogram();nonogramClock=setInterval(updateNonogramTime,250);
}
async function touchNonogram(index){
 if(!nonogram||nonogram.finished)return;
 if(nonogram.filled.has(index)){nonogram.filled.delete(index);nonogram.crossed.add(index);}
 else if(nonogram.crossed.has(index)){nonogram.crossed.delete(index);}
 else nonogram.filled.add(index);
 renderNonogram();await persistNonogram();
}
nonogramCheck.onclick=async()=>{
 if(!nonogram||nonogram.finished)return;nonogramCheck.disabled=true;const durationMs=Math.round(elapsedNonogram());
 const res=await FlecityBridge.call('playSubmitScore',{sessionToken:nonogram.sessionToken,score:durationMs,durationMs,filled:[...nonogram.filled]});
 nonogramCheck.disabled=false;
 if(res.ok){nonogram.finished=true;clearInterval(nonogramClock);if(!nonogram.daily)delete saves.nonogram;setStatus((res.daily?'デイリー ':'')+'NONOGRAMクリア: '+(Number(res.score)/1000).toFixed(2)+'s','good');renderNonogram();await refreshPlatform();}
 else if(res.error==='INCORRECT_SOLUTION')setStatus('まだ正解ではありません。','warn');
 else setStatus('NONOGRAM判定失敗: '+FlecityErrors.text(res.error),'error');
};
nonogramBack.onclick=async()=>{clearInterval(nonogramClock);nonogramClock=null;if(nonogram&&!nonogram.finished){await persistNonogram();if(nonogram.sessionToken)await FlecityBridge.call('playCancelSession',{sessionToken:nonogram.sessionToken});}nonogram=null;showHome();};
nonogramNew.onclick=async()=>{clearInterval(nonogramClock);nonogramClock=null;const wasDaily=!!(nonogram&&nonogram.daily);if(nonogram&&!nonogram.finished&&nonogram.sessionToken)await FlecityBridge.call('playCancelSession',{sessionToken:nonogram.sessionToken});if(!wasDaily){const reset=await FlecityBridge.call('playResetSave',{gameId:'nonogram'});if(!reset.ok){setStatus('NONOGRAMをリセットできません: '+reset.error,'error');return;}delete saves.nonogram;}nonogram=null;await openNonogram(true,wasDaily);};

bootstrap();
