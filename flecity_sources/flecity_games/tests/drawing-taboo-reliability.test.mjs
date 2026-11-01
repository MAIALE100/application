import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath,pathToFileURL} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=relative=>fs.readFileSync(path.join(root,relative),'utf8');
const partyJs=read('web/party/app.js');

// Regression: long strokes must keep tracking their latest point even after
// reaching the server's 48-point-per-stroke limit.
test('long drawing strokes preserve the start and final coordinates within 48-point server limit',()=>{
 const start=partyJs.indexOf('function appendDrawingPoint(');
 const end=partyJs.indexOf('\nfunction paintCanvas(',start);
 assert(start>=0&&end>start);
 const fn=vm.runInNewContext(`(${partyJs.slice(start,end)})`);
 for(const count of [48,49,200,1000]){
  const stroke=[{x:0,y:0.2}];
  for(let i=1;i<=count;i++)fn(stroke,{x:i/(count+1),y:0.2+(i%30)/100});
  assert(stroke.length<=48,`point cap exceeded at ${count}`);
  assert.equal(stroke[0].x,0);
  assert(Math.abs(stroke.at(-1).x-count/(count+1))<1e-8,'pen stopped tracking the endpoint');
  assert(stroke.some(p=>p.x>0.5),'entire right half disappeared');
 }
});

test('taboo rejection returns matching term only to the authenticated explainer',()=>{
 const server=read('server/core/party.lua');
 const body=server.slice(server.indexOf('function FlecityGamesParty.SubmitNgWordClue('),server.indexOf('function FlecityGamesParty.SubmitNgWordGuess('));
 assert(body.includes("if rs.explainerIdentifier~=id then return {ok=false,error='EXPLAINER_ONLY'} end"));
 assert.match(body,/TABOO_FORBIDDEN_WORD',matchedTerm=rs\.targetWord/);
 assert.match(body,/TABOO_FORBIDDEN_WORD',matchedTerm=term/);
 assert(!body.includes('print(clue)'));
 assert.match(partyJs,/res\.error==='TABOO_FORBIDDEN_WORD'&&typeof res\.matchedTerm==='string'/);
});

async function loadPartyBrowser(t){
 if(!process.env.FLECITY_BROWSER_MODULE){t.skip('FLECITY_BROWSER_MODULE not provided');return null;}
 const {chromium}=await import(pathToFileURL(process.env.FLECITY_BROWSER_MODULE));
 const launch={headless:true,...(process.env.FLECITY_CHROMIUM_EXECUTABLE?{executablePath:process.env.FLECITY_CHROMIUM_EXECUTABLE,args:['--no-sandbox']}:{channel:'chrome'})};
 const browser=await chromium.launch(launch);
 t.after(()=>browser.close());
 const page=await browser.newPage({viewport:{width:430,height:850}});
 const errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 const html=read('web/party/index.html').replace(/<script(?:\s[^>]*)?>[\s\S]*?<\/script>/g,'');
 await page.setContent(html);
 for(const file of ['web/shared/app.css','web/shared/screen.css'])await page.addStyleTag({content:read(file)});
 for(const file of ['web/shared/errors.js','web/shared/bridge.js','web/shared/controls.js','web/shared/screen.js','web/party/fall_battle.js'])await page.addScriptTag({content:read(file)});
 await page.addScriptTag({content:partyJs+`\nglobalThis.testRoom=(room)=>{resetRoundRuntime();currentRoom=null;lastRoomRevision=-1;partyConfig={games:[{id:'draw',name:'お絵描き当て'},{id:'telephone',name:'お絵描き伝言'},{id:'ng_word',name:'NGワード'}]};appSuspended=false;renderRoom(room);};`});
 await page.waitForFunction(()=>typeof testRoom==='function');
 await page.evaluate(()=>{globalThis.sent=[];FlecityBridge.call=async(action,payload)=>{sent.push({action,payload});return {ok:false,error:'RATE_LIMIT'};};});
 return {page,errors};
}

function roomFor(gameId,roundState){return {
 code:'1234',revision:1,state:'round',selectedGame:gameId,isHost:true,connectedCount:2,
 players:[{memberId:'a',name:'A'},{memberId:'b',name:'B'}],
 roundState:{token:'audit',gameId,...roundState}
};}

test('drawing game keeps the end of a long drag and sends interrupted lines',async t=>{
 const context=await loadPartyBrowser(t);if(!context)return;
 const {page,errors}=context;
 const room=roomFor('draw',{isDrawer:true,drawerMemberId:'a',prompt:'ねこ',strokes:[]});
 await page.evaluate(room=>testRoom(room),room);
 for(const interruption of ['pointerup','pointercancel','lostpointercapture']){
  await page.evaluate(()=>globalThis.sent=[]);
  await page.evaluate(interruption=>{
   const canvas=document.getElementById('drawCanvas'),rect=canvas.getBoundingClientRect();
   const emit=(type,x)=>canvas.dispatchEvent(new PointerEvent(type,{pointerId:5,isPrimary:true,bubbles:true,clientX:rect.left+x*rect.width,clientY:rect.top+rect.height*0.5}));
   emit('pointerdown',0.05);
   for(let i=0;i<140;i++)emit('pointermove',0.05+i*0.006);
   emit(interruption,0.88);
  },interruption);
  await page.waitForFunction(()=>globalThis.sent.some(e=>e.action==='partyAddDrawStroke'),null,{timeout:3000});
  const record=await page.evaluate(()=>globalThis.sent.find(e=>e.action==='partyAddDrawStroke'));
  assert.equal(record.action,'partyAddDrawStroke');
  assert(record.payload.points.length<=48);
  assert(record.payload.points.at(-1).x>0.8,`${interruption}: long stroke endpoint was lost`);
 }
 assert.deepEqual(errors,[]);
});

test('telephone long drag stays drawable and taboo clue rejection remains editable',async t=>{
 const context=await loadPartyBrowser(t);if(!context)return;
 const {page,errors}=context;
 await page.evaluate(room=>testRoom(room),roomFor('telephone',{step:1,totalSteps:2,isCurrent:true,currentMemberId:'a',mode:'draw',promptText:'ねこ'}));
 await page.evaluate(()=>{
  const canvas=document.getElementById('telephoneCanvas'),rect=canvas.getBoundingClientRect();
  const emit=(type,x)=>canvas.dispatchEvent(new PointerEvent(type,{pointerId:4,isPrimary:true,bubbles:true,clientX:rect.left+x*rect.width,clientY:rect.top+rect.height*0.5}));
  emit('pointerdown',0.03);
  for(let i=0;i<145;i++)emit('pointermove',0.03+i*0.006);
  emit('pointerup',0.9);
 });
 await page.locator('#telephoneDrawSubmit').click();
 const [sent]=await page.evaluate(()=>globalThis.sent);
 assert.equal(sent.action,'partySubmitTelephoneDrawing');
 assert(sent.payload.strokes[0].length<=48);
 assert(sent.payload.strokes[0].at(-1).x>0.8);
 await page.evaluate(room=>testRoom(room),roomFor('ng_word',{phase:'clue',isExplainer:true,explainerMemberId:'a',targetWord:'カレー',forbiddenWords:['辛い']}));
 await page.evaluate(()=>{globalThis.sent=[];FlecityBridge.call=async(action,payload)=>{sent.push({action,payload});return {ok:false,error:'TABOO_FORBIDDEN_WORD',matchedTerm:'辛い'};};});
 await page.locator('#ngWordClue').fill('短い');
 await page.locator('#ngWordClueSubmit').click();
 assert.equal((await page.evaluate(()=>globalThis.sent)).length,0,'short clue was sent before validation');
 assert.match(await page.locator('#status').textContent(),/3文字以上/);
 await page.locator('#ngWordClue').fill('とても辛い食べ物です');
 await page.locator('#ngWordClueSubmit').click();
 assert.equal(await page.locator('#ngWordClue').inputValue(),'とても辛い食べ物です');
 assert.match(await page.locator('#status').textContent(),/辛い/);
 assert.deepEqual(errors,[]);
});
