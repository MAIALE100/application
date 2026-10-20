const statusEl=document.getElementById('status');
const entryEl=document.getElementById('entry');
const roomEl=document.getElementById('room');
const roomCodeEl=document.getElementById('roomCode');
const playersEl=document.getElementById('players');
const codeEl=document.getElementById('code');
const createBtn=document.getElementById('create');
const joinBtn=document.getElementById('join');
const leaveBtn=document.getElementById('leave');
const readyBtn=document.getElementById('ready');
const startBtn=document.getElementById('start');
const lobbyBtn=document.getElementById('lobby');
const gameEl=document.getElementById('game');

let currentRoom=null,ready=false,poll=null;
function status(text,type){statusEl.textContent=text;statusEl.className='status '+(type||'');}
function showEntry(){currentRoom=null;ready=false;clearInterval(poll);poll=null;roomEl.classList.add('hidden');entryEl.classList.remove('hidden');}
function renderRoom(room){
  currentRoom=room;ready=room.selfReady===true;entryEl.classList.add('hidden');roomEl.classList.remove('hidden');roomCodeEl.textContent=room.code;
  readyBtn.textContent=ready?'UNREADY':'READY';
  gameEl.value=room.selectedGame||'reaction';gameEl.disabled=!room.isHost||room.state!=='lobby';
  startBtn.disabled=!room.isHost||room.state!=='lobby';lobbyBtn.classList.toggle('hidden',!room.isHost||room.state==='lobby');readyBtn.disabled=room.state!=='lobby';
  playersEl.innerHTML='';
  room.players.forEach(p=>{
    const row=document.createElement('div');row.className='player';
    const left=document.createElement('span');left.textContent=(p.isHost?'★ ':'')+p.name;
    const right=document.createElement('span');right.textContent=p.disconnected?'OFFLINE':(p.ready?'READY':'WAITING');right.className=p.ready?'good':(p.disconnected?'error':'muted');
    row.append(left,right);playersEl.appendChild(row);
  });
  status(room.state==='lobby'?'Lobby ready.':'Round '+room.round+' / '+room.selectedGame,'good');
}
async function refresh(){
  if(!currentRoom)return;
  const res=await FlecityBridge.call('partyGetRoom',{});
  if(!res.ok){if(res.error==='NOT_IN_ROOM')showEntry();else status('Room update failed: '+res.error,'error');return;}
  renderRoom(res.room);
}
function beginPolling(){if(poll)clearInterval(poll);poll=setInterval(refresh,2000);}
createBtn.onclick=async()=>{const res=await FlecityBridge.call('partyCreateRoom',{});if(!res.ok){status('Create failed: '+res.error,'error');return;}renderRoom(res.room);beginPolling();};
joinBtn.onclick=async()=>{const code=codeEl.value.replace(/\D/g,'').slice(0,4);const res=await FlecityBridge.call('partyJoinRoom',{code});if(!res.ok){status('Join failed: '+res.error,'error');return;}renderRoom(res.room);beginPolling();};
readyBtn.onclick=async()=>{ready=!ready;const res=await FlecityBridge.call('partySetReady',{ready});if(!res.ok){ready=!ready;status('Ready failed: '+res.error,'error');return;}renderRoom(res.room);};
gameEl.onchange=async()=>{const res=await FlecityBridge.call('partySelectGame',{gameId:gameEl.value});if(!res.ok){status('Game change failed: '+res.error,'error');await refresh();return;}ready=false;renderRoom(res.room);};
startBtn.onclick=async()=>{const res=await FlecityBridge.call('partyStartRound',{});if(!res.ok){status('Start failed: '+res.error,'error');return;}ready=false;renderRoom(res.room);status('Round engine started. Reference gameplay is Phase 2.','warn');};
lobbyBtn.onclick=async()=>{const res=await FlecityBridge.call('partyReturnLobby',{});if(!res.ok){status('Could not return: '+res.error,'error');return;}ready=false;renderRoom(res.room);};
leaveBtn.onclick=async()=>{await FlecityBridge.call('partyLeaveRoom',{});showEntry();status('Left the room.');};
codeEl.oninput=()=>{codeEl.value=codeEl.value.replace(/\D/g,'').slice(0,4);};
