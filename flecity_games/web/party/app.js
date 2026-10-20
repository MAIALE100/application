const statusEl=document.getElementById('status'),entryEl=document.getElementById('entry'),roomEl=document.getElementById('room'),roomCodeEl=document.getElementById('roomCode'),playersEl=document.getElementById('players'),readySummary=document.getElementById('readySummary');
const codeEl=document.getElementById('code'),createBtn=document.getElementById('create'),joinBtn=document.getElementById('join'),leaveBtn=document.getElementById('leave'),readyBtn=document.getElementById('ready'),startBtn=document.getElementById('start'),gameEl=document.getElementById('game'),gameInfo=document.getElementById('gameInfo');
const lobbyPanel=document.getElementById('lobbyPanel'),roundPanel=document.getElementById('roundPanel');
const reactionPanel=document.getElementById('reactionPanel'),reactionMessage=document.getElementById('reactionMessage'),reactionTap=document.getElementById('reactionTap');
const stopBattlePanel=document.getElementById('stopBattlePanel'),stopBattleMessage=document.getElementById('stopBattleMessage'),stopBattleButton=document.getElementById('stopBattleButton'),stopBattleTarget=document.getElementById('stopBattleTarget'),stopBattleMarker=document.getElementById('stopBattleMarker');
const votePanel=document.getElementById('votePanel'),votePrompt=document.getElementById('votePrompt'),voteChoices=document.getElementById('voteChoices');
const majorityPanel=document.getElementById('majorityPanel'),majorityGameLabel=document.getElementById('majorityGameLabel'),majorityPrompt=document.getElementById('majorityPrompt'),majorityChoices=document.getElementById('majorityChoices');
const ticTacPanel=document.getElementById('ticTacPanel'),ticTacStatus=document.getElementById('ticTacStatus'),ticTacBoard=document.getElementById('ticTacBoard'),ticTacMeta=document.getElementById('ticTacMeta');
const deductionPanel=document.getElementById('deductionPanel'),deductionGame=document.getElementById('deductionGame'),deductionSecret=document.getElementById('deductionSecret'),deductionHint=document.getElementById('deductionHint'),deductionChoices=document.getElementById('deductionChoices');
const drawPanel=document.getElementById('drawPanel'),drawPrompt=document.getElementById('drawPrompt'),drawProgress=document.getElementById('drawProgress'),drawCanvas=document.getElementById('drawCanvas'),drawDrawerControls=document.getElementById('drawDrawerControls'),drawGuessControls=document.getElementById('drawGuessControls'),drawClear=document.getElementById('drawClear'),drawGuess=document.getElementById('drawGuess'),drawGuessSubmit=document.getElementById('drawGuessSubmit');
const telephonePanel=document.getElementById('telephonePanel'),telephoneStatus=document.getElementById('telephoneStatus'),telephoneHint=document.getElementById('telephoneHint'),telephoneTextPrompt=document.getElementById('telephoneTextPrompt'),telephoneCanvas=document.getElementById('telephoneCanvas'),telephoneDrawControls=document.getElementById('telephoneDrawControls'),telephoneClear=document.getElementById('telephoneClear'),telephoneDrawSubmit=document.getElementById('telephoneDrawSubmit'),telephoneTextControls=document.getElementById('telephoneTextControls'),telephoneText=document.getElementById('telephoneText'),telephoneTextSubmit=document.getElementById('telephoneTextSubmit');
const drawCtx=drawCanvas.getContext('2d'),telephoneCtx=telephoneCanvas.getContext('2d');
const resultsPanel=document.getElementById('resultsPanel'),resultsEl=document.getElementById('results'),lobbyBtn=document.getElementById('lobby');
const settingSound=document.getElementById('settingSound'),settingMotion=document.getElementById('settingMotion');

let currentRoom=null,ready=false,poll=null,activeRoundToken=null,serverOffsetMs=0,serverOffsetReady=false,appSettings={sound:true,reducedMotion:false},audioCtx=null,lastCompleteToken=null,lastRoomRevision=-1,roomPushEnabled=false;
let partyConfig={roomCodeLength:4,minPlayers:2,maxPlayers:10};
let refreshInFlight=false,refreshQueued=false;
let reactionState='idle',reactionRaf=null;
let stopBattleState='idle',stopBattleRaf=null,drawStroke=null,drawIsDrawer=false,telephoneStroke=null,telephoneStrokes=[];

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
async function loadSettings(){const res=await FlecityBridge.call('profileGetSettings',{});if(res.ok)applySettings(res.settings);}
async function saveSettings(){
 const res=await FlecityBridge.call('profileUpdateSettings',{sound:settingSound.checked,reducedMotion:settingMotion.checked});
 if(res.ok){applySettings(res.settings);tone(520,55);}else status('設定を保存できません: '+FlecityErrors.text(res.error),'error');
}
settingSound.onchange=saveSettings;settingMotion.onchange=saveSettings;
let statusTimer=null;
function status(text,type){
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
 cancelAnimationFrame(reactionRaf);cancelAnimationFrame(stopBattleRaf);
 reactionState='idle';stopBattleState='idle';
}
function hideRoundGames(){
 reactionPanel.classList.add('hidden');stopBattlePanel.classList.add('hidden');votePanel.classList.add('hidden');majorityPanel.classList.add('hidden');ticTacPanel.classList.add('hidden');deductionPanel.classList.add('hidden');drawPanel.classList.add('hidden');telephonePanel.classList.add('hidden');
}
function showEntry(){
 currentRoom=null;ready=false;activeRoundToken=null;lastRoomRevision=-1;serverOffsetReady=false;roomPushEnabled=false;resetRoundRuntime();clearInterval(poll);poll=null;
 roomEl.classList.add('hidden');entryEl.classList.remove('hidden');
}
function selectedGameConfig(room){
 const games=Array.isArray(partyConfig.games)?partyConfig.games:[];
 return games.find(g=>g.id===room.selectedGame)||null;
}
function renderGameInfo(gameId){
 const games=Array.isArray(partyConfig.games)?partyConfig.games:[];
 const game=games.find(g=>g.id===gameId);
 gameInfo.innerHTML='';
 if(!game){
   const text=document.createElement('span');text.className='muted';text.textContent='ゲーム情報を取得できません。';gameInfo.appendChild(text);return;
 }
 const title=document.createElement('strong'),meta=document.createElement('span'),description=document.createElement('span');
 title.textContent=String(game.name||game.id);meta.className='game-info-meta';description.className='muted';
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
 const waiting=(room.players||[]).filter(p=>!p.disconnected&&!p.ready).length;
 if(!room.isHost)return {ok:false,text:'ホストのみ開始できます'};
 if(connected<min)return {ok:false,text:'あと'+(min-connected)+'人必要です'};
 if(connected>max)return {ok:false,text:'参加人数が上限を超えています'};
 if(waiting>0)return {ok:false,text:'準備待ち '+waiting+'人'};
 return {ok:true,text:'全員準備OK'};
}
function renderPlayers(room){
 playersEl.innerHTML='';
 const connected=(room.players||[]).filter(p=>!p.disconnected);
 const readyCount=connected.filter(p=>p.ready).length;
 readySummary.textContent='接続中 '+connected.length+'人 · 準備OK '+readyCount+'/'+connected.length;
 room.players.forEach(p=>{
   const row=document.createElement('div');row.className='player';
   const left=document.createElement('span');left.textContent=(p.isHost?'★ ':'')+p.name;
   const right=document.createElement('span');right.textContent=p.disconnected?'オフライン':(p.ready?'準備OK':'待機中');right.className=p.ready?'good':(p.disconnected?'error':'muted');
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
 if(rs.results.aborted===true){
   const box=document.createElement('div');box.className='status warn';
   const reason=String(rs.results.reason||'ROUND_ABORTED');
   if(reason==='NOT_ENOUGH_PLAYERS')box.textContent='参加人数が足りなくなったため、このラウンドを終了しました。';
   else if(reason==='SECRET_PLAYER_LEFT')box.textContent='役職プレイヤーが退出したため、このラウンドを終了しました。';
   else if(reason==='DRAWER_LEFT')box.textContent='描き手が退出したため、このラウンドを終了しました。';
   else box.textContent='このラウンドは中断されました。';
   resultsEl.appendChild(box);
   return;
 }
 if(rs.gameId==='reaction'){
   rs.results.entries.forEach(e=>appendResultRow('#'+e.place+' '+e.name,e.flying?'フライング':Number(e.reactionMs).toFixed(3)+' ms'));
 }else if(rs.gameId==='stop_battle'){
   rs.results.entries.forEach(e=>appendResultRow('#'+e.place+' '+e.name,e.score+' / '+Number(e.distancePct).toFixed(2)+'%'));
 }else if(rs.gameId==='vote'){
   const winnerIds=Array.isArray(rs.results.winnerMemberIds)?rs.results.winnerMemberIds:[];
   const winnerNames=(rs.results.entries||[]).filter(e=>winnerIds.includes(e.memberId)).map(e=>e.name);
   if(winnerNames.length){const summary=document.createElement('div');summary.className='status good';summary.textContent=(winnerNames.length>1?'同票: ':'最多票: ')+winnerNames.join(' / ');resultsEl.appendChild(summary);}
   rs.results.entries.forEach(e=>appendResultRow(e.name,e.votes+'票'));
 }else if(rs.gameId==='majority'||rs.gameId==='minority'){
   const options=rs.results.options||rs.options||['A','B'],counts=rs.results.counts||{A:0,B:0};
   const summary=document.createElement('div');summary.className='status '+(rs.results.winningChoice?'good':'warn');
   const winning=rs.results.winningChoice,isMinority=rs.gameId==='minority';
   const winnerText=winning?(isMinority?'少数派: ':'多数派: ')+(winning==='A'?options[0]:options[1]):'同数のため勝者なし';
   summary.textContent=winnerText+' · '+options[0]+' '+Number(counts.A||0)+' / '+options[1]+' '+Number(counts.B||0);
   resultsEl.appendChild(summary);
   rs.results.entries.forEach(e=>{
     const label=e.choice==='A'?options[0]:options[1];
     appendResultRow(e.name,label+(winning&&e.choice===winning?' ✓':''));
   });
 }else if(rs.gameId==='tic_tac'){
   const result=rs.results||{};
   const banner=document.createElement('div');banner.className='status '+(result.draw?'warn':'good');
   banner.textContent=result.draw?'引き分け':'勝者: '+String(result.winnerName||'Player')+' ('+String(result.winnerSymbol||'?')+')';
   resultsEl.appendChild(banner);
   const board=Array.isArray(result.board)?result.board:[];
   appendResultRow('盤面',board.map(v=>v||'·').join(' '));
 }else if(rs.gameId==='word_wolf'){
   const reveal=document.createElement('div');reveal.className=rs.results.caught?'status good':'status warn';reveal.textContent=(rs.results.caught?'少数派を見破りました！':'少数派を見破れませんでした')+' · 多数派: '+rs.results.majorityTopic+' / 少数派: '+rs.results.wolfTopic;resultsEl.appendChild(reveal);
   rs.results.entries.forEach(e=>{const wolf=e.memberId===rs.results.wolfMemberId?' ← 少数派':'';appendResultRow(e.name+wolf,e.votes+'票');});
 }else if(rs.gameId==='liar'){
   const reveal=document.createElement('div');reveal.className=rs.results.caught?'status good':'status warn';reveal.textContent=(rs.results.caught?'LIARを見破りました！':'LIARを見破れませんでした')+' · 質問: '+String(rs.results.prompt||'');resultsEl.appendChild(reveal);
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
 activeRoundToken=rs.token;resetRoundRuntime();
 window.scrollTo({top:0,behavior:appSettings.reducedMotion?'auto':'smooth'});
 return true;
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
 const rs=room.roundState,isMinority=rs.gameId==='minority';hideRoundGames();majorityPanel.classList.remove('hidden');resultsPanel.classList.add('hidden');beginRoundToken(rs);
 majorityGameLabel.textContent=isMinority?'MINORITY':'MAJORITY';
 majorityPrompt.textContent=rs.prompt||(isMinority?'MINORITY':'MAJORITY');majorityChoices.innerHTML='';
 if(rs.complete){renderResults(room);return;}
 if(rs.selfSubmitted){majorityChoices.innerHTML='<div class="status good">回答済みです。ほかの参加者を待っています。</div>';return;}
 const hint=document.createElement('div');hint.className='muted choice-hint';hint.textContent=isMinority?'少ない方になりそうな選択肢を選んでください。':'多い方になりそうな選択肢を選んでください。';majorityChoices.appendChild(hint);
 const options=Array.isArray(rs.options)?rs.options:['A','B'];
 ['A','B'].forEach((choice,i)=>{const b=document.createElement('button');b.className='secondary choice-button';b.textContent=options[i]||choice;b.onclick=()=>submitMajority(rs.gameId,rs.token,choice);majorityChoices.appendChild(b);});
}

function setupTicTac(room){
 const rs=room.roundState;hideRoundGames();ticTacPanel.classList.remove('hidden');resultsPanel.classList.add('hidden');beginRoundToken(rs);
 if(rs.complete){renderResults(room);return;}
 const board=Array.isArray(rs.board)?rs.board:[];
 const current=room.players.find(p=>p.memberId===rs.currentMemberId);
 ticTacStatus.textContent=rs.isCurrent?'あなたの番です':(current?current.name+' の番です':'相手の番です');
 ticTacMeta.textContent='あなたは '+String(rs.symbol||'?')+' · 3つ揃えたら勝ち';
 ticTacBoard.innerHTML='';
 for(let i=0;i<9;i++){
   const button=document.createElement('button');button.className='tic-tac-cell';
   const value=String(board[i]||'');button.textContent=value;
   button.disabled=!rs.isCurrent||value!=='';
   button.setAttribute('aria-label','マス '+(i+1)+(value?' '+value:''));
   button.onclick=()=>submitTicTac(rs.token,i+1);
   ticTacBoard.appendChild(button);
 }
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
function renderRoom(room,timing){
 if(!room)return false;
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
   gameEl.value=room.selectedGame||'reaction';gameEl.disabled=!room.isHost;renderGameInfo(gameEl.value);
   const readiness=startReadiness(room);
   startBtn.disabled=!readiness.ok;startBtn.textContent=readiness.ok?'ゲーム開始':readiness.text;
   readyBtn.disabled=false;readyBtn.textContent=ready?'準備解除':'準備OK';status('ロビー準備完了。','good');
 }else{
   lobbyPanel.classList.add('hidden');roundPanel.classList.remove('hidden');lobbyBtn.classList.toggle('hidden',!room.isHost);status('ラウンド '+room.round+' / '+room.selectedGame,'good');
   const rs=room.roundState;
   if(rs&&rs.gameId==='reaction')setupReaction(room);
   else if(rs&&rs.gameId==='stop_battle')setupStopBattle(room);
   else if(rs&&rs.gameId==='vote')setupVote(room);
   else if(rs&&(rs.gameId==='majority'||rs.gameId==='minority'))setupMajority(room);
   else if(rs&&rs.gameId==='tic_tac')setupTicTac(room);
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
   const started=performance.now();
   const res=await FlecityBridge.call('partyGetRoom',{});
   const received=performance.now();
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
   renderGameInfo(gameEl.value);
 }
}
function handlePartyMessage(message){
 if(!message||typeof message!=='object')return;
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
 const types=['partyUpdate','partyDrawStroke','partyDrawClear','partyInvalidate'];
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

createBtn.onclick=async()=>{const started=performance.now();const res=await FlecityBridge.call('partyCreateRoom',{});const received=performance.now();if(!res.ok){status('ルーム作成失敗: '+FlecityErrors.text(res.error),'error');return;}renderRoom(res.room,{started,received});beginPolling();};
joinBtn.onclick=async()=>{const code=codeEl.value.replace(/\D/g,'').slice(0,partyConfig.roomCodeLength);const started=performance.now();const res=await FlecityBridge.call('partyJoinRoom',{code});const received=performance.now();if(!res.ok){status('参加失敗: '+FlecityErrors.text(res.error),'error');return;}renderRoom(res.room,{started,received});beginPolling();};
readyBtn.onclick=async()=>{ready=!ready;const res=await FlecityBridge.call('partySetReady',{ready});if(!res.ok){ready=!ready;status('準備状態の変更失敗: '+FlecityErrors.text(res.error),'error');return;}renderRoom(res.room);};
gameEl.onchange=async()=>{renderGameInfo(gameEl.value);const res=await FlecityBridge.call('partySelectGame',{gameId:gameEl.value});if(!res.ok){status('ゲーム変更失敗: '+FlecityErrors.text(res.error),'error');await refresh();return;}renderRoom(res.room);};
startBtn.onclick=async()=>{const started=performance.now();const res=await FlecityBridge.call('partyStartRound',{});const received=performance.now();if(!res.ok){status('ゲーム開始失敗: '+FlecityErrors.text(res.error),'error');return;}renderRoom(res.room,{started,received});};

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
 if(points.length<2){renderDrawCanvas((currentRoom&&currentRoom.roundState&&currentRoom.roundState.strokes)||[]);return;}
 const rs=currentRoom&&currentRoom.roundState;if(!rs)return;
 const res=await FlecityBridge.call('partyAddDrawStroke',{token:rs.token,points});
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
 registerPhonePushChannel();
 await loadPartyConfig();
 const roomRequestStarted=performance.now();
 const res=await FlecityBridge.call('partyGetRoom',{});
 const roomRequestReceived=performance.now();
 if(!res.ok){
   const transient=['PLAYER_NOT_READY','NUI_REQUEST_FAILED','PHONE_CALLBACK_FAILED','CALLBACK_FAILED','NUI_UNAVAILABLE'];
   if(transient.includes(res.error)){
     status(res.error==='PLAYER_NOT_READY'?'キャラクター読み込み待ち…':'PARTYへ再接続中…','warn');
     setTimeout(bootstrap,1000);
     return;
   }
 }
 await loadSettings();
 if(res.ok){renderRoom(res.room,{started:roomRequestStarted,received:roomRequestReceived});beginPolling();if(res.reconnected)status('ルームへ再接続しました。','good');return;}
 showEntry();
 if(res.error==='NOT_IN_ROOM')status('PARTY 準備完了 · v'+String(partyConfig.version||'unknown'),'good');
 else status('ルーム復元失敗: '+FlecityErrors.text(res.error),'error');
}
bootstrap();
