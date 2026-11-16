// Isolated Chromium NUI simulation. No FiveM process or real server is contacted.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';

const root=fileURLToPath(new URL('../',import.meta.url));
const playwrightPath=process.env.JAM_PLAYWRIGHT_MODULE||'C:/Users/suivx/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
const {chromium}=await import(path.isAbsolute(playwrightPath)?pathToFileURL(playwrightPath):playwrightPath);
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--autoplay-policy=no-user-gesture-required']});
let page;
const calls={ready:0,pulse:0,start:0,input:[],stop:0,catalog:0};
let heldInput;
try {
  page=await browser.newPage();
  await page.addInitScript(()=>{window.GetParentResourceName=()=> 'jam.test';});
  await page.route('**/*',async route=>{
    const request=route.request(),url=new URL(request.url());
    if(url.origin!=='https://jam.test'){await route.abort();return;}
    if(request.method()==='POST'){
      const name=url.pathname.slice(1);
      if(name==='ready')calls.ready++;
      if(name==='pulse')calls.pulse++;
      if(name==='start')calls.start++;
      if(name==='stop')calls.stop++;
      if(name==='input'){
        const body=JSON.parse(request.postData()||'{}');
        calls.input.push({session:body.session,at:Date.now()});
        if(body.session==='old'&&!heldInput){heldInput=route;return;}
      }
      await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:name!=='ready'||calls.ready>4})});
      return;
    }
    const relative=decodeURIComponent(url.pathname).replace(/^\//,'')||'index.html';
    const web=path.resolve(root,'web'),file=path.resolve(web,relative);
    if(!file.startsWith(web+path.sep)||!fs.existsSync(file)){await route.fulfill({status:404,body:'Not found'});return;}
    if(relative==='catalog.json')calls.catalog++;
    const mime={'.html':'text/html','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.ogg':'audio/ogg','.wav':'audio/wav'};
    let body=fs.readFileSync(file);
    if(relative==='audio.mjs')body=Buffer.from(body.toString('utf8')+`
      const originalUnlock=AudioRack.prototype.unlock;
      AudioRack.prototype.unlock=async function(){if(window.__holdUnlockOnce){window.__holdUnlockOnce=false;return await new Promise(resolve=>{window.__releaseHeldUnlock=resolve;});}if(window.__forceUnlockFalse){window.__forceUnlockFalse=false;return false;}const value=await originalUnlock.call(this);window.__rack=this;window.__unlockCalls=(window.__unlockCalls||0)+1;return value;};
      const originalLoad=AudioRack.prototype.load;
      AudioRack.prototype.load=async function(id){const value=await originalLoad.call(this,id);if(window.__interruptNextLoad){window.__interruptNextLoad=false;await this.ctx.suspend();window.__interrupted=true;}return value;};
    `);
    await route.fulfill({status:200,contentType:mime[path.extname(file)]||'application/octet-stream',body});
  });

  await page.goto('https://jam.test/');
  for(let i=0;i<40&&calls.ready<2;i++)await page.waitForTimeout(25);
  assert.equal(calls.ready,2,'boot should try ready exactly twice before showing recovery');
  assert.equal(calls.catalog,1,'retry must retain a successfully loaded catalog');
  assert(await page.locator('#retryBoot').isHidden(),'a retry control must not cover the game before JAM opens');
  await page.evaluate(()=>window.dispatchEvent(new MessageEvent('message',{data:{type:'open',range:7,reserved:[]}})));
  for(let i=0;i<40&&calls.ready<4;i++)await page.waitForTimeout(25);
  await page.locator('#retryBoot').waitFor({state:'visible'});
  assert.equal(calls.ready,4,'early open should get one bounded automatic retry');
  const pulsesBefore=calls.pulse;
  await page.waitForTimeout(4600);
  assert(calls.pulse-pulsesBefore>=4,'boot failure must keep the client watchdog alive while an open view awaits retry');
  await page.click('#retryBoot');
  await page.waitForFunction(()=>document.querySelector('#instrument').options.length>0 && document.querySelector('#retryBoot').hidden && !document.querySelector('#panel').hidden);
  assert.equal(calls.ready,5);
  assert.equal(calls.catalog,1);
  assert(await page.locator('#notice').isHidden(),'the old boot failure must clear after recovery');
  const catalog=JSON.parse(fs.readFileSync(path.join(root,'web/catalog.json'),'utf8'));
  assert.equal(await page.locator('#instrument option').count(),catalog.instruments.length);
  console.log('PASS bounded ready retry, boot pulse, and in-place recovery (mock NUI)');

  await page.waitForFunction(()=>window.__rack?.ctx);
  await page.evaluate(async()=>{
    window.dispatchEvent(new MessageEvent('message',{data:{type:'close'}}));
    await window.__rack.ctx.suspend();
    window.__forceUnlockFalse=true;
    window.dispatchEvent(new MessageEvent('message',{data:{type:'open',listenOnly:true,range:7}}));
  });
  await page.locator('#resumeAudio').waitFor({state:'visible'});
  assert.match(await page.locator('#status').innerText(),/音声が停止/);
  await page.evaluate(()=>{window.__forceUnlockFalse=true;});
  await page.click('#resumeAudio');
  await page.locator('#error').waitFor({state:'visible'});
  assert(await page.locator('#resumeAudio').isVisible(),'failed resume must retain a retry action');
  await page.click('#resumeAudio');
  await page.locator('#resumeAudio').waitFor({state:'hidden'});
  assert(await page.locator('#error').isHidden(),'successful resume must clear the prior error');
  assert.equal(await page.evaluate(()=>window.__rack.ctx.state),'running');
  console.log('PASS listener-only audio unlock exposes user gesture and retry (mock NUI)');
  await page.evaluate(async()=>{await window.__rack.ctx.suspend();window.__holdUnlockOnce=true;});
  await page.locator('#resumeAudio').waitFor({state:'visible'});
  await page.click('#resumeAudio');
  assert(await page.locator('#resumeAudio').isDisabled(),'pending resume should disable duplicate clicks');
  await page.evaluate(()=>{
    window.dispatchEvent(new MessageEvent('message',{data:{type:'close'}}));
    window.__forceUnlockFalse=true;
    window.dispatchEvent(new MessageEvent('message',{data:{type:'open',listenOnly:true,range:7}}));
  });
  assert(await page.locator('#resumeAudio').isVisible());
  assert(await page.locator('#resumeAudio').isEnabled(),'new listener view must allow retry despite an old pending resume');
  await page.evaluate(()=>window.__releaseHeldUnlock(false));
  assert(await page.locator('#resumeAudio').isEnabled(),'stale completion must not disable the new retry');
  await page.click('#resumeAudio');
  await page.locator('#resumeAudio').waitFor({state:'hidden'});
  console.log('PASS stale audio-unlock completion leaves reopened listener retry enabled (mock NUI)');
  await page.evaluate(()=>{
    window.dispatchEvent(new MessageEvent('message',{data:{type:'close'}}));
    window.dispatchEvent(new MessageEvent('message',{data:{type:'open',range:7}}));
  });

  await page.click('#settingsToggle');
  await page.evaluate(()=>{window.__forceUnlockFalse=true;});
  await page.click('#metro');
  assert.equal(await page.locator('#metro').getAttribute('aria-pressed'),'false','metronome must remain off when audio cannot resume');
  await page.click('#settingsToggle');
  console.log('PASS metronome rejects unavailable audio (mock NUI)');

  await page.waitForFunction(()=>{
    const r=window.__rack,s=r?.catalog.get('piano');
    return s?.samples.every(sample=>r.buffers.has(sample.file));
  },null,{timeout:15000});
  const beforeUnlock=await page.evaluate(()=>window.__unlockCalls);
  await page.evaluate(()=>{window.__interruptNextLoad=true;});
  await page.click('#start');
  await page.waitForFunction(()=>document.querySelector('#start').getAttribute('aria-busy')==='true');
  await page.waitForFunction(()=>document.querySelector('#start').getAttribute('aria-busy')==='true' && document.querySelector('#status').textContent.includes('準備'));
  await page.waitForFunction(()=>window.__interrupted===true && window.__rack?.ctx.state==='running');
  assert((await page.evaluate(()=>window.__unlockCalls))-beforeUnlock>=2,'start must unlock again after load suspends audio');
  await page.waitForFunction(()=>document.querySelector('#start').disabled && document.querySelector('#status').textContent.includes('準備'));
  await page.waitForTimeout(50);
  assert.equal(calls.start,1);
  console.log('PASS start restores audio after sample-load interruption (mock NUI)');

  await page.evaluate(()=>window.dispatchEvent(new MessageEvent('message',{data:{type:'control',data:{kind:'started',session:'old',instrument:'piano',maxNotes:16}}})));
  await page.waitForFunction(()=>document.querySelector('#start').textContent.includes('休む'));
  await page.waitForFunction(()=>document.querySelector('#voiceCount') && document.querySelector('#start').getAttribute('aria-busy')==='false');
  for(let i=0;i<40&&!heldInput;i++)await page.waitForTimeout(25);
  assert(heldInput,'first session input should be held by the mock transport');
  await page.click('#start');
  await page.click('#start');
  for(let i=0;i<80&&calls.start<2;i++)await page.waitForTimeout(25);
  assert.equal(calls.start,2);
  const switchedAt=Date.now();
  await page.evaluate(()=>window.dispatchEvent(new MessageEvent('message',{data:{type:'control',data:{kind:'started',session:'new',instrument:'piano',maxNotes:16}}})));
  await page.waitForFunction(()=>document.querySelector('#start').textContent.includes('休む'));
  for(let i=0;i<20&&!calls.input.some(input=>input.session==='new');i++)await page.waitForTimeout(50);
  const newInput=calls.input.find(input=>input.session==='new');
  assert(newInput,'new session must send despite prior hung input');
  assert(newInput.at-switchedAt<1500,'new session must not wait for stale bridge timeout');
  await heldInput.fulfill({status:200,contentType:'application/json',body:'{"ok":true}'});
  await page.waitForTimeout(50);
  assert(await page.locator('#start').innerText()!=='演奏する','old response must not stop new session');
  console.log('PASS old transport queue cannot block or stop new session (mock NUI)');
}finally{
  if(heldInput)try{await heldInput.fulfill({status:200,contentType:'application/json',body:'{"ok":true}'})}catch{}
  await page?.close();await browser.close();
}
