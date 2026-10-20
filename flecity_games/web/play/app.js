const statusEl=document.getElementById('status'),gamesEl=document.getElementById('games'),homeEl=document.getElementById('home');
const continueCard=document.getElementById('continueCard'),continueGames=document.getElementById('continueGames'),continueCount=document.getElementById('continueCount'),gameCount=document.getElementById('gameCount');
const rankingGame=document.getElementById('rankingGame'),rankingPeriod=document.getElementById('rankingPeriod'),rankingLoad=document.getElementById('rankingLoad'),rankingRows=document.getElementById('rankingRows');
const dailyCard=document.getElementById('dailyCard'),dailyGame=document.getElementById('dailyGame'),dailyDate=document.getElementById('dailyDate'),dailyPlay=document.getElementById('dailyPlay'),dailyBest=document.getElementById('dailyBest'),dailyRanking=document.getElementById('dailyRanking');
const statPlays=document.getElementById('statPlays'),statTime=document.getElementById('statTime'),gameStatRows=document.getElementById('gameStatRows'),achievementRows=document.getElementById('achievementRows');
const settingSound=document.getElementById('settingSound'),settingMotion=document.getElementById('settingMotion');
const confirmOverlay=document.getElementById('confirmOverlay'),confirmTitle=document.getElementById('confirmTitle'),confirmMessage=document.getElementById('confirmMessage'),confirmCancel=document.getElementById('confirmCancel'),confirmAccept=document.getElementById('confirmAccept');
const quickEl=document.getElementById('quickTap'),tapMessage=document.getElementById('tapMessage'),tapButton=document.getElementById('tapButton'),tapBack=document.getElementById('tapBack');
const stopEl=document.getElementById('stopGame'),stopMessage=document.getElementById('stopMessage'),stopButton=document.getElementById('stopButton'),stopBack=document.getElementById('stopBack'),stopTarget=document.getElementById('stopTarget'),stopMarker=document.getElementById('stopMarker');
const blockEl=document.getElementById('blockGame'),blockBoard=document.getElementById('blockBoard'),blockPieces=document.getElementById('blockPieces'),blockScore=document.getElementById('blockScore'),blockMeta=document.getElementById('blockMeta');
const blockBack=document.getElementById('blockBack'),blockNew=document.getElementById('blockNew'),blockFinish=document.getElementById('blockFinish');
const mergeEl=document.getElementById('mergeGame'),mergeBoard=document.getElementById('mergeBoard'),mergeScore=document.getElementById('mergeScore'),mergeMeta=document.getElementById('mergeMeta'),mergeBack=document.getElementById('mergeBack'),mergeNew=document.getElementById('mergeNew'),mergeFinish=document.getElementById('mergeFinish');
const mergeUp=document.getElementById('mergeUp'),mergeDown=document.getElementById('mergeDown'),mergeLeft=document.getElementById('mergeLeft'),mergeRight=document.getElementById('mergeRight');
const minesEl=document.getElementById('minesGame'),minesBoard=document.getElementById('minesBoard'),minesTime=document.getElementById('minesTime'),minesMeta=document.getElementById('minesMeta'),minesBack=document.getElementById('minesBack'),minesMode=document.getElementById('minesMode'),minesNew=document.getElementById('minesNew');
const stackEl=document.getElementById('stackGame'),stackArena=document.getElementById('stackArena'),stackBase=document.getElementById('stackBase'),stackMover=document.getElementById('stackMover'),stackScore=document.getElementById('stackScore'),stackMeta=document.getElementById('stackMeta'),stackBack=document.getElementById('stackBack'),stackDrop=document.getElementById('stackDrop'),stackNew=document.getElementById('stackNew');
const nonogramEl=document.getElementById('nonogramGame'),nonogramBoard=document.getElementById('nonogramBoard'),nonogramTime=document.getElementById('nonogramTime'),nonogramMeta=document.getElementById('nonogramMeta'),nonogramBack=document.getElementById('nonogramBack'),nonogramCheck=document.getElementById('nonogramCheck'),nonogramNew=document.getElementById('nonogramNew');
const memoryEl=document.getElementById('memoryGame'),memoryBoard=document.getElementById('memoryBoard'),memoryTime=document.getElementById('memoryTime'),memoryMeta=document.getElementById('memoryMeta'),memoryBack=document.getElementById('memoryBack'),memoryNew=document.getElementById('memoryNew');
const colorMatchEl=document.getElementById('colorMatchGame'),colorMatchProgress=document.getElementById('colorMatchProgress'),colorMatchTime=document.getElementById('colorMatchTime'),colorMatchWord=document.getElementById('colorMatchWord'),colorMatchChoices=document.getElementById('colorMatchChoices'),colorMatchBack=document.getElementById('colorMatchBack'),colorMatchStart=document.getElementById('colorMatchStart'),colorMatchNew=document.getElementById('colorMatchNew');
const numberRushEl=document.getElementById('numberRushGame'),numberRushBoard=document.getElementById('numberRushBoard'),numberRushProgress=document.getElementById('numberRushProgress'),numberRushTime=document.getElementById('numberRushTime'),numberRushMeta=document.getElementById('numberRushMeta'),numberRushBack=document.getElementById('numberRushBack'),numberRushStart=document.getElementById('numberRushStart'),numberRushNew=document.getElementById('numberRushNew');
const highLowEl=document.getElementById('highLowGame'),highLowCard=document.getElementById('highLowCard'),highLowStreak=document.getElementById('highLowStreak'),highLowMeta=document.getElementById('highLowMeta'),highLowBack=document.getElementById('highLowBack'),highLowStart=document.getElementById('highLowStart'),highLowNew=document.getElementById('highLowNew'),highLowHigher=document.getElementById('highLowHigher'),highLowLower=document.getElementById('highLowLower');
const simonEl=document.getElementById('simonGame'),simonBoard=document.getElementById('simonBoard'),simonRound=document.getElementById('simonRound'),simonMeta=document.getElementById('simonMeta'),simonMessage=document.getElementById('simonMessage'),simonBack=document.getElementById('simonBack'),simonStart=document.getElementById('simonStart'),simonNew=document.getElementById('simonNew'),simonPads=[...simonBoard.querySelectorAll('.simon-pad')];

let bootstrapData=null,saves={},appSettings={sound:true,reducedMotion:false},audioCtx=null;
let tapState='idle',tapShownAt=0,tapStartedAt=0,tapTimer=null,tapSession=null,tapDaily=false;
let stopState='idle',stopSession=null,stopStartedAt=0,stopRaf=null,stopDaily=false;
let block=null,merge=null,mines=null,minesClock=null,stackGame=null,stackRaf=null,nonogram=null,nonogramClock=null,memory=null,memoryClock=null,memoryFlipTimer=null,colorMatch=null,colorMatchClock=null,numberRush=null,numberRushClock=null,highLow=null,simon=null,simonTimer=null,mergePointer=null;

const SHAPES=[
 [[0,0]],[[0,0],[1,0]],[[0,0],[1,0],[2,0]],[[0,0],[0,1]],[[0,0],[0,1],[0,2]],
 [[0,0],[1,0],[0,1],[1,1]],[[0,0],[0,1],[1,1]],[[1,0],[0,1],[1,1]],[[0,0],[1,0],[2,0],[1,1]]
];

function tone(freq=660,duration=70){
 if(!appSettings.sound)return;
 try{
   audioCtx=audioCtx||new (window.AudioContext||window.webkitAudioContext)();
   if(audioCtx.state==='suspended')audioCtx.resume().catch(()=>{});
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
let statusTimer=null;
function setStatus(text,type){
 clearTimeout(statusTimer);statusTimer=null;
 statusEl.classList.remove('hidden');statusEl.textContent=text;statusEl.className='status app-status '+(type||'');
 if(type==='good'&&!/(ready|準備完了)/i.test(String(text)))tone();
 if(type==='good'){
   const linger=/NEW BEST|実績解除/.test(String(text))?3600:1800;
   statusTimer=setTimeout(()=>statusEl.classList.add('hidden'),linger);
 }else if(type==='warn'){
   statusTimer=setTimeout(()=>statusEl.classList.add('hidden'),2600);
 }
}
let confirmResolver=null;
function closeConfirm(value){
 if(!confirmResolver)return;
 const resolve=confirmResolver;confirmResolver=null;confirmOverlay.classList.add('hidden');resolve(value===true);
}
function confirmAction(title,message,acceptLabel='続ける'){
 if(confirmResolver)closeConfirm(false);
 confirmTitle.textContent=String(title||'確認');
 confirmMessage.textContent=String(message||'');
 confirmAccept.textContent=String(acceptLabel||'続ける');
 confirmOverlay.classList.remove('hidden');
 return new Promise(resolve=>{confirmResolver=resolve;});
}
confirmCancel.onclick=()=>closeConfirm(false);
confirmAccept.onclick=()=>closeConfirm(true);
confirmOverlay.onclick=event=>{if(event.target===confirmOverlay)closeConfirm(false);};
window.addEventListener('keydown',event=>{if(event.key==='Escape'&&confirmResolver)closeConfirm(false);});

function sleep(ms){return new Promise(resolve=>setTimeout(resolve,ms));}
let saveQueue=Promise.resolve();
async function performSaveWithRetry(payload){
 let res=await FlecityBridge.call('playSave',payload);
 if(!res.ok&&['RATE_LIMIT','NUI_REQUEST_FAILED','PHONE_CALLBACK_FAILED','CALLBACK_FAILED'].includes(res.error)){
   await sleep(res.error==='RATE_LIMIT'?300:180);
   res=await FlecityBridge.call('playSave',payload);
 }
 return res;
}
function saveWithRetry(payload){
 const snapshot=JSON.parse(JSON.stringify(payload));
 const task=saveQueue.then(()=>performSaveWithRetry(snapshot));
 saveQueue=task.catch(()=>{});
 return task;
}
async function submitScoreWithRetry(payload){
 const snapshot=JSON.parse(JSON.stringify(payload));
 const retryable=new Set(['RATE_LIMIT','NUI_REQUEST_FAILED','PHONE_CALLBACK_FAILED','CALLBACK_FAILED','EMPTY_RESPONSE','SCORE_SAVE_FAILED','SERVER_ERROR']);
 let res={ok:false,error:'EMPTY_RESPONSE'};
 for(let attempt=0;attempt<3;attempt++){
   res=await FlecityBridge.call('playSubmitScore',snapshot);
   if(res.ok||!retryable.has(res.error))return res;
   if(attempt<2)await sleep(res.error==='RATE_LIMIT'?800:(res.error==='SCORE_SAVE_FAILED'?600:240)*(attempt+1));
 }
 return res;
}
function scrollAppTop(){window.scrollTo({top:0,behavior:appSettings.reducedMotion?'auto':'smooth'});}
function hideAll(){homeEl.classList.add('hidden');quickEl.classList.add('hidden');stopEl.classList.add('hidden');blockEl.classList.add('hidden');mergeEl.classList.add('hidden');minesEl.classList.add('hidden');stackEl.classList.add('hidden');nonogramEl.classList.add('hidden');memoryEl.classList.add('hidden');colorMatchEl.classList.add('hidden');numberRushEl.classList.add('hidden');highLowEl.classList.add('hidden');simonEl.classList.add('hidden');scrollAppTop();}
function showHome(){
 clearTimeout(tapTimer);clearTimeout(memoryFlipTimer);clearTimeout(simonTimer);cancelAnimationFrame(stopRaf);cancelAnimationFrame(stackRaf);clearInterval(minesClock);clearInterval(nonogramClock);clearInterval(memoryClock);clearInterval(colorMatchClock);clearInterval(numberRushClock);minesClock=null;nonogramClock=null;memoryClock=null;colorMatchClock=null;numberRushClock=null;memoryFlipTimer=null;simonTimer=null;
 tapState='idle';tapSession=null;stopState='idle';stopSession=null;
 hideAll();homeEl.classList.remove('hidden');renderGames(bootstrapData&&bootstrapData.games);
}
function gameById(id){return (bootstrapData&&bootstrapData.games||[]).find(g=>g.id===id);}
function formatGameScore(game,value){
 const n=Number(value);if(!Number.isFinite(n))return '---';
 return game&&game.rankingOrder==='asc'?(n>=1000?(n/1000).toFixed(3)+' s':n.toFixed(3)+' ms'):String(n);
}
function formatDuration(ms){
 const total=Math.max(0,Math.floor(Number(ms)||0)),seconds=Math.floor(total/1000),minutes=Math.floor(seconds/60),hours=Math.floor(minutes/60);
 if(hours>0)return hours+'h '+(minutes%60)+'m';
 if(minutes>0)return minutes+'m '+(seconds%60)+'s';
 return seconds+'s';
}
const categoryLabels={quick:'クイック',arcade:'アーケード',endless:'エンドレス',puzzle:'パズル'};
const categoryOrder=['quick','arcade','endless','puzzle'];
const achievementLabels={
 first_play:'FIRST PLAY · 初めてゲームをクリア',
 '100_games':'100 GAMES · 100回プレイ',
 lightning:'LIGHTNING · QUICK TAP 200ms以下',
 stack_master:'STACK MASTER · STACK 25段以上',
 block_master:'BLOCK MASTER · BLOCK 5,000点以上',
 perfect_memory:'PERFECT MEMORY · MEMORYを8手でクリア',
 number_rush_ace:'NUMBER ACE · NUMBER RUSHをノーミス12秒以内',
 high_low_streak:'HIGH ROLLER · HIGH & LOW 10連勝',
 bullseye:'BULLSEYE · STOP! 990点以上',
 merge_master:'MERGE MASTER · 2048タイル到達',
 mines_sprinter:'MINES SPRINTER · 60秒以内クリア',
 nonogram_solver:'LOGIC SOLVER · NONOGRAM 60秒以内',
 color_focus:'COLOR FOCUS · COLOR MATCH 6秒以内',
 simon_master:'SIMON MASTER · 15ラウンド到達'
};
function scoreBeatsPrevious(gameId,score,daily){
 const game=gameById(gameId);if(!game)return false;
 const previous=daily?(bootstrapData&&bootstrapData.daily&&bootstrapData.daily.selfBest):(bootstrapData&&bootstrapData.best&&bootstrapData.best[gameId]);
 if(!previous||!Number.isFinite(Number(previous.score)))return true;
 const current=Number(score),old=Number(previous.score);
 return game.rankingOrder==='asc'?current<old:current>old;
}
function showScoreResult(gameId,res,message){
 const parts=[];
 if(scoreBeatsPrevious(gameId,res.score,res.daily===true))parts.push('NEW BEST');
 parts.push(String(message||'記録を保存しました。'));
 const unlocked=Array.isArray(res.unlocked)?res.unlocked:[];
 if(unlocked.length){
   const labels=unlocked.map(id=>String(achievementLabels[id]||id).split(' · ')[0]);
   parts.push('実績解除: '+labels.join(', '));
 }
 setStatus(parts.join(' · '),'good');
}
function renderPlatform(data){
 const stats=data&&data.statistics||{totalPlayCount:0,totalPlayTimeMs:0,games:[]};statPlays.textContent=String(stats.totalPlayCount||0);statTime.textContent=formatDuration(stats.totalPlayTimeMs);
 gameStatRows.innerHTML='';
 const gameStats=Array.isArray(stats.games)?stats.games:[];
 if(!gameStats.length)gameStatRows.innerHTML='<div class="muted">まだゲーム記録はありません。</div>';
 gameStats.forEach(stat=>{
   const game=gameById(stat.gameId);if(!game)return;
   const row=document.createElement('div'),left=document.createElement('span'),right=document.createElement('strong');
   row.className='player game-stat-row';
   left.textContent=String(game.name||stat.gameId)+' · '+String(stat.playCount||0)+'回 · '+formatDuration(stat.totalPlayTimeMs||0);
   right.textContent=formatGameScore(game,stat.bestScore);
   row.append(left,right);gameStatRows.appendChild(row);
 });
 achievementRows.innerHTML='';const achievements=data&&data.achievements||[];
 if(!achievements.length)achievementRows.innerHTML='<div class="muted">まだ実績はありません。</div>';
 achievements.forEach(a=>{const d=document.createElement('div'),left=document.createElement('span'),right=document.createElement('strong');d.className='player';left.textContent=String(achievementLabels[a.achievement_id]||a.achievement_id);right.textContent='✓';d.append(left,right);achievementRows.appendChild(d);});
 const daily=data&&data.daily;
 if(!daily){dailyCard.classList.add('hidden');return;}
 dailyCard.classList.remove('hidden');dailyGame.textContent=daily.game&&daily.game.name||daily.gameId;dailyDate.textContent=String(daily.date||'');
 const game=daily.game||gameById(daily.gameId);dailyBest.textContent=daily.selfBest?'あなたの今日BEST · '+formatGameScore(game,daily.selfBest.score):'今日はまだ挑戦していません。';
 dailyRanking.innerHTML='';(daily.ranking||[]).slice(0,5).forEach((r,i)=>{const d=document.createElement('div'),left=document.createElement('span'),right=document.createElement('strong');d.className='player';left.textContent='#'+(i+1)+' '+String(r.display_name||'Player');right.textContent=formatGameScore(game,r.score);d.append(left,right);dailyRanking.appendChild(d);});
}
async function refreshPlatform(){
 const res=await FlecityBridge.call('playStatistics',{});if(!res.ok)return;
 bootstrapData.statistics=res.statistics;bootstrapData.achievements=res.achievements;bootstrapData.daily=res.daily;bootstrapData.best=res.best||bootstrapData.best||{};renderPlatform(res);renderGames(bootstrapData.games);
}
async function launchDaily(){
 const daily=bootstrapData&&bootstrapData.daily;if(!daily)return;
 if(daily.gameId==='quick_tap')showQuick(true);
 else if(daily.gameId==='stop')openStop(true);
 else if(daily.gameId==='block')openBlock(true,true);
 else if(daily.gameId==='mines')openMines(true,true);
 else if(daily.gameId==='nonogram')openNonogram(true,true);
 else if(daily.gameId==='memory')openMemory(true);
 else if(daily.gameId==='number_rush')openNumberRush(true);
}
dailyPlay.onclick=launchDaily;

function launchGame(gameId){
 if(gameId==='quick_tap')showQuick();
 else if(gameId==='stop')openStop();
 else if(gameId==='block')openBlock(false);
 else if(gameId==='merge')openMerge(false);
 else if(gameId==='mines')openMines(false);
 else if(gameId==='stack')openStack();
 else if(gameId==='nonogram')openNonogram(false);
 else if(gameId==='memory')openMemory();
 else if(gameId==='color_match')openColorMatch();
 else if(gameId==='number_rush')openNumberRush(false);
 else if(gameId==='high_low')openHighLow();
 else if(gameId==='simon')openSimon();
}
function renderContinue(games){
 const resumable=(games||[]).filter(game=>game.app==='play'&&game.enabled&&saves[game.id]);
 continueGames.innerHTML='';continueCount.textContent=String(resumable.length);
 continueCard.classList.toggle('hidden',resumable.length===0);
 resumable.forEach(game=>{
   const button=document.createElement('button');button.className='continue-game';
   const text=document.createElement('span'),meta=document.createElement('span');
   text.textContent=String(game.name||game.id);meta.className='muted';
   const save=saves[game.id]||{};
   meta.textContent=(Number(save.elapsed_ms)>0?formatDuration(save.elapsed_ms)+' · ':'')+'続きから';
   button.append(text,meta);button.onclick=()=>launchGame(game.id);continueGames.appendChild(button);
 });
}
function renderGames(games){
 gamesEl.innerHTML='';
 const enabled=(games||[]).filter(g=>g.app==='play'&&g.enabled);
 gameCount.textContent=String(enabled.length);
 renderContinue(enabled);
 const groups=new Map();
 enabled.forEach(game=>{
   const category=String(game.category||'other');
   if(!groups.has(category))groups.set(category,[]);
   groups.get(category).push(game);
 });
 const ordered=[...categoryOrder.filter(key=>groups.has(key)),...([...groups.keys()].filter(key=>!categoryOrder.includes(key)))];
 ordered.forEach(category=>{
   const section=document.createElement('section');section.className='game-category';
   const head=document.createElement('div');head.className='category-head';
   const title=document.createElement('strong');title.textContent=categoryLabels[category]||category.toUpperCase();
   const count=document.createElement('span');count.className='muted';count.textContent=String(groups.get(category).length)+' GAMES';
   head.append(title,count);
   const grid=document.createElement('div');grid.className='grid';
   groups.get(category).forEach(game=>{
     const btn=document.createElement('button');btn.className='game';
     const hasSave=!!saves[game.id];
     const tag=document.createElement('span'),name=document.createElement('strong'),description=document.createElement('span'),bestLine=document.createElement('span'),meta=document.createElement('span');
     tag.className='tag';description.className='muted';bestLine.className='game-best';meta.className='game-card-meta';
     tag.textContent=hasSave?'CONTINUE':(game.supportsDaily?'DAILY':'PLAY');
     name.textContent=String(game.name||game.id||'GAME');
     description.textContent=String(game.description||'');
     const personalBest=bootstrapData&&bootstrapData.best&&bootstrapData.best[game.id];
     bestLine.textContent=game.supportsRanking?(personalBest?'BEST · '+formatGameScore(game,personalBest.score):'BEST · ---'):'';
     const traits=[];if(game.supportsRanking)traits.push('RANK');if(game.supportsResume)traits.push('SAVE');
     meta.textContent=traits.join(' · ');
     btn.append(tag,name,description,bestLine,meta);btn.onclick=()=>launchGame(game.id);grid.appendChild(btn);
   });
   section.append(head,grid);gamesEl.appendChild(section);
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
 const bridge=await FlecityBridge.call('bridgePing',{});
 if(!bridge.ok){
   setStatus('LB Phoneへ再接続中…','warn');
   setTimeout(bootstrap,1000);
   return;
 }
 const res=await FlecityBridge.call('playBootstrap',{});
 if(!res.ok){
   const transient=['PLAYER_NOT_READY','NUI_REQUEST_FAILED','PHONE_CALLBACK_FAILED','CALLBACK_FAILED','NUI_UNAVAILABLE'];
   if(transient.includes(res.error)){
     setStatus(res.error==='PLAYER_NOT_READY'?'キャラクター読み込み待ち…':'PLAYへ再接続中…','warn');
     setTimeout(bootstrap,1000);
     return;
   }
   console.error('[PLAY] bootstrap failed',res.error);
   setStatus('PLAYを起動できませんでした。アプリを開き直してもう一度お試しください。','error');
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
   const res=await submitScoreWithRetry({sessionToken:tapSession.sessionToken,score:reaction,durationMs:duration});
   if(res.ok){tapMessage.textContent=Number(res.score).toFixed(3)+' ms';showScoreResult('quick_tap',res,(res.daily?'デイリー · ':'')+Number(res.score).toFixed(3)+' ms');await refreshPlatform();}
   else{tapMessage.textContent='保存できませんでした';await cancelPlaySession(tapSession&&tapSession.sessionToken);setStatus('スコアを保存できませんでした: '+FlecityErrors.text(res.error),'error');}
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
   const res=await submitScoreWithRetry({sessionToken:stopSession.sessionToken,score:0,durationMs:actionMs,actionMs});
   if(res.ok){
     const distance=res.details&&Number(res.details.distancePct);
     stopMessage.textContent=String(res.score);
     showScoreResult('stop',res,(res.daily?'デイリー · ':'')+'STOP! '+res.score+(Number.isFinite(distance)?' / '+distance.toFixed(2)+'%':''));await refreshPlatform();
   }else{stopMessage.textContent='保存できませんでした';await cancelPlaySession(stopSession&&stopSession.sessionToken);setStatus('STOP! スコアを保存できませんでした: '+FlecityErrors.text(res.error),'error');}
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
async function persistBlock(showError=false){
 if(!block||block.finished||block.daily)return true;
 const state={board:block.board,pieces:block.pieces,score:block.score,combo:block.combo,rngState:block.rngState,history:block.history};
 const elapsedMs=Math.round(elapsedBlock());
 const res=await saveWithRetry({gameId:'block',sessionToken:block.sessionToken,state,score:block.score,elapsedMs});
 if(res.ok){
   const canonical=res.state||state;
   saves.block={game_id:'block',state:canonical,score:Number(res.score??block.score),elapsed_ms:Number(res.elapsedMs??elapsedMs)};
   return true;
 }
 if(showError)setStatus('BLOCKの保存に失敗しました: '+FlecityErrors.text(res.error),'error');
 return false;
}
function renderBlock(){
 const selectedPiece=block.pieces[block.selected]||null;
 blockScore.textContent=String(block.score);
 blockMeta.textContent='COMBO '+String(block.combo)+' · '+String(block.pieces.filter(Boolean).length)+'/3 PIECES';
 blockBoard.innerHTML='';
 for(let y=0;y<8;y++)for(let x=0;x<8;x++){
   const cell=document.createElement('button');
   const valid=!block.board[y][x]&&selectedPiece&&canPlace(selectedPiece,x,y);
   cell.className='block-cell'+(block.board[y][x]?' filled':'')+(valid?' valid-origin':'');
   cell.disabled=!!block.board[y][x];
   cell.setAttribute('aria-label',valid?'ここに置けます':'マス');
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
 const res=await submitScoreWithRetry({sessionToken:block.sessionToken,score:block.score,durationMs:Math.round(elapsedBlock()),history:block.history});
 if(res.ok){if(!block.daily)delete saves.block;showScoreResult('block',res,(res.daily?'デイリー · ':'')+'BLOCK '+res.score+'点');await refreshPlatform();}
 else{block.finished=false;setStatus('BLOCKを終了できません: '+FlecityErrors.text(res.error),'error');}
}
blockBack.onclick=async()=>{
 if(block&&!block.finished&&!block.daily){
   const saved=await persistBlock(true);
   if(!saved)return;
 }
 if(block&&!block.finished&&block.sessionToken)await FlecityBridge.call('playCancelSession',{sessionToken:block.sessionToken});
 block=null;showHome();
};
blockNew.onclick=async()=>{
 if(blockNew.disabled)return;
 const wasDaily=!!(block&&block.daily);
 if(!wasDaily){
   const ok=await confirmAction('BLOCKを新しく始めますか？','現在の途中保存は削除されます。','新しく始める');
   if(!ok)return;
 }
 blockNew.disabled=true;
 try{
   if(wasDaily){
     if(block&&!block.finished&&block.sessionToken)await FlecityBridge.call('playCancelSession',{sessionToken:block.sessionToken});
   }else{
     await saveQueue.catch(()=>{});
     const reset=await FlecityBridge.call('playResetSave',{gameId:'block'});
     if(!reset.ok){setStatus('BLOCKの保存をリセットできません: '+FlecityErrors.text(reset.error),'error');return;}
     delete saves.block;
   }
   block=null;await openBlock(true,wasDaily);
 }finally{blockNew.disabled=false;}
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
 mergeScore.textContent=String(merge.score);
 let maxTile=0;
 mergeBoard.innerHTML='';
 for(let y=0;y<4;y++)for(let x=0;x<4;x++){
   const d=document.createElement('div'),v=Number(merge.board[y][x]||0);
   if(v>maxTile)maxTile=v;
   d.className='merge-cell'+(v?' filled':'');d.textContent=v?String(v):'';mergeBoard.appendChild(d);
 }
 mergeMeta.textContent=String(merge.moves)+' MOVES · MAX '+String(maxTile);
}
async function persistMerge(showError=false){
 if(!merge||merge.finished)return true;
 const state={board:merge.board,score:merge.score,moves:merge.moves,rngState:merge.rngState,history:merge.history};
 const elapsedMs=Math.round(elapsedMerge());
 const res=await saveWithRetry({gameId:'merge',sessionToken:merge.sessionToken,state,score:merge.score,elapsedMs});
 if(res.ok){
   const canonical=res.state||state;
   saves.merge={game_id:'merge',state:canonical,score:Number(res.score??merge.score),elapsed_ms:Number(res.elapsedMs??elapsedMs)};
   return true;
 }
 if(showError)setStatus('MERGEの保存に失敗しました: '+FlecityErrors.text(res.error),'error');
 return false;
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
 const res=await submitScoreWithRetry({sessionToken:merge.sessionToken,score:merge.score,durationMs:Math.round(elapsedMerge()),history:merge.history});
 if(res.ok){delete saves.merge;showScoreResult('merge',res,'MERGE '+res.score+'点');await refreshPlatform();}
 else{merge.finished=false;setStatus('MERGEを終了できません: '+FlecityErrors.text(res.error),'error');}
}
mergeBack.onclick=async()=>{
 if(merge&&!merge.finished){
   const saved=await persistMerge(true);
   if(!saved)return;
 }
 if(merge&&!merge.finished&&merge.sessionToken)await FlecityBridge.call('playCancelSession',{sessionToken:merge.sessionToken});
 merge=null;showHome();
};
mergeNew.onclick=async()=>{
 if(mergeNew.disabled)return;
 const ok=await confirmAction('MERGEを新しく始めますか？','現在の途中保存は削除されます。','新しく始める');
 if(!ok)return;
 mergeNew.disabled=true;
 try{
   await saveQueue.catch(()=>{});
   const reset=await FlecityBridge.call('playResetSave',{gameId:'merge'});
   if(!reset.ok){setStatus('MERGEの保存をリセットできません: '+FlecityErrors.text(reset.error),'error');return;}
   delete saves.merge;merge=null;await openMerge(true);
 }finally{mergeNew.disabled=false;}
};
mergeFinish.onclick=finishMerge;
mergeUp.onclick=()=>moveMerge('up');mergeDown.onclick=()=>moveMerge('down');mergeLeft.onclick=()=>moveMerge('left');mergeRight.onclick=()=>moveMerge('right');

function mergePointerPoint(event){return {x:Number(event.clientX)||0,y:Number(event.clientY)||0};}
mergeBoard.onpointerdown=event=>{
 if(!merge||merge.finished)return;
 mergePointer={...mergePointerPoint(event),id:event.pointerId};
 try{mergeBoard.setPointerCapture(event.pointerId);}catch(_){}
};
mergeBoard.onpointerup=event=>{
 if(!mergePointer||mergePointer.id!==event.pointerId)return;
 const end=mergePointerPoint(event),dx=end.x-mergePointer.x,dy=end.y-mergePointer.y;
 mergePointer=null;
 try{mergeBoard.releasePointerCapture(event.pointerId);}catch(_){}
 if(Math.max(Math.abs(dx),Math.abs(dy))<24)return;
 moveMerge(Math.abs(dx)>Math.abs(dy)?(dx>0?'right':'left'):(dy>0?'down':'up'));
};
mergeBoard.onpointercancel=event=>{
 if(mergePointer&&mergePointer.id===event.pointerId)mergePointer=null;
 try{mergeBoard.releasePointerCapture(event.pointerId);}catch(_){}
};

/* MINES */
function seededMines(seed,size,mineCount,avoidIndex=null){
 let state=Math.floor(Number(seed)||1)%2147483647;if(state<=0)state=1;
 const result=new Set(),total=size*size,avoid=Number.isInteger(Number(avoidIndex))?Number(avoidIndex):null;
 while(result.size<mineCount){
   state=(state*16807)%2147483647;
   const index=(state-1)%total;
   if(index!==avoid)result.add(index);
 }
 return result;
}
function elapsedMines(){return (mines?mines.elapsedBase:0)+(mines&&mines.timingStarted?performance.now()-mines.timingStartedAt:0);}
async function activateMinesTiming(firstIndex=null){
 if(!mines||mines.finished)return false;
 const wantsSafeIndex=!mines.daily&&mines.avoidIndex==null&&Number.isInteger(Number(firstIndex));
 if(mines.timingStarted&&!wantsSafeIndex)return true;
 if(mines.timingActivating)return false;
 mines.timingActivating=true;
 try{
   const payload={sessionToken:mines.sessionToken};
   if(wantsSafeIndex)payload.firstIndex=Number(firstIndex);
   const res=await FlecityBridge.call('playActivateSession',payload);
   if(!res.ok){setStatus('MINESのタイマーを開始できません: '+FlecityErrors.text(res.error),'error');return false;}
   mines.elapsedBase=Number(res.elapsedMs??mines.elapsedBase)||0;
   if(Number.isInteger(Number(res.avoidIndex))){
     mines.avoidIndex=Number(res.avoidIndex);
     mines.mineSet=seededMines(mines.seed,mines.size,mines.mineCount,mines.avoidIndex);
   }
   if(!mines.timingStarted){mines.timingStarted=true;mines.timingStartedAt=performance.now();}
   return true;
 }finally{if(mines)mines.timingActivating=false;}
}
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
 const safeTotal=mines.size*mines.size-mines.mineCount;
 minesMeta.textContent='地雷 '+String(mines.mineCount)+' · FLAG '+String(mines.flags.size)+' · OPEN '+String(mines.revealed.size)+'/'+String(safeTotal);
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
async function persistMines(showError=false){
 if(!mines||mines.finished||mines.daily)return true;
 const state={revealed:[...mines.revealed],flags:[...mines.flags],mode:mines.mode,avoidIndex:mines.avoidIndex};
 const elapsedMs=Math.round(elapsedMines());
 const res=await saveWithRetry({gameId:'mines',sessionToken:mines.sessionToken,state,score:elapsedMs,elapsedMs});
 if(res.ok){
   const canonical=res.state||state;
   saves.mines={game_id:'mines',state:canonical,score:Number(res.score??res.elapsedMs??elapsedMs),elapsed_ms:Number(res.elapsedMs??elapsedMs)};
   return true;
 }
 if(showError)setStatus('MINESの保存に失敗しました: '+FlecityErrors.text(res.error),'error');
 return false;
}
async function openMines(forceNew,daily=false){
 hideAll();minesEl.classList.remove('hidden');clearInterval(minesClock);
 const saved=!forceNew&&!daily&&saves.mines;
 const payload={gameId:'mines',daily:daily===true};if(saved)payload.resume=true;
 const session=await FlecityBridge.call('playStartSession',payload);
 if(!session.ok){setStatus('MINESを開始できません: '+session.error,'error');showHome();return;}
 const size=Number(session.challenge&&session.challenge.size)||8,mineCount=Number(session.challenge&&session.challenge.mines)||10;
 if(saved&&saved.state){
   mines={size,mineCount,seed:Number(session.seed),mineSet:null,revealed:new Set(saved.state.revealed||[]),flags:new Set(saved.state.flags||[]),mode:saved.state.mode==='flag'?'flag':'reveal',avoidIndex:Number.isInteger(Number(saved.state.avoidIndex))?Number(saved.state.avoidIndex):null,
     elapsedBase:Number(session.baseElapsedMs||0),timingStarted:false,timingStartedAt:null,timingActivating:false,sessionToken:session.sessionToken,finished:false,lost:false,daily:false};
   setStatus('MINESを途中保存から再開しました。','good');
 }else{
   mines={size,mineCount,seed:Number(session.seed),mineSet:null,revealed:new Set(),flags:new Set(),mode:'reveal',avoidIndex:null,elapsedBase:0,timingStarted:false,timingStartedAt:null,timingActivating:false,sessionToken:session.sessionToken,finished:false,lost:false,daily:session.daily===true};
   setStatus(mines.daily?'デイリーMINES開始。':'新しいMINESを開始しました。','good');
 }
 mines.mineSet=seededMines(mines.seed,mines.size,mines.mineCount,mines.avoidIndex);renderMines();minesClock=setInterval(updateMinesTime,250);
}
async function loseMines(index){
 if(!mines||mines.finished)return;mines.finished=true;mines.lost=true;clearInterval(minesClock);renderMines();setStatus('地雷を踏みました。ゲーム終了。','warn');
 if(!mines.daily){
   await saveQueue.catch(()=>{});
   const reset=await FlecityBridge.call('playResetSave',{gameId:'mines'});
   if(reset.ok)delete saves.mines;
   else setStatus('MINESの終了処理に失敗しました: '+FlecityErrors.text(reset.error),'error');
 }else if(mines.sessionToken){
   await FlecityBridge.call('playCancelSession',{sessionToken:mines.sessionToken});
 }
 mines.sessionToken=null;
}
async function touchMine(index){
 if(!mines||mines.finished)return;
 const firstReveal=mines.mode==='reveal'?index:null;
 if(!(await activateMinesTiming(firstReveal)))return;
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
 const res=await submitScoreWithRetry({sessionToken:mines.sessionToken,score:durationMs,durationMs,revealed:[...mines.revealed]});
 if(res.ok){if(!mines.daily)delete saves.mines;showScoreResult('mines',res,(res.daily?'デイリー · ':'')+'MINES '+(Number(res.score)/1000).toFixed(2)+'s');mines.sessionToken=null;await refreshPlatform();}
 else{await cancelPlaySession(mines.sessionToken);mines.sessionToken=null;mines.finished=true;setStatus('MINESの記録を保存できませんでした。もう一度お試しください。','error');}
 renderMines();
}
minesMode.onclick=()=>{if(!mines||mines.finished)return;mines.mode=mines.mode==='flag'?'reveal':'flag';renderMines();};
minesBack.onclick=async()=>{
 clearInterval(minesClock);minesClock=null;
 if(mines&&!mines.finished&&!mines.daily){
   const saved=await persistMines(true);
   if(!saved){minesClock=setInterval(updateMinesTime,250);return;}
 }
 if(mines&&!mines.finished&&mines.sessionToken)await FlecityBridge.call('playCancelSession',{sessionToken:mines.sessionToken});
 mines=null;showHome();
};
minesNew.onclick=async()=>{
 if(minesNew.disabled)return;
 const wasDaily=!!(mines&&mines.daily);
 if(!wasDaily){
   const ok=await confirmAction('MINESを新しく始めますか？','現在の途中保存は削除されます。','新しく始める');
   if(!ok)return;
 }
 minesNew.disabled=true;
 try{
   clearInterval(minesClock);minesClock=null;
   if(wasDaily){
     if(mines&&!mines.finished&&mines.sessionToken)await FlecityBridge.call('playCancelSession',{sessionToken:mines.sessionToken});
   }else{
     await saveQueue.catch(()=>{});
     const reset=await FlecityBridge.call('playResetSave',{gameId:'mines'});
     if(!reset.ok){setStatus('MINESをリセットできません: '+FlecityErrors.text(reset.error),'error');if(mines&&!mines.finished)minesClock=setInterval(updateMinesTime,250);return;}
     delete saves.mines;
   }
   mines=null;await openMines(true,wasDaily);
 }finally{minesNew.disabled=false;}
};

/* STACK */
function elapsedStack(){return stackGame?performance.now()-stackGame.startedAt:0;}
function renderStack(){
 if(!stackGame)return;
 stackScore.textContent=String(stackGame.score);
 stackMeta.textContent='幅 '+stackGame.width.toFixed(1)+'% · 速度 '+Math.round(stackGame.speed);
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
 const res=await submitScoreWithRetry({sessionToken:stackGame.sessionToken,score:stackGame.score,durationMs,history:stackGame.history});
 if(res.ok){showScoreResult('stack',res,'STACK '+res.score+'段');stackGame.sessionToken=null;await refreshPlatform();}
 else{await cancelPlaySession(stackGame.sessionToken);stackGame.sessionToken=null;setStatus('STACKスコアを保存できませんでした: '+FlecityErrors.text(res.error),'error');}
}
stackDrop.onclick=async()=>{
 if(!stackGame||stackGame.finished)return;
 const now=performance.now(),previous=stackGame.history.length?stackGame.history[stackGame.history.length-1]:0;
 const actionMs=Math.max(previous+.001,Math.round((now-stackGame.startedAt)*1000)/1000);
 stackGame.x=stackPosition(now-stackGame.layerStartedAt,stackGame.width,stackGame.speed,stackGame.reverse);
 stackGame.history.push(actionMs);
 const base=stackGame.layers[stackGame.layers.length-1],left=Math.max(base.x,stackGame.x),right=Math.min(base.x+base.width,stackGame.x+stackGame.width),overlap=right-left;
 if(overlap<=.0001){await finishStack();return;}
 stackGame.layers.push({x:left,width:overlap});
 stackGame.score+=1;
 const previousWidth=stackGame.width;
 stackGame.width=overlap;
 const precision=previousWidth>0?overlap/previousWidth:0;
 if(precision>=.985){setStatus('PERFECT! '+stackGame.score+'段','good');tone(880,55);}
 else if(precision>=.9){setStatus('NICE! '+stackGame.score+'段','good');}
 stackGame.speed=Math.min(180,stackGame.speed+4);
 stackGame.reverse=(stackGame.score%2)===1;
 stackGame.layerStartedAt=now;
 stackGame.x=stackPosition(0,stackGame.width,stackGame.speed,stackGame.reverse);
 renderStack();
};
stackBack.onclick=async()=>{cancelAnimationFrame(stackRaf);if(stackGame&&!stackGame.finished&&stackGame.sessionToken)await FlecityBridge.call('playCancelSession',{sessionToken:stackGame.sessionToken});stackGame=null;showHome();};
stackNew.onclick=async()=>{cancelAnimationFrame(stackRaf);if(stackGame&&!stackGame.finished&&stackGame.sessionToken)await FlecityBridge.call('playCancelSession',{sessionToken:stackGame.sessionToken});stackGame=null;await openStack();};

/* NONOGRAM */
const NONOGRAM_PATTERNS_5=[
 ['01010','11111','11111','01110','00100'],
 ['00100','00100','11111','00100','00100'],
 ['00100','01110','11111','01110','00100'],
 ['00100','01110','11111','10001','11111'],
 ['00100','01100','11111','01100','00100'],
 ['10001','10001','00000','10001','01110'],
 ['10001','10001','10001','01110','00100'],
 ['00100','01110','11111','00100','00100'],
 ['10000','11000','11100','11110','11111'],
 ['10101','01010','10101','01010','10101'],
 ['11111','10001','10001','10001','11111'],
 ['10101','11111','01110','01110','11111'],
 ['00100','01110','11111','01110','10101'],
 ['00100','01110','11111','01110','00101']
];
function seededNonogram(seed,size){
 if(Number(size)===5){
   const numeric=Math.max(1,Math.floor(Number(seed)||1));
   const pattern=NONOGRAM_PATTERNS_5[(numeric-1)%NONOGRAM_PATTERNS_5.length],filled=new Set();
   pattern.forEach((row,y)=>{[...row].forEach((cell,x)=>{if(cell==='1')filled.add(y*5+x);});});
   return filled;
 }
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
function elapsedNonogram(){return (nonogram?nonogram.elapsedBase:0)+(nonogram&&nonogram.timingStarted?performance.now()-nonogram.timingStartedAt:0);}
async function activateNonogramTiming(){
 if(!nonogram||nonogram.finished)return false;
 if(nonogram.timingStarted)return true;
 if(nonogram.timingActivating)return false;
 nonogram.timingActivating=true;
 try{
   const res=await FlecityBridge.call('playActivateSession',{sessionToken:nonogram.sessionToken});
   if(!res.ok){setStatus('NONOGRAMのタイマーを開始できません: '+FlecityErrors.text(res.error),'error');return false;}
   nonogram.elapsedBase=Number(res.elapsedMs??nonogram.elapsedBase)||0;nonogram.timingStarted=true;nonogram.timingStartedAt=performance.now();return true;
 }finally{if(nonogram)nonogram.timingActivating=false;}
}
function updateNonogramTime(){if(nonogram)nonogramTime.textContent=(elapsedNonogram()/1000).toFixed(1)+'s';}
function renderNonogram(){
 if(!nonogram)return;nonogramBoard.innerHTML='';updateNonogramTime();
 nonogramMeta.textContent=String(nonogram.filled.size)+' / '+String(nonogram.solution.size)+' FILLED';
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
async function persistNonogram(showError=false){
 if(!nonogram||nonogram.finished||nonogram.daily)return true;
 const elapsedMs=Math.round(elapsedNonogram());
 const state={filled:[...nonogram.filled],crossed:[...nonogram.crossed]};
 const res=await saveWithRetry({gameId:'nonogram',sessionToken:nonogram.sessionToken,state,score:elapsedMs,elapsedMs});
 if(res.ok){
   const canonical=res.state||state;
   saves.nonogram={game_id:'nonogram',state:canonical,score:Number(res.score??res.elapsedMs??elapsedMs),elapsed_ms:Number(res.elapsedMs??elapsedMs)};
   return true;
 }
 if(showError)setStatus('NONOGRAMの保存に失敗しました: '+FlecityErrors.text(res.error),'error');
 return false;
}
async function openNonogram(forceNew,daily=false){
 hideAll();nonogramEl.classList.remove('hidden');clearInterval(nonogramClock);
 const saved=!forceNew&&!daily&&saves.nonogram,payload={gameId:'nonogram',daily:daily===true};if(saved)payload.resume=true;
 const session=await FlecityBridge.call('playStartSession',payload);
 if(!session.ok){setStatus('NONOGRAMを開始できません: '+session.error,'error');showHome();return;}
 const size=Number(session.challenge&&session.challenge.size)||5,seed=Number(session.seed);
 nonogram={size,seed,solution:seededNonogram(seed,size),filled:new Set(saved&&saved.state?saved.state.filled||[]:[]),crossed:new Set(saved&&saved.state?saved.state.crossed||[]:[]),
   elapsedBase:Number(session.baseElapsedMs||0),timingStarted:false,timingStartedAt:null,timingActivating:false,sessionToken:session.sessionToken,finished:false,daily:session.daily===true};
 setStatus(saved?'NONOGRAMを途中保存から再開しました。':(nonogram.daily?'デイリーNONOGRAM開始。':'新しいNONOGRAMを開始しました。'),'good');renderNonogram();nonogramClock=setInterval(updateNonogramTime,250);
}
async function touchNonogram(index){
 if(!nonogram||nonogram.finished)return;
 if(!(await activateNonogramTiming()))return;
 if(nonogram.filled.has(index)){nonogram.filled.delete(index);nonogram.crossed.add(index);}
 else if(nonogram.crossed.has(index)){nonogram.crossed.delete(index);}
 else nonogram.filled.add(index);
 renderNonogram();await persistNonogram();
}
nonogramCheck.onclick=async()=>{
 if(!nonogram||nonogram.finished)return;nonogramCheck.disabled=true;const durationMs=Math.round(elapsedNonogram());
 const res=await submitScoreWithRetry({sessionToken:nonogram.sessionToken,score:durationMs,durationMs,filled:[...nonogram.filled]});
 nonogramCheck.disabled=false;
 if(res.ok){nonogram.finished=true;clearInterval(nonogramClock);if(!nonogram.daily)delete saves.nonogram;showScoreResult('nonogram',res,(res.daily?'デイリー · ':'')+'NONOGRAM '+(Number(res.score)/1000).toFixed(2)+'s');renderNonogram();await refreshPlatform();}
 else if(res.error==='INCORRECT_SOLUTION')setStatus('まだ正解ではありません。','warn');
 else setStatus('NONOGRAM判定失敗: '+FlecityErrors.text(res.error),'error');
};
nonogramBack.onclick=async()=>{clearInterval(nonogramClock);nonogramClock=null;if(nonogram&&!nonogram.finished&&!nonogram.daily){const saved=await persistNonogram(true);if(!saved){nonogramClock=setInterval(updateNonogramTime,250);return;}}if(nonogram&&!nonogram.finished&&nonogram.sessionToken)await FlecityBridge.call('playCancelSession',{sessionToken:nonogram.sessionToken});nonogram=null;showHome();};
nonogramNew.onclick=async()=>{
 if(nonogramNew.disabled)return;
 const wasDaily=!!(nonogram&&nonogram.daily);
 if(!wasDaily){
   const ok=await confirmAction('NONOGRAMを新しく始めますか？','現在の途中保存は削除されます。','新しい問題');
   if(!ok)return;
 }
 nonogramNew.disabled=true;
 try{
   clearInterval(nonogramClock);nonogramClock=null;
   if(wasDaily){
     if(nonogram&&!nonogram.finished&&nonogram.sessionToken)await FlecityBridge.call('playCancelSession',{sessionToken:nonogram.sessionToken});
   }else{
     await saveQueue.catch(()=>{});
     const reset=await FlecityBridge.call('playResetSave',{gameId:'nonogram'});
     if(!reset.ok){setStatus('NONOGRAMをリセットできません: '+FlecityErrors.text(reset.error),'error');if(nonogram&&!nonogram.finished)nonogramClock=setInterval(updateNonogramTime,250);return;}
     delete saves.nonogram;
   }
   nonogram=null;await openNonogram(true,wasDaily);
 }finally{nonogramNew.disabled=false;}
};


/* COLOR MATCH */
const COLOR_MATCH_COLORS=[
 {name:'赤',css:'#ff6b6b'},{name:'青',css:'#6ba8ff'},{name:'緑',css:'#62d98b'},{name:'黄',css:'#ffd65a'}
];
function colorMatchNext(state){
 let x=Math.floor(Number(state)||1)%2147483647;if(x<=0)x=1;
 x=(x*16807)%2147483647;return [x,(x-1)/2147483646];
}
function colorMatchRounds(seed,count=10){
 let state=Math.floor(Number(seed)||1)%2147483647;if(state<=0)state=1;
 const rounds=[];
 for(let i=0;i<count;i++){
   let value;[state,value]=colorMatchNext(state);const word=Math.floor(value*4);
   [state,value]=colorMatchNext(state);let ink=Math.floor(value*3);if(ink>=word)ink++;
   rounds.push({word,ink});
 }
 return rounds;
}
function elapsedColorMatch(){return colorMatch?performance.now()-colorMatch.startedAt:0;}
function updateColorMatchTime(){if(colorMatch&&colorMatch.running)colorMatchTime.textContent=(elapsedColorMatch()/1000).toFixed(1)+'s';}
function renderColorMatch(){
 colorMatchChoices.innerHTML='';
 if(!colorMatch||!colorMatch.running){
   colorMatchProgress.textContent='0 / 10';colorMatchTime.textContent='0.0s';colorMatchWord.textContent='READY';colorMatchWord.style.color='';
   return;
 }
 const round=colorMatch.rounds[colorMatch.index];
 colorMatchProgress.textContent=String(Math.min(colorMatch.index+1,colorMatch.rounds.length))+' / '+String(colorMatch.rounds.length);
 colorMatchWord.textContent=COLOR_MATCH_COLORS[round.word].name;
 colorMatchWord.style.color=COLOR_MATCH_COLORS[round.ink].css;
 COLOR_MATCH_COLORS.forEach((entry,index)=>{
   const b=document.createElement('button');b.className='color-match-choice';b.textContent=entry.name;
   b.onclick=()=>answerColorMatch(index);colorMatchChoices.appendChild(b);
 });
 updateColorMatchTime();
}
function openColorMatch(){
 hideAll();colorMatchEl.classList.remove('hidden');clearInterval(colorMatchClock);colorMatchClock=null;colorMatch=null;
 colorMatchStart.disabled=false;colorMatchStart.classList.remove('hidden');renderColorMatch();setStatus('文字の意味ではなく、文字そのものの色を選んでください。','good');
}
async function startColorMatch(){
 if(colorMatch&&colorMatch.running)return;
 colorMatchStart.disabled=true;
 const session=await FlecityBridge.call('playStartSession',{gameId:'color_match'});
 if(!session.ok){colorMatchStart.disabled=false;setStatus('COLOR MATCHを開始できません: '+FlecityErrors.text(session.error),'error');return;}
 const rounds=colorMatchRounds(session.seed,Number(session.challenge&&session.challenge.rounds)||10);
 colorMatch={sessionToken:session.sessionToken,seed:Number(session.seed)||1,rounds,index:0,history:[],startedAt:performance.now(),running:true,finished:false};
 colorMatchStart.classList.add('hidden');setStatus('COLOR MATCH開始。10問連続正解を目指してください。','good');renderColorMatch();colorMatchClock=setInterval(updateColorMatchTime,100);
}
async function answerColorMatch(choice){
 if(!colorMatch||!colorMatch.running||colorMatch.finished)return;
 const round=colorMatch.rounds[colorMatch.index];colorMatch.history.push(choice);
 if(choice!==round.ink){
   colorMatch.running=false;colorMatch.finished=true;clearInterval(colorMatchClock);colorMatchClock=null;
   colorMatchChoices.querySelectorAll('button').forEach(b=>b.disabled=true);
   colorMatchWord.textContent='MISS';colorMatchWord.style.color='';
   if(colorMatch.sessionToken)await FlecityBridge.call('playCancelSession',{sessionToken:colorMatch.sessionToken});
   colorMatch.sessionToken=null;colorMatchStart.classList.remove('hidden');colorMatchStart.disabled=false;colorMatchStart.textContent='もう一度';
   setStatus('不正解。10問連続正解でクリアです。','warn');return;
 }
 tone(720,35);colorMatch.index+=1;
 if(colorMatch.index>=colorMatch.rounds.length){
   colorMatch.running=false;colorMatch.finished=true;clearInterval(colorMatchClock);colorMatchClock=null;
   const durationMs=Math.round(elapsedColorMatch());
   const res=await submitScoreWithRetry({sessionToken:colorMatch.sessionToken,score:durationMs,durationMs,history:colorMatch.history});
   if(res.ok){
     colorMatch.sessionToken=null;colorMatchProgress.textContent='10 / 10';colorMatchWord.textContent='CLEAR';colorMatchWord.style.color='';
     colorMatchChoices.innerHTML='';colorMatchStart.classList.remove('hidden');colorMatchStart.disabled=false;colorMatchStart.textContent='もう一度';
     showScoreResult('color_match',res,'COLOR MATCH '+(Number(res.score)/1000).toFixed(3)+'s');await refreshPlatform();
   }else{
     await cancelPlaySession(colorMatch.sessionToken);colorMatch.sessionToken=null;colorMatch.finished=true;colorMatch.running=false;
     colorMatchStart.classList.remove('hidden');colorMatchStart.disabled=false;colorMatchStart.textContent='もう一度';
     setStatus('COLOR MATCHの記録を保存できませんでした。もう一度お試しください。','error');
   }
   return;
 }
 renderColorMatch();
}
colorMatchStart.onclick=startColorMatch;
colorMatchBack.onclick=async()=>{clearInterval(colorMatchClock);colorMatchClock=null;if(colorMatch&&colorMatch.sessionToken)await FlecityBridge.call('playCancelSession',{sessionToken:colorMatch.sessionToken});colorMatch=null;showHome();};
colorMatchNew.onclick=async()=>{clearInterval(colorMatchClock);colorMatchClock=null;if(colorMatch&&colorMatch.sessionToken)await FlecityBridge.call('playCancelSession',{sessionToken:colorMatch.sessionToken});colorMatch=null;openColorMatch();};

/* NUMBER RUSH */
function numberRushNext(state){
 let x=Math.floor(Number(state)||1)%2147483647;if(x<=0)x=1;
 x=(x*16807)%2147483647;return [x,(x-1)/2147483646];
}
function numberRushBoardFromSeed(seed,count=25){
 const total=Math.max(2,Math.min(64,Math.floor(Number(count)||25)));
 const board=Array.from({length:total},(_,i)=>i+1);
 let state=Math.floor(Number(seed)||1)%2147483647;if(state<=0)state=1;
 for(let i=board.length-1;i>=1;i--){
   let value;[state,value]=numberRushNext(state);
   const j=Math.floor(value*(i+1));[board[i],board[j]]=[board[j],board[i]];
 }
 return board;
}
function elapsedNumberRush(){return numberRush&&numberRush.running?performance.now()-numberRush.startedAt:0;}
function updateNumberRushTime(){if(numberRush&&numberRush.running)numberRushTime.textContent=(elapsedNumberRush()/1000).toFixed(2)+'s';}
function renderNumberRush(){
 numberRushBoard.innerHTML='';
 if(!numberRush){
   numberRushProgress.textContent='1 / 25';numberRushTime.textContent='0.00s';numberRushMeta.textContent='MISS 0 · ペナルティ 0.0s';return;
 }
 numberRushProgress.textContent=(numberRush.finished?numberRush.count:Math.min(numberRush.next,numberRush.count))+' / '+numberRush.count;
 numberRushMeta.textContent='MISS '+numberRush.misses+' · ペナルティ '+(numberRush.misses*.5).toFixed(1)+'s';
 numberRush.board.forEach((value,index)=>{
   const b=document.createElement('button');
   const done=numberRush.completed.has(index);
   b.className='number-rush-cell'+(done?' done':'');
   b.textContent=String(value);
   b.disabled=!numberRush.running||done;
   b.setAttribute('aria-label',done?'完了 '+value:'数字 '+value);
   b.onclick=()=>tapNumberRush(index);
   numberRushBoard.appendChild(b);
 });
 updateNumberRushTime();
}
function openNumberRush(daily=false){
 hideAll();numberRushEl.classList.remove('hidden');clearInterval(numberRushClock);numberRushClock=null;numberRush=null;
 numberRushStart.classList.remove('hidden');numberRushStart.disabled=false;numberRushStart.textContent='スタート';
 numberRushNew.classList.add('hidden');renderNumberRush();
 setStatus(daily?'デイリーNUMBER RUSH。同じ配置でタイムを競います。':'1から25まで順番にタップしてください。','good');
 numberRushEl.dataset.daily=daily===true?'1':'0';
}
async function startNumberRush(){
 if(numberRush&&numberRush.running)return;
 numberRushStart.disabled=true;
 const daily=numberRushEl.dataset.daily==='1';
 const session=await FlecityBridge.call('playStartSession',{gameId:'number_rush',daily});
 if(!session.ok){numberRushStart.disabled=false;setStatus('NUMBER RUSHを開始できません: '+FlecityErrors.text(session.error),'error');return;}
 const count=Number(session.challenge&&session.challenge.count)||25;
 numberRush={sessionToken:session.sessionToken,seed:Number(session.seed)||1,count,board:numberRushBoardFromSeed(session.seed,count),next:1,misses:0,history:[],completed:new Set(),startedAt:performance.now(),running:true,finished:false,daily:session.daily===true};
 numberRushStart.classList.add('hidden');numberRushNew.classList.remove('hidden');
 setStatus(numberRush.daily?'デイリーNUMBER RUSH開始。':'NUMBER RUSH開始。','good');
 renderNumberRush();numberRushClock=setInterval(updateNumberRushTime,50);
}
async function tapNumberRush(index){
 if(!numberRush||!numberRush.running||numberRush.finished)return;
 numberRush.history.push(index);
 const value=numberRush.board[index];
 if(value!==numberRush.next){
   numberRush.misses+=1;tone(180,45);
   const cell=numberRushBoard.children[index];
   if(cell){cell.classList.add('wrong');setTimeout(()=>cell.classList.remove('wrong'),180);}
   numberRushMeta.textContent='MISS '+numberRush.misses+' · ペナルティ '+(numberRush.misses*.5).toFixed(1)+'s';
   return;
 }
 numberRush.completed.add(index);numberRush.next+=1;tone(600+Math.min(300,numberRush.next*8),28);
 if(numberRush.next>numberRush.count){await finishNumberRush();return;}
 renderNumberRush();
}
async function finishNumberRush(){
 if(!numberRush||numberRush.finished)return;
 numberRush.finished=true;numberRush.running=false;clearInterval(numberRushClock);numberRushClock=null;
 const durationMs=Math.round(performance.now()-numberRush.startedAt);
 const res=await submitScoreWithRetry({sessionToken:numberRush.sessionToken,score:durationMs+(numberRush.misses*500),durationMs,history:numberRush.history});
 if(res.ok){
   numberRush.sessionToken=null;
   numberRushTime.textContent=(Number(res.score)/1000).toFixed(3)+'s';
   const penalty=Number(res.details&&res.details.penaltyMs)||0;
   showScoreResult('number_rush',res,(res.daily?'デイリー · ':'')+'NUMBER RUSH '+(Number(res.score)/1000).toFixed(3)+'s'+(penalty?'（ペナルティ '+(penalty/1000).toFixed(1)+'s）':''));
   renderNumberRush();await refreshPlatform();
 }else{
   await cancelPlaySession(numberRush.sessionToken);numberRush.sessionToken=null;numberRush.finished=true;numberRush.running=false;
   renderNumberRush();setStatus('NUMBER RUSHの記録を保存できませんでした。もう一度お試しください。','error');
 }
}
numberRushStart.onclick=startNumberRush;
numberRushBack.onclick=async()=>{
 clearInterval(numberRushClock);numberRushClock=null;
 if(numberRush&&numberRush.sessionToken)await FlecityBridge.call('playCancelSession',{sessionToken:numberRush.sessionToken});
 numberRush=null;showHome();
};
numberRushNew.onclick=async()=>{
 clearInterval(numberRushClock);numberRushClock=null;
 const daily=(numberRush&&numberRush.daily)||numberRushEl.dataset.daily==='1';
 if(numberRush&&numberRush.sessionToken)await FlecityBridge.call('playCancelSession',{sessionToken:numberRush.sessionToken});
 numberRush=null;openNumberRush(daily);
};

/* HIGH & LOW */
function highLowLabel(value){
 const n=Number(value)||0;
 if(n===1)return 'A';
 if(n===11)return 'J';
 if(n===12)return 'Q';
 if(n===13)return 'K';
 return String(n);
}
function renderHighLow(){
 if(!highLow){
   highLowCard.textContent='?';highLowStreak.textContent='0';highLowMeta.textContent='ROUND 0 / 30';
   highLowHigher.disabled=true;highLowLower.disabled=true;return;
 }
 highLowCard.textContent=highLowLabel(highLow.currentValue);
 highLowStreak.textContent=String(highLow.streak);
 const round=Math.min(highLow.completed+1,highLow.maxRounds);
 highLowMeta.textContent='ROUND '+String(round)+' / '+String(highLow.maxRounds);
 highLowHigher.disabled=!highLow.running||highLow.busy;highLowLower.disabled=!highLow.running||highLow.busy;
}
function openHighLow(){
 hideAll();highLowEl.classList.remove('hidden');highLow=null;
 highLowStart.classList.remove('hidden');highLowStart.disabled=false;highLowStart.textContent='スタート';
 highLowNew.classList.add('hidden');renderHighLow();setStatus('次の数字が今よりHIGHかLOWか予想してください。','good');
}
async function startHighLow(){
 if(highLow&&highLow.running)return;
 highLowStart.disabled=true;
 const session=await FlecityBridge.call('playStartSession',{gameId:'high_low'});
 if(!session.ok){highLowStart.disabled=false;setStatus('HIGH & LOWを開始できません: '+FlecityErrors.text(session.error),'error');return;}
 const maxRounds=Number(session.challenge&&session.challenge.rounds)||30;
 const currentValue=Number(session.challenge&&session.challenge.currentValue)||0;
 if(currentValue<1||currentValue>13){
   await cancelPlaySession(session.sessionToken);
   highLowStart.disabled=false;setStatus('HIGH & LOWの初期状態を取得できませんでした。','error');return;
 }
 highLow={sessionToken:session.sessionToken,maxRounds,currentValue,completed:0,streak:0,startedAt:performance.now(),running:true,finished:false,busy:false};
 highLowStart.classList.add('hidden');highLowNew.classList.remove('hidden');renderHighLow();setStatus('HIGH & LOW開始。未来の数字はSERVERで判定します。','good');
}
async function guessHighLow(guess){
 if(!highLow||!highLow.running||highLow.finished||highLow.busy)return;
 highLow.busy=true;renderHighLow();
 const res=await FlecityBridge.call('playHighLowGuess',{sessionToken:highLow.sessionToken,guess});
 if(!res.ok){
   highLow.busy=false;renderHighLow();
   setStatus('HIGH & LOW判定失敗: '+FlecityErrors.text(res.error),'error');return;
 }
 highLow.currentValue=Number(res.nextValue)||highLow.currentValue;
 highLow.streak=Math.max(0,Number(res.streak)||0);
 highLow.completed=Math.max(0,Number(res.completed)||0);
 highLow.busy=false;
 if(res.correct){
   tone(720+Math.min(220,highLow.streak*12),35);
   setStatus(highLowLabel(res.currentValue)+' → '+highLowLabel(res.nextValue)+' · 正解 · '+highLow.streak+'連勝','good');
 }else{
   tone(160,80);setStatus(highLowLabel(res.currentValue)+' → '+highLowLabel(res.nextValue)+' · 不正解','warn');
 }
 renderHighLow();
 if(res.ended===true){await finishHighLow(res.cleared===true);}
}
async function finishHighLow(cleared){
 if(!highLow||highLow.finished)return;
 highLow.finished=true;highLow.running=false;highLow.busy=true;renderHighLow();
 const durationMs=Math.max(0,Math.round(performance.now()-highLow.startedAt));
 const res=await submitScoreWithRetry({sessionToken:highLow.sessionToken,score:highLow.streak,durationMs});
 if(res.ok){
   highLow.sessionToken=null;highLow.busy=false;
   showScoreResult('high_low',res,(cleared?'30 ROUND CLEAR · ':'')+'HIGH & LOW '+res.score+'連勝');
   await refreshPlatform();
 }else{
   await cancelPlaySession(highLow.sessionToken);highLow.sessionToken=null;highLow.finished=true;highLow.running=false;highLow.busy=false;renderHighLow();
   setStatus('HIGH & LOWの記録を保存できませんでした。もう一度お試しください。','error');
 }
}
highLowStart.onclick=startHighLow;
highLowHigher.onclick=()=>guessHighLow('high');
highLowLower.onclick=()=>guessHighLow('low');
highLowBack.onclick=async()=>{
 if(highLow&&highLow.sessionToken)await FlecityBridge.call('playCancelSession',{sessionToken:highLow.sessionToken});
 highLow=null;showHome();
};
highLowNew.onclick=async()=>{
 if(highLow&&highLow.sessionToken)await FlecityBridge.call('playCancelSession',{sessionToken:highLow.sessionToken});
 highLow=null;openHighLow();
};

/* SIMON */
function renderSimon(){
 const game=simon;
 if(!game){
   simonRound.textContent='0';simonMeta.textContent='ROUND 0 · BEST 0';simonMessage.textContent='スタートを押してください。';
   simonPads.forEach(p=>{p.disabled=true;p.classList.remove('active','wrong');});
   return;
 }
 simonRound.textContent=String(game.cleared);
 simonMeta.textContent='ROUND '+String(game.round)+' / '+String(game.maxRounds)+' · CLEAR '+String(game.cleared);
 simonPads.forEach(p=>p.disabled=!game.accepting||game.submitting);
}
function flashSimonPad(index,duration){
 return new Promise(resolve=>{
   if(!simon)return resolve();
   const pad=simonPads[index];if(!pad)return resolve();
   pad.classList.add('active');tone([420,560,700,840][index]||660,Math.min(120,duration));
   simonTimer=setTimeout(()=>{pad.classList.remove('active');simonTimer=setTimeout(resolve,Math.max(70,Math.round(duration*.35)));},duration);
 });
}
async function playSimonSequence(){
 const game=simon;if(!game||game.finished)return;
 game.accepting=false;game.submitting=false;game.inputIndex=0;game.roundInputs=[];renderSimon();
 simonMessage.textContent='覚えてください · '+game.round+'手';
 await sleep(260);
 const flashMs=Math.max(180,430-(game.round*7));
 for(let i=0;i<game.sequence.length;i++){
   if(simon!==game||game.finished)return;
   await flashSimonPad(game.sequence[i],flashMs);
 }
 if(simon!==game||game.finished)return;
 game.accepting=true;game.inputIndex=0;renderSimon();simonMessage.textContent='あなたの番 · 1 / '+game.round;
}
function openSimon(){
 hideAll();simonEl.classList.remove('hidden');clearTimeout(simonTimer);simonTimer=null;simon=null;
 simonStart.classList.remove('hidden');simonNew.classList.add('hidden');simonStart.disabled=false;renderSimon();
 setStatus('光った順番を覚えて、同じ順番で押してください。','good');
}
async function startSimon(){
 if(simon&&!simon.finished)return;
 simonStart.disabled=true;
 const session=await FlecityBridge.call('playStartSession',{gameId:'simon'});
 if(!session.ok){simonStart.disabled=false;setStatus('SIMONを開始できません: '+FlecityErrors.text(session.error),'error');return;}
 const maxRounds=Number(session.challenge&&session.challenge.rounds)||30;
 const sequence=Array.isArray(session.challenge&&session.challenge.sequence)?session.challenge.sequence.map(Number):[];
 if(sequence.length!==1||sequence.some(v=>!Number.isInteger(v)||v<0||v>3)){
   await cancelPlaySession(session.sessionToken);
   simonStart.disabled=false;setStatus('SIMONの初期状態を取得できませんでした。','error');return;
 }
 simon={sessionToken:session.sessionToken,maxRounds,sequence,round:1,cleared:0,inputIndex:0,roundInputs:[],accepting:false,submitting:false,finished:false,startedAt:performance.now()};
 simonStart.classList.add('hidden');simonNew.classList.remove('hidden');renderSimon();setStatus('SIMON開始。未来のラウンドはSERVERから順番に配信します。','good');
 await playSimonSequence();
}
async function sendSimonRound(inputs){
 let res=await FlecityBridge.call('playSubmitSimonRound',{sessionToken:simon&&simon.sessionToken,inputs});
 if(!res.ok&&['RATE_LIMIT','NUI_REQUEST_FAILED','PHONE_CALLBACK_FAILED','CALLBACK_FAILED'].includes(res.error)){
   await sleep(res.error==='RATE_LIMIT'?220:160);
   res=await FlecityBridge.call('playSubmitSimonRound',{sessionToken:simon&&simon.sessionToken,inputs});
 }
 return res;
}
async function finishSimon(clearedAll=false){
 const game=simon;if(!game||game.finished)return;
 game.finished=true;game.accepting=false;game.submitting=false;clearTimeout(simonTimer);simonTimer=null;renderSimon();
 const durationMs=Math.max(0,Math.round(performance.now()-game.startedAt));
 const res=await submitScoreWithRetry({sessionToken:game.sessionToken,score:game.cleared,durationMs});
 if(res.ok){
   game.sessionToken=null;simonMessage.textContent=clearedAll?'ALL CLEAR!':'GAME OVER';
   showScoreResult('simon',res,(clearedAll?'30 ROUND CLEAR · ':'')+'SIMON '+res.score+'ラウンド');
   await refreshPlatform();
 }else{
   await cancelPlaySession(game.sessionToken);game.sessionToken=null;game.finished=true;game.accepting=false;game.submitting=false;renderSimon();
   simonMessage.textContent='記録保存に失敗しました';
   setStatus('SIMONの記録を保存できませんでした。もう一度お試しください。','error');
 }
}
async function pressSimon(index){
 const game=simon;if(!game||game.finished||!game.accepting||game.submitting)return;
 game.accepting=false;simonPads.forEach(p=>p.disabled=true);
 game.roundInputs.push(index);
 const expected=game.sequence[game.inputIndex];
 if(index!==expected){
   const pad=simonPads[index];if(pad)pad.classList.add('wrong');
   tone(150,100);simonMessage.textContent='MISS';
   game.submitting=true;
   const res=await sendSimonRound(game.roundInputs.slice());
   game.submitting=false;
   if(!res.ok){
     game.accepting=true;renderSimon();setStatus('SIMON判定失敗: '+FlecityErrors.text(res.error),'error');return;
   }
   game.cleared=Math.max(0,Number(res.cleared)||0);
   simonTimer=setTimeout(()=>{if(pad)pad.classList.remove('wrong');},260);
   await finishSimon(false);return;
 }
 tone([420,560,700,840][index]||660,45);
 game.inputIndex+=1;
 if(game.inputIndex<game.sequence.length){
   game.accepting=true;renderSimon();simonMessage.textContent='あなたの番 · '+String(game.inputIndex+1)+' / '+game.round;return;
 }

 game.submitting=true;renderSimon();
 const res=await sendSimonRound(game.roundInputs.slice());
 game.submitting=false;
 if(!res.ok){
   game.accepting=true;renderSimon();setStatus('SIMON判定失敗: '+FlecityErrors.text(res.error),'error');return;
 }
 game.cleared=Math.max(0,Number(res.cleared)||0);renderSimon();
 if(res.ended===true){await finishSimon(res.clearedAll===true);return;}

 const nextSequence=Array.isArray(res.sequence)?res.sequence.map(Number):[];
 const nextRound=Math.max(1,Number(res.round)||game.round+1);
 if(nextSequence.length!==nextRound||nextSequence.some(v=>!Number.isInteger(v)||v<0||v>3)){
   setStatus('SIMONの次ラウンドを取得できませんでした。','error');return;
 }
 simonMessage.textContent='CLEAR · ROUND '+game.round;
 game.round=nextRound;game.sequence=nextSequence;game.inputIndex=0;game.roundInputs=[];
 await sleep(520);
 if(simon===game&&!game.finished)await playSimonSequence();
}
simonPads.forEach((pad,index)=>{pad.onclick=()=>pressSimon(index);});
simonStart.onclick=startSimon;
simonBack.onclick=async()=>{clearTimeout(simonTimer);simonTimer=null;if(simon&&simon.sessionToken)await FlecityBridge.call('playCancelSession',{sessionToken:simon.sessionToken});simon=null;showHome();};
simonNew.onclick=async()=>{clearTimeout(simonTimer);simonTimer=null;if(simon&&simon.sessionToken)await FlecityBridge.call('playCancelSession',{sessionToken:simon.sessionToken});simon=null;openSimon();};

/* MEMORY */
const MEMORY_SYMBOLS=['◆','●','▲','★','♣','♥','☀','☂'];
function memorySeededNext(state){
 let x=Math.floor(Number(state)||1)%2147483647;if(x<=0)x=1;
 x=(x*16807)%2147483647;return [x,(x-1)/2147483646];
}
function memoryDeckFromSeed(seed){
 const deck=[];for(let value=1;value<=8;value++){deck.push(value,value);}
 let state=Math.floor(Number(seed)||1)%2147483647;if(state<=0)state=1;
 for(let i=deck.length-1;i>=1;i--){
   let value;[state,value]=memorySeededNext(state);
   const j=Math.floor(value*(i+1));[deck[i],deck[j]]=[deck[j],deck[i]];
 }
 return deck;
}
function elapsedMemory(){return memory&&memory.playStartedAt?performance.now()-memory.playStartedAt:0;}
function updateMemoryTime(){if(memory)memoryTime.textContent=(elapsedMemory()/1000).toFixed(1)+'s';}
function renderMemory(){
 if(!memory)return;
 memoryBoard.innerHTML='';updateMemoryTime();
 memoryMeta.textContent=memory.previewing?'記憶中…':String(memory.matched.size/2)+' / 8 PAIRS · '+String(memory.moves)+' MOVES';
 for(let i=0;i<memory.deck.length;i++){
   const b=document.createElement('button');
   const shown=memory.previewing||memory.revealed.includes(i),matched=memory.matched.has(i);
   b.className='memory-card'+(shown?' revealed':'')+(matched?' matched':'')+(memory.previewing?' preview':'');
   b.textContent=(shown||matched)?MEMORY_SYMBOLS[memory.deck[i]-1]:'?';
   b.disabled=memory.previewing||memory.finished||memory.busy||matched;
   b.setAttribute('aria-label',matched?'一致済み':(shown?'カード '+String(memory.deck[i]):'伏せたカード'));
   b.onclick=()=>flipMemory(i);
   memoryBoard.appendChild(b);
 }
}
async function openMemory(daily=false){
 hideAll();memoryEl.classList.remove('hidden');clearInterval(memoryClock);clearTimeout(memoryFlipTimer);
 const session=await FlecityBridge.call('playStartSession',{gameId:'memory',daily:daily===true});
 if(!session.ok){setStatus('MEMORYを開始できません: '+FlecityErrors.text(session.error),'error');showHome();return;}
 const previewMs=Math.max(0,Number(session.challenge&&session.challenge.previewMs)||1200);
 memory={sessionToken:session.sessionToken,seed:Number(session.seed)||1,deck:memoryDeckFromSeed(session.seed),revealed:[],matched:new Set(),history:[],moves:0,playStartedAt:null,finished:false,busy:false,previewing:true,daily:session.daily===true,previewMs};
 setStatus((previewMs/1000).toFixed(1)+'秒だけカードを覚えてください。','good');
 renderMemory();memoryClock=setInterval(updateMemoryTime,200);
 memoryFlipTimer=setTimeout(()=>{
   if(!memory||memory.finished)return;
   memory.previewing=false;memory.playStartedAt=performance.now();memoryFlipTimer=null;renderMemory();
   setStatus(memory.daily?'デイリーMEMORY開始。同じ配置でタイムを競います。':'MEMORY開始。8組のペアを探してください。','good');
 },previewMs);
}
async function flipMemory(index){
 if(!memory||memory.previewing||memory.finished||memory.busy||memory.matched.has(index)||memory.revealed.includes(index))return;
 memory.revealed.push(index);renderMemory();
 if(memory.revealed.length<2)return;
 const pair=memory.revealed.slice(0,2);memory.history.push(pair);memory.moves+=1;
 const matched=memory.deck[pair[0]]===memory.deck[pair[1]];
 if(matched){
   memory.matched.add(pair[0]);memory.matched.add(pair[1]);memory.revealed=[];tone(760,55);renderMemory();
   if(memory.matched.size===16){await finishMemory();}
   return;
 }
 memory.busy=true;renderMemory();
 memoryFlipTimer=setTimeout(()=>{
   if(!memory||memory.finished)return;
   memory.revealed=[];memory.busy=false;renderMemory();
 },650);
}
async function finishMemory(){
 if(!memory||memory.finished)return;
 memory.finished=true;memory.busy=true;clearInterval(memoryClock);clearTimeout(memoryFlipTimer);
 const durationMs=Math.round(elapsedMemory());
 const res=await submitScoreWithRetry({sessionToken:memory.sessionToken,score:durationMs,durationMs,history:memory.history});
 if(res.ok){
   memory.sessionToken=null;memory.busy=false;showScoreResult('memory',res,(res.daily?'デイリー · ':'')+'MEMORY '+(Number(res.score)/1000).toFixed(2)+'s · '+memory.moves+' MOVES');renderMemory();await refreshPlatform();
 }else{
   await cancelPlaySession(memory.sessionToken);memory.sessionToken=null;memory.finished=true;memory.busy=false;setStatus('MEMORYの記録を保存できませんでした。もう一度お試しください。','error');renderMemory();
 }
}
memoryBack.onclick=async()=>{
 clearInterval(memoryClock);clearTimeout(memoryFlipTimer);memoryClock=null;memoryFlipTimer=null;
 if(memory&&!memory.finished&&memory.sessionToken)await FlecityBridge.call('playCancelSession',{sessionToken:memory.sessionToken});
 memory=null;showHome();
};
memoryNew.onclick=async()=>{
 clearInterval(memoryClock);clearTimeout(memoryFlipTimer);memoryClock=null;memoryFlipTimer=null;
 const wasDaily=!!(memory&&memory.daily);
 if(memory&&!memory.finished&&memory.sessionToken)await FlecityBridge.call('playCancelSession',{sessionToken:memory.sessionToken});
 memory=null;await openMemory(wasDaily);
};

let suspendRunning=false;
async function cancelPlaySession(token){
 if(!token)return;
 try{await FlecityBridge.call('playCancelSession',{sessionToken:token});}catch(_){}
}
async function suspendActivePlay(){
 if(suspendRunning)return;
 suspendRunning=true;
 try{
   if(confirmResolver)closeConfirm(false);
   clearTimeout(tapTimer);tapTimer=null;
   cancelAnimationFrame(stopRaf);cancelAnimationFrame(stackRaf);
   clearInterval(minesClock);clearInterval(nonogramClock);clearInterval(memoryClock);clearInterval(colorMatchClock);clearInterval(numberRushClock);
   clearTimeout(memoryFlipTimer);clearTimeout(simonTimer);
   minesClock=null;nonogramClock=null;memoryClock=null;colorMatchClock=null;numberRushClock=null;memoryFlipTimer=null;simonTimer=null;

   if(block&&!block.finished){
     if(!block.daily)await persistBlock(false);
     await cancelPlaySession(block.sessionToken);
   }
   if(merge&&!merge.finished){
     await persistMerge(false);
     await cancelPlaySession(merge.sessionToken);
   }
   if(mines&&!mines.finished){
     if(!mines.daily)await persistMines(false);
     await cancelPlaySession(mines.sessionToken);
   }
   if(nonogram&&!nonogram.finished){
     if(!nonogram.daily)await persistNonogram(false);
     await cancelPlaySession(nonogram.sessionToken);
   }

   await cancelPlaySession(tapSession&&tapSession.sessionToken);
   await cancelPlaySession(stopSession&&stopSession.sessionToken);
   await cancelPlaySession(stackGame&&stackGame.sessionToken);
   await cancelPlaySession(memory&&memory.sessionToken);
   await cancelPlaySession(colorMatch&&colorMatch.sessionToken);
   await cancelPlaySession(numberRush&&numberRush.sessionToken);
   await cancelPlaySession(highLow&&highLow.sessionToken);
   await cancelPlaySession(simon&&simon.sessionToken);

   block=null;merge=null;mines=null;nonogram=null;stackGame=null;memory=null;colorMatch=null;numberRush=null;highLow=null;simon=null;
   tapSession=null;tapState='idle';stopSession=null;stopState='idle';
   if(bootstrapData){hideAll();homeEl.classList.remove('hidden');renderGames(bootstrapData.games);}
 }catch(error){
   console.warn('[PLAY] suspend failed',error);
 }finally{suspendRunning=false;}
}
document.addEventListener('visibilitychange',()=>{if(document.hidden)void suspendActivePlay();});
window.addEventListener('pagehide',()=>{void suspendActivePlay();});

bootstrap();
