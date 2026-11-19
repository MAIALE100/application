import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';

export const copy = value => structuredClone(value);
export function registry(source) {
  return fs.readFileSync(path.join(source,'shared/game_registry.lua'),'utf8').split('\n')
    .filter(line=>line.includes("app='party'"))
    .map((line,index)=>({id:line.match(/id='([^']+)'/)[1],name:line.match(/name='([^']+)'/)[1],
      description:line.match(/description='([^']+)'/)?.[1]||'',minPlayers:Number(line.match(/minPlayers=(\d+)/)[1]),
      maxPlayers:Number(line.match(/maxPlayers=(\d+)/)[1]),premium:index>=10}));
}
export function makeRoom(overrides={}) {
  const players=[{memberId:'self',name:'テスト太郎',isHost:true,ready:false,appOpen:true,disconnected:false},
    {memberId:'friend',name:'花子',isHost:false,ready:true,appOpen:true,disconnected:false}];
  return {code:'2468',revision:1,state:'lobby',selectedGame:'code_break',isHost:true,selfMemberId:'self',
    selfReady:false,connectedCount:2,hostPlusActive:true,serverTick:1000,players,
    mastermindOptions:{aiDifficulty:'normal',allowDuplicates:true,turnLimit:true,firstTurn:'random'},
    shogiOptions:{aiDifficulty:'hard'},aiOptions:{enabled:false,count:0,difficulty:'normal'},...overrides};
}
export function roundState(id) {
  const common={gameId:id,token:'fixture-'+id,complete:false,isCurrent:true,serverTick:1000,
    expectedSubmissions:2,submittedCount:0,deadlineTick:91000};
  const states={
    code_break:{aiEnabled:true,attemptsLeft:8,history:[],aiHistory:[]},
    reversi:{board:Array(64).fill(''),validMoves:[20],isCurrent:true,mark:'B',blackCount:2,whiteCount:2},
    vote:{prompt:'一番おもしろい人は？',eligibleMembers:[{memberId:'friend',name:'花子'}]},
    gomoku:{board:Array(121).fill(''),isCurrent:true,mark:'B',size:11},
    connect4:{board:Array(42).fill(''),isCurrent:true,mark:'R',validColumns:[1,2,3,4,5,6,7]},
    mini_shogi:{board:Array(81).fill(''),isCurrent:true,side:'B',legalMoves:[],hands:{B:{P:1},W:{}}},
    word_wolf:{secretTopic:'りんご',phase:'discuss',voteStartsTick:1000,discussionUntilTick:1000},
    liar:{prompt:'好きな季節は？',role:'HONEST',phase:'discuss',voteStartsTick:1000},
    draw:{isDrawer:true,drawerMemberId:'self',prompt:'ねこ',strokes:[],drawIndex:1,drawPhase:'draw'},
    telephone:{step:1,totalSteps:3,currentMemberId:'self',isCurrent:true,mode:'draw',promptText:'ねこ'},
    ng_word:{phase:'clue',isExplainer:true,explainerMemberId:'self',targetWord:'りんご',forbiddenWords:['赤い','果物']},
    fake_answer:{phase:'submit',question:'世界で一番長い川は？'},
    bomb:{currentMemberId:'self',isCurrent:true,prompt:'動物の名前',passes:0},
    memory_chain:{phase:'input',stage:1,maxStages:8,sequenceLength:2,aliveCount:2},
    fall_battle:{seed:42,width:10,height:18,startedTick:1000,deadlineTick:91000},
  };
  assert(states[id],'Unknown fixture game '+id);return {...common,...states[id]};
}
export async function staticServer(root) {
  const resolved=path.resolve(root);
  const server=http.createServer((req,res)=>{
    try {
      const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
      const file=path.resolve(resolved,'.'+pathname),relative=path.relative(resolved,file);
      if(relative.startsWith('..')||path.isAbsolute(relative))throw Error('outside fixture root');
      const ext=path.extname(file);
      const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.woff2':'font/woff2'};
      if(!types[ext])throw Error('type blocked');
      res.setHeader('Content-Type',types[ext]);res.setHeader('Cache-Control','no-store');res.end(fs.readFileSync(file));
    } catch {res.writeHead(404);res.end('fixture asset unavailable');}
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  return {origin:'http://127.0.0.1:'+server.address().port,close:async()=>{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}};
}
export async function fixture(browser,source,origin,{plusActive=true,initialRoom=null}={}) {
  const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block',reducedMotion:'reduce'});
  const f={context,page:await context.newPage(),calls:[],errors:[],network:[],room:copy(initialRoom),
    plusActive,joinError:'ROOM_NOT_FOUND',failNext:null,settings:{sound:false,reducedMotion:true},games:registry(source)};
  const resultRoom=()=>({ok:true,room:copy(f.room)});
  const update=()=>{f.room.revision++;return resultRoom();};
  const callback=async(event,request)=>{
    f.calls.push(copy({event,...request}));
    try {
      assert.equal(event,'flecityGames:callback');
      assert.deepEqual(Object.keys(request).sort(),['action','lease','payload','surface']);
      assert(['phone','expanded'].includes(request.surface));assert.equal(typeof request.lease,'string');
      if(request.surface==='expanded')assert.equal(request.lease,f.lease);
      assert(request.payload&&typeof request.payload==='object'&&!Array.isArray(request.payload));
      const {action,payload}=request;
      if(f.failNext===action){f.failNext=null;return {ok:false,error:'NUI_REQUEST_TIMEOUT'};}
      if(action==='screenClaim')return f.returnState?{ok:true,state:copy(f.returnState),lease:f.lease}:{ok:true,parked:f.owner==='expanded'};
      if(action==='bridgePing'||action==='screenReady')return {ok:true};
      if(action==='screenStatus')return {ok:true,owner:f.owner||'phone'};
      if(action==='screenReturned'){f.returnState=null;f.owner='phone';return {ok:true};}
      if(action==='screenOpen'){
        assert(f.host,'Expanded host must be prepared by the test');f.owner='expanded';f.lease='synthetic-lease-'+(f.transferSerial=(f.transferSerial||0)+1);f.saved=copy(payload.state);
        await f.host.evaluate(value=>window.postMessage(value,location.origin),{type:'screenOpen',app:'party',lease:f.lease,state:f.saved});return {ok:true,lease:f.lease};
      }
      if(action==='screenClose'){
        f.returnState=copy(payload.state);f.owner='phone';
        setTimeout(async()=>{try{await f.page.evaluate(()=>window.postMessage({type:'screenReturn'},location.origin));await f.host.evaluate(()=>window.postMessage({type:'screenHide'},location.origin));}catch(error){f.errors.push(error.message);}},30);
        return {ok:true};
      }
      if(action==='partyGetConfig')return {ok:true,config:{version:'ui-v2-synthetic',roomCodeLength:4,minPlayers:2,maxPlayers:10,games:f.games,
        plus:{enabled:true,active:f.plusActive,autoRenew:f.plusActive,price:50000,durationDays:7,expiresAt:2000000000}}};
      if(action==='partyGetPlus')return {ok:true,status:{active:f.plusActive,autoRenew:f.plusActive,expiresAt:2000000000}};
      if(action==='profileGetSettings')return {ok:true,settings:copy(f.settings)};
      if(action==='profileUpdateSettings'){assert.deepEqual(Object.keys(payload).sort(),['reducedMotion','sound']);f.settings=copy(payload);return {ok:true,settings:copy(f.settings)};}
      if(action==='partyGetRoom')return f.room?resultRoom():{ok:false,error:'NOT_IN_ROOM'};
      if(action==='partyCreateRoom'){assert.deepEqual(payload,{});f.room=makeRoom({hostPlusActive:f.plusActive});return resultRoom();}
      if(action==='partyJoinRoom'){assert.deepEqual(Object.keys(payload),['code']);return f.joinError?{ok:false,error:f.joinError}:(f.room=makeRoom(),resultRoom());}
      if(action==='partyLeaveRoom'){assert.deepEqual(payload,{});f.room=null;return {ok:true};}
      if(action==='partySetReady'){assert.deepEqual(Object.keys(payload),['ready']);f.room.selfReady=payload.ready;f.room.players[0].ready=payload.ready;return update();}
      if(action==='partySelectGame'){
        assert.deepEqual(Object.keys(payload),['gameId']);
        if(!f.room.isHost)return {ok:false,error:'HOST_ONLY'};
        if(!f.plusActive&&f.games.find(game=>game.id===payload.gameId)?.premium)return {ok:false,error:'PARTY_PLUS_REQUIRED'};
        f.room.selectedGame=payload.gameId;return update();
      }
      if(action==='partySetMastermindOptions'){assert.deepEqual(Object.keys(payload).sort(),['aiDifficulty','allowDuplicates','firstTurn','turnLimit']);f.room.mastermindOptions=copy(payload);return update();}
      if(action==='partySetShogiOptions'){assert.deepEqual(Object.keys(payload),['aiDifficulty']);f.room.shogiOptions=copy(payload);return update();}
      if(action==='partySetPracticeAi'){assert.deepEqual(Object.keys(payload).sort(),['count','difficulty','enabled']);f.room.aiOptions=copy(payload);return update();}
      if(action==='partyStartRound'){assert.deepEqual(payload,{});f.room.state='round';f.room.roundState=roundState(f.room.selectedGame);return update();}
      if(action==='partyReturnLobby'||action==='partyRematchFallBattle'){assert.deepEqual(payload,{});f.room.state='lobby';delete f.room.roundState;return update();}
      if(action==='partySubmitTelephoneDraft')return {ok:true};
      if(action==='partyDrawPreview'||action==='partyPreviewDrawStroke')return {ok:true};
      if(action==='partyAddDrawStroke'){assert(Array.isArray(payload.points));f.room.roundState.strokes.push(payload.points);return update();}
      if(action.startsWith('partySubmit')){assert.equal(payload.token,f.room.roundState.token);return resultRoom();}
      throw Error('Unmocked callback '+action);
    } catch(error) {f.errors.push(error.stack);return {ok:false,error:'FIXTURE_CONTRACT_FAILED'};}
  };
  await context.route('**/*',route=>{
    if(route.request().url().startsWith(origin+'/'))return route.continue();
    f.network.push(route.request().url());return route.abort();
  });
  await context.routeWebSocket('**/*',socket=>socket.close());
  f.page.setDefaultTimeout(6000);
  f.page.on('pageerror',error=>f.errors.push(error.stack));
  f.page.on('console',msg=>{if(msg.type()==='error')f.errors.push(msg.text());});
  await context.exposeFunction('__fixtureCallback',callback);
  await context.addInitScript(()=>{
    window.fetchNui=(event,request)=>window.__fixtureCallback(event,request);
    // Simulate FiveM's direct transport without making any request outside localhost.
    window.GetParentResourceName=()=> 'link-fixture';
    const originalFetch=window.fetch;
    window.fetch=async(url,options)=>{
      if(String(url)==='https://link-fixture/flecityGames:callback'){
        const result=await window.__fixtureCallback('flecityGames:callback',JSON.parse(options.body));
        return {ok:true,status:200,json:async()=>result};
      }
      return originalFetch(url,options);
    };
  });
  await f.page.goto(origin+'/web/party/index.html');
  await f.page.waitForFunction(()=>document.querySelector('#status')?.textContent.includes('LINK 準備完了')||document.body.classList.contains('party-room'));
  f.push=async(room)=>{f.room=copy(room);await f.page.evaluate(value=>window.postMessage({type:'partyUpdate',room:value},location.origin),f.room);};
  f.message=async(type)=>f.page.evaluate(value=>window.postMessage({type:value},location.origin),type);
  f.count=action=>f.calls.filter(call=>call.action===action).length;
  f.last=action=>f.calls.filter(call=>call.action===action).at(-1);
  f.close=async()=>{await context.close();assert.deepEqual(f.errors,[]);assert.deepEqual(f.network,[]);};
  return f;
}
