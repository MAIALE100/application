(()=>{
const SHAPES=[
 [[0,0],[1,0],[2,0],[3,0]],
 [[0,0],[1,0],[0,1],[1,1]],
 [[1,0],[0,1],[1,1],[2,1]],
 [[1,0],[2,0],[0,1],[1,1]],
 [[0,0],[1,0],[1,1],[2,1]],
 [[0,0],[0,1],[1,1],[2,1]],
 [[2,0],[0,1],[1,1],[2,1]]
];
const LINE_POINTS=[0,100,300,500,800];
let game=null,gravityClock=null,deadlineClock=null,serverOffsetMs=0;

function el(id){return document.getElementById(id);}
function seededNext(state){
 let x=Math.floor(Number(state)||1)%2147483647;if(x<=0)x=1;
 x=(x*16807)%2147483647;return [x,(x-1)/2147483646];
}
function nextPiece(state){let value;[state,value]=seededNext(state);return [state,1+Math.floor(value*SHAPES.length)];}
function shapeFor(pieceType,rotation){
 const base=SHAPES[Math.floor(Number(pieceType)||0)-1];if(!base)return [];
 let shape=base.map(([x,y])=>[x,y]),turns=((Math.floor(Number(rotation)||0)%4)+4)%4;
 for(let i=0;i<turns;i++)shape=shape.map(([x,y])=>[-y,x]);
 let minX=Infinity,minY=Infinity;shape.forEach(([x,y])=>{minX=Math.min(minX,x);minY=Math.min(minY,y);});
 return shape.map(([x,y])=>[x-minX,y-minY]);
}
function emptyBoard(w,h){return Array.from({length:h},()=>Array(w).fill(0));}
function canPlace(board,w,h,shape,x,y){
 return shape.every(([dx,dy])=>{const gx=x+dx,gy=y+dy;return gx>=0&&gx<w&&gy>=0&&gy<h&&Number(board[gy]?.[gx]||0)===0;});
}
function dropY(board,w,h,shape,x){
 if(!canPlace(board,w,h,shape,x,0))return null;
 let y=0;while(canPlace(board,w,h,shape,x,y+1))y++;return y;
}
function clearLines(board,w){
 let cleared=0,y=board.length-1;
 while(y>=0){
   if(board[y].every(v=>Number(v)!==0)){board.splice(y,1);board.unshift(Array(w).fill(0));cleared++;}
   else y--;
 }
 return cleared;
}
function findPlacement(board,w,h,pieceType){
 for(let rotation=0;rotation<4;rotation++){
   const shape=shapeFor(pieceType,rotation);
   for(let x=0;x<w;x++)if(dropY(board,w,h,shape,x)!==null)return {x,rotation};
 }
 return null;
}
function serverNow(){return performance.now()+serverOffsetMs;}
function updateOffset(room){if(Number.isFinite(Number(room?.serverTick)))serverOffsetMs=Number(room.serverTick)-performance.now();}
function gravityDelay(){const level=Math.min(8,1+Math.floor((Number(game?.lines)||0)/5));return Math.max(230,900-((level-1)*95));}
function resetCursor(){
 if(!game||game.ended)return false;
 const shape=shapeFor(game.nextPiece,0),pieceW=Math.max(...shape.map(([x])=>x),0)+1;
 game.rotation=0;game.x=Math.max(0,Math.floor((game.width-pieceW)/2));game.y=0;game.groundedAt=null;game.lastGravityAt=performance.now();
 if(dropY(game.board,game.width,game.height,shape,game.x)!==null)return true;
 const found=findPlacement(game.board,game.width,game.height,game.nextPiece);
 if(!found){game.ended=true;return false;}
 game.x=found.x;game.rotation=found.rotation;return true;
}
function drawBoard(){
 const boardEl=el('fallBattleBoard');if(!game||!boardEl)return;
 boardEl.innerHTML='';
 const shape=!game.ended?shapeFor(game.nextPiece,game.rotation):[];
 const ghostY=!game.ended?dropY(game.board,game.width,game.height,shape,game.x):null;
 const active=new Set(),ghost=new Set();
 if(!game.ended){
   const yy=Math.max(0,Math.floor(Number(game.y)||0));
   shape.forEach(([dx,dy])=>{
     const ax=game.x+dx,ay=yy+dy;if(ay>=0&&ay<game.height)active.add(ax+','+ay);
     if(ghostY!==null){const gy=ghostY+dy;if(gy>=0&&gy<game.height)ghost.add(ax+','+gy);}
   });
 }
 for(let y=0;y<game.height;y++)for(let x=0;x<game.width;x++){
   const s=document.createElement('span'),v=Number(game.board[y][x]||0),key=x+','+y;
   let cls='fall-cell';
   if(v)cls+=' filled fall-piece-'+v;
   else if(active.has(key))cls+=' active fall-piece-'+game.nextPiece;
   else if(ghost.has(key))cls+=' ghost fall-piece-'+game.nextPiece;
   s.className=cls;boardEl.appendChild(s);
 }
 const score=el('fallBattleScore'),meta=el('fallBattleMeta'),hint=el('fallBattleHint');
 if(score)score.textContent=String(game.score)+' pt';
 if(meta)meta.textContent='LINES '+game.lines+' · PIECES '+game.pieces+' · FINISH '+game.finishedCount+'/'+game.expectedCount+' · '+(game.submitted?'送信済み':(game.ended?'GAME OVER':'PLAY'));
 if(hint){
   if(game.submitted)hint.textContent='記録送信済み · 他の参加者を待っています。';
   else if(game.ended)hint.textContent='GAME OVER · 記録を送信します。';
   else hint.textContent='全員同じピース列。90秒以内にできるだけ高いスコアを狙ってください。';
 }
 const locked=game.submitted||game.ended;
 ['fallBattleLeft','fallBattleRight','fallBattleRotate','fallBattleSoft','fallBattleDrop','fallBattleHold'].forEach(id=>{const b=el(id);if(b)b.disabled=locked;});
}
function move(dx){
 if(!game||game.submitted||game.ended)return;
 const shape=shapeFor(game.nextPiece,game.rotation),nextX=game.x+dx,landing=dropY(game.board,game.width,game.height,shape,nextX);
 if(landing!==null&&landing>=game.y){game.x=nextX;game.groundedAt=null;drawBoard();}
}
function rotate(){
 if(!game||game.submitted||game.ended)return;
 const next=(game.rotation+1)%4,shape=shapeFor(game.nextPiece,next);
 for(const off of [0,-1,1,-2,2]){
   const x=game.x+off,landing=dropY(game.board,game.width,game.height,shape,x);
   if(landing!==null&&landing>=game.y){game.rotation=next;game.x=x;game.groundedAt=null;drawBoard();return;}
 }
}
function hold(){
 if(!game||game.submitted||game.ended||game.holdUsed)return;
 const current=game.nextPiece;
 if(game.heldPiece){game.nextPiece=game.heldPiece;game.heldPiece=current;}
 else{game.heldPiece=current;[game.rngState,game.nextPiece]=nextPiece(game.rngState);}
 game.holdUsed=true;resetCursor();drawBoard();
}
function applyPlacement(){
 if(!game||game.submitted||game.ended)return false;
 const now=serverNow(),actionMs=Math.max(0,Math.floor(now-game.startedTick));
 if(game.lastLockMs>=0&&actionMs-game.lastLockMs<75)return false;
 const shape=shapeFor(game.nextPiece,game.rotation),landing=dropY(game.board,game.width,game.height,shape,game.x);
 if(landing===null){game.ended=true;drawBoard();return false;}
 shape.forEach(([dx,dy])=>{game.board[landing+dy][game.x+dx]=game.nextPiece;});
 const cleared=clearLines(game.board,game.width);
 game.combo=cleared>0?game.combo+1:0;
 const level=Math.min(8,1+Math.floor(game.lines/5));
 game.score+=10+(landing*2)+((LINE_POINTS[cleared]??cleared*250)*(cleared>0?Math.max(1,game.combo):1)*level);
 game.lines+=cleared;game.pieces++;game.history.push({x:game.x,rotation:game.rotation,hold:game.holdUsed===true,t:actionMs});game.lastLockMs=actionMs;
 [game.rngState,game.nextPiece]=nextPiece(game.rngState);game.holdUsed=false;
 game.ended=findPlacement(game.board,game.width,game.height,game.nextPiece)===null;
 if(!game.ended)resetCursor();
 drawBoard();
 if(game.ended)void submit();
 return true;
}
function hardDrop(){void applyPlacement();}
function softDrop(){
 if(!game||game.submitted||game.ended)return;
 const shape=shapeFor(game.nextPiece,game.rotation),landing=dropY(game.board,game.width,game.height,shape,game.x);
 if(landing!==null&&game.y<landing){game.y++;game.groundedAt=null;drawBoard();}
 else void applyPlacement();
}
function stopClocks(){clearInterval(gravityClock);gravityClock=null;clearInterval(deadlineClock);deadlineClock=null;}
function startClocks(){
 stopClocks();
 gravityClock=setInterval(()=>{
   if(!game||game.submitted||game.ended)return;
   const shape=shapeFor(game.nextPiece,game.rotation),landing=dropY(game.board,game.width,game.height,shape,game.x),now=performance.now();
   if(landing===null){game.ended=true;drawBoard();void submit();return;}
   if(game.y<landing){
     game.groundedAt=null;
     if(now-game.lastGravityAt>=gravityDelay()){game.y++;game.lastGravityAt=now;drawBoard();}
   }else if(game.groundedAt==null)game.groundedAt=now;
   else if(now-game.groundedAt>=450)void applyPlacement();
 },50);
 deadlineClock=setInterval(()=>{
   if(!game||game.submitted)return;
   if(serverNow()>=game.deadlineTick){
     stopClocks();
     if(game.history.length)void submit();
     else {game.ended=true;drawBoard();}
   }
 },100);
}
async function submit(){
 if(!game||game.submitted||game.submitting||!game.history.length)return;
 game.submitting=true;
 try{
   const res=await FlecityBridge.call('partySubmitFallBattle',{token:game.token,history:game.history});
   if(res.ok){game.submitted=true;stopClocks();drawBoard();}
   else if(res.error==='ROUND_COMPLETE'||res.error==='ALREADY_SUBMITTED'){game.submitted=true;stopClocks();drawBoard();}
 }finally{if(game)game.submitting=false;}
}
let keyboardBound=false;
function bind(){
 if(!keyboardBound&&globalThis.FlecityGamesControls){
   keyboardBound=true;
   FlecityGamesControls.bindArrowKeys({
     isActive:()=>!!game&&!game.submitted&&!game.ended&&
       !!el('fallBattlePanel')&&!el('fallBattlePanel').classList.contains('hidden'),
     onLeft:()=>move(-1),
     onRight:()=>move(1),
     onUp:rotate,
     onDownStart:softDrop,
     onDownRepeat:softDrop
   });
 }
 const map={fallBattleLeft:()=>move(-1),fallBattleRight:()=>move(1),fallBattleRotate:rotate,fallBattleSoft:softDrop,fallBattleDrop:hardDrop,fallBattleHold:hold};
 Object.entries(map).forEach(([id,fn])=>{const b=el(id);if(b&&!b.dataset.bound){b.dataset.bound='1';b.onclick=fn;}});
 const board=el('fallBattleBoard');
 if(board&&!board.dataset.bound){
   board.dataset.bound='1';let pointer=null;
   board.onpointerdown=e=>{if(!game||game.submitted||game.ended)return;pointer={x:e.clientX,y:e.clientY,id:e.pointerId};try{board.setPointerCapture(e.pointerId);}catch(_){}};
   board.onpointerup=e=>{
     if(!pointer||pointer.id!==e.pointerId)return;const dx=e.clientX-pointer.x,dy=e.clientY-pointer.y;pointer=null;try{board.releasePointerCapture(e.pointerId);}catch(_){}
     if(Math.max(Math.abs(dx),Math.abs(dy))<18)rotate();
     else if(Math.abs(dy)>Math.abs(dx)&&dy>34)hardDrop();
     else if(Math.abs(dx)>24)move(dx>0?1:-1);
   };
   board.onpointercancel=()=>{pointer=null;};
 }
}
function render(room){
 const rs=room?.roundState,panel=el('fallBattlePanel');if(!rs||rs.gameId!=='fall_battle'||!panel)return;
 bind();panel.classList.remove('hidden');updateOffset(room);
 if(!game||game.token!==rs.token){
   stopClocks();
   let rngState,next;[rngState,next]=nextPiece(Number(rs.seed)||1);
   game={token:rs.token,width:Number(rs.width)||10,height:Number(rs.height)||18,seed:Number(rs.seed)||1,rngState,nextPiece:next,heldPiece:0,holdUsed:false,
     board:emptyBoard(Number(rs.width)||10,Number(rs.height)||18),score:0,lines:0,combo:0,pieces:0,history:[],x:0,y:0,rotation:0,
     startedTick:Number(rs.startedTick)||0,deadlineTick:Number(rs.deadlineTick)||0,lastGravityAt:performance.now(),groundedAt:null,lastLockMs:-1,submitted:false,submitting:false,ended:false,
     finishedCount:Number(rs.submittedCount)||0,expectedCount:Math.max(1,Number(rs.expectedSubmissions)||Number(room.connectedCount)||1)};
   resetCursor();startClocks();
 }
 game.deadlineTick=Number(rs.deadlineTick)||game.deadlineTick;
 game.finishedCount=Math.max(0,Number(rs.submittedCount)||0);
 game.expectedCount=Math.max(1,Number(rs.expectedSubmissions)||Number(room.connectedCount)||1);
 if(rs.selfSubmitted===true&&!game.submitted){game.submitted=true;stopClocks();}
 if(rs.complete){game.submitted=true;stopClocks();}
 drawBoard();
}
function hide(){const panel=el('fallBattlePanel');if(panel)panel.classList.add('hidden');}
function reset(){stopClocks();game=null;hide();}
globalThis.PartyFallBattle={render,hide,reset};
})();