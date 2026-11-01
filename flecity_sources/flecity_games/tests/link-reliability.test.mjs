import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath,pathToFileURL} from 'node:url';
const source=process.env.FLECITY_SOURCE||path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const overlay=process.env.FLECITY_OVERLAY;
function read(relative){const candidate=overlay&&path.join(overlay,relative);return fs.readFileSync(candidate&&fs.existsSync(candidate)?candidate:path.join(source,relative),'utf8');}
function bridge(extra={}){
 const ctx={performance,setTimeout:(fn,ms)=>setTimeout(fn,ms===12000?15:ms),clearTimeout,AbortController,...extra};
 ctx.window=ctx;ctx.globalThis=ctx;vm.createContext(ctx);vm.runInContext(read('web/shared/bridge.js'),ctx);ctx.FlecityBridge.diagnostics=ctx.FlecityDiagnostics;return ctx.FlecityBridge;
}
test('diagnostics retain error class and duration without secret clue or player data',async()=>{
 const api=bridge({fetchNui:async()=>({ok:false,error:'TABOO_FORBIDDEN_WORD'})});
 await api.call('partySubmitNgWordClue',{clue:'秘密のお題',citizenid:'PRIVATE_PLAYER'});
 const rows=api.diagnostics.snapshot();assert.equal(rows.length,1);
 assert.equal(rows[0].action,'partySubmitNgWordClue');assert.equal(rows[0].error,'TABOO_FORBIDDEN_WORD');
 assert(Number.isFinite(rows[0].elapsedMs));
 assert(!JSON.stringify(rows).includes('秘密のお題')&&!JSON.stringify(rows).includes('PRIVATE_PLAYER'));
});
test('diagnostics reject unstructured callback errors containing private values',async()=>{
 const api=bridge({fetchNui:async()=>({ok:false,error:'room 2468 belongs to PRIVATE_PLAYER'})});
 await api.call('partyJoinRoom',{code:'2468'});
 const rows=api.diagnostics.snapshot();
 assert.equal(rows[0].error,'UNCLASSIFIED_ERROR');
 assert(!JSON.stringify(rows).includes('2468')&&!JSON.stringify(rows).includes('PRIVATE_PLAYER'));
});
test('phone acknowledgement failure never replays an accepted mutation',async()=>{
 let sends=0;
 const api=bridge({fetchNui:async()=>{sends++;throw Error('ack lost');}});
 const result=await api.call('partySubmitNgWordGuess',{guess:'回答'});
 assert.equal(result.error,'NUI_REQUEST_FAILED');assert.equal(sends,1);
});
test('hung phone callback settles with unknown outcome and releases caller',async()=>{
 let sends=0;
 const api=bridge({fetchNui:()=>{sends++;return new Promise(()=>{});}});
 const result=await api.call('partySubmitTelephoneDrawing',{});
 assert.equal(result.error,'NUI_REQUEST_TIMEOUT');assert.equal(sends,1);
});
test('late acknowledgement cannot change the timeout result or trigger fallback',async()=>{
 let acknowledge,fallback=0;
 const api=bridge({fetchNui:()=>new Promise(resolve=>acknowledge=resolve),GetParentResourceName:()=> 'fixture',fetch:()=>{fallback++;}});
 const result=await api.call('partySubmitNgWordClue',{});
 acknowledge({ok:true});await new Promise(resolve=>setImmediate(resolve));
 assert.equal(result.error,'NUI_REQUEST_TIMEOUT');assert.equal(fallback,0);
});
test('direct NUI deadline covers a hung JSON body and aborts transport',async()=>{
 let signal,sends=0;
 const api=bridge({GetParentResourceName:()=> 'fixture',fetch:async(url,options)=>{sends++;signal=options.signal;return {json:()=>new Promise(()=>{})};}});
 const result=await api.call('partyJoinRoom',{});
 assert.equal(result.error,'NUI_REQUEST_TIMEOUT');assert(signal.aborted);assert.equal(sends,1);
});
test('business rejection remains distinct from transport failure',async()=>{
 const api=bridge({fetchNui:async()=>({ok:false,error:'TABOO_FORBIDDEN_WORD'})});
 assert.equal((await api.call('partySubmitNgWordClue',{})).error,'TABOO_FORBIDDEN_WORD');
});
test('NUI interruption retains ink, transmits it, and clears it on lobby transition',async t=>{
 assert(process.env.FLECITY_BROWSER_MODULE,'Set FLECITY_BROWSER_MODULE to the local Playwright module');
 const {chromium}=await import(pathToFileURL(process.env.FLECITY_BROWSER_MODULE));
 const browser=await chromium.launch({headless:true,...(process.env.FLECITY_CHROMIUM_EXECUTABLE?{executablePath:process.env.FLECITY_CHROMIUM_EXECUTABLE,args:['--no-sandbox']}:{channel:'chrome'})});t.after(()=>browser.close());
 const page=await browser.newPage({viewport:{width:390,height:844}});
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 // Use an in-memory document rather than network navigation (restricted in some CI sandboxes).
 const html=read('web/party/index.html').replace(/<script(?:\s[^>]*)?>[\s\S]*?<\/script>/g,'');
 await page.setContent(html);
 await page.addStyleTag({content:read('web/shared/app.css')});
 await page.addStyleTag({content:read('web/shared/screen.css')});
 for(const file of ['web/shared/errors.js','web/shared/bridge.js','web/shared/controls.js','web/shared/screen.js','web/party/fall_battle.js']){
  await page.addScriptTag({content:read(file)});
 }
 await page.addScriptTag({content:read('web/party/app.js')+`\nglobalThis.auditRender=(room)=>{resetRoundRuntime();currentRoom=null;lastRoomRevision=-1;partyConfig={games:[{id:'telephone',name:'伝言',minPlayers:2,maxPlayers:6}]};appSuspended=false;renderRoom(room);};globalThis.auditUpdate=room=>renderRoom(room);`});
 await page.waitForFunction(()=>typeof auditRender==='function');
 const room={code:'1234',revision:1,state:'round',selectedGame:'telephone',isHost:true,connectedCount:2,players:[{memberId:'a',name:'A'},{memberId:'b',name:'B'}],roundState:{token:'test',gameId:'telephone',step:1,totalSteps:2,isCurrent:true,currentMemberId:'a',mode:'draw',promptText:'ねこ'}};
 for(const interruption of ['pointercancel','lostpointercapture']){
  await page.evaluate(room=>auditRender(room),room);
  const canvas=page.locator('#telephoneCanvas');await canvas.scrollIntoViewIfNeeded();const b=await canvas.boundingBox();
  await page.mouse.move(b.x+15,b.y+15);await page.mouse.down();await page.mouse.move(b.x+90,b.y+60,{steps:8});
  await page.evaluate(type=>document.getElementById('telephoneCanvas').dispatchEvent(new PointerEvent(type,{pointerId:1})),interruption);await page.mouse.up();
  await page.evaluate(()=>{globalThis.sent=[];FlecityBridge.call=async(action,payload)=>{sent.push({action,payload});return {ok:false,error:'RATE_LIMIT'};};});
  await page.locator('#telephoneDrawSubmit').click();
  const sent=await page.evaluate(()=>globalThis.sent);
  assert.equal(sent.filter(row=>row.action==='partySubmitTelephoneDrawing').length,1,interruption+' dropped the drawing: '+JSON.stringify(sent.map(row=>row.action)));assert.equal(sent.find(row=>row.action==='partySubmitTelephoneDrawing').action,'partySubmitTelephoneDrawing');
  const drawing=sent.find(row=>row.action==='partySubmitTelephoneDrawing');
  assert(drawing.payload.strokes[0].length>=2);assert(drawing.payload.strokes[0].some(p=>p.x!==drawing.payload.strokes[0][0].x));
  assert(await page.locator('#telephoneDrawSubmit').isEnabled());
  // Paint the transmitted data in the next player's text turn.
  await page.evaluate(room=>auditRender(room),{...room,roundState:{...room.roundState,mode:'text',step:2,promptStrokes:drawing.payload.strokes}});
  const ink=await canvas.evaluate(c=>c.getContext('2d').getImageData(0,0,c.width,c.height).data.some((v,i)=>i%4!==3&&v<100));assert(ink);
  await page.locator('#telephoneText').fill('前ゲームの入力');
  await page.evaluate(room=>auditUpdate({...room,state:'lobby',revision:2,roundState:null}),room);
  assert.equal(await page.locator('#telephoneText').inputValue(),'');
 }
 assert.deepEqual(errors,[]);
});
