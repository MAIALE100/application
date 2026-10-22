const statusEl=document.getElementById('status'),gamesEl=document.getElementById('games'),homeEl=document.getElementById('home');
const continueCard=document.getElementById('continueCard'),continueGames=document.getElementById('continueGames'),continueCount=document.getElementById('continueCount'),gameCount=document.getElementById('gameCount');
const recentCard=document.getElementById('recentCard'),recentGames=document.getElementById('recentGames'),recentCount=document.getElementById('recentCount'),libraryFilters=document.getElementById('libraryFilters'),randomPlay=document.getElementById('randomPlay');
const rankingGame=document.getElementById('rankingGame'),rankingPeriod=document.getElementById('rankingPeriod'),rankingSelf=document.getElementById('rankingSelf'),rankingLoad=document.getElementById('rankingLoad'),rankingRows=document.getElementById('rankingRows');
const dailyCard=document.getElementById('dailyCard'),dailyGame=document.getElementById('dailyGame'),dailyDate=document.getElementById('dailyDate'),dailyPlay=document.getElementById('dailyPlay'),dailyBest=document.getElementById('dailyBest'),dailyRanking=document.getElementById('dailyRanking');
const statPlays=document.getElementById('statPlays'),statTime=document.getElementById('statTime'),gameStatRows=document.getElementById('gameStatRows'),achievementCount=document.getElementById('achievementCount'),achievementRows=document.getElementById('achievementRows');
const settingSound=document.getElementById('settingSound'),settingMotion=document.getElementById('settingMotion');
const confirmOverlay=document.getElementById('confirmOverlay'),confirmTitle=document.getElementById('confirmTitle'),confirmMessage=document.getElementById('confirmMessage'),confirmCancel=document.getElementById('confirmCancel'),confirmAccept=document.getElementById('confirmAccept');
const quickEl=document.getElementById('quickTap'),tapBest=document.getElementById('tapBest'),tapRunMeta=document.getElementById('tapRunMeta'),tapMessage=document.getElementById('tapMessage'),tapButton=document.getElementById('tapButton'),tapBack=document.getElementById('tapBack');
const stopEl=document.getElementById('stopGame'),stopBest=document.getElementById('stopBest'),stopRunMeta=document.getElementById('stopRunMeta'),stopMessage=document.getElementById('stopMessage'),stopButton=document.getElementById('stopButton'),stopBack=document.getElementById('stopBack'),stopTarget=document.getElementById('stopTarget'),stopMarker=document.getElementById('stopMarker');
const blockEl=document.getElementById('blockGame'),blockBoard=document.getElementById('blockBoard'),blockPieces=document.getElementById('blockPieces'),blockScore=document.getElementById('blockScore'),blockMeta=document.getElementById('blockMeta');
const blockBack=document.getElementById('blockBack'),blockNew=document.getElementById('blockNew'),blockFinish=document.getElementById('blockFinish');
const mergeEl=document.getElementById('mergeGame'),mergeBoard=document.getElementById('mergeBoard'),mergeScore=document.getElementById('mergeScore'),mergeMeta=document.getElementById('mergeMeta'),mergeBack=document.getElementById('mergeBack'),mergeNew=document.getElementById('mergeNew'),mergeFinish=document.getElementById('mergeFinish');
const mergeUp=document.getElementById('mergeUp'),mergeDown=document.getElementById('mergeDown'),mergeLeft=document.getElementById('mergeLeft'),mergeRight=document.getElementById('mergeRight');
const fallEl=document.getElementById('fallGame'),fallBoard=document.getElementById('fallBoard'),fallScore=document.getElementById('fallScore'),fallMeta=document.getElementById('fallMeta'),fallBest=document.getElementById('fallBest'),fallNext=document.getElementById('fallNext'),fallHoldPreview=document.getElementById('fallHoldPreview'),fallHold=document.getElementById('fallHold'),fallBack=document.getElementById('fallBack'),fallLeft=document.getElementById('fallLeft'),fallRight=document.getElementById('fallRight'),fallRotate=document.getElementById('fallRotate'),fallSoft=document.getElementById('fallSoft'),fallDrop=document.getElementById('fallDrop'),fallNew=document.getElementById('fallNew'),fallFinish=document.getElementById('fallFinish');
const minesEl=document.getElementById('minesGame'),minesBoard=document.getElementById('minesBoard'),minesTime=document.getElementById('minesTime'),minesMeta=document.getElementById('minesMeta'),minesBack=document.getElementById('minesBack'),minesMode=document.getElementById('minesMode'),minesNew=document.getElementById('minesNew');
const stackEl=document.getElementById('stackGame'),stackArena=document.getElementById('stackArena'),stackBase=document.getElementById('stackBase'),stackMover=document.getElementById('stackMover'),stackScore=document.getElementById('stackScore'),stackMeta=document.getElementById('stackMeta'),stackBack=document.getElementById('stackBack'),stackDrop=document.getElementById('stackDrop'),stackNew=document.getElementById('stackNew');
const nonogramEl=document.getElementById('nonogramGame'),nonogramBoard=document.getElementById('nonogramBoard'),nonogramTime=document.getElementById('nonogramTime'),nonogramMeta=document.getElementById('nonogramMeta'),nonogramBack=document.getElementById('nonogramBack'),nonogramCheck=document.getElementById('nonogramCheck'),nonogramNew=document.getElementById('nonogramNew');
const memoryEl=document.getElementById('memoryGame'),memoryBoard=document.getElementById('memoryBoard'),memoryTime=document.getElementById('memoryTime'),memoryMeta=document.getElementById('memoryMeta'),memoryBack=document.getElementById('memoryBack'),memoryNew=document.getElementById('memoryNew');
const sortEl=document.getElementById('sortGame'),sortBoard=document.getElementById('sortBoard'),sortMoves=document.getElementById('sortMoves'),sortMeta=document.getElementById('sortMeta'),sortBest=document.getElementById('sortBest'),sortTime=document.getElementById('sortTime'),sortBack=document.getElementById('sortBack'),sortUndo=document.getElementById('sortUndo'),sortNew=document.getElementById('sortNew');
const slideEl=document.getElementById('slideGame'),slideBoard=document.getElementById('slideBoard'),slideMoves=document.getElementById('slideMoves'),slideMeta=document.getElementById('slideMeta'),slideBest=document.getElementById('slideBest'),slideTime=document.getElementById('slideTime'),slideBack=document.getElementById('slideBack'),slideNew=document.getElementById('slideNew');
const colorMatchEl=document.getElementById('colorMatchGame'),colorMatchProgress=document.getElementById('colorMatchProgress'),colorMatchTime=document.getElementById('colorMatchTime'),colorMatchBest=document.getElementById('colorMatchBest'),colorMatchWord=document.getElementById('colorMatchWord'),colorMatchChoices=document.getElementById('colorMatchChoices'),colorMatchBack=document.getElementById('colorMatchBack'),colorMatchStart=document.getElementById('colorMatchStart'),colorMatchNew=document.getElementById('colorMatchNew');
const numberRushEl=document.getElementById('numberRushGame'),numberRushBoard=document.getElementById('numberRushBoard'),numberRushProgress=document.getElementById('numberRushProgress'),numberRushTime=document.getElementById('numberRushTime'),numberRushMeta=document.getElementById('numberRushMeta'),numberRushBack=document.getElementById('numberRushBack'),numberRushStart=document.getElementById('numberRushStart'),numberRushNew=document.getElementById('numberRushNew');
const highLowEl=document.getElementById('highLowGame'),highLowCard=document.getElementById('highLowCard'),highLowPivot=document.getElementById('highLowPivot'),highLowLives=document.getElementById('highLowLives'),highLowTimerFill=document.getElementById('highLowTimerFill'),highLowTimerText=document.getElementById('highLowTimerText'),highLowStreak=document.getElementById('highLowStreak'),highLowMeta=document.getElementById('highLowMeta'),highLowBack=document.getElementById('highLowBack'),highLowStart=document.getElementById('highLowStart'),highLowNew=document.getElementById('highLowNew'),highLowHigher=document.getElementById('highLowHigher'),highLowLower=document.getElementById('highLowLower');
const simonEl=document.getElementById('simonGame'),simonBoard=document.getElementById('simonBoard'),simonRound=document.getElementById('simonRound'),simonMeta=document.getElementById('simonMeta'),simonMessage=document.getElementById('simonMessage'),simonBack=document.getElementById('simonBack'),simonStart=document.getElementById('simonStart'),simonNew=document.getElementById('simonNew'),simonPads=[...simonBoard.querySelectorAll('.simon-pad')];

let bootstrapData=null,saves={},appSettings={sound:true,reducedMotion:false,favorites:[]},audioCtx=null,libraryFilter='all';
let tapState='idle',tapShownAt=0,tapStartedAt=0,tapRunStartedAt=0,tapRoundStartedAt=0,tapTimer=null,tapSession=null,tapDaily=false;
let stopState='idle',stopSession=null,stopStartedAt=0,stopRunStartedAt=0,stopRaf=null,stopDaily=false;
let block=null,blockDrag=null,blockSuppressClick=false,merge=null,fallGame=null,fallGravityClock=null,fallSoftClock=null,mines=null,minesClock=null,mineSuppressClickUntil=0,stackGame=null,stackRaf=null,nonogram=null,nonogramClock=null,nonogramSuppressClickUntil=0,memory=null,memoryClock=null,memoryFlipTimer=null,sortGame=null,sortClock=null,slideGame=null,slideClock=null,colorMatch=null,colorMatchClock=null,numberRush=null,numberRushClock=null,highLow=null,highLowClock=null,simon=null,simonTimer=null,simonDaily=false,mergePointer=null,fallPointer=null;

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
 const favorites=Array.isArray(settings&&settings.favorites)?settings.favorites.map(String).filter(Boolean).slice(0,8):[];
 appSettings={sound:settings&&settings.sound!==false,reducedMotion:settings&&settings.reducedMotion===true,favorites:[...new Set(favorites)]};
 settingSound.checked=appSettings.sound;settingMotion.checked=appSettings.reducedMotion;
 document.body.classList.toggle('reduced-motion',appSettings.reducedMotion);
}
async function loadSettings(){
 const res=await FlecityBridge.call('profileGetSettings',{});
 if(res.ok){applySettings(res.settings);if(bootstrapData)renderGames(bootstrapData.games);}
}
async function saveSettings(){
 const res=await FlecityBridge.call('profileUpdateSettings',{sound:settingSound.checked,reducedMotion:settingMotion.checked});
 if(res.ok){applySettings(res.settings);tone(520,55);}else setStatus('設定を保存できません: '+FlecityErrors.text(res.error),'error');
}
settingSound.onchange=saveSettings;settingMotion.onchange=saveSettings;
let statusTimer=null;
function setStatus(text,type){
 clearTimeout(statusTimer);statusTimer=null;
 const inGame=document.body.classList.contains('game-active');
 if(type==='good'&&!/(ready|準備完了)/i.test(String(text)))tone();
 if(inGame){statusEl.textContent='';statusEl.className='status app-status hidden';return;}
 statusEl.textContent=text;statusEl.className='status app-status '+(type||'');
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
let appEpoch=0,startRequestCounter=0;
function newStartRequestId(){
 startRequestCounter=(startRequestCounter+1)%1000000000;
 return 'start-'+Date.now().toString(36)+'-'+startRequestCounter.toString(36);
}
async function startSessionWithRetry(payload){
 const snapshot=JSON.parse(JSON.stringify(payload||{}));
 snapshot.startRequestId=snapshot.startRequestId||newStartRequestId();
 const epoch=appEpoch;
 const retryable=new Set(['RATE_LIMIT','START_PENDING','NUI_REQUEST_FAILED','PHONE_CALLBACK_FAILED','CALLBACK_FAILED','EMPTY_RESPONSE','SERVER_ERROR']);
 let res={ok:false,error:'EMPTY_RESPONSE'};
 for(let attempt=0;attempt<3;attempt++){
   if(epoch!==appEpoch)return {ok:false,error:'APP_SUSPENDED'};
   res=await FlecityBridge.call('playStartSession',snapshot);
   if(res.ok){
     if(epoch!==appEpoch){
       await cancelPlaySession(res.sessionToken);
       return {ok:false,error:'APP_SUSPENDED'};
     }
     return res;
   }
   if(!retryable.has(res.error)){
     if(['DAILY_GAME_MISMATCH','DAILY_EXPIRED'].includes(res.error)){
       try{await refreshPlatform();}catch(_){}
     }
     return res;
   }
   if(attempt<2)await sleep(res.error==='RATE_LIMIT'?450:(res.error==='START_PENDING'?140:180*(attempt+1)));
 }
 return res;
}
async function submitScoreWithRetry(payload){
 const snapshot=JSON.parse(JSON.stringify(payload));
 const retryable=new Set(['RATE_LIMIT','NUI_REQUEST_FAILED','PHONE_CALLBACK_FAILED','CALLBACK_FAILED','EMPTY_RESPONSE','SCORE_SAVE_FAILED','SERVER_ERROR']);
 let res={ok:false,error:'EMPTY_RESPONSE'};
 for(let attempt=0;attempt<3;attempt++){
   res=await FlecityBridge.call('playSubmitScore',snapshot);
   if(res.ok)return res;
   if(!retryable.has(res.error)){
     if(['DAILY_GAME_MISMATCH','DAILY_EXPIRED'].includes(res.error)){
       try{await refreshPlatform();}catch(_){}
     }
     return res;
   }
   if(attempt<2)await sleep(res.error==='RATE_LIMIT'?800:(res.error==='SCORE_SAVE_FAILED'?600:240)*(attempt+1));
 }
 return res;
}
function scrollAppTop(){window.scrollTo({top:0,behavior:appSettings.reducedMotion?'auto':'smooth'});}
function resetTransientInputState(){
 blockDrag=null;blockSuppressClick=false;mergePointer=null;fallPointer=null;
 clearBlockDragVisual();
}
function hideAll(){
 document.body.classList.add('game-active');
 clearTimeout(statusTimer);statusTimer=null;statusEl.textContent='';statusEl.className='status app-status hidden';
 homeEl.classList.add('hidden');quickEl.classList.add('hidden');stopEl.classList.add('hidden');blockEl.classList.add('hidden');mergeEl.classList.add('hidden');fallEl.classList.add('hidden');minesEl.classList.add('hidden');stackEl.classList.add('hidden');nonogramEl.classList.add('hidden');memoryEl.classList.add('hidden');sortEl.classList.add('hidden');slideEl.classList.add('hidden');colorMatchEl.classList.add('hidden');numberRushEl.classList.add('hidden');highLowEl.classList.add('hidden');simonEl.classList.add('hidden');scrollAppTop();
}
function showHome(){
 clearTimeout(tapTimer);clearTimeout(memoryFlipTimer);clearTimeout(simonTimer);cancelAnimationFrame(stopRaf);cancelAnimationFrame(stackRaf);clearInterval(fallGravityClock);clearInterval(fallSoftClock);clearInterval(minesClock);clearInterval(nonogramClock);clearInterval(memoryClock);clearInterval(sortClock);clearInterval(slideClock);clearInterval(colorMatchClock);clearInterval(numberRushClock);clearInterval(highLowClock);fallGravityClock=null;fallSoftClock=null;minesClock=null;nonogramClock=null;memoryClock=null;sortClock=null;slideClock=null;colorMatchClock=null;numberRushClock=null;highLowClock=null;memoryFlipTimer=null;simonTimer=null;
 resetTransientInputState();
 tapState='idle';tapSession=null;stopState='idle';stopSession=null;
 hideAll();homeEl.classList.remove('hidden');document.body.classList.remove('game-active');renderGames(bootstrapData&&bootstrapData.games);
 continueGames.scrollLeft=0;recentGames.scrollLeft=0;
}
function gameById(id){return (bootstrapData&&bootstrapData.games||[]).find(g=>g.id===id);}
function formatGameScore(game,value){
 const n=Number(value);if(!Number.isFinite(n))return '---';
 if(game&&['stack','stop'].includes(game.id))return Math.round(n).toLocaleString()+' pts';
 return game&&game.rankingOrder==='asc'?(n>=1000?(n/1000).toFixed(3)+' s':n.toFixed(3)+' ms'):String(n);
}
function formatDuration(ms){
 const total=Math.max(0,Math.floor(Number(ms)||0)),seconds=Math.floor(total/1000),minutes=Math.floor(seconds/60),hours=Math.floor(minutes/60);
 if(hours>0)return hours+'h '+(minutes%60)+'m';
 if(minutes>0)return minutes+'m '+(seconds%60)+'s';
 return seconds+'s';
}
function personalBestText(gameId){
 const game=gameById(gameId),row=bootstrapData&&bootstrapData.best&&bootstrapData.best[gameId];
 return row&&game?formatGameScore(game,row.score):'---';
}
function activeDailyGame(gameId){
 if(gameId==='quick_tap')return tapDaily===true;
 if(gameId==='stop')return stopDaily===true;
 if(gameId==='block')return !!(block&&block.daily);
 if(gameId==='mines')return !!(mines&&mines.daily);
 if(gameId==='nonogram')return !!(nonogram&&nonogram.daily);
 if(gameId==='memory')return !!(memory&&memory.daily);
 if(gameId==='number_rush')return !!(numberRush&&numberRush.daily);
 if(gameId==='color_match')return !!(colorMatch&&colorMatch.daily)||colorMatchEl.dataset.daily==='1';
 if(gameId==='slide')return !!(slideGame&&slideGame.daily);
 if(gameId==='simon')return !!(simon&&simon.daily)||simonDaily===true;
 return false;
}
function dailyBestText(gameId){
 const daily=bootstrapData&&bootstrapData.daily,game=gameById(gameId);
 const row=daily&&daily.gameId===gameId&&daily.selfBest;
 return row&&game?formatGameScore(game,row.score):'---';
}
const screenBestIds={
 quick_tap:'tapBest',stop:'stopBest',stack:'stackBest',block:'blockBest',merge:'mergeBest',fall:'fallBest',mines:'minesBest',
 nonogram:'nonogramBest',memory:'memoryBest',sort:'sortBest',slide:'slideBest',color_match:'colorMatchBest',number_rush:'numberRushBest',
 high_low:'highLowBest',simon:'simonBest'
};
function refreshScreenBests(){
 Object.entries(screenBestIds).forEach(([gameId,elementId])=>{
   const el=document.getElementById(elementId);
   if(el)el.textContent=(activeDailyGame(gameId)?'TODAY BEST '+dailyBestText(gameId):'BEST '+personalBestText(gameId));
 });
}
function competitionRank(rows,index){
 if(index<=0)return 1;
 const score=Number(rows[index]&&rows[index].score);
 let first=index;
 while(first>0&&Number(rows[first-1]&&rows[first-1].score)===score)first-=1;
 return first+1;
}
const categoryLabels={quick:'クイック',arcade:'アーケード',endless:'エンドレス',puzzle:'パズル'};
const categoryOrder=['quick','arcade','endless','puzzle'];
const gameVisuals={
 quick_tap:{icon:'icons/quick-tap.svg',symbol:'⚡',eyebrow:'REFLEX'},stop:{icon:'icons/stop.svg',symbol:'◎',eyebrow:'TIMING'},
 color_match:{icon:'icons/color-match.svg',symbol:'A',eyebrow:'FOCUS'},number_rush:{icon:'icons/number-rush.svg',symbol:'25',eyebrow:'SPEED'},
 stack:{icon:'icons/tower.svg',symbol:'▤',eyebrow:'PRECISION'},high_low:{icon:'icons/range-rush.svg',symbol:'↕',eyebrow:'SPEED'},simon:{icon:'icons/simon.svg',symbol:'◆',eyebrow:'MEMORY'},
 block:{icon:'icons/block.svg',symbol:'▦',eyebrow:'BUILD'},merge:{icon:'icons/merge.svg',symbol:'2ⁿ',eyebrow:'MERGE'},fall:{icon:'icons/fall.svg',symbol:'▣',eyebrow:'ENDLESS'},mines:{icon:'icons/mines.svg',symbol:'✹',eyebrow:'LOGIC'},
 nonogram:{icon:'icons/nonogram.svg',symbol:'▩',eyebrow:'PUZZLE'},memory:{icon:'icons/memory.svg',symbol:'◈',eyebrow:'PAIR'},sort:{icon:'icons/sort.svg',symbol:'⇅',eyebrow:'SORT'},slide:{icon:'icons/slide.svg',symbol:'15',eyebrow:'SLIDE'}
};
function setGameIcon(el,visual){
 el.replaceChildren();
 if(visual&&visual.icon){
   const img=document.createElement('img');img.src=visual.icon;img.alt='';img.draggable=false;
   img.onerror=()=>{el.textContent=visual.symbol||'•';};
   el.appendChild(img);
 }else{
   el.textContent=visual&&visual.symbol||'•';
 }
}

const rankTargets={
 quick_tap:{order:'asc',S:250,A:350,B:500},stop:{order:'desc',S:16000,A:8000,B:3500},
 stack:{order:'desc',S:12000,A:7000,B:3500},block:{order:'desc',S:5000,A:2500,B:1000},merge:{order:'desc',S:15000,A:7000,B:3000},fall:{order:'desc',S:12000,A:6000,B:2500},
 mines:{order:'asc',S:45000,A:75000,B:120000},nonogram:{order:'asc',S:25000,A:45000,B:75000},
 memory:{order:'asc',S:20000,A:30000,B:45000},sort:{order:'asc',S:45000,A:75000,B:120000},slide:{order:'asc',S:60000,A:120000,B:240000},color_match:{order:'asc',S:7000,A:10000,B:15000},
 number_rush:{order:'asc',S:15000,A:22000,B:35000},high_low:{order:'desc',S:18000,A:12000,B:6000},simon:{order:'desc',S:15,A:10,B:5}
};
function rankForScore(gameId,score){
 const cfg=rankTargets[gameId],n=Number(score);if(!cfg||!Number.isFinite(n))return null;
 if(cfg.order==='asc'){
   if(n<=cfg.S)return 'S';if(n<=cfg.A)return 'A';if(n<=cfg.B)return 'B';return 'C';
 }
 if(n>=cfg.S)return 'S';if(n>=cfg.A)return 'A';if(n>=cfg.B)return 'B';return 'C';
}
function nextRankGoal(gameId,score){
 const cfg=rankTargets[gameId];if(!cfg)return null;
 const rank=rankForScore(gameId,score);
 if(rank==='S')return {rank:'S',done:true,target:cfg.S};
 if(rank==='A')return {rank:'S',target:cfg.S};
 if(rank==='B')return {rank:'A',target:cfg.A};
 return {rank:'B',target:cfg.B};
}
function rankClass(rank){return rank?'rank-'+String(rank).toLowerCase():'';}
function liveRankUpPrefix(gameId,beforeScore,afterScore){
 const before=rankForScore(gameId,beforeScore),after=rankForScore(gameId,afterScore),order={C:0,B:1,A:2,S:3};
 if(!before||!after)return '';
 return (order[after]||0)>(order[before]||0)?'RANK UP '+after+' · ':'';
}
const achievementLabels={
 first_play:'FIRST PLAY · 初めて記録を残す',
 '100_games':'100 GAMES · 100回プレイ',
 lightning:'LIGHTNING · QUICK TAP 200ms以下',
 stack_master:'TOWER MASTER · TOWER 25段以上',
 block_master:'BLOCK MASTER · BLOCK 5,000点以上',
 perfect_memory:'PERFECT MEMORY · MEMORYを8手でクリア',
 number_rush_ace:'NUMBER ACE · NUMBER RUSHをノーミス16秒以内',
 high_low_streak:'RANGE MASTER · RANGE RUSH 10問連続正解',
 bullseye:'BULLSEYE · STOP!でBULLSEYEを1回',
 merge_master:'MERGE MASTER · 2048タイル到達',
 mines_sprinter:'MINES SPRINTER · 60秒以内クリア',
 nonogram_solver:'LOGIC SOLVER · NONOGRAM 60秒以内',
 color_focus:'COLOR FOCUS · COLOR MATCHをノーミス14秒以内',
 simon_master:'SIMON MASTER · 15ラウンド到達',
 slide_master:'SLIDE MASTER · 90秒・120手以内でクリア',
 fall_master:'FALL MASTER · 20ライン以上消して記録'
};
function previousBestRow(gameId,daily){
 return daily?(bootstrapData&&bootstrapData.daily&&bootstrapData.daily.selfBest):(bootstrapData&&bootstrapData.best&&bootstrapData.best[gameId]);
}
function scoreBeatsPrevious(gameId,score,daily){
 const game=gameById(gameId);if(!game)return false;
 const previous=previousBestRow(gameId,daily);
 if(!previous||!Number.isFinite(Number(previous.score)))return true;
 const current=Number(score),old=Number(previous.score);
 return game.rankingOrder==='asc'?current<old:current>old;
}
function personalBestGainText(gameId,score,daily){
 const game=gameById(gameId),previous=previousBestRow(gameId,daily);
 if(!game||!previous||!Number.isFinite(Number(previous.score)))return null;
 const current=Number(score),old=Number(previous.score);
 if(!Number.isFinite(current))return null;
 const gain=game.rankingOrder==='asc'?old-current:current-old;
 if(gain<=0)return null;
 if(game.rankingOrder==='asc')return gain>=1000?(gain/1000).toFixed(3)+'s':gain.toFixed(1)+'ms';
 if(['stack','stop','high_low'].includes(gameId))return Math.round(gain).toLocaleString()+' pts';
 if(gameId==='simon')return Math.round(gain)+' round';
 return Math.round(gain).toLocaleString();
}
function showScoreResult(gameId,res,message){
 const parts=[],rank=rankForScore(gameId,res.score),isNewBest=scoreBeatsPrevious(gameId,res.score,res.daily===true);
 if(rank)parts.push(rank+' RANK');
 if(isNewBest){
   const gain=personalBestGainText(gameId,res.score,res.daily===true);
   parts.push('NEW BEST'+(gain?' · PB +'+gain:''));
 }
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
 const unlockedIds=new Set(achievements.map(a=>String(a.achievement_id||'')));
 const achievementEntries=Object.entries(achievementLabels);
 const knownUnlocked=achievementEntries.reduce((count,[id])=>count+(unlockedIds.has(id)?1:0),0);
 achievementCount.textContent=String(knownUnlocked)+'/'+String(achievementEntries.length);
 achievementEntries.forEach(([id,label])=>{
   const unlocked=unlockedIds.has(id);
   const d=document.createElement('div'),left=document.createElement('span'),right=document.createElement('strong');
   d.className='player achievement-row'+(unlocked?' unlocked':' locked');
   left.textContent=String(label);right.textContent=unlocked?'✓':'LOCK';
   d.append(left,right);achievementRows.appendChild(d);
 });
 const daily=data&&data.daily;
 if(!daily){dailyCard.classList.add('hidden');return;}
 dailyCard.classList.remove('hidden');dailyGame.textContent=daily.game&&daily.game.name||daily.gameId;
 const dailyIconEl=document.getElementById('dailyIcon'),dailyVisual=gameVisuals[daily.gameId]||{symbol:'◆'};
 if(dailyIconEl)setGameIcon(dailyIconEl,dailyVisual);
 const streak=daily.streak||{},streakCount=Math.max(0,Number(streak.count)||0),nextCount=Math.max(1,Number(streak.nextCount)||1);

 const game=daily.game||gameById(daily.gameId);
 const dailyCategory=game&&categoryLabels[game.category]?categoryLabels[game.category]:'CHALLENGE';
 const streakText=streak.completedToday?(streakCount+'日連続'):(streakCount>0?(streakCount+'日継続中 · 今日で'+nextCount+'日'):'今日から連続記録スタート');
 dailyDate.textContent=dailyCategory+' · '+String(daily.date||'')+' · '+streakText;
 if(daily.selfBest){
   const dailyRank=rankForScore(daily.gameId,daily.selfBest.score),goal=nextRankGoal(daily.gameId,daily.selfBest.score);
   dailyBest.textContent='あなたの今日BEST · '+formatGameScore(game,daily.selfBest.score)+(dailyRank?' · '+dailyRank+' RANK':'')+(daily.selfRank?' · #'+String(daily.selfRank):'')+(goal&&!goal.done?' · NEXT '+goal.rank+' '+formatGameScore(game,goal.target):' · MAX RANK');
 }else dailyBest.textContent='今日はまだ挑戦していません。最初の記録を残そう。';
 dailyRanking.innerHTML='';
 const dailyTop=(daily.ranking||[]).slice(0,5);
 let selfVisible=false;
 dailyTop.forEach((r,i)=>{
   const d=document.createElement('div'),left=document.createElement('span'),right=document.createElement('strong');
   const isSelf=Number(r.is_self)===1;selfVisible=selfVisible||isSelf;
   d.className='player'+(isSelf?' self-rank-row':'');
   left.textContent='#'+competitionRank(dailyTop,i)+' '+(isSelf?'あなた':String(r.display_name||'Player'));
   right.textContent=formatGameScore(game,r.score);d.append(left,right);dailyRanking.appendChild(d);
 });
 if(daily.selfBest&&daily.selfRank&&!selfVisible){
   const d=document.createElement('div'),left=document.createElement('span'),right=document.createElement('strong');
   d.className='player self-rank-row';left.textContent='#'+String(daily.selfRank)+' あなた';right.textContent=formatGameScore(game,daily.selfBest.score);d.append(left,right);dailyRanking.appendChild(d);
 }
}
async function refreshPlatform(){
 const res=await FlecityBridge.call('playStatistics',{});if(!res.ok)return;
 bootstrapData.statistics=res.statistics;bootstrapData.achievements=res.achievements;bootstrapData.daily=res.daily;bootstrapData.best=res.best||bootstrapData.best||{};renderPlatform(res);renderGames(bootstrapData.games);renderRankingSelf();
}
let launchLocked=false;
async function withLaunchLock(fn){
 if(launchLocked)return;
 launchLocked=true;dailyPlay.disabled=true;
 try{await fn();}finally{launchLocked=false;dailyPlay.disabled=false;}
}
async function launchDaily(){
 const daily=bootstrapData&&bootstrapData.daily;if(!daily)return;
 await withLaunchLock(async()=>{
   if(daily.gameId==='quick_tap')showQuick(true);
   else if(daily.gameId==='stop')openStop(true);
   else if(daily.gameId==='block')await openBlock(true,true);
   else if(daily.gameId==='mines')await openMines(true,true);
   else if(daily.gameId==='nonogram')await openNonogram(true,true);
   else if(daily.gameId==='memory')await openMemory(true);
   else if(daily.gameId==='number_rush')openNumberRush(true);
   else if(daily.gameId==='color_match')openColorMatch(true);
   else if(daily.gameId==='slide')await openSlide(true,true);
   else if(daily.gameId==='simon')openSimon(true);
 });
}
dailyPlay.onclick=launchDaily;

async function launchGame(gameId){
 await withLaunchLock(async()=>{
   if(gameId==='quick_tap')showQuick();
   else if(gameId==='stop')openStop();
   else if(gameId==='block')await openBlock(false);
   else if(gameId==='merge')await openMerge(false);
   else if(gameId==='fall')await openFall(false);
   else if(gameId==='mines')await openMines(false);
   else if(gameId==='stack')await openStack();
   else if(gameId==='nonogram')await openNonogram(false);
   else if(gameId==='memory')await openMemory();
   else if(gameId==='sort')await openSort(false);
   else if(gameId==='slide')await openSlide(false);
   else if(gameId==='color_match')openColorMatch();
   else if(gameId==='number_rush')openNumberRush(false);
   else if(gameId==='high_low')openHighLow();
   else if(gameId==='simon')openSimon();
 });
}
function renderRecent(games){
 const stats=bootstrapData&&bootstrapData.statistics&&Array.isArray(bootstrapData.statistics.games)?bootstrapData.statistics.games:[];
 const byGame=new Map(stats.map(stat=>[String(stat.gameId||''),stat]));
 const recent=(games||[])
   .map(game=>({game,stat:byGame.get(game.id)}))
   .filter(item=>item.stat&&Number(item.stat.playCount)>0&&item.stat.lastPlayedAt)
   .sort((a,b)=>String(b.stat.lastPlayedAt).localeCompare(String(a.stat.lastPlayedAt)))
   .slice(0,3);
 recentGames.innerHTML='';recentCount.textContent=String(recent.length);recentCard.classList.toggle('hidden',recent.length===0);
 recent.forEach(({game,stat})=>{
   const button=document.createElement('button');button.className='continue-game recent-game';button.dataset.game=game.id;
   const visual=gameVisuals[game.id]||{symbol:'▶',eyebrow:'RECENT'};
   const top=document.createElement('span'),icon=document.createElement('span'),text=document.createElement('span'),meta=document.createElement('span');
   top.className='continue-top';icon.className='continue-icon';setGameIcon(icon,visual);text.textContent=String(game.name||game.id);meta.className='muted';
   const best=Number.isFinite(Number(stat.bestScore))?formatGameScore(game,stat.bestScore):'---';
   meta.textContent=String(stat.playCount||0)+'回プレイ · BEST '+best;
   top.append(icon,text);button.append(top,meta);button.onclick=()=>launchGame(game.id);recentGames.appendChild(button);
 });
}
function favoriteGameIds(){return new Set((appSettings.favorites||[]).map(String));}
function isFavoriteGame(gameId){return favoriteGameIds().has(String(gameId||''));}
async function toggleFavorite(gameId){
 const id=String(gameId||'');if(!id)return;
 const previous=[...(appSettings.favorites||[])],next=new Set(previous);
 if(next.has(id))next.delete(id);else if(next.size<8)next.add(id);else{setStatus('お気に入りは8本までです。','warn');return;}
 appSettings.favorites=[...next];renderGames(bootstrapData&&bootstrapData.games);
 const res=await FlecityBridge.call('profileUpdateSettings',{favorites:appSettings.favorites});
 if(res.ok){applySettings(res.settings);renderGames(bootstrapData&&bootstrapData.games);tone(next.has(id)?760:420,55);}
 else{appSettings.favorites=previous;renderGames(bootstrapData&&bootstrapData.games);setStatus('お気に入りを保存できません: '+FlecityErrors.text(res.error),'error');}
}
function filteredLibraryGames(games){
 const enabled=(games||[]).filter(g=>g.app==='play'&&g.enabled);
 if(libraryFilter==='all')return enabled;
 if(libraryFilter==='favorites'){
   const favorites=favoriteGameIds();return enabled.filter(g=>favorites.has(g.id));
 }
 return enabled.filter(g=>String(g.category||'other')===libraryFilter);
}
function updateLibraryControls(allGames,visibleGames){
 const total=allGames.length,visible=visibleGames.length;
 gameCount.textContent=libraryFilter==='all'?String(total):(String(visible)+'/'+String(total));
 randomPlay.disabled=visible===0;
 [...libraryFilters.querySelectorAll('.library-filter')].forEach(button=>{
   const active=button.dataset.filter===libraryFilter;
   button.classList.toggle('active',active);button.setAttribute('aria-pressed',active?'true':'false');
 });
}
libraryFilters.onclick=event=>{
 const button=event.target.closest('.library-filter');if(!button||!libraryFilters.contains(button))return;
 const next=String(button.dataset.filter||'all');
 if(next===libraryFilter)return;
 libraryFilter=next;renderGames(bootstrapData&&bootstrapData.games);
};
randomPlay.onclick=()=>{
 const visible=filteredLibraryGames(bootstrapData&&bootstrapData.games);
 if(!visible.length)return;
 const game=visible[Math.floor(Math.random()*visible.length)];
 if(game)void launchGame(game.id);
};

function enableHorizontalDragScroll(element){
 if(!element||element.dataset.dragScroll==='1')return;
 element.dataset.dragScroll='1';
 let drag=null,suppressClickUntil=0;
 element.addEventListener('pointerdown',event=>{
   if(event.pointerType==='mouse'&&event.button!==0)return;
   drag={id:event.pointerId,startX:event.clientX,startY:event.clientY,startScroll:element.scrollLeft,horizontal:false,captured:false};
 });
 element.addEventListener('pointermove',event=>{
   if(!drag||event.pointerId!==drag.id)return;
   const dx=event.clientX-drag.startX,dy=event.clientY-drag.startY;
   if(!drag.horizontal){
     if(Math.abs(dx)<8)return;
     if(Math.abs(dx)<=Math.abs(dy))return;
     drag.horizontal=true;element.classList.add('is-dragging');
     try{element.setPointerCapture(event.pointerId);drag.captured=true;}catch(_){}
   }
   element.scrollLeft=drag.startScroll-dx;
 });
 const finishDrag=event=>{
   if(!drag||event.pointerId!==drag.id)return;
   if(drag.horizontal)suppressClickUntil=performance.now()+350;
   const captured=drag.captured;drag=null;element.classList.remove('is-dragging');
   if(captured){try{element.releasePointerCapture(event.pointerId);}catch(_){}}
 };
 element.addEventListener('pointerup',finishDrag);
 element.addEventListener('pointercancel',finishDrag);
 element.addEventListener('click',event=>{
   if(performance.now()<suppressClickUntil){event.preventDefault();event.stopPropagation();}
 },true);
}
enableHorizontalDragScroll(continueGames);
enableHorizontalDragScroll(recentGames);

function renderContinue(games){
 const resumable=(games||[]).filter(game=>game.app==='play'&&game.enabled&&saves[game.id]);
 continueGames.innerHTML='';continueCount.textContent=String(resumable.length);
 continueCard.classList.toggle('hidden',resumable.length===0);
 resumable.forEach(game=>{
   const button=document.createElement('button');button.className='continue-game';button.dataset.game=game.id;
   const visual=gameVisuals[game.id]||{symbol:'▶',eyebrow:'CONTINUE'};
   const top=document.createElement('span'),icon=document.createElement('span'),text=document.createElement('span'),meta=document.createElement('span');
   top.className='continue-top';icon.className='continue-icon';setGameIcon(icon,visual);text.textContent=String(game.name||game.id);meta.className='muted';top.append(icon,text);
   const save=saves[game.id]||{};
   meta.textContent=(Number(save.elapsed_ms)>0?formatDuration(save.elapsed_ms)+' · ':'')+'続きから';
   button.append(top,meta);button.onclick=()=>launchGame(game.id);continueGames.appendChild(button);
 });
}
function renderGames(games){
 refreshScreenBests();
 gamesEl.innerHTML='';
 const enabled=(games||[]).filter(g=>g.app==='play'&&g.enabled);
 const visible=filteredLibraryGames(enabled);
 renderContinue(enabled);renderRecent(enabled);updateLibraryControls(enabled,visible);
 const groups=new Map();
 visible.forEach(game=>{
   const category=String(game.category||'other');
   if(!groups.has(category))groups.set(category,[]);
   groups.get(category).push(game);
 });
 const ordered=[...categoryOrder.filter(key=>groups.has(key)),...([...groups.keys()].filter(key=>!categoryOrder.includes(key)))];
 if(!ordered.length){
   const empty=document.createElement('div');empty.className='library-empty muted';empty.textContent='このカテゴリのゲームはありません。';gamesEl.appendChild(empty);return;
 }
 ordered.forEach(category=>{
   const section=document.createElement('section');section.className='game-category';
   const head=document.createElement('div');head.className='category-head';
   const title=document.createElement('strong');title.textContent=categoryLabels[category]||category.toUpperCase();
   const count=document.createElement('span');count.className='muted';count.textContent=String(groups.get(category).length)+' GAMES';
   head.append(title,count);
   const grid=document.createElement('div');grid.className='grid';
   groups.get(category).forEach(game=>{
     const btn=document.createElement('button');btn.className='game';btn.dataset.game=game.id;
     const hasSave=!!saves[game.id],visual=gameVisuals[game.id]||{symbol:'•',eyebrow:'PLAY'};
     const top=document.createElement('span'),icon=document.createElement('span'),tag=document.createElement('span'),favorite=document.createElement('span'),name=document.createElement('strong'),description=document.createElement('span'),bestLine=document.createElement('span'),meta=document.createElement('span');
     top.className='game-card-top';icon.className='game-icon';tag.className='tag';favorite.className='favorite-toggle'+(isFavoriteGame(game.id)?' active':'');description.className='muted';bestLine.className='game-best';meta.className='game-card-meta';
     setGameIcon(icon,visual);tag.textContent=hasSave?'CONTINUE':(game.supportsDaily?'DAILY':visual.eyebrow);
     favorite.textContent=isFavoriteGame(game.id)?'★':'☆';favorite.title=isFavoriteGame(game.id)?'お気に入りから外す':'お気に入りに追加';favorite.setAttribute('aria-label',favorite.title);
     favorite.onclick=event=>{event.preventDefault();event.stopPropagation();void toggleFavorite(game.id);};
     top.append(icon,tag,favorite);
     name.textContent=String(game.name||game.id||'GAME');
     description.textContent=String(game.description||'');
     const personalBest=bootstrapData&&bootstrapData.best&&bootstrapData.best[game.id],rank=personalBest?rankForScore(game.id,personalBest.score):null;
     if(game.supportsRanking){
       bestLine.textContent=personalBest?'BEST · '+formatGameScore(game,personalBest.score):'BEST · ---';
       if(rank){
         const badge=document.createElement('span');badge.className='rank-badge '+rankClass(rank);badge.textContent=rank;bestLine.append(' ',badge);
       }
     }else bestLine.textContent='';
     const traits=[];if(game.supportsResume)traits.push('SAVE');
     const goal=nextRankGoal(game.id,personalBest&&personalBest.score);
     if(game.supportsRanking&&goal){
       if(goal.done)traits.push('MAX RANK');
       else traits.push('NEXT '+goal.rank+' · '+formatGameScore(game,goal.target));
     }
     meta.textContent=traits.join(' · ');
     btn.append(top,name,description,bestLine,meta);btn.onclick=()=>launchGame(game.id);grid.appendChild(btn);
   });
   section.append(head,grid);gamesEl.appendChild(section);
 });
}
function rankingPeriodLabel(period){
 if(period==='today')return '今日';
 if(period==='week')return '7日間';
 return '全期間';
}
function renderRankingSelf(){
 const gameId=rankingGame.value,game=gameById(gameId),period=rankingPeriod.value;
 if(!game){rankingSelf.textContent='ゲームを選択してください。';return;}
 if(period!=='all'){rankingSelf.textContent='あなたの'+rankingPeriodLabel(period)+'BEST · ランキングを見ると表示します';return;}
 const best=bootstrapData&&bootstrapData.best&&bootstrapData.best[gameId];
 rankingSelf.textContent=best?'あなたの全期間BEST · '+formatGameScore(game,best.score):'あなたの全期間BEST · まだ記録がありません';
}
function populateRankingGames(games){
 const current=rankingGame.value;rankingGame.innerHTML='';
 (games||[]).filter(g=>g.app==='play'&&g.enabled&&g.supportsRanking).forEach(g=>{const o=document.createElement('option');o.value=g.id;o.textContent=g.name;rankingGame.appendChild(o);});
 if([...rankingGame.options].some(o=>o.value===current))rankingGame.value=current;
 renderRankingSelf();
}
async function loadRanking(){
 const gameId=rankingGame.value;if(!gameId)return;
 rankingLoad.disabled=true;rankingRows.innerHTML='<div class="muted">読み込み中…</div>';
 const res=await FlecityBridge.call('playRanking',{gameId,period:rankingPeriod.value});
 rankingLoad.disabled=false;rankingRows.innerHTML='';
 if(!res.ok){rankingRows.innerHTML='<div class="status error">ランキング取得失敗: '+FlecityErrors.text(res.error)+'</div>';return;}
 const game=(bootstrapData&&bootstrapData.games||[]).find(g=>g.id===gameId);
 const self=res.self||{};
 if(Number.isFinite(Number(self.score))){
   rankingSelf.textContent='あなたの'+rankingPeriodLabel(res.period)+'BEST · '+formatGameScore(game,self.score)+(Number(self.rank)>0?' · #'+String(self.rank):'');
 }else{
   rankingSelf.textContent='あなたの'+rankingPeriodLabel(res.period)+'BEST · まだ記録がありません';
 }
 if(!(res.rows||[]).length){rankingRows.innerHTML='<div class="muted">まだ記録がありません。</div>';return;}
 let selfVisible=false;
 res.rows.forEach((r,i)=>{
   const d=document.createElement('div');
   const isSelf=Number(r.is_self)===1;selfVisible=selfVisible||isSelf;
   d.className='player'+(isSelf?' self-rank-row':'');
   const left=document.createElement('span'),right=document.createElement('strong');
   left.textContent='#'+competitionRank(res.rows,i)+' '+(isSelf?'あなた':String(r.display_name||'Player'));
   right.textContent=formatGameScore(game,r.score);
   d.append(left,right);rankingRows.appendChild(d);
 });
 if(Number.isFinite(Number(self.score))&&Number(self.rank)>0&&!selfVisible){
   const d=document.createElement('div'),left=document.createElement('span'),right=document.createElement('strong');
   d.className='player self-rank-row';left.textContent='#'+String(self.rank)+' あなた';right.textContent=formatGameScore(game,self.score);d.append(left,right);rankingRows.appendChild(d);
 }
}
rankingLoad.onclick=loadRanking;
rankingGame.onchange=()=>{renderRankingSelf();rankingRows.innerHTML='';};
rankingPeriod.onchange=()=>{renderRankingSelf();rankingRows.innerHTML='';};
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
function quickTapGrade(ms){
 const n=Number(ms);
 if(n<=180)return {label:'神速',state:'legend',tone:980};
 if(n<=230)return {label:'LIGHTNING',state:'elite',tone:900};
 if(n<=320)return {label:'FAST',state:'fast',tone:820};
 if(n<=500)return {label:'GOOD',state:'good',tone:700};
 return {label:'KEEP TRYING',state:'steady',tone:520};
}
function setQuickVisual(state){quickEl.dataset.state=state||'idle';}
function renderQuickMeta(){
 if(!tapSession){tapRunMeta.textContent='HIT 0 / 7 · ♥♥♥ · FALSE 0';return;}
 tapRunMeta.textContent='HIT '+String(tapSession.hits||0)+' / '+String(tapSession.targetHits||7)+' · '+'♥'.repeat(Math.max(0,tapSession.lives||0))+' · FALSE '+String(tapSession.falseStarts||0)+((tapSession.focusStreak||0)>=2?' · FOCUS ×'+String(tapSession.focusStreak):'');
}
function beginQuickRound(challenge){
 clearTimeout(tapTimer);
 if(!tapSession||!challenge)return;
 tapSession.currentChallenge=challenge;tapState='waiting';setQuickVisual('waiting');tapRoundStartedAt=performance.now();
 tapMessage.textContent='待って';tapButton.textContent='待って…';tapButton.disabled=false;renderQuickMeta();
 const delay=Math.max(250,Number(challenge.delayMs)||1500);
 tapTimer=setTimeout(()=>{
   if(tapState!=='waiting'||!tapSession)return;
   tapState='shown';setQuickVisual('go');tapShownAt=performance.now();tapMessage.textContent='タップ!';tapButton.textContent='タップ!';tone(980,45);
 },delay);
}
async function sendQuickRound(actionMs,step){
 const payload={sessionToken:tapSession&&tapSession.sessionToken,actionMs,step};
 const retryable=new Set(['RATE_LIMIT','NUI_REQUEST_FAILED','PHONE_CALLBACK_FAILED','CALLBACK_FAILED','EMPTY_RESPONSE','SERVER_ERROR']);
 let res={ok:false,error:'EMPTY_RESPONSE'};
 for(let attempt=0;attempt<3;attempt++){
   res=await FlecityBridge.call('playQuickRound',payload);
   if(res.ok||!retryable.has(res.error))return res;
   if(attempt<2)await sleep(res.error==='RATE_LIMIT'?180:140*(attempt+1));
 }
 return res;
}
async function finishQuickRun(result){
 const game=tapSession;if(!game)return;
 if(result&&result.failed){
   await cancelPlaySession(game.sessionToken);
   if(tapSession===game){
     tapState='idle';tapSession=null;setQuickVisual('false-start');tapMessage.textContent='GAME OVER';
     tapRunMeta.textContent='3回フライング · 記録なし';tapButton.textContent='もう一度';tapButton.disabled=false;tone(180,100);
   }
   return;
 }
 tapState='submitting';tapButton.disabled=true;
 const durationMs=Math.max(0,Math.round(performance.now()-tapRunStartedAt));
 const score=Number(result&&result.score);
 const res=await submitScoreWithRetry({sessionToken:game.sessionToken,score,durationMs,quickRun:true});
 const stillHere=tapSession===game;
 if(res.ok){
   if(stillHere){
     const average=Number(res.details&&res.details.averageMs)||score,grade=quickTapGrade(average);
     setQuickVisual('result-'+grade.state);tapMessage.textContent=average.toFixed(1)+' ms AVG';
     tapRunMeta.textContent='7 / 7 · FALSE '+String(Number(res.details&&res.details.falseStarts)||0)+' · BEST '+Number(res.details&&res.details.bestReactionMs||average).toFixed(1)+' ms';
     tone(grade.tone,90);
     showScoreResult('quick_tap',res,(res.daily?'デイリー · ':'')+'QUICK TAP FOCUS · AVG '+average.toFixed(1)+' ms · SCORE '+Number(res.score).toFixed(1)+' ms · MAX FOCUS ×'+String(game.maxFocusStreak||0));
   }
   await refreshPlatform();
 }else{
   await cancelPlaySession(game.sessionToken);
   if(stillHere){tapMessage.textContent='保存できませんでした';setStatus('QUICK TAP FOCUSの記録を保存できませんでした: '+FlecityErrors.text(res.error),'error');}
 }
 if(stillHere){tapState='idle';tapSession=null;tapButton.textContent='もう一度';tapButton.disabled=false;}
}
async function resolveQuickTap(){
 const game=tapSession;if(!game||!['waiting','shown'].includes(tapState))return;
 const step=(game.hits||0)+(game.falseStarts||0)+1;
 const actionMs=Math.max(0,Math.round(performance.now()-tapRoundStartedAt));
 clearTimeout(tapTimer);tapState='checking';tapButton.disabled=true;
 const res=await sendQuickRound(actionMs,step);
 if(tapSession!==game)return;
 if(!res.ok){
   await cancelPlaySession(game.sessionToken);tapSession=null;tapState='idle';tapButton.disabled=false;tapButton.textContent='もう一度';
   tapMessage.textContent='判定できませんでした';setStatus('QUICK TAP FOCUSの判定に失敗しました: '+FlecityErrors.text(res.error),'error');return;
 }
 game.hits=Number(res.hits)||0;game.falseStarts=Number(res.falseStarts)||0;game.lives=Number(res.lives)||0;renderQuickMeta();
 if(res.falseStart){
   game.focusStreak=0;setQuickVisual('false-start');tapMessage.textContent='フライング! · FOCUS RESET';tone(180,70);
   if(res.ended){await sleep(350);if(tapSession===game)await finishQuickRun(res);return;}
   tapState='transition';await sleep(420);if(tapSession!==game)return;beginQuickRound(res.nextChallenge);return;
 }
 const reaction=Number(res.reactionMs)||0,grade=quickTapGrade(reaction);
 if(reaction<=320)game.focusStreak=(game.focusStreak||0)+1;else game.focusStreak=0;
 game.maxFocusStreak=Math.max(game.maxFocusStreak||0,game.focusStreak||0);
 setQuickVisual('result-'+grade.state);tapMessage.textContent=grade.label+' · '+reaction.toFixed(1)+' ms'+(game.focusStreak>=2?' · FOCUS ×'+game.focusStreak:'');tone(grade.tone,60);renderQuickMeta();
 if(res.ended){await sleep(450);if(tapSession===game)await finishQuickRun(res);return;}
 tapState='transition';await sleep(420);if(tapSession!==game)return;beginQuickRound(res.nextChallenge);
}
function showQuick(daily=false){
 tapDaily=daily===true;hideAll();quickEl.classList.remove('hidden');refreshScreenBests();tapMessage.textContent=tapDaily?'今日のFOCUS RUN':'7回、集中できる？';tapButton.textContent='RUN開始';tapButton.disabled=false;tapState='idle';tapSession=null;setQuickVisual('idle');renderQuickMeta();
}
tapButton.onclick=async()=>{
 if(['waiting','shown'].includes(tapState)){await resolveQuickTap();return;}
 if(tapState!=='idle')return;
 tapButton.disabled=true;
 const res=await startSessionWithRetry({gameId:'quick_tap',daily:tapDaily});
 if(!res.ok){tapButton.disabled=false;if(res.error!=='APP_SUSPENDED')setStatus('QUICK TAP FOCUSを開始できません: '+FlecityErrors.text(res.error),'error');return;}
 tapSession={sessionToken:res.sessionToken,currentChallenge:res.challenge,daily:res.daily===true,hits:0,targetHits:Number(res.challenge&&res.challenge.targetHits)||7,lives:Number(res.challenge&&res.challenge.lives)||3,falseStarts:0,focusStreak:0,maxFocusStreak:0};
 tapRunStartedAt=performance.now();tapStartedAt=tapRunStartedAt;beginQuickRound(res.challenge);
};
tapBack.onclick=async()=>{
 if(tapState==='submitting'){setStatus('QUICK TAP FOCUSの記録を保存中です…','warn');return;}
 if(tapSession&&['waiting','shown','checking','transition'].includes(tapState)){
   const ok=await confirmAction('QUICK TAP FOCUSを終了しますか？','現在のRUNは記録されず終了します。','終了する');
   if(!ok)return;
 }
 clearTimeout(tapTimer);
 if(tapSession)await cancelPlaySession(tapSession.sessionToken);
 tapSession=null;tapState='idle';showHome();
};

/* STOP */
function trianglePosition(elapsedMs,periodMs,phaseMs){
 const period=Math.max(400,Number(periodMs)||1800),cycle=(Math.max(0,Number(elapsedMs)||0)+(Number(phaseMs)||0))%period,half=period/2;
 return cycle<=half?(cycle/half)*100:((period-cycle)/half)*100;
}
function stopSpeedMultiplier(challenge){
 const period=Math.max(1,Number(challenge&&challenge.periodMs)||2200);
 return 2200/period;
}
function stopRushGrade(result){
 if(result&&result.bullseye)return {label:'BULLSEYE',state:'bullseye',tone:1040};
 const distance=Math.max(0,Number(result&&result.distancePct)||99),tol=Math.max(.01,Number(result&&result.tolerancePct)||1);
 const accuracy=Math.max(0,1-distance/tol);
 if(accuracy>=.82)return {label:'PERFECT',state:'perfect',tone:920};
 if(accuracy>=.5)return {label:'GREAT',state:'great',tone:810};
 return {label:'CLEAR',state:'clear',tone:700};
}
function updateStopRoundUi(){
 const game=stopSession,ch=game&&game.currentChallenge;
 if(!game||!ch){
   stopRunMeta.textContent='ROUND 1 · RUSH 1 · SPEED ×1.00 · ZONE 8.0%';
   stopTarget.style.width='16%';
   return;
 }
 const speed=stopSpeedMultiplier(ch),zone=Math.max(1,Number(ch.tolerancePct)||8);
 const round=Number(ch.round)||game.cleared+1,rush=Math.max(1,Math.floor((round-1)/5)+1);
 stopRunMeta.textContent='ROUND '+String(round)+' · RUSH '+String(rush)+' · SPEED ×'+speed.toFixed(2)+' · ZONE '+zone.toFixed(1)+'% · SCORE '+String(game.score||0)+(round%5===0?' · RUSH ROUND':'');
 stopTarget.style.left=String(Number(ch.targetPct)||50)+'%';
 stopTarget.style.width=String(Math.min(24,zone*2))+'%';
 stopEl.dataset.tier=round>=30?'insane':(round>=20?'extreme':(round>=10?'fast':'normal'));
 stopEl.dataset.rush=String(Math.min(9,rush));
}
function animateStop(){
 if(stopState!=='running'||!stopSession||!stopSession.currentChallenge)return;
 const elapsed=performance.now()-stopStartedAt,ch=stopSession.currentChallenge;
 stopMarker.style.left=trianglePosition(elapsed,ch.periodMs,ch.phaseMs)+'%';
 stopRaf=requestAnimationFrame(animateStop);
}
function setStopVisual(state){stopEl.dataset.state=state||'idle';}
function openStop(daily=false){
 stopDaily=daily===true;hideAll();stopEl.classList.remove('hidden');stopState='idle';stopSession=null;setStopVisual('idle');delete stopEl.dataset.tier;
 refreshScreenBests();stopMessage.textContent=stopDaily?'今日のチャレンジ':'どこまで加速できる？';stopButton.textContent='RUN開始';stopButton.disabled=false;stopMarker.style.left='0%';stopTarget.style.left='50%';stopTarget.style.width='16%';updateStopRoundUi();
}
async function sendStopRound(actionMs,step){
 const payload={sessionToken:stopSession&&stopSession.sessionToken,actionMs,step};
 const retryable=new Set(['RATE_LIMIT','NUI_REQUEST_FAILED','PHONE_CALLBACK_FAILED','CALLBACK_FAILED','EMPTY_RESPONSE','SERVER_ERROR']);
 let res={ok:false,error:'EMPTY_RESPONSE'};
 for(let attempt=0;attempt<3;attempt++){
   res=await FlecityBridge.call('playStopRound',payload);
   if(res.ok||!retryable.has(res.error))return res;
   if(attempt<2)await sleep(res.error==='RATE_LIMIT'?180:140*(attempt+1));
 }
 return res;
}
async function finishStopRun(roundResult){
 const game=stopSession;if(!game)return;
 stopState='submitting';cancelAnimationFrame(stopRaf);stopButton.disabled=true;
 const durationMs=Math.max(0,Math.round(performance.now()-stopRunStartedAt));
 const res=await submitScoreWithRetry({sessionToken:game.sessionToken,score:game.score,durationMs,stopRun:true});
 const stillHere=stopSession===game;
 if(res.ok){
   if(stillHere){
     setStopVisual(roundResult&&roundResult.success?'finished':'miss');
     const rounds=Number(res.details&&res.details.rounds)||game.cleared,bulls=Number(res.details&&res.details.bullseyes)||game.bullseyes||0;
     stopMessage.textContent=(roundResult&&roundResult.success?'MAX CLEAR':'MISS')+' · ROUND '+String(rounds);
     stopRunMeta.textContent='SCORE '+String(res.score)+' · CLEAR '+String(rounds)+' · BULLSEYE '+String(bulls);
     tone(roundResult&&roundResult.success?1040:260,roundResult&&roundResult.success?110:90);
     showScoreResult('stop',res,(res.daily?'デイリー · ':'')+'STOP RUSH · '+rounds+' CLEAR · '+res.score+' pts');
   }
   await refreshPlatform();
 }else{
   await cancelPlaySession(game.sessionToken);
   if(stillHere){stopMessage.textContent='保存できませんでした';setStatus('STOP RUSHの記録を保存できませんでした: '+FlecityErrors.text(res.error),'error');}
 }
 if(stillHere){stopSession=null;stopState='idle';stopButton.disabled=false;stopButton.textContent='もう一度';}
}
stopButton.onclick=async()=>{
 if(stopState==='running'){
   const game=stopSession,ch=game&&game.currentChallenge;if(!game||!ch)return;
   stopState='checking';cancelAnimationFrame(stopRaf);stopButton.disabled=true;
   const actionMs=Math.max(0,Math.round(performance.now()-stopStartedAt));
   const res=await sendStopRound(actionMs,game.cleared+1);
   if(stopSession!==game)return;
   if(!res.ok){
     await cancelPlaySession(game.sessionToken);stopSession=null;stopState='idle';stopButton.disabled=false;stopButton.textContent='もう一度';
     stopMessage.textContent='判定できませんでした';setStatus('STOP RUSHの判定に失敗しました: '+FlecityErrors.text(res.error),'error');return;
   }
   const scoreBefore=Number(game.score)||0;
   game.score=Number(res.score)||game.score||0;game.cleared=Number(res.cleared)||0;game.bullseyes=Number(res.bullseyes)||0;
   const rankUp=liveRankUpPrefix('stop',scoreBefore,game.score);
   if(rankUp)setStatus(rankUp+'STOP RUSH · SCORE '+String(game.score),'good');
   if(!res.success){
     game.precisionStreak=0;setStopVisual('miss');const missDistance=Number(res.distancePct||0),missZone=Number(res.tolerancePct||0),near=missDistance<=missZone+1.25;stopMessage.textContent=(near?'SO CLOSE':'MISS')+' · ズレ '+missDistance.toFixed(2)+'%';tone(near?310:220,90);
     await sleep(320);if(stopSession===game)await finishStopRun(res);return;
   }
   const grade=stopRushGrade(res);setStopVisual(grade.state);
   const precise=Number(res.distancePct||99)<=Math.max(.75,Number(res.tolerancePct||0)*.28);
   game.precisionStreak=precise?(game.precisionStreak||0)+1:0;
   const precisionText=game.precisionStreak>=2?' · PRECISION ×'+game.precisionStreak:'';
   const rushText=(game.cleared>0&&game.cleared%5===0)?' · SPEED UP!':'';
   stopMessage.textContent=grade.label+' · +'+String(res.gained||0)+precisionText+rushText;tone(grade.tone,65);
   stopRunMeta.textContent='CLEAR '+String(game.cleared)+' · SCORE '+String(game.score)+' · BULLSEYE '+String(game.bullseyes);
   if(res.ended){await sleep(420);if(stopSession===game)await finishStopRun(res);return;}
   stopState='transition';await sleep(430);if(stopSession!==game)return;
   game.currentChallenge=res.nextChallenge;updateStopRoundUi();setStopVisual('running');stopMessage.textContent='ROUND '+String(game.currentChallenge.round);
   stopButton.textContent='STOP';stopButton.disabled=false;stopStartedAt=performance.now();stopState='running';animateStop();return;
 }
 if(stopState!=='idle')return;
 stopButton.disabled=true;
 const res=await startSessionWithRetry({gameId:'stop',daily:stopDaily});
 if(!res.ok){stopButton.disabled=false;if(res.error!=='APP_SUSPENDED')setStatus('STOP RUSHを開始できません: '+FlecityErrors.text(res.error),'error');return;}
 stopSession={sessionToken:res.sessionToken,currentChallenge:res.challenge,daily:res.daily===true,score:0,cleared:0,bullseyes:0,precisionStreak:0};
 stopRunStartedAt=performance.now();stopStartedAt=performance.now();stopState='running';setStopVisual('running');updateStopRoundUi();
 stopMessage.textContent='ROUND 1';stopButton.textContent='STOP';stopButton.disabled=false;animateStop();
};
stopBack.onclick=async()=>{
 if(stopState==='submitting'){setStatus('STOP RUSHの記録を保存中です…','warn');return;}
 if(stopSession&&['running','checking','transition'].includes(stopState)){
   const ok=await confirmAction('STOP RUSHを終了しますか？','現在のRUNは記録されず終了します。','終了する');
   if(!ok)return;
 }
 cancelAnimationFrame(stopRaf);
 if(stopSession)await cancelPlaySession(stopSession.sessionToken);
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
function blockPressure(){
 if(!block)return {filled:0,ratio:0,fitPieces:0,label:'OPEN'};
 let filled=0;for(const row of block.board)for(const cell of row)if(cell)filled++;
 const ratio=filled/64,fitPieces=block.pieces.filter(Boolean).filter(anyFit).length;
 const label=fitPieces<=1||ratio>=.78?'DANGER':(ratio>=.62?'TIGHT':'OPEN');
 return {filled,ratio,fitPieces,label};
}
function clearLines(){
 const rows=[],cols=[];
 for(let y=0;y<8;y++)if(block.board[y].every(Boolean))rows.push(y);
 for(let x=0;x<8;x++){let full=true;for(let y=0;y<8;y++)if(!block.board[y][x]){full=false;break;}if(full)cols.push(x);}
 const unique=new Set();rows.forEach(y=>{for(let x=0;x<8;x++)unique.add(y+':'+x)});cols.forEach(x=>{for(let y=0;y<8;y++)unique.add(y+':'+x)});
 unique.forEach(k=>{const [y,x]=k.split(':').map(Number);block.board[y][x]=0;});
 const lines=rows.length+cols.length;
 if(lines>0){block.combo+=1;block.score+=Math.round(lines*100*(1+Math.min(block.combo,8)*0.2));}else block.combo=0;
 return lines;
}
async function persistBlock(showError=false){
 const game=block;if(!game||game.finished||game.daily)return true;
 if(game.progressed!==true)return true;
 const state={board:game.board,pieces:game.pieces,score:game.score,combo:game.combo,rngState:game.rngState,history:game.history};
 const elapsedMs=Math.round((game.elapsedBase||0)+(performance.now()-game.sessionStarted));
 const res=await saveWithRetry({gameId:'block',sessionToken:game.sessionToken,state,score:game.score,elapsedMs});
 if(res.ok){
   const canonical=res.state||state;
   saves.block={game_id:'block',state:canonical,score:Number(res.score??game.score),elapsed_ms:Number(res.elapsedMs??elapsedMs)};
   return true;
 }
 if(showError&&block===game)setStatus('BLOCKの保存に失敗しました: '+FlecityErrors.text(res.error),'error');
 return false;
}
function clearBlockDragVisual(){
 blockBoard.querySelectorAll('.drag-preview,.drag-invalid').forEach(cell=>cell.classList.remove('drag-preview','drag-invalid'));
 const ghost=document.querySelector('.block-drag-ghost');if(ghost)ghost.remove();
}
function blockPreviewPlacement(piece,x,y){
 blockBoard.querySelectorAll('.drag-preview,.drag-invalid').forEach(cell=>cell.classList.remove('drag-preview','drag-invalid'));
 if(!piece)return false;
 const valid=canPlace(piece,x,y);
 for(const [dx,dy] of SHAPES[piece.shape]){
   const xx=x+dx,yy=y+dy;if(xx<0||xx>=8||yy<0||yy>=8)continue;
   const cell=blockBoard.querySelector('[data-x="'+xx+'"][data-y="'+yy+'"]');
   if(cell)cell.classList.add(valid?'drag-preview':'drag-invalid');
 }
 return valid;
}
function blockDragGhost(piece,event){
 const old=document.querySelector('.block-drag-ghost');if(old)old.remove();
 const ghost=document.createElement('div');ghost.className='block-drag-ghost';
 const mini=document.createElement('div');mini.className='drag-piece-grid';
 for(const [x,y] of SHAPES[piece.shape]){const d=document.createElement('span');d.style.gridColumn=String(x+1);d.style.gridRow=String(y+1);mini.appendChild(d);}
 ghost.appendChild(mini);document.body.appendChild(ghost);
 const move=e=>{ghost.style.left=e.clientX+'px';ghost.style.top=(e.clientY-(e.pointerType==='touch'?60:26))+'px';};
 move(event);return {element:ghost,move};
}
function blockDragTarget(event){
 const lift=event.pointerType==='touch'?64:0;
 const element=document.elementFromPoint(event.clientX,event.clientY-lift);
 const cell=element&&element.closest?element.closest('.block-cell'):null;
 if(!cell)return null;
 return {x:Number(cell.dataset.x),y:Number(cell.dataset.y)};
}
function renderBlock(){
 const selectedPiece=block.pieces[block.selected]||null;
 blockScore.textContent=String(block.score);
 refreshScreenBests();
 const streak=block.combo>0?'STREAK ×'+String(block.combo):'STREAK READY',pressure=blockPressure();
 const fever=block.combo>=3?'FEVER ACTIVE':'FEVER '+Math.min(3,Math.max(0,block.combo))+'/3';
 blockMeta.textContent=(block.daily?'DAILY · ':'')+streak+' · '+fever+' · FIT '+String(pressure.fitPieces)+'/'+String(block.pieces.filter(Boolean).length)+' · '+pressure.label;
 blockBoard.classList.toggle('fever',block.combo>=3);
 blockBoard.classList.toggle('block-tight',pressure.label==='TIGHT');
 blockBoard.classList.toggle('block-danger',pressure.label==='DANGER');
 blockBoard.innerHTML='';
 for(let y=0;y<8;y++)for(let x=0;x<8;x++){
   const cell=document.createElement('button');
   const valid=!block.board[y][x]&&selectedPiece&&canPlace(selectedPiece,x,y);
   cell.className='block-cell'+(block.board[y][x]?' filled':'')+(valid?' valid-origin':'');
   cell.dataset.x=String(x);cell.dataset.y=String(y);
   cell.disabled=block.finished||block.finalizing||!valid;
   cell.setAttribute('aria-label',valid?'ここに置けます':'マス');
   cell.onclick=()=>placeBlock(x,y);blockBoard.appendChild(cell);
 }
 blockPieces.innerHTML='';
 block.pieces.forEach((p,i)=>{
   const b=document.createElement('button');b.className='piece'+(block.selected===i?' selected':'');b.disabled=block.finished||block.finalizing||!p;
   if(p){const mini=document.createElement('div');mini.className='mini-piece';for(const [x,y] of SHAPES[p.shape]){const d=document.createElement('span');d.style.gridColumn=String(x+1);d.style.gridRow=String(y+1);mini.appendChild(d);}b.appendChild(mini);}
   else b.textContent='USED';
   b.onclick=()=>{if(blockSuppressClick){blockSuppressClick=false;return;}block.selected=i;renderBlock();};
   if(p){
     b.onpointerdown=event=>{
       if(!block||block.finished||block.finalizing||event.button>0)return;
       block.selected=i;
       [...blockPieces.children].forEach((node,index)=>node.classList.toggle('selected',index===i));
       const ghost=blockDragGhost(p,event);
       blockDrag={pointerId:event.pointerId,pieceIndex:i,piece:p,startX:event.clientX,startY:event.clientY,moved:false,target:null,ghost};
       b.classList.add('dragging');
       try{b.setPointerCapture(event.pointerId);}catch(_){}
     };
     b.onpointermove=event=>{
       if(!blockDrag||blockDrag.pointerId!==event.pointerId)return;
       blockDrag.ghost.move(event);
       if(Math.hypot(event.clientX-blockDrag.startX,event.clientY-blockDrag.startY)>7)blockDrag.moved=true;
       if(!blockDrag.moved)return;
       const target=blockDragTarget(event);blockDrag.target=target;
       if(target)blockPreviewPlacement(blockDrag.piece,target.x,target.y);
       else blockBoard.querySelectorAll('.drag-preview,.drag-invalid').forEach(cell=>cell.classList.remove('drag-preview','drag-invalid'));
     };
     b.onpointerup=event=>{
       if(!blockDrag||blockDrag.pointerId!==event.pointerId)return;
       const drag=blockDrag;blockDrag=null;blockSuppressClick=drag.moved===true;
       try{b.releasePointerCapture(event.pointerId);}catch(_){}
       clearBlockDragVisual();
       if(drag.moved&&drag.target&&block&&block.pieces[drag.pieceIndex]){
         block.selected=drag.pieceIndex;
         if(canPlace(block.pieces[drag.pieceIndex],drag.target.x,drag.target.y)){void placeBlock(drag.target.x,drag.target.y);return;}
         tone(150,28);setStatus('そこには置けません。','warn');
       }
       if(block)renderBlock();
     };
     b.onpointercancel=()=>{blockDrag=null;clearBlockDragVisual();if(block)renderBlock();};
   }
   blockPieces.appendChild(b);
 });
 blockFinish.disabled=block.finished||block.finalizing;
 blockNew.disabled=block.finalizing===true;
}
async function openBlock(forceNew,daily=false){
 hideAll();blockEl.classList.remove('hidden');
 const saved=!forceNew&&!daily&&saves.block;
 const payload={gameId:'block',daily:daily===true};if(saved)payload.resume=true;
 const session=await startSessionWithRetry(payload);
 if(!session.ok){if(session.error!=='APP_SUSPENDED'){setStatus('BLOCKを開始できません: '+FlecityErrors.text(session.error),'error');showHome();}return;}
 if(saved&&saved.state&&Array.isArray(saved.state.board)){
   block={board:saved.state.board,pieces:saved.state.pieces||[],score:Number(saved.state.score||saved.score||0),combo:Number(saved.state.combo||0),selected:0,
     rngState:Number(saved.state.rngState||session.seed),history:Array.isArray(saved.state.history)?saved.state.history:[],elapsedBase:Number(session.baseElapsedMs||0),sessionStarted:performance.now(),sessionToken:session.sessionToken,seed:session.seed,finished:false,daily:false,progressed:true};
   if(!block.pieces.length)refillPieces();setStatus('BLOCKを途中保存から再開しました。','good');
 }else{
   block={board:emptyBoard(),pieces:[],score:0,combo:0,selected:0,rngState:Number(session.seed)||1,history:[],elapsedBase:0,sessionStarted:performance.now(),sessionToken:session.sessionToken,seed:session.seed,finished:false,daily:session.daily===true,progressed:false};
   refillPieces();setStatus(block.daily?'デイリーBLOCK開始。':'新しいBLOCKを開始しました。','good');
 }
 renderBlock();
}
async function placeBlock(x,y){
 const game=block;if(!game||game.finished)return;
 const slot=game.selected,piece=game.pieces[slot];
 if(!canPlace(piece,x,y)){setStatus('そこには置けません。','warn');return;}
 block.progressed=true;
 const pressureBefore=blockPressure(),scoreBefore=Number(block.score)||0;
 block.history.push([slot,x,y]);
 for(const [dx,dy] of SHAPES[piece.shape])block.board[y+dy][x+dx]=1;
 block.score+=SHAPES[piece.shape].length*10;block.pieces[slot]=null;
 const clearedLines=clearLines(),rankUp=liveRankUpPrefix('block',scoreBefore,block.score);
 if(clearedLines>0){
   const pressureAfter=blockPressure(),escapedDanger=pressureBefore.label==='DANGER'&&pressureAfter.label!=='DANGER';
   blockBoard.classList.remove('line-clear','block-clutch');void blockBoard.offsetWidth;blockBoard.classList.add('line-clear');
   if(escapedDanger)blockBoard.classList.add('block-clutch');
   tone(escapedDanger?960:620+Math.min(260,block.combo*45),escapedDanger?75:55);
   const blast=clearedLines>=3?'MEGA BLAST':(clearedLines===2?'DOUBLE BLAST':'LINE CLEAR');
   const fever=block.combo===3?'FEVER START · ':(block.combo>3?'FEVER ×'+block.combo+' · ':(block.combo>1?'STREAK ×'+block.combo+' · ':''));
   const clutch=escapedDanger?'CLUTCH ESCAPE · ':(pressureBefore.label==='DANGER'?'DANGER CLEAR · ':'');
   setStatus(rankUp+clutch+fever+blast,'good');
 }else if(rankUp){tone(900,65);setStatus(rankUp+'KEEP BUILDING','good');}
 else tone(420,22);
 if(block.pieces.every(p=>!p))refillPieces();else{const next=block.pieces.findIndex(Boolean);if(next>=0)block.selected=next;}
 renderBlock();await persistBlock();
 if(block!==game)return;
 if(blockGameOver()){setStatus('置けるピースがありません。ゲーム終了。','warn');await finishBlock();}
}
async function finishBlock(){
 const game=block;if(!game||game.finished||game.finalizing)return;
 game.finished=true;game.finalizing=true;if(block===game)renderBlock();
 await saveQueue.catch(()=>{});
 const res=await submitScoreWithRetry({sessionToken:game.sessionToken,score:game.score,durationMs:Math.round((game.elapsedBase||0)+(performance.now()-game.sessionStarted)),history:game.history});
 game.finalizing=false;
 if(res.ok){game.sessionToken=null;if(!game.daily)delete saves.block;if(block===game){showScoreResult('block',res,(res.daily?'デイリー · ':'')+'BLOCK '+res.score+'点');renderBlock();}await refreshPlatform();}
 else{
   await cancelPlaySession(game.sessionToken);game.sessionToken=null;game.finished=true;
   if(block===game){setStatus('BLOCKの記録を保存できませんでした。途中保存は残っています。ホームから再開してください。','error');renderBlock();}
 }
}
blockBack.onclick=async()=>{
 if(block&&block.finalizing){setStatus('BLOCKの記録を保存中です…','warn');return;}
 if(block&&!block.finished&&!block.daily){
   const saved=await persistBlock(true);
   if(!saved)return;
 }
 if(block&&!block.finished&&block.sessionToken)await cancelPlaySession(block.sessionToken);
 clearBlockDragVisual();blockDrag=null;block=null;showHome();
};
blockNew.onclick=async()=>{
 if(blockNew.disabled)return;
 if(block&&block.finalizing){setStatus('BLOCKの記録を保存中です…','warn');return;}
 const wasDaily=!!(block&&block.daily);
 const destructive=!wasDaily&&(!!saves.block||!!(block&&!block.finished));
 if(destructive){
   const ok=await confirmAction('BLOCKを新しく始めますか？','現在の途中保存は削除されます。','新しく始める');
   if(!ok)return;
 }
 blockNew.disabled=true;
 try{
   if(wasDaily){
     if(block&&!block.finished&&block.sessionToken)await cancelPlaySession(block.sessionToken);
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
   if(i+1<values.length&&values[i]===values[i+1]){const v=values[i]*2;out.push(v);merge.moveGain=(merge.moveGain||0)+v;i++;}
   else out.push(values[i]);
 }
 while(out.length<4)out.push(0);return out;
}
function maxMergeTile(board){
 let max=0;(board||[]).forEach(row=>(row||[]).forEach(value=>{max=Math.max(max,Number(value)||0);}));return max;
}
function nextMergeTarget(maxTile){
 for(const target of [64,128,256,512,1024,2048,4096,8192])if(maxTile<target)return target;
 return maxTile*2;
}
function mergeGameOver(){
 for(let y=0;y<4;y++)for(let x=0;x<4;x++){
   const v=merge.board[y][x];if(v===0)return false;
   if(x<3&&merge.board[y][x+1]===v)return false;
   if(y<3&&merge.board[y+1][x]===v)return false;
 }
 return true;
}
function mergePressure(){
 let empty=0;for(const row of merge.board)for(const value of row)if(!value)empty++;
 return {empty,label:empty<=2?'DANGER':(empty<=5?'TIGHT':'OPEN')};
}
function renderMerge(){
 refreshScreenBests();mergeScore.textContent=String(merge.score);
 const maxTile=maxMergeTile(merge.board),target=nextMergeTarget(maxTile),pressure=mergePressure();
 mergeBoard.classList.toggle('merge-fever',(merge.chain||0)>=3);
 mergeBoard.classList.toggle('merge-tight',pressure.label==='TIGHT');
 mergeBoard.classList.toggle('merge-danger',pressure.label==='DANGER');
 mergeBoard.innerHTML='';
 for(let y=0;y<4;y++)for(let x=0;x<4;x++){
   const d=document.createElement('div'),v=Number(merge.board[y][x]||0);
   d.className='merge-cell'+(v?' filled tile-'+Math.min(2048,v):'');if(v)d.dataset.value=String(v);d.textContent=v?String(v):'';mergeBoard.appendChild(d);
 }
 const chainPower=Math.max(1,Number(merge.chain)||1);
 mergeMeta.textContent='CHAIN ×'+String(merge.chain||0)+' · POWER ×'+String(chainPower)+' · '+String(merge.moves)+' MOVES · NEXT '+String(target)+' · '+pressure.empty+' SPACE'+(merge.finished?' · FINISHED':'');
 const locked=merge.finished||merge.finalizing;
 mergeUp.disabled=locked;mergeDown.disabled=locked;mergeLeft.disabled=locked;mergeRight.disabled=locked;
 mergeFinish.disabled=locked;mergeNew.disabled=merge.finalizing===true;
}
async function persistMerge(showError=false){
 const game=merge;if(!game||game.finished)return true;
 if(game.progressed!==true)return true;
 const state={board:game.board,score:game.score,moves:game.moves,chain:game.chain||0,rngState:game.rngState,history:game.history};
 const elapsedMs=Math.round((game.elapsedBase||0)+(performance.now()-game.sessionStarted));
 const res=await saveWithRetry({gameId:'merge',sessionToken:game.sessionToken,state,score:game.score,elapsedMs});
 if(res.ok){
   const canonical=res.state||state;
   saves.merge={game_id:'merge',state:canonical,score:Number(res.score??game.score),elapsed_ms:Number(res.elapsedMs??elapsedMs)};
   return true;
 }
 if(showError&&merge===game)setStatus('MERGEの保存に失敗しました: '+FlecityErrors.text(res.error),'error');
 return false;
}
async function openMerge(forceNew){
 hideAll();mergeEl.classList.remove('hidden');
 const saved=!forceNew&&saves.merge,payload={gameId:'merge'};if(saved)payload.resume=true;
 const session=await startSessionWithRetry(payload);
 if(!session.ok){if(session.error!=='APP_SUSPENDED'){setStatus('MERGEを開始できません: '+FlecityErrors.text(session.error),'error');showHome();}return;}
 if(saved&&saved.state&&Array.isArray(saved.state.board)&&saved.state.board.length===4){
   merge={board:saved.state.board,score:Number(saved.state.score||saved.score||0),moves:Number(saved.state.moves||0),chain:Number(saved.state.chain||0),moveGain:0,rngState:Number(saved.state.rngState||session.seed),
     history:Array.isArray(saved.state.history)?saved.state.history:[],elapsedBase:Number(session.baseElapsedMs||0),sessionStarted:performance.now(),sessionToken:session.sessionToken,seed:session.seed,finished:false,progressed:true};
   setStatus('MERGEを途中保存から再開しました。','good');
 }else{
   merge={board:emptyMergeBoard(),score:0,moves:0,chain:0,moveGain:0,rngState:Number(session.seed)||1,history:[],elapsedBase:0,sessionStarted:performance.now(),sessionToken:session.sessionToken,seed:session.seed,finished:false,progressed:false};
   spawnMergeTile();spawnMergeTile();setStatus('新しいMERGEを開始しました。','good');
 }
 renderMerge();
}
async function moveMerge(direction){
 const game=merge;if(!game||game.finished)return;
 const before=JSON.stringify(game.board),maxBefore=maxMergeTile(game.board),chainBefore=Number(game.chain)||0,pressureBefore=mergePressure(),scoreBefore=Number(game.score)||0;
 merge.moveGain=0;
 if(direction==='left'||direction==='right'){
   for(let y=0;y<4;y++){
     let row=merge.board[y].slice();if(direction==='right')row.reverse();row=compressMergeLine(row);if(direction==='right')row.reverse();merge.board[y]=row;
   }
 }else{
   for(let x=0;x<4;x++){
     let col=[];for(let y=0;y<4;y++)col.push(merge.board[y][x]);if(direction==='down')col.reverse();col=compressMergeLine(col);if(direction==='down')col.reverse();for(let y=0;y<4;y++)merge.board[y][x]=col[y];
   }
 }
 if(before===JSON.stringify(merge.board)){merge.moveGain=0;setStatus('タイルを動かせませんでした。','warn');tone(150,28);return;}
 const baseGain=Math.max(0,Number(merge.moveGain)||0);
 if(baseGain>0){
   merge.chain=Math.min(5,(Number(merge.chain)||0)+1);
   merge.score+=baseGain*merge.chain;
 }else merge.chain=0;
 const gained=baseGain>0?baseGain*merge.chain:0;
 merge.progressed=true;merge.moves+=1;merge.history.push(direction);spawnMergeTile();
 const maxAfter=maxMergeTile(merge.board),pressureAfter=mergePressure(),escapedDanger=pressureBefore.label==='DANGER'&&pressureAfter.label!=='DANGER',rankUp=liveRankUpPrefix('merge',scoreBefore,merge.score);
 mergeBoard.classList.remove('merge-move','merge-combine','merge-milestone','merge-clutch');void mergeBoard.offsetWidth;
 mergeBoard.classList.add(gained>0?'merge-combine':'merge-move');
 if(escapedDanger){
   mergeBoard.classList.add('merge-clutch');tone(960,75);setStatus(rankUp+'CLUTCH ESCAPE · '+pressureAfter.empty+' SPACE · CHAIN ×'+merge.chain+' · +'+gained,'good');
 }else if(maxAfter>maxBefore&&maxAfter>=64){
   mergeBoard.classList.add('merge-milestone');tone(900,65);setStatus(rankUp+'NEW TILE '+maxAfter+' · CHAIN ×'+merge.chain,'good');
 }else if(gained>0){
   tone(500+Math.min(320,baseGain),38);
   setStatus(rankUp+(merge.chain>=3?'FEVER · ':'')+'CHAIN ×'+merge.chain+' · +'+gained,'good');
 }else{
   tone(300,16);
   if(chainBefore>=2)setStatus('CHAIN BREAK · 次の連鎖を狙おう','warn');
 }
 renderMerge();await persistMerge();
 if(merge!==game)return;
 if(mergeGameOver()){setStatus('動かせる場所がありません。ゲーム終了。','warn');await finishMerge();}
}
async function finishMerge(){
 const game=merge;if(!game||game.finished||game.finalizing)return;
 game.finished=true;game.finalizing=true;if(merge===game)renderMerge();
 await saveQueue.catch(()=>{});
 const res=await submitScoreWithRetry({sessionToken:game.sessionToken,score:game.score,durationMs:Math.round((game.elapsedBase||0)+(performance.now()-game.sessionStarted)),history:game.history});
 game.finalizing=false;
 if(res.ok){game.sessionToken=null;delete saves.merge;if(merge===game){showScoreResult('merge',res,'MERGE '+res.score+'点');renderMerge();}await refreshPlatform();}
 else{
   await cancelPlaySession(game.sessionToken);game.sessionToken=null;game.finished=true;
   if(merge===game){setStatus('MERGEの記録を保存できませんでした。途中保存は残っています。ホームから再開してください。','error');renderMerge();}
 }
}
mergeBack.onclick=async()=>{
 if(merge&&merge.finalizing){setStatus('MERGEの記録を保存中です…','warn');return;}
 if(merge&&!merge.finished){
   const saved=await persistMerge(true);
   if(!saved)return;
 }
 if(merge&&!merge.finished&&merge.sessionToken)await cancelPlaySession(merge.sessionToken);
 merge=null;showHome();
};
mergeNew.onclick=async()=>{
 if(mergeNew.disabled)return;
 if(merge&&merge.finalizing){setStatus('MERGEの記録を保存中です…','warn');return;}
 const destructive=!!saves.merge||!!(merge&&!merge.finished);
 if(destructive){
   const ok=await confirmAction('MERGEを新しく始めますか？','現在の途中保存は削除されます。','新しく始める');
   if(!ok)return;
 }
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

/* FALL */
const FALL_BASE_SHAPES=[
 [[0,0],[1,0],[2,0],[3,0]],
 [[0,0],[1,0],[0,1],[1,1]],
 [[1,0],[0,1],[1,1],[2,1]],
 [[1,0],[2,0],[0,1],[1,1]],
 [[0,0],[1,0],[1,1],[2,1]],
 [[0,0],[0,1],[1,1],[2,1]],
 [[2,0],[0,1],[1,1],[2,1]]
];
const FALL_LINE_POINTS=[0,100,300,500,800];

function fallSeededNext(state){
 let x=Math.floor(Number(state)||1)%2147483647;if(x<=0)x=1;
 x=(x*16807)%2147483647;return [x,(x-1)/2147483646];
}
function fallPieceStateFor(seed,index){
 let state=Math.floor(Number(seed)||1)%2147483647;if(state<=0)state=1;
 let type=1;
 for(let i=0;i<=Math.max(0,Math.floor(Number(index)||0));i++){
   let value;[state,value]=fallSeededNext(state);type=1+Math.floor(value*FALL_BASE_SHAPES.length);
 }
 return {state,type};
}
function fallPieceFor(seed,index){return fallPieceStateFor(seed,index).type;}
function fallPeekPieces(game,count=3){
 if(!game)return [];
 let state=game.pieceRngState,out=[];
 for(let i=0;i<Math.max(1,Math.min(5,Math.floor(Number(count)||3)));i++){
   let value;[state,value]=fallSeededNext(state);out.push(1+Math.floor(value*FALL_BASE_SHAPES.length));
 }
 return out;
}
function fallPeekNextPiece(game){return fallPeekPieces(game,1)[0]||0;}
function fallShape(pieceType,rotation){
 const base=FALL_BASE_SHAPES[Math.floor(Number(pieceType)||0)-1];if(!base)return [];
 let shape=base.map(([x,y])=>[x,y]);
 const turns=((Math.floor(Number(rotation)||0)%4)+4)%4;
 for(let turn=0;turn<turns;turn++)shape=shape.map(([x,y])=>[-y,x]);
 let minX=Infinity,minY=Infinity;
 shape.forEach(([x,y])=>{minX=Math.min(minX,x);minY=Math.min(minY,y);});
 return shape.map(([x,y])=>[x-minX,y-minY]);
}
function emptyFallBoard(width=10,height=18){return Array.from({length:height},()=>Array(width).fill(0));}
function cloneFallBoard(board){return (board||[]).map(row=>Array.isArray(row)?row.slice():[]);}
function fallCanPlace(board,width,height,shape,x,y){
 return (shape||[]).every(([dx,dy])=>{
   const gx=x+dx,gy=y+dy;
   return gx>=0&&gx<width&&gy>=0&&gy<height&&Number(board[gy]&&board[gy][gx]||0)===0;
 });
}
function fallDropY(board,width,height,shape,x){
 if(!fallCanPlace(board,width,height,shape,x,0))return null;
 let y=0;while(fallCanPlace(board,width,height,shape,x,y+1))y+=1;return y;
}
function fallClearLines(board,width,height){
 let cleared=0,y=height-1;
 while(y>=0){
   const full=board[y].every(value=>Number(value)!==0);
   if(full){board.splice(y,1);board.unshift(Array(width).fill(0));cleared+=1;}
   else y-=1;
 }
 return cleared;
}
function fallFindAnyPlacement(board,width,height,pieceType){
 for(let rotation=0;rotation<4;rotation++){
   const shape=fallShape(pieceType,rotation);
   for(let x=0;x<width;x++)if(fallDropY(board,width,height,shape,x)!==null)return {x,rotation};
 }
 return null;
}
function fallApplyPlacement(board,width,height,pieceType,x,rotation,combo,lines){
 const shape=fallShape(pieceType,rotation),dropY=fallDropY(board,width,height,shape,x);
 if(dropY===null)return null;
 shape.forEach(([dx,dy])=>{board[dropY+dy][x+dx]=pieceType;});
 const cleared=fallClearLines(board,width,height);
 const nextCombo=cleared>0?Math.max(0,Number(combo)||0)+1:0;
 const lineScore=FALL_LINE_POINTS[cleared]??(cleared*250),level=Math.min(8,1+Math.floor((Number(lines)||0)/5));
 const gained=10+(dropY*2)+(lineScore*(cleared>0?Math.max(1,nextCombo):1)*level);
 return {cleared,combo:nextCombo,gained,dropY,level};
}
function elapsedFall(){
 return (fallGame?fallGame.elapsedBase:0)+(fallGame&&fallGame.startedAt?performance.now()-fallGame.startedAt:0);
}
function fallGravityDelay(game){
 const level=Math.min(8,1+Math.floor(Math.max(0,Number(game&&game.lines)||0)/5));
 return Math.max(230,900-((level-1)*95));
}
function stopFallGravity(){clearInterval(fallGravityClock);fallGravityClock=null;}
function stopFallSoftDrop(){clearInterval(fallSoftClock);fallSoftClock=null;}
function softDropFall(){
 const game=fallGame;if(!game||game.finished||game.finalizing||game.busy||game.ended||!game.sessionToken)return false;
 const shape=fallShape(game.nextPiece,game.rotation),landingY=fallDropY(game.board,game.width,game.height,shape,game.x);
 if(landingY===null||game.y>=landingY)return false;
 game.y=Math.min(landingY,game.y+1);game.lastGravityAt=performance.now();game.groundedAt=game.y>=landingY?performance.now():null;
 renderFall();return true;
}
function startFallSoftDrop(){
 stopFallSoftDrop();
 if(!softDropFall())return;
 fallSoftClock=setInterval(()=>{if(!softDropFall())stopFallSoftDrop();},70);
}
function startFallGravity(){
 stopFallGravity();
 const game=fallGame;if(!game||game.finished||game.finalizing||game.ended||!game.sessionToken)return;
 game.lastGravityAt=performance.now();game.groundedAt=null;
 fallGravityClock=setInterval(()=>{void fallGravityTick();},50);
}
async function fallGravityTick(){
 const game=fallGame;if(!game||game.finished||game.finalizing||game.busy||game.ended||!game.sessionToken)return;
 const shape=fallShape(game.nextPiece,game.rotation),landingY=fallDropY(game.board,game.width,game.height,shape,game.x);
 if(landingY===null){game.ended=true;stopFallGravity();renderFall();return;}
 const now=performance.now();
 if(game.y<landingY){
   game.groundedAt=null;
   if(now-(Number(game.lastGravityAt)||now)>=fallGravityDelay(game)){
     game.y=Math.min(landingY,game.y+1);game.lastGravityAt=now;renderFall();
   }
   return;
 }
 if(game.groundedAt==null){game.groundedAt=now;renderFall();return;}
 if(now-game.groundedAt>=450)await dropFall(true);
}
function fallResetCursor(){
 const game=fallGame;if(!game||game.ended)return false;
 const shape=fallShape(game.nextPiece,0);
 const width=Math.max(...shape.map(([x])=>x),0)+1;
 game.rotation=0;game.x=Math.max(0,Math.floor((game.width-width)/2));game.y=0;game.groundedAt=null;game.lastGravityAt=performance.now();
 if(fallDropY(game.board,game.width,game.height,shape,game.x)!==null)return true;
 const found=fallFindAnyPlacement(game.board,game.width,game.height,game.nextPiece);
 if(!found){game.ended=true;return false;}
 game.x=found.x;game.rotation=found.rotation;game.y=0;return true;
}
function renderFallMini(container,pieceType,label='preview'){
 container.innerHTML='';
 const preview=document.createElement('div');preview.className='fall-next-piece';preview.setAttribute('aria-label',label);
 const shape=pieceType?fallShape(pieceType,0):[],occupied=new Set(shape.map(([x,y])=>x+','+y));
 for(let y=0;y<4;y++)for(let x=0;x<4;x++){
   const cell=document.createElement('span');
   cell.className='fall-preview-cell'+(occupied.has(x+','+y)?' filled fall-piece-'+String(pieceType):'');
   preview.appendChild(cell);
 }
 container.appendChild(preview);
}
function renderFallPreview(){
 fallNext.innerHTML='';
 const pieces=fallGame&&!fallGame.ended?fallPeekPieces(fallGame,3):[];
 pieces.forEach((previewPiece,index)=>{
   const preview=document.createElement('div');preview.className='fall-next-piece';preview.setAttribute('aria-label','NEXT '+String(index+1));
   const shape=fallShape(previewPiece,0),occupied=new Set(shape.map(([x,y])=>x+','+y));
   for(let y=0;y<4;y++)for(let x=0;x<4;x++){
     const cell=document.createElement('span');
     cell.className='fall-preview-cell'+(occupied.has(x+','+y)?' filled fall-piece-'+String(previewPiece):'');
     preview.appendChild(cell);
   }
   fallNext.appendChild(preview);
 });
 if(fallHoldPreview)renderFallMini(fallHoldPreview,fallGame&&fallGame.heldPiece?fallGame.heldPiece:0,'HOLD');
}
function fallPressure(game){
 let top=game.height;
 for(let y=0;y<game.height;y++){if(game.board[y].some(Boolean)){top=y;break;}}
 const height=game.height-top,ratio=game.height>0?height/game.height:0;
 return {height,ratio,label:ratio>=.78?'DANGER':(ratio>=.58?'TIGHT':'OPEN')};
}
function renderFall(){
 const game=fallGame;if(!game)return;
 refreshScreenBests();fallScore.textContent=String(game.score);
 const pressure=fallPressure(game);
 const level=1+Math.floor((Number(game.lines)||0)/5),nextLevelIn=5-((Number(game.lines)||0)%5),gravity=(fallGravityDelay(game)/1000).toFixed(2);
 fallMeta.textContent='LEVEL '+level+' · DROP '+gravity+'s · NEXT +'+String(nextLevelIn)+' · LINES '+String(game.lines)+' · COMBO '+String(game.combo)+' · '+pressure.label+(game.ended?' · GAME OVER':'');
 fallBoard.classList.toggle('fall-tight',pressure.label==='TIGHT');
 fallBoard.classList.toggle('fall-danger',pressure.label==='DANGER');
 fallBoard.classList.toggle('fall-grounded',game.groundedAt!=null&&!game.ended);
 fallBoard.innerHTML='';
 const shape=!game.ended?fallShape(game.nextPiece,game.rotation):[];
 const ghostY=!game.ended?fallDropY(game.board,game.width,game.height,shape,game.x):null;
 const active=new Set(),ghost=new Set();
 if(!game.ended){
   const activeY=Math.max(0,Math.floor(Number(game.y)||0));
   shape.forEach(([dx,dy])=>{
     const ax=game.x+dx,ay=activeY+dy;if(ay>=0&&ay<game.height)active.add(ax+','+ay);
     if(ghostY!==null){const gy=ghostY+dy;if(gy>=0&&gy<game.height)ghost.add(ax+','+gy);}
   });
 }
 for(let y=0;y<game.height;y++)for(let x=0;x<game.width;x++){
   const cell=document.createElement('span'),value=Number(game.board[y][x]||0),key=x+','+y;
   let cls='fall-cell';
   if(value)cls+=' filled fall-piece-'+String(value);
   else if(active.has(key))cls+=' active fall-piece-'+String(game.nextPiece);
   else if(ghost.has(key))cls+=' ghost fall-piece-'+String(game.nextPiece);
   cell.className=cls;fallBoard.appendChild(cell);
 }
 renderFallPreview();
 const locked=game.finished||game.finalizing||game.busy||game.ended||!game.sessionToken;
 fallLeft.disabled=locked;fallRight.disabled=locked;fallRotate.disabled=locked;fallSoft.disabled=locked;fallDrop.disabled=locked;
 fallHold.disabled=locked||game.holdUsed===true;
 fallNew.disabled=game.finalizing===true;fallFinish.disabled=game.finalizing===true||game.history.length<1||!game.sessionToken;
}
function syncFallCanonical(game,canonical){
 if(!game||!canonical)return false;
 if(!Array.isArray(canonical.board)||canonical.board.length!==game.height)return false;
 const board=canonical.board.map(row=>Array.isArray(row)?row.map(Number):[]);
 if(board.some(row=>row.length!==game.width))return false;
 game.board=board;game.score=Number(canonical.score)||0;game.lines=Number(canonical.lines)||0;game.combo=Number(canonical.combo)||0;
 game.pieces=Number(canonical.pieces)||0;game.history=Array.isArray(canonical.history)?canonical.history.map(entry=>Array.isArray(entry)?{x:Number(entry[0]),rotation:Number(entry[1]),hold:entry[2]===true||Number(entry[2])===1}:{x:Number(entry.x),rotation:Number(entry.rotation),hold:entry.hold===true}):game.history;
 game.heldPiece=Math.max(0,Math.floor(Number(canonical.heldPiece)||0));game.holdUsed=false;
 const serverRngState=Number(canonical.rngState);
 if(Number.isFinite(serverRngState)&&serverRngState>0){
   const [pieceState,pieceValue]=fallSeededNext(serverRngState);
   game.pieceRngState=pieceState;
   game.nextPiece=Number(canonical.nextPiece)||(1+Math.floor(pieceValue*FALL_BASE_SHAPES.length));
 }else{
   const current=fallPieceStateFor(game.seed,game.history.length);game.pieceRngState=current.state;game.nextPiece=Number(canonical.nextPiece)||current.type;
 }
 game.ended=canonical.ended===true;
 if(!game.ended)fallResetCursor();
 return true;
}
async function persistFall(showError=false,syncLive=true){
 const game=fallGame;if(!game||game.finished||game.progressed!==true||!game.sessionToken)return true;
 const snapshotLength=game.history.length,elapsedMs=Math.round(elapsedFall()),state={history:game.history};
 const res=await saveWithRetry({gameId:'fall',sessionToken:game.sessionToken,state,score:game.score,elapsedMs});
 if(res.ok){
   const canonical=res.state||state;
   saves.fall={game_id:'fall',state:canonical,score:Number(res.score??game.score),elapsed_ms:Number(res.elapsedMs??elapsedMs)};
   if(syncLive&&fallGame===game&&game.history.length===snapshotLength)syncFallCanonical(game,canonical);
   return true;
 }
 if(showError&&fallGame===game)setStatus('FALLの保存に失敗しました: '+FlecityErrors.text(res.error),'error');
 return false;
}
async function openFall(forceNew=false){
 hideAll();fallEl.classList.remove('hidden');
 const saved=!forceNew&&saves.fall,payload={gameId:'fall'};if(saved)payload.resume=true;
 const session=await startSessionWithRetry(payload);
 if(!session.ok){if(session.error!=='APP_SUSPENDED'){setStatus('FALLを開始できません: '+FlecityErrors.text(session.error),'error');showHome();}return;}
 const width=Math.max(6,Number(session.challenge&&session.challenge.width)||10),height=Math.max(12,Number(session.challenge&&session.challenge.height)||18);
 if(saved&&saved.state&&Array.isArray(saved.state.board)&&saved.state.board.length===height){
   fallGame={width,height,board:emptyFallBoard(width,height),score:0,lines:0,combo:0,pieces:0,history:[],nextPiece:1,heldPiece:0,holdUsed:false,pieceRngState:Number(session.seed)||1,x:0,y:0,rotation:0,groundedAt:null,lastGravityAt:performance.now(),
     elapsedBase:Number(session.baseElapsedMs||0),startedAt:performance.now(),sessionToken:session.sessionToken,seed:Number(session.seed)||1,finished:false,finalizing:false,busy:false,progressed:true,ended:false};
   if(!syncFallCanonical(fallGame,saved.state)){
     await cancelPlaySession(session.sessionToken);fallGame=null;setStatus('FALLの途中保存を読み込めませんでした。','error');showHome();return;
   }
   setStatus(fallGame.ended?'FALLのゲームオーバー状態を再開しました。記録を確定します。':'FALLを途中保存から再開しました。','good');
 }else{
   const firstState=fallPieceStateFor(session.seed,0),firstPiece=Number(session.challenge&&session.challenge.firstPiece)||firstState.type;
   fallGame={width,height,board:emptyFallBoard(width,height),score:0,lines:0,combo:0,pieces:0,history:[],nextPiece:firstPiece,heldPiece:0,holdUsed:false,pieceRngState:firstState.state,x:0,y:0,rotation:0,groundedAt:null,lastGravityAt:performance.now(),
     elapsedBase:0,startedAt:performance.now(),sessionToken:session.sessionToken,seed:Number(session.seed)||1,finished:false,finalizing:false,busy:false,progressed:false,ended:false};
   fallResetCursor();setStatus('新しいFALLを開始しました。','good');
 }
 renderFall();
 if(fallGame&&!fallGame.ended)startFallGravity();
 if(fallGame&&fallGame.ended&&fallGame.history.length>0)setTimeout(()=>{if(fallGame&&!fallGame.finalizing&&fallGame.sessionToken)void finishFall(true);},120);
}
function moveFallHorizontal(delta){
 const game=fallGame;if(!game||game.finished||game.finalizing||game.busy||game.ended)return;
 const requested=Math.round(Number(delta)||0);if(requested===0)return;
 const direction=requested<0?-1:1,steps=Math.max(1,Math.min(game.width,Math.abs(requested))),shape=fallShape(game.nextPiece,game.rotation);
 let moved=0;
 for(let step=0;step<steps;step++){
   const nextX=game.x+direction,landingY=fallDropY(game.board,game.width,game.height,shape,nextX);
   if(landingY===null||landingY<game.y)break;
   game.x=nextX;moved+=1;
 }
 if(moved===0){tone(150,20);return;}
 game.groundedAt=null;tone(350+Math.min(90,(moved-1)*18),12);renderFall();
}
function fallSwipeSteps(dx){
 const game=fallGame;if(!game)return 1;
 const rect=fallBoard.getBoundingClientRect(),cellWidth=rect.width/Math.max(1,game.width);
 if(!Number.isFinite(cellWidth)||cellWidth<=0)return 1;
 return Math.max(1,Math.min(5,Math.round(Math.abs(Number(dx)||0)/cellWidth)));
}
function rotateFall(){
 const game=fallGame;if(!game||game.finished||game.finalizing||game.busy||game.ended)return;
 const nextRotation=(game.rotation+1)%4,shape=fallShape(game.nextPiece,nextRotation);
 for(const offset of [0,-1,1,-2,2]){
   const nextX=game.x+offset,landingY=fallDropY(game.board,game.width,game.height,shape,nextX);
   if(landingY!==null&&landingY>=game.y){
     game.rotation=nextRotation;game.x=nextX;game.groundedAt=null;tone(460,16);renderFall();return;
   }
 }
 tone(150,24);
}
function holdFallPiece(){
 const game=fallGame;if(!game||game.finished||game.finalizing||game.busy||game.ended||game.holdUsed)return;
 stopFallSoftDrop();
 const current=game.nextPiece;
 if(game.heldPiece){
   game.nextPiece=game.heldPiece;game.heldPiece=current;
 }else{
   game.heldPiece=current;
   const [nextState,nextValue]=fallSeededNext(game.pieceRngState);game.pieceRngState=nextState;game.nextPiece=1+Math.floor(nextValue*FALL_BASE_SHAPES.length);
 }
 game.holdUsed=true;
 if(!fallResetCursor()){
   stopFallGravity();renderFall();setStatus('HOLD後のピースを置けません。FALL終了。','warn');void finishFall(true);return;
 }
 tone(610,32);setStatus('HOLD · 次の配置まで再使用できません','good');renderFall();
}
async function dropFall(autoLock=false){
 const game=fallGame;if(!game||game.finished||game.finalizing||game.busy||game.ended)return;
 game.busy=true;
 const pressureBefore=fallPressure(game),scoreBefore=Number(game.score)||0,levelBefore=1+Math.floor((Number(game.lines)||0)/5),applied=fallApplyPlacement(game.board,game.width,game.height,game.nextPiece,game.x,game.rotation,game.combo,game.lines);
 if(!applied){game.busy=false;tone(150,30);setStatus('その位置には置けません。','warn');renderFall();return;}
 game.history.push({x:game.x,rotation:game.rotation,hold:game.holdUsed===true});game.pieces+=1;game.score+=applied.gained;game.lines+=applied.cleared;game.combo=applied.combo;game.progressed=true;
 const [nextState,nextValue]=fallSeededNext(game.pieceRngState);game.pieceRngState=nextState;game.nextPiece=1+Math.floor(nextValue*FALL_BASE_SHAPES.length);game.holdUsed=false;
 game.ended=fallFindAnyPlacement(game.board,game.width,game.height,game.nextPiece)===null;
 if(applied.cleared>0){
   const pressureAfter=fallPressure(game),escapedDanger=pressureBefore.label==='DANGER'&&pressureAfter.label!=='DANGER',rankUp=liveRankUpPrefix('fall',scoreBefore,game.score);
   fallBoard.classList.remove('fall-clear','fall-quad','fall-clutch');void fallBoard.offsetWidth;fallBoard.classList.add('fall-clear');
   if(applied.cleared>=4)fallBoard.classList.add('fall-quad');
   if(escapedDanger)fallBoard.classList.add('fall-clutch');
   tone(escapedDanger?980:720+Math.min(220,applied.cleared*45),escapedDanger?80:55);
   const clearLabel=applied.cleared>=4?'QUAD CLEAR':(applied.cleared===3?'TRIPLE CLEAR':(applied.cleared===2?'DOUBLE CLEAR':'LINE CLEAR'));
   const levelAfter=1+Math.floor((Number(game.lines)||0)/5),levelUp=levelAfter>levelBefore?'LEVEL UP '+levelAfter+' · ':'';
   setStatus(rankUp+(escapedDanger?'CLUTCH ESCAPE · ':'')+levelUp+(game.combo>1?'COMBO ×'+game.combo+' · ':'')+clearLabel+' · LEVEL ×'+applied.level+' · +'+applied.gained,'good');
 }else tone(autoLock?330:430,autoLock?12:18);
 if(!game.ended){fallResetCursor();game.busy=false;}
 renderFall();
 if(game.ended){
   stopFallGravity();renderFall();
   const saved=await persistFall(true,true);game.busy=false;
   if(fallGame!==game)return;
   renderFall();
   if(saved){setStatus('置ける場所がありません。FALL終了。','warn');await finishFall(true);}
   else setStatus('FALL終了。保存に失敗したため「終了して記録」で再試行してください。','error');
 }else if(applied.cleared>0||game.pieces%3===0){
   void persistFall(false,false).catch(()=>{});
 }
}
async function finishFall(gameOver=false){
 const game=fallGame;if(!game||game.finished||game.finalizing||!game.sessionToken)return;
 if(game.history.length<1){setStatus('1個以上ブロックを置いてから記録できます。','warn');return;}
 stopFallGravity();stopFallSoftDrop();game.finalizing=true;game.busy=true;renderFall();
 await saveQueue.catch(()=>{});
 const saved=await persistFall(true,true);
 if(!saved&&fallGame===game){game.finalizing=false;game.busy=false;if(!game.ended)startFallGravity();renderFall();return;}
 await saveQueue.catch(()=>{});
 const durationMs=Math.round(elapsedFall());
 const res=await submitScoreWithRetry({sessionToken:game.sessionToken,score:game.score,durationMs,history:game.history});
 game.finalizing=false;game.busy=false;
 if(res.ok){
   game.finished=true;game.sessionToken=null;delete saves.fall;
   if(fallGame===game){showScoreResult('fall',res,(gameOver?'GAME OVER · ':'')+'FALL '+res.score+'点 · '+game.lines+' LINES');renderFall();}
   await refreshPlatform();
 }else{
   await cancelPlaySession(game.sessionToken);game.sessionToken=null;
   if(fallGame===game){setStatus('FALLの記録を保存できませんでした。途中保存は残っています。ホームから再開してください。','error');renderFall();}
 }
}
function fallPointerPoint(event){return {x:Number(event.clientX)||0,y:Number(event.clientY)||0};}
fallBoard.onpointerdown=event=>{
 if(!fallGame||fallGame.finished||fallGame.finalizing||fallGame.busy||fallGame.ended)return;
 fallPointer={...fallPointerPoint(event),id:event.pointerId};
 try{fallBoard.setPointerCapture(event.pointerId);}catch(_){}
};
fallBoard.onpointerup=event=>{
 if(!fallPointer||fallPointer.id!==event.pointerId)return;
 const start=fallPointer,end=fallPointerPoint(event),dx=end.x-start.x,dy=end.y-start.y;
 fallPointer=null;
 try{fallBoard.releasePointerCapture(event.pointerId);}catch(_){}
 const distance=Math.max(Math.abs(dx),Math.abs(dy));
 if(distance<18){rotateFall();return;}
 if(Math.abs(dy)>Math.abs(dx)&&dy>34){void dropFall(false);return;}
 if(Math.abs(dx)>24){
   const steps=fallSwipeSteps(dx);
   moveFallHorizontal((dx>0?1:-1)*steps);
 }
};
fallBoard.onpointercancel=event=>{
 if(fallPointer&&fallPointer.id===event.pointerId)fallPointer=null;
 try{fallBoard.releasePointerCapture(event.pointerId);}catch(_){}
};
fallLeft.onclick=()=>moveFallHorizontal(-1);
fallRight.onclick=()=>moveFallHorizontal(1);
fallRotate.onclick=rotateFall;
fallHold.onclick=holdFallPiece;
fallSoft.onpointerdown=event=>{if(event.button>0)return;startFallSoftDrop();try{fallSoft.setPointerCapture(event.pointerId);}catch(_){}};
fallSoft.onpointerup=event=>{stopFallSoftDrop();try{fallSoft.releasePointerCapture(event.pointerId);}catch(_){}};
fallSoft.onpointercancel=()=>stopFallSoftDrop();
fallSoft.onpointerleave=event=>{if(event.buttons===0)stopFallSoftDrop();};
fallDrop.onclick=()=>{stopFallSoftDrop();void dropFall(false);};
fallBack.onclick=async()=>{
 if(fallGame&&fallGame.finalizing){setStatus('FALLの記録を保存中です…','warn');return;}
 stopFallGravity();stopFallSoftDrop();
 if(fallGame&&!fallGame.finished&&fallGame.sessionToken){
   await saveQueue.catch(()=>{});
   const saved=await persistFall(true,true);if(!saved){if(fallGame&&!fallGame.ended)startFallGravity();return;}
   await cancelPlaySession(fallGame.sessionToken);
 }
 fallGame=null;showHome();
};
fallNew.onclick=async()=>{
 if(fallNew.disabled)return;
 if(fallGame&&fallGame.finalizing){setStatus('FALLの記録を保存中です…','warn');return;}
 const destructive=!!saves.fall||!!(fallGame&&!fallGame.finished);
 if(destructive){
   const ok=await confirmAction('FALLを新しく始めますか？','現在の途中保存は削除されます。','新しく始める');
   if(!ok)return;
 }
 stopFallGravity();stopFallSoftDrop();fallNew.disabled=true;
 try{
   await saveQueue.catch(()=>{});
   if(fallGame&&fallGame.sessionToken)await cancelPlaySession(fallGame.sessionToken);
   const reset=await FlecityBridge.call('playResetSave',{gameId:'fall'});
   if(!reset.ok){setStatus('FALLの保存をリセットできません: '+FlecityErrors.text(reset.error),'error');if(fallGame&&!fallGame.ended&&fallGame.sessionToken)startFallGravity();return;}
   delete saves.fall;fallGame=null;await openFall(true);
 }finally{fallNew.disabled=false;}
};
fallFinish.onclick=async()=>{
 if(!fallGame||fallGame.finalizing)return;
 if(!fallGame.ended){
   const ok=await confirmAction('FALLを終了して記録しますか？','現在のスコアを確定して、このRunを終了します。','記録する');
   if(!ok)return;
 }
 await finishFall(fallGame.ended===true);
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
 const game=mines;if(!game||game.finished)return false;
 const wantsSafeIndex=!game.daily&&game.avoidIndex==null&&Number.isInteger(Number(firstIndex));
 if(game.timingStarted&&!wantsSafeIndex)return true;
 if(game.timingActivating)return false;
 game.timingActivating=true;
 try{
   const payload={sessionToken:game.sessionToken};
   if(wantsSafeIndex)payload.firstIndex=Number(firstIndex);
   const res=await FlecityBridge.call('playActivateSession',payload);
   if(mines!==game)return false;
   if(!res.ok){setStatus('MINESのタイマーを開始できません: '+FlecityErrors.text(res.error),'error');return false;}
   game.elapsedBase=Number(res.elapsedMs??game.elapsedBase)||0;
   if(Number.isInteger(Number(res.avoidIndex))){
     game.avoidIndex=Number(res.avoidIndex);
     game.mineSet=seededMines(game.seed,game.size,game.mineCount,game.avoidIndex);
   }
   if(!game.timingStarted){game.timingStarted=true;game.timingStartedAt=performance.now();}
   return true;
 }finally{game.timingActivating=false;}
}
function mineNeighbors(index){
 const out=[],x=index%mines.size,y=Math.floor(index/mines.size);
 for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
   if(!dx&&!dy)continue;const xx=x+dx,yy=y+dy;if(xx>=0&&xx<mines.size&&yy>=0&&yy<mines.size)out.push(yy*mines.size+xx);
 }
 return out;
}
function mineCountAround(index){let n=0;mineNeighbors(index).forEach(i=>{if(mines.mineSet.has(i))n++;});return n;}
function updateMinesTime(){if(mines){const ms=Number.isFinite(Number(mines.displayElapsedMs))?Number(mines.displayElapsedMs):elapsedMines();minesTime.textContent=(ms/1000).toFixed(1)+'s';}}
function renderMines(){
 if(!mines)return;minesBoard.innerHTML='';updateMinesTime();
 const safeTotal=mines.size*mines.size-mines.mineCount;
 const flagsLeft=Math.max(0,mines.mineCount-mines.flags.size);
 refreshScreenBests();minesMeta.textContent=(mines.daily?'DAILY · ':'')+'地雷 '+String(mines.mineCount)+' · FLAG '+String(mines.flags.size)+'/'+String(mines.mineCount)+' · LEFT '+String(flagsLeft)+' · OPEN '+String(mines.revealed.size)+'/'+String(safeTotal);
 for(let i=0;i<mines.size*mines.size;i++){
   const b=document.createElement('button'),revealed=mines.revealed.has(i),flagged=mines.flags.has(i);
   const n=revealed?mineCountAround(i):0;
   b.className='mines-cell'+(revealed?' revealed':'')+(flagged?' flagged':'')+(n?' n'+n:'')+(mines.lost&&mines.mineSet.has(i)?' mine':'');
   if(mines.lost&&mines.mineSet.has(i))b.textContent='✹';
   else if(flagged)b.textContent='⚑';
   else if(revealed)b.textContent=n?String(n):'';
   b.disabled=mines.finished;
   let holdTimer=null;
   const clearHold=()=>{if(holdTimer){clearTimeout(holdTimer);holdTimer=null;}};
   b.onpointerdown=()=>{if(b.disabled)return;clearHold();holdTimer=setTimeout(()=>{holdTimer=null;mineSuppressClickUntil=performance.now()+650;void flagMineDirect(i);},420);};
   b.onpointerup=clearHold;b.onpointercancel=clearHold;b.onpointerleave=clearHold;
   b.onclick=()=>{clearHold();if(performance.now()<mineSuppressClickUntil)return;void touchMine(i);};
   minesBoard.appendChild(b);
 }
 minesMode.textContent='モード: '+(mines.mode==='flag'?'旗':'開く');
 minesMode.disabled=mines.finished||mines.finalizing;
 minesNew.disabled=mines.finalizing===true;
}
async function persistMines(showError=false){
 if(!mines||mines.finished||mines.daily)return true;
 if(mines.progressed!==true)return true;
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
 const session=await startSessionWithRetry(payload);
 if(!session.ok){if(session.error!=='APP_SUSPENDED'){setStatus('MINESを開始できません: '+FlecityErrors.text(session.error),'error');showHome();}return;}
 const size=Number(session.challenge&&session.challenge.size)||8,mineCount=Number(session.challenge&&session.challenge.mines)||10;
 if(saved&&saved.state){
   mines={size,mineCount,seed:Number(session.seed),mineSet:null,revealed:new Set(saved.state.revealed||[]),flags:new Set(saved.state.flags||[]),mode:saved.state.mode==='flag'?'flag':'reveal',avoidIndex:Number.isInteger(Number(saved.state.avoidIndex))?Number(saved.state.avoidIndex):null,
     elapsedBase:Number(session.baseElapsedMs||0),timingStarted:false,timingStartedAt:null,timingActivating:false,sessionToken:session.sessionToken,finished:false,lost:false,daily:false,progressed:true};
   setStatus('MINESを途中保存から再開しました。','good');
 }else{
   mines={size,mineCount,seed:Number(session.seed),mineSet:null,revealed:new Set(),flags:new Set(),mode:'reveal',avoidIndex:null,elapsedBase:0,timingStarted:false,timingStartedAt:null,timingActivating:false,sessionToken:session.sessionToken,finished:false,lost:false,daily:session.daily===true,progressed:false};
   setStatus(mines.daily?'デイリーMINES開始。':'新しいMINESを開始しました。','good');
 }
 mines.mineSet=seededMines(mines.seed,mines.size,mines.mineCount,mines.avoidIndex);renderMines();minesClock=setInterval(updateMinesTime,250);
}
async function loseMines(index){
 const game=mines;if(!game||game.finished)return;
 game.finished=true;game.lost=true;clearInterval(minesClock);
 if(mines===game){renderMines();setStatus('地雷を踏みました。ゲーム終了。','warn');}
 if(!game.daily){
   await saveQueue.catch(()=>{});
   const reset=await FlecityBridge.call('playResetSave',{gameId:'mines'});
   if(reset.ok)delete saves.mines;
   else if(mines===game)setStatus('MINESの終了処理に失敗しました: '+FlecityErrors.text(reset.error),'error');
 }else if(game.sessionToken){
   await cancelPlaySession(game.sessionToken);
 }
 game.sessionToken=null;
}
async function flagMineDirect(index){
 const game=mines;if(!game||game.finished||game.revealed.has(index))return;
 if(!(await activateMinesTiming(null))||mines!==game)return;
 game.progressed=true;
 if(game.flags.has(index)){game.flags.delete(index);tone(270,18);}
 else if(game.flags.size>=game.mineCount){tone(170,35);setStatus('FLAG LIMIT · 旗は地雷数の '+game.mineCount+' 個までです。','warn');renderMines();return;}
 else{game.flags.add(index);tone(560,28);}
 minesBoard.classList.remove('flag-pop');void minesBoard.offsetWidth;minesBoard.classList.add('flag-pop');
 renderMines();await persistMines();
}
async function chordMine(index){
 const game=mines;if(!game||game.finished||!game.revealed.has(index))return;
 const required=mineCountAround(index);if(required<=0)return;
 const neighbors=mineNeighbors(index),flagged=neighbors.filter(i=>game.flags.has(i)).length;
 if(flagged!==required){tone(190,18);setStatus('周囲の旗が '+required+' 個そろうと一括オープンできます。','warn');return;}
 const targets=neighbors.filter(i=>!game.flags.has(i)&&!game.revealed.has(i));
 if(!targets.length)return;
 const mineHit=targets.find(i=>game.mineSet.has(i));
 if(mineHit!==undefined){
   tone(120,130);minesBoard.classList.remove('mine-hit');void minesBoard.offsetWidth;minesBoard.classList.add('mine-hit');await loseMines(mineHit);return;
 }
 game.progressed=true;const before=game.revealed.size,queue=targets.slice();
 while(queue.length){
   const current=queue.shift();if(game.revealed.has(current)||game.flags.has(current)||game.mineSet.has(current))continue;
   game.revealed.add(current);
   if(mineCountAround(current)===0)mineNeighbors(current).forEach(n=>{if(!game.revealed.has(n)&&!game.flags.has(n))queue.push(n);});
 }
 const opened=game.revealed.size-before;
 minesBoard.classList.remove('safe-open','chord-open');void minesBoard.offsetWidth;minesBoard.classList.add('chord-open');
 tone(760,48);setStatus('CHORD OPEN · +'+opened+' SAFE','good');renderMines();
 if(game.revealed.size===game.size*game.size-game.mineCount){await finishMines();return;}
 await persistMines();
}
async function touchMine(index){
 const game=mines;if(!game||game.finished)return;
 if(game.revealed.has(index)){await chordMine(index);return;}
 const firstReveal=game.mode==='reveal'?index:null;
 if(!(await activateMinesTiming(firstReveal))||mines!==game)return;
 if(mines.mode==='flag'){
   if(mines.revealed.has(index))return;
   mines.progressed=true;
   if(mines.flags.has(index)){mines.flags.delete(index);tone(270,18);}
   else if(mines.flags.size>=mines.mineCount){tone(170,35);setStatus('FLAG LIMIT · 旗は地雷数の '+mines.mineCount+' 個までです。','warn');renderMines();return;}
   else{mines.flags.add(index);tone(520,22);}
   renderMines();await persistMines();return;
 }
 if(mines.flags.has(index))return;
 if(mines.mineSet.has(index)){tone(120,130);minesBoard.classList.remove('mine-hit');void minesBoard.offsetWidth;minesBoard.classList.add('mine-hit');await loseMines(index);return;}
 mines.progressed=true;
 const beforeReveal=mines.revealed.size,queue=[index];
 while(queue.length){
   const current=queue.shift();if(mines.revealed.has(current)||mines.flags.has(current)||mines.mineSet.has(current))continue;
   mines.revealed.add(current);
   if(mineCountAround(current)===0)mineNeighbors(current).forEach(n=>{if(!mines.revealed.has(n))queue.push(n);});
 }
 const opened=mines.revealed.size-beforeReveal;
 tone(opened>4?620:430,opened>4?36:18);
 minesBoard.classList.remove('safe-open');void minesBoard.offsetWidth;minesBoard.classList.add('safe-open');
 if(opened>=8)setStatus('SAFE CHAIN · +'+opened+' OPEN','good');
 renderMines();
 if(mines.revealed.size===mines.size*mines.size-mines.mineCount){await finishMines();return;}
 await persistMines();
}
async function finishMines(){
 const game=mines;if(!game||game.finished||game.finalizing)return;
 game.finished=true;game.finalizing=true;clearInterval(minesClock);
 await saveQueue.catch(()=>{});
 const durationMs=Math.round((game.elapsedBase||0)+(game.timingStartedAt?performance.now()-game.timingStartedAt:0));game.displayElapsedMs=durationMs;if(mines===game)updateMinesTime();
 const res=await submitScoreWithRetry({sessionToken:game.sessionToken,score:durationMs,durationMs,revealed:[...game.revealed]});
 game.finalizing=false;
 if(res.ok){game.displayElapsedMs=Number(res.score);if(!game.daily)delete saves.mines;game.sessionToken=null;if(mines===game){updateMinesTime();showScoreResult('mines',res,(res.daily?'デイリー · ':'')+'MINES '+(Number(res.score)/1000).toFixed(2)+'s');}await refreshPlatform();}
 else{await cancelPlaySession(game.sessionToken);game.sessionToken=null;game.finished=true;if(mines===game)setStatus('MINESの記録を保存できませんでした。もう一度お試しください。','error');}
 if(mines===game)renderMines();
}
minesMode.onclick=()=>{if(!mines||mines.finished)return;mines.mode=mines.mode==='flag'?'reveal':'flag';renderMines();};
minesBack.onclick=async()=>{
 if(mines&&mines.finalizing){setStatus('MINESの記録を保存中です…','warn');return;}
 clearInterval(minesClock);minesClock=null;
 if(mines&&!mines.finished&&!mines.daily){
   const saved=await persistMines(true);
   if(!saved){minesClock=setInterval(updateMinesTime,250);return;}
 }
 if(mines&&!mines.finished&&mines.sessionToken)await cancelPlaySession(mines.sessionToken);
 mines=null;showHome();
};
minesNew.onclick=async()=>{
 if(minesNew.disabled)return;
 if(mines&&mines.finalizing){setStatus('MINESの記録を保存中です…','warn');return;}
 const wasDaily=!!(mines&&mines.daily);
 const destructive=!wasDaily&&(!!saves.mines||!!(mines&&!mines.finished));
 if(destructive){
   const ok=await confirmAction('MINESを新しく始めますか？','現在の途中保存は削除されます。','新しく始める');
   if(!ok)return;
 }
 minesNew.disabled=true;
 try{
   clearInterval(minesClock);minesClock=null;
   if(wasDaily){
     if(mines&&!mines.finished&&mines.sessionToken)await cancelPlaySession(mines.sessionToken);
   }else{
     await saveQueue.catch(()=>{});
     const reset=await FlecityBridge.call('playResetSave',{gameId:'mines'});
     if(!reset.ok){setStatus('MINESをリセットできません: '+FlecityErrors.text(reset.error),'error');if(mines&&!mines.finished)minesClock=setInterval(updateMinesTime,250);return;}
     delete saves.mines;
   }
   mines=null;await openMines(true,wasDaily);
 }finally{minesNew.disabled=false;}
};

/* TOWER */
function elapsedStack(){return stackGame?performance.now()-stackGame.startedAt:0;}
function stackCameraTarget(game){return Math.max(0,(Number(game&&game.layerCount)||0)-5);}
function renderStack(){
 if(!stackGame)return;
 stackScore.textContent=Math.round(stackGame.score).toLocaleString();
 const tension=stackGame.width<=22?'DANGER':(stackGame.width<=38?'TIGHT':'STABLE');
 const speedTier=stackGame.speed>=165?'TURBO':(stackGame.speed>=130?'FAST':(stackGame.speed>=95?'UP':'NORMAL'));
 stackMeta.textContent='HEIGHT '+String(stackGame.layerCount)+' · PERFECT ×'+String(stackGame.perfectStreak)+' · SPEED '+speedTier+' · 幅 '+stackGame.width.toFixed(1)+'% · '+tension;
 stackArena.classList.toggle('tower-fever',stackGame.perfectStreak>=3);
 stackArena.classList.toggle('tower-tight',tension==='TIGHT');
 stackArena.classList.toggle('tower-danger',tension==='DANGER');
 const targetCamera=stackCameraTarget(stackGame),currentCamera=Number(stackGame.cameraOffset)||0;
 stackGame.cameraOffset=appSettings.reducedMotion?targetCamera:(Math.abs(targetCamera-currentCamera)<.01?targetCamera:currentCamera+(targetCamera-currentCamera)*.14);
 const camera=stackGame.cameraOffset,baseBottom=1.125,step=1.25,startIndex=Math.max(0,Math.floor(camera)-1);
 stackArena.dataset.camera=targetCamera>0?'follow':'base';
 stackArena.querySelectorAll('.stack-layer').forEach(n=>n.remove());
 for(let layerIndex=startIndex;layerIndex<stackGame.layers.length-1;layerIndex++){
   const layer=stackGame.layers[layerIndex],bottom=baseBottom+(layerIndex-camera)*step;
   if(bottom<-1.5||bottom>16.5)continue;
   const d=document.createElement('div');d.className='stack-layer'+(layer.perfect?' perfect-layer':'');d.style.left=layer.x+'%';d.style.width=layer.width+'%';d.style.bottom=bottom+'rem';stackArena.insertBefore(d,stackMover);
 }
 const topIndex=stackGame.layers.length-1,top=stackGame.layers[topIndex],topBottom=baseBottom+(topIndex-camera)*step;
 stackBase.style.left=top.x+'%';stackBase.style.width=top.width+'%';stackBase.style.bottom=topBottom+'rem';
 stackMover.style.left=stackGame.x+'%';stackMover.style.width=stackGame.width+'%';stackMover.style.bottom=(topBottom+step)+'rem';
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
 const session=await startSessionWithRetry({gameId:'stack'});
 if(!session.ok){if(session.error!=='APP_SUSPENDED'){setStatus('TOWERを開始できません: '+FlecityErrors.text(session.error),'error');showHome();}return;}
 const width=Number(session.challenge&&session.challenge.initialWidthPct)||72;
 const startedAt=performance.now();
 stackGame={sessionToken:session.sessionToken,startedAt,layerStartedAt:startedAt,layers:[{x:(100-width)/2,width,perfect:false}],layerCount:0,cameraOffset:0,x:0,width,score:0,perfectStreak:0,maxPerfectStreak:0,speed:Number(session.challenge&&session.challenge.speedPctPerSec)||65,reverse:false,history:[],finished:false};
 stackDrop.disabled=false;stackDrop.textContent='DROP';setStatus('TOWER START · PERFECTをつないで倍率を上げよう。','good');renderStack();stackRaf=requestAnimationFrame(stackLoop);
}
async function finishStack(){
 const game=stackGame;if(!game||game.finished||game.finalizing)return;
 game.finished=true;game.finalizing=true;cancelAnimationFrame(stackRaf);stackDrop.disabled=true;stackDrop.textContent='終了';
 const durationMs=Math.max(0,Math.round(performance.now()-game.startedAt));
 const res=await submitScoreWithRetry({sessionToken:game.sessionToken,score:game.score,durationMs,history:game.history});
 game.finalizing=false;
 if(res.ok){
   game.sessionToken=null;
   if(stackGame===game){
     const layers=Number(res.details&&res.details.layers)||game.layerCount,maxStreak=Number(res.details&&res.details.maxPerfectStreak)||game.maxPerfectStreak;
     showScoreResult('stack',res,'TOWER '+Number(res.score).toLocaleString()+' pts · HEIGHT '+layers+' · PERFECT ×'+maxStreak);
     renderStack();
   }
   await refreshPlatform();
 }else{
   await cancelPlaySession(game.sessionToken);game.sessionToken=null;
   if(stackGame===game)setStatus('TOWERスコアを保存できませんでした: '+FlecityErrors.text(res.error),'error');
 }
}
async function dropStackBlock(){
 if(!stackGame||stackGame.finished||stackGame.finalizing)return;
 const now=performance.now(),previous=stackGame.history.length?stackGame.history[stackGame.history.length-1]:0;
 const actionMs=Math.max(previous+.001,Math.round((now-stackGame.startedAt)*1000)/1000);
 stackGame.x=stackPosition(now-stackGame.layerStartedAt,stackGame.width,stackGame.speed,stackGame.reverse);
 stackGame.history.push(actionMs);
 const base=stackGame.layers[stackGame.layers.length-1];
 let left=Math.max(base.x,stackGame.x),right=Math.min(base.x+base.width,stackGame.x+stackGame.width),overlap=right-left;
 if(overlap<=.0001){stackArena.classList.add('tower-fall');tone(110,120);await finishStack();return;}
 const scoreBefore=Number(stackGame.score)||0,previousWidth=stackGame.width,precision=previousWidth>0?overlap/previousWidth:0,perfect=precision>=.985;
 if(perfect){
   stackGame.perfectStreak=Math.min(8,stackGame.perfectStreak+1);
   stackGame.maxPerfectStreak=Math.max(stackGame.maxPerfectStreak,stackGame.perfectStreak);
   left=base.x;overlap=previousWidth;
 }else stackGame.perfectStreak=0;
 let placementScore=100+Math.round(precision*100);
 if(perfect)placementScore+=100*stackGame.perfectStreak;
 else if(precision>=.9)placementScore+=40;
 stackGame.layers.push({x:left,width:overlap,perfect});
 stackGame.layerCount+=1;stackGame.score+=placementScore;stackGame.width=overlap;
 const rankUp=liveRankUpPrefix('stack',scoreBefore,stackGame.score);
 stackArena.classList.remove('perfect-hit','nice-hit','tower-score-pop');void stackArena.offsetWidth;stackArena.classList.add('tower-score-pop');
 if(perfect){
   stackArena.classList.add('perfect-hit');
   setStatus(rankUp+'PERFECT ×'+stackGame.perfectStreak+' · +'+placementScore+' pts','good');
   tone(820+Math.min(160,stackGame.perfectStreak*18),55);
 }else if(precision>=.97){
   stackArena.classList.add('nice-hit');setStatus(rankUp+'SO CLOSE · '+(precision*100).toFixed(1)+'% · +'+placementScore+' pts','good');tone(770,44);
 }else if(precision>=.9){
   stackArena.classList.add('nice-hit');setStatus(rankUp+'NICE · '+(precision*100).toFixed(1)+'% · +'+placementScore+' pts','good');tone(720,40);
 }else{
   setStatus(rankUp+'KEEP GOING · '+(precision*100).toFixed(1)+'% · +'+placementScore+' pts','good');tone(470,24);
 }
 stackGame.speed=Math.min(190,stackGame.speed+5);
 if(stackGame.layerCount>0&&stackGame.layerCount%5===0){setStatus(rankUp+'HEIGHT '+stackGame.layerCount+' · SPEED UP · '+Math.round(stackGame.speed)+'%/s','good');tone(980,70);}
 stackGame.reverse=(stackGame.layerCount%2)===1;
 stackGame.layerStartedAt=now;
 stackGame.x=stackPosition(0,stackGame.width,stackGame.speed,stackGame.reverse);
 renderStack();
}
stackDrop.onclick=()=>{void dropStackBlock();};
stackArena.onclick=()=>{void dropStackBlock();};
stackArena.onkeydown=event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();void dropStackBlock();}};
stackBack.onclick=async()=>{if(stackGame&&stackGame.finalizing){setStatus('TOWERの記録を保存中です…','warn');return;}if(stackGame&&!stackGame.finished){const ok=await confirmAction('TOWERを終了しますか？','現在のRunは記録されず終了します。','終了する');if(!ok)return;}cancelAnimationFrame(stackRaf);if(stackGame&&!stackGame.finished&&stackGame.sessionToken)await cancelPlaySession(stackGame.sessionToken);stackGame=null;showHome();};
stackNew.onclick=async()=>{if(stackGame&&stackGame.finalizing){setStatus('TOWERの記録を保存中です…','warn');return;}if(stackGame&&!stackGame.finished){const ok=await confirmAction('TOWERをやり直しますか？','現在のRunは記録されず、新しく始めます。','やり直す');if(!ok)return;}cancelAnimationFrame(stackRaf);if(stackGame&&!stackGame.finished&&stackGame.sessionToken)await cancelPlaySession(stackGame.sessionToken);stackGame=null;await openStack();};

/* NONOGRAM */
const NONOGRAM_PATTERNS_5=[
 ['01010','11111','11111','01110','00100'], // heart
 ['00100','00100','11111','00100','00100'], // cross
 ['00100','01110','11111','01110','00100'], // diamond
 ['00100','01110','11111','10001','11111'], // house
 ['00100','01100','11111','01100','00100'], // arrow
 ['10001','10001','00000','10001','01110'], // smile
 ['10001','10001','10001','01110','00100'], // cup
 ['00100','01110','11111','00100','00100'], // tree
 ['10000','11000','11100','11110','11111'], // stairs
 ['10101','01010','10101','01010','10101'], // checker
 ['11111','10001','10001','10001','11111'], // frame
 ['10101','11111','01110','01110','11111'], // crown
 ['00100','01110','11111','01110','10101'], // rocket
 ['00100','01110','11111','01110','00101'], // fish
 ['10001','01010','00100','01010','10001'], // X
 ['11111','01110','00100','01110','11111'], // hourglass
 ['11111','00100','00100','00100','00100'], // T
 ['10001','10001','11111','10001','10001'], // H
 ['01110','10001','11111','10001','10001'], // A
 ['10001','10001','10001','10001','01110'], // U
 ['10000','10000','10000','10000','11111'], // L
 ['11000','01100','00110','00011','00000'], // zigzag
 ['01110','01010','01110','00100','00111'], // key
 ['00100','01110','11111','00100','01010'], // umbrella
 ['10001','11011','01110','11011','10001'], // butterfly
 ['01110','10101','11111','01010','01010'], // skull
 ['10001','11011','11111','10101','01110'], // cat
 ['00100','01100','11100','11111','01110'], // boat
 ['00110','00101','00101','10100','01100'], // note
 ['00110','01100','11110','00110','01100']  // bolt
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
 const game=nonogram;if(!game||game.finished)return false;
 if(game.timingStarted)return true;
 if(game.timingActivating)return false;
 game.timingActivating=true;
 try{
   const res=await FlecityBridge.call('playActivateSession',{sessionToken:game.sessionToken});
   if(nonogram!==game)return false;
   if(!res.ok){setStatus('NONOGRAMのタイマーを開始できません: '+FlecityErrors.text(res.error),'error');return false;}
   game.elapsedBase=Number(res.elapsedMs??game.elapsedBase)||0;game.timingStarted=true;game.timingStartedAt=performance.now();return true;
 }finally{game.timingActivating=false;}
}
function updateNonogramTime(){if(nonogram){const ms=Number.isFinite(Number(nonogram.displayElapsedMs))?Number(nonogram.displayElapsedMs):elapsedNonogram();nonogramTime.textContent=(ms/1000).toFixed(1)+'s';}}
function nonogramLineSolved(axis,line){
 if(!nonogram)return false;
 for(let i=0;i<nonogram.size;i++){
   const index=axis==='row'?line*nonogram.size+i:i*nonogram.size+line;
   if(nonogram.solution.has(index)!==nonogram.filled.has(index))return false;
 }
 return true;
}
function nonogramSolvedLines(){
 if(!nonogram)return 0;let n=0;
 for(let i=0;i<nonogram.size;i++){if(nonogramLineSolved('row',i))n++;if(nonogramLineSolved('col',i))n++;}
 return n;
}
function renderNonogram(){
 if(!nonogram)return;nonogramBoard.innerHTML='';updateNonogramTime();
 const solvedLines=nonogramSolvedLines();
 refreshScreenBests();nonogramMeta.textContent=(nonogram.daily?'DAILY · ':'')+String(nonogram.filled.size)+' / '+String(nonogram.solution.size)+' FILLED · LINES '+solvedLines+'/'+String(nonogram.size*2)+(solvedLines>=Math.max(2,nonogram.size)?' · FLOW':'');
 const blank=document.createElement('div');blank.className='nonogram-clue';nonogramBoard.appendChild(blank);
 for(let x=0;x<nonogram.size;x++){
   const vals=[];for(let y=0;y<nonogram.size;y++)vals.push(nonogram.solution.has(y*nonogram.size+x));
   const clue=document.createElement('div');clue.className='nonogram-clue'+(nonogramLineSolved('col',x)?' solved':'');clue.textContent=nonogramClue(vals);nonogramBoard.appendChild(clue);
 }
 nonogramCheck.disabled=nonogram.finished||nonogram.finalizing;
 nonogramNew.disabled=nonogram.finalizing===true;
 for(let y=0;y<nonogram.size;y++){
   const vals=[];for(let x=0;x<nonogram.size;x++)vals.push(nonogram.solution.has(y*nonogram.size+x));
   const clue=document.createElement('div');clue.className='nonogram-clue'+(nonogramLineSolved('row',y)?' solved':'');clue.textContent=nonogramClue(vals);nonogramBoard.appendChild(clue);
   for(let x=0;x<nonogram.size;x++){
     const index=y*nonogram.size+x,b=document.createElement('button');b.className='nonogram-cell'+(nonogram.filled.has(index)?' filled':'')+(nonogram.crossed.has(index)?' crossed':'');
     b.textContent=nonogram.crossed.has(index)?'×':'';b.disabled=nonogram.finished;
     let holdTimer=null;
     const clearHold=()=>{if(holdTimer){clearTimeout(holdTimer);holdTimer=null;}};
     b.onpointerdown=()=>{if(b.disabled)return;clearHold();holdTimer=setTimeout(()=>{holdTimer=null;nonogramSuppressClickUntil=performance.now()+650;void crossNonogramDirect(index);},420);};
     b.onpointerup=clearHold;b.onpointercancel=clearHold;b.onpointerleave=clearHold;
     b.onclick=()=>{clearHold();if(performance.now()<nonogramSuppressClickUntil)return;void touchNonogram(index);};
     nonogramBoard.appendChild(b);
   }
 }
}
async function persistNonogram(showError=false){
 if(!nonogram||nonogram.finished||nonogram.daily)return true;
 if(nonogram.progressed!==true)return true;
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
 const session=await startSessionWithRetry(payload);
 if(!session.ok){if(session.error!=='APP_SUSPENDED'){setStatus('NONOGRAMを開始できません: '+FlecityErrors.text(session.error),'error');showHome();}return;}
 const size=Number(session.challenge&&session.challenge.size)||5,seed=Number(session.seed);
 nonogram={size,seed,solution:seededNonogram(seed,size),filled:new Set(saved&&saved.state?saved.state.filled||[]:[]),crossed:new Set(saved&&saved.state?saved.state.crossed||[]:[]),
   elapsedBase:Number(session.baseElapsedMs||0),timingStarted:false,timingStartedAt:null,timingActivating:false,sessionToken:session.sessionToken,finished:false,daily:session.daily===true,progressed:!!saved};
 nonogramNew.textContent=nonogram.daily?'最初から':'新しい問題';setStatus(saved?'NONOGRAMを途中保存から再開しました。タップで塗る・長押しで×。':(nonogram.daily?'デイリーNONOGRAM開始。タップで塗る・長押しで×。':'新しいNONOGRAMを開始しました。タップで塗る・長押しで×。'),'good');renderNonogram();nonogramClock=setInterval(updateNonogramTime,250);
}
async function crossNonogramDirect(index){
 const game=nonogram;if(!game||game.finished)return;
 if(!(await activateNonogramTiming())||nonogram!==game)return;
 nonogram.progressed=true;
 if(nonogram.crossed.has(index)){nonogram.crossed.delete(index);tone(190,12);}
 else{nonogram.filled.delete(index);nonogram.crossed.add(index);tone(300,20);}
 nonogramBoard.classList.remove('cross-pop');void nonogramBoard.offsetWidth;nonogramBoard.classList.add('cross-pop');
 renderNonogram();await persistNonogram();
}
async function touchNonogram(index){
 const game=nonogram;if(!game||game.finished)return;
 if(!(await activateNonogramTiming())||nonogram!==game)return;
 nonogram.progressed=true;const solvedBefore=nonogramSolvedLines();
 if(nonogram.filled.has(index)){nonogram.filled.delete(index);tone(260,16);}
 else{nonogram.crossed.delete(index);nonogram.filled.add(index);tone(520,18);}
 const solvedAfter=nonogramSolvedLines();
 nonogramBoard.classList.remove('cell-touch','line-solved');void nonogramBoard.offsetWidth;nonogramBoard.classList.add(solvedAfter>solvedBefore?'line-solved':'cell-touch');
 if(solvedAfter>solvedBefore){tone(760,45);setStatus('LINE COMPLETE · '+solvedAfter+'/'+String(nonogram.size*2),'good');}
 renderNonogram();await persistNonogram();
}
nonogramCheck.onclick=async()=>{
 const game=nonogram;if(!game||game.finished||game.finalizing)return;
 game.finalizing=true;nonogramCheck.disabled=true;
 await saveQueue.catch(()=>{});
 if(nonogram!==game){game.finalizing=false;return;}
 const durationMs=Math.round((game.elapsedBase||0)+(game.timingStartedAt?performance.now()-game.timingStartedAt:0));game.displayElapsedMs=durationMs;if(nonogram===game)updateNonogramTime();
 const res=await submitScoreWithRetry({sessionToken:game.sessionToken,score:durationMs,durationMs,filled:[...game.filled]});
 game.finalizing=false;if(nonogram===game)nonogramCheck.disabled=false;
 if(res.ok){game.finished=true;game.displayElapsedMs=Number(res.score);clearInterval(nonogramClock);if(!game.daily)delete saves.nonogram;if(nonogram===game){showScoreResult('nonogram',res,(res.daily?'デイリー · ':'')+'NONOGRAM '+(Number(res.score)/1000).toFixed(2)+'s');renderNonogram();}await refreshPlatform();}
 else if(nonogram===game&&res.error==='INCORRECT_SOLUTION'){game.displayElapsedMs=null;setStatus('まだ正解ではありません。','warn');}
 else if(nonogram===game)setStatus('NONOGRAM判定失敗: '+FlecityErrors.text(res.error),'error');
};
nonogramBack.onclick=async()=>{if(nonogram&&nonogram.finalizing){setStatus('NONOGRAMを判定中です…','warn');return;}clearInterval(nonogramClock);nonogramClock=null;if(nonogram&&!nonogram.finished&&!nonogram.daily){const saved=await persistNonogram(true);if(!saved){nonogramClock=setInterval(updateNonogramTime,250);return;}}if(nonogram&&!nonogram.finished&&nonogram.sessionToken)await cancelPlaySession(nonogram.sessionToken);nonogram=null;showHome();};
nonogramNew.onclick=async()=>{
 if(nonogramNew.disabled)return;
 if(nonogram&&nonogram.finalizing){setStatus('NONOGRAMを判定中です…','warn');return;}
 const wasDaily=!!(nonogram&&nonogram.daily);
 const destructive=!wasDaily&&(!!saves.nonogram||!!(nonogram&&!nonogram.finished));
 if(destructive){
   const ok=await confirmAction('NONOGRAMを新しく始めますか？','現在の途中保存は削除されます。','新しい問題');
   if(!ok)return;
 }
 nonogramNew.disabled=true;
 try{
   clearInterval(nonogramClock);nonogramClock=null;
   if(wasDaily){
     if(nonogram&&!nonogram.finished&&nonogram.sessionToken)await cancelPlaySession(nonogram.sessionToken);
   }else{
     await saveQueue.catch(()=>{});
     const reset=await FlecityBridge.call('playResetSave',{gameId:'nonogram'});
     if(!reset.ok){setStatus('NONOGRAMをリセットできません: '+FlecityErrors.text(reset.error),'error');if(nonogram&&!nonogram.finished)nonogramClock=setInterval(updateNonogramTime,250);return;}
     delete saves.nonogram;
   }
   nonogram=null;await openNonogram(true,wasDaily);
 }finally{nonogramNew.disabled=false;}
};


/* SORT */
function elapsedSort(){
 return (sortGame?sortGame.elapsedBase:0)+(sortGame&&sortGame.startedAt?performance.now()-sortGame.startedAt:0);
}
function updateSortTime(){
 if(sortGame)sortTime.textContent=(elapsedSort()/1000).toFixed(1)+'s';
}
function sortTubeComplete(tube){
 return Array.isArray(tube)&&tube.length===4&&tube.every(value=>value===tube[0]);
}
function sortSolved(){
 if(!sortGame)return false;
 let complete=0;
 for(const tube of sortGame.tubes){
   if(tube.length===0)continue;
   if(!sortTubeComplete(tube))return false;
   complete+=1;
 }
 return complete===4;
}
function sortPourCount(source,target){
 if(!Array.isArray(source)||source.length<1||!Array.isArray(target)||target.length>=4)return 0;
 const value=source[source.length-1],capacity=4-target.length;
 let run=0;
 for(let i=source.length-1;i>=0&&source[i]===value&&run<capacity;i--)run++;
 return run;
}
function renderSort(){
 if(!sortGame)return;
 refreshScreenBests();sortBoard.innerHTML='';sortMoves.textContent=String(sortGame.moves);
 const completeCount=sortGame.tubes.filter(sortTubeComplete).length;
 sortMeta.textContent=String(sortGame.moves)+' MOVES · '+String(completeCount)+'/4 SORTED'+(completeCount>=2&&!sortGame.finished?' · FLOW '+String(completeCount):'')+(sortGame.finished?' · CLEAR':'');
 sortGame.tubes.forEach((tube,index)=>{
   const button=document.createElement('button');
   button.className='sort-tube'+(sortGame.selected===index?' selected':'')+(sortTubeComplete(tube)?' complete':'');
   button.disabled=sortGame.finished||sortGame.finalizing;
   button.setAttribute('aria-label','チューブ '+String(index+1));
   for(let slot=0;slot<4;slot++){
     const value=tube[slot],cell=document.createElement('span');
     cell.className='sort-slot'+(value===undefined?' empty':' sort-color-'+String(value));
     if(value!==undefined)cell.dataset.color=String(value);
     button.appendChild(cell);
   }
   button.onclick=()=>touchSortTube(index);
   sortBoard.appendChild(button);
 });
 updateSortTime();
 sortUndo.disabled=sortGame.finalizing===true||sortGame.finished||sortGame.history.length<1||sortGame.selected!=null;
 sortNew.disabled=sortGame.finalizing===true;
}
async function persistSort(showError=false){
 const game=sortGame;if(!game||game.finished||game.progressed!==true)return true;
 const elapsedMs=Math.round(elapsedSort());
 const state={history:game.history};
 const res=await saveWithRetry({gameId:'sort',sessionToken:game.sessionToken,state,score:game.moves,elapsedMs});
 if(res.ok){
   const canonical=res.state||state;
   saves.sort={game_id:'sort',state:canonical,score:Number(res.score??game.moves),elapsed_ms:Number(res.elapsedMs??elapsedMs)};
   return true;
 }
 if(showError&&sortGame===game)setStatus('SORTの保存に失敗しました: '+FlecityErrors.text(res.error),'error');
 return false;
}
async function openSort(forceNew){
 hideAll();sortEl.classList.remove('hidden');clearInterval(sortClock);sortClock=null;
 const saved=!forceNew&&saves.sort,payload={gameId:'sort'};if(saved)payload.resume=true;
 const session=await startSessionWithRetry(payload);
 if(!session.ok){if(session.error!=='APP_SUSPENDED'){setStatus('SORTを開始できません: '+FlecityErrors.text(session.error),'error');showHome();}return;}
 let tubes,history=[],moves=0;
 if(saved&&saved.state&&Array.isArray(saved.state.tubes)&&saved.state.tubes.length===6){
   tubes=saved.state.tubes.map(tube=>Array.isArray(tube)?tube.slice():[]);
   history=Array.isArray(saved.state.history)?saved.state.history.map(move=>Array.isArray(move)?move.slice(0,2):move):[];
   moves=Number(saved.state.moves)||history.length;
 }else{
   const initial=session.challenge&&session.challenge.initialTubes;
   if(!Array.isArray(initial)||initial.length!==6){
     await cancelPlaySession(session.sessionToken);setStatus('SORT盤面を取得できませんでした。','error');showHome();return;
   }
   tubes=initial.map(tube=>Array.isArray(tube)?tube.slice():[]);
 }
 sortGame={tubes,history,moves,selected:null,elapsedBase:Number(session.baseElapsedMs||0),startedAt:performance.now(),sessionToken:session.sessionToken,seed:Number(session.seed)||1,finished:false,finalizing:false,progressed:!!saved};
 setStatus(saved?'SORTを途中保存から再開しました。':'新しいSORTを開始しました。','good');
 renderSort();sortClock=setInterval(updateSortTime,200);
}
async function touchSortTube(index){
 const game=sortGame;if(!game||game.finished||game.finalizing)return;
 const tube=game.tubes[index];
 if(game.selected==null){
   if(!tube||tube.length===0){tone(170,20);setStatus('空のチューブです。','warn');return;}
   game.selected=index;tone(420,18);renderSort();return;
 }
 const from=game.selected;
 if(from===index){game.selected=null;renderSort();return;}
 const source=game.tubes[from],target=game.tubes[index];
 if(!source||source.length===0){game.selected=null;renderSort();return;}
 if(!target||target.length>=4){tone(150,28);setStatus('そのチューブには入りません。','warn');return;}
 const completeBefore=game.tubes.filter(sortTubeComplete).length,pourCount=sortPourCount(source,target);
 if(pourCount<1){tone(150,28);setStatus('そのチューブには移せません。','warn');return;}
 for(let moved=0;moved<pourCount;moved++){
   target.push(source.pop());game.history.push([from,index]);game.moves+=1;
 }
 game.progressed=true;game.selected=null;
 const completeAfter=game.tubes.filter(sortTubeComplete).length;
 sortBoard.classList.remove('sort-move','sort-pour');void sortBoard.offsetWidth;sortBoard.classList.add(pourCount>1?'sort-pour':'sort-move');
 tone(sortTubeComplete(target)?780:(pourCount>1?620:520),sortTubeComplete(target)?48:(pourCount>1?34:20));
 if(completeAfter>completeBefore&&!sortSolved())setStatus((pourCount>1?'POUR ×'+pourCount+' · ':'')+'SORT FLOW · '+completeAfter+'/4 完成','good');
 else if(pourCount>1)setStatus('QUICK POUR ×'+pourCount+' · '+game.moves+' MOVES','good');
 renderSort();
 if(sortSolved()){await finishSort();return;}
 await persistSort();
}
async function undoSortMove(){
 const game=sortGame;if(!game||game.finished||game.finalizing||game.selected!=null||game.history.length<1)return;
 const last=game.history[game.history.length-1];
 if(!Array.isArray(last)||last.length<2)return;
 const from=Number(last[0]),to=Number(last[1]),source=game.tubes[to],target=game.tubes[from];
 if(!source||source.length<1||!target||target.length>=4){setStatus('この手は戻せません。','warn');return;}
 const value=source.pop();target.push(value);
 game.history.push([to,from]);game.moves+=1;game.progressed=true;
 sortBoard.classList.remove('sort-move','sort-undo');void sortBoard.offsetWidth;sortBoard.classList.add('sort-undo');
 tone(340,28);setStatus('UNDO · 手数にはカウントされます','good');renderSort();await persistSort();
}
sortUndo.onclick=undoSortMove;

async function finishSort(){
 const game=sortGame;if(!game||game.finished||game.finalizing)return;
 game.finalizing=true;if(sortGame===game)renderSort();clearInterval(sortClock);sortClock=null;
 await saveQueue.catch(()=>{});
 const durationMs=Math.round(elapsedSort());
 const res=await submitScoreWithRetry({sessionToken:game.sessionToken,score:0,durationMs,history:game.history});
 game.finalizing=false;
 if(res.ok){
   game.finished=true;game.sessionToken=null;delete saves.sort;
   const actual=Number(res.details&&res.details.timeMs)||durationMs,moves=Number(res.details&&res.details.moves)||game.moves,penalty=Number(res.details&&res.details.movePenaltyMs)||0,rankScore=Number(res.score)||actual+penalty;
   if(sortGame===game){sortTime.textContent=(actual/1000).toFixed(1)+'s';showScoreResult('sort',res,'SORT '+(actual/1000).toFixed(1)+'s · '+moves+' MOVES · MOVE +'+(penalty/1000).toFixed(1)+'s · RANK SCORE '+(rankScore/1000).toFixed(1)+'s');renderSort();}
   await refreshPlatform();
 }else{
   if(game.sessionToken)await cancelPlaySession(game.sessionToken);game.sessionToken=null;
   if(sortGame===game){setStatus('SORTの記録を保存できませんでした。途中保存は残っています。','error');renderSort();}
 }
}
sortBack.onclick=async()=>{
 if(sortGame&&sortGame.finalizing){setStatus('SORTの記録を保存中です…','warn');return;}
 clearInterval(sortClock);sortClock=null;
 if(sortGame&&!sortGame.finished){const saved=await persistSort(true);if(!saved){sortClock=setInterval(updateSortTime,200);return;}}
 if(sortGame&&!sortGame.finished&&sortGame.sessionToken)await cancelPlaySession(sortGame.sessionToken);
 sortGame=null;showHome();
};
sortNew.onclick=async()=>{
 if(sortNew.disabled)return;
 if(sortGame&&sortGame.finalizing){setStatus('SORTの記録を保存中です…','warn');return;}
 const destructive=!!saves.sort||!!(sortGame&&!sortGame.finished);
 if(destructive){
   const ok=await confirmAction('SORTを新しく始めますか？','現在の途中保存は削除されます。','新しく始める');
   if(!ok)return;
 }
 sortNew.disabled=true;
 try{
   clearInterval(sortClock);sortClock=null;await saveQueue.catch(()=>{});
   if(sortGame&&sortGame.sessionToken)await cancelPlaySession(sortGame.sessionToken);
   const reset=await FlecityBridge.call('playResetSave',{gameId:'sort'});
   if(!reset.ok){setStatus('SORTの保存をリセットできません: '+FlecityErrors.text(reset.error),'error');return;}
   delete saves.sort;sortGame=null;await openSort(true);
 }finally{sortNew.disabled=false;}
};


/* SLIDE */
function elapsedSlide(){
 return (slideGame?slideGame.elapsedBase:0)+(slideGame&&slideGame.startedAt?performance.now()-slideGame.startedAt:0);
}
function updateSlideTime(){
 if(slideGame)slideTime.textContent=(elapsedSlide()/1000).toFixed(1)+'s';
}
function slideSolvedBoard(board){
 if(!Array.isArray(board)||board.length!==16)return false;
 for(let i=0;i<15;i++)if(Number(board[i])!==i+1)return false;
 return Number(board[15])===0;
}
function slideCorrectCount(board){
 if(!Array.isArray(board))return 0;let count=0;
 for(let i=0;i<15;i++)if(Number(board[i])===i+1)count++;
 return count;
}
function slideStars(moves){const n=Number(moves)||999;return n<=60?'★★★':(n<=90?'★★☆':'★☆☆');}
function slideMovePath(index){
 if(!slideGame)return [];
 const blank=slideGame.blank,target=Number(index);
 if(!Number.isInteger(target)||target<0||target>=16||target===blank)return [];
 const row=Math.floor(target/4),col=target%4,blankRow=Math.floor(blank/4),blankCol=blank%4;
 if(row!==blankRow&&col!==blankCol)return [];
 const step=row===blankRow?(target>blank?1:-1):(target>blank?4:-4),path=[];
 for(let cursor=blank+step;;cursor+=step){
   path.push(cursor);
   if(cursor===target)break;
   if(path.length>3)return [];
 }
 return path;
}
function slideMovable(index){return slideMovePath(index).length>0;}
function renderSlide(){
 if(!slideGame)return;
 refreshScreenBests();slideBoard.innerHTML='';slideMoves.textContent=String(slideGame.moves);
 slideMeta.textContent=(slideGame.daily?'DAILY · ':'')+String(slideGame.moves)+' MOVES · PAR 90 · ALIGN '+slideCorrectCount(slideGame.board)+'/15'+((slideGame.alignStreak||0)>=2?' · FLOW ×'+slideGame.alignStreak:'')+(slideGame.finished?' · '+slideStars(slideGame.moves):'');
 slideGame.board.forEach((value,index)=>{
   const button=document.createElement('button');
   const blank=Number(value)===0,movable=!blank&&slideMovable(index);
   button.className='slide-tile'+(blank?' blank':'')+(movable?' movable':'')+(slideGame.finished&&!blank?' solved':'');
   button.disabled=blank||slideGame.finished||slideGame.finalizing||!movable;
   button.textContent=blank?'':String(value);
   button.setAttribute('aria-label',blank?'空きマス':('数字 '+String(value)));
   if(!blank)button.onclick=()=>moveSlide(index);
   slideBoard.appendChild(button);
 });
 updateSlideTime();slideNew.disabled=slideGame.finalizing===true;
}
async function persistSlide(showError=false){
 const game=slideGame;if(!game||game.finished||game.daily||game.progressed!==true)return true;
 const elapsedMs=Math.round(elapsedSlide());
 const state={history:game.history};
 const res=await saveWithRetry({gameId:'slide',sessionToken:game.sessionToken,state,score:game.moves,elapsedMs});
 if(res.ok){
   const canonical=res.state||state;
   saves.slide={game_id:'slide',state:canonical,score:Number(res.score??game.moves),elapsed_ms:Number(res.elapsedMs??elapsedMs)};
   return true;
 }
 if(showError&&slideGame===game)setStatus('SLIDEの保存に失敗しました: '+FlecityErrors.text(res.error),'error');
 return false;
}
async function openSlide(forceNew=false,daily=false){
 hideAll();slideEl.classList.remove('hidden');clearInterval(slideClock);slideClock=null;
 const saved=!daily&&!forceNew&&saves.slide,payload={gameId:'slide',daily:daily===true};if(saved)payload.resume=true;
 const session=await startSessionWithRetry(payload);
 if(!session.ok){if(session.error!=='APP_SUSPENDED'){setStatus('SLIDEを開始できません: '+FlecityErrors.text(session.error),'error');showHome();}return;}
 let board,history=[],moves=0,blank=-1;
 if(saved&&saved.state&&Array.isArray(saved.state.board)&&saved.state.board.length===16){
   board=saved.state.board.map(Number);
   history=Array.isArray(saved.state.history)?saved.state.history.map(Number):[];
   moves=Number(saved.state.moves)||history.length;
   blank=Number.isInteger(Number(saved.state.blank))?Number(saved.state.blank):board.indexOf(0);
 }else{
   const initial=session.challenge&&session.challenge.initialBoard;
   if(!Array.isArray(initial)||initial.length!==16){
     await cancelPlaySession(session.sessionToken);setStatus('SLIDE盤面を取得できませんでした。','error');showHome();return;
   }
   board=initial.map(Number);blank=board.indexOf(0);
 }
 if(blank<0||blank>=16){
   await cancelPlaySession(session.sessionToken);setStatus('SLIDE盤面が不正です。','error');showHome();return;
 }
 slideGame={board,blank,history,moves,elapsedBase:Number(session.baseElapsedMs||0),startedAt:performance.now(),sessionToken:session.sessionToken,seed:Number(session.seed)||1,finished:false,finalizing:false,progressed:!!saved,daily:session.daily===true,alignStreak:0};
 setStatus(saved?'SLIDEを途中保存から再開しました。':(slideGame.daily?'デイリーSLIDEを開始しました。':'新しいSLIDEを開始しました。'),'good');
 renderSlide();slideClock=setInterval(updateSlideTime,200);
}
async function moveSlide(index){
 const game=slideGame;if(!game||game.finished||game.finalizing)return;
 const path=slideMovePath(index);if(path.length<1)return;
 const alignedBefore=slideCorrectCount(game.board);
 for(const nextIndex of path){
   const blank=game.blank;
   game.board[blank]=game.board[nextIndex];game.board[nextIndex]=0;game.blank=nextIndex;game.history.push(nextIndex);game.moves+=1;
 }
 game.progressed=true;
 const alignedAfter=slideCorrectCount(game.board),chain=path.length;
 if(alignedAfter>alignedBefore)game.alignStreak=(game.alignStreak||0)+1;else game.alignStreak=0;
 slideBoard.classList.remove('slide-move','slide-align');void slideBoard.offsetWidth;slideBoard.classList.add(alignedAfter>alignedBefore?'slide-align':'slide-move');
 if(alignedAfter>alignedBefore){
   tone(720+Math.min(180,(game.alignStreak||0)*24),32);
   setStatus((chain>1?'CHAIN ×'+chain+' · ':'')+'ALIGN +'+(alignedAfter-alignedBefore)+' · '+alignedAfter+'/15'+(game.alignStreak>=2?' · FLOW ×'+game.alignStreak:''),'good');
 }else if(chain>1){
   tone(590+Math.min(100,chain*24),24);setStatus('CHAIN SLIDE ×'+chain+' · '+game.moves+' MOVES','good');
 }else tone(520,18);
 renderSlide();
 if(slideSolvedBoard(game.board)){await finishSlide();return;}
 await persistSlide();
}
async function finishSlide(){
 const game=slideGame;if(!game||game.finished||game.finalizing)return;
 game.finalizing=true;if(slideGame===game)renderSlide();clearInterval(slideClock);slideClock=null;
 await saveQueue.catch(()=>{});
 const durationMs=Math.round(elapsedSlide());
 const res=await submitScoreWithRetry({sessionToken:game.sessionToken,score:0,durationMs,history:game.history});
 game.finalizing=false;
 if(res.ok){
   game.finished=true;game.sessionToken=null;delete saves.slide;
   const actual=Number(res.details&&res.details.timeMs)||durationMs,moves=Number(res.details&&res.details.moves)||game.moves,penalty=Number(res.details&&res.details.movePenaltyMs)||0,rankScore=Number(res.score)||actual+penalty;
   if(slideGame===game){slideTime.textContent=(actual/1000).toFixed(1)+'s';showScoreResult('slide',res,(res.daily?'デイリー · ':'')+'SLIDE '+slideStars(moves)+' · '+(actual/1000).toFixed(1)+'s · '+moves+' MOVES · MOVE +'+(penalty/1000).toFixed(1)+'s · RANK SCORE '+(rankScore/1000).toFixed(1)+'s');
     renderSlide();}
   await refreshPlatform();
 }else{
   if(game.sessionToken)await cancelPlaySession(game.sessionToken);game.sessionToken=null;
   if(slideGame===game){setStatus('SLIDEの記録を保存できませんでした。途中保存は残っています。','error');renderSlide();}
 }
}
slideBack.onclick=async()=>{
 if(slideGame&&slideGame.finalizing){setStatus('SLIDEの記録を保存中です…','warn');return;}
 clearInterval(slideClock);slideClock=null;
 if(slideGame&&!slideGame.finished&&!slideGame.daily){const saved=await persistSlide(true);if(!saved){slideClock=setInterval(updateSlideTime,200);return;}}
 if(slideGame&&!slideGame.finished&&slideGame.sessionToken)await cancelPlaySession(slideGame.sessionToken);
 slideGame=null;showHome();
};
slideNew.onclick=async()=>{
 if(slideNew.disabled)return;
 if(slideGame&&slideGame.finalizing){setStatus('SLIDEの記録を保存中です…','warn');return;}
 const wasDaily=!!(slideGame&&slideGame.daily);
 const destructive=!wasDaily&&(!!saves.slide||!!(slideGame&&!slideGame.finished));
 if(destructive){
   const ok=await confirmAction('SLIDEを新しく始めますか？','現在の途中保存は削除されます。','新しく始める');
   if(!ok)return;
 }
 slideNew.disabled=true;
 try{
   clearInterval(slideClock);slideClock=null;await saveQueue.catch(()=>{});
   if(slideGame&&slideGame.sessionToken)await cancelPlaySession(slideGame.sessionToken);
   if(wasDaily){
     slideGame=null;await openSlide(true,true);return;
   }
   const reset=await FlecityBridge.call('playResetSave',{gameId:'slide'});
   if(!reset.ok){setStatus('SLIDEの保存をリセットできません: '+FlecityErrors.text(reset.error),'error');return;}
   delete saves.slide;slideGame=null;await openSlide(true,false);
 }finally{slideNew.disabled=false;}
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
function colorMatchChoiceOrder(seed,roundIndex){
 const order=[0,1,2,3];let state=Math.floor(Number(seed)||1)+((Number(roundIndex)||0)+1)*7919;
 for(let i=order.length-1;i>0;i--){let value;[state,value]=colorMatchNext(state);const j=Math.floor(value*(i+1));[order[i],order[j]]=[order[j],order[i]];}
 return order;
}
function renderColorMatch(){
 colorMatchChoices.innerHTML='';refreshScreenBests();
 if(!colorMatch||!colorMatch.running){
   colorMatchProgress.textContent='0 / 20 · ♥♥♥';colorMatchTime.textContent='0.0s';colorMatchWord.textContent='READY';colorMatchWord.style.color='';
   return;
 }
 const round=colorMatch.rounds[colorMatch.index];
 const stage=Math.min(4,Math.floor(colorMatch.index/5)+1);
 colorMatchProgress.textContent=String(Math.min(colorMatch.index+1,colorMatch.rounds.length))+' / '+String(colorMatch.rounds.length)+' · STAGE '+stage+'/4 · '+'♥'.repeat(Math.max(0,colorMatch.lives))+(colorMatch.streak>=2?' · STREAK '+colorMatch.streak:'')+(colorMatch.streak>=5?' · FEVER':'');
 colorMatchWord.textContent=COLOR_MATCH_COLORS[round.word].name;
 colorMatchWord.style.color=COLOR_MATCH_COLORS[round.ink].css;
 colorMatchChoiceOrder(colorMatch.seed,colorMatch.index).forEach(index=>{
   const entry=COLOR_MATCH_COLORS[index],b=document.createElement('button');b.className='color-match-choice';b.textContent=entry.name;
   b.disabled=colorMatch.busy===true;b.onclick=()=>answerColorMatch(index);colorMatchChoices.appendChild(b);
 });
 updateColorMatchTime();
}
function openColorMatch(daily=false){
 hideAll();colorMatchEl.classList.remove('hidden');clearInterval(colorMatchClock);colorMatchClock=null;colorMatch=null;
 colorMatchEl.dataset.daily=daily===true?'1':'0';
 colorMatchStart.disabled=false;colorMatchStart.classList.remove('hidden');colorMatchStart.textContent='スタート';colorMatchNew.classList.add('hidden');renderColorMatch();
 setStatus(daily?'デイリーCOLOR MATCH RUSH。同じ20問で記録を競います。':'20問・3ライフ。ミスしても続けられますがタイムペナルティ。','good');
}
async function startColorMatch(){
 if(colorMatch&&colorMatch.running)return;
 colorMatchStart.disabled=true;
 const daily=colorMatchEl.dataset.daily==='1';
 const session=await startSessionWithRetry({gameId:'color_match',daily});
 if(!session.ok){colorMatchStart.disabled=false;if(session.error!=='APP_SUSPENDED')setStatus('COLOR MATCHを開始できません: '+FlecityErrors.text(session.error),'error');return;}
 const rounds=colorMatchRounds(session.seed,Number(session.challenge&&session.challenge.rounds)||20);
 colorMatch={sessionToken:session.sessionToken,seed:Number(session.seed)||1,rounds,index:0,history:[],lives:Number(session.challenge&&session.challenge.lives)||3,misses:0,streak:0,maxStreak:0,startedAt:performance.now(),running:true,finished:false,busy:false,daily:session.daily===true};
 colorMatchStart.classList.add('hidden');colorMatchNew.classList.remove('hidden');setStatus(colorMatch.daily?'デイリーCOLOR MATCH RUSH開始。':'COLOR MATCH RUSH開始。3ライフで20問突破を狙え。','good');renderColorMatch();colorMatchClock=setInterval(updateColorMatchTime,100);
}
async function answerColorMatch(choice){
 const game=colorMatch;if(!game||!game.running||game.finished||game.busy)return;
 game.busy=true;colorMatchChoices.querySelectorAll('button').forEach(button=>{button.disabled=true;});
 const round=game.rounds[game.index];game.history.push(choice);
 const correct=choice===round.ink;
 colorMatchEl.classList.remove('match-ok','match-miss','match-fever');void colorMatchEl.offsetWidth;colorMatchEl.classList.add(correct?'match-ok':'match-miss');
 if(correct){
   game.streak+=1;game.maxStreak=Math.max(game.maxStreak,game.streak);
   if(game.streak>=5)colorMatchEl.classList.add('match-fever');
   tone(700+Math.min(220,game.streak*18),35);
   if(game.streak>0&&game.streak%5===0)setStatus('COLOR STREAK ×'+game.streak+' · FLOW','good');
 }else{
   game.misses+=1;game.lives-=1;game.streak=0;tone(210,55);
   setStatus('MISS · ライフ残り '+Math.max(0,game.lives)+' · +1.5s','warn');
 }
 game.index+=1;
 if(game.lives<=0){
   game.running=false;game.finished=true;clearInterval(colorMatchClock);colorMatchClock=null;
   if(game.sessionToken)await cancelPlaySession(game.sessionToken);game.sessionToken=null;
   if(colorMatch===game){
     colorMatchChoices.innerHTML='';colorMatchWord.textContent='GAME OVER';colorMatchWord.style.color='';
     colorMatchStart.classList.remove('hidden');colorMatchStart.disabled=false;colorMatchStart.textContent='もう一度';colorMatchNew.classList.add('hidden');
   }
   return;
 }
 if(game.index>=game.rounds.length){
   game.running=false;game.finished=true;game.finalizing=true;clearInterval(colorMatchClock);colorMatchClock=null;
   const durationMs=Math.max(0,Math.round(performance.now()-game.startedAt));
   const res=await submitScoreWithRetry({sessionToken:game.sessionToken,score:durationMs,durationMs,history:game.history});
   game.finalizing=false;
   if(res.ok){
     game.sessionToken=null;if(colorMatch===game){colorMatchProgress.textContent=String(game.rounds.length)+' / '+String(game.rounds.length)+' · CLEAR';colorMatchWord.textContent='CLEAR';colorMatchWord.style.color='';
     colorMatchTime.textContent=(Number(res.score)/1000).toFixed(3)+'s';colorMatchChoices.innerHTML='';colorMatchNew.classList.add('hidden');colorMatchStart.classList.remove('hidden');colorMatchStart.disabled=false;colorMatchStart.textContent='もう一度';
     const misses=Number(res.details&&res.details.misses)||0,penalty=Number(res.details&&res.details.penaltyMs)||0;
     showScoreResult('color_match',res,(res.daily?'デイリー · ':'')+'COLOR MATCH RUSH '+(Number(res.score)/1000).toFixed(3)+'s · MISS '+misses+(penalty?' · PENALTY '+(penalty/1000).toFixed(1)+'s':'')+' · MAX STREAK '+game.maxStreak);}await refreshPlatform();
   }else{
     await cancelPlaySession(game.sessionToken);game.sessionToken=null;game.finished=true;game.running=false;
     if(colorMatch===game){colorMatchStart.classList.remove('hidden');colorMatchStart.disabled=false;colorMatchStart.textContent='もう一度';setStatus('COLOR MATCHの記録を保存できませんでした。もう一度お試しください。','error');}
   }
   return;
 }
 if(colorMatch===game){
   if(game.index%5===0)setStatus('STAGE '+String(Math.min(4,Math.floor(game.index/5)+1))+'/4 · KEEP FOCUS','good');
   game.busy=false;renderColorMatch();
 }
}
colorMatchStart.onclick=startColorMatch;
colorMatchBack.onclick=async()=>{if(colorMatch&&colorMatch.finalizing){setStatus('COLOR MATCHの記録を保存中です…','warn');return;}if(colorMatch&&colorMatch.running&&!colorMatch.finished){const ok=await confirmAction('COLOR MATCHを終了しますか？','現在のRunは記録されず終了します。','終了する');if(!ok)return;}clearInterval(colorMatchClock);colorMatchClock=null;if(colorMatch&&colorMatch.sessionToken)await cancelPlaySession(colorMatch.sessionToken);colorMatch=null;showHome();};
colorMatchNew.onclick=async()=>{if(colorMatch&&colorMatch.finalizing){setStatus('COLOR MATCHの記録を保存中です…','warn');return;}if(colorMatch&&colorMatch.running&&!colorMatch.finished){const ok=await confirmAction('COLOR MATCHをやり直しますか？','現在のRunは記録されず、新しく始めます。','やり直す');if(!ok)return;}clearInterval(colorMatchClock);colorMatchClock=null;const daily=!!((colorMatch&&colorMatch.daily)||colorMatchEl.dataset.daily==='1');if(colorMatch&&colorMatch.sessionToken)await cancelPlaySession(colorMatch.sessionToken);colorMatch=null;openColorMatch(daily);};

/* NUMBER RUSH */
function numberRushNext(state){
 let x=Math.floor(Number(state)||1)%2147483647;if(x<=0)x=1;
 x=(x*16807)%2147483647;return [x,(x-1)/2147483646];
}
function numberRushSetup(seed,count=25){
 const total=Math.max(2,Math.min(64,Math.floor(Number(count)||25)));
 const board=Array.from({length:total},(_,i)=>i+1);
 let state=Math.floor(Number(seed)||1)%2147483647;if(state<=0)state=1;
 for(let i=board.length-1;i>=1;i--){
   let value;[state,value]=numberRushNext(state);
   const j=Math.floor(value*(i+1));[board[i],board[j]]=[board[j],board[i]];
 }
 return {board,rngState:state};
}
function numberRushBoardFromSeed(seed,count=25){return numberRushSetup(seed,count).board;}
function reshuffleNumberRushRemaining(game){
 const indexes=[],values=[];
 game.board.forEach((value,index)=>{if(!game.completed.has(index)){indexes.push(index);values.push(value);}});
 for(let i=values.length-1;i>=1;i--){
   let value;[game.rngState,value]=numberRushNext(game.rngState);
   const j=Math.floor(value*(i+1));[values[i],values[j]]=[values[j],values[i]];
 }
 indexes.forEach((index,i)=>{game.board[index]=values[i];});
 game.shifts=(game.shifts||0)+1;
}
function elapsedNumberRush(){return numberRush&&numberRush.running?performance.now()-numberRush.startedAt:0;}
function updateNumberRushTime(){if(numberRush&&numberRush.running)numberRushTime.textContent=(elapsedNumberRush()/1000).toFixed(2)+'s';}
function renderNumberRush(){
 numberRushBoard.innerHTML='';
 if(!numberRush){
   numberRushProgress.textContent='1 / 25';numberRushTime.textContent='0.00s';numberRushMeta.textContent='MISS 0 · ペナルティ 0.0s';return;
 }
 numberRushProgress.textContent=(numberRush.finished?numberRush.count:Math.min(numberRush.next,numberRush.count))+' / '+numberRush.count;
 refreshScreenBests();numberRushMeta.textContent=(numberRush.daily?'DAILY · ':'')+'MISS '+numberRush.misses+' · SHIFT '+(numberRush.shifts||0)+' · ペナルティ '+(numberRush.misses*.5).toFixed(1)+'s'+(numberRush.streak>=3?' · FLOW '+numberRush.streak:'');
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
 const session=await startSessionWithRetry({gameId:'number_rush',daily});
 if(!session.ok){numberRushStart.disabled=false;if(session.error!=='APP_SUSPENDED')setStatus('NUMBER RUSHを開始できません: '+FlecityErrors.text(session.error),'error');return;}
 const count=Number(session.challenge&&session.challenge.count)||25,setup=numberRushSetup(session.seed,count);
 numberRush={sessionToken:session.sessionToken,seed:Number(session.seed)||1,count,board:setup.board,rngState:setup.rngState,next:1,misses:0,streak:0,maxStreak:0,shifts:0,history:[],completed:new Set(),startedAt:performance.now(),running:true,finished:false,daily:session.daily===true};
 numberRushStart.classList.add('hidden');numberRushNew.classList.remove('hidden');
 setStatus(numberRush.daily?'デイリーNUMBER RUSH開始。':'NUMBER RUSH開始。','good');
 renderNumberRush();numberRushClock=setInterval(updateNumberRushTime,50);
}
async function tapNumberRush(index){
 if(!numberRush||!numberRush.running||numberRush.finished)return;
 numberRush.history.push(index);
 const value=numberRush.board[index];
 if(value!==numberRush.next){
   numberRush.misses+=1;numberRush.streak=0;tone(180,45);
   const cell=numberRushBoard.children[index];
   if(cell){cell.classList.add('wrong');setTimeout(()=>cell.classList.remove('wrong'),180);}
   numberRushMeta.textContent='MISS '+numberRush.misses+' · ペナルティ '+(numberRush.misses*.5).toFixed(1)+'s';
   return;
 }
 numberRush.completed.add(index);numberRush.next+=1;numberRush.streak+=1;numberRush.maxStreak=Math.max(numberRush.maxStreak,numberRush.streak);
 tone(590+Math.min(340,numberRush.streak*14),28);
 numberRushBoard.classList.remove('rush-hit','rush-flow','rush-shift');void numberRushBoard.offsetWidth;numberRushBoard.classList.add(numberRush.streak>=5?'rush-flow':'rush-hit');
 if(numberRush.next>numberRush.count){await finishNumberRush();return;}
 if((numberRush.next-1)%5===0){
   reshuffleNumberRushRemaining(numberRush);
   numberRushBoard.classList.remove('rush-hit','rush-flow');void numberRushBoard.offsetWidth;numberRushBoard.classList.add('rush-shift');
   setStatus('SHIFT '+numberRush.shifts+' · 残り数字を再配置','good');tone(900,55);
 }else if(numberRush.streak>0&&numberRush.streak%5===0){
   setStatus('FLOW ×'+numberRush.streak+' · KEEP GOING','good');
 }
 renderNumberRush();
}
async function finishNumberRush(){
 const game=numberRush;if(!game||game.finished||game.finalizing)return;
 game.finished=true;game.finalizing=true;game.running=false;clearInterval(numberRushClock);numberRushClock=null;
 const durationMs=Math.max(0,Math.round(performance.now()-game.startedAt));
 const res=await submitScoreWithRetry({sessionToken:game.sessionToken,score:durationMs+(game.misses*500),durationMs,history:game.history});
 game.finalizing=false;
 if(res.ok){
   game.sessionToken=null;
   if(numberRush===game){
     numberRushTime.textContent=(Number(res.score)/1000).toFixed(3)+'s';
     const penalty=Number(res.details&&res.details.penaltyMs)||0;
     showScoreResult('number_rush',res,(res.daily?'デイリー · ':'')+'NUMBER RUSH SHIFT '+(Number(res.score)/1000).toFixed(3)+'s'+(penalty?'（ペナルティ '+(penalty/1000).toFixed(1)+'s）':'')+' · SHIFT '+(Number(res.details&&res.details.shifts)||game.shifts||0)+' · MAX FLOW '+game.maxStreak);
     renderNumberRush();
   }
   await refreshPlatform();
 }else{
   await cancelPlaySession(game.sessionToken);game.sessionToken=null;game.finished=true;game.running=false;
   if(numberRush===game){renderNumberRush();setStatus('NUMBER RUSHの記録を保存できませんでした。もう一度お試しください。','error');}
 }
}
numberRushStart.onclick=startNumberRush;
numberRushBack.onclick=async()=>{
 if(numberRush&&numberRush.finalizing){setStatus('NUMBER RUSHの記録を保存中です…','warn');return;}
 if(numberRush&&numberRush.running&&!numberRush.finished){const ok=await confirmAction('NUMBER RUSHを終了しますか？','現在のRunは記録されず終了します。','終了する');if(!ok)return;}
 clearInterval(numberRushClock);numberRushClock=null;
 if(numberRush&&numberRush.sessionToken)await cancelPlaySession(numberRush.sessionToken);
 numberRush=null;showHome();
};
numberRushNew.onclick=async()=>{
 if(numberRush&&numberRush.finalizing){setStatus('NUMBER RUSHの記録を保存中です…','warn');return;}
 if(numberRush&&numberRush.running&&!numberRush.finished){const ok=await confirmAction('NUMBER RUSHをやり直しますか？','現在のRunは記録されず、新しく始めます。','やり直す');if(!ok)return;}
 clearInterval(numberRushClock);numberRushClock=null;
 const daily=(numberRush&&numberRush.daily)||numberRushEl.dataset.daily==='1';
 if(numberRush&&numberRush.sessionToken)await cancelPlaySession(numberRush.sessionToken);
 numberRush=null;openNumberRush(daily);
};

/* RANGE RUSH */
function updateRangeRushTimer(){
 if(!highLow){
   highLowTimerFill.style.width='100%';highLowTimerFill.classList.remove('danger');highLowTimerText.textContent='2.4s';return;
 }
 const limit=Math.max(800,Number(highLow.timeLimitMs)||2400);
 if(!highLow.running||highLow.finished){
   highLowTimerFill.style.width=highLow.finished?'0%':'100%';
   highLowTimerFill.classList.remove('danger');
   highLowTimerText.textContent=highLow.finished?'終了':(limit/1000).toFixed(1)+'s';
   return;
 }
 const elapsed=Math.max(0,performance.now()-highLow.roundStartedAt);
 const remaining=Math.max(0,limit-elapsed),ratio=Math.max(0,Math.min(1,remaining/limit));
 highLowTimerFill.style.width=(ratio*100).toFixed(1)+'%';
 highLowTimerFill.classList.toggle('danger',ratio<=.28);
 highLowTimerText.textContent=(remaining/1000).toFixed(1)+'s';
 if(remaining<=0&&!highLow.busy)void guessHighLow('timeout');
}
function startRangeRushClock(){
 clearInterval(highLowClock);highLowClock=setInterval(updateRangeRushTimer,50);updateRangeRushTimer();
}
function renderHighLow(){
 refreshScreenBests();
 if(!highLow){
   delete highLowEl.dataset.pressure;
   highLowCard.textContent='?';highLowPivot.textContent='50';highLowLives.textContent='♥ ♥ ♥';highLowStreak.textContent='0';highLowMeta.textContent='ROUND 0 / 30 · STREAK 0';
   highLowHigher.textContent='HIGH ↑';highLowLower.textContent='LOW ↓';
   highLowHigher.disabled=true;highLowLower.disabled=true;updateRangeRushTimer();return;
 }
 highLowCard.textContent=String(highLow.currentValue);
 highLowPivot.textContent=String(highLow.pivot);
 highLowLives.textContent='♥ '.repeat(Math.max(0,highLow.lives||0)).trim()||'—';
 highLowLives.dataset.lives=String(Math.max(0,highLow.lives||0));
 highLowStreak.textContent=String(highLow.score);
 const round=Math.min(highLow.completed+1,highLow.maxRounds);
 const multiplier=Math.min(4,1+Math.floor(Math.max(0,(highLow.streak||0)-1)/5));
 const gap=Math.abs(Number(highLow.currentValue)-Number(highLow.pivot));
 const difficulty=gap<=8?'TIGHT':(gap<=18?'TRICKY':'OPEN'),bounty=Math.max(0,45-Math.min(45,gap))*3;
 highLowCard.dataset.difficulty=difficulty.toLowerCase();
 highLowEl.dataset.pressure=highLow.lives===1?'last-life':(highLow.lives<=0?'out':'normal');
 highLowMeta.textContent='ROUND '+String(round)+' / '+String(highLow.maxRounds)+' · STREAK '+String(highLow.streak)+' · ×'+String(multiplier)+' · '+difficulty+' · BOUNTY +'+String(bounty)+(highLow.lives===1&&!highLow.finished?' · LAST LIFE':'')+(highLow.finished?' · GAME OVER':'');
 highLowLower.textContent='LOW < '+String(highLow.pivot);
 highLowHigher.textContent='HIGH > '+String(highLow.pivot);
 highLowHigher.disabled=!highLow.running||highLow.busy;highLowLower.disabled=!highLow.running||highLow.busy;
 updateRangeRushTimer();
}
function openHighLow(){
 hideAll();highLowEl.classList.remove('hidden');clearInterval(highLowClock);highLowClock=null;highLow=null;
 highLowEl.classList.remove('guess-correct','guess-wrong','range-timeout','life-lost');
 highLowStart.classList.remove('hidden');highLowStart.disabled=false;highLowStart.textContent='スタート';
 highLowNew.classList.add('hidden');renderHighLow();setStatus('数字が基準よりHIGHかLOWかを、時間内に判断してください。','good');
}
async function startHighLow(){
 if(highLow&&highLow.running)return;
 highLowStart.disabled=true;
 const session=await startSessionWithRetry({gameId:'high_low'});
 if(!session.ok){highLowStart.disabled=false;if(session.error!=='APP_SUSPENDED')setStatus('RANGE RUSHを開始できません: '+FlecityErrors.text(session.error),'error');return;}
 const maxRounds=Number(session.challenge&&session.challenge.rounds)||30;
 const currentValue=Number(session.challenge&&session.challenge.currentValue)||0;
 const pivot=Number(session.challenge&&session.challenge.pivot)||0;
 const timeLimitMs=Number(session.challenge&&session.challenge.timeLimitMs)||2400;
 const lives=Number(session.challenge&&session.challenge.lives)||3;
 if(currentValue<1||currentValue>99||pivot<1||pivot>99||currentValue===pivot){
   await cancelPlaySession(session.sessionToken);
   highLowStart.disabled=false;setStatus('RANGE RUSHの初期状態を取得できませんでした。','error');return;
 }
 highLow={sessionToken:session.sessionToken,maxRounds,currentValue,pivot,timeLimitMs,lives,maxStreak:0,completed:0,streak:0,score:0,roundStartedAt:performance.now(),startedAt:performance.now(),running:true,finished:false,busy:false};
 highLowStart.classList.add('hidden');highLowNew.classList.remove('hidden');renderHighLow();startRangeRushClock();setStatus('RANGE RUSH START · 3ライフ。連続正解で倍率UP。','good');
}
async function guessHighLow(guess){
 const game=highLow;if(!game||!game.running||game.finished||game.busy)return;
 game.busy=true;if(highLow===game)renderHighLow();
 const step=game.completed+1,payload={sessionToken:game.sessionToken,guess,step};
 const retryable=new Set(['RATE_LIMIT','NUI_REQUEST_FAILED','PHONE_CALLBACK_FAILED','CALLBACK_FAILED','EMPTY_RESPONSE','SERVER_ERROR']);
 let res={ok:false,error:'EMPTY_RESPONSE'};
 for(let attempt=0;attempt<3;attempt++){
   res=await FlecityBridge.call('playHighLowGuess',payload);
   if(res.ok||!retryable.has(res.error))break;
   if(attempt<2)await sleep(res.error==='RATE_LIMIT'?220:160*(attempt+1));
 }
 if(highLow!==game){
   await cancelPlaySession(game.sessionToken);
   return;
 }
 if(!res.ok){
   clearInterval(highLowClock);highLowClock=null;
   await cancelPlaySession(game.sessionToken);game.sessionToken=null;game.busy=false;game.running=false;game.finished=true;renderHighLow();
   setStatus('RANGE RUSHの判定通信に失敗しました。もう一度お試しください。','error');return;
 }
 const scoreBefore=Number(game.score)||0;
 game.streak=Math.max(0,Number(res.streak)||0);
 game.maxStreak=Math.max(game.maxStreak||0,Number(res.maxStreak)||0);
 game.score=Math.max(0,Number(res.score)||0);
 const rankUp=liveRankUpPrefix('high_low',scoreBefore,game.score);
 game.lives=Math.max(0,Number(res.lives)??game.lives??0);
 game.completed=Math.max(0,Number(res.completed)||0);
 game.timeLimitMs=Math.max(800,Number(res.timeLimitMs)||game.timeLimitMs||2400);
 game.busy=false;
 highLowCard.classList.remove('card-pop');void highLowCard.offsetWidth;highLowCard.classList.add('card-pop');
 highLowEl.classList.remove('guess-correct','guess-wrong','range-timeout','life-lost');void highLowEl.offsetWidth;
 if(res.correct){
   highLowEl.classList.add('guess-correct');
   tone(700+Math.min(250,game.streak*15),32);
   const mult=Math.max(1,Number(res.multiplier)||1),gain=Math.max(0,Number(res.gained)||0),difficultyBonus=Math.max(0,Number(res.difficultyBonus)||0),speedBonus=Math.max(0,Number(res.speedBonus)||0);
   const bonus=difficultyBonus>0?' · TIGHT +'+difficultyBonus:'';
   setStatus(rankUp+'CORRECT · +'+gain+' · ×'+mult+' · STREAK '+game.streak+bonus+(speedBonus>=80?' · FAST':'')+(game.lives===1?' · CLUTCH':''),'good');
 }else{
   highLowEl.classList.add(res.timedOut?'range-timeout':'guess-wrong','life-lost');
   tone(150,90);
   setStatus((res.timedOut?'TIME UP':'MISS')+' · LIFE -1 · 残り'+game.lives+(game.lives===1?' · LAST LIFE!':''),'warn');
 }
 if(!res.ended){
   game.currentValue=Number(res.nextValue)||game.currentValue;
   game.pivot=Number(res.nextPivot)||game.pivot;
   game.roundStartedAt=performance.now();
 }else{
   game.running=false;clearInterval(highLowClock);highLowClock=null;
 }
 renderHighLow();
 if(!res.ended)startRangeRushClock();
 if(res.ended===true){await finishHighLow(res.cleared===true);}
}
async function finishHighLow(cleared){
 const game=highLow;if(!game||game.finished||game.finalizing)return;
 game.finished=true;game.finalizing=true;game.running=false;game.busy=true;clearInterval(highLowClock);highLowClock=null;if(highLow===game)renderHighLow();
 const durationMs=Math.max(0,Math.round(performance.now()-game.startedAt));
 const res=await submitScoreWithRetry({sessionToken:game.sessionToken,score:game.score,durationMs});
 game.finalizing=false;
 if(res.ok){
   game.sessionToken=null;game.busy=false;
   if(highLow===game){showScoreResult('high_low',res,(cleared?'30 ROUND CLEAR · ':'')+'RANGE RUSH '+res.score+' pts · MAX STREAK '+game.maxStreak+' · LIFE '+game.lives);renderHighLow();}
   await refreshPlatform();
 }else{
   await cancelPlaySession(game.sessionToken);game.sessionToken=null;game.finished=true;game.running=false;game.busy=false;
   if(highLow===game){renderHighLow();setStatus('RANGE RUSHの記録を保存できませんでした。もう一度お試しください。','error');}
 }
}
highLowStart.onclick=startHighLow;
highLowHigher.onclick=()=>guessHighLow('high');
highLowLower.onclick=()=>guessHighLow('low');
highLowBack.onclick=async()=>{
 if(highLow&&highLow.finalizing){setStatus('RANGE RUSHの記録を保存中です…','warn');return;}
 if(highLow&&highLow.running&&!highLow.finished){const ok=await confirmAction('RANGE RUSHを終了しますか？','現在のRunは記録されず終了します。','終了する');if(!ok)return;}
 clearInterval(highLowClock);highLowClock=null;
 if(highLow&&highLow.sessionToken)await cancelPlaySession(highLow.sessionToken);
 highLow=null;showHome();
};
highLowNew.onclick=async()=>{
 if(highLow&&highLow.finalizing){setStatus('RANGE RUSHの記録を保存中です…','warn');return;}
 if(highLow&&highLow.running&&!highLow.finished){const ok=await confirmAction('RANGE RUSHをやり直しますか？','現在のRunは記録されず、新しく始めます。','やり直す');if(!ok)return;}
 clearInterval(highLowClock);highLowClock=null;
 if(highLow&&highLow.sessionToken)await cancelPlaySession(highLow.sessionToken);
 highLow=null;openHighLow();
};

/* SIMON */
function renderSimon(){
 refreshScreenBests();const game=simon;
 if(!game){
   delete simonBoard.dataset.speed;
   simonRound.textContent='0';simonMeta.textContent=(simonDaily?'DAILY · ':'')+'ROUND 0 / 30';simonMessage.textContent='スタートを押してください。';
   simonPads.forEach(p=>{p.disabled=true;p.classList.remove('active','wrong');});
   return;
 }
 simonRound.textContent=String(game.cleared);
 const speedStage=game.round>=21?'TURBO':(game.round>=16?'FAST':(game.round>=11?'UP':(game.round>=6?'WARM':'NORMAL')));
 simonBoard.dataset.speed=speedStage.toLowerCase();
 simonMeta.textContent=(game.daily?'DAILY · ':'')+'ROUND '+String(game.round)+' / '+String(game.maxRounds)+' · CLEAR '+String(game.cleared)+' · SPEED '+speedStage+(game.round%5===0&&game.round<game.maxRounds?' · CHECKPOINT':'');
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
 simonBoard.dataset.phase='watch';simonMessage.textContent='覚えてください · '+game.round+'手';
 await sleep(260);
 const flashMs=game.round>=21?155:(game.round>=16?190:(game.round>=11?235:(game.round>=6?300:390)));
 for(let i=0;i<game.sequence.length;i++){
   if(simon!==game||game.finished)return;
   await flashSimonPad(game.sequence[i],flashMs);
 }
 if(simon!==game||game.finished)return;
 game.accepting=true;game.inputIndex=0;simonBoard.dataset.phase='input';renderSimon();simonMessage.textContent='あなたの番 · 1 / '+game.round;
}
function openSimon(daily=false){
 hideAll();simonEl.classList.remove('hidden');clearTimeout(simonTimer);simonTimer=null;simon=null;simonDaily=daily===true;
 simonStart.classList.remove('hidden');simonNew.classList.add('hidden');simonStart.disabled=false;renderSimon();
 setStatus(simonDaily?'デイリーSIMON。同じ配列条件で到達ラウンドを競います。':'光った順番を覚えて、同じ順番で押してください。','good');
}
async function startSimon(){
 if(simon&&!simon.finished)return;
 simonStart.disabled=true;
 const session=await startSessionWithRetry({gameId:'simon',daily:simonDaily===true});
 if(!session.ok){simonStart.disabled=false;if(session.error!=='APP_SUSPENDED')setStatus('SIMONを開始できません: '+FlecityErrors.text(session.error),'error');return;}
 const maxRounds=Number(session.challenge&&session.challenge.rounds)||30;
 const sequence=Array.isArray(session.challenge&&session.challenge.sequence)?session.challenge.sequence.map(Number):[];
 if(sequence.length!==1||sequence.some(v=>!Number.isInteger(v)||v<0||v>3)){
   await cancelPlaySession(session.sessionToken);
   simonStart.disabled=false;setStatus('SIMONの初期状態を取得できませんでした。','error');return;
 }
 simonDaily=session.daily===true;
 simon={sessionToken:session.sessionToken,maxRounds,sequence,round:1,cleared:0,inputIndex:0,roundInputs:[],accepting:false,submitting:false,finished:false,startedAt:performance.now(),daily:session.daily===true};
 simonStart.classList.add('hidden');simonNew.classList.remove('hidden');renderSimon();setStatus((simon.daily?'デイリーSIMON開始。':'SIMON開始。')+'未来のラウンドはSERVERから順番に配信します。','good');
 await playSimonSequence();
}
async function sendSimonRound(inputs,round){
 const payload={sessionToken:simon&&simon.sessionToken,inputs,round};
 const retryable=new Set(['RATE_LIMIT','NUI_REQUEST_FAILED','PHONE_CALLBACK_FAILED','CALLBACK_FAILED','EMPTY_RESPONSE','SERVER_ERROR']);
 let res={ok:false,error:'EMPTY_RESPONSE'};
 for(let attempt=0;attempt<3;attempt++){
   res=await FlecityBridge.call('playSubmitSimonRound',payload);
   if(res.ok||!retryable.has(res.error))return res;
   if(attempt<2)await sleep(res.error==='RATE_LIMIT'?240:170*(attempt+1));
 }
 return res;
}
async function finishSimon(clearedAll=false){
 const game=simon;if(!game||game.finished||game.finalizing)return;
 game.finished=true;game.finalizing=true;game.accepting=false;game.submitting=false;clearTimeout(simonTimer);simonTimer=null;renderSimon();
 const durationMs=Math.max(0,Math.round(performance.now()-game.startedAt));
 const res=await submitScoreWithRetry({sessionToken:game.sessionToken,score:game.cleared,durationMs});
 game.finalizing=false;
 if(res.ok){
   game.sessionToken=null;simonBoard.dataset.phase=clearedAll?'clear':'over';simonMessage.textContent=clearedAll?'ALL CLEAR!':'GAME OVER';
   showScoreResult('simon',res,(res.daily?'デイリー · ':'')+(clearedAll?'30 ROUND CLEAR · ':'')+'SIMON '+res.score+'ラウンド');
   await refreshPlatform();
 }else{
   await cancelPlaySession(game.sessionToken);game.sessionToken=null;game.finished=true;game.accepting=false;game.submitting=false;renderSimon();
   simonMessage.textContent='記録保存に失敗しました';
   setStatus('SIMONの記録を保存できませんでした。もう一度お試しください。','error');
 }
}
async function pressSimon(index){
 const game=simon;if(!game||game.finished||!game.accepting||game.submitting)return;
 // Lock input synchronously so rapid taps cannot enqueue multiple moves before render catches up.
 game.accepting=false;game.submitting=true;simonPads.forEach(p=>p.disabled=true);
 game.roundInputs.push(index);
 const expected=game.sequence[game.inputIndex];
 if(index!==expected){
   const pad=simonPads[index];if(pad)pad.classList.add('wrong');
   tone(150,100);simonMessage.textContent='MISS';
   game.submitting=true;
   const res=await sendSimonRound(game.roundInputs.slice(),game.round);
   game.submitting=false;
   if(simon!==game){await cancelPlaySession(game.sessionToken);return;}
   if(!res.ok){
     await cancelPlaySession(game.sessionToken);game.sessionToken=null;game.finished=true;game.accepting=false;game.submitting=false;renderSimon();
     simonMessage.textContent='通信に失敗しました';
     setStatus('SIMONの判定通信に失敗しました。もう一度お試しください。','error');return;
   }
   game.cleared=Math.max(0,Number(res.cleared)||0);
   simonTimer=setTimeout(()=>{if(pad)pad.classList.remove('wrong');},260);
   await finishSimon(false);return;
 }
 tone([420,560,700,840][index]||660,45);
 game.inputIndex+=1;
 if(game.inputIndex<game.sequence.length){
   game.submitting=false;game.accepting=true;renderSimon();simonMessage.textContent='あなたの番 · '+String(game.inputIndex+1)+' / '+game.round;return;
 }

 renderSimon();
 const res=await sendSimonRound(game.roundInputs.slice(),game.round);
 game.submitting=false;
 if(simon!==game){await cancelPlaySession(game.sessionToken);return;}
 if(!res.ok){
   await cancelPlaySession(game.sessionToken);game.sessionToken=null;game.finished=true;game.accepting=false;game.submitting=false;renderSimon();
   simonMessage.textContent='通信に失敗しました';
   setStatus('SIMONの判定通信に失敗しました。もう一度お試しください。','error');return;
 }
 const clearedBefore=Number(game.cleared)||0;
 game.cleared=Math.max(0,Number(res.cleared)||0);const rankUp=liveRankUpPrefix('simon',clearedBefore,game.cleared);renderSimon();
 if(res.ended===true){await finishSimon(res.clearedAll===true);return;}

 const nextSequence=Array.isArray(res.sequence)?res.sequence.map(Number):[];
 const nextRound=Math.max(1,Number(res.round)||game.round+1);
 if(nextSequence.length!==nextRound||nextSequence.some(v=>!Number.isInteger(v)||v<0||v>3)){
   await cancelPlaySession(game.sessionToken);game.sessionToken=null;game.finished=true;game.accepting=false;game.submitting=false;
   if(simon===game){renderSimon();simonMessage.textContent='通信状態が不正です';setStatus('SIMONの次ラウンドを取得できませんでした。もう一度お試しください。','error');}
   return;
 }
 simonMessage.textContent='CLEAR · ROUND '+game.round;
 const oldStage=Math.floor((game.round-1)/5),newStage=Math.floor((nextRound-1)/5);
 game.round=nextRound;game.sequence=nextSequence;game.inputIndex=0;game.roundInputs=[];
 if(newStage>oldStage){setStatus(rankUp+'SIMON SPEED UP · ROUND '+nextRound,'good');tone(980,70);}
 else if(rankUp){setStatus(rankUp+'SIMON · ROUND '+nextRound,'good');tone(920,65);}
 await sleep(newStage>oldStage?700:420);
 if(simon===game&&!game.finished)await playSimonSequence();
}
simonPads.forEach((pad,index)=>{pad.onclick=()=>pressSimon(index);});
simonStart.onclick=startSimon;
simonBack.onclick=async()=>{if(simon&&simon.finalizing){setStatus('SIMONの記録を保存中です…','warn');return;}if(simon&&!simon.finished){const ok=await confirmAction('SIMONを終了しますか？','現在の到達ラウンドは記録されず終了します。','終了する');if(!ok)return;}clearTimeout(simonTimer);simonTimer=null;if(simon&&simon.sessionToken)await cancelPlaySession(simon.sessionToken);simon=null;simonDaily=false;showHome();};
simonNew.onclick=async()=>{if(simon&&simon.finalizing){setStatus('SIMONの記録を保存中です…','warn');return;}if(simon&&!simon.finished){const ok=await confirmAction('SIMONをやり直しますか？','現在の到達ラウンドは記録されず、新しく始めます。','やり直す');if(!ok)return;}const wasDaily=!!((simon&&simon.daily)||simonDaily);clearTimeout(simonTimer);simonTimer=null;if(simon&&simon.sessionToken)await cancelPlaySession(simon.sessionToken);simon=null;openSimon(wasDaily);};

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
function updateMemoryTime(){if(memory){const ms=Number.isFinite(Number(memory.displayElapsedMs))?Number(memory.displayElapsedMs):elapsedMemory();memoryTime.textContent=(ms/1000).toFixed(1)+'s';}}
function renderMemory(){
 if(!memory)return;
 memoryBoard.innerHTML='';updateMemoryTime();
 refreshScreenBests();const memoryPairs=memory.matched.size/2;
 memoryMeta.textContent=memory.previewing?((memory.daily?'DAILY · ':'')+'記憶中…'):((memory.daily?'DAILY · ':'')+String(memoryPairs)+' / 8 PAIRS · '+String(memory.moves)+' MOVES'+(memory.streak>=2?' · STREAK ×'+memory.streak:'')+(memoryPairs>=4&&!memory.finished?' · '+(memoryPairs>=6?'FINAL PUSH':'HALFWAY'):''));
 for(let i=0;i<memory.deck.length;i++){
   const b=document.createElement('button');
   const shown=memory.previewing||memory.revealed.includes(i),matched=memory.matched.has(i);
   b.className='memory-card'+(shown?' revealed':'')+(matched?' matched':'')+(memory.previewing?' preview':'')+(memory.revealed.includes(i)?' flipping':'');
   b.textContent=(shown||matched)?MEMORY_SYMBOLS[memory.deck[i]-1]:'?';
   b.disabled=memory.previewing||memory.finished||memory.busy||matched;
   b.setAttribute('aria-label',matched?'一致済み':(shown?'カード '+String(memory.deck[i]):'伏せたカード'));
   b.onclick=()=>flipMemory(i);
   memoryBoard.appendChild(b);
 }
}
async function openMemory(daily=false){
 hideAll();memoryEl.classList.remove('hidden');clearInterval(memoryClock);clearTimeout(memoryFlipTimer);
 const session=await startSessionWithRetry({gameId:'memory',daily:daily===true});
 if(!session.ok){if(session.error!=='APP_SUSPENDED'){setStatus('MEMORYを開始できません: '+FlecityErrors.text(session.error),'error');showHome();}return;}
 const previewMs=Math.max(0,Number(session.challenge&&session.challenge.previewMs)||1200);
 memory={sessionToken:session.sessionToken,seed:Number(session.seed)||1,deck:memoryDeckFromSeed(session.seed),revealed:[],matched:new Set(),history:[],moves:0,streak:0,maxStreak:0,playStartedAt:null,finished:false,busy:false,previewing:true,daily:session.daily===true,previewMs};
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
   memory.matched.add(pair[0]);memory.matched.add(pair[1]);memory.revealed=[];memory.streak+=1;memory.maxStreak=Math.max(memory.maxStreak,memory.streak);
   memoryBoard.classList.remove('memory-streak');void memoryBoard.offsetWidth;if(memory.streak>=2)memoryBoard.classList.add('memory-streak');
   tone(740+Math.min(200,memory.streak*26),55);
   if(memory.streak===3||memory.streak===5)setStatus('PAIR STREAK ×'+memory.streak+' · NICE MEMORY','good');
   else if(memory.matched.size===8)setStatus('HALFWAY · 4 PAIRS CLEAR','good');
   else if(memory.matched.size===12)setStatus('FINAL PUSH · 2 PAIRS LEFT','good');
   renderMemory();
   if(memory.matched.size===16){await finishMemory();}
   return;
 }
 memory.streak=0;memory.busy=true;renderMemory();
 const game=memory;
 memoryFlipTimer=setTimeout(()=>{
   if(memory!==game||game.finished)return;
   game.revealed=[];game.busy=false;renderMemory();
 },650);
}
async function finishMemory(){
 const game=memory;if(!game||game.finished||game.finalizing)return;
 game.finished=true;game.finalizing=true;game.busy=true;clearInterval(memoryClock);clearTimeout(memoryFlipTimer);
 const durationMs=Math.max(0,Math.round(game.playStartedAt?performance.now()-game.playStartedAt:0));game.displayElapsedMs=durationMs;if(memory===game)updateMemoryTime();
 const res=await submitScoreWithRetry({sessionToken:game.sessionToken,score:durationMs,durationMs,history:game.history});
 game.finalizing=false;
 if(res.ok){
   game.displayElapsedMs=Number(res.score);game.sessionToken=null;game.busy=false;if(memory===game){const penalty=Number(res.details&&res.details.movePenaltyMs)||0,perfect=game.moves===8&&penalty===0;
     memoryBoard.classList.remove('memory-perfect');if(perfect){void memoryBoard.offsetWidth;memoryBoard.classList.add('memory-perfect');tone(1040,110);}
     showScoreResult('memory',res,(res.daily?'デイリー · ':'')+(perfect?'PERFECT MEMORY · ':'')+'MEMORY '+(Number(res.score)/1000).toFixed(2)+'s · '+game.moves+' MOVES'+(penalty?' · MOVE PENALTY +'+(penalty/1000).toFixed(1)+'s':'')+' · MAX STREAK ×'+game.maxStreak);renderMemory();}await refreshPlatform();
 }else{
   await cancelPlaySession(game.sessionToken);game.sessionToken=null;game.finished=true;game.busy=false;if(memory===game){setStatus('MEMORYの記録を保存できませんでした。もう一度お試しください。','error');renderMemory();}
 }
}
memoryBack.onclick=async()=>{
 if(memory&&memory.finalizing){setStatus('MEMORYの記録を保存中です…','warn');return;}
 if(memory&&!memory.finished){const ok=await confirmAction('MEMORYを終了しますか？','現在のRunは記録されず終了します。','終了する');if(!ok)return;}
 clearInterval(memoryClock);clearTimeout(memoryFlipTimer);memoryClock=null;memoryFlipTimer=null;
 if(memory&&!memory.finished&&memory.sessionToken)await cancelPlaySession(memory.sessionToken);
 memory=null;showHome();
};
memoryNew.onclick=async()=>{
 if(memory&&memory.finalizing){setStatus('MEMORYの記録を保存中です…','warn');return;}
 if(memory&&!memory.finished){const ok=await confirmAction('MEMORYをやり直しますか？','現在のRunは記録されず、新しく始めます。','やり直す');if(!ok)return;}
 clearInterval(memoryClock);clearTimeout(memoryFlipTimer);memoryClock=null;memoryFlipTimer=null;
 const wasDaily=!!(memory&&memory.daily);
 if(memory&&!memory.finished&&memory.sessionToken)await cancelPlaySession(memory.sessionToken);
 memory=null;await openMemory(wasDaily);
};

let suspendRunning=false,refreshAfterSuspend=false;
async function cancelPlaySession(token){
 if(!token)return {ok:true};
 const retryable=new Set(['RATE_LIMIT','NUI_REQUEST_FAILED','PHONE_CALLBACK_FAILED','CALLBACK_FAILED','EMPTY_RESPONSE','SERVER_ERROR']);
 let res={ok:false,error:'EMPTY_RESPONSE'};
 for(let attempt=0;attempt<2;attempt++){
   try{res=await FlecityBridge.call('playCancelSession',{sessionToken:token});}
   catch(_){res={ok:false,error:'NUI_REQUEST_FAILED'};}
   if(res&&res.ok)return res;
   if(!retryable.has(res&&res.error))return res;
   if(attempt===0)await sleep(res.error==='RATE_LIMIT'?300:120);
 }
 return res;
}
async function suspendStep(label,action){
 try{return await action();}
 catch(error){console.warn('[PLAY] suspend step failed:',label,error);return null;}
}
async function suspendActivePlay(){
 if(suspendRunning)return;
 suspendRunning=true;appEpoch+=1;
 try{
   if(confirmResolver)closeConfirm(false);
   clearTimeout(tapTimer);tapTimer=null;
   cancelAnimationFrame(stopRaf);cancelAnimationFrame(stackRaf);
   clearInterval(fallGravityClock);clearInterval(fallSoftClock);clearInterval(minesClock);clearInterval(nonogramClock);clearInterval(memoryClock);clearInterval(sortClock);clearInterval(slideClock);clearInterval(colorMatchClock);clearInterval(numberRushClock);clearInterval(highLowClock);
   clearTimeout(memoryFlipTimer);clearTimeout(simonTimer);
   fallGravityClock=null;fallSoftClock=null;minesClock=null;nonogramClock=null;memoryClock=null;sortClock=null;slideClock=null;colorMatchClock=null;numberRushClock=null;highLowClock=null;memoryFlipTimer=null;simonTimer=null;
   resetTransientInputState();

   if(block&&!block.finished&&!block.finalizing){
     if(!block.daily)await suspendStep('block save',()=>persistBlock(false));
     await suspendStep('block cancel',()=>cancelPlaySession(block&&block.sessionToken));
   }
   if(merge&&!merge.finished&&!merge.finalizing){
     await suspendStep('merge save',()=>persistMerge(false));
     await suspendStep('merge cancel',()=>cancelPlaySession(merge&&merge.sessionToken));
   }
   if(fallGame&&!fallGame.finished&&!fallGame.finalizing){
     await suspendStep('fall save',()=>persistFall(false));
     await suspendStep('fall cancel',()=>cancelPlaySession(fallGame&&fallGame.sessionToken));
   }
   if(mines&&!mines.finished&&!mines.finalizing){
     if(!mines.daily)await suspendStep('mines save',()=>persistMines(false));
     await suspendStep('mines cancel',()=>cancelPlaySession(mines&&mines.sessionToken));
   }
   if(nonogram&&!nonogram.finished&&!nonogram.finalizing){
     if(!nonogram.daily)await suspendStep('nonogram save',()=>persistNonogram(false));
     await suspendStep('nonogram cancel',()=>cancelPlaySession(nonogram&&nonogram.sessionToken));
   }
   if(sortGame&&!sortGame.finished&&!sortGame.finalizing){
     await suspendStep('sort save',()=>persistSort(false));
     await suspendStep('sort cancel',()=>cancelPlaySession(sortGame&&sortGame.sessionToken));
   }
   if(slideGame&&!slideGame.finished&&!slideGame.finalizing){
     if(!slideGame.daily)await suspendStep('slide save',()=>persistSlide(false));
     await suspendStep('slide cancel',()=>cancelPlaySession(slideGame&&slideGame.sessionToken));
   }

   if(tapState!=='submitting')await suspendStep('quick tap cancel',()=>cancelPlaySession(tapSession&&tapSession.sessionToken));
   if(stopState!=='submitting')await suspendStep('stop cancel',()=>cancelPlaySession(stopSession&&stopSession.sessionToken));
   if(!(stackGame&&stackGame.finalizing))await suspendStep('stack cancel',()=>cancelPlaySession(stackGame&&stackGame.sessionToken));
   if(!(memory&&memory.finalizing))await suspendStep('memory cancel',()=>cancelPlaySession(memory&&memory.sessionToken));
   if(!(colorMatch&&colorMatch.finalizing))await suspendStep('color match cancel',()=>cancelPlaySession(colorMatch&&colorMatch.sessionToken));
   if(!(numberRush&&numberRush.finalizing))await suspendStep('number rush cancel',()=>cancelPlaySession(numberRush&&numberRush.sessionToken));
   if(!(highLow&&highLow.finalizing))await suspendStep('high low cancel',()=>cancelPlaySession(highLow&&highLow.sessionToken));
   if(!(simon&&simon.finalizing))await suspendStep('simon cancel',()=>cancelPlaySession(simon&&simon.sessionToken));
  }finally{
   block=null;merge=null;fallGame=null;mines=null;nonogram=null;stackGame=null;memory=null;sortGame=null;slideGame=null;colorMatch=null;numberRush=null;highLow=null;simon=null;simonDaily=false;
   tapSession=null;tapState='idle';stopSession=null;stopState='idle';
   if(bootstrapData){hideAll();homeEl.classList.remove('hidden');renderGames(bootstrapData.games);}
   suspendRunning=false;
   if(refreshAfterSuspend){
     refreshAfterSuspend=false;
     if(!document.hidden&&bootstrapData)void refreshPlatform();
   }
 }
}
document.addEventListener('visibilitychange',()=>{
 if(document.hidden){refreshAfterSuspend=false;void suspendActivePlay();return;}
 if(!bootstrapData)return;
 if(suspendRunning){refreshAfterSuspend=true;return;}
 void refreshPlatform();
});
window.addEventListener('pagehide',()=>{void suspendActivePlay();});

let playPhoneLifecycleRegistered=false;
function handlePlayLifecycleMessage(message){
 if(!message||typeof message!=='object'||message.type!=='playSuspend')return;
 refreshAfterSuspend=false;
 void suspendActivePlay();
}
window.addEventListener('message',event=>{
 if(!playPhoneLifecycleRegistered)handlePlayLifecycleMessage(event.data);
});
function registerPlayPhoneLifecycle(){
 if(playPhoneLifecycleRegistered||typeof globalThis.onNuiEvent!=='function')return;
 try{
   globalThis.onNuiEvent('playSuspend',data=>{
     if(data&&typeof data==='object'&&data.type)handlePlayLifecycleMessage(data);
     else handlePlayLifecycleMessage({type:'playSuspend',...(data&&typeof data==='object'?data:{})});
   });
   playPhoneLifecycleRegistered=true;
 }catch(_){
   playPhoneLifecycleRegistered=false;
 }
}
registerPlayPhoneLifecycle();

bootstrap();
