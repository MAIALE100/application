const statusEl=document.getElementById('status'),entryEl=document.getElementById('entry'),roomEl=document.getElementById('room'),roomCodeEl=document.getElementById('roomCode'),playersEl=document.getElementById('players');
const codeEl=document.getElementById('code'),createBtn=document.getElementById('create'),joinBtn=document.getElementById('join'),leaveBtn=document.getElementById('leave'),readyBtn=document.getElementById('ready'),startBtn=document.getElementById('start'),gameEl=document.getElementById('game');
const lobbyPanel=document.getElementById('lobbyPanel'),roundPanel=document.getElementById('roundPanel');
const reactionPanel=document.getElementById('reactionPanel'),reactionMessage=document.getElementById('reactionMessage'),reactionTap=document.getElementById('reactionTap');
const stopBattlePanel=document.getElementById('stopBattlePanel'),stopBattleMessage=document.getElementById('stopBattleMessage'),stopBattleButton=document.getElementById('stopBattleButton'),stopBattleTarget=document.getElementById('stopBattleTarget'),stopBattleMarker=document.getElementById('stopBattleMarker');
const votePanel=document.getElementById('votePanel'),votePrompt=document.getElementById('votePrompt'),voteChoices=document.getElementById('voteChoices');
const majorityPanel=document.getElementById('majorityPanel'),majorityPrompt=document.getElementById('majorityPrompt'),majorityChoices=document.getElementById('majorityChoices');
const deductionPanel=document.getElementById('deductionPanel'),deductionGame=document.getElementById('deductionGame'),deductionSecret=document.getElementById('deductionSecret'),deductionHint=document.getElementById('deductionHint'),deductionChoices=document.getElementById('deductionChoices');
const drawPanel=document.getElementById('drawPanel'),drawPrompt=document.getElementById('drawPrompt'),drawProgress=document.getElementById('drawProgress'),drawCanvas=document.getElementById('drawCanvas'),drawDrawerControls=document.getElementById('drawDrawerControls'),drawGuessControls=document.getElementById('drawGuessControls'),drawClear=document.getElementById('drawClear'),drawGuess=document.getElementById('drawGuess'),drawGuessSubmit=document.getElementById('drawGuessSubmit');
const telephonePanel=document.getElementById('telephonePanel'),telephoneStatus=document.getElementById('telephoneStatus'),telephoneHint=document.getElementById('telephoneHint'),telephoneTextPrompt=document.getElementById('telephoneTextPrompt'),telephoneCanvas=document.getElementById('telephoneCanvas'),telephoneDrawControls=document.getElementById('telephoneDrawControls'),telephoneClear=document.getElementById('telephoneClear'),telephoneDrawSubmit=document.getElementById('telephoneDrawSubmit'),telephoneTextControls=document.getElementById('telephoneTextControls'),telephoneText=document.getElementById('telephoneText'),telephoneTextSubmit=document.getElementById('telephoneTextSubmit');
const drawCtx=drawCanvas.getContext('2d'),telephoneCtx=telephoneCanvas.getContext('2d');
const resultsPanel=document.getElementById('resultsPanel'),resultsEl=document.getElementById('results'),lobbyBtn=document.getElementById('lobby');
const settingSound=document.getElementById('settingSound'),settingMotion=document.getElementById('settingMotion');

let currentRoom=null,ready=false,poll=null,activeRoundToken=null,serverOffsetMs=0,appSettings={sound:true,reducedMotion:false},audioCtx=null,lastCompleteToken=null,lastRoomRevision=-1;
let partyConfig={roomCodeLength:4,minPlayers:2,maxPlayers:10};
let refreshInFlight=false,refreshQueued=false;
let reactionState='idle',reactionRaf=null;
let stopBattleState='idle',stopBattleRaf=null,drawStroke=null,drawIsDrawer=false,telephoneStroke=null,telephoneStrokes=[];

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
async function loadSettings(){const res=await FlecityBridge.call('profileGetSettings',{});if(res.ok)applySettings(res.settings);}
async function saveSettings(){
 const res=await FlecityBridge.call('profileUpdateSettings',{sound:settingSound.checked,reducedMotion:settingMotion.checked});
 if(res.ok){applySettings(res.settings);tone(520,55);}else status('設定を保存できません: '+FlecityErrors.text(res.error),'error');
}
settingSound.onchange=saveSettings;settingMotion.onchange=saveSettings;
function status(text,type){statusEl.textContent=text;statusEl.className='status '+(type||'');}
function estimatedServerTick(){return performance.now()+serverOffsetMs;}
function trianglePosition(elapsedMs,periodMs,phaseMs){
 const period=Math.max(400,Number(periodMs)||1800),cycle=(Math.max(0,Number(elapsedMs)||0)+(Number(phaseMs)||0))%period,half=period/2;
 return cycle<=half?(cycle/half)*100:((period-cycle)/half)*100;
}
function resetRoundRuntime(){
 cancelAnimationFrame(reactionRaf);cancelAnimationFrame(stopBattleRaf);
 reactionState='idle';stopBattleState='idle';
}
function hideRoundGames(){
 reactionPanel.classList.add('hidden');stopBattlePanel.classList.add('hidden');votePanel.classList.add('hidden');majorityPanel.classList.add('hidden');deductionPanel.classList.add('hidden');drawPanel.classList.add('hidden');telephonePanel.classList.add('hidden');
}
function showEntry(){
 currentRoom=null;ready=false;activeRoundToken=null;lastRoomRevision=-1;resetRoundRuntime();clearInterval(poll);poll=null;
 roomEl.classList.add('hidden');entryEl.classList.remove('hidden');
}
function renderPlayers(room){
 playersEl.innerHTML='';
 room.players.forEach(p=>{
   const row=document.createElement('div');row.className='player';
   const left=document.createElement('span');left.textContent=(p.isHost?'★ ':'')+p.name;
   const right=document.createElement('span');right.textContent=p.disconnected?'OFFLINE':(p.ready?'READY':'待機ING');right.className=p.ready?'good':(p.disconnected?'error':'muted');
   row.append(left,right);playersEl.appendChild(row);
 });
}
function appendResultRow(leftText,rightText){
 const d=document.createElement('div'),left=document.createElement('span'),right=document.createElement('strong');
 d.className='player';left.textContent=String(leftText??'');right.textContent=String(rightText??'');
 d.append(left,right);resultsEl.appendChild(d);
}
function renderResults(room){
 const rs=room.roundState;if(!rs||!rs.complete||!rs.results){resultsPanel.classList.add('hidden');return;}
 if(lastCompleteToken!==rs.token){lastCompleteToken=rs.token;tone(760,90);}
 hideRoundGames();resultsPanel.classList.remove('hidden');resultsEl.innerHTML='';
 if(rs.gameId==='reaction'){
   rs.results.entries.forEach(e=>appendResultRow('#'+e.place+' '+e.name,e.flying?'FLYING':Number(e.reactionMs).toFixed(3)+' ms'));
 }else if(rs.gameId==='stop_battle'){
   rs.results.entries.forEach(e=>appendResultRow('#'+e.place+' '+e.name,e.score+' / '+Number(e.distancePct).toFixed(2)+'%'));
 }else if(rs.gameId==='vote'){
   rs.results.entries.forEach(e=>appendResultRow(e.name,e.votes+'票'));
 }else if(rs.gameId==='majority'){
   const options=rs.results.options||rs.options||['A','B'],counts=rs.results.counts||{A:0,B:0};
   const summary=document.createElement('div');summary.className='status good';
   summary.textContent='A: '+options[0]+' ('+Number(counts.A||0)+') / B: '+options[1]+' ('+Number(counts.B||0)+')';
   resultsEl.appendChild(summary);
   rs.results.entries.forEach(e=>{const label=e.choice==='A'?options[0]:options[1];appendResultRow(e.name,label);});
 }else if(rs.gameId==='word_wolf'){
   const reveal=document.createElement('div');reveal.className='status good';reveal.textContent='多数派: '+rs.results.majorityTopic+' / 少数派: '+rs.results.wolfTopic;resultsEl.appendChild(reveal);
   rs.results.entries.forEach(e=>{const wolf=e.memberId===rs.results.wolfMemberId?' ← WOLF':'';appendResultRow(e.name+wolf,e.votes+'票');});
 }else if(rs.gameId==='liar'){
   const reveal=document.createElement('div');reveal.className='status good';reveal.textContent='質問: '+String(rs.results.prompt||'');resultsEl.appendChild(reveal);
   rs.results.entries.forEach(e=>{const liar=e.memberId===rs.results.liarMemberId?' ← LIAR':'';appendResultRow(e.name+liar,e.votes+'票');});
 }else if(rs.gameId==='draw'){
   const reveal=document.createElement('div');reveal.className=rs.results.aborted?'status warn':'status good';reveal.textContent=rs.results.aborted?'描き手が退出したため終了しました。':'正解: '+String(rs.results.prompt||'');resultsEl.appendChild(reveal);
   (rs.results.entries||[]).forEach(e=>appendResultRow('#'+e.place+' '+e.name,'正解'));
 }else if(rs.gameId==='telephone'){
   (rs.results.chain||[]).forEach((entry,i)=>{
     const wrap=document.createElement('div');wrap.className='card stack';
     const head=document.createElement('div');head.className='kicker';head.textContent=(i===0?'START':entry.name)+' · '+String(entry.kind||'').toUpperCase();wrap.appendChild(head);
     if(entry.kind==='text'){const p=document.createElement('div');p.textContent=entry.text||'';wrap.appendChild(p);}
     else{const canvas=document.createElement('canvas');canvas.width=320;canvas.height=220;canvas.className='draw-canvas';wrap.appendChild(canvas);paintCanvas(canvas.getContext('2d'),canvas,entry.strokes||[]);}
     resultsEl.appendChild(wrap);
   });
 }
}
function beginRoundToken(rs){
 if(activeRoundToken===rs.token)return false;
 activeRoundToken=rs.token;resetRoundRuntime();return true;
}
function reactionLoop(){
 if(!currentRoom||!currentRoom.roundState||reactionState==='submitted')return;
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
 if(rs.selfSubmitted){cancelAnimationFrame(reactionRaf);reactionMessage.textContent='入力済み';reactionTap.disabled=true;reactionTap.textContent='ほかの参加者を待っています';reactionState='submitted';return;}
 if(reactionState==='idle')reactionLoop();
}
function stopBattleLoop(){
 if(!currentRoom||!currentRoom.roundState||stopBattleState==='submitted')return;
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
 if(rs.selfSubmitted){cancelAnimationFrame(stopBattleRaf);stopBattleMessage.textContent='入力済み';stopBattleButton.disabled=true;stopBattleButton.textContent='ほかの参加者を待っています';stopBattleState='submitted';return;}
 if(stopBattleState==='idle')stopBattleLoop();
}
function setupVote(room){
 const rs=room.roundState;hideRoundGames();votePanel.classList.remove('hidden');resultsPanel.classList.add('hidden');
 votePrompt.textContent=rs.prompt||'投票';voteChoices.innerHTML='';beginRoundToken(rs);
 if(rs.complete){renderResults(room);return;}
 if(rs.selfSubmitted){voteChoices.innerHTML='<div class="status good">投票済みです。ほかの参加者を待っています。</div>';return;}
 room.players.filter(p=>!p.disconnected&&p.memberId!==room.selfMemberId).forEach(p=>{
   const b=document.createElement('button');b.className='secondary';b.textContent=p.name;b.onclick=()=>submitVote(rs.token,p.memberId);voteChoices.appendChild(b);
 });
}
function setupMajority(room){
 const rs=room.roundState;hideRoundGames();majorityPanel.classList.remove('hidden');resultsPanel.classList.add('hidden');beginRoundToken(rs);
 majorityPrompt.textContent=rs.prompt||'MAJORITY';majorityChoices.innerHTML='';
 if(rs.complete){renderResults(room);return;}
 if(rs.selfSubmitted){majorityChoices.innerHTML='<div class="status good">回答済みです。ほかの参加者を待っています。</div>';return;}
 const options=Array.isArray(rs.options)?rs.options:['A','B'];
 ['A','B'].forEach((choice,i)=>{const b=document.createElement('button');b.className='secondary';b.textContent=options[i]||choice;b.onclick=()=>submitMajority(rs.token,choice);majorityChoices.appendChild(b);});
}
function setupDeduction(room){
 const rs=room.roundState;hideRoundGames();deductionPanel.classList.remove('hidden');resultsPanel.classList.add('hidden');beginRoundToken(rs);deductionChoices.innerHTML='';
 if(rs.gameId==='word_wolf'){
   deductionGame.textContent='WORD WOLF';deductionSecret.textContent='あなたのお題: '+String(rs.secretTopic||'---');
   deductionHint.textContent='全員で会話して、違うお題を持っていると思う人に投票してください。';
 }else{
   deductionGame.textContent='LIAR';deductionSecret.textContent='質問: '+String(rs.prompt||'---');
   deductionHint.textContent=rs.role==='LIAR'?'あなたはLIARです。質問には嘘で答えてください。':'あなたはTRUTHです。質問には正直に答えてください。';
 }
 if(rs.complete){renderResults(room);return;}
 if(rs.selfSubmitted){deductionChoices.innerHTML='<div class="status good">投票済みです。ほかの参加者を待っています。</div>';return;}
 room.players.filter(p=>!p.disconnected&&p.memberId!==room.selfMemberId).forEach(p=>{
   const b=document.createElement('button');b.className='secondary';b.textContent=p.name;b.onclick=()=>submitDeduction(rs.gameId,rs.token,p.memberId);deductionChoices.appendChild(b);
 });
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
function renderRoom(room){
 if(!room)return false;
 const incomingRevision=Number(room.revision);
 if(currentRoom&&currentRoom.code===room.code&&Number.isFinite(incomingRevision)&&incomingRevision<lastRoomRevision)return false;
 if(Number.isFinite(incomingRevision))lastRoomRevision=Math.max(lastRoomRevision,incomingRevision);
 currentRoom=room;ready=room.selfReady===true;
 if(Number.isFinite(Number(room.serverTick)))serverOffsetMs=Number(room.serverTick)-performance.now();
 entryEl.classList.add('hidden');roomEl.classList.remove('hidden');roomCodeEl.textContent=room.code;renderPlayers(room);
 if(room.state==='lobby'){
   activeRoundToken=null;resetRoundRuntime();lobbyPanel.classList.remove('hidden');roundPanel.classList.add('hidden');
   gameEl.value=room.selectedGame||'reaction';gameEl.disabled=!room.isHost;startBtn.disabled=!room.isHost;readyBtn.disabled=false;readyBtn.textContent=ready?'UNREADY':'READY';status('ロビー準備完了。','good');
 }else{
   lobbyPanel.classList.add('hidden');roundPanel.classList.remove('hidden');lobbyBtn.classList.toggle('hidden',!room.isHost);status('ラウンド '+room.round+' / '+room.selectedGame,'good');
   const rs=room.roundState;
   if(rs&&rs.gameId==='reaction')setupReaction(room);
   else if(rs&&rs.gameId==='stop_battle')setupStopBattle(room);
   else if(rs&&rs.gameId==='vote')setupVote(room);
   else if(rs&&rs.gameId==='majority')setupMajority(room);
   else if(rs&&(rs.gameId==='word_wolf'||rs.gameId==='liar'))setupDeduction(room);
   else if(rs&&rs.gameId==='draw')setupDraw(room);
   else if(rs&&rs.gameId==='telephone')setupTelephone(room);
 }
 return true;
}
async function refresh(){
 if(!currentRoom)return;
 if(refreshInFlight){refreshQueued=true;return;}
 refreshInFlight=true;
 try{
   const res=await FlecityBridge.call('partyGetRoom',{});
   if(!res.ok){
     if(res.error==='NOT_IN_ROOM')showEntry();
     else status('ルーム更新失敗: '+FlecityErrors.text(res.error),'error');
     return;
   }
   renderRoom(res.room);
 }finally{
   refreshInFlight=false;
   if(refreshQueued){refreshQueued=false;setTimeout(refresh,0);}
 }
}
function beginPolling(){if(poll)clearInterval(poll);poll=setInterval(refresh,10000);}
async function loadPartyConfig(){
 const res=await FlecityBridge.call('partyGetConfig',{});
 if(!res.ok||!res.config)return;
 const length=Math.max(3,Math.min(6,Number(res.config.roomCodeLength)||4));
 partyConfig={...partyConfig,...res.config,roomCodeLength:length};
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
     option.textContent=game.name+' · '+(min===max?min+'人':min+'〜'+max+'人');
     option.title=game.description||'';
     gameEl.appendChild(option);
   });
   if([...gameEl.options].some(o=>o.value===current))gameEl.value=current;
 }
}
window.addEventListener('message',event=>{
 const message=event.data;
 if(!message)return;
 if(message.type==='partyUpdate'&&message.room){renderRoom(message.room);return;}
 if(message.type==='partyDrawStroke'&&currentRoom&&currentRoom.roundState&&currentRoom.roundState.gameId==='draw'&&currentRoom.roundState.token===message.token){
   const revision=Number(message.revision);
   if(Number.isFinite(revision)&&revision<lastRoomRevision)return;
   if(Number.isFinite(revision)){lastRoomRevision=Math.max(lastRoomRevision,revision);currentRoom.revision=lastRoomRevision;}
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
   if(Number.isFinite(revision)&&revision<lastRoomRevision)return;
   if(Number.isFinite(revision)){lastRoomRevision=Math.max(lastRoomRevision,revision);currentRoom.revision=lastRoomRevision;}
   currentRoom.roundState.strokes=[];
   if(!drawStroke)renderDrawCanvas([]);
   return;
 }
 if(message.type==='partyInvalidate')refresh();
});

createBtn.onclick=async()=>{const res=await FlecityBridge.call('partyCreateRoom',{});if(!res.ok){status('ルーム作成失敗: '+FlecityErrors.text(res.error),'error');return;}renderRoom(res.room);beginPolling();};
joinBtn.onclick=async()=>{const code=codeEl.value.replace(/\D/g,'').slice(0,partyConfig.roomCodeLength);const res=await FlecityBridge.call('partyJoinRoom',{code});if(!res.ok){status('参加失敗: '+FlecityErrors.text(res.error),'error');return;}renderRoom(res.room);beginPolling();};
readyBtn.onclick=async()=>{ready=!ready;const res=await FlecityBridge.call('partySetReady',{ready});if(!res.ok){ready=!ready;status('準備状態の変更失敗: '+FlecityErrors.text(res.error),'error');return;}renderRoom(res.room);};
gameEl.onchange=async()=>{const res=await FlecityBridge.call('partySelectGame',{gameId:gameEl.value});if(!res.ok){status('ゲーム変更失敗: '+FlecityErrors.text(res.error),'error');await refresh();return;}renderRoom(res.room);};
startBtn.onclick=async()=>{const res=await FlecityBridge.call('partyStartRound',{});if(!res.ok){status('ゲーム開始失敗: '+FlecityErrors.text(res.error),'error');return;}renderRoom(res.room);};

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
async function submitMajority(token,choice){
 majorityChoices.querySelectorAll('button').forEach(b=>b.disabled=true);
 const res=await FlecityBridge.call('partySubmitMajority',{token,choice});
 if(!res.ok){status('MAJORITY回答失敗: '+FlecityErrors.text(res.error),'error');await refresh();return;}renderRoom(res.room);
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
 if(points.length<2){renderDrawCanvas((currentRoom&&currentRoom.roundState&&currentRoom.roundState.strokes)||[]);return;}
 const rs=currentRoom&&currentRoom.roundState;if(!rs)return;
 const res=await FlecityBridge.call('partyAddDrawStroke',{token:rs.token,points});
 if(!res.ok){status('描画同期失敗: '+FlecityErrors.text(res.error),'error');await refresh();return;}renderRoom(res.room);
};
drawClear.onclick=async()=>{
 const rs=currentRoom&&currentRoom.roundState;if(!rs)return;drawClear.disabled=true;
 const res=await FlecityBridge.call('partyClearDrawing',{token:rs.token});drawClear.disabled=false;
 if(!res.ok){status('消去失敗: '+FlecityErrors.text(res.error),'error');return;}renderRoom(res.room);
};
async function submitDrawGuess(){
 const rs=currentRoom&&currentRoom.roundState,guess=drawGuess.value.trim();if(!rs||!guess)return;
 drawGuessSubmit.disabled=true;const res=await FlecityBridge.call('partySubmitDrawGuess',{token:rs.token,guess});drawGuessSubmit.disabled=false;
 if(!res.ok){status('回答送信失敗: '+FlecityErrors.text(res.error),'error');return;}
 if(res.correct){drawGuess.value='';status('正解！','good');}else status('違います。もう一度！','warn');
 renderRoom(res.room);
}
drawGuessSubmit.onclick=submitDrawGuess;
drawGuess.onkeydown=e=>{if(e.key==='Enter')submitDrawGuess();};
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
 if(stroke.length>=2&&telephoneStrokes.length<80)telephoneStrokes.push(stroke);paintCanvas(telephoneCtx,telephoneCanvas,telephoneStrokes);
};
telephoneClear.onclick=()=>{telephoneStroke=null;telephoneStrokes=[];paintCanvas(telephoneCtx,telephoneCanvas,[]);};
telephoneDrawSubmit.onclick=async()=>{
 const rs=currentRoom&&currentRoom.roundState;if(!rs||rs.gameId!=='telephone'||rs.mode!=='draw'||!rs.isCurrent)return;
 if(!telephoneStrokes.length){status('絵を描いてから送信してください。','warn');return;}
 telephoneDrawSubmit.disabled=true;const res=await FlecityBridge.call('partySubmitTelephoneDrawing',{token:rs.token,strokes:telephoneStrokes});telephoneDrawSubmit.disabled=false;
 if(!res.ok){status('絵の送信失敗: '+FlecityErrors.text(res.error),'error');return;}telephoneStrokes=[];telephoneStroke=null;renderRoom(res.room);
};
async function submitTelephoneText(){
 const rs=currentRoom&&currentRoom.roundState,value=telephoneText.value.trim();if(!rs||rs.gameId!=='telephone'||rs.mode!=='text'||!rs.isCurrent||!value)return;
 telephoneTextSubmit.disabled=true;const res=await FlecityBridge.call('partySubmitTelephoneText',{token:rs.token,text:value});telephoneTextSubmit.disabled=false;
 if(!res.ok){status('文章の送信失敗: '+FlecityErrors.text(res.error),'error');return;}telephoneText.value='';renderRoom(res.room);
}
telephoneTextSubmit.onclick=submitTelephoneText;
telephoneText.onkeydown=e=>{if(e.key==='Enter')submitTelephoneText();};
lobbyBtn.onclick=async()=>{const res=await FlecityBridge.call('partyReturnLobby',{});if(!res.ok){status('ロビーへ戻れません: '+FlecityErrors.text(res.error),'error');return;}renderRoom(res.room);};
leaveBtn.onclick=async()=>{await FlecityBridge.call('partyLeaveRoom',{});showEntry();status('ルームから退出しました。');};
codeEl.oninput=()=>{codeEl.value=codeEl.value.replace(/\D/g,'').slice(0,partyConfig.roomCodeLength);};

async function bootstrap(){
 const bridge=await FlecityBridge.call('bridgePing',{});
 if(!bridge.ok){
   status('LB Phoneへ再接続中…','warn');
   setTimeout(bootstrap,1000);
   return;
 }
 await loadPartyConfig();
 const res=await FlecityBridge.call('partyGetRoom',{});
 if(!res.ok){
   const transient=['PLAYER_NOT_READY','NUI_REQUEST_FAILED','PHONE_CALLBACK_FAILED','CALLBACK_FAILED','NUI_UNAVAILABLE'];
   if(transient.includes(res.error)){
     status(res.error==='PLAYER_NOT_READY'?'キャラクター読み込み待ち…':'PARTYへ再接続中…','warn');
     setTimeout(bootstrap,1000);
     return;
   }
 }
 await loadSettings();
 if(res.ok){renderRoom(res.room);beginPolling();if(res.reconnected)status('ルームへ再接続しました。','good');return;}
 showEntry();
 if(res.error==='NOT_IN_ROOM')status('PARTY 準備完了 · v'+String(partyConfig.version||'unknown'),'good');
 else status('ルーム復元失敗: '+FlecityErrors.text(res.error),'error');
}
bootstrap();
