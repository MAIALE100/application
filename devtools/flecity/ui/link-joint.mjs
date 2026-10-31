import assert from 'node:assert/strict';
import fs from 'node:fs';import path from 'node:path';
import {jointTranscript} from '../fixtures/link-joint.mjs';
import {captureLayout,saveLayout} from './layout-audit.mjs';
import {command,luaRuntime,tool,repo,sha,local} from '../core.mjs';
import {createRequire} from 'node:module';
import {comparePixels} from '../ui-image-compare.mjs';
export async function prepareJoint(ctx,page){
 ctx.joint=jointTranscript(ctx.source);
 const before=path.join(repo,'.flecity-dev/joint-release/memory-before.lua');
 if(fs.existsSync(before)){
  ctx.memoryEvidence={};
  for(const [label,file]of [['before',before],['after',path.join(ctx.source,'server/core/party.lua')]]){
   const r=command(luaRuntime(),[path.join(tool,'tests/lua/link-joint.lua'),ctx.source,file,'deadline-evidence']);
   if(!r.ok)throw Error(r.output);
   ctx.memoryEvidence[label]={...JSON.parse(r.output),sourceSha256:sha(fs.readFileSync(file))};
  }
 }
 fs.writeFileSync(path.join(ctx.run.dir,'joint-transcript.json'),JSON.stringify(ctx.joint,null,2)+'\n');
 await page.route('**/web/party/app.js',route=>route.fulfill({contentType:'application/javascript',body:ctx.read('web/party/app.js')+`
// In-memory audit exports; never shipped or written into the application.
globalThis.__jointRender=(config,room)=>{
 resetRoundRuntime();currentRoom=null;lastRoomRevision=-1;serverOffsetReady=false;appSuspended=false;
 partyConfig=config;gameEl.innerHTML='';
 for(const g of config.games){const o=document.createElement('option');o.value=g.id;o.textContent=g.name;gameEl.appendChild(o);}
 return renderRoom(room);
};
globalThis.__jointTransition=room=>renderRoom(room);
globalThis.__jointEntry=()=>showEntry();` }));
}
export async function jointScenario(ctx,page){
 ctx.solo.activate(null);
 const rows=[];
 for(const g of ctx.joint.games){
  for(const [width,height] of [[390,844],[1366,768],[1920,1080],[2560,1440]]){
   await page.setViewportSize({width,height});
   await page.evaluate(expanded=>document.body.classList.toggle('screen-expanded',expanded),width>600);
   // Each private-role view uses its real server projection, not an invented UI fixture.
   const views=[...g.views,...(g.resultView?[g.resultView]:[])];
   for(let i=0;i<views.length;i++){
    await page.evaluate(({config,room})=>__jointRender(config,room),{config:ctx.joint.config,room:views[i]});
    assert(await page.locator('#roundPanel').isVisible(),g.id);
    const result=await captureLayout(ctx,page,`joint-${g.id}-${i+1}-${width}`);
    rows.push({game:g.id,viewer:i+1,...result});
   }
  }
 }
 await page.evaluate(()=>document.body.classList.remove('screen-expanded'));
 saveLayout(ctx,'joint-layout',rows);
 const telephone=ctx.joint.games.find(g=>g.id==='telephone');
 assert.equal(telephone.players,6);
 await page.evaluate(({config,room})=>__jointRender(config,room),{config:ctx.joint.config,room:telephone.views[0]});
 await page.locator('#telephoneText').evaluate(el=>el.value='前ゲームの入力');
 await page.evaluate(room=>__jointTransition(room),telephone.resultView);
 await captureLayout(ctx,page,'telephone-six-player-results');
 await page.evaluate(room=>__jointTransition(room),telephone.switchViews[0]);
 assert.equal(await page.locator('#telephoneText').inputValue(),'','Previous telephone input remained after lobby return');
 assert(await page.locator('#lobbyPanel').isVisible());
 await page.evaluate(room=>__jointTransition(room),telephone.switchViews[6]);
 assert.equal(await page.locator('#game').inputValue(),'vote');
 await captureLayout(ctx,page,'telephone-fall-vote-switch');
 await page.evaluate(()=>__jointEntry());
 await page.locator('#code').fill('2468');
 await page.locator('#code').focus();
 assert.equal(await page.locator('#code').inputValue(),'2468');
 assert(await page.locator('#code').evaluate(el=>document.activeElement===el),'Room code input lost focus');
 const diagnostics=await page.evaluate(()=>globalThis.FlecityDiagnostics.snapshot());
 assert(diagnostics.some(x=>x.event==='room-focus'&&x.focused===true));
 assert(diagnostics.some(x=>x.event==='room-input'&&x.length===4));
 assert(!JSON.stringify(diagnostics).includes('2468')&&!JSON.stringify(diagnostics).includes('試験のお題')&&!JSON.stringify(diagnostics).includes('JOINT_'));
 fs.writeFileSync(path.join(ctx.run.dir,'safe-diagnostics.json'),JSON.stringify(diagnostics,null,2)+'\n');
 if(ctx.memoryEvidence){
  await page.setViewportSize({width:360,height:844});
  for(const [label,evidence]of Object.entries(ctx.memoryEvidence)){
   await page.evaluate(({config,room})=>__jointRender(config,room),evidence);
   await captureLayout(ctx,page,'memory-deadline-'+label);
  }
  const require=createRequire(local().browser.module),{PNG}=require('pngjs');
  const img=label=>PNG.sync.read(fs.readFileSync(path.join(ctx.run.dir,'screenshots/memory-deadline-'+label+'.png')));
  const pixels=comparePixels(img('before'),img('after'));
  assert(pixels.changed>0,'Expected functional screen change is missing');
  const comparison={...pixels,status:'CHANGED_EXPECTED',kind:'informational; not approved-baseline validation'};
  fs.writeFileSync(path.join(ctx.run.dir,'memory-before-after.json'),JSON.stringify({kind:'functional-change-evidence',approvedBaseline:false,comparison,states:ctx.memoryEvidence},null,2)+'\n');
  assert.equal(ctx.memoryEvidence.before.room.roundState.complete,true);
  assert.equal(ctx.memoryEvidence.after.room.roundState.complete,false);
  assert.equal(ctx.memoryEvidence.after.room.roundState.phase,'input');
  const answer=ctx.memoryEvidence.before.room.roundState.sequence.join('');
  await page.evaluate(room=>{
   const original=globalThis.fetchNui;
   globalThis.fetchNui=async(event,request)=>{
    if(request.action==='partySubmitMemoryChain'){
     globalThis.__memorySubmit=request.payload;
     return {ok:true,room:{...room,roundState:{...room.roundState,selfSubmitted:true}}};
    }
    return original(event,request);
   };
  },ctx.memoryEvidence.after.room);
  for(const symbol of answer)await page.locator('#memoryChainButtons [data-memory="'+symbol+'"]').click();
  await page.locator('#memoryChainReset').click();
  assert.equal(await page.locator('#memoryChainInput').textContent(),'入力: ---');
  for(const symbol of answer)await page.locator('#memoryChainButtons [data-memory="'+symbol+'"]').click();
  await page.locator('#memoryChainSubmit').click();
  await page.waitForFunction(()=>!!globalThis.__memorySubmit);
  assert.deepEqual(await page.evaluate(()=>globalThis.__memorySubmit),{token:ctx.memoryEvidence.after.room.roundState.token,answer});
  await captureLayout(ctx,page,'memory-browser-submitted');
 }
 const failures=rows.filter(r=>r.horizontalOverflow||r.clipped.length||r.textClipping.length||r.overlaps.length);
 assert.equal(failures.length,0,'Geometry review required: '+JSON.stringify(failures.map(({game,viewer,viewport,clipped,textClipping,overlaps,horizontalOverflow})=>({game,viewer,width:viewport.width,clipped,textClipping,overlaps,horizontalOverflow}))));
}
