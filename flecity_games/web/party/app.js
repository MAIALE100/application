const statusEl=document.getElementById('status'),entryEl=document.getElementById('entry'),roomEl=document.getElementById('room'),roomCodeEl=document.getElementById('roomCode'),playersEl=document.getElementById('players');
const codeEl=document.getElementById('code'),createBtn=document.getElementById('create'),joinBtn=document.getElementById('join'),leaveBtn=document.getElementById('leave'),readyBtn=document.getElementById('ready'),startBtn=document.getElementById('start'),gameEl=document.getElementById('game');
const lobbyPanel=document.getElementById('lobbyPanel'),roundPanel=document.getElementById('roundPanel'),reactionPanel=document.getElementById('reactionPanel'),reactionMessage=document.getElementById('reactionMessage'),reactionTap=document.getElementById('reactionTap');
const votePanel=document.getElementById('votePanel'),votePrompt=document.getElementById('votePrompt'),voteChoices=document.getElementById('voteChoices'),resultsPanel=document.getElementById('resultsPanel'),resultsEl=document.getElementById('results'),lobbyBtn=document.getElementById('lobby');

let currentRoom=null,ready=false,poll=null,activeRoundToken=null,reactionState='idle',reactionShownAt=0,reactionTimer=null;
function status(text,type){statusEl.textContent=text;statusEl.className='status '+(type||'');}
function showEntry(){currentRoom=null;ready=false;activeRoundToken=null;clearTimeout(reactionTimer);clearInterval(poll);poll=null;roomEl.classList.add('hidden');entryEl.classList.remove('hidden');}
function renderPlayers(room){
 playersEl.innerHTML='';
 room.players.forEach(p=>{const row=document.createElement('div');row.className='player';const left=document.createElement('span');left.textContent=(p.isHost?'★ ':'')+p.name;const right=document.createElement('span');right.textContent=p.disconnected?'OFFLINE':(p.ready?'READY':'WAITING');right.className=p.ready?'good':(p.disconnected?'error':'muted');row.append(left,right);playersEl.appendChild(row);});
}
function renderResults(room){
 const rs=room.roundState;if(!rs||!rs.complete||!rs.results){resultsPanel.classList.add('hidden');return;}
 resultsPanel.classList.remove('hidden');reactionPanel.classList.add('hidden');votePanel.classList.add('hidden');resultsEl.innerHTML='';
 if(rs.gameId==='reaction'){
   rs.results.entries.forEach(e=>{const d=document.createElement('div');d.className='player';d.innerHTML='<span>#'+e.place+' '+e.name+'</span><strong>'+(e.flying?'FLYING':Number(e.reactionMs).toFixed(3)+' ms')+'</strong>';resultsEl.appendChild(d);});
 }else if(rs.gameId==='vote'){
   rs.results.entries.forEach(e=>{const d=document.createElement('div');d.className='player';d.innerHTML='<span>'+e.name+'</span><strong>'+e.votes+' vote'+(e.votes===1?'':'s')+'</strong>';resultsEl.appendChild(d);});
 }
}
function setupReaction(room){
 const rs=room.roundState;
 if(rs.complete){renderResults(room);return;}
 reactionPanel.classList.remove('hidden');votePanel.classList.add('hidden');resultsPanel.classList.add('hidden');
 if(rs.selfSubmitted){reactionMessage.textContent='LOCKED';reactionTap.disabled=true;reactionTap.textContent='WAIT FOR OTHERS';reactionState='submitted';return;}
 if(activeRoundToken===rs.token&&reactionState!=='idle')return;
 activeRoundToken=rs.token;clearTimeout(reactionTimer);reactionState='waiting';reactionMessage.textContent='WAIT';reactionTap.disabled=false;reactionTap.textContent='WAIT…';
 reactionTimer=setTimeout(()=>{if(reactionState!=='waiting')return;reactionState='shown';reactionShownAt=performance.now();reactionMessage.textContent='TAP!';reactionTap.textContent='TAP!';},Math.max(250,Number(rs.revealAfterMs)||1500));
}
function setupVote(room){
 const rs=room.roundState;reactionPanel.classList.add('hidden');votePanel.classList.remove('hidden');resultsPanel.classList.add('hidden');
 votePrompt.textContent=rs.prompt||'Vote';voteChoices.innerHTML='';
 if(rs.complete){renderResults(room);return;}
 if(rs.selfSubmitted){voteChoices.innerHTML='<div class="status good">Vote locked. Waiting for others.</div>';return;}
 room.players.filter(p=>!p.disconnected&&p.memberId!==room.selfMemberId).forEach(p=>{
   const b=document.createElement('button');b.className='secondary';b.textContent=p.name;b.onclick=()=>submitVote(rs.token,p.memberId);voteChoices.appendChild(b);
 });
}
function renderRoom(room){
 currentRoom=room;ready=room.selfReady===true;entryEl.classList.add('hidden');roomEl.classList.remove('hidden');roomCodeEl.textContent=room.code;renderPlayers(room);
 if(room.state==='lobby'){
   clearTimeout(reactionTimer);activeRoundToken=null;reactionState='idle';lobbyPanel.classList.remove('hidden');roundPanel.classList.add('hidden');
   gameEl.value=room.selectedGame||'reaction';gameEl.disabled=!room.isHost;startBtn.disabled=!room.isHost;readyBtn.disabled=false;readyBtn.textContent=ready?'UNREADY':'READY';status('Lobby ready.','good');
 }else{
   lobbyPanel.classList.add('hidden');roundPanel.classList.remove('hidden');lobbyBtn.classList.toggle('hidden',!room.isHost);status('Round '+room.round+' / '+room.selectedGame,'good');
   const rs=room.roundState;if(rs&&rs.gameId==='reaction')setupReaction(room);else if(rs&&rs.gameId==='vote')setupVote(room);
 }
}
async function refresh(){if(!currentRoom)return;const res=await FlecityBridge.call('partyGetRoom',{});if(!res.ok){if(res.error==='NOT_IN_ROOM')showEntry();else status('Room update failed: '+res.error,'error');return;}renderRoom(res.room);}
function beginPolling(){if(poll)clearInterval(poll);poll=setInterval(refresh,700);}
createBtn.onclick=async()=>{const res=await FlecityBridge.call('partyCreateRoom',{});if(!res.ok){status('Create failed: '+res.error,'error');return;}renderRoom(res.room);beginPolling();};
joinBtn.onclick=async()=>{const code=codeEl.value.replace(/\D/g,'').slice(0,4);const res=await FlecityBridge.call('partyJoinRoom',{code});if(!res.ok){status('Join failed: '+res.error,'error');return;}renderRoom(res.room);beginPolling();};
readyBtn.onclick=async()=>{ready=!ready;const res=await FlecityBridge.call('partySetReady',{ready});if(!res.ok){ready=!ready;status('Ready failed: '+res.error,'error');return;}renderRoom(res.room);};
gameEl.onchange=async()=>{const res=await FlecityBridge.call('partySelectGame',{gameId:gameEl.value});if(!res.ok){status('Game change failed: '+res.error,'error');await refresh();return;}renderRoom(res.room);};
startBtn.onclick=async()=>{const res=await FlecityBridge.call('partyStartRound',{});if(!res.ok){status('Start failed: '+res.error,'error');return;}renderRoom(res.room);};
reactionTap.onclick=async()=>{
 if(!currentRoom||!currentRoom.roundState||reactionState==='submitted')return;
 const rs=currentRoom.roundState;let payload={token:rs.token};
 if(reactionState==='waiting'){payload.flying=true;clearTimeout(reactionTimer);reactionMessage.textContent='FLYING!';}
 else if(reactionState==='shown'){payload.flying=false;payload.reactionMs=performance.now()-reactionShownAt;reactionMessage.textContent=payload.reactionMs.toFixed(3)+' ms';}
 else return;
 reactionState='submitted';reactionTap.disabled=true;const res=await FlecityBridge.call('partySubmitReaction',payload);if(!res.ok){status('Reaction rejected: '+res.error,'error');reactionState='idle';await refresh();return;}renderRoom(res.room);
};
async function submitVote(token,targetMemberId){voteChoices.querySelectorAll('button').forEach(b=>b.disabled=true);const res=await FlecityBridge.call('partySubmitVote',{token,targetMemberId});if(!res.ok){status('Vote failed: '+res.error,'error');await refresh();return;}renderRoom(res.room);}
lobbyBtn.onclick=async()=>{const res=await FlecityBridge.call('partyReturnLobby',{});if(!res.ok){status('Could not return: '+res.error,'error');return;}renderRoom(res.room);};
leaveBtn.onclick=async()=>{await FlecityBridge.call('partyLeaveRoom',{});showEntry();status('Left the room.');};
codeEl.oninput=()=>{codeEl.value=codeEl.value.replace(/\D/g,'').slice(0,4);};

async function bootstrap(){
 const res=await FlecityBridge.call('partyGetRoom',{});
 if(res.ok){
   renderRoom(res.room);beginPolling();
   if(res.reconnected)status('Room connection restored.','good');
   return;
 }
 showEntry();
 if(res.error!=='NOT_IN_ROOM')status('Could not restore room: '+res.error,'error');
}
bootstrap();
