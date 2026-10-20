const statusEl=document.getElementById('status'),gamesEl=document.getElementById('games'),homeEl=document.getElementById('home');
const quickEl=document.getElementById('quickTap'),tapMessage=document.getElementById('tapMessage'),tapButton=document.getElementById('tapButton'),tapBack=document.getElementById('tapBack');
const blockEl=document.getElementById('blockGame'),blockBoard=document.getElementById('blockBoard'),blockPieces=document.getElementById('blockPieces'),blockScore=document.getElementById('blockScore');
const blockBack=document.getElementById('blockBack'),blockNew=document.getElementById('blockNew'),blockFinish=document.getElementById('blockFinish');

let bootstrapData=null,saves={},tapState='idle',tapShownAt=0,tapStartedAt=0,tapTimer=null,tapSession=null,block=null;

const SHAPES=[
 [[0,0]],[[0,0],[1,0]],[[0,0],[1,0],[2,0]],[[0,0],[0,1]],[[0,0],[0,1],[0,2]],
 [[0,0],[1,0],[0,1],[1,1]],[[0,0],[0,1],[1,1]],[[1,0],[0,1],[1,1]],[[0,0],[1,0],[2,0],[1,1]]
];
function setStatus(text,type){statusEl.textContent=text;statusEl.className='status '+(type||'');}
function hideAll(){homeEl.classList.add('hidden');quickEl.classList.add('hidden');blockEl.classList.add('hidden');}
function showHome(){clearTimeout(tapTimer);tapState='idle';tapSession=null;hideAll();homeEl.classList.remove('hidden');renderGames(bootstrapData&&bootstrapData.games);}
function renderGames(games){
 gamesEl.innerHTML='';
 (games||[]).filter(g=>g.app==='play'&&g.enabled).forEach(game=>{
   const btn=document.createElement('button');btn.className='game';
   const hasSave=!!saves[game.id];
   btn.innerHTML='<span class="tag">'+game.category+'</span><strong>'+game.name+'</strong><span class="muted">'+(hasSave?'CONTINUE AVAILABLE · ':'')+game.description+'</span>';
   btn.onclick=()=>game.id==='quick_tap'?showQuick():game.id==='block'?openBlock(false):null;
   gamesEl.appendChild(btn);
 });
}
async function bootstrap(){
 const res=await FlecityBridge.call('playBootstrap',{});
 if(!res.ok){setStatus('Could not load PLAY: '+res.error,'error');return;}
 bootstrapData=res;saves={};(res.saves||[]).forEach(s=>saves[s.game_id]=s);renderGames(res.games);setStatus('PLAY reference CORE ready.','good');
}
function showQuick(){hideAll();quickEl.classList.remove('hidden');tapMessage.textContent='READY?';tapButton.textContent='START';tapButton.disabled=false;tapState='idle';}
tapButton.onclick=async()=>{
 if(tapState==='waiting'){
   clearTimeout(tapTimer);tapState='idle';tapMessage.textContent='FLYING!';tapButton.textContent='TRY AGAIN';
   if(tapSession)await FlecityBridge.call('playCancelSession',{sessionToken:tapSession.sessionToken});tapSession=null;return;
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
 tapButton.disabled=true;const res=await FlecityBridge.call('playStartSession',{gameId:'quick_tap'});
 if(!res.ok){tapButton.disabled=false;setStatus('Could not start: '+res.error,'error');return;}
 tapSession=res;tapState='waiting';tapStartedAt=performance.now();tapMessage.textContent='WAIT';tapButton.textContent='WAIT…';tapButton.disabled=false;
 tapTimer=setTimeout(()=>{if(tapState!=='waiting')return;tapState='shown';tapShownAt=performance.now();tapMessage.textContent='TAP!';tapButton.textContent='TAP!';},Math.max(250,Number(res.challenge&&res.challenge.delayMs)||1500));
};
tapBack.onclick=showHome;

function emptyBoard(){return Array.from({length:8},()=>Array(8).fill(0));}
function newPiece(){return {shape:Math.floor(Math.random()*SHAPES.length)};}
function refillPieces(){block.pieces=[newPiece(),newPiece(),newPiece()];block.selected=0;}
function elapsed(){return (block?block.elapsedBase:0)+(block?performance.now()-block.sessionStarted:0);}
function canPlace(piece,x,y){
 if(!piece)return false;
 for(const [dx,dy] of SHAPES[piece.shape]){const xx=x+dx,yy=y+dy;if(xx<0||xx>=8||yy<0||yy>=8||block.board[yy][xx])return false;}
 return true;
}
function anyFit(piece){for(let y=0;y<8;y++)for(let x=0;x<8;x++)if(canPlace(piece,x,y))return true;return false;}
function gameOver(){return block.pieces.filter(Boolean).every(p=>!anyFit(p));}
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
 if(!block||block.finished)return;
 const state={board:block.board,pieces:block.pieces,score:block.score,combo:block.combo};
 const res=await FlecityBridge.call('playSave',{gameId:'block',state,score:block.score,elapsedMs:Math.round(elapsed()),seed:String(block.seed||'')});
 if(res.ok)saves.block={game_id:'block',state,score:block.score,elapsed_ms:Math.round(elapsed()),seed:String(block.seed||'')};
}
function renderBlock(){
 blockScore.textContent=String(block.score);
 blockBoard.innerHTML='';
 for(let y=0;y<8;y++)for(let x=0;x<8;x++){
   const c=document.createElement('button');c.className='block-cell'+(block.board[y][x]?' filled':'');c.disabled=!!block.board[y][x];
   c.onclick=()=>placeBlock(x,y);blockBoard.appendChild(c);
 }
 blockPieces.innerHTML='';
 block.pieces.forEach((p,i)=>{
   const b=document.createElement('button');b.className='piece'+(block.selected===i?' selected':'');b.disabled=!p;
   if(p){const mini=document.createElement('div');mini.className='mini-piece';for(const [x,y] of SHAPES[p.shape]){const d=document.createElement('span');d.style.gridColumn=String(x+1);d.style.gridRow=String(y+1);mini.appendChild(d);}b.appendChild(mini);}
   else b.textContent='USED';
   b.onclick=()=>{block.selected=i;renderBlock();};blockPieces.appendChild(b);
 });
}
async function openBlock(forceNew){
 hideAll();blockEl.classList.remove('hidden');
 const session=await FlecityBridge.call('playStartSession',{gameId:'block'});
 if(!session.ok){setStatus('Could not start BLOCK: '+session.error,'error');showHome();return;}
 const saved=!forceNew&&saves.block;
 if(saved&&saved.state&&Array.isArray(saved.state.board)){
   block={board:saved.state.board,pieces:saved.state.pieces||[],score:Number(saved.state.score||saved.score||0),combo:Number(saved.state.combo||0),selected:0,
     elapsedBase:Number(saved.elapsed_ms||0),sessionStarted:performance.now(),sessionToken:session.sessionToken,seed:saved.seed||session.seed,finished:false};
   if(!block.pieces.length)refillPieces();setStatus('BLOCK continued from auto-save.','good');
 }else{
   block={board:emptyBoard(),pieces:[],score:0,combo:0,selected:0,elapsedBase:0,sessionStarted:performance.now(),sessionToken:session.sessionToken,seed:session.seed,finished:false};
   refillPieces();setStatus('New BLOCK run.','good');
 }
 renderBlock();
}
async function placeBlock(x,y){
 if(!block||block.finished)return;
 const piece=block.pieces[block.selected];
 if(!canPlace(piece,x,y)){setStatus('That piece does not fit there.','warn');return;}
 for(const [dx,dy] of SHAPES[piece.shape])block.board[y+dy][x+dx]=1;
 block.score+=SHAPES[piece.shape].length*10;
 block.pieces[block.selected]=null;clearLines();
 if(block.pieces.every(p=>!p))refillPieces();else{const next=block.pieces.findIndex(Boolean);if(next>=0)block.selected=next;}
 renderBlock();await persistBlock();
 if(gameOver()){setStatus('No pieces fit. Run complete.','warn');await finishBlock();}
}
async function finishBlock(){
 if(!block||block.finished)return;
 block.finished=true;
 const res=await FlecityBridge.call('playSubmitScore',{sessionToken:block.sessionToken,score:block.score,durationMs:Math.round(elapsed())});
 if(res.ok){delete saves.block;setStatus('BLOCK score saved: '+res.score,'good');}
 else{block.finished=false;setStatus('Could not finish BLOCK: '+res.error,'error');}
}
blockBack.onclick=async()=>{await persistBlock();showHome();};
blockNew.onclick=async()=>{if(block&&!block.finished)await FlecityBridge.call('playCancelSession',{sessionToken:block.sessionToken});await openBlock(true);};
blockFinish.onclick=finishBlock;
bootstrap();
