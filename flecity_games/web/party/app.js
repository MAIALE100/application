const statusEl=document.getElementById('status'),entryEl=document.getElementById('entry'),roomEl=document.getElementById('room'),roomCodeEl=document.getElementById('roomCode'),playersEl=document.getElementById('players'),readySummary=document.getElementById('readySummary');
const codeEl=document.getElementById('code'),createBtn=document.getElementById('create'),joinBtn=document.getElementById('join'),leaveBtn=document.getElementById('leave'),readyBtn=document.getElementById('ready'),startBtn=document.getElementById('start'),gameEl=document.getElementById('game'),gameInfo=document.getElementById('gameInfo');
const lobbyPanel=document.getElementById('lobbyPanel'),roundPanel=document.getElementById('roundPanel'),roundDeadline=document.getElementById('roundDeadline');
const mastermindLobbyOptions=document.getElementById('mastermindLobbyOptions'),mastermindAiDifficulty=document.getElementById('mastermindAiDifficulty'),mastermindDuplicates=document.getElementById('mastermindDuplicates'),mastermindTurnLimit=document.getElementById('mastermindTurnLimit'),mastermindFirstTurn=document.getElementById('mastermindFirstTurn'),mastermindOptionsNote=document.getElementById('mastermindOptionsNote');
const shogiLobbyOptions=document.getElementById('shogiLobbyOptions'),shogiAiDifficulty=document.getElementById('shogiAiDifficulty'),shogiOptionsNote=document.getElementById('shogiOptionsNote');
const partyPlusCard=document.getElementById('partyPlusCard'),partyPlusTitle=document.getElementById('partyPlusTitle'),partyPlusBadge=document.getElementById('partyPlusBadge'),partyPlusDescription=document.getElementById('partyPlusDescription'),partyPlusSubscribe=document.getElementById('partyPlusSubscribe'),partyPlusCancel=document.getElementById('partyPlusCancel');
const reactionPanel=document.getElementById('reactionPanel'),reactionMessage=document.getElementById('reactionMessage'),reactionTap=document.getElementById('reactionTap');
const stopBattlePanel=document.getElementById('stopBattlePanel'),stopBattleMessage=document.getElementById('stopBattleMessage'),stopBattleButton=document.getElementById('stopBattleButton'),stopBattleTarget=document.getElementById('stopBattleTarget'),stopBattleMarker=document.getElementById('stopBattleMarker');
const codeBreakPanel=document.getElementById('codeBreakPanel'),codeBreakTitle=document.getElementById('codeBreakTitle'),codeBreakHint=document.getElementById('codeBreakHint'),codeBreakCurrent=document.getElementById('codeBreakCurrent'),codeBreakPalette=document.getElementById('codeBreakPalette'),codeBreakBack=document.getElementById('codeBreakBack'),codeBreakSubmit=document.getElementById('codeBreakSubmit'),codeBreakHistory=document.getElementById('codeBreakHistory'),codeBreakOpponentSection=document.getElementById('codeBreakOpponentSection'),codeBreakOpponentHistory=document.getElementById('codeBreakOpponentHistory'),codeBreakAiSection=document.getElementById('codeBreakAiSection'),codeBreakAiHistory=document.getElementById('codeBreakAiHistory');
const reversiPanel=document.getElementById('reversiPanel'),reversiStatus=document.getElementById('reversiStatus'),reversiBoard=document.getElementById('reversiBoard'),reversiMeta=document.getElementById('reversiMeta');
const votePanel=document.getElementById('votePanel'),votePrompt=document.getElementById('votePrompt'),voteChoices=document.getElementById('voteChoices');
const majorityPanel=document.getElementById('majorityPanel'),majorityGameLabel=document.getElementById('majorityGameLabel'),majorityPrompt=document.getElementById('majorityPrompt'),majorityChoices=document.getElementById('majorityChoices');
const gomokuPanel=document.getElementById('gomokuPanel'),gomokuStatus=document.getElementById('gomokuStatus'),gomokuBoard=document.getElementById('gomokuBoard'),gomokuMeta=document.getElementById('gomokuMeta');
const connect4Panel=document.getElementById('connect4Panel'),connect4Status=document.getElementById('connect4Status'),connect4Columns=document.getElementById('connect4Columns'),connect4Board=document.getElementById('connect4Board'),connect4Meta=document.getElementById('connect4Meta');
const miniShogiPanel=document.getElementById('miniShogiPanel'),miniShogiStatus=document.getElementById('miniShogiStatus'),miniShogiHandsTop=document.getElementById('miniShogiHandsTop'),miniShogiBoard=document.getElementById('miniShogiBoard'),miniShogiHandsBottom=document.getElementById('miniShogiHandsBottom'),miniShogiMeta=document.getElementById('miniShogiMeta');
const deductionPanel=document.getElementById('deductionPanel'),deductionGame=document.getElementById('deductionGame'),deductionSecret=document.getElementById('deductionSecret'),deductionHint=document.getElementById('deductionHint'),deductionChoices=document.getElementById('deductionChoices');
const drawPanel=document.getElementById('drawPanel'),drawPrompt=document.getElementById('drawPrompt'),drawProgress=document.getElementById('drawProgress'),drawCanvas=document.getElementById('drawCanvas'),drawDrawerControls=document.getElementById('drawDrawerControls'),drawGuessControls=document.getElementById('drawGuessControls'),drawClear=document.getElementById('drawClear'),drawGuess=document.getElementById('drawGuess'),drawGuessSubmit=document.getElementById('drawGuessSubmit');
const telephonePanel=document.getElementById('telephonePanel'),telephoneStatus=document.getElementById('telephoneStatus'),telephoneHint=document.getElementById('telephoneHint'),telephoneTextPrompt=document.getElementById('telephoneTextPrompt'),telephoneCanvas=document.getElementById('telephoneCanvas'),telephoneDrawControls=document.getElementById('telephoneDrawControls'),telephoneClear=document.getElementById('telephoneClear'),telephoneDrawSubmit=document.getElementById('telephoneDrawSubmit'),telephoneTextControls=document.getElementById('telephoneTextControls'),telephoneText=document.getElementById('telephoneText'),telephoneTextSubmit=document.getElementById('telephoneTextSubmit');
const ngWordPanel=document.getElementById('ngWordPanel'),ngWordTitle=document.getElementById('ngWordTitle'),ngWordHint=document.getElementById('ngWordHint'),ngWordForbidden=document.getElementById('ngWordForbidden'),ngWordClueControls=document.getElementById('ngWordClueControls'),ngWordClue=document.getElementById('ngWordClue'),ngWordClueSubmit=document.getElementById('ngWordClueSubmit'),ngWordGuessControls=document.getElementById('ngWordGuessControls'),ngWordGuess=document.getElementById('ngWordGuess'),ngWordGuessSubmit=document.getElementById('ngWordGuessSubmit');
const fakeAnswerPanel=document.getElementById('fakeAnswerPanel'),fakeAnswerQuestion=document.getElementById('fakeAnswerQuestion'),fakeAnswerHint=document.getElementById('fakeAnswerHint'),fakeAnswerSubmitControls=document.getElementById('fakeAnswerSubmitControls'),fakeAnswerInput=document.getElementById('fakeAnswerInput'),fakeAnswerSubmit=document.getElementById('fakeAnswerSubmit'),fakeAnswerChoices=document.getElementById('fakeAnswerChoices');
const bombPanel=document.getElementById('bombPanel'),bombPrompt=document.getElementById('bombPrompt'),bombHolder=document.getElementById('bombHolder'),bombHint=document.getElementById('bombHint'),bombPass=document.getElementById('bombPass');
const memoryChainPanel=document.getElementById('memoryChainPanel'),memoryChainTitle=document.getElementById('memoryChainTitle'),memoryChainSequence=document.getElementById('memoryChainSequence'),memoryChainHint=document.getElementById('memoryChainHint'),memoryChainControls=document.getElementById('memoryChainControls'),memoryChainButtons=document.getElementById('memoryChainButtons'),memoryChainInputEl=document.getElementById('memoryChainInput'),memoryChainReset=document.getElementById('memoryChainReset'),memoryChainSubmit=document.getElementById('memoryChainSubmit');
const drawCtx=drawCanvas.getContext('2d'),telephoneCtx=telephoneCanvas.getContext('2d');
const resultsPanel=document.getElementById('resultsPanel'),resultsEl=document.getElementById('results'),lobbyBtn=document.getElementById('lobby');
const settingSound=document.getElementById('settingSound'),settingMotion=document.getElementById('settingMotion');

let currentRoom=null,ready=false,poll=null,activeRoundToken=null,serverOffsetMs=0,serverOffsetReady=false,appSettings={sound:true,reducedMotion:false},audioCtx=null,lastCompleteToken=null,lastRoomRevision=-1,roomPushEnabled=false;
let partyConfig={roomCodeLength:4,minPlayers:2,maxPlayers:10,plus:null};
let refreshInFlight=false,refreshQueued=false,appSuspended=false,bootstrapTimer=null,visibilityBound=false,leaveConfirmTimer=null,leaveConfirmUntil=0,partyPlusConfirmTimer=null,partyPlusConfirmUntil=0,lifecycleEpoch=0;
const actionLocks=new Set();
let reactionState='idle',reactionRaf=null;
let stopBattleState='idle',stopBattleRaf=null,deadlineRaf=null,deductionPhaseRaf=null,resultHoldRaf=null,resultLobbyUnlockAt=0,drawStroke=null,drawIsDrawer=false,telephoneStroke=null,telephoneStrokes=[],memoryChainLocal=[],memoryChainKey='',codeBreakGuess=[],codeBreakToken='',connect4CeremonyToken='',connect4CeremonyUntil=0,connect4CeremonyTimer=null,miniShogiSelected=0,miniShogiDropKind='',miniShogiPromotionOverlay=null;

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
async function loadSettings(epoch=lifecycleEpoch){const res=await FlecityBridge.call('profileGetSettings',{});if(appSuspended||epoch!==lifecycleEpoch)return;if(res.ok)applySettings(res.settings);}
async function saveSettings(){
 const res=await FlecityBridge.call('profileUpdateSettings',{sound:settingSound.checked,reducedMotion:settingMotion.checked});
 if(res.ok){applySettings(res.settings);tone(520,55);}else status('設定を保存できません: '+FlecityErrors.text(res.error),'error');
}
settingSound.onchange=saveSettings;settingMotion.onchange=saveSettings;
let statusTimer=null;
function status(text,type){
 if(appSuspended)return;
 clearTimeout(statusTimer);statusTimer=null;
 statusEl.classList.remove('hidden');statusEl.textContent=text;statusEl.className='status app-status '+(type||'');
 if(type==='good')statusTimer=setTimeout(()=>statusEl.classList.add('hidden'),1800);
}
function estimatedServerTick(){return performance.now()+serverOffsetMs;}
function trianglePosition(elapsedMs,periodMs,phaseMs){
 const period=Math.max(400,Number(periodMs)||1800),cycle=(Math.max(0,Number(elapsedMs)||0)+(Number(phaseMs)||0))%period,half=period/2;
 return cycle<=half?(cycle/half)*100:((period-cycle)/half)*100;
}
function resetRoundRuntime(){
 cancelAnimationFrame(reactionRaf);cancelAnimationFrame(stopBattleRaf);cancelAnimationFrame(deadlineRaf);cancelAnimationFrame(deductionPhaseRaf);cancelAnimationFrame(resultHoldRaf);
 reactionState='idle';stopBattleState='idle';deadlineRaf=null;deductionPhaseRaf=null;resultHoldRaf=null;resultLobbyUnlockAt=0;
 lobbyBtn.disabled=false;lobbyBtn.textContent='ロビーに戻る';
 roundDeadline.classList.add('hidden');roundDeadline.textContent='';
 drawStroke=null;drawIsDrawer=false;telephoneStroke=null;telephoneStrokes=[];memoryChainLocal=[];memoryChainKey='';codeBreakGuess=[];codeBreakToken='';miniShogiSelected=0;miniShogiDropKind='';
 if(miniShogiPromotionOverlay){miniShogiPromotionOverlay.remove();miniShogiPromotionOverlay=null;}
 if(globalThis.PartyFallBattle)globalThis.PartyFallBattle.reset();
}
function deadlineLoop(token){
 if(appSuspended||!currentRoom||!currentRoom.roundState||currentRoom.roundState.token!==token)return;
 const rs=currentRoom.roundState;
 if(rs.complete||!Number.isFinite(Number(rs.deadlineTick))){roundDeadline.classList.add('hidden');return;}
 const remaining=Math.max(0,Number(rs.deadlineTick)-estimatedServerTick());
 roundDeadline.classList.remove('hidden');
 roundDeadline.textContent=remaining>0?'残り '+Math.ceil(remaining/1000)+'秒':'時間切れ判定中…';
 roundDeadline.classList.toggle('warn',remaining<=10000);
 deadlineRaf=requestAnimationFrame(()=>deadlineLoop(token));
}
function startDeadlineLoop(rs){
 cancelAnimationFrame(deadlineRaf);deadlineRaf=null;
 roundDeadline.classList.remove('warn');
 if(!rs||rs.complete||!Number.isFinite(Number(rs.deadlineTick))){roundDeadline.classList.add('hidden');return;}
 deadlineLoop(rs.token);
}
async function runOnce(key,fn){
 if(actionLocks.has(key))return;
 actionLocks.add(key);
 try{return await fn();}finally{actionLocks.delete(key);}
}
function resetLeaveConfirmation(){
 clearTimeout(leaveConfirmTimer);leaveConfirmTimer=null;leaveConfirmUntil=0;leaveBtn.textContent='退出';
}
function resetPartyPlusConfirmation(){
 clearTimeout(partyPlusConfirmTimer);partyPlusConfirmTimer=null;partyPlusConfirmUntil=0;
 if(partyConfig.plus&&!partyConfig.plus.active)partyPlusSubscribe.textContent=(Number(partyConfig.plus.durationDays)||7)+'日 '+formatMoney(Number(partyConfig.plus.price)||50000);
 else if(partyConfig.plus&&partyConfig.plus.active&&partyConfig.plus.autoRenew!==true)partyPlusSubscribe.textContent='自動更新を再開';
}
function suspendPartyUi(){
 lifecycleEpoch+=1;appSuspended=true;roomPushEnabled=false;resetRoundRuntime();resetLeaveConfirmation();resetPartyPlusConfirmation();
 clearInterval(poll);poll=null;clearTimeout(bootstrapTimer);bootstrapTimer=null;clearTimeout(statusTimer);statusTimer=null;
 if(audioCtx&&audioCtx.state==='running')audioCtx.suspend().catch(()=>{});
}
function bindVisibilityLifecycle(){
 if(visibilityBound)return;
 visibilityBound=true;
 document.addEventListener('visibilitychange',()=>{if(document.hidden)suspendPartyUi();else resumePartyUi();});
}
function scheduleBootstrap(delay=0){
 clearTimeout(bootstrapTimer);
 bootstrapTimer=setTimeout(()=>{bootstrapTimer=null;bindVisibilityLifecycle();bootstrap();},delay);
}
function resumePartyUi(){
 const wasSuspended=appSuspended;if(!wasSuspended)return;
 lifecycleEpoch+=1;appSuspended=false;
 if(currentRoom){roomPushEnabled=true;refresh();beginPolling();}
 else scheduleBootstrap(0);
}
function hideRoundGames(){
 reactionPanel.classList.add('hidden');stopBattlePanel.classList.add('hidden');codeBreakPanel.classList.add('hidden');reversiPanel.classList.add('hidden');votePanel.classList.add('hidden');majorityPanel.classList.add('hidden');gomokuPanel.classList.add('hidden');connect4Panel.classList.add('hidden');miniShogiPanel.classList.add('hidden');deductionPanel.classList.add('hidden');drawPanel.classList.add('hidden');telephonePanel.classList.add('hidden');ngWordPanel.classList.add('hidden');fakeAnswerPanel.classList.add('hidden');bombPanel.classList.add('hidden');memoryChainPanel.classList.add('hidden');
 if(globalThis.PartyFallBattle)globalThis.PartyFallBattle.hide();
}
function showEntry(){
 currentRoom=null;ready=false;activeRoundToken=null;lastRoomRevision=-1;serverOffsetReady=false;roomPushEnabled=false;resetRoundRuntime();resetLeaveConfirmation();clearInterval(poll);poll=null;
 roomEl.classList.add('hidden');entryEl.classList.remove('hidden');
}
function submissionProgress(rs){
 const done=Math.max(0,Number(rs&&rs.submittedCount)||0),total=Math.max(done,Number(rs&&rs.expectedSubmissions)||0);
 return total>0?done+'/'+total:'';
}
function selectedGameConfig(room){
 const games=Array.isArray(partyConfig.games)?partyConfig.games:[];
 return games.find(g=>g.id===room.selectedGame)||null;
}
function formatMoney(value){return Number(value||0).toLocaleString('ja-JP');}
function formatExpiry(unix){
 const value=Number(unix)||0;if(value<=0)return '';
 const date=new Date(value*1000);
 return date.toLocaleString('ja-JP',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'});
}
function renderPartyPlus(){
 const plus=partyConfig.plus;
 if(!plus||plus.enabled===false){partyPlusCard.classList.add('hidden');return;}
 partyPlusCard.classList.remove('hidden');
 const days=Math.max(1,Number(plus.durationDays)||7),price=Math.max(0,Number(plus.price)||50000);
 partyPlusTitle.textContent=days+'日間プレミアム';
 partyPlusSubscribe.textContent=days+'日 '+formatMoney(price);
 if(plus.active){
   partyPlusBadge.textContent='加入中';
   partyPlusBadge.className='good';
   partyPlusDescription.textContent='有効期限 '+formatExpiry(plus.expiresAt)+' · '+(plus.autoRenew?'自動更新ON':'自動更新OFF')+' · あなたがホストなら部屋全員が利用できます。';
   partyPlusSubscribe.classList.toggle('hidden',plus.autoRenew===true);
   partyPlusSubscribe.textContent=plus.autoRenew?days+'日 '+formatMoney(price):'自動更新を再開';
   partyPlusCancel.classList.toggle('hidden',plus.autoRenew!==true);
 }else{
   partyPlusBadge.textContent='未加入';
   partyPlusBadge.className='muted';
   partyPlusDescription.textContent='加入した人がホストなら、そのルーム全員がPARTY+ゲームを遊べます。限定品や月替わり更新はありません。';
   partyPlusSubscribe.classList.remove('hidden');
   partyPlusCancel.classList.add('hidden');
 }
 if(plus.renewError)partyPlusDescription.textContent+=' · 自動更新: '+FlecityErrors.text(plus.renewError);
}
function renderGameInfo(gameId){
 const games=Array.isArray(partyConfig.games)?partyConfig.games:[];
 const game=games.find(g=>g.id===gameId);
 gameInfo.innerHTML='';
 if(!game){
   const text=document.createElement('span');text.className='muted';text.textContent='ゲーム情報を取得できません。';gameInfo.appendChild(text);return;
 }
 const title=document.createElement('strong'),meta=document.createElement('span'),description=document.createElement('span');
 title.textContent=(game.premium?'PARTY+ · ':'')+String(game.name||game.id);meta.className='game-info-meta';description.className='muted';
 const min=Math.max(1,Number(game.minPlayers)||2),max=Math.max(min,Number(game.maxPlayers)||10);
 meta.textContent=(min===max?min+'人':min+'〜'+max+'人');
 description.textContent=String(game.description||'');
 gameInfo.append(title,meta,description);
}
function startReadiness(room){
 const game=selectedGameConfig(room);
 const min=Math.max(1,Number(game&&game.minPlayers)||partyConfig.minPlayers||2);
 const max=Math.max(min,Number(game&&game.maxPlayers)||partyConfig.maxPlayers||10);
 const connected=Number(room.connectedCount)||0;
 const appWaiting=(room.players||[]).filter(p=>!p.disconnected&&p.appOpen===false).length;
 const waiting=(room.players||[]).filter(p=>!p.disconnected&&p.appOpen!==false&&!p.ready).length;
 if(!room.isHost)return {ok:false,text:'ホストのみ開始できます'};
 if(connected<min)return {ok:false,text:'あと'+(min-connected)+'人必要です'};
 if(connected>max)return {ok:false,text:'参加人数が上限を超えています'};
 if(appWaiting>0)return {ok:false,text:'アプリ待ち '+appWaiting+'人'};
 if(waiting>0)return {ok:false,text:'準備待ち '+waiting+'人'};
 return {ok:true,text:'全員準備OK'};
}
function renderPlayers(room){
 playersEl.innerHTML='';
 const connected=(room.players||[]).filter(p=>!p.disconnected);
 playersEl.classList.toggle('dense',Number(room.players&&room.players.length||0)>=7);
 const readyCount=connected.filter(p=>p.ready).length;
 const appOpenCount=connected.filter(p=>p.appOpen!==false).length;
 readySummary.textContent='接続中 '+connected.length+'人 · アプリ '+appOpenCount+'/'+connected.length+' · 準備 '+readyCount+'/'+connected.length;
 room.players.forEach(p=>{
   const row=document.createElement('div');row.className='player';
   const left=document.createElement('span');left.textContent=(p.isHost?'★ ':'')+p.name;
   const state=p.disconnected?'オフライン':(p.appOpen===false?'アプリ閉じています':(p.ready?'準備OK':'待機中'));
   const right=document.createElement('span');right.textContent=state;right.className=p.ready&&p.appOpen!==false?'good':(p.disconnected?'error':'muted');
   row.append(left,right);playersEl.appendChild(row);
 });
}
function resultHoldLoop(token){
 if(appSuspended||!currentRoom||!currentRoom.roundState||currentRoom.roundState.token!==token||!currentRoom.roundState.complete)return;
 if(!currentRoom.isHost){lobbyBtn.disabled=true;return;}
 const remaining=resultLobbyUnlockAt-performance.now();
 if(remaining<=0){lobbyBtn.disabled=false;lobbyBtn.textContent='ロビーに戻る';return;}
 lobbyBtn.disabled=true;lobbyBtn.textContent='結果を確認 · '+Math.ceil(remaining/1000)+'秒';
 resultHoldRaf=requestAnimationFrame(()=>resultHoldLoop(token));
}
function appendResultBanner(text,type='good'){
 const d=document.createElement('div');d.className='status '+type;d.textContent=String(text||'');resultsEl.appendChild(d);return d;
}
function appendResultRow(leftText,rightText){
 const d=document.createElement('div'),left=document.createElement('span'),right=document.createElement('strong');
 d.className='player';left.textContent=String(leftText??'');right.textContent=String(rightText??'');
 d.append(left,right);resultsEl.appendChild(d);
}
function renderResults(room){
 const rs=room.roundState;if(!rs||!rs.complete||!rs.results){resultsPanel.classList.add('hidden');return;}
 cancelAnimationFrame(deadlineRaf);deadlineRaf=null;roundDeadline.classList.add('hidden');
 if(lastCompleteToken!==rs.token){lastCompleteToken=rs.token;resultLobbyUnlockAt=performance.now()+2500;tone(760,90);}
 hideRoundGames();resultsPanel.classList.remove('hidden');resultsEl.innerHTML='';
 cancelAnimationFrame(resultHoldRaf);resultHoldRaf=null;resultHoldLoop(rs.token);
 if(rs.results.aborted===true){
   const box=document.createElement('div');box.className='status warn';
   const reason=String(rs.results.reason||'ROUND_ABORTED');
   if(reason==='NOT_ENOUGH_PLAYERS')box.textContent='参加人数が足りなくなったため、このラウンドを終了しました。';
   else if(reason==='SECRET_PLAYER_LEFT')box.textContent='役職プレイヤーが退出したため、このラウンドを終了しました。';
   else if(reason==='DRAWER_LEFT')box.textContent='描き手が退出したため、このラウンドを終了しました。';
   else if(reason==='TURN_TIMEOUT')box.textContent='手番の制限時間を超えたため、このラウンドを終了しました。';
   else if(reason==='ROUND_TIMEOUT')box.textContent='制限時間を超えたため、このラウンドを終了しました。';
   else box.textContent='このラウンドは中断されました。';
   resultsEl.appendChild(box);
   return;
 }
 if(rs.gameId==='code_break'){
   const result=rs.results||{},entries=Array.isArray(result.entries)?result.entries:[];
   const winners=entries.filter(e=>e.winner===true).map(e=>e.name);
   appendResultBanner(winners.length?('WINNER · '+winners[0]):'終了 · 正解者なし',winners.length?'good':'warn');
   appendResultRow('秘密コード',(Array.isArray(result.secret)?result.secret:[]).map(v=>['','RED','BLUE','GREEN','YELLOW','PURPLE','ORANGE'][Number(v)]||'?').join(' · '));
   entries.forEach((e,index)=>appendResultRow('#'+(index+1)+' '+e.name,e.solved?Number(e.attempts||0)+'手で解読':'未解読'));
 }else if(rs.gameId==='reversi'){
   const result=rs.results||{};
   appendResultBanner(result.draw?'DRAW':('WINNER · '+String(result.winnerName||'Player')),result.draw?'warn':'good');
   appendResultRow('●',String(Number(result.blackCount||0))+'枚');
   appendResultRow('○',String(Number(result.whiteCount||0))+'枚');
   if(result.reason==='TURN_TIMEOUT')appendResultBanner('手番時間切れ','warn');
   else if(result.reason==='APP_CLOSED'||result.reason==='PLAYER_LEFT')appendResultBanner('相手退出により決着','warn');
 }else if(rs.gameId==='reaction'){
   const winner=(rs.results.entries||[]).find(e=>e.memberId===rs.results.winnerMemberId);
   appendResultBanner(winner?'WINNER · '+winner.name+' · '+Number(winner.reactionMs).toFixed(3)+' ms':'有効記録なし',winner?'good':'warn');
   if(rs.results.timedOut===true)appendResultBanner('未入力の参加者がいたため、入力済みの記録で確定しました。','warn');
   rs.results.entries.forEach(e=>appendResultRow('#'+e.place+' '+e.name,e.timedOut?'未入力':(e.flying?'フライング':Number(e.reactionMs).toFixed(3)+' ms')));
 }else if(rs.gameId==='stop_battle'){
   const winner=(rs.results.entries||[]).find(e=>e.memberId===rs.results.winnerMemberId);
   appendResultBanner(winner?'WINNER · '+winner.name+' · '+winner.score+' pt':'有効記録なし',winner?'good':'warn');
   if(rs.results.timedOut===true)appendResultBanner('未入力の参加者がいたため、入力済みの記録で確定しました。','warn');
   rs.results.entries.forEach(e=>appendResultRow('#'+e.place+' '+e.name,e.timedOut?'未入力':e.score+' / '+Number(e.distancePct).toFixed(2)+'%'));
 }else if(rs.gameId==='vote'){
   const winnerIds=Array.isArray(rs.results.winnerMemberIds)?rs.results.winnerMemberIds:[];
   const winnerNames=(rs.results.entries||[]).filter(e=>winnerIds.includes(e.memberId)).map(e=>e.name);
   if(Number(rs.results.totalVotes||0)===0){const summary=document.createElement('div');summary.className='status warn';summary.textContent='有効票なし';resultsEl.appendChild(summary);}
   else if(winnerNames.length){const summary=document.createElement('div');summary.className='status good';summary.textContent=(winnerNames.length>1?'同票: ':'最多票: ')+winnerNames.join(' / ');resultsEl.appendChild(summary);}
   rs.results.entries.forEach(e=>appendResultRow(e.name,e.votes+'票'));
 }else if(rs.gameId==='gomoku'||rs.gameId==='connect4'){
   const result=rs.results||{};
   appendResultBanner(result.draw?'DRAW':('WINNER · '+String(result.winnerName||'Player')),result.draw?'warn':'good');
   appendResultRow('手数',String(Number(result.moves||0)));
   if(result.reason==='TURN_TIMEOUT')appendResultBanner('手番時間切れ','warn');
   else if(result.reason==='APP_CLOSED'||result.reason==='PLAYER_LEFT')appendResultBanner('相手退出により決着','warn');
 }else if(rs.gameId==='majority'||rs.gameId==='minority'){
   const options=rs.results.options||rs.options||['A','B'],counts=rs.results.counts||{A:0,B:0};
   const summary=document.createElement('div');summary.className='status '+(rs.results.winningChoice?'good':'warn');
   const winning=rs.results.winningChoice,isMinority=rs.gameId==='minority';
   let winnerText;
   if(isMinority&&rs.results.noMinority===true)winnerText='全員同じ選択 · 少数派なし';
   else winnerText=winning?(isMinority?'少数派: ':'多数派: ')+(winning==='A'?options[0]:options[1]):'同数のため勝者なし';
   summary.textContent=winnerText+' · '+options[0]+' '+Number(counts.A||0)+' / '+options[1]+' '+Number(counts.B||0);
   resultsEl.appendChild(summary);
   rs.results.entries.forEach(e=>{
     const label=e.choice==='A'?options[0]:(e.choice==='B'?options[1]:'未回答');
     appendResultRow(e.name,label+(winning&&e.choice===winning?' ✓':''));
   });
 }else if(rs.gameId==='mini_shogi'){
   const result=rs.results||{};
   appendResultBanner(result.winnerName?('WINNER · '+String(result.winnerName)):'結果',result.winnerName?'good':'warn');
   appendResultRow('手数',String(Number(result.moves||0)));
 }else if(rs.gameId==='tic_tac'){
   const result=rs.results||{};
   const banner=document.createElement('div');banner.className='status '+(result.draw?'warn':'good');
   banner.textContent=result.draw?'引き分け':'勝者: '+String(result.winnerName||'Player')+' ('+String(result.winnerSymbol||'?')+')'+(result.forfeit?' · 相手が時間切れ':'');
   resultsEl.appendChild(banner);
   const board=Array.isArray(result.board)?result.board:[];
   appendResultRow('盤面',board.map(v=>v||'·').join(' '));
 }else if(rs.gameId==='word_wolf'){
   const reveal=document.createElement('div');reveal.className=rs.results.caught?'status good':'status warn';reveal.textContent=(Number(rs.results.totalVotes||0)===0?'有効票なし':(rs.results.caught?'少数派を見破りました！':'少数派を見破れませんでした'))+' · 多数派: '+rs.results.majorityTopic+' / 少数派: '+rs.results.wolfTopic;resultsEl.appendChild(reveal);
   rs.results.entries.forEach(e=>{const wolf=e.memberId===rs.results.wolfMemberId?' ← 少数派':'';appendResultRow(e.name+wolf,e.votes+'票');});
 }else if(rs.gameId==='liar'){
   const reveal=document.createElement('div');reveal.className=rs.results.caught?'status good':'status warn';reveal.textContent=(Number(rs.results.totalVotes||0)===0?'有効票なし':(rs.results.caught?'ウソつきを見破りました！':'ウソつきを見破れませんでした'))+' · 質問: '+String(rs.results.prompt||'');resultsEl.appendChild(reveal);
   rs.results.entries.forEach(e=>{const liar=e.memberId===rs.results.liarMemberId?' ← ウソつき':'';appendResultRow(e.name+liar,e.votes+'票');});
 }else if(rs.gameId==='memory_chain'){
   const result=rs.results||{},winnerIds=Array.isArray(result.winnerMemberIds)?result.winnerMemberIds:[];
   const winners=(result.entries||[]).filter(e=>winnerIds.includes(e.memberId)).map(e=>e.name);
   appendResultBanner(winners.length?'WINNER · '+winners.join(' / '):'勝者なし',winners.length?'good':'warn');
   appendResultRow('最終ステージ',String(Number(result.finalStage||0)));
   (result.entries||[]).forEach(e=>appendResultRow(e.name,'STAGE '+Number(e.stageReached||0)+(e.survived?' · SURVIVED':'')));
 }else if(rs.gameId==='bomb'){
   const result=rs.results||{};
   appendResultBanner('BOOM · '+String(result.loserName||'Player'),'warn');
   appendResultRow('お題',result.prompt||'---');
   appendResultRow('パス回数',String(Number(result.passes||0)));
   appendResultRow('終了理由',result.reason==='TURN_TIMEOUT'?'回答時間切れ':'爆発');
 }else if(rs.gameId==='fake_answer'){
   const result=rs.results||{},winnerIds=Array.isArray(result.winnerMemberIds)?result.winnerMemberIds:[];
   const winnerNames=(result.entries||[]).filter(e=>winnerIds.includes(e.memberId)).map(e=>e.name);
   appendResultBanner(winnerNames.length?'TOP · '+winnerNames.join(' / '):'結果','good');
   appendResultRow('問題',result.question||'---');
   appendResultRow('正解',result.correctAnswer||'---');
   (result.choices||[]).forEach(choice=>{
     const owner=choice.correct?'正解':(choice.creatorName?choice.creatorName+' の偽回答':'内蔵デコイ');
     appendResultRow(choice.text,owner+' · '+Number(choice.votes||0)+'票');
   });
   (result.entries||[]).forEach(e=>appendResultRow(e.name,Number(e.score||0)+' pt · 正解 '+(e.correct?'○':'×')+' · 騙した '+Number(e.foolVotes||0)+'票'));
 }else if(rs.gameId==='ng_word'){
   const result=rs.results||{};
   appendResultBanner(result.winnerName?'FASTEST · '+result.winnerName:'正解者なし',result.winnerName?'good':'warn');
   appendResultRow('お題',result.targetWord||'---');
   appendResultRow('ヒント',result.clue||'未送信');
   appendResultRow('NG',Array.isArray(result.forbiddenWords)?result.forbiddenWords.join(' / '):'---');
   (result.entries||[]).forEach(e=>appendResultRow(e.name,e.guess?(e.guess+(e.correct?' ✓':'')):'未回答'));
 }else if(rs.gameId==='fall_battle'){
   const result=rs.results||{},entries=Array.isArray(result.entries)?result.entries:[],winnerIds=Array.isArray(result.winnerMemberIds)?result.winnerMemberIds:[];
   const winners=entries.filter(e=>winnerIds.includes(e.memberId));
   const selfId=room.selfMemberId;
   const selfIndex=entries.findIndex(e=>e.memberId===selfId);

   const hero=document.createElement('div');
   hero.className='fall-result-hero'+(winners.some(e=>e.memberId===selfId)?' is-self-winner':'');
   const eyebrow=document.createElement('div');eyebrow.className='fall-result-eyebrow';eyebrow.textContent=winners.length?'落下バトル 結果':'結果';
   const title=document.createElement('div');title.className='fall-result-title';
   title.textContent=winners.length===1?'1st · '+winners[0].name:(winners.length>1?'TIE · '+winners.map(e=>e.name).join(' / '):'有効記録なし');
   const sub=document.createElement('div');sub.className='fall-result-sub';
   if(winners.length===1){
     const w=winners[0];
     sub.textContent=Number(w.score||0).toLocaleString('ja-JP')+' pt · '+Number(w.lines||0)+' LINES';
   }else if(winners.length>1){
     sub.textContent='同スコアで首位';
   }else{
     sub.textContent='記録を確定できませんでした';
   }
   hero.append(eyebrow,title,sub);resultsEl.appendChild(hero);

   if(selfIndex>=0){
     const mine=document.createElement('div');mine.className='fall-result-self';
     const mineRank=document.createElement('strong');mineRank.textContent='あなたの順位 · #'+(selfIndex+1);
     const mineScore=document.createElement('span');mineScore.textContent=Number(entries[selfIndex].score||0).toLocaleString('ja-JP')+' pt · '+Number(entries[selfIndex].lines||0)+' LINES';
     mine.append(mineRank,mineScore);resultsEl.appendChild(mine);
   }

   if(result.timedOut===true)appendResultBanner('90秒終了 · 送信済みの記録で確定しました。','warn');

   const board=document.createElement('div');board.className='fall-result-board';
   entries.forEach((e,index)=>{
     const row=document.createElement('div');
     row.className='fall-result-rank'+(e.memberId===selfId?' is-self':'')+(winnerIds.includes(e.memberId)?' is-winner':'');
     const rank=document.createElement('div');rank.className='fall-result-place';rank.textContent='#'+(index+1);
     const who=document.createElement('div');who.className='fall-result-player';
     const name=document.createElement('strong');name.textContent=e.name;
     const tag=document.createElement('span');tag.textContent=e.memberId===selfId?'YOU':(winnerIds.includes(e.memberId)?'WINNER':'');
     if(!tag.textContent)tag.classList.add('hidden');
     who.append(name,tag);
     const stat=document.createElement('div');stat.className='fall-result-stat';
     stat.textContent=e.forfeited?'DNF':(e.timedOut?'未送信':(Number(e.score||0).toLocaleString('ja-JP')+' pt · '+Number(e.lines||0)+' L'));
     row.append(rank,who,stat);board.appendChild(row);
   });
   resultsEl.appendChild(board);
 }else if(rs.gameId==='draw'){
   const reveal=document.createElement('div');reveal.className=rs.results.aborted||rs.results.timedOut?'status warn':'status good';reveal.textContent=rs.results.aborted?'描き手が退出したため終了しました。':(rs.results.timedOut?'時間切れ · 正解: ':'正解: ')+String(rs.results.prompt||'');resultsEl.appendChild(reveal);
   const fastest=(rs.results.entries||[])[0];
   if(fastest)appendResultBanner('FASTEST · '+fastest.name,'good');
   else if(!rs.results.aborted)appendResultBanner('正解者なし','warn');
   (rs.results.entries||[]).forEach(e=>appendResultRow('#'+e.place+' '+e.name,'正解'));
 }else if(rs.gameId==='telephone'){
   (rs.results.chain||[]).forEach((entry,i)=>{
     const wrap=document.createElement('div');wrap.className='card stack';
     const head=document.createElement('div');head.className='kicker';head.textContent=(i===0?'START':entry.name)+' · '+String(entry.kind||'').toUpperCase();wrap.appendChild(head);
     if(entry.kind==='text'){const p=document.createElement('div');p.textContent=entry.text||'';wrap.appendChild(p);}
     else{const canvas=document.createElement('canvas');canvas.width=360;canvas.height=260;canvas.className='draw-canvas';wrap.appendChild(canvas);paintCanvas(canvas.getContext('2d'),canvas,entry.strokes||[]);}
     resultsEl.appendChild(wrap);
   });
 }
}
function beginRoundToken(rs){
 if(activeRoundToken===rs.token)return false;
 activeRoundToken=rs.token;resetRoundRuntime();
 window.scrollTo({top:0,behavior:appSettings.reducedMotion?'auto':'smooth'});
 return true;
}
function codeBreakPeg(value){
 const peg=document.createElement('i');peg.className='mastermind-guess-peg'+(Number(value)>0?' peg-'+Number(value):' empty');return peg;
}
function codeBreakSymbolText(values){return (Array.isArray(values)?values:[]).map(v=>['','●','●','●','●','●','●'][Number(v)]||'·').join(' ');}
function renderCodeBreakGuess(){
 codeBreakCurrent.innerHTML='';const padded=codeBreakGuess.concat(Array(Math.max(0,4-codeBreakGuess.length)).fill(0));padded.forEach(v=>codeBreakCurrent.appendChild(codeBreakPeg(v)));
}
function setupCodeBreak(room){
 const rs=room.roundState;hideRoundGames();codeBreakPanel.classList.remove('hidden');resultsPanel.classList.add('hidden');beginRoundToken(rs);
 if(rs.complete){renderResults(room);return;}
 if(codeBreakToken!==rs.token){codeBreakToken=rs.token;codeBreakGuess=[];}
 const canPlay=rs.aiEnabled||rs.isCurrent===true;
 codeBreakTitle.textContent=rs.solved?'解読成功！':(canPlay?'あなたの手番':'相手の手番');
 if(rs.solved)codeBreakHint.textContent='相手の同じ手数まで結果を待っています。';
 else if(rs.aiEnabled)codeBreakHint.textContent=(rs.turnLimit===false?'無制限':'合計8ターン · 残り '+Number(rs.attemptsLeft||0))+' · AI '+String(rs.aiDifficulty||'normal').toUpperCase()+' · 同色'+(rs.allowDuplicates===false?'なし':'あり');
 else codeBreakHint.textContent=(canPlay?'あなたの手番':'相手の手番')+' · '+(rs.turnLimit===false?'無制限':'合計8ターン · 残り '+Number(rs.attemptsLeft||0))+' · 同色'+(rs.allowDuplicates===false?'なし':'あり');
 codeBreakSubmit.disabled=!canPlay||rs.solved===true||codeBreakGuess.length!==4;
 codeBreakBack.disabled=!canPlay||rs.solved===true||codeBreakGuess.length===0;
 [...codeBreakPalette.querySelectorAll('button')].forEach(b=>b.disabled=!canPlay||rs.solved===true||codeBreakGuess.length>=4);
 renderCodeBreakGuess();codeBreakHistory.innerHTML='';
 const renderMastermindHistory=(target,items)=>{
   target.innerHTML='';
   const history=Array.isArray(items)?items:[];
   history.forEach((h,index)=>{
     const row=document.createElement('div');row.className='code-break-row';
     const turn=document.createElement('small');turn.textContent=String(index+1).padStart(2,'0');
     const guess=document.createElement('div');guess.className='mastermind-row-pegs';(Array.isArray(h.guess)?h.guess:[]).forEach(v=>guess.appendChild(codeBreakPeg(v)));
     const feedbackWrap=document.createElement('div');feedbackWrap.className='mastermind-feedback-wrap';
     const score=document.createElement('div');score.className='mastermind-feedback';
     for(let i=0;i<Number(h.exact||0);i++){const p=document.createElement('i');p.className='mastermind-pin hit';score.appendChild(p);}
     for(let i=0;i<Number(h.misplaced||0);i++){const p=document.createElement('i');p.className='mastermind-pin blow';score.appendChild(p);}
     for(let i=Number(h.exact||0)+Number(h.misplaced||0);i<4;i++){const p=document.createElement('i');p.className='mastermind-pin empty';score.appendChild(p);}
     feedbackWrap.append(score);row.append(turn,guess,feedbackWrap);target.appendChild(row);
   });
   requestAnimationFrame(()=>{target.scrollTop=target.scrollHeight;});
 };
 renderMastermindHistory(codeBreakHistory,rs.history);
 codeBreakOpponentSection.classList.toggle('hidden',rs.aiEnabled||!Array.isArray(rs.opponentHistory));
 if(!rs.aiEnabled)renderMastermindHistory(codeBreakOpponentHistory,rs.opponentHistory);
 else codeBreakOpponentHistory.innerHTML='';
 codeBreakAiSection.classList.toggle('hidden',!rs.aiEnabled);
 if(rs.aiEnabled)renderMastermindHistory(codeBreakAiHistory,rs.aiHistory);
 else codeBreakAiHistory.innerHTML='';
}
function setupReversi(room){
 const rs=room.roundState;hideRoundGames();reversiPanel.classList.remove('hidden');resultsPanel.classList.add('hidden');beginRoundToken(rs);
 if(rs.complete){renderResults(room);return;}
 const board=Array.isArray(rs.board)?rs.board:Array(64).fill(''),valid=new Set(Array.isArray(rs.validMoves)?rs.validMoves.map(Number):[]);
 reversiBoard.innerHTML='';
 board.forEach((mark,index)=>{
   const button=document.createElement('button');
   button.className='reversi-cell'+(valid.has(index+1)?' valid':'');
   button.dataset.cell=String(index+1);
   button.disabled=!rs.isCurrent||!valid.has(index+1);
   if(mark==='B'||mark==='W'){
     const disc=document.createElement('span');
     disc.className='reversi-disc '+(mark==='B'?'black':'white');
     button.appendChild(disc);
   }else if(valid.has(index+1)){
     const guide=document.createElement('span');
     guide.className='reversi-guide';
     button.appendChild(guide);
   }
   button.onclick=()=>runOnce('reversi-move',async()=>{const res=await FlecityBridge.call('partySubmitReversi',{token:rs.token,cell:index+1});if(!res.ok){status('リバーシ: '+FlecityErrors.text(res.error),'error');await refresh();return;}renderRoom(res.room);});
   reversiBoard.appendChild(button);
 });
 reversiStatus.textContent=rs.isCurrent?'あなたの手番 · '+(rs.mark==='B'?'●':'○'):'相手の手番';
 reversiMeta.textContent='● '+Number(rs.blackCount||0)+' · ○ '+Number(rs.whiteCount||0)+(rs.lastPassMemberId?' · PASS発生':'');
}
function reactionLoop(){
 if(appSuspended||!currentRoom||!currentRoom.roundState||reactionState==='submitted')return;
 const rs=currentRoom.roundState,revealTick=Number(rs.startedTick||0)+Number(rs.revealAfterMs||0),until=revealTick-estimatedServerTick();
 if(until>0){
   reactionState='waiting';reactionMessage.textContent='待機';reactionTap.textContent='待機…';reactionTap.disabled=false;
 }else{
   reactionState='shown';reactionMessage.textContent='タップ!';reactionTap.textContent='タップ!';reactionTap.disabled=false;
 }
 reactionRaf=requestAnimationFrame(reactionLoop);
}
function setupReaction(room){
 const rs=room.roundState;hideRoundGames();reactionPanel.classList.remove('hidden');resultsPanel.classList.add('hidden');
 if(rs.complete){renderResults(room);return;}
 beginRoundToken(rs);
 if(rs.selfSubmitted){cancelAnimationFrame(reactionRaf);reactionMessage.textContent='入力済み · '+submissionProgress(rs);reactionTap.disabled=true;reactionTap.textContent='ほかの参加者を待っています';reactionState='submitted';return;}
 if(reactionState==='idle')reactionLoop();
}
function stopBattleLoop(){
 if(appSuspended||!currentRoom||!currentRoom.roundState||stopBattleState==='submitted')return;
 const rs=currentRoom.roundState,elapsed=estimatedServerTick()-Number(rs.motionStartTick||0);
 if(elapsed<0){
   stopBattleState='waiting';stopBattleMessage.textContent='待機';stopBattleButton.textContent='待機…';stopBattleButton.disabled=true;
 }else{
   stopBattleState='running';stopBattleMessage.textContent='STOP!';stopBattleButton.textContent='STOP';stopBattleButton.disabled=false;
   stopBattleMarker.style.left=trianglePosition(elapsed,rs.periodMs,rs.phaseMs)+'%';
 }
 stopBattleRaf=requestAnimationFrame(stopBattleLoop);
}
function setupStopBattle(room){
 const rs=room.roundState;hideRoundGames();stopBattlePanel.classList.remove('hidden');resultsPanel.classList.add('hidden');
 if(rs.complete){renderResults(room);return;}
 beginRoundToken(rs);stopBattleTarget.style.left=String(Number(rs.targetPct)||50)+'%';
 if(rs.selfSubmitted){cancelAnimationFrame(stopBattleRaf);stopBattleMessage.textContent='入力済み · '+submissionProgress(rs);stopBattleButton.disabled=true;stopBattleButton.textContent='ほかの参加者を待っています';stopBattleState='submitted';return;}
 if(stopBattleState==='idle')stopBattleLoop();
}
function setupVote(room){
 const rs=room.roundState;hideRoundGames();votePanel.classList.remove('hidden');resultsPanel.classList.add('hidden');
 votePrompt.textContent=rs.prompt||'投票';voteChoices.innerHTML='';beginRoundToken(rs);
 if(rs.complete){renderResults(room);return;}
 if(rs.selfSubmitted){voteChoices.innerHTML='<div class="status good">投票済み · '+submissionProgress(rs)+'<br>ほかの参加者を待っています。</div>';return;}
 room.players.filter(p=>!p.disconnected&&p.appOpen!==false&&p.memberId!==room.selfMemberId).forEach(p=>{
   const b=document.createElement('button');b.className='secondary';b.textContent=p.name;b.onclick=()=>submitVote(rs.token,p.memberId);voteChoices.appendChild(b);
 });
}
function setupGomoku(room){
 const rs=room.roundState;hideRoundGames();gomokuPanel.classList.remove('hidden');resultsPanel.classList.add('hidden');beginRoundToken(rs);
 if(rs.complete){renderResults(room);return;}
 const board=Array.isArray(rs.board)?rs.board:Array(121).fill('');gomokuBoard.innerHTML='';
 board.forEach((mark,index)=>{const b=document.createElement('button');b.className='gomoku-cell';b.textContent=mark==='X'?'●':(mark==='O'?'○':'');b.disabled=!rs.isCurrent||mark!=='';b.onclick=()=>runOnce('gomoku-move',async()=>{const res=await FlecityBridge.call('partySubmitGomoku',{token:rs.token,cell:index+1});if(!res.ok){status('五目並べ: '+FlecityErrors.text(res.error),'error');await refresh();return;}renderRoom(res.room);});gomokuBoard.appendChild(b);});
 gomokuStatus.textContent=rs.isCurrent?'あなたの手番 · '+(rs.mark==='X'?'●':'○'):'相手の手番';
 gomokuMeta.textContent='11×11 · 先に5つ · '+Number(rs.moves||0)+'手';
}
function setupConnect4(room){
 const rs=room.roundState;hideRoundGames();connect4Panel.classList.remove('hidden');resultsPanel.classList.add('hidden');beginRoundToken(rs);
 const result=rs&&rs.results||{};
 const winningCells=new Set(Array.isArray(result.winningCells)?result.winningCells.map(Number):[]);
 const board=Array.isArray(rs&&rs.board)?rs.board:(Array.isArray(result.board)?result.board:Array(42).fill(''));
 const renderBoard=(locked)=>{
   connect4Columns.innerHTML='';connect4Board.innerHTML='';
   for(let col=1;col<=7;col++){
     const b=document.createElement('button');b.className='secondary';b.textContent='▼';
     b.disabled=locked||!rs.isCurrent||(Array.isArray(rs.fullColumns)&&rs.fullColumns.includes(col));
     b.onclick=()=>runOnce('connect4-move',async()=>{
       const res=await FlecityBridge.call('partySubmitConnect4',{token:rs.token,column:col});
       if(!res.ok){status('四目ならべ: '+FlecityErrors.text(res.error),'error');await refresh();return;}
       renderRoom(res.room);
     });
     connect4Columns.appendChild(b);
   }
   board.forEach((mark,index)=>{
     const c=document.createElement('div');
     c.className='connect4-cell'+(winningCells.has(index+1)?' connect4-winning':'');
     c.textContent=mark==='R'?'●':(mark==='Y'?'○':'');
     connect4Board.appendChild(c);
   });
 };

 if(rs.complete){
   if(winningCells.size){
     renderBoard(true);
     connect4Status.textContent='WIN! 4つつながりました';
     connect4Meta.textContent=(result.winnerName?String(result.winnerName)+' · ':'')+'勝ち筋を確認中…';
     const token=String(rs.token||'');
     if(connect4CeremonyToken!==token){
       connect4CeremonyToken=token;
       connect4CeremonyUntil=performance.now()+2500;
       if(connect4CeremonyTimer)clearTimeout(connect4CeremonyTimer);
       connect4CeremonyTimer=setTimeout(()=>{
         connect4CeremonyTimer=null;
         const current=currentRoom&&currentRoom.roundState;
         if(current&&String(current.token||'')===token&&current.complete)renderResults(currentRoom);
       },2500);
     }else if(performance.now()>=connect4CeremonyUntil){
       renderResults(room);
     }
     return;
   }
   renderResults(room);return;
 }

 renderBoard(false);
 connect4Status.textContent=rs.isCurrent?'あなたの手番 · '+(rs.mark==='R'?'●':'○'):'相手の手番';
 connect4Meta.textContent='7×6 · 4つ並べる · '+Number(rs.moves||0)+'手';
}
function setupMajority(room){
 const rs=room.roundState,isMinority=rs.gameId==='minority';hideRoundGames();majorityPanel.classList.remove('hidden');resultsPanel.classList.add('hidden');beginRoundToken(rs);
 majorityGameLabel.textContent=isMinority?'MINORITY':'MAJORITY';
 majorityPrompt.textContent=rs.prompt||(isMinority?'MINORITY':'MAJORITY');majorityChoices.innerHTML='';
 if(rs.complete){renderResults(room);return;}
 if(rs.selfSubmitted){majorityChoices.innerHTML='<div class="status good">回答済み · '+submissionProgress(rs)+'<br>ほかの参加者を待っています。</div>';return;}
 const hint=document.createElement('div');hint.className='muted choice-hint';hint.textContent=isMinority?'少ない方になりそうな選択肢を選んでください。':'多い方になりそうな選択肢を選んでください。';majorityChoices.appendChild(hint);
 const options=Array.isArray(rs.options)?rs.options:['A','B'];
 ['A','B'].forEach((choice,i)=>{const b=document.createElement('button');b.className='secondary choice-button';b.textContent=options[i]||choice;b.onclick=()=>submitMajority(rs.gameId,rs.token,choice);majorityChoices.appendChild(b);});
}

function askMiniShogiPromotion(){
 return new Promise(resolve=>{
   if(miniShogiPromotionOverlay){miniShogiPromotionOverlay.remove();miniShogiPromotionOverlay=null;}
   const overlay=document.createElement('div');overlay.className='confirm-overlay shogi-promotion-overlay';
   const card=document.createElement('div');card.className='confirm-card shogi-promotion-card';
   const kicker=document.createElement('div');kicker.className='kicker';kicker.textContent='将棋';
   const title=document.createElement('h2');title.textContent='この駒を成りますか？';
   const note=document.createElement('p');note.className='muted';note.textContent='成る・成らないを選んでください。';
   const row=document.createElement('div');row.className='row';
   const stay=document.createElement('button');stay.className='secondary';stay.textContent='成らない';
   const promote=document.createElement('button');promote.textContent='成る';
   const finish=value=>{if(miniShogiPromotionOverlay===overlay)miniShogiPromotionOverlay=null;overlay.remove();resolve(value);};
   stay.onclick=()=>finish(false);promote.onclick=()=>finish(true);
   row.appendChild(stay);row.appendChild(promote);
   card.appendChild(kicker);card.appendChild(title);card.appendChild(note);card.appendChild(row);overlay.appendChild(card);
   document.body.appendChild(overlay);miniShogiPromotionOverlay=overlay;
 });
}

function setupMiniShogi(room){
 const rs=room.roundState;hideRoundGames();miniShogiPanel.classList.remove('hidden');resultsPanel.classList.add('hidden');beginRoundToken(rs);
 if(rs.complete){miniShogiSelected=0;miniShogiDropKind='';renderResults(room);return;}
 const board=Array.isArray(rs.board)?rs.board:Array(81).fill('');
 const legal=Array.isArray(rs.legalMoves)?rs.legalMoves:[];
 const pieceText={K:'王',G:'金',S:'銀',N:'桂',L:'香',B:'角',R:'飛',P:'歩'};
 const promotedText={R:'龍',B:'馬',S:'全',N:'圭',L:'杏',P:'と'};
 const selectedMoves=miniShogiDropKind
   ?legal.filter(m=>m.type==='drop'&&String(m.kind||'')===miniShogiDropKind)
   :legal.filter(m=>m.type!=='drop'&&Number(m.from)===Number(miniShogiSelected));
 const destinationSet=new Set(selectedMoves.map(m=>Number(m.to)));

 const hands=rs.hands&&typeof rs.hands==='object'?rs.hands:{B:{},W:{}};
 const ownSide=String(rs.side||'B'),oppSide=ownSide==='B'?'W':'B';
 const renderHands=(target,side,label,interactive)=>{
   target.innerHTML='';
   const title=document.createElement('span');title.className='mini-shogi-hand-label';title.textContent=label;target.appendChild(title);
   ['R','B','G','S','N','L','P'].forEach(kind=>{
     const count=Math.max(0,Number(hands[side]&&hands[side][kind]||0));
     if(count<1)return;
     const btn=document.createElement('button');btn.className='mini-shogi-hand-piece'+(miniShogiDropKind===kind?' selected':'');
     btn.textContent=(pieceText[kind]||kind)+(count>1?'×'+count:'');
     btn.disabled=!interactive||!rs.isCurrent;
     btn.onclick=()=>{miniShogiSelected=0;miniShogiDropKind=miniShogiDropKind===kind?'':kind;setupMiniShogi(room);};
     target.appendChild(btn);
   });
   if(target.children.length===1){
     const empty=document.createElement('span');empty.className='muted mini-shogi-hand-empty';empty.textContent='なし';target.appendChild(empty);
   }
 };
 renderHands(miniShogiHandsTop,oppSide,'相手の持ち駒',false);
 renderHands(miniShogiHandsBottom,ownSide,'自分の持ち駒',true);

 miniShogiBoard.innerHTML='';
 board.forEach((piece,index)=>{
   const cell=index+1;
   const button=document.createElement('button');
   button.className='mini-shogi-cell'+(cell===miniShogiSelected?' selected':'')+(destinationSet.has(cell)?' legal':'');
   const text=String(piece||'');
   const side=text.slice(0,1),kind=text.slice(1,2),promoted=text.slice(2,3)==='+';
   if(kind){
     const pieceEl=document.createElement('span');
     pieceEl.className='mini-shogi-piece '+(side==='B'?'black':'white')+(promoted?' promoted':'');
     pieceEl.textContent=promoted?(promotedText[kind]||pieceText[kind]||kind):(pieceText[kind]||kind);
     button.appendChild(pieceEl);
   }else if(destinationSet.has(cell)){
     const guide=document.createElement('span');guide.className='mini-shogi-guide';button.appendChild(guide);
   }
   button.disabled=!rs.isCurrent;
   button.onclick=async()=>{
     if(!rs.isCurrent)return;
     if(destinationSet.has(cell)){
       const choices=selectedMoves.filter(m=>Number(m.to)===cell);
       let payload;
       if(miniShogiDropKind){
         payload={token:rs.token,type:'drop',kind:miniShogiDropKind,to:cell};
       }else{
         const canPromote=choices.some(m=>m.promote===true);
         const canStay=choices.some(m=>m.promote!==true);
         let promote=canPromote&&!canStay;
         if(canPromote&&canStay)promote=await askMiniShogiPromotion();
         payload={token:rs.token,type:'move',from:miniShogiSelected,to:cell,promote};
       }
       miniShogiSelected=0;miniShogiDropKind='';
       miniShogiBoard.querySelectorAll('button').forEach(b=>b.disabled=true);
       const res=await FlecityBridge.call('partySubmitMiniShogi',payload);
       if(!res.ok){status('将棋の操作に失敗: '+FlecityErrors.text(res.error),'error');await refresh();return;}
       renderRoom(res.room);return;
     }
     if(side===ownSide){
       miniShogiDropKind='';
       miniShogiSelected=cell===miniShogiSelected?0:cell;
       setupMiniShogi(room);
     }else{
       miniShogiSelected=0;miniShogiDropKind='';setupMiniShogi(room);
     }
   };
   miniShogiBoard.appendChild(button);
 });
 const current=room.players.find(p=>p.memberId===rs.currentMemberId);
 const checkText=rs.inCheck?' · 王手':'';
 miniShogiStatus.textContent=(rs.isCurrent?'あなたの手番':(rs.currentMemberId==='AI'?'AIの手番':(current?current.name+' の手番':'相手の手番')))+checkText;
 miniShogiMeta.textContent='あなたは '+(ownSide==='B'?'先手':'後手')+' · '+Number(rs.moves||0)+'手 · 持ち駒は盤下から打てます';
}

function deductionPhaseLoop(token){
 if(appSuspended||!currentRoom||!currentRoom.roundState||currentRoom.roundState.token!==token)return;
 const rs=currentRoom.roundState;
 if(rs.complete)return;
 const unlock=Number(rs.voteUnlockTick);
 if(!Number.isFinite(unlock))return;
 const remaining=unlock-estimatedServerTick();
 const locked=remaining>0;
 deductionChoices.querySelectorAll('button').forEach(b=>b.disabled=locked);
 const phaseText=locked?'会話タイム · 投票まで '+Math.ceil(remaining/1000)+'秒':'投票タイム · 怪しい人を選んでください';
 const phase=deductionChoices.querySelector('.deduction-phase');
 if(phase){phase.textContent=phaseText;phase.className='status compact-status '+(locked?'':'good');}
 if(locked)deductionPhaseRaf=requestAnimationFrame(()=>deductionPhaseLoop(token));
}
function setupDeduction(room){
 const rs=room.roundState;hideRoundGames();deductionPanel.classList.remove('hidden');resultsPanel.classList.add('hidden');beginRoundToken(rs);deductionChoices.innerHTML='';
 if(rs.gameId==='word_wolf'){
   deductionGame.textContent='ワードウルフ';deductionSecret.textContent='あなたのお題: '+String(rs.secretTopic||'---');
   deductionHint.textContent='まず全員でお題について話し、投票タイムになったら少数派だと思う人を選びます。';
 }else{
   deductionGame.textContent='ウソつき探し';deductionSecret.textContent='質問: '+String(rs.prompt||'---');
   deductionHint.textContent=rs.role==='LIAR'?'あなたはウソつき役です。質問には自然な嘘で答え、見破られないようにしてください。':'あなたは正直者です。質問には正直に答え、ウソつき役を探してください。';
 }
 if(rs.complete){renderResults(room);return;}
 if(rs.selfSubmitted){deductionChoices.innerHTML='<div class="status good">投票済み · '+submissionProgress(rs)+'<br>ほかの参加者を待っています。</div>';return;}
 const phase=document.createElement('div');phase.className='status compact-status deduction-phase';deductionChoices.appendChild(phase);
 room.players.filter(p=>!p.disconnected&&p.memberId!==room.selfMemberId).forEach(p=>{
   const b=document.createElement('button');b.className='secondary';b.textContent=p.name;b.onclick=()=>submitDeduction(rs.gameId,rs.token,p.memberId);deductionChoices.appendChild(b);
 });
 cancelAnimationFrame(deductionPhaseRaf);deductionPhaseRaf=null;
 deductionPhaseLoop(rs.token);
}
function drawableStroke(points){
 if(!Array.isArray(points)||points.length<1)return [];
 if(points.length>1)return points;
 const p=points[0],dx=p.x<=.998?.002:-.002;
 return [p,{x:Math.max(0,Math.min(1,p.x+dx)),y:p.y}];
}
function paintCanvas(ctx,canvas,strokes,temp){
 ctx.fillStyle='#f7f7f7';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.lineWidth=4;ctx.lineCap='round';ctx.lineJoin='round';ctx.strokeStyle='#111';
 const drawOne=points=>{if(!Array.isArray(points)||points.length<2)return;ctx.beginPath();ctx.moveTo(points[0].x*canvas.width,points[0].y*canvas.height);for(let i=1;i<points.length;i++)ctx.lineTo(points[i].x*canvas.width,points[i].y*canvas.height);ctx.stroke();};
 (strokes||[]).forEach(drawOne);if(temp&&temp.length>1)drawOne(temp);
}
function paintDrawStroke(points){
 if(!Array.isArray(points)||points.length<2)return;drawCtx.beginPath();drawCtx.lineWidth=4;drawCtx.lineCap='round';drawCtx.lineJoin='round';drawCtx.strokeStyle='#111';
 drawCtx.moveTo(points[0].x*drawCanvas.width,points[0].y*drawCanvas.height);
 for(let i=1;i<points.length;i++)drawCtx.lineTo(points[i].x*drawCanvas.width,points[i].y*drawCanvas.height);
 drawCtx.stroke();
}
function renderDrawCanvas(strokes,temp){
 paintCanvas(drawCtx,drawCanvas,strokes,temp);
}
function setupDraw(room){
 const rs=room.roundState;hideRoundGames();drawPanel.classList.remove('hidden');resultsPanel.classList.add('hidden');beginRoundToken(rs);
 if(rs.complete){renderResults(room);return;}
 drawIsDrawer=rs.isDrawer===true;
 const drawer=room.players.find(p=>p.memberId===rs.drawerMemberId);
 drawPrompt.textContent=drawIsDrawer?'お題: '+String(rs.prompt||'---'):(drawer?drawer.name+' が描いています':'描画中…');
 drawProgress.textContent='正解: '+Number(rs.guessedCount||0)+' / '+Math.max(0,room.connectedCount-1);
 drawDrawerControls.classList.toggle('hidden',!drawIsDrawer);
 drawGuessControls.classList.toggle('hidden',drawIsDrawer||rs.selfGuessed===true);
 if(rs.selfGuessed&&!drawIsDrawer)drawProgress.textContent='正解しました。ほかの参加者を待っています。';
 if(!drawStroke)renderDrawCanvas(rs.strokes||[]);
}
function setupTelephone(room){
 const rs=room.roundState;hideRoundGames();telephonePanel.classList.remove('hidden');resultsPanel.classList.add('hidden');
 const changed=beginRoundToken(rs);if(changed){telephoneStroke=null;telephoneStrokes=[];telephoneText.value='';}
 if(rs.complete){renderResults(room);return;}
 const current=room.players.find(p=>p.memberId===rs.currentMemberId);
 telephoneStatus.textContent='ステップ '+Number(rs.step||0)+' / '+Number(rs.totalSteps||0);
 telephoneHint.textContent=rs.isCurrent?'あなたの番です。':(current?current.name+' の入力を待っています。':'次のプレイヤーを待っています。');
 telephoneTextPrompt.classList.add('hidden');telephoneCanvas.classList.add('hidden');telephoneDrawControls.classList.add('hidden');telephoneTextControls.classList.add('hidden');
 if(!rs.isCurrent)return;
 if(rs.mode==='draw'){
   telephoneTextPrompt.textContent='これを絵で伝えてください: '+String(rs.promptText||'---');telephoneTextPrompt.classList.remove('hidden');
   telephoneCanvas.classList.remove('hidden');telephoneDrawControls.classList.remove('hidden');paintCanvas(telephoneCtx,telephoneCanvas,telephoneStrokes,telephoneStroke);
 }else{
   telephoneCanvas.classList.remove('hidden');telephoneTextControls.classList.remove('hidden');
   paintCanvas(telephoneCtx,telephoneCanvas,rs.promptStrokes||[]);
   telephoneHint.textContent='この絵が何を表しているか文章で入力してください。';
 }
}
function memorySymbol(value){return ({A:'●',B:'▲',C:'■',D:'★'})[value]||'?';}
function renderMemoryLocal(){memoryChainInputEl.textContent='入力: '+(memoryChainLocal.length?memoryChainLocal.map(memorySymbol).join(' '):'---');}
function setupMemoryChain(room){
 const rs=room.roundState;hideRoundGames();memoryChainPanel.classList.remove('hidden');resultsPanel.classList.add('hidden');beginRoundToken(rs);
 if(rs.complete){renderResults(room);return;}
 const key=String(rs.token)+':'+String(rs.stage);
 if(memoryChainKey!==key){memoryChainKey=key;memoryChainLocal=[];}
 memoryChainTitle.textContent='STAGE '+Number(rs.stage||1)+' / '+Number(rs.maxStages||8)+' · 生存 '+Number(rs.aliveCount||0)+'人';
 memoryChainControls.classList.add('hidden');
 if(rs.selfEliminated){
   memoryChainSequence.textContent='OUT';
   memoryChainHint.textContent='脱落しました。残っているプレイヤーを見守れます。';
   return;
 }
 if(rs.phase==='memorize'){
   memoryChainSequence.textContent=(rs.sequence||[]).map(memorySymbol).join(' ');
   memoryChainHint.textContent='順番を覚えてください。入力フェーズでは列が消えます。';
   memoryChainLocal=[];
 }else if(rs.selfSubmitted){
   memoryChainSequence.textContent='✓';
   memoryChainHint.textContent='入力済み · '+submissionProgress(rs)+' · ほかの参加者を待っています。';
 }else{
   memoryChainSequence.textContent='？ × '+Number(rs.sequenceLength||0);
   memoryChainHint.textContent='覚えた順番を入力してください · '+submissionProgress(rs);
   memoryChainControls.classList.remove('hidden');renderMemoryLocal();
 }
}
function setupBomb(room){
 const rs=room.roundState;hideRoundGames();bombPanel.classList.remove('hidden');resultsPanel.classList.add('hidden');beginRoundToken(rs);
 if(rs.complete){renderResults(room);return;}
 const current=room.players.find(p=>p.memberId===rs.currentMemberId);
 bombPrompt.textContent=String(rs.prompt||'---');
 bombHolder.textContent=rs.isCurrent?'あなたの番！':(current?current.name:'次の人');
 bombHint.textContent=rs.isCurrent?'VCでお題に答えたらボタンで次の人へ渡してください。爆発時刻は見えません。':'爆弾を持っている人の回答を待っています · パス '+Number(rs.passes||0)+'回';
 bombPass.classList.toggle('hidden',!rs.isCurrent);
 bombPass.disabled=!rs.isCurrent;
}
function setupFakeAnswer(room){
 const rs=room.roundState;hideRoundGames();fakeAnswerPanel.classList.remove('hidden');resultsPanel.classList.add('hidden');beginRoundToken(rs);
 fakeAnswerQuestion.textContent=String(rs.question||'---');fakeAnswerSubmitControls.classList.add('hidden');fakeAnswerChoices.innerHTML='';
 if(rs.complete){renderResults(room);return;}
 if(rs.phase==='submit'){
   if(rs.selfSubmitted){
     fakeAnswerHint.textContent='偽回答送信済み · '+submissionProgress(rs)+' · ほかの参加者を待っています。';
   }else{
     fakeAnswerHint.textContent='正解に見えそうな偽回答を1つ作ってください。';
     fakeAnswerSubmitControls.classList.remove('hidden');
   }
 }else{
   if(rs.selfSubmitted){
     fakeAnswerHint.textContent='投票済み · '+submissionProgress(rs)+' · 結果を待っています。';
   }else{
     fakeAnswerHint.textContent='本当の正解だと思うものを選んでください。自分の偽回答には投票できません。';
     (rs.options||[]).forEach(option=>{
       const b=document.createElement('button');b.className='secondary choice-button';b.textContent=String(option.text||'');
       b.disabled=option.own===true;b.onclick=()=>submitFakeVote(rs.token,option.id);fakeAnswerChoices.appendChild(b);
     });
   }
 }
}
function setupNgWord(room){
 const rs=room.roundState;hideRoundGames();ngWordPanel.classList.remove('hidden');resultsPanel.classList.add('hidden');beginRoundToken(rs);
 ngWordClueControls.classList.add('hidden');ngWordGuessControls.classList.add('hidden');ngWordForbidden.classList.add('hidden');
 if(rs.complete){renderResults(room);return;}
 const explainer=room.players.find(p=>p.memberId===rs.explainerMemberId);
 if(rs.phase==='clue'){
   if(rs.isExplainer){
     ngWordTitle.textContent='お題: '+String(rs.targetWord||'---');
     ngWordHint.textContent='下のNGワードを使わずに、答えそのものも言わずに説明してください。';
     ngWordForbidden.textContent='NG: '+(Array.isArray(rs.forbiddenWords)?rs.forbiddenWords.join(' / '):'---');
     ngWordForbidden.classList.remove('hidden');ngWordClueControls.classList.remove('hidden');
   }else{
     ngWordTitle.textContent=(explainer?explainer.name:'説明役')+' がヒントを考えています';
     ngWordHint.textContent='お題とNGワードは説明役だけに表示されています。';
   }
 }else{
   ngWordTitle.textContent='ヒント: '+String(rs.clue||'---');
   if(rs.isExplainer){
     ngWordHint.textContent='回答を待っています · '+submissionProgress(rs);
   }else if(rs.selfSubmitted){
     ngWordHint.textContent='回答済み · '+submissionProgress(rs)+' · ほかの参加者を待っています。';
   }else{
     ngWordHint.textContent='ヒントからお題を当ててください · '+submissionProgress(rs);
     ngWordGuessControls.classList.remove('hidden');
   }
 }
}
function renderRoom(room,timing){
 if(appSuspended||!room)return false;
 const incomingRevision=Number(room.revision);
 if(currentRoom&&currentRoom.code===room.code&&Number.isFinite(incomingRevision)&&incomingRevision<lastRoomRevision)return false;
 if(Number.isFinite(incomingRevision))lastRoomRevision=Math.max(lastRoomRevision,incomingRevision);
 currentRoom=room;ready=room.selfReady===true;roomPushEnabled=true;
 if(Number.isFinite(Number(room.serverTick))){
   if(timing&&Number.isFinite(timing.started)&&Number.isFinite(timing.received)){
     const midpoint=(timing.started+timing.received)/2;
     serverOffsetMs=Number(room.serverTick)-midpoint;
     serverOffsetReady=true;
   }else if(!serverOffsetReady){
     serverOffsetMs=Number(room.serverTick)-performance.now();
     serverOffsetReady=true;
   }
 }
 entryEl.classList.add('hidden');roomEl.classList.remove('hidden');roomCodeEl.textContent=room.code;renderPlayers(room);
 if(room.state==='lobby'){
   activeRoundToken=null;resetRoundRuntime();lobbyPanel.classList.remove('hidden');roundPanel.classList.add('hidden');
   gameEl.value=room.selectedGame||'code_break';gameEl.disabled=!room.isHost;renderGameInfo(gameEl.value);
   const mmOptions=room.mastermindOptions||{aiDifficulty:'normal',allowDuplicates:true,turnLimit:true,firstTurn:'random'};
   mastermindLobbyOptions.classList.toggle('hidden',room.selectedGame!=='code_break');
   mastermindAiDifficulty.value=String(mmOptions.aiDifficulty||'normal');
   mastermindDuplicates.value=mmOptions.allowDuplicates===false?'no':'yes';
   mastermindTurnLimit.value=mmOptions.turnLimit===false?'no':'yes';
   mastermindFirstTurn.value=String(mmOptions.firstTurn||'random');
   mastermindAiDifficulty.disabled=!room.isHost;
   mastermindDuplicates.disabled=!room.isHost;
   mastermindTurnLimit.disabled=!room.isHost;
   mastermindFirstTurn.disabled=!room.isHost;
   mastermindOptionsNote.textContent=(Number(room.connectedCount)||0)<=1?'AI強さは1人プレイ時に使用します。':'2人対戦ではAI強さは使用しません。';
   const shogiOptions=room.shogiOptions||{aiDifficulty:'hard'};
   shogiLobbyOptions.classList.toggle('hidden',room.selectedGame!=='mini_shogi');
   shogiAiDifficulty.value=String(shogiOptions.aiDifficulty||'hard');
   shogiAiDifficulty.disabled=!room.isHost;
   shogiOptionsNote.textContent=(Number(room.connectedCount)||0)<=1?'1人プレイ時のAI強さを選べます。':'2人対戦ではAI強さは使用しません。';
   const readiness=startReadiness(room);
   startBtn.disabled=!readiness.ok;startBtn.textContent=readiness.ok?'ゲーム開始':readiness.text;
   readyBtn.disabled=false;readyBtn.textContent=ready?'準備解除':'準備OK';status('ロビー準備完了。','good');
 }else{
   lobbyPanel.classList.add('hidden');roundPanel.classList.remove('hidden');
   const rs=room.roundState;
   lobbyBtn.classList.toggle('hidden',!room.isHost||!(rs&&rs.complete));const activeGame=selectedGameConfig(room);status('ラウンド '+room.round+' / '+String(activeGame&&activeGame.name||room.selectedGame),'good');
   startDeadlineLoop(rs);
   if(rs&&rs.gameId==='code_break')setupCodeBreak(room);
   else if(rs&&rs.gameId==='reversi')setupReversi(room);
   else if(rs&&rs.gameId==='reaction')setupReaction(room);
   else if(rs&&rs.gameId==='stop_battle')setupStopBattle(room);
   else if(rs&&rs.gameId==='vote')setupVote(room);
   else if(rs&&rs.gameId==='gomoku')setupGomoku(room);
   else if(rs&&rs.gameId==='connect4')setupConnect4(room);
   else if(rs&&(rs.gameId==='majority'||rs.gameId==='minority'))setupMajority(room);
   else if(rs&&rs.gameId==='mini_shogi')setupMiniShogi(room);
   else if(rs&&rs.gameId==='tic_tac')setupTicTac(room);
   else if(rs&&(rs.gameId==='word_wolf'||rs.gameId==='liar'))setupDeduction(room);
   else if(rs&&rs.gameId==='draw')setupDraw(room);
   else if(rs&&rs.gameId==='telephone')setupTelephone(room);
   else if(rs&&rs.gameId==='ng_word')setupNgWord(room);
   else if(rs&&rs.gameId==='fake_answer')setupFakeAnswer(room);
   else if(rs&&rs.gameId==='bomb')setupBomb(room);
   else if(rs&&rs.gameId==='memory_chain')setupMemoryChain(room);
   else if(rs&&rs.gameId==='fall_battle'){hideRoundGames();if(globalThis.PartyFallBattle)globalThis.PartyFallBattle.render(room);}
 }
 return true;
}
async function refresh(){
 if(appSuspended||!currentRoom)return;
 if(refreshInFlight){refreshQueued=true;return;}
 const epoch=lifecycleEpoch;
 refreshInFlight=true;
 try{
   const started=performance.now();
   const res=await FlecityBridge.call('partyGetRoom',{});
   const received=performance.now();
   if(appSuspended||epoch!==lifecycleEpoch)return;
   if(!res.ok){
     if(res.error==='NOT_IN_ROOM')showEntry();
     else status('ルーム更新失敗: '+FlecityErrors.text(res.error),'error');
     return;
   }
   renderRoom(res.room,{started,received});
 }finally{
   refreshInFlight=false;
   if(refreshQueued){refreshQueued=false;setTimeout(refresh,0);}
 }
}
function beginPolling(){if(poll)clearInterval(poll);if(appSuspended)return;poll=setInterval(()=>{if(!appSuspended)refresh();},10000);}
async function loadPartyConfig(epoch=lifecycleEpoch){
 const res=await FlecityBridge.call('partyGetConfig',{});
 if(appSuspended||epoch!==lifecycleEpoch||!res.ok||!res.config)return false;
 const length=Math.max(3,Math.min(6,Number(res.config.roomCodeLength)||4));
 partyConfig={...partyConfig,...res.config,roomCodeLength:length};
 renderPartyPlus();
 codeEl.maxLength=length;
 codeEl.placeholder=length+'桁のルームコード';

 const games=Array.isArray(res.config.games)?res.config.games:[];
 if(games.length){
   const current=gameEl.value;
   gameEl.innerHTML='';
   games.forEach(game=>{
     const option=document.createElement('option');
     option.value=game.id;
     const min=Number(game.minPlayers)||2,max=Number(game.maxPlayers)||10;
     option.textContent=(game.premium?'★ ':'')+game.name+' · '+(min===max?min+'人':min+'〜'+max+'人');
     option.title=game.description||'';
     gameEl.appendChild(option);
   });
   if([...gameEl.options].some(o=>o.value===current))gameEl.value=current;
   renderGameInfo(gameEl.value);
 }
 return true;
}
function handlePartyMessage(message){
 if(!message||typeof message!=='object')return;
 if(message.type==='partySuspend'){suspendPartyUi();return;}
 if(message.type==='partyResume'){resumePartyUi();return;}
 if(appSuspended)return;
 if(message.type==='partyUpdate'&&message.room){if(roomPushEnabled)renderRoom(message.room);return;}
 if(message.type==='partyDrawStroke'&&currentRoom&&currentRoom.roundState&&currentRoom.roundState.gameId==='draw'&&currentRoom.roundState.token===message.token){
   const revision=Number(message.revision);
   if(Number.isFinite(revision)&&revision<=lastRoomRevision)return;
   if(Number.isFinite(revision)){lastRoomRevision=revision;currentRoom.revision=revision;}
   const points=Array.isArray(message.points)?message.points:null;
   if(points){
     currentRoom.roundState.strokes=currentRoom.roundState.strokes||[];
     currentRoom.roundState.strokes.push(points);
     if(!drawStroke)renderDrawCanvas(currentRoom.roundState.strokes);
   }
   return;
 }
 if(message.type==='partyDrawClear'&&currentRoom&&currentRoom.roundState&&currentRoom.roundState.gameId==='draw'&&currentRoom.roundState.token===message.token){
   const revision=Number(message.revision);
   if(Number.isFinite(revision)&&revision<=lastRoomRevision)return;
   if(Number.isFinite(revision)){lastRoomRevision=revision;currentRoom.revision=revision;}
   currentRoom.roundState.strokes=[];
   if(!drawStroke)renderDrawCanvas([]);
   return;
 }
 if(message.type==='partyInvalidate')refresh();
}

let phonePushRegistered=false;
window.addEventListener('message',event=>{
 if(!phonePushRegistered)handlePartyMessage(event.data);
});

function registerPhonePushChannel(){
 if(phonePushRegistered||typeof globalThis.onNuiEvent!=='function')return;
 const types=['partyUpdate','partyDrawStroke','partyDrawClear','partyInvalidate','partySuspend','partyResume'];
 try{
   types.forEach(type=>{
     globalThis.onNuiEvent(type,data=>{
       if(data&&typeof data==='object'&&data.type)handlePartyMessage(data);
       else handlePartyMessage({type,...(data&&typeof data==='object'?data:{})});
     });
   });
   phonePushRegistered=true;
 }catch(_){
   phonePushRegistered=false;
 }
}
registerPhonePushChannel();

createBtn.onclick=()=>runOnce('create',async()=>{const started=performance.now();const res=await FlecityBridge.call('partyCreateRoom',{});const received=performance.now();if(!res.ok){status('ルーム作成失敗: '+FlecityErrors.text(res.error),'error');return;}renderRoom(res.room,{started,received});beginPolling();});
joinBtn.onclick=()=>runOnce('join',async()=>{const code=codeEl.value.replace(/\D/g,'').slice(0,partyConfig.roomCodeLength);const started=performance.now();const res=await FlecityBridge.call('partyJoinRoom',{code});const received=performance.now();if(!res.ok){status('参加失敗: '+FlecityErrors.text(res.error),'error');return;}renderRoom(res.room,{started,received});beginPolling();});
readyBtn.onclick=()=>runOnce('ready',async()=>{ready=!ready;const res=await FlecityBridge.call('partySetReady',{ready});if(!res.ok){ready=!ready;status('準備状態の変更失敗: '+FlecityErrors.text(res.error),'error');return;}renderRoom(res.room);});
gameEl.onchange=()=>runOnce('select-game',async()=>{renderGameInfo(gameEl.value);mastermindLobbyOptions.classList.toggle('hidden',gameEl.value!=='code_break');shogiLobbyOptions.classList.toggle('hidden',gameEl.value!=='mini_shogi');const res=await FlecityBridge.call('partySelectGame',{gameId:gameEl.value});if(!res.ok){status('ゲーム変更失敗: '+FlecityErrors.text(res.error),'error');await refresh();return;}renderRoom(res.room);});
async function saveMastermindOptions(){
 if(!currentRoom||!currentRoom.isHost||currentRoom.state!=='lobby')return;
 const res=await FlecityBridge.call('partySetMastermindOptions',{aiDifficulty:mastermindAiDifficulty.value,allowDuplicates:mastermindDuplicates.value!=='no',turnLimit:mastermindTurnLimit.value!=='no',firstTurn:mastermindFirstTurn.value});
 if(!res.ok){status('暗号解読の設定変更に失敗: '+FlecityErrors.text(res.error),'error');await refresh();return;}
 renderRoom(res.room);
}
mastermindAiDifficulty.onchange=()=>runOnce('mastermind-options',saveMastermindOptions);
mastermindDuplicates.onchange=()=>runOnce('mastermind-options',saveMastermindOptions);
mastermindTurnLimit.onchange=()=>runOnce('mastermind-options',saveMastermindOptions);
mastermindFirstTurn.onchange=()=>runOnce('mastermind-options',saveMastermindOptions);

async function saveShogiOptions(){
 if(!currentRoom||!currentRoom.isHost||currentRoom.state!=='lobby')return;
 const res=await FlecityBridge.call('partySetShogiOptions',{aiDifficulty:shogiAiDifficulty.value});
 if(!res.ok){status('将棋AIの設定変更に失敗: '+FlecityErrors.text(res.error),'error');await refresh();return;}
 renderRoom(res.room);
}
shogiAiDifficulty.onchange=()=>runOnce('shogi-options',saveShogiOptions);

startBtn.onclick=()=>runOnce('start',async()=>{const started=performance.now();const res=await FlecityBridge.call('partyStartRound',{});const received=performance.now();if(!res.ok){status('ゲーム開始失敗: '+FlecityErrors.text(res.error),'error');return;}renderRoom(res.room,{started,received});});
partyPlusSubscribe.onclick=()=>{
 const plus=partyConfig.plus||{};
 if(!plus.active){
   const now=performance.now();
   if(now>partyPlusConfirmUntil){
     partyPlusConfirmUntil=now+2500;
     partyPlusSubscribe.textContent='もう一度押して加入 · '+formatMoney(Number(plus.price)||50000);
     clearTimeout(partyPlusConfirmTimer);
     partyPlusConfirmTimer=setTimeout(()=>{if(performance.now()>=partyPlusConfirmUntil)resetPartyPlusConfirmation();},2600);
     return;
   }
 }
 resetPartyPlusConfirmation();
 runOnce('party-plus-subscribe',async()=>{
  partyPlusSubscribe.disabled=true;
  try{
    const res=await FlecityBridge.call('partySubscribePlus',{});
    if(!res.ok){status('PARTY+加入失敗: '+FlecityErrors.text(res.error),'error');return;}
    partyConfig.plus={...(partyConfig.plus||{}),...(res.status||{})};renderPartyPlus();status('PARTY+が有効になりました。','good');
    if(currentRoom)await refresh();
  }finally{partyPlusSubscribe.disabled=false;}
 });
};
partyPlusCancel.onclick=()=>runOnce('party-plus-cancel',async()=>{
 partyPlusCancel.disabled=true;
 try{
   const res=await FlecityBridge.call('partyCancelPlus',{});
   if(!res.ok){status('自動更新を停止できません: '+FlecityErrors.text(res.error),'error');return;}
   partyConfig.plus={...(partyConfig.plus||{}),...(res.status||{})};renderPartyPlus();status('期限まではPARTY+を利用できます。','good');
 }finally{partyPlusCancel.disabled=false;}
});

codeBreakPalette.onclick=(event)=>{const button=event.target.closest('button[data-code]');if(!button||button.disabled||codeBreakGuess.length>=4)return;const value=Number(button.dataset.code),rs=currentRoom&&currentRoom.roundState;if(rs&&rs.allowDuplicates===false&&codeBreakGuess.includes(value))return;codeBreakGuess.push(value);renderCodeBreakGuess();codeBreakSubmit.disabled=codeBreakGuess.length!==4;codeBreakBack.disabled=codeBreakGuess.length===0;};
codeBreakBack.onclick=()=>{if(codeBreakGuess.length){codeBreakGuess.pop();renderCodeBreakGuess();codeBreakSubmit.disabled=codeBreakGuess.length!==4;codeBreakBack.disabled=codeBreakGuess.length===0;[...codeBreakPalette.querySelectorAll('button')].forEach(b=>b.disabled=false);}};
codeBreakSubmit.onclick=()=>runOnce('code-break-guess',async()=>{const rs=currentRoom&&currentRoom.roundState;if(!rs||rs.gameId!=='code_break'||codeBreakGuess.length!==4)return;const guess=codeBreakGuess.slice();codeBreakSubmit.disabled=true;const res=await FlecityBridge.call('partySubmitCodeBreak',{token:rs.token,guess});if(!res.ok){status('CODE BREAK: '+FlecityErrors.text(res.error),'error');codeBreakSubmit.disabled=false;return;}codeBreakGuess=[];renderRoom(res.room);});
reactionTap.onclick=async()=>{
 if(!currentRoom||!currentRoom.roundState||reactionState==='submitted')return;
 const rs=currentRoom.roundState,revealTick=Number(rs.startedTick||0)+Number(rs.revealAfterMs||0),serverNow=estimatedServerTick();
 let payload={token:rs.token};
 if(serverNow<revealTick){payload.flying=true;reactionMessage.textContent='フライング!';}
 else{payload.flying=false;payload.reactionMs=Math.max(0,serverNow-revealTick);reactionMessage.textContent=payload.reactionMs.toFixed(3)+' ms';}
 reactionState='submitted';cancelAnimationFrame(reactionRaf);reactionTap.disabled=true;
 const res=await FlecityBridge.call('partySubmitReaction',payload);
 if(!res.ok){status('REACTION送信失敗: '+FlecityErrors.text(res.error),'error');reactionState='idle';await refresh();return;}renderRoom(res.room);
};
stopBattleButton.onclick=async()=>{
 if(!currentRoom||!currentRoom.roundState||stopBattleState!=='running')return;
 const rs=currentRoom.roundState,actionMs=Math.max(0,Math.round(estimatedServerTick()-Number(rs.motionStartTick||0)));
 stopBattleState='submitted';cancelAnimationFrame(stopBattleRaf);stopBattleButton.disabled=true;stopBattleMessage.textContent='入力済み';
 const res=await FlecityBridge.call('partySubmitStopBattle',{token:rs.token,actionMs});
 if(!res.ok){status('STOP!送信失敗: '+FlecityErrors.text(res.error),'error');stopBattleState='idle';await refresh();return;}renderRoom(res.room);
};
async function submitVote(token,targetMemberId){
 voteChoices.querySelectorAll('button').forEach(b=>b.disabled=true);
 const res=await FlecityBridge.call('partySubmitVote',{token,targetMemberId});
 if(!res.ok){status('投票失敗: '+FlecityErrors.text(res.error),'error');await refresh();return;}renderRoom(res.room);
}
async function submitMajority(gameId,token,choice){
 majorityChoices.querySelectorAll('button').forEach(b=>b.disabled=true);
 const isMinority=gameId==='minority';
 const action=isMinority?'partySubmitMinority':'partySubmitMajority';
 const res=await FlecityBridge.call(action,{token,choice});
 if(!res.ok){status((isMinority?'MINORITY':'MAJORITY')+'回答失敗: '+FlecityErrors.text(res.error),'error');await refresh();return;}renderRoom(res.room);
}

async function submitTicTac(token,cell){
 ticTacBoard.querySelectorAll('button').forEach(b=>b.disabled=true);
 const res=await FlecityBridge.call('partySubmitTicTac',{token,cell});
 if(!res.ok){status('TIC-TAC操作失敗: '+FlecityErrors.text(res.error),'error');await refresh();return;}
 renderRoom(res.room);
}
async function submitDeduction(gameId,token,targetMemberId){
 deductionChoices.querySelectorAll('button').forEach(b=>b.disabled=true);
 const action=gameId==='word_wolf'?'partySubmitWordWolfVote':'partySubmitLiarVote';
 const res=await FlecityBridge.call(action,{token,targetMemberId});
 if(!res.ok){status('投票失敗: '+FlecityErrors.text(res.error),'error');await refresh();return;}renderRoom(res.room);
}
function drawPointFromEvent(event){
 const rect=drawCanvas.getBoundingClientRect();
 return {x:Math.max(0,Math.min(1,(event.clientX-rect.left)/rect.width)),y:Math.max(0,Math.min(1,(event.clientY-rect.top)/rect.height))};
}
drawCanvas.onpointerdown=event=>{
 if(!drawIsDrawer||!currentRoom||!currentRoom.roundState||currentRoom.roundState.gameId!=='draw'||currentRoom.roundState.complete)return;
 drawStroke=[drawPointFromEvent(event)];drawCanvas.setPointerCapture(event.pointerId);
};
drawCanvas.onpointermove=event=>{
 if(!drawStroke||!drawIsDrawer)return;const p=drawPointFromEvent(event),last=drawStroke[drawStroke.length-1];
 if(Math.abs(p.x-last.x)+Math.abs(p.y-last.y)<0.006)return;
 if(drawStroke.length<48)drawStroke.push(p);
 renderDrawCanvas((currentRoom&&currentRoom.roundState&&currentRoom.roundState.strokes)||[],drawStroke);
};
drawCanvas.onpointerup=async event=>{
 if(!drawStroke)return;const points=drawStroke;drawStroke=null;
 try{drawCanvas.releasePointerCapture(event.pointerId);}catch(_){}
 const sendPoints=drawableStroke(points);
 if(sendPoints.length<2){renderDrawCanvas((currentRoom&&currentRoom.roundState&&currentRoom.roundState.strokes)||[]);return;}
 const rs=currentRoom&&currentRoom.roundState;if(!rs)return;
 const res=await FlecityBridge.call('partyAddDrawStroke',{token:rs.token,points:sendPoints});
 if(!res.ok){status('描画同期失敗: '+FlecityErrors.text(res.error),'error');await refresh();return;}renderRoom(res.room);
};
drawCanvas.onpointercancel=event=>{
 drawStroke=null;
 try{drawCanvas.releasePointerCapture(event.pointerId);}catch(_){}
 renderDrawCanvas((currentRoom&&currentRoom.roundState&&currentRoom.roundState.strokes)||[]);
};
drawClear.onclick=async()=>{
 const rs=currentRoom&&currentRoom.roundState;if(!rs)return;drawClear.disabled=true;
 const res=await FlecityBridge.call('partyClearDrawing',{token:rs.token});drawClear.disabled=false;
 if(!res.ok){status('消去失敗: '+FlecityErrors.text(res.error),'error');return;}renderRoom(res.room);
};
async function submitDrawGuess(){
 return runOnce('draw-guess',async()=>{
  const rs=currentRoom&&currentRoom.roundState,guess=drawGuess.value.trim();if(!rs||!guess)return;
  drawGuessSubmit.disabled=true;
  try{
   const res=await FlecityBridge.call('partySubmitDrawGuess',{token:rs.token,guess});
   if(!res.ok){status('回答送信失敗: '+FlecityErrors.text(res.error),'error');return;}
   if(res.correct){drawGuess.value='';status('正解！','good');}else status('違います。もう一度！','warn');
   renderRoom(res.room);
  }finally{drawGuessSubmit.disabled=false;}
 });
}
drawGuessSubmit.onclick=submitDrawGuess;
drawGuess.onkeydown=e=>{if(e.key==='Enter'&&!e.isComposing)submitDrawGuess();};
function telephonePoint(event){
 const rect=telephoneCanvas.getBoundingClientRect();
 return {x:Math.max(0,Math.min(1,(event.clientX-rect.left)/rect.width)),y:Math.max(0,Math.min(1,(event.clientY-rect.top)/rect.height))};
}
telephoneCanvas.onpointerdown=event=>{
 const rs=currentRoom&&currentRoom.roundState;if(!rs||rs.gameId!=='telephone'||!rs.isCurrent||rs.mode!=='draw'||rs.complete)return;
 telephoneStroke=[telephonePoint(event)];telephoneCanvas.setPointerCapture(event.pointerId);
};
telephoneCanvas.onpointermove=event=>{
 if(!telephoneStroke)return;const p=telephonePoint(event),last=telephoneStroke[telephoneStroke.length-1];
 if(Math.abs(p.x-last.x)+Math.abs(p.y-last.y)<0.006)return;if(telephoneStroke.length<48)telephoneStroke.push(p);
 paintCanvas(telephoneCtx,telephoneCanvas,telephoneStrokes,telephoneStroke);
};
telephoneCanvas.onpointerup=event=>{
 if(!telephoneStroke)return;const stroke=telephoneStroke;telephoneStroke=null;try{telephoneCanvas.releasePointerCapture(event.pointerId);}catch(_){}
 const stored=drawableStroke(stroke);if(stored.length>=2&&telephoneStrokes.length<80)telephoneStrokes.push(stored);paintCanvas(telephoneCtx,telephoneCanvas,telephoneStrokes);
};
telephoneCanvas.onpointercancel=event=>{
 telephoneStroke=null;
 try{telephoneCanvas.releasePointerCapture(event.pointerId);}catch(_){}
 paintCanvas(telephoneCtx,telephoneCanvas,telephoneStrokes);
};
telephoneClear.onclick=()=>{telephoneStroke=null;telephoneStrokes=[];paintCanvas(telephoneCtx,telephoneCanvas,[]);};
telephoneDrawSubmit.onclick=async()=>{
 const rs=currentRoom&&currentRoom.roundState;if(!rs||rs.gameId!=='telephone'||rs.mode!=='draw'||!rs.isCurrent)return;
 if(!telephoneStrokes.length){status('絵を描いてから送信してください。','warn');return;}
 telephoneDrawSubmit.disabled=true;const res=await FlecityBridge.call('partySubmitTelephoneDrawing',{token:rs.token,strokes:telephoneStrokes});telephoneDrawSubmit.disabled=false;
 if(!res.ok){status('絵の送信失敗: '+FlecityErrors.text(res.error),'error');return;}telephoneStrokes=[];telephoneStroke=null;renderRoom(res.room);
};
memoryChainButtons.querySelectorAll('[data-memory]').forEach(button=>{
 button.onclick=()=>{
   const rs=currentRoom&&currentRoom.roundState;if(!rs||rs.gameId!=='memory_chain'||rs.phase!=='input'||rs.selfSubmitted||rs.selfEliminated)return;
   const limit=Math.max(1,Number(rs.sequenceLength)||1);
   if(memoryChainLocal.length<limit)memoryChainLocal.push(button.dataset.memory);
   renderMemoryLocal();
 };
});
memoryChainReset.onclick=()=>{memoryChainLocal=[];renderMemoryLocal();};
memoryChainSubmit.onclick=()=>runOnce('memory-chain-submit',async()=>{
 const rs=currentRoom&&currentRoom.roundState;if(!rs||rs.gameId!=='memory_chain'||rs.phase!=='input'||rs.selfSubmitted||rs.selfEliminated)return;
 if(memoryChainLocal.length!==Number(rs.sequenceLength||0)){status('記号を最後まで入力してください。','warn');return;}
 memoryChainSubmit.disabled=true;
 try{
   const res=await FlecityBridge.call('partySubmitMemoryChain',{token:rs.token,answer:memoryChainLocal.join('')});
   if(!res.ok){status('記憶チェインの送信に失敗: '+FlecityErrors.text(res.error),'error');return;}
   renderRoom(res.room);
 }finally{memoryChainSubmit.disabled=false;}
});

bombPass.onclick=()=>runOnce('bomb-pass',async()=>{
 const rs=currentRoom&&currentRoom.roundState;if(!rs||rs.gameId!=='bomb'||!rs.isCurrent)return;
 bombPass.disabled=true;
 const res=await FlecityBridge.call('partySubmitBombPass',{token:rs.token});
 if(!res.ok){status('爆弾リレーの送信に失敗: '+FlecityErrors.text(res.error),'error');await refresh();return;}
 renderRoom(res.room);
});

async function submitFakeAnswer(){
 return runOnce('fake-answer-submit',async()=>{
  const rs=currentRoom&&currentRoom.roundState,value=fakeAnswerInput.value.trim();if(!rs||rs.gameId!=='fake_answer'||rs.phase!=='submit'||!value)return;
  fakeAnswerSubmit.disabled=true;
  try{
   const res=await FlecityBridge.call('partySubmitFakeAnswer',{token:rs.token,answer:value});
   if(!res.ok){status('偽回答送信失敗: '+FlecityErrors.text(res.error),'error');return;}
   fakeAnswerInput.value='';renderRoom(res.room);
  }finally{fakeAnswerSubmit.disabled=false;}
 });
}
async function submitFakeVote(token,optionId){
 return runOnce('fake-answer-vote',async()=>{
  fakeAnswerChoices.querySelectorAll('button').forEach(b=>b.disabled=true);
  const res=await FlecityBridge.call('partySubmitFakeVote',{token,optionId});
  if(!res.ok){status('投票失敗: '+FlecityErrors.text(res.error),'error');await refresh();return;}
  renderRoom(res.room);
 });
}
fakeAnswerSubmit.onclick=submitFakeAnswer;
fakeAnswerInput.onkeydown=e=>{if(e.key==='Enter'&&!e.isComposing)submitFakeAnswer();};

async function submitNgWordClue(){
 return runOnce('ng-word-clue',async()=>{
  const rs=currentRoom&&currentRoom.roundState,value=ngWordClue.value.trim();if(!rs||rs.gameId!=='ng_word'||rs.phase!=='clue'||!rs.isExplainer||!value)return;
  ngWordClueSubmit.disabled=true;
  try{
   const res=await FlecityBridge.call('partySubmitNgWordClue',{token:rs.token,clue:value});
   if(!res.ok){status('ヒント送信失敗: '+FlecityErrors.text(res.error),'error');return;}
   ngWordClue.value='';renderRoom(res.room);
  }finally{ngWordClueSubmit.disabled=false;}
 });
}
async function submitNgWordGuess(){
 return runOnce('ng-word-guess',async()=>{
  const rs=currentRoom&&currentRoom.roundState,value=ngWordGuess.value.trim();if(!rs||rs.gameId!=='ng_word'||rs.phase!=='guess'||rs.isExplainer||!value)return;
  ngWordGuessSubmit.disabled=true;
  try{
   const res=await FlecityBridge.call('partySubmitNgWordGuess',{token:rs.token,guess:value});
   if(!res.ok){status('回答送信失敗: '+FlecityErrors.text(res.error),'error');return;}
   ngWordGuess.value='';if(res.correct)status('正解！','good');renderRoom(res.room);
  }finally{ngWordGuessSubmit.disabled=false;}
 });
}
ngWordClueSubmit.onclick=submitNgWordClue;
ngWordGuessSubmit.onclick=submitNgWordGuess;
ngWordClue.onkeydown=e=>{if(e.key==='Enter'&&!e.isComposing)submitNgWordClue();};
ngWordGuess.onkeydown=e=>{if(e.key==='Enter'&&!e.isComposing)submitNgWordGuess();};

async function submitTelephoneText(){
 return runOnce('telephone-text',async()=>{
  const rs=currentRoom&&currentRoom.roundState,value=telephoneText.value.trim();if(!rs||rs.gameId!=='telephone'||rs.mode!=='text'||!rs.isCurrent||!value)return;
  telephoneTextSubmit.disabled=true;
  try{
   const res=await FlecityBridge.call('partySubmitTelephoneText',{token:rs.token,text:value});
   if(!res.ok){status('文章の送信失敗: '+FlecityErrors.text(res.error),'error');return;}telephoneText.value='';renderRoom(res.room);
  }finally{telephoneTextSubmit.disabled=false;}
 });
}
telephoneTextSubmit.onclick=submitTelephoneText;
telephoneText.onkeydown=e=>{if(e.key==='Enter'&&!e.isComposing)submitTelephoneText();};
lobbyBtn.onclick=()=>runOnce('return-lobby',async()=>{const res=await FlecityBridge.call('partyReturnLobby',{});if(!res.ok){status('ロビーへ戻れません: '+FlecityErrors.text(res.error),'error');return;}renderRoom(res.room);});
leaveBtn.onclick=()=>{
 const now=performance.now();
 if(now>leaveConfirmUntil){
   leaveConfirmUntil=now+2500;leaveBtn.textContent='もう一度押して退出';
   clearTimeout(leaveConfirmTimer);
   leaveConfirmTimer=setTimeout(()=>{if(performance.now()>=leaveConfirmUntil)resetLeaveConfirmation();},2600);
   return;
 }
 resetLeaveConfirmation();
 runOnce('leave',async()=>{
   const res=await FlecityBridge.call('partyLeaveRoom',{});
   if(!res.ok){status('退出できません: '+FlecityErrors.text(res.error),'error');return;}
   showEntry();status('ルームから退出しました。');
 });
};
codeEl.oninput=()=>{codeEl.value=codeEl.value.replace(/\D/g,'').slice(0,partyConfig.roomCodeLength);};

async function bootstrap(){
 if(appSuspended)return;
 const epoch=lifecycleEpoch;
 const bridge=await FlecityBridge.call('bridgePing',{});
 if(appSuspended||epoch!==lifecycleEpoch)return;
 if(!bridge.ok){
   status('LB Phoneへ再接続中…','warn');
   scheduleBootstrap(1000);
   return;
 }
 registerPhonePushChannel();
 await loadPartyConfig(epoch);
 if(appSuspended||epoch!==lifecycleEpoch)return;
 const roomRequestStarted=performance.now();
 const res=await FlecityBridge.call('partyGetRoom',{});
 const roomRequestReceived=performance.now();
 if(appSuspended||epoch!==lifecycleEpoch)return;
 if(!res.ok){
   const transient=['PLAYER_NOT_READY','NUI_REQUEST_FAILED','PHONE_CALLBACK_FAILED','CALLBACK_FAILED','NUI_UNAVAILABLE'];
   if(transient.includes(res.error)){
     status(res.error==='PLAYER_NOT_READY'?'キャラクター読み込み待ち…':'PARTYへ再接続中…','warn');
     scheduleBootstrap(1000);
     return;
   }
 }
 await loadSettings(epoch);
 if(appSuspended||epoch!==lifecycleEpoch)return;
 if(res.ok){renderRoom(res.room,{started:roomRequestStarted,received:roomRequestReceived});beginPolling();if(res.reconnected)status('ルームへ再接続しました。','good');return;}
 showEntry();
 if(res.error==='NOT_IN_ROOM')status('PARTY 準備完了 · v'+String(partyConfig.version||'unknown'),'good');
 else status('ルーム復元失敗: '+FlecityErrors.text(res.error),'error');
}
bootstrap();
