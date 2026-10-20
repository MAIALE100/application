const statusEl=document.getElementById('status'),gamesEl=document.getElementById('games'),homeEl=document.getElementById('home');
const rankingGame=document.getElementById('rankingGame'),rankingPeriod=document.getElementById('rankingPeriod'),rankingLoad=document.getElementById('rankingLoad'),rankingRows=document.getElementById('rankingRows');
const quickEl=document.getElementById('quickTap'),tapMessage=document.getElementById('tapMessage'),tapButton=document.getElementById('tapButton'),tapBack=document.getElementById('tapBack');
const stopEl=document.getElementById('stopGame'),stopMessage=document.getElementById('stopMessage'),stopButton=document.getElementById('stopButton'),stopBack=document.getElementById('stopBack'),stopTarget=document.getElementById('stopTarget'),stopMarker=document.getElementById('stopMarker');
const blockEl=document.getElementById('blockGame'),blockBoard=document.getElementById('blockBoard'),blockPieces=document.getElementById('blockPieces'),blockScore=document.getElementById('blockScore');
const blockBack=document.getElementById('blockBack'),blockNew=document.getElementById('blockNew'),blockFinish=document.getElementById('blockFinish');
const mergeEl=document.getElementById('mergeGame'),mergeBoard=document.getElementById('mergeBoard'),mergeScore=document.getElementById('mergeScore'),mergeBack=document.getElementById('mergeBack'),mergeNew=document.getElementById('mergeNew'),mergeFinish=document.getElementById('mergeFinish');
const mergeUp=document.getElementById('mergeUp'),mergeDown=document.getElementById('mergeDown'),mergeLeft=document.getElementById('mergeLeft'),mergeRight=document.getElementById('mergeRight');
const minesEl=document.getElementById('minesGame'),minesBoard=document.getElementById('minesBoard'),minesTime=document.getElementById('minesTime'),minesBack=document.getElementById('minesBack'),minesMode=document.getElementById('minesMode'),minesNew=document.getElementById('minesNew');

let bootstrapData=null,saves={};
let tapState='idle',tapShownAt=0,tapStartedAt=0,tapTimer=null,tapSession=null;
let stopState='idle',stopSession=null,stopStartedAt=0,stopRaf=null;
let block=null,merge=null,mines=null,minesClock=null;

const SHAPES=[
 [[0,0]],[[0,0],[1,0]],[[0,0],[1,0],[2,0]],[[0,0],[0,1]],[[0,0],[0,1],[0,2]],
 [[0,0],[1,0],[0,1],[1,1]],[[0,0],[0,1],[1,1]],[[1,0],[0,1],[1,1]],[[0,0],[1,0],[2,0],[1,1]]
];

function setStatus(text,type){statusEl.textContent=text;statusEl.className='status '+(type||'');}
function hideAll(){homeEl.classList.add('hidden');quickEl.classList.add('hidden');stopEl.classList.add('hidden');blockEl.classList.add('hidden');mergeEl.classList.add('hidden');minesEl.classList.add('hidden');}
function showHome(){
 clearTimeout(tapTimer);cancelAnimationFrame(stopRaf);clearInterval(minesClock);minesClock=null;
 tapState='idle';tapSession=null;stopState='idle';stopSession=null;
 hideAll();homeEl.classList.remove('hidden');renderGames(bootstrapData&&bootstrapData.games);
}
function renderGames(games){
 gamesEl.innerHTML='';
 (games||[]).filter(g=>g.app==='play'&&g.enabled).forEach(game=>{
   const btn=document.createElement('button');btn.className='game';
   const hasSave=!!saves[game.id];
   btn.innerHTML='<span class="tag">'+game.category+'</span><strong>'+game.name+'</strong><span class="muted">'+(hasSave?'CONTINUE AVAILABLE · ':'')+game.description+'</span>';
   btn.onclick=()=>{
     if(game.id==='quick_tap')showQuick();
     else if(game.id==='stop')openStop();
     else if(game.id==='block')openBlock(false);
     else if(game.id==='merge')openMerge(false);
     else if(game.id==='mines')openMines(false);
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
 rankingLoad.disabled=true;rankingRows.innerHTML='<div class="muted">Loading…</div>';
 const res=await FlecityBridge.call('playRanking',{gameId,period:rankingPeriod.value});
 rankingLoad.disabled=false;rankingRows.innerHTML='';
 if(!res.ok){rankingRows.innerHTML='<div class="status error">Ranking failed: '+res.error+'</div>';return;}
 if(!(res.rows||[]).length){rankingRows.innerHTML='<div class="muted">No scores yet.</div>';return;}
 res.rows.forEach((r,i)=>{const d=document.createElement('div');d.className='player';d.innerHTML='<span>#'+(i+1)+' '+String(r.display_name||'Player')+'</span><strong>'+Number(r.score)+'</strong>';rankingRows.appendChild(d);});
}
rankingLoad.onclick=loadRanking;
rankingGame.onchange=()=>{rankingRows.innerHTML='';};
rankingPeriod.onchange=()=>{rankingRows.innerHTML='';};
async function bootstrap(){
 const res=await FlecityBridge.call('playBootstrap',{});
 if(!res.ok){setStatus('Could not load PLAY: '+res.error,'error');return;}
 bootstrapData=res;saves={};(res.saves||[]).forEach(s=>saves[s.game_id]=s);renderGames(res.games);populateRankingGames(res.games);setStatus('PLAY ready.','good');
}

/* QUICK TAP */
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
function openStop(){
 hideAll();stopEl.classList.remove('hidden');stopState='idle';stopSession=null;stopMessage.textContent='READY?';stopButton.textContent='START';stopButton.disabled=false;stopMarker.style.left='0%';stopTarget.style.left='50%';
}
stopButton.onclick=async()=>{
 if(stopState==='running'){
   stopState='submitting';cancelAnimationFrame(stopRaf);stopButton.disabled=true;
   const actionMs=Math.max(0,Math.round(performance.now()-stopStartedAt));
   const res=await FlecityBridge.call('playSubmitScore',{sessionToken:stopSession.sessionToken,score:0,durationMs:actionMs,actionMs});
   if(res.ok){
     const distance=res.details&&Number(res.details.distancePct);
     stopMessage.textContent=String(res.score);
     setStatus('STOP! score '+res.score+(Number.isFinite(distance)?' / '+distance.toFixed(2)+'% away':''),'good');
   }else{stopMessage.textContent='NOT SAVED';setStatus('STOP! rejected: '+res.error,'error');}
   stopSession=null;stopState='idle';stopButton.disabled=false;stopButton.textContent='AGAIN';return;
 }
 if(stopState!=='idle')return;
 stopButton.disabled=true;
 const res=await FlecityBridge.call('playStartSession',{gameId:'stop'});
 if(!res.ok){stopButton.disabled=false;setStatus('Could not start STOP!: '+res.error,'error');return;}
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
function newPiece(){return {shape:Math.floor(Math.random()*SHAPES.length)};}
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
 if(!block||block.finished)return;
 const state={board:block.board,pieces:block.pieces,score:block.score,combo:block.combo};
 const elapsedMs=Math.round(elapsedBlock());
 const res=await FlecityBridge.call('playSave',{gameId:'block',state,score:block.score,elapsedMs,seed:String(block.seed||'')});
 if(res.ok)saves.block={game_id:'block',state,score:block.score,elapsed_ms:elapsedMs,seed:String(block.seed||'')};
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
 block.score+=SHAPES[piece.shape].length*10;block.pieces[block.selected]=null;clearLines();
 if(block.pieces.every(p=>!p))refillPieces();else{const next=block.pieces.findIndex(Boolean);if(next>=0)block.selected=next;}
 renderBlock();await persistBlock();
 if(blockGameOver()){setStatus('No pieces fit. Run complete.','warn');await finishBlock();}
}
async function finishBlock(){
 if(!block||block.finished)return;
 block.finished=true;
 const res=await FlecityBridge.call('playSubmitScore',{sessionToken:block.sessionToken,score:block.score,durationMs:Math.round(elapsedBlock())});
 if(res.ok){delete saves.block;setStatus('BLOCK score saved: '+res.score,'good');}
 else{block.finished=false;setStatus('Could not finish BLOCK: '+res.error,'error');}
}
blockBack.onclick=async()=>{
 await persistBlock();
 if(block&&!block.finished)await FlecityBridge.call('playCancelSession',{sessionToken:block.sessionToken});
 block=null;showHome();
};
blockNew.onclick=async()=>{
 if(block&&!block.finished)await FlecityBridge.call('playCancelSession',{sessionToken:block.sessionToken});
 const reset=await FlecityBridge.call('playResetSave',{gameId:'block'});
 if(!reset.ok){setStatus('Could not reset BLOCK save: '+reset.error,'error');return;}
 delete saves.block;block=null;await openBlock(true);
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
 const state={board:merge.board,score:merge.score,moves:merge.moves,rngState:merge.rngState};
 const elapsedMs=Math.round(elapsedMerge());
 const res=await FlecityBridge.call('playSave',{gameId:'merge',state,score:merge.score,elapsedMs,seed:String(merge.seed||'')});
 if(res.ok)saves.merge={game_id:'merge',state,score:merge.score,elapsed_ms:elapsedMs,seed:String(merge.seed||'')};
}
async function openMerge(forceNew){
 hideAll();mergeEl.classList.remove('hidden');
 const session=await FlecityBridge.call('playStartSession',{gameId:'merge'});
 if(!session.ok){setStatus('Could not start MERGE: '+session.error,'error');showHome();return;}
 const saved=!forceNew&&saves.merge;
 if(saved&&saved.state&&Array.isArray(saved.state.board)&&saved.state.board.length===4){
   merge={board:saved.state.board,score:Number(saved.state.score||saved.score||0),moves:Number(saved.state.moves||0),rngState:Number(saved.state.rngState||saved.seed||session.seed),
     elapsedBase:Number(saved.elapsed_ms||0),sessionStarted:performance.now(),sessionToken:session.sessionToken,seed:saved.seed||session.seed,finished:false};
   setStatus('MERGE continued from auto-save.','good');
 }else{
   merge={board:emptyMergeBoard(),score:0,moves:0,rngState:Number(session.seed)||1,elapsedBase:0,sessionStarted:performance.now(),sessionToken:session.sessionToken,seed:session.seed,finished:false};
   spawnMergeTile();spawnMergeTile();setStatus('New MERGE run.','good');
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
 if(before===JSON.stringify(merge.board)){setStatus('No tiles moved.','warn');return;}
 merge.moves+=1;spawnMergeTile();renderMerge();await persistMerge();
 if(mergeGameOver()){setStatus('No more moves. Run complete.','warn');await finishMerge();}
}
async function finishMerge(){
 if(!merge||merge.finished)return;
 merge.finished=true;
 const res=await FlecityBridge.call('playSubmitScore',{sessionToken:merge.sessionToken,score:merge.score,durationMs:Math.round(elapsedMerge())});
 if(res.ok){delete saves.merge;setStatus('MERGE score saved: '+res.score,'good');}
 else{merge.finished=false;setStatus('Could not finish MERGE: '+res.error,'error');}
}
mergeBack.onclick=async()=>{
 await persistMerge();
 if(merge&&!merge.finished)await FlecityBridge.call('playCancelSession',{sessionToken:merge.sessionToken});
 merge=null;showHome();
};
mergeNew.onclick=async()=>{
 if(merge&&!merge.finished)await FlecityBridge.call('playCancelSession',{sessionToken:merge.sessionToken});
 const reset=await FlecityBridge.call('playResetSave',{gameId:'merge'});
 if(!reset.ok){setStatus('Could not reset MERGE save: '+reset.error,'error');return;}
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
 minesMode.textContent='MODE: '+(mines.mode==='flag'?'FLAG':'REVEAL');
}
async function persistMines(){
 if(!mines||mines.finished)return;
 const state={revealed:[...mines.revealed],flags:[...mines.flags],mode:mines.mode};
 const elapsedMs=Math.round(elapsedMines());
 const res=await FlecityBridge.call('playSave',{gameId:'mines',state,score:elapsedMs,elapsedMs,seed:String(mines.seed)});
 if(res.ok)saves.mines={game_id:'mines',state,score:elapsedMs,elapsed_ms:elapsedMs,seed:String(mines.seed)};
}
async function openMines(forceNew){
 hideAll();minesEl.classList.remove('hidden');clearInterval(minesClock);
 const saved=!forceNew&&saves.mines;
 const payload={gameId:'mines'};if(saved&&saved.seed)payload.resumeSeed=Number(saved.seed);
 const session=await FlecityBridge.call('playStartSession',payload);
 if(!session.ok){setStatus('Could not start MINES: '+session.error,'error');showHome();return;}
 const size=Number(session.challenge&&session.challenge.size)||8,mineCount=Number(session.challenge&&session.challenge.mines)||10;
 if(saved&&saved.state){
   mines={size,mineCount,seed:Number(saved.seed)||Number(session.seed),mineSet:null,revealed:new Set(saved.state.revealed||[]),flags:new Set(saved.state.flags||[]),mode:saved.state.mode==='flag'?'flag':'reveal',
     elapsedBase:Number(saved.elapsed_ms||0),sessionStarted:performance.now(),sessionToken:session.sessionToken,finished:false,lost:false};
   setStatus('MINES continued from auto-save.','good');
 }else{
   mines={size,mineCount,seed:Number(session.seed),mineSet:null,revealed:new Set(),flags:new Set(),mode:'reveal',elapsedBase:0,sessionStarted:performance.now(),sessionToken:session.sessionToken,finished:false,lost:false};
   setStatus('New MINES board.','good');
 }
 mines.mineSet=seededMines(mines.seed,mines.size,mines.mineCount);renderMines();minesClock=setInterval(updateMinesTime,250);
}
async function loseMines(index){
 if(!mines||mines.finished)return;mines.finished=true;mines.lost=true;clearInterval(minesClock);renderMines();setStatus('Mine hit. Run ended.','warn');
 if(mines.sessionToken)await FlecityBridge.call('playCancelSession',{sessionToken:mines.sessionToken});
 await FlecityBridge.call('playResetSave',{gameId:'mines'});delete saves.mines;mines.sessionToken=null;
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
 if(res.ok){delete saves.mines;setStatus('MINES cleared in '+(Number(res.score)/1000).toFixed(2)+'s','good');mines.sessionToken=null;}
 else{mines.finished=false;minesClock=setInterval(updateMinesTime,250);setStatus('MINES clear rejected: '+res.error,'error');}
 renderMines();
}
minesMode.onclick=()=>{if(!mines||mines.finished)return;mines.mode=mines.mode==='flag'?'reveal':'flag';renderMines();};
minesBack.onclick=async()=>{
 clearInterval(minesClock);minesClock=null;
 if(mines&&!mines.finished){await persistMines();if(mines.sessionToken)await FlecityBridge.call('playCancelSession',{sessionToken:mines.sessionToken});}
 mines=null;showHome();
};
minesNew.onclick=async()=>{
 clearInterval(minesClock);minesClock=null;
 if(mines&&!mines.finished&&mines.sessionToken)await FlecityBridge.call('playCancelSession',{sessionToken:mines.sessionToken});
 const reset=await FlecityBridge.call('playResetSave',{gameId:'mines'});if(!reset.ok){setStatus('Could not reset MINES: '+reset.error,'error');return;}
 delete saves.mines;mines=null;await openMines(true);
};

bootstrap();
