const statusEl=document.getElementById('status'),gamesEl=document.getElementById('games'),homeEl=document.getElementById('home');
const continueCard=document.getElementById('continueCard'),continueGames=document.getElementById('continueGames'),continueCount=document.getElementById('continueCount'),gameCount=document.getElementById('gameCount');
const rankingGame=document.getElementById('rankingGame'),rankingPeriod=document.getElementById('rankingPeriod'),rankingSelf=document.getElementById('rankingSelf'),rankingLoad=document.getElementById('rankingLoad'),rankingRows=document.getElementById('rankingRows');
const dailyCard=document.getElementById('dailyCard'),dailyGame=document.getElementById('dailyGame'),dailyDate=document.getElementById('dailyDate'),dailyPlay=document.getElementById('dailyPlay'),dailyBest=document.getElementById('dailyBest'),dailyRanking=document.getElementById('dailyRanking');
const statPlays=document.getElementById('statPlays'),statTime=document.getElementById('statTime'),gameStatRows=document.getElementById('gameStatRows'),achievementCount=document.getElementById('achievementCount'),achievementRows=document.getElementById('achievementRows');
const settingSound=document.getElementById('settingSound'),settingMotion=document.getElementById('settingMotion');
const confirmOverlay=document.getElementById('confirmOverlay'),confirmTitle=document.getElementById('confirmTitle'),confirmMessage=document.getElementById('confirmMessage'),confirmCancel=document.getElementById('confirmCancel'),confirmAccept=document.getElementById('confirmAccept');
const quickEl=document.getElementById('quickTap'),tapBest=document.getElementById('tapBest'),tapMessage=document.getElementById('tapMessage'),tapButton=document.getElementById('tapButton'),tapBack=document.getElementById('tapBack');
const stopEl=document.getElementById('stopGame'),stopBest=document.getElementById('stopBest'),stopMessage=document.getElementById('stopMessage'),stopButton=document.getElementById('stopButton'),stopBack=document.getElementById('stopBack'),stopTarget=document.getElementById('stopTarget'),stopMarker=document.getElementById('stopMarker');
const blockEl=document.getElementById('blockGame'),blockBoard=document.getElementById('blockBoard'),blockPieces=document.getElementById('blockPieces'),blockScore=document.getElementById('blockScore'),blockMeta=document.getElementById('blockMeta');
const blockBack=document.getElementById('blockBack'),blockNew=document.getElementById('blockNew'),blockFinish=document.getElementById('blockFinish');
const mergeEl=document.getElementById('mergeGame'),mergeBoard=document.getElementById('mergeBoard'),mergeScore=document.getElementById('mergeScore'),mergeMeta=document.getElementById('mergeMeta'),mergeBack=document.getElementById('mergeBack'),mergeNew=document.getElementById('mergeNew'),mergeFinish=document.getElementById('mergeFinish');
const mergeUp=document.getElementById('mergeUp'),mergeDown=document.getElementById('mergeDown'),mergeLeft=document.getElementById('mergeLeft'),mergeRight=document.getElementById('mergeRight');
const minesEl=document.getElementById('minesGame'),minesBoard=document.getElementById('minesBoard'),minesTime=document.getElementById('minesTime'),minesMeta=document.getElementById('minesMeta'),minesBack=document.getElementById('minesBack'),minesMode=document.getElementById('minesMode'),minesNew=document.getElementById('minesNew');
const stackEl=document.getElementById('stackGame'),stackArena=document.getElementById('stackArena'),stackBase=document.getElementById('stackBase'),stackMover=document.getElementById('stackMover'),stackScore=document.getElementById('stackScore'),stackMeta=document.getElementById('stackMeta'),stackBack=document.getElementById('stackBack'),stackDrop=document.getElementById('stackDrop'),stackNew=document.getElementById('stackNew');
const nonogramEl=document.getElementById('nonogramGame'),nonogramBoard=document.getElementById('nonogramBoard'),nonogramTime=document.getElementById('nonogramTime'),nonogramMeta=document.getElementById('nonogramMeta'),nonogramBack=document.getElementById('nonogramBack'),nonogramCheck=document.getElementById('nonogramCheck'),nonogramNew=document.getElementById('nonogramNew');
const memoryEl=document.getElementById('memoryGame'),memoryBoard=document.getElementById('memoryBoard'),memoryTime=document.getElementById('memoryTime'),memoryMeta=document.getElementById('memoryMeta'),memoryBack=document.getElementById('memoryBack'),memoryNew=document.getElementById('memoryNew');
const colorMatchEl=document.getElementById('colorMatchGame'),colorMatchProgress=document.getElementById('colorMatchProgress'),colorMatchTime=document.getElementById('colorMatchTime'),colorMatchBest=document.getElementById('colorMatchBest'),colorMatchWord=document.getElementById('colorMatchWord'),colorMatchChoices=document.getElementById('colorMatchChoices'),colorMatchBack=document.getElementById('colorMatchBack'),colorMatchStart=document.getElementById('colorMatchStart'),colorMatchNew=document.getElementById('colorMatchNew');
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
 return false;
}
function dailyBestText(gameId){
 const daily=bootstrapData&&bootstrapData.daily,game=gameById(gameId);
 const row=daily&&daily.gameId===gameId&&daily.selfBest;
 return row&&game?formatGameScore(game,row.score):'---';
}
const screenBestIds={
 quick_tap:'tapBest',stop:'stopBest',stack:'stackBest',block:'blockBest',merge:'mergeBest',mines:'minesBest',
 nonogram:'nonogramBest',memory:'memoryBest',color_match:'colorMatchBest',number_rush:'numberRushBest',
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
 quick_tap:{icon:'⚡',eyebrow:'REFLEX'},stop:{icon:'◎',eyebrow:'TIMING'},color_match:{icon:'A',eyebrow:'FOCUS'},number_rush:{icon:'25',eyebrow:'SPEED'},
 stack:{icon:'▤',eyebrow:'ARCADE'},high_low:{icon:'7',eyebrow:'LUCK'},simon:{icon:'◆',eyebrow:'MEMORY'},
 block:{icon:'▦',eyebrow:'BUILD'},merge:{icon:'2ⁿ',eyebrow:'MERGE'},mines:{icon:'✦',eyebrow:'LOGIC'},nonogram:{icon:'▩',eyebrow:'PUZZLE'},memory:{icon:'●',eyebrow:'PAIR'}
};
const achievementLabels={
 first_play:'FIRST PLAY · 初めて記録を残す',
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
 dailyCard.classList.remove('hidden');dailyGame.textContent=daily.game&&daily.game.name||daily.gameId;dailyDate.textContent=String(daily.date||'');
 const game=daily.game||gameById(daily.gameId);
 dailyBest.textContent=daily.selfBest?'あなたの今日BEST · '+formatGameScore(game,daily.selfBest.score)+(daily.selfRank?' · #'+String(daily.selfRank):''):'今日はまだ挑戦していません。';
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
 });
}
dailyPlay.onclick=launchDaily;

async function launchGame(gameId){
 await withLaunchLock(async()=>{
   if(gameId==='quick_tap')showQuick();
   else if(gameId==='stop')openStop();
   else if(gameId==='block')await openBlock(false);
   else if(gameId==='merge')await openMerge(false);
   else if(gameId==='mines')await openMines(false);
   else if(gameId==='stack')await openStack();
   else if(gameId==='nonogram')await openNonogram(false);
   else if(gameId==='memory')await openMemory();
   else if(gameId==='color_match')openColorMatch();
   else if(gameId==='number_rush')openNumberRush(false);
   else if(gameId==='high_low')openHighLow();
   else if(gameId==='simon')openSimon();
 });
}
function renderContinue(games){
 const resumable=(games||[]).filter(game=>game.app==='play'&&game.enabled&&saves[game.id]);
 continueGames.innerHTML='';continueCount.textContent=String(resumable.length);
 continueCard.classList.toggle('hidden',resumable.length===0);
 resumable.forEach(game=>{
   const button=document.createElement('button');button.className='continue-game';button.dataset.game=game.id;
   const visual=gameVisuals[game.id]||{icon:'▶',eyebrow:'CONTINUE'};
   const top=document.createElement('span'),icon=document.createElement('span'),text=document.createElement('span'),meta=document.createElement('span');
   top.className='continue-top';icon.className='continue-icon';icon.textContent=visual.icon;text.textContent=String(game.name||game.id);meta.className='muted';top.append(icon,text);
   const save=saves[game.id]||{};
   meta.textContent=(Number(save.elapsed_ms)>0?formatDuration(save.elapsed_ms)+' · ':'')+'続きから';
   button.append(top,meta);button.onclick=()=>launchGame(game.id);continueGames.appendChild(button);
 });
}
function renderGames(games){
 refreshScreenBests();
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
     const btn=document.createElement('button');btn.className='game';btn.dataset.game=game.id;
     const hasSave=!!saves[game.id],visual=gameVisuals[game.id]||{icon:'•',eyebrow:'PLAY'};
     const top=document.createElement('span'),icon=document.createElement('span'),tag=document.createElement('span'),name=document.createElement('strong'),description=document.createElement('span'),bestLine=document.createElement('span'),meta=document.createElement('span');
     top.className='game-card-top';icon.className='game-icon';tag.className='tag';description.className='muted';bestLine.className='game-best';meta.className='game-card-meta';
     icon.textContent=visual.icon;tag.textContent=hasSave?'CONTINUE':(game.supportsDaily?'DAILY':visual.eyebrow);top.append(icon,tag);
     name.textContent=String(game.name||game.id||'GAME');
     description.textContent=String(game.description||'');
     const personalBest=bootstrapData&&bootstrapData.best&&bootstrapData.best[game.id];
     bestLine.textContent=game.supportsRanking?(personalBest?'BEST · '+formatGameScore(game,personalBest.score):'BEST · ---'):'';
     const traits=[];if(game.supportsRanking)traits.push('RANK');if(game.supportsResume)traits.push('SAVE');
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
function setQuickVisual(state){quickEl.dataset.state=state||'idle';}
function showQuick(daily=false){tapDaily=daily===true;hideAll();quickEl.classList.remove('hidden');refreshScreenBests();tapMessage.textContent=tapDaily?'今日のチャレンジ':'準備OK?';tapButton.textContent='スタート';tapButton.disabled=false;tapState='idle';setQuickVisual('idle');}
tapButton.onclick=async()=>{
 if(tapState==='waiting'){
   clearTimeout(tapTimer);tapState='idle';setQuickVisual('false-start');tapMessage.textContent='フライング!';tapButton.textContent='もう一度';
   if(tapSession)await cancelPlaySession(tapSession.sessionToken);tapSession=null;return;
 }
 if(tapState==='shown'){
   const session=tapSession,reaction=performance.now()-tapShownAt;tapState='submitting';tapButton.disabled=true;
   const duration=Math.max(0,Math.round(performance.now()-tapStartedAt));
   const res=await submitScoreWithRetry({sessionToken:session.sessionToken,score:reaction,durationMs:duration});
   const stillHere=tapSession===session;
   if(res.ok){
     if(stillHere){setQuickVisual('result');tapMessage.textContent=Number(res.score).toFixed(3)+' ms';showScoreResult('quick_tap',res,(res.daily?'デイリー · ':'')+Number(res.score).toFixed(3)+' ms');}
     await refreshPlatform();
   }else{
     await cancelPlaySession(session&&session.sessionToken);
     if(stillHere){tapMessage.textContent='保存できませんでした';setStatus('スコアを保存できませんでした: '+FlecityErrors.text(res.error),'error');}
   }
   if(stillHere){tapState='idle';tapSession=null;tapButton.textContent='もう一度';tapButton.disabled=false;}return;
 }
 if(tapState!=='idle')return;
 tapButton.disabled=true;const res=await startSessionWithRetry({gameId:'quick_tap',daily:tapDaily});
 if(!res.ok){tapButton.disabled=false;if(res.error!=='APP_SUSPENDED')setStatus('開始できません: '+FlecityErrors.text(res.error),'error');return;}
 tapSession=res;tapState='waiting';setQuickVisual('waiting');tapStartedAt=performance.now();tapMessage.textContent='待って';tapButton.textContent='待って…';tapButton.disabled=false;
 tapTimer=setTimeout(()=>{if(tapState!=='waiting')return;tapState='shown';setQuickVisual('go');tapShownAt=performance.now();tapMessage.textContent='タップ!';tapButton.textContent='タップ!';tone(980,45);},Math.max(250,Number(res.challenge&&res.challenge.delayMs)||1500));
};
tapBack.onclick=async()=>{
 if(tapState==='submitting'){setStatus('QUICK TAPの記録を保存中です…','warn');return;}
 if(tapSession&&['waiting','shown'].includes(tapState)){
   const ok=await confirmAction('QUICK TAPを終了しますか？','現在のRunは記録されず終了します。','終了する');
   if(!ok)return;
 }
 if(tapSession)await cancelPlaySession(tapSession.sessionToken);
 clearTimeout(tapTimer);tapSession=null;tapState='idle';showHome();
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
function setStopVisual(state){stopEl.dataset.state=state||'idle';}
function openStop(daily=false){
 stopDaily=daily===true;hideAll();stopEl.classList.remove('hidden');stopState='idle';stopSession=null;setStopVisual('idle');refreshScreenBests();stopMessage.textContent=stopDaily?'今日のチャレンジ':'準備OK?';stopButton.textContent='スタート';stopButton.disabled=false;stopMarker.style.left='0%';stopTarget.style.left='50%';
}
stopButton.onclick=async()=>{
 if(stopState==='running'){
   const session=stopSession;stopState='submitting';cancelAnimationFrame(stopRaf);stopButton.disabled=true;
   const actionMs=Math.max(0,Math.round(performance.now()-stopStartedAt));
   const res=await submitScoreWithRetry({sessionToken:session.sessionToken,score:0,durationMs:actionMs,actionMs});
   const stillHere=stopSession===session;
   if(res.ok){
     const distance=res.details&&Number(res.details.distancePct);
     if(stillHere){setStopVisual(Number(res.score)>=990?'bullseye':'result');stopMessage.textContent=String(res.score);showScoreResult('stop',res,(res.daily?'デイリー · ':'')+'STOP! '+res.score+(Number.isFinite(distance)?' / '+distance.toFixed(2)+'%':''));}
     await refreshPlatform();
   }else{
     await cancelPlaySession(session&&session.sessionToken);
     if(stillHere){stopMessage.textContent='保存できませんでした';setStatus('STOP! スコアを保存できませんでした: '+FlecityErrors.text(res.error),'error');}
   }
   if(stillHere){stopSession=null;stopState='idle';stopButton.disabled=false;stopButton.textContent='もう一度';}return;
 }
 if(stopState!=='idle')return;
 stopButton.disabled=true;
 const res=await startSessionWithRetry({gameId:'stop',daily:stopDaily});
 if(!res.ok){stopButton.disabled=false;if(res.error!=='APP_SUSPENDED')setStatus('STOP!を開始できません: '+FlecityErrors.text(res.error),'error');return;}
 stopSession=res;stopState='running';setStopVisual('running');stopStartedAt=performance.now();
 stopTarget.style.left=String(Number(res.challenge&&res.challenge.targetPct)||50)+'%';
 stopMessage.textContent='STOP!';stopButton.textContent='STOP';stopButton.disabled=false;animateStop();
};
stopBack.onclick=async()=>{
 if(stopState==='submitting'){setStatus('STOP!の記録を保存中です…','warn');return;}
 if(stopSession&&stopState==='running'){
   const ok=await confirmAction('STOP!を終了しますか？','現在のRunは記録されず終了します。','終了する');
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
function renderBlock(){
 const selectedPiece=block.pieces[block.selected]||null;
 blockScore.textContent=String(block.score);
 refreshScreenBests();blockMeta.textContent=(block.daily?'DAILY · ':'')+'COMBO '+String(block.combo)+' · '+String(block.pieces.filter(Boolean).length)+'/3 PIECES';
 blockBoard.innerHTML='';
 for(let y=0;y<8;y++)for(let x=0;x<8;x++){
   const cell=document.createElement('button');
   const valid=!block.board[y][x]&&selectedPiece&&canPlace(selectedPiece,x,y);
   cell.className='block-cell'+(block.board[y][x]?' filled':'')+(valid?' valid-origin':'');
   cell.disabled=block.finished||block.finalizing||!valid;
   cell.setAttribute('aria-label',valid?'ここに置けます':'マス');
   cell.onclick=()=>placeBlock(x,y);blockBoard.appendChild(cell);
 }
 blockPieces.innerHTML='';
 block.pieces.forEach((p,i)=>{
   const b=document.createElement('button');b.className='piece'+(block.selected===i?' selected':'');b.disabled=block.finished||block.finalizing||!p;
   if(p){const mini=document.createElement('div');mini.className='mini-piece';for(const [x,y] of SHAPES[p.shape]){const d=document.createElement('span');d.style.gridColumn=String(x+1);d.style.gridRow=String(y+1);mini.appendChild(d);}b.appendChild(mini);}
   else b.textContent='USED';
   b.onclick=()=>{block.selected=i;renderBlock();};blockPieces.appendChild(b);
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
 block.history.push([slot,x,y]);
 for(const [dx,dy] of SHAPES[piece.shape])block.board[y+dy][x+dx]=1;
 block.score+=SHAPES[piece.shape].length*10;block.pieces[slot]=null;
 const clearedLines=clearLines();
 if(clearedLines>0){
   blockBoard.classList.remove('line-clear');void blockBoard.offsetWidth;blockBoard.classList.add('line-clear');
   tone(620+Math.min(260,block.combo*45),55);
   setStatus((block.combo>1?'COMBO ×'+block.combo+' · ':'')+clearedLines+' LINE CLEAR','good');
 }else tone(420,22);
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
 if(res.ok){if(!game.daily)delete saves.block;if(block===game){showScoreResult('block',res,(res.daily?'デイリー · ':'')+'BLOCK '+res.score+'点');renderBlock();}await refreshPlatform();}
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
 block=null;showHome();
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
 refreshScreenBests();mergeScore.textContent=String(merge.score);
 let maxTile=0;
 mergeBoard.innerHTML='';
 for(let y=0;y<4;y++)for(let x=0;x<4;x++){
   const d=document.createElement('div'),v=Number(merge.board[y][x]||0);
   if(v>maxTile)maxTile=v;
   d.className='merge-cell'+(v?' filled tile-'+Math.min(2048,v):'');if(v)d.dataset.value=String(v);d.textContent=v?String(v):'';mergeBoard.appendChild(d);
 }
 mergeMeta.textContent=String(merge.moves)+' MOVES · MAX '+String(maxTile)+(merge.finished?' · FINISHED':'');
 const locked=merge.finished||merge.finalizing;
 mergeUp.disabled=locked;mergeDown.disabled=locked;mergeLeft.disabled=locked;mergeRight.disabled=locked;
 mergeFinish.disabled=locked;mergeNew.disabled=merge.finalizing===true;
}
async function persistMerge(showError=false){
 const game=merge;if(!game||game.finished)return true;
 if(game.progressed!==true)return true;
 const state={board:game.board,score:game.score,moves:game.moves,rngState:game.rngState,history:game.history};
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
   merge={board:saved.state.board,score:Number(saved.state.score||saved.score||0),moves:Number(saved.state.moves||0),rngState:Number(saved.state.rngState||session.seed),
     history:Array.isArray(saved.state.history)?saved.state.history:[],elapsedBase:Number(session.baseElapsedMs||0),sessionStarted:performance.now(),sessionToken:session.sessionToken,seed:session.seed,finished:false,progressed:true};
   setStatus('MERGEを途中保存から再開しました。','good');
 }else{
   merge={board:emptyMergeBoard(),score:0,moves:0,rngState:Number(session.seed)||1,history:[],elapsedBase:0,sessionStarted:performance.now(),sessionToken:session.sessionToken,seed:session.seed,finished:false,progressed:false};
   spawnMergeTile();spawnMergeTile();setStatus('新しいMERGEを開始しました。','good');
 }
 renderMerge();
}
async function moveMerge(direction){
 const game=merge;if(!game||game.finished)return;
 const before=JSON.stringify(game.board),scoreBefore=game.score;
 if(direction==='left'||direction==='right'){
   for(let y=0;y<4;y++){
     let row=merge.board[y].slice();if(direction==='right')row.reverse();row=compressMergeLine(row);if(direction==='right')row.reverse();merge.board[y]=row;
   }
 }else{
   for(let x=0;x<4;x++){
     let col=[];for(let y=0;y<4;y++)col.push(merge.board[y][x]);if(direction==='down')col.reverse();col=compressMergeLine(col);if(direction==='down')col.reverse();for(let y=0;y<4;y++)merge.board[y][x]=col[y];
   }
 }
 if(before===JSON.stringify(merge.board)){setStatus('タイルを動かせませんでした。','warn');tone(150,28);return;}
 const gained=Math.max(0,merge.score-scoreBefore);
 merge.progressed=true;merge.moves+=1;merge.history.push(direction);spawnMergeTile();
 mergeBoard.classList.remove('merge-move','merge-combine');void mergeBoard.offsetWidth;mergeBoard.classList.add(gained>0?'merge-combine':'merge-move');
 if(gained>0)tone(500+Math.min(320,gained),38);else tone(300,16);
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
 if(res.ok){delete saves.merge;if(merge===game){showScoreResult('merge',res,'MERGE '+res.score+'点');renderMerge();}await refreshPlatform();}
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
 refreshScreenBests();minesMeta.textContent=(mines.daily?'DAILY · ':'')+'地雷 '+String(mines.mineCount)+' · FLAG '+String(mines.flags.size)+' · OPEN '+String(mines.revealed.size)+'/'+String(safeTotal);
 for(let i=0;i<mines.size*mines.size;i++){
   const b=document.createElement('button'),revealed=mines.revealed.has(i),flagged=mines.flags.has(i);
   const n=revealed?mineCountAround(i):0;
   b.className='mines-cell'+(revealed?' revealed':'')+(flagged?' flagged':'')+(n?' n'+n:'')+(mines.lost&&mines.mineSet.has(i)?' mine':'');
   if(mines.lost&&mines.mineSet.has(i))b.textContent='✹';
   else if(flagged)b.textContent='⚑';
   else if(revealed)b.textContent=n?String(n):'';
   b.disabled=mines.finished||revealed;b.onclick=()=>touchMine(i);minesBoard.appendChild(b);
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
async function touchMine(index){
 const game=mines;if(!game||game.finished)return;
 const firstReveal=game.mode==='reveal'?index:null;
 if(!(await activateMinesTiming(firstReveal))||mines!==game)return;
 if(mines.mode==='flag'){
   if(mines.revealed.has(index))return;
   mines.progressed=true;
   if(mines.flags.has(index)){mines.flags.delete(index);tone(270,18);}else{mines.flags.add(index);tone(520,22);}renderMines();await persistMines();return;
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
 const session=await startSessionWithRetry({gameId:'stack'});
 if(!session.ok){if(session.error!=='APP_SUSPENDED'){setStatus('STACKを開始できません: '+FlecityErrors.text(session.error),'error');showHome();}return;}
 const width=Number(session.challenge&&session.challenge.initialWidthPct)||72;
 const startedAt=performance.now();
 stackGame={sessionToken:session.sessionToken,startedAt,layerStartedAt:startedAt,layers:[{x:(100-width)/2,width}],x:0,width,score:0,speed:Number(session.challenge&&session.challenge.speedPctPerSec)||65,reverse:false,history:[],finished:false};
 stackDrop.disabled=false;stackDrop.textContent='DROP';setStatus('STACK開始。','good');renderStack();stackRaf=requestAnimationFrame(stackLoop);
}
async function finishStack(){
 const game=stackGame;if(!game||game.finished||game.finalizing)return;
 game.finished=true;game.finalizing=true;cancelAnimationFrame(stackRaf);stackDrop.disabled=true;stackDrop.textContent='終了';
 const durationMs=Math.max(0,Math.round(performance.now()-game.startedAt));
 const res=await submitScoreWithRetry({sessionToken:game.sessionToken,score:game.score,durationMs,history:game.history});
 game.finalizing=false;
 if(res.ok){game.sessionToken=null;if(stackGame===game)showScoreResult('stack',res,'STACK '+res.score+'段');await refreshPlatform();}
 else{await cancelPlaySession(game.sessionToken);game.sessionToken=null;if(stackGame===game)setStatus('STACKスコアを保存できませんでした: '+FlecityErrors.text(res.error),'error');}
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
 stackArena.classList.remove('perfect-hit','nice-hit');void stackArena.offsetWidth;
 if(precision>=.985){stackArena.classList.add('perfect-hit');setStatus('PERFECT! '+stackGame.score+'段','good');tone(880,55);}
 else if(precision>=.9){stackArena.classList.add('nice-hit');setStatus('NICE! '+stackGame.score+'段','good');tone(720,40);}
 stackGame.speed=Math.min(180,stackGame.speed+4);
 stackGame.reverse=(stackGame.score%2)===1;
 stackGame.layerStartedAt=now;
 stackGame.x=stackPosition(0,stackGame.width,stackGame.speed,stackGame.reverse);
 renderStack();
};
stackBack.onclick=async()=>{if(stackGame&&stackGame.finalizing){setStatus('STACKの記録を保存中です…','warn');return;}if(stackGame&&!stackGame.finished){const ok=await confirmAction('STACKを終了しますか？','現在のRunは記録されず終了します。','終了する');if(!ok)return;}cancelAnimationFrame(stackRaf);if(stackGame&&!stackGame.finished&&stackGame.sessionToken)await cancelPlaySession(stackGame.sessionToken);stackGame=null;showHome();};
stackNew.onclick=async()=>{if(stackGame&&stackGame.finalizing){setStatus('STACKの記録を保存中です…','warn');return;}if(stackGame&&!stackGame.finished){const ok=await confirmAction('STACKをやり直しますか？','現在のRunは記録されず、新しく始めます。','やり直す');if(!ok)return;}cancelAnimationFrame(stackRaf);if(stackGame&&!stackGame.finished&&stackGame.sessionToken)await cancelPlaySession(stackGame.sessionToken);stackGame=null;await openStack();};

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
function renderNonogram(){
 if(!nonogram)return;nonogramBoard.innerHTML='';updateNonogramTime();
 refreshScreenBests();nonogramMeta.textContent=(nonogram.daily?'DAILY · ':'')+String(nonogram.filled.size)+' / '+String(nonogram.solution.size)+' FILLED';
 const blank=document.createElement('div');blank.className='nonogram-clue';nonogramBoard.appendChild(blank);
 for(let x=0;x<nonogram.size;x++){
   const vals=[];for(let y=0;y<nonogram.size;y++)vals.push(nonogram.solution.has(y*nonogram.size+x));
   const clue=document.createElement('div');clue.className='nonogram-clue';clue.textContent=nonogramClue(vals);nonogramBoard.appendChild(clue);
 }
 nonogramCheck.disabled=nonogram.finished||nonogram.finalizing;
 nonogramNew.disabled=nonogram.finalizing===true;
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
 nonogramNew.textContent=nonogram.daily?'最初から':'新しい問題';setStatus(saved?'NONOGRAMを途中保存から再開しました。':(nonogram.daily?'デイリーNONOGRAM開始。':'新しいNONOGRAMを開始しました。'),'good');renderNonogram();nonogramClock=setInterval(updateNonogramTime,250);
}
async function touchNonogram(index){
 const game=nonogram;if(!game||game.finished)return;
 if(!(await activateNonogramTiming())||nonogram!==game)return;
 nonogram.progressed=true;
 if(nonogram.filled.has(index)){nonogram.filled.delete(index);nonogram.crossed.add(index);tone(260,16);}
 else if(nonogram.crossed.has(index)){nonogram.crossed.delete(index);tone(190,12);}
 else{nonogram.filled.add(index);tone(520,18);}
 nonogramBoard.classList.remove('cell-touch');void nonogramBoard.offsetWidth;nonogramBoard.classList.add('cell-touch');
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
 colorMatchChoices.innerHTML='';colorMatchBest.textContent='BEST '+personalBestText('color_match');
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
 colorMatchStart.disabled=false;colorMatchStart.classList.remove('hidden');colorMatchNew.classList.add('hidden');renderColorMatch();setStatus('文字の意味ではなく、文字そのものの色を選んでください。','good');
}
async function startColorMatch(){
 if(colorMatch&&colorMatch.running)return;
 colorMatchStart.disabled=true;
 const session=await startSessionWithRetry({gameId:'color_match'});
 if(!session.ok){colorMatchStart.disabled=false;if(session.error!=='APP_SUSPENDED')setStatus('COLOR MATCHを開始できません: '+FlecityErrors.text(session.error),'error');return;}
 const rounds=colorMatchRounds(session.seed,Number(session.challenge&&session.challenge.rounds)||10);
 colorMatch={sessionToken:session.sessionToken,seed:Number(session.seed)||1,rounds,index:0,history:[],startedAt:performance.now(),running:true,finished:false};
 colorMatchStart.classList.add('hidden');colorMatchNew.classList.remove('hidden');setStatus('COLOR MATCH開始。10問連続正解を目指してください。','good');renderColorMatch();colorMatchClock=setInterval(updateColorMatchTime,100);
}
async function answerColorMatch(choice){
 const game=colorMatch;if(!game||!game.running||game.finished)return;
 const round=game.rounds[game.index];game.history.push(choice);
 if(choice!==round.ink){
   colorMatchEl.classList.remove('match-ok','match-miss');void colorMatchEl.offsetWidth;colorMatchEl.classList.add('match-miss');
   game.running=false;game.finished=true;clearInterval(colorMatchClock);colorMatchClock=null;
   if(colorMatch===game){
     colorMatchChoices.querySelectorAll('button').forEach(b=>b.disabled=true);
     colorMatchNew.classList.add('hidden');colorMatchWord.textContent='MISS';colorMatchWord.style.color='';
   }
   if(game.sessionToken)await cancelPlaySession(game.sessionToken);
   game.sessionToken=null;
   if(colorMatch===game){
     colorMatchStart.classList.remove('hidden');colorMatchStart.disabled=false;colorMatchStart.textContent='もう一度';
     setStatus('不正解。10問連続正解でクリアです。','warn');
   }
   return;
 }
 colorMatchEl.classList.remove('match-ok','match-miss');void colorMatchEl.offsetWidth;colorMatchEl.classList.add('match-ok');
 tone(720,35);game.index+=1;
 if(game.index>=game.rounds.length){
   game.running=false;game.finished=true;game.finalizing=true;clearInterval(colorMatchClock);colorMatchClock=null;
   const durationMs=Math.max(0,Math.round(performance.now()-game.startedAt));
   const res=await submitScoreWithRetry({sessionToken:game.sessionToken,score:durationMs,durationMs,history:game.history});
   game.finalizing=false;
   if(res.ok){
     game.sessionToken=null;if(colorMatch===game){colorMatchProgress.textContent='10 / 10';colorMatchWord.textContent='CLEAR';colorMatchWord.style.color='';
     colorMatchTime.textContent=(Number(res.score)/1000).toFixed(3)+'s';colorMatchChoices.innerHTML='';colorMatchNew.classList.add('hidden');colorMatchStart.classList.remove('hidden');colorMatchStart.disabled=false;colorMatchStart.textContent='もう一度';
     showScoreResult('color_match',res,'COLOR MATCH '+(Number(res.score)/1000).toFixed(3)+'s');}await refreshPlatform();
   }else{
     await cancelPlaySession(game.sessionToken);game.sessionToken=null;game.finished=true;game.running=false;
     if(colorMatch===game){colorMatchStart.classList.remove('hidden');colorMatchStart.disabled=false;colorMatchStart.textContent='もう一度';setStatus('COLOR MATCHの記録を保存できませんでした。もう一度お試しください。','error');}
   }
   return;
 }
 if(colorMatch===game)renderColorMatch();
}
colorMatchStart.onclick=startColorMatch;
colorMatchBack.onclick=async()=>{if(colorMatch&&colorMatch.finalizing){setStatus('COLOR MATCHの記録を保存中です…','warn');return;}if(colorMatch&&colorMatch.running&&!colorMatch.finished){const ok=await confirmAction('COLOR MATCHを終了しますか？','現在のRunは記録されず終了します。','終了する');if(!ok)return;}clearInterval(colorMatchClock);colorMatchClock=null;if(colorMatch&&colorMatch.sessionToken)await cancelPlaySession(colorMatch.sessionToken);colorMatch=null;showHome();};
colorMatchNew.onclick=async()=>{if(colorMatch&&colorMatch.finalizing){setStatus('COLOR MATCHの記録を保存中です…','warn');return;}if(colorMatch&&colorMatch.running&&!colorMatch.finished){const ok=await confirmAction('COLOR MATCHをやり直しますか？','現在のRunは記録されず、新しく始めます。','やり直す');if(!ok)return;}clearInterval(colorMatchClock);colorMatchClock=null;if(colorMatch&&colorMatch.sessionToken)await cancelPlaySession(colorMatch.sessionToken);colorMatch=null;openColorMatch();};

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
 refreshScreenBests();numberRushMeta.textContent=(numberRush.daily?'DAILY · ':'')+'MISS '+numberRush.misses+' · ペナルティ '+(numberRush.misses*.5).toFixed(1)+'s';
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
 numberRushBoard.classList.remove('rush-hit');void numberRushBoard.offsetWidth;numberRushBoard.classList.add('rush-hit');
 if(numberRush.next>numberRush.count){await finishNumberRush();return;}
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
     showScoreResult('number_rush',res,(res.daily?'デイリー · ':'')+'NUMBER RUSH '+(Number(res.score)/1000).toFixed(3)+'s'+(penalty?'（ペナルティ '+(penalty/1000).toFixed(1)+'s）':''));
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
 refreshScreenBests();
 if(!highLow){
   highLowCard.textContent='?';highLowStreak.textContent='0';highLowMeta.textContent='ROUND 0 / 30';
   highLowHigher.disabled=true;highLowLower.disabled=true;return;
 }
 highLowCard.textContent=highLowLabel(highLow.currentValue);
 highLowStreak.textContent=String(highLow.streak);
 const round=Math.min(highLow.completed+1,highLow.maxRounds);
 highLowMeta.textContent='ROUND '+String(round)+' / '+String(highLow.maxRounds)+(highLow.finished?' · GAME OVER':'');
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
 const session=await startSessionWithRetry({gameId:'high_low'});
 if(!session.ok){highLowStart.disabled=false;if(session.error!=='APP_SUSPENDED')setStatus('HIGH & LOWを開始できません: '+FlecityErrors.text(session.error),'error');return;}
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
   await cancelPlaySession(game.sessionToken);game.sessionToken=null;game.busy=false;game.running=false;game.finished=true;renderHighLow();
   setStatus('HIGH & LOWの判定通信に失敗しました。もう一度お試しください。','error');return;
 }
 game.currentValue=Number(res.nextValue)||game.currentValue;
 game.streak=Math.max(0,Number(res.streak)||0);
 game.completed=Math.max(0,Number(res.completed)||0);
 game.busy=false;
 highLowCard.classList.remove('card-pop');void highLowCard.offsetWidth;highLowCard.classList.add('card-pop');
 highLowEl.classList.remove('guess-correct','guess-wrong');void highLowEl.offsetWidth;highLowEl.classList.add(res.correct?'guess-correct':'guess-wrong');
 if(res.correct){
   tone(720+Math.min(220,game.streak*12),35);
   setStatus(highLowLabel(res.currentValue)+' → '+highLowLabel(res.nextValue)+' · 正解 · '+game.streak+'連勝','good');
 }else{
   tone(160,80);setStatus(highLowLabel(res.currentValue)+' → '+highLowLabel(res.nextValue)+' · 不正解','warn');
 }
 renderHighLow();
 if(res.ended===true){await finishHighLow(res.cleared===true);}
}
async function finishHighLow(cleared){
 const game=highLow;if(!game||game.finished||game.finalizing)return;
 game.finished=true;game.finalizing=true;game.running=false;game.busy=true;if(highLow===game)renderHighLow();
 const durationMs=Math.max(0,Math.round(performance.now()-game.startedAt));
 const res=await submitScoreWithRetry({sessionToken:game.sessionToken,score:game.streak,durationMs});
 game.finalizing=false;
 if(res.ok){
   game.sessionToken=null;game.busy=false;
   if(highLow===game)showScoreResult('high_low',res,(cleared?'30 ROUND CLEAR · ':'')+'HIGH & LOW '+res.score+'連勝');
   await refreshPlatform();
 }else{
   await cancelPlaySession(game.sessionToken);game.sessionToken=null;game.finished=true;game.running=false;game.busy=false;
   if(highLow===game){renderHighLow();setStatus('HIGH & LOWの記録を保存できませんでした。もう一度お試しください。','error');}
 }
}
highLowStart.onclick=startHighLow;
highLowHigher.onclick=()=>guessHighLow('high');
highLowLower.onclick=()=>guessHighLow('low');
highLowBack.onclick=async()=>{
 if(highLow&&highLow.finalizing){setStatus('HIGH & LOWの記録を保存中です…','warn');return;}
 if(highLow&&highLow.running&&!highLow.finished){const ok=await confirmAction('HIGH & LOWを終了しますか？','現在の連勝記録は保存されず終了します。','終了する');if(!ok)return;}
 if(highLow&&highLow.sessionToken)await cancelPlaySession(highLow.sessionToken);
 highLow=null;showHome();
};
highLowNew.onclick=async()=>{
 if(highLow&&highLow.finalizing){setStatus('HIGH & LOWの記録を保存中です…','warn');return;}
 if(highLow&&highLow.running&&!highLow.finished){const ok=await confirmAction('HIGH & LOWをやり直しますか？','現在の連勝記録は保存されず、新しく始めます。','やり直す');if(!ok)return;}
 if(highLow&&highLow.sessionToken)await cancelPlaySession(highLow.sessionToken);
 highLow=null;openHighLow();
};

/* SIMON */
function renderSimon(){
 refreshScreenBests();const game=simon;
 if(!game){
   simonRound.textContent='0';simonMeta.textContent='ROUND 0 / 30';simonMessage.textContent='スタートを押してください。';
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
 simonBoard.dataset.phase='watch';simonMessage.textContent='覚えてください · '+game.round+'手';
 await sleep(260);
 const flashMs=Math.max(180,430-(game.round*7));
 for(let i=0;i<game.sequence.length;i++){
   if(simon!==game||game.finished)return;
   await flashSimonPad(game.sequence[i],flashMs);
 }
 if(simon!==game||game.finished)return;
 game.accepting=true;game.inputIndex=0;simonBoard.dataset.phase='input';renderSimon();simonMessage.textContent='あなたの番 · 1 / '+game.round;
}
function openSimon(){
 hideAll();simonEl.classList.remove('hidden');clearTimeout(simonTimer);simonTimer=null;simon=null;
 simonStart.classList.remove('hidden');simonNew.classList.add('hidden');simonStart.disabled=false;renderSimon();
 setStatus('光った順番を覚えて、同じ順番で押してください。','good');
}
async function startSimon(){
 if(simon&&!simon.finished)return;
 simonStart.disabled=true;
 const session=await startSessionWithRetry({gameId:'simon'});
 if(!session.ok){simonStart.disabled=false;if(session.error!=='APP_SUSPENDED')setStatus('SIMONを開始できません: '+FlecityErrors.text(session.error),'error');return;}
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
   game.accepting=true;renderSimon();simonMessage.textContent='あなたの番 · '+String(game.inputIndex+1)+' / '+game.round;return;
 }

 game.submitting=true;renderSimon();
 const res=await sendSimonRound(game.roundInputs.slice(),game.round);
 game.submitting=false;
 if(simon!==game){await cancelPlaySession(game.sessionToken);return;}
 if(!res.ok){
   await cancelPlaySession(game.sessionToken);game.sessionToken=null;game.finished=true;game.accepting=false;game.submitting=false;renderSimon();
   simonMessage.textContent='通信に失敗しました';
   setStatus('SIMONの判定通信に失敗しました。もう一度お試しください。','error');return;
 }
 game.cleared=Math.max(0,Number(res.cleared)||0);renderSimon();
 if(res.ended===true){await finishSimon(res.clearedAll===true);return;}

 const nextSequence=Array.isArray(res.sequence)?res.sequence.map(Number):[];
 const nextRound=Math.max(1,Number(res.round)||game.round+1);
 if(nextSequence.length!==nextRound||nextSequence.some(v=>!Number.isInteger(v)||v<0||v>3)){
   await cancelPlaySession(game.sessionToken);game.sessionToken=null;game.finished=true;game.accepting=false;game.submitting=false;
   if(simon===game){renderSimon();simonMessage.textContent='通信状態が不正です';setStatus('SIMONの次ラウンドを取得できませんでした。もう一度お試しください。','error');}
   return;
 }
 simonMessage.textContent='CLEAR · ROUND '+game.round;
 game.round=nextRound;game.sequence=nextSequence;game.inputIndex=0;game.roundInputs=[];
 await sleep(520);
 if(simon===game&&!game.finished)await playSimonSequence();
}
simonPads.forEach((pad,index)=>{pad.onclick=()=>pressSimon(index);});
simonStart.onclick=startSimon;
simonBack.onclick=async()=>{if(simon&&simon.finalizing){setStatus('SIMONの記録を保存中です…','warn');return;}if(simon&&!simon.finished){const ok=await confirmAction('SIMONを終了しますか？','現在の到達ラウンドは記録されず終了します。','終了する');if(!ok)return;}clearTimeout(simonTimer);simonTimer=null;if(simon&&simon.sessionToken)await cancelPlaySession(simon.sessionToken);simon=null;showHome();};
simonNew.onclick=async()=>{if(simon&&simon.finalizing){setStatus('SIMONの記録を保存中です…','warn');return;}if(simon&&!simon.finished){const ok=await confirmAction('SIMONをやり直しますか？','現在の到達ラウンドは記録されず、新しく始めます。','やり直す');if(!ok)return;}clearTimeout(simonTimer);simonTimer=null;if(simon&&simon.sessionToken)await cancelPlaySession(simon.sessionToken);simon=null;openSimon();};

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
 refreshScreenBests();memoryMeta.textContent=memory.previewing?((memory.daily?'DAILY · ':'')+'記憶中…'):((memory.daily?'DAILY · ':'')+String(memory.matched.size/2)+' / 8 PAIRS · '+String(memory.moves)+' MOVES');
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
   game.displayElapsedMs=Number(res.score);game.sessionToken=null;game.busy=false;if(memory===game){showScoreResult('memory',res,(res.daily?'デイリー · ':'')+'MEMORY '+(Number(res.score)/1000).toFixed(2)+'s · '+game.moves+' MOVES');renderMemory();}await refreshPlatform();
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
   clearInterval(minesClock);clearInterval(nonogramClock);clearInterval(memoryClock);clearInterval(colorMatchClock);clearInterval(numberRushClock);
   clearTimeout(memoryFlipTimer);clearTimeout(simonTimer);
   minesClock=null;nonogramClock=null;memoryClock=null;colorMatchClock=null;numberRushClock=null;memoryFlipTimer=null;simonTimer=null;

   if(block&&!block.finished&&!block.finalizing){
     if(!block.daily)await suspendStep('block save',()=>persistBlock(false));
     await suspendStep('block cancel',()=>cancelPlaySession(block&&block.sessionToken));
   }
   if(merge&&!merge.finished&&!merge.finalizing){
     await suspendStep('merge save',()=>persistMerge(false));
     await suspendStep('merge cancel',()=>cancelPlaySession(merge&&merge.sessionToken));
   }
   if(mines&&!mines.finished&&!mines.finalizing){
     if(!mines.daily)await suspendStep('mines save',()=>persistMines(false));
     await suspendStep('mines cancel',()=>cancelPlaySession(mines&&mines.sessionToken));
   }
   if(nonogram&&!nonogram.finished&&!nonogram.finalizing){
     if(!nonogram.daily)await suspendStep('nonogram save',()=>persistNonogram(false));
     await suspendStep('nonogram cancel',()=>cancelPlaySession(nonogram&&nonogram.sessionToken));
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
   block=null;merge=null;mines=null;nonogram=null;stackGame=null;memory=null;colorMatch=null;numberRush=null;highLow=null;simon=null;
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
