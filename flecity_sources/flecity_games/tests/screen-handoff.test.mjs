import {spawnSync}from 'node:child_process';import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import {pathToFileURL,fileURLToPath}from 'node:url';
const root=process.env.FLECITY_SOURCE||path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),overlay=process.env.FLECITY_OVERLAY||root;
const workspace=path.resolve(root,'../..');const settings=JSON.parse(fs.readFileSync(path.join(workspace,'.flecity-dev/local.json'),'utf8').replace(/^\uFEFF/,''));
const evidence=process.env.FLECITY_SCREEN_EVIDENCE||path.join(workspace,'.flecity-dev/projects/link/screen-prototype',Date.now().toString());
const {chromium}=await import(pathToFileURL(process.env.FLECITY_BROWSER_MODULE||settings.browser.module));
const read=p=>fs.readFileSync(fs.existsSync(path.join(overlay,p))?path.join(overlay,p):path.join(root,p),'utf8');
test('independent NUI transfers telephone ink, input and LOOP piece with one active owner',{timeout:40000},async t=>{
 const browser=await chromium.launch({headless:true,channel:'chrome'});t.after(()=>browser.close());
 const context=await browser.newContext({viewport:{width:1920,height:1080}});
 const host=await context.newPage(),phone=await context.newPage();host.setDefaultTimeout(7000);phone.setDefaultTimeout(7000);let owner='phone',saved=null,app=null,id=0,returnState=null,loseReady=true;const errors=[],calls=[];
 for(const p of [host,phone])p.on('pageerror',e=>errors.push(e.message));
 await phone.setViewportSize({width:390,height:844});
 await context.addInitScript(()=>{const active=new Set(),set=window.setInterval,clear=window.clearInterval;window.setInterval=(...args)=>{const id=set(...args);active.add(id);return id;};window.clearInterval=id=>{active.delete(id);clear(id);};window.intervalCount=()=>active.size;});
 async function callback(request){
  const {action,payload,surface}=request;calls.push(action);
  if(action==='screenClaim')return returnState?{ok:true,state:returnState,lease:String(id)}:{ok:true,parked:owner==='expanded'};
  if(action==='screenReturned'){owner='phone';returnState=null;return {ok:true};}
  if(action==='screenStatus')return {ok:true,owner};
  if(action==='screenOpen'){
   assert.equal(owner,'phone');owner='expanded';saved=payload.state;app=payload.app;id++;
   await host.evaluate(d=>window.postMessage(d,location.origin),{type:'screenOpen',app,lease:String(id),state:saved});return {ok:true,lease:String(id)};
  }
  if(action==='screenReady')return {ok:true};
  if(action==='screenClose'){
   assert.equal(owner,'expanded');returnState=payload.state;
   setTimeout(async()=>{await phone.evaluate(()=>window.postMessage({type:'screenReturn'},location.origin));await host.evaluate(()=>window.postMessage({type:'screenHide'},location.origin));},20);
   return {ok:true};
  }
  if(action==='partyGetRoom'&&saved?.currentRoom)return {ok:true,room:saved.currentRoom};
  return {ok:false,error:'TEST_UNAVAILABLE'};
 }
 await phone.exposeFunction('testCallback',callback);
 await phone.addInitScript(()=>{window.fetchNui=(event,data)=>window.testCallback(data);});
 await context.route('**/*',async route=>{
  const u=new URL(route.request().url());if(u.hostname!=='screen.test')return route.abort();
  if(u.pathname==='/flecityGames:callback'){
   const request=route.request().postDataJSON(),result=await callback(request);
   if(request.action==='screenReady'&&loseReady){loseReady=false;return route.abort('failed');}
   return route.fulfill({json:result});
  }
  let body;const p=u.pathname.slice(1);
  try{body=read(p);}catch{return route.fulfill({status:404,body:''});}
  if(p==='web/shared/bridge.js')body=body.replace("const directResource=typeof GetParentResourceName", "const directResource=typeof GetParentResourceName").replace("if (directResource) {","if (directResource||screen?.expanded) {").replace("'https://' + directResource", "'http://screen.test'");
  if(p==='web/party/app.js')body=body.replace('},bootstrap);else bootstrap();','},async()=>{});else bootstrap();')+`\nglobalThis.seedRoom=room=>{partyConfig={games:[{id:'telephone',name:'伝言',minPlayers:3,maxPlayers:10}]};renderRoom(room);};globalThis.ink=()=>JSON.parse(JSON.stringify(telephoneStrokes));`;
  if(p==='web/play/app.js')body=body.replace('},bootstrap);else bootstrap();','},async()=>{});else bootstrap();')+`\nglobalThis.seedFall=async()=>{bootstrapData={games:[],bests:{}};const originalInvoke=FlecityBridge.invoke;FlecityBridge.invoke=async(action)=>action==='playStartSession'?{ok:true,seed:42,sessionToken:'fixture-session',challenge:{width:10,height:18}}:{ok:true};await openFall();FlecityBridge.invoke=originalInvoke;};globalThis.piece=()=>({x:fallGame.x,y:fallGame.y,rotation:fallGame.rotation,history:fallGame.history,token:fallGame.sessionToken});`;
  return route.fulfill({body,contentType:({'.js':'text/javascript','.html':'text/html','.css':'text/css','.svg':'image/svg+xml'})[path.extname(p)]||'text/plain'});
 });
 await host.goto('http://screen.test/web/screen/index.html');
 await phone.goto('http://screen.test/web/party/index.html');await phone.waitForFunction(()=>typeof seedRoom==='function');
 const room={code:'1234',revision:1,state:'round',selectedGame:'telephone',isHost:true,connectedCount:3,players:[{memberId:'a',name:'A'},{memberId:'b',name:'B'}],roundState:{token:'fixture-round',gameId:'telephone',step:1,totalSteps:3,isCurrent:true,currentMemberId:'a',mode:'draw',promptText:'ねこ'}};
 await phone.evaluate(r=>seedRoom(r),room);
 const canvas=phone.locator('#telephoneCanvas');await canvas.scrollIntoViewIfNeeded();const b=await canvas.boundingBox();
 await phone.mouse.move(b.x+20,b.y+20);await phone.mouse.down();await phone.mouse.move(b.x+100,b.y+80,{steps:8});await phone.mouse.up();
 const originalInk=await phone.evaluate(()=>ink());assert(originalInk.length>0);fs.mkdirSync(evidence,{recursive:true});await phone.screenshot({path:path.join(evidence,'link-phone.png')});
 await phone.locator('#screenBar button').first().click();
 let frame;await host.waitForFunction(()=>document.querySelector('iframe').contentDocument?.querySelector('body.screen-expanded'));
 frame=host.frames().find(f=>f.url().includes('/party/'));await frame.waitForFunction(()=>!FlecityScreen.parked);
 assert.deepEqual(await frame.evaluate(()=>ink()),originalInk);
 assert.equal(await phone.evaluate(()=>FlecityScreen.parked),true);assert.equal(await phone.evaluate(()=>intervalCount()),0);
 assert.equal((await phone.evaluate(()=>FlecityBridge.call('partySubmitTelephoneText',{text:'must not send'}))).error,'APP_SUSPENDED');
 const submitBounds=await frame.locator('#telephoneDrawSubmit').boundingBox();await host.screenshot({path:path.join(evidence,'link-expanded-before-visibility-check.png')});assert(submitBounds.y+submitBounds.height<1080*.94,`submit bottom=${submitBounds.y+submitBounds.height}`);
 const rect=await host.locator('#window').boundingBox();assert(Math.abs(rect.width/1920-.88)<.01);assert(Math.abs(rect.height/1080-.88)<.01);
 fs.mkdirSync(evidence,{recursive:true});await host.screenshot({path:path.join(evidence,'link-expanded.png')});
 await host.bringToFront();await frame.locator('#screenBar button').first().focus();await host.keyboard.press('Escape');await phone.waitForFunction(()=>!FlecityScreen.parked);assert.deepEqual(await phone.evaluate(()=>ink()),originalInk);
 for(let n=0;n<3;n++){
  await phone.locator('#screenBar button').first().click();await host.waitForFunction(()=>document.querySelector('iframe').contentDocument?.querySelector('body.screen-expanded'));
  frame=host.frames().find(f=>f.url().includes('/party/'));await frame.waitForFunction(()=>!FlecityScreen.parked);
  await frame.locator('#screenBar button').first().focus();await host.keyboard.press('Escape');await phone.waitForFunction(()=>!FlecityScreen.parked);
 }
 assert.deepEqual(await phone.evaluate(()=>ink()),originalInk);
 // LINK's local falling-piece engine must retain history and cursor as well as server state.
 await phone.bringToFront();
 await phone.evaluate(r=>seedRoom(r),{...room,revision:2,selectedGame:'fall_battle',serverTick:1000,roundState:{gameId:'fall_battle',token:'fixture-link-fall',seed:42,width:10,height:18,startedTick:1000,deadlineTick:91000,expectedSubmissions:3}});
 const linkBefore=await phone.evaluate(()=>PartyFallBattle.snapshot().game);
 await phone.locator('#screenBar button').first().click();await host.waitForFunction(()=>document.querySelector('iframe').contentDocument?.querySelector('body.screen-expanded'));
 frame=host.frames().find(f=>f.url().includes('/party/'));await frame.waitForFunction(()=>!FlecityScreen.parked);
 assert.equal((await frame.evaluate(()=>PartyFallBattle.snapshot().game)).token,linkBefore.token);
 await host.bringToFront();await frame.locator('#screenBar button').first().focus();await host.keyboard.press('ArrowLeft');
 assert.equal((await frame.evaluate(()=>PartyFallBattle.snapshot().game)).x,linkBefore.x-1);
 await host.keyboard.press('Escape');await phone.waitForFunction(()=>!FlecityScreen.parked);
 assert.equal((await phone.evaluate(()=>PartyFallBattle.snapshot().game)).x,linkBefore.x-1);
 // LOOP uses the same live session and piece, with the parked phone ignoring keyboard input.
 await phone.bringToFront();await phone.goto('http://screen.test/web/play/index.html');await phone.waitForFunction(()=>typeof seedFall==='function');await phone.evaluate(()=>seedFall());
 const before=await phone.evaluate(()=>piece());
 // Restore actual transport after fixture session creation.

 // Reload bridge only, without registering another controller or game listener.

 await phone.locator('#screenBar button').first().click();await host.waitForFunction(()=>document.querySelector('iframe').contentDocument?.querySelector('body.screen-expanded'));
 frame=host.frames().find(f=>f.url().includes('/play/'));await frame.waitForFunction(()=>!FlecityScreen.parked);
 const expandedPiece=await frame.evaluate(()=>piece());assert.equal(expandedPiece.token,before.token);assert.equal(expandedPiece.x,before.x);assert.deepEqual(expandedPiece.history,before.history);
 await frame.locator('#screenBar button').first().focus();await host.keyboard.press('ArrowLeft');assert.equal((await frame.evaluate(()=>piece())).x,before.x-1);
 await phone.locator('body').press('ArrowRight');assert.equal((await phone.evaluate(()=>piece())).x,before.x);
 await host.screenshot({path:path.join(evidence,'loop-expanded.png')});
 await frame.locator('#screenBar button').first().focus();await host.keyboard.press('Escape');await phone.waitForFunction(()=>!FlecityScreen.parked);
 assert.equal((await phone.evaluate(()=>piece())).x,before.x-1);
 assert(!calls.includes('playCancelSession'));assert.deepEqual(errors,[]);
});

test('real client Lua enforces presentation leases, routes pushes, preserves presence and releases focus',()=>{
 const lua=String.raw`
local root=arg[1]
local events,handlers,apps,threads,messages={},{},{},{},{}
local invoke,closed,focused,keep,clock=0,0,false,false,100
function GetCurrentResourceName()return 'flecity_games'end
function GetResourceState()return 'started'end
function GetGameTimer()clock=clock+1;return clock end
function GetResourceMetadata()return 'fixture'end
function Wait()end
function CreateThread(fn)threads[#threads+1]=fn end
function RegisterNetEvent(name,fn)events[name]=fn end
function AddEventHandler(name,fn)handlers[name]=fn end
function RegisterNUICallback(name,fn)callback=fn end
function SendNUIMessage(data)messages[#messages+1]=data end
function SetNuiFocus(a,b)focused=a or b end
function SetNuiFocusKeepInput(value)keep=value end
function TriggerServerEvent(name)if name:find('Closed')then closed=closed+1 end end
function PlayerPedId()return 99 end
function IsEntityDead()return false end
function IsPedRagdoll()return true end
function IsPedFalling()return false end
function IsEntityPositionFrozen()return false end
function IsNuiFocused()return focused end
json={encode=function(v)return v.large and string.rep('x',524289) or '{}'end}
FlecityGamesConfig={Apps={Play={identifier='play',enabled=true,ui='web/play/index.html',icon='icon.svg'},Party={identifier='party',enabled=true,ui='web/party/index.html',icon='icon.svg'}}}
exports={['lb-phone']={
AddCustomApp=function(_,data)apps[data.identifier]=data;return true end,
RemoveCustomApp=function()end,
SendCustomAppMessage=function()return true end,
ToggleOpen=function(_,value)events['lb-phone:phoneToggled'](value);if not value then apps.party.onClose();apps.play.onClose()end end,
AwaitCallback=function()invoke=invoke+1;return {ok=true}end}}
assert(loadfile(root..'/client/main.lua'))()
threads[1]()
events['lb-phone:phoneToggled'](true);apps.party.onOpen()
local function request(action,payload,surface,lease)
 local answer=nil;callback({action=action,payload=payload or {},surface=surface or 'phone',lease=lease},function(v)answer=v end)
 assert(answer,'callback did not settle');return answer
end
FlecityGamesConfig.Apps.Party.enabled=false;assert(request('screenOpen',{app='party',state={}}).error=='APP_DISABLED');FlecityGamesConfig.Apps.Party.enabled=true
assert(not request('screenOpen',{app='party',state={large=true}}).ok)
local open=request('screenOpen',{app='party',state={round='fixture'}});assert(open.ok)
assert(request('partyGetRoom').error=='APP_SUSPENDED')
assert(not request('screenReady',{app='party',lease='wrong'},'expanded','wrong').ok)
assert(request('screenReady',{app='party',lease=open.lease},'expanded',open.lease).ok)
assert(request('screenReady',{app='party',lease=open.lease},'expanded',open.lease).ok,'ready acknowledgement must be idempotent')
assert(focused and not keep and closed==0,'handoff changed presence or leaked focus')
events['lb-phone:phoneToggled'](true);assert(focused and closed==0,'phone hotkey stole expanded focus')
assert(request('partyGetRoom',{},'expanded','wrong').error=='APP_SUSPENDED')
assert(request('playStartSession',{},'expanded',open.lease).error=='APP_SUSPENDED')
assert(request('partyGetRoom',{},'expanded',open.lease).ok and invoke==1)
events['flecity_games:client:partyDrawStroke']({token='fixture',revision=2,points={{x=1,y=1}}})
assert(messages[#messages].type=='partyDrawStroke')
local diag=request('localDiagnostics');assert(diag.ok and diag.state.ragdoll and diag.state.expanded and diag.state.nuiFocused and diag.state.freezeProbeAvailable and diag.state.frozen==false)
assert(request('screenClose',{app='party',lease=open.lease,state={round='returned'}},'expanded',open.lease).ok)
assert(not focused and not keep)
local claim=request('screenClaim',{app='party'});assert(claim.state.round=='returned')
assert(request('screenReturned',{app='party',lease=open.lease}).ok)
assert(request('screenReturned',{app='party',lease=open.lease}).ok,'return acknowledgement must be idempotent')
assert(request('partyGetRoom').ok)
assert(request('partyGetRoom',{},'expanded',open.lease).error=='APP_SUSPENDED')
events['lb-phone:phoneToggled'](true)
local timeout=request('screenOpen',{app='party',state={round='timeout-recovery'}});assert(timeout.ok)
threads[#threads]()
assert(not focused and request('screenClaim',{app='party'}).state.round=='timeout-recovery')
assert(request('screenReturned',{app='party',lease=timeout.lease}).ok)
local second=request('screenOpen',{app='party',state={}});assert(second.ok)
assert(request('screenReady',{app='party',lease=second.lease},'expanded',second.lease).ok)
handlers.onResourceStop('lb-phone');assert(not focused and not keep and messages[#messages].type=='screenHide')
print('PASS actual Lua client lease/focus/presence/push/diagnostics')
`;
 const r=spawnSync(process.env.FLECITY_LUA||settings.lua,['-',overlay],{input:lua,encoding:'utf8'});
 assert.equal(r.status,0,r.stderr||r.stdout);assert.match(r.stdout,/PASS actual Lua/);
});
