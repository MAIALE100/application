// Offline browser checks only: actual source assets, synthetic NUI responses, no FiveM/server/DB connection.
import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {fixture,staticServer,makeRoom,roundState,copy,registry} from './link-ui-v2.fixture.mjs';
const source=process.env.FLECITY_SOURCE||path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const output=process.env.LINK_UI_EVIDENCE||path.resolve('outputs/LINK_UI_v2_TEST');
const modulePath=process.env.FLECITY_BROWSER_MODULE||'C:/Users/suivx/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
const reports=[],captures=path.join(output,'screenshots');let browser,server;
const digest=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const checksums=()=>Object.fromEntries(['web/party/index.html','web/party/app.js','web/party/redesign.js','web/party/redesign.css'].filter(file=>fs.existsSync(path.join(source,file))).map(file=>[file,digest(path.join(source,file))]));
const beforeHashes=checksums();
before(async()=>{fs.mkdirSync(captures,{recursive:true});server=await staticServer(source);const {chromium}=await import(pathToFileURL(modulePath));browser=await chromium.launch({headless:true,channel:'chrome'});});
after(async()=>{if(browser)await browser.close();if(server)await server.close();
  const stable=JSON.stringify(beforeHashes)===JSON.stringify(checksums());
  fs.writeFileSync(path.join(output,'browser-results.json'),JSON.stringify({kind:'offline-synthetic-NUI',browser:browser?.version(),source,sourceSha256:checksums(),sourceUnchangedDuringTests:stable,checks:reports,
    pass:reports.filter(r=>r.status==='PASS').length,fail:reports.filter(r=>r.status==='FAIL').length,
    notRun:['FiveM CEF real input/audio','real 2–10-player synchronization','real password/public-room API (not present in baseline)','real billing/bank/admin access','live deployment/restart']},null,2)+'\n');
  assert(stable,'Source changed while browser tests were running; rerun against fixed bytes');
});
async function visible(page,selector){await page.locator(selector).waitFor({state:'visible'});assert(await page.locator(selector).isVisible(),selector+' should be visible');}
async function disabled(page,selector,value=true){assert.equal(await page.locator(selector).isDisabled(),value,selector+' disabled state');}
async function until(fn){for(let n=0;n<240;n++){if(await fn())return;await new Promise(resolve=>setTimeout(resolve,25));}assert(await fn(),'Expected callback/UI condition');}
async function capture(f,name){await f.page.screenshot({path:path.join(captures,name+'.png'),fullPage:true});}
async function creation(f){
  await f.page.locator('#linkNavCreate').click();await visible(f.page,'#linkCreateView');
  const name=f.page.locator('input#roomName,input[name="roomName"]').first();
  if(await name.count())await name.fill('和みの部屋');
  await f.page.locator('#create').click();await visible(f.page,'#room');
}
async function closeSettings(page){await page.keyboard.press('Escape');const dialog=page.locator('dialog[open]');if(await dialog.count()){const button=dialog.locator('button').filter({hasText:/閉じる|戻る|×/}).first();if(await button.count())await button.click();}}
function check(name,body,options={}){test(name,{timeout:25000},async()=>{
  const f=await fixture(browser,source,server.origin,options);let failure;
  try{await body(f);assert.deepEqual(f.errors,[]);assert.deepEqual(f.network,[]);reports.push({name,status:'PASS',callbacks:f.calls});}
  catch(error){failure=error;reports.push({name,status:'FAIL',error:error.stack,callbacks:f.calls});await capture(f,'FAIL-'+reports.length).catch(()=>{});}
  finally{await f.context.close();}
  if(failure)throw failure;
});}

check('home, join and create navigation preserve the create callback and leave confirmation',async f=>{
  const p=f.page;await visible(p,'#linkHome');await p.locator('#status').waitFor({state:'hidden'});await capture(f,'01-home');
  await p.locator('#linkNavRooms').click();await visible(p,'#linkJoinView');await capture(f,'02-join');
  await p.locator('#linkNavCreate').click();await visible(p,'#linkCreateView');
  assert.equal(f.count('partyCreateRoom'),0,'Navigation must not create a room');
  const name=p.locator('input#roomName,input[name="roomName"]').first();
  if(await name.count()){await p.locator('#create').click();assert.equal(f.count('partyCreateRoom'),0,'Required room name must be validated');await name.fill('和みの部屋');}
  await capture(f,'03-create');await p.locator('#create').click();await visible(p,'#room');assert.deepEqual(f.last('partyCreateRoom').payload,{});
  await p.locator('#leave').click();assert.equal(f.count('partyLeaveRoom'),0);await p.locator('#leave').click();await visible(p,'#entry');assert.equal(f.count('partyLeaveRoom'),1);
});
check('join sanitizes the server-sized code and shows rejection before successful join',async f=>{
  const p=f.page;await p.locator('#linkNavRooms').click();await p.locator('#code').fill('12ab');assert.equal(await p.locator('#code').inputValue(),'12');
  await p.locator('#code').fill('1357');await p.locator('#join').click();await until(()=>f.count('partyJoinRoom')===1);await until(async()=>await p.locator('#status').getAttribute('class').then(x=>x.includes('error')));
  assert(await p.locator('#entry').isVisible());assert.deepEqual(f.last('partyJoinRoom').payload,{code:'1357'});
  f.joinError=null;await p.locator('#join').click();await visible(p,'#room');assert.equal(await p.locator('#roomCode').textContent(),'2468');
});
check('all fifteen configured games, including telephone, remain selectable through the cards',async f=>{
  await creation(f);const p=f.page;assert.equal(f.games.length,15);
  for(const game of [...f.games.slice(1),f.games[0]]){const card=p.locator('#linkGameCards [data-game="'+game.id+'"]');assert.equal(await card.count(),1,game.id+' card');await card.click();await until(()=>f.room.selectedGame===game.id);await until(async()=>await p.locator('#game').inputValue()===game.id);assert.deepEqual(f.last('partySelectGame').payload,{gameId:game.id});}
  assert.equal(await p.locator('#game option').count(),15);assert.equal(f.count('partySelectGame'),15);await capture(f,'04-lobby-all-games');
});
check('host option controls send exact existing option payloads',async f=>{
  await creation(f);const p=f.page;await p.locator('#mastermindAiDifficulty').selectOption('hard');await until(()=>f.last('partySetMastermindOptions')?.payload.aiDifficulty==='hard');
  assert.deepEqual(f.last('partySetMastermindOptions').payload,{aiDifficulty:'hard',allowDuplicates:true,turnLimit:true,firstTurn:'random'});
  await p.locator('#mastermindDuplicates').selectOption('no');await until(()=>f.room.mastermindOptions.allowDuplicates===false);
  await p.locator('#linkGameCards [data-game="mini_shogi"]').click();await visible(p,'#shogiLobbyOptions');await p.locator('#shogiAiDifficulty').selectOption('oni');await until(()=>f.last('partySetShogiOptions')?.payload.aiDifficulty==='oni');
  const room=makeRoom({revision:f.room.revision+1,selectedGame:'fall_battle',connectedCount:1,players:[makeRoom().players[0]]});await f.push(room);await visible(p,'#practiceAiOptions');await p.locator('#practiceAiEnabled').check();await until(()=>f.count('partySetPracticeAi')===1);
  assert.deepEqual(f.last('partySetPracticeAi').payload,{enabled:true,count:1,difficulty:'normal'});
});
check('guest permissions, unready and app-closed participants retain start restrictions',async f=>{
  await creation(f);const p=f.page;await disabled(p,'#start');await p.locator('#ready').click();await until(()=>f.room.selfReady===true);await disabled(p,'#start',false);assert.deepEqual(f.last('partySetReady').payload,{ready:true});
  let room=copy(f.room);room.revision++;room.players[1].appOpen=false;await f.push(room);await until(async()=>await p.locator('#start').isDisabled());assert.match(await p.locator('#players').textContent(),/アプリ閉じています/);
  room=copy(f.room);room.revision++;room.isHost=false;room.players[0].isHost=false;room.players[1].isHost=true;await f.push(room);await until(async()=>await p.locator('#game').isDisabled());await disabled(p,'#mastermindAiDifficulty');await disabled(p,'#start');
  assert.equal(await p.locator('#linkGameCards button:enabled').count(),0,'Guest must not change game');
  room=copy(f.room);room.revision++;room.players[1].disconnected=true;room.connectedCount=1;await f.push(room);await until(async()=>/オフライン/.test(await p.locator('#players').textContent()));
});
check('premium locked selection never silently subscribes and server denial remains enforced',async f=>{
  await creation(f);const p=f.page;const premium=f.games.find(game=>game.premium);const card=p.locator('#linkGameCards [data-game="'+premium.id+'"]');
  assert.match(await card.textContent(),/LINK\+|王冠|会員|限定|プレミアム|♛|♕|♔|♚|🔒|👑/);
  if(!await card.isDisabled())await card.click();
  await p.locator('#game').selectOption(premium.id,{force:true});await until(()=>f.count('partySelectGame')>=1);await until(async()=>await p.locator('#partyPlusCard').getAttribute('open')!==null);
  assert.equal(f.count('partySubscribePlus'),0);assert.equal(f.room.selectedGame,'code_break');await capture(f,'05-settings-premium');
},{plusActive:false});
check('settings persist through exact existing profile callback without automatic billing',async f=>{
  const p=f.page;await p.locator('#linkSettings').click();if(!await p.locator('#settingSound').isVisible())await p.locator('.global-settings > summary').click();await visible(p,'#settingSound');await p.locator('#settingSound').check();await until(()=>f.settings.sound===true);
  assert.deepEqual(f.last('profileUpdateSettings').payload,{sound:true,reducedMotion:true});await p.locator('#settingMotion').uncheck();await until(()=>f.settings.reducedMotion===false);
  assert.equal(f.count('partySubscribePlus'),0);await closeSettings(p);await p.locator('#linkSettings').click();assert(await p.locator('#settingSound').isChecked());assert(!await p.locator('#settingMotion').isChecked());
});
check('all fifteen existing round panels render from genuine push messages',async f=>{
  await creation(f);const panels={code_break:'codeBreakPanel',reversi:'reversiPanel',vote:'votePanel',gomoku:'gomokuPanel',connect4:'connect4Panel',mini_shogi:'miniShogiPanel',word_wolf:'deductionPanel',liar:'deductionPanel',draw:'drawPanel',telephone:'telephonePanel',ng_word:'ngWordPanel',fake_answer:'fakeAnswerPanel',bomb:'bombPanel',memory_chain:'memoryChainPanel',fall_battle:'fallBattlePanel'};
  let revision=10;
  for(const game of f.games){await f.push(makeRoom({revision:revision++,state:'round',selectedGame:game.id,roundState:roundState(game.id)}));await visible(f.page,'#'+panels[game.id]);if(['mini_shogi','telephone','fall_battle'].includes(game.id))await capture(f,'06-round-'+game.id);}
  assert.equal(f.count('partyStartRound'),0,'Pushed state must not start a new round');
});
check('results, return to lobby and falling-block rematch preserve server commands',async f=>{
  await creation(f);const result={gameId:'fall_battle',token:'fixture-complete',complete:true,results:{winnerMemberIds:['self'],entries:[{memberId:'self',name:'テスト太郎',place:1,score:1500,lines:5},{memberId:'friend',name:'花子',place:2,score:500,lines:2}]}};
  await f.push(makeRoom({revision:10,state:'round',selectedGame:'fall_battle',roundState:result}));await visible(f.page,'#resultsPanel');await capture(f,'07-results');await until(async()=>!(await f.page.locator('#fallRematch').isDisabled()));await f.page.locator('#fallRematch').click();await visible(f.page,'#lobbyPanel');assert.deepEqual(f.last('partyRematchFallBattle').payload,{});
  result.token='fixture-complete-2';await f.push(makeRoom({revision:20,state:'round',selectedGame:'fall_battle',roundState:result}));await until(async()=>!(await f.page.locator('#lobby').isDisabled()));await f.page.locator('#lobby').click();await visible(f.page,'#lobbyPanel');assert.deepEqual(f.last('partyReturnLobby').payload,{});
});
check('stale revision is ignored and resume refreshes rather than replaying a mutation',async f=>{
  await creation(f);const p=f.page;await f.push(makeRoom({revision:20,selectedGame:'mini_shogi'}));await until(async()=>await p.locator('#game').inputValue()==='mini_shogi');
  await f.push(makeRoom({revision:19,selectedGame:'reversi'}));assert.equal(await p.locator('#game').inputValue(),'mini_shogi');
  const before=f.count('partyGetRoom');await f.message('partySuspend');await f.push(makeRoom({revision:21,selectedGame:'connect4'}));assert.equal(await p.locator('#game').inputValue(),'mini_shogi');await f.message('partyResume');await until(()=>f.count('partyGetRoom')>before);await until(async()=>await p.locator('#game').inputValue()==='connect4');
  assert.equal(f.count('partyCreateRoom'),1);assert.equal(f.count('partySelectGame'),0);
});
check('uncertain ready acknowledgement is not retried and UI reports the failure',async f=>{
  await creation(f);f.failNext='partySetReady';await f.page.locator('#ready').click();await until(()=>f.count('partySetReady')===1);await until(async()=>/error/.test(await f.page.locator('#status').getAttribute('class')));assert.equal(f.count('partySetReady'),1);assert.equal(f.room.selfReady,false);
});
check('profile uses fresh server membership, clipboard reports success/failure, room navigation cannot create twice',async f=>{
  const p=f.page;await p.locator('#linkProfile').click();await visible(p,'#linkProfileDialog');await visible(p,'#linkProfileCrown');assert.match(await p.locator('#linkMembership').textContent(),/加入中/);await p.keyboard.press('Escape');
  f.plusActive=false;const reads=f.count('partyGetPlus');await f.message('partySuspend');await f.message('partyResume');await until(()=>f.count('partyGetPlus')>reads);await until(async()=>!(await p.locator('#linkProfile').getAttribute('class')||'').includes('is-member'));
  await p.locator('#linkProfile').click();assert(!await p.locator('#linkProfileCrown').isVisible());await p.keyboard.press('Escape');await creation(f);
  await disabled(p,'#linkNavCreate');await p.locator('#linkNavRooms').click();await visible(p,'#room');assert.equal(f.count('partyCreateRoom'),1);
  await p.evaluate(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>{window.__syntheticClipboard=text;}}}));
  await p.locator('#linkCopyCode').click();await until(async()=>await p.evaluate(()=>window.__syntheticClipboard==='2468'));assert.match(await p.locator('#status').textContent(),/コピーしました/);
  await p.evaluate(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async()=>{throw Error('synthetic denial');}}}));await p.locator('#linkCopyCode').click();await until(async()=>/コピーできません/.test(await p.locator('#status').textContent()));assert.match(await p.locator('#status').textContent(),/2468/);
  await p.locator('#leave').click();await p.locator('#leave').click();await visible(p,'#linkHome');await p.locator('#linkProfile').click();assert.equal(await p.locator('#linkProfileDisplayName').textContent(),'テスト太郎');await p.keyboard.press('Escape');
});
check('start and board controls retain exact server payloads after the redesign',async f=>{
  await creation(f);const p=f.page;await p.locator('#ready').click();await until(async()=>!(await p.locator('#start').isDisabled()));await p.locator('#start').click();await visible(p,'#codeBreakPanel');assert.deepEqual(f.last('partyStartRound').payload,{});
  for(const value of [1,2,3,4])await p.locator('#codeBreakPalette [data-code="'+value+'"]').click();await p.locator('#codeBreakSubmit').click();await until(()=>f.count('partySubmitCodeBreak')===1);assert.deepEqual(f.last('partySubmitCodeBreak').payload,{token:'fixture-code_break',guess:[1,2,3,4]});
  for(const [id,selector,action,payload] of [
    ['reversi','#reversiBoard [data-cell="20"]','partySubmitReversi',{cell:20}],
    ['gomoku','#gomokuBoard [data-cell="1"]','partySubmitGomoku',{cell:1}],
    ['connect4','#connect4Columns button:first-child','partySubmitConnect4',{column:1}],
    ['vote','#voteChoices button:first-child','partySubmitVote',{targetMemberId:'friend'}],
  ]){await f.push(makeRoom({revision:f.room.revision+10,state:'round',selectedGame:id,roundState:roundState(id)}));await p.locator(selector).click();await until(()=>f.count(action)===1);assert.deepEqual(f.last(action).payload,{token:'fixture-'+id,...payload});}
});
check('telephone text keeps an uncertain submission editable and never replays it',async f=>{
  await creation(f);const p=f.page;await f.push(makeRoom({revision:10,state:'round',selectedGame:'telephone',roundState:{...roundState('telephone'),mode:'prompt'}}));await visible(p,'#telephoneText');await p.locator('#telephoneText').fill('夕焼けのねこ');
  f.failNext='partySubmitTelephoneText';await p.locator('#telephoneTextSubmit').click();await until(()=>f.calls.some(call=>call.action==='partySubmitTelephoneText'&&!call.payload.draft));await until(()=>f.count('partyGetRoom')>=2);
  assert.equal(f.calls.filter(call=>call.action==='partySubmitTelephoneText'&&!call.payload.draft).length,1);assert.deepEqual(f.calls.find(call=>call.action==='partySubmitTelephoneText'&&!call.payload.draft).payload,{token:'fixture-telephone',step:1,text:'夕焼けのねこ'});assert.equal(await p.locator('#telephoneText').inputValue(),'夕焼けのねこ');
});
check('expanded presentation retains telephone ink and Escape closes a dialog before returning to phone',async f=>{
  await creation(f);const p=f.page;f.host=await f.context.newPage();await f.host.setViewportSize({width:1920,height:1080});await f.host.goto(server.origin+'/web/screen/index.html');
  await f.push(makeRoom({revision:10,state:'round',selectedGame:'telephone',roundState:roundState('telephone')}));await visible(p,'#telephoneCanvas');const canvas=p.locator('#telephoneCanvas');await canvas.scrollIntoViewIfNeeded();const rect=await canvas.boundingBox();
  await p.mouse.move(rect.x+20,rect.y+20);await p.mouse.down();await p.mouse.move(rect.x+100,rect.y+70,{steps:10});await p.mouse.up();
  await p.locator('#screenBar button').first().click();await f.host.waitForFunction(()=>document.querySelector('iframe').contentDocument?.querySelector('body.screen-expanded'));
  const frame=f.host.frames().find(value=>value.url().includes('/party/'));await frame.waitForFunction(()=>!FlecityScreen.parked);assert.equal(f.saved.telephoneStrokes.length,1);
  const ink=await frame.locator('#telephoneCanvas').evaluate(c=>c.getContext('2d').getImageData(0,0,c.width,c.height).data.some((v,i)=>i%4!==3&&v<100));assert(ink,'Transferred local telephone ink must remain visible');
  const submit=await frame.locator('#telephoneDrawSubmit').boundingBox();
  const elements=await frame.locator('#roundHud,#roundDeadline,#telephoneTurnCallout,#telephoneStatus,#telephoneHint,#telephoneTextPrompt,#telephoneCanvas,#telephoneDrawControls,#telephoneDrawSubmit,.drawing-tools,.brush-settings').evaluateAll(nodes=>nodes.map(node=>{const r=node.getBoundingClientRect(),s=getComputedStyle(node);return {id:node.id||node.className,top:r.top,height:r.height,width:r.width,display:s.display,position:s.position,gap:s.gap,margin:s.margin,padding:s.padding};}));
  reports.push({name:'expanded telephone submit geometry',status:submit.y+submit.height<1080*.94?'PASS':'FAIL',geometry:submit,elements});
  await f.host.screenshot({path:path.join(captures,'09-expanded-telephone.png')});
  f.room=makeRoom({revision:20});await f.host.evaluate(value=>window.postMessage({type:'partyUpdate',room:value},location.origin),f.room);await frame.locator('#linkSettings').click();await frame.locator('#linkSettingsDialog').waitFor({state:'visible'});
  await frame.locator('#settingSound').focus();await f.host.keyboard.press('Escape');await until(async()=>!await frame.locator('#linkSettingsDialog').isVisible());assert.equal(f.count('screenClose'),0,'Dialog Escape must not transfer presentation ownership');assert.equal(f.owner,'expanded');
  await frame.locator('#screenBar button').first().focus();await f.host.keyboard.press('Escape');await until(()=>f.count('screenClose')===1);await p.waitForFunction(()=>!FlecityScreen.parked);assert.equal(f.owner,'phone');
  assert(submit.y+submit.height<1080*.94,'Expanded telephone submit should fit the visible window');
});
check('join and create routes, typed room code and profile presentation survive expanded round trips',async f=>{
  const p=f.page;f.host=await f.context.newPage();await f.host.setViewportSize({width:1920,height:1080});await f.host.goto(server.origin+'/web/screen/index.html');
  for(const [nav,view]of [['#linkNavRooms','#linkJoinView'],['#linkNavCreate','#linkCreateView']]){
    await p.locator(nav).click();if(view==='#linkJoinView')await p.locator('#code').fill('1357');
    await p.locator('#screenBar button').first().click();await f.host.waitForFunction(()=>document.querySelector('iframe').contentDocument?.querySelector('body.screen-expanded'));
    const frame=f.host.frames().find(value=>value.url().includes('/party/'));await frame.waitForFunction(()=>!FlecityScreen.parked);await frame.locator(view).waitFor({state:'visible'});if(view==='#linkJoinView')assert.equal(await frame.locator('#code').inputValue(),'1357');
    await frame.locator('#screenBar button').first().focus();await f.host.keyboard.press('Escape');await p.waitForFunction(()=>!FlecityScreen.parked);await visible(p,view);
  }
  assert.equal(f.count('partyCreateRoom'),0);assert.equal(f.count('partyJoinRoom'),0);assert.equal(f.count('screenOpen'),2);assert.equal(f.count('screenClose'),2);
});
check('real drawing helpers retain the full local path and bound transmitted strokes with both endpoints',async f=>{
  const rows=await f.page.evaluate(()=>[49,200,1000].map(count=>{
    const path=[{x:0,y:.2,color:'#102030',width:6}];for(let i=1;i<=count;i++)appendDrawingPoint(path,{x:i/(count+1),y:.2+(i%30)/100});
    const preview=drawableStroke(path,48),final=drawableStroke(path);
    return {count,local:path.length,preview:preview.length,final:final.length,first:final[0],last:final.at(-1),expectedLast:path.at(-1)};
  }));
  for(const row of rows){assert(row.local>=row.count,'Live path should not be prematurely truncated');assert(row.preview<=48);assert(row.final<=128);assert.equal(row.first.x,0);assert.equal(row.first.color,'#102030');assert.equal(row.first.width,6);assert.deepEqual(row.last,row.expectedLast);}
});
check('320/390 pixel phones retain long names, ten participants and horizontal game navigation',async f=>{
  for(const width of [320,390]){
    await f.page.setViewportSize({width,height:844});
    const bounds=await f.page.locator('#linkNavCreate').evaluate(node=>{const r=node.getBoundingClientRect();return {width:innerWidth,height:innerHeight,left:r.left,right:r.right,top:r.top,bottom:r.bottom};});
    reports.push({name:'home create navigation bounds '+width,status:bounds.bottom<=bounds.height&&bounds.left>=0&&bounds.right<=bounds.width?'PASS':'FAIL',geometry:bounds});
    assert(bounds.bottom<=bounds.height&&bounds.left>=0&&bounds.right<=bounds.width,'Circular create navigation is clipped: '+JSON.stringify(bounds));
  }
  await creation(f);const players=Array.from({length:10},(_,i)=>({memberId:i?'friend-'+i:'self',name:'とても長い日本語プレイヤー名の表示確認'+i,isHost:i===0,ready:true,appOpen:true,disconnected:false}));
  await f.push(makeRoom({revision:30,players,connectedCount:10,selectedGame:'memory_chain',selfReady:true}));
  for(const width of [320,390]){await f.page.setViewportSize({width,height:844});assert(await f.page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Document must not overflow horizontally at '+width);assert.equal(await f.page.locator('#players .player').count(),10);const last=f.page.locator('#linkGameCards [data-game="fall_battle"]');await last.scrollIntoViewIfNeeded();await visible(f.page,'#start');await capture(f,'08-lobby-'+width);}
  const sizes=await f.page.locator('#linkNavRooms,#linkNavCreate,#linkSettings').evaluateAll(nodes=>nodes.map(node=>({w:node.getBoundingClientRect().width,h:node.getBoundingClientRect().height})));
  assert(sizes.every(size=>size.w>=44&&size.h>=44),'Navigation should have touch-friendly targets');
});
