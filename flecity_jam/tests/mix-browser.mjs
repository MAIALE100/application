// Retained 25-note preset regression; fresh home18 has independent hands-browser coverage.
import {PIANO_KEYS} from '../web/model.mjs';
// Offline per-performer listening UI checks. Remote packets are synthetic, not live FiveM.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';

const resource=fileURLToPath(new URL('../',import.meta.url)),web=path.join(resource,'web');
const evidence=path.resolve(process.env.JAM_MIX_REPORT_DIR||path.join(resource,'../.flecity-dev/jam/mix-browser'));
fs.mkdirSync(evidence,{recursive:true});
const modulePath=process.env.JAM_PLAYWRIGHT_MODULE||'C:/Users/suivx/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
const {chromium}=await import(path.isAbsolute(modulePath)?pathToFileURL(modulePath):modulePath);
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--autoplay-policy=no-user-gesture-required']});
const results=[],errors=[],pages=[];
async function check(name,fn){
  try{await fn();results.push({name,status:'PASS'});console.log('PASS '+name);}
  catch(error){results.push({name,status:'FAIL',error:String(error.stack||error)});console.error('FAIL '+name+': '+error.message);}
}
async function fixture(settings=true){
  const page=await browser.newPage({viewport:{width:1366,height:768}});pages.push(page);page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/*',async route=>{
    const url=new URL(route.request().url());assert.equal(url.origin,'https://jam.test');
    const file=path.resolve(web,decodeURIComponent(url.pathname).replace(/^\//,'')||'index.html');assert(file.startsWith(web+path.sep));
    const mime={'.html':'text/html','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.ogg':'audio/ogg','.wav':'audio/wav'};
    await route.fulfill({status:200,contentType:mime[path.extname(file)]||'application/octet-stream',body:fs.readFileSync(file)});
  });
  await page.addInitScript(keys=>{if(!localStorage.getItem('flecity-jam-v4'))localStorage.setItem('flecity-jam-v4',JSON.stringify({version:4,layout:'piano',bindings:{piano:keys}}));},PIANO_KEYS);
  await page.goto('https://jam.test/');await page.waitForFunction(()=>window.JAM);await page.click('#start');await page.waitForFunction(()=>Boolean(JAM.session));
  if(settings)await page.click('#settingsToggle');return page;
}
const row=(page,id)=>page.locator(`#peerMix label[data-player="${id}"]`);
const input=(page,id)=>row(page,id).locator('input');
async function send(page,data){await page.evaluate(packet=>JAM.message(packet),data);}
async function snapshot(page,id,extra={}){
  await send(page,{type:'remote',data:{player:id,session:'synthetic-'+id,kind:'snapshot',wire:1,rev:0,instrument:'piano',volume:.8,range:15,sustain:false,notes:[{id:1,pitch:60,velocity:100,held:true,age:0}],...extra}});
}
async function positions(page,sources=[{player:2,x:1,y:0,z:0},{player:3,x:3,y:0,z:0}]){
  await send(page,{type:'positions',listener:{x:0,y:0,z:0,fx:0,fy:1,fz:0},sources});
}
async function level(page,id,value){
  const slider=input(page,id);await slider.focus();const fromLow=value<=50;await page.keyboard.press(fromLow?'Home':'End');
  for(let i=0;i<(fromLow?value:100-value);i++)await page.keyboard.press(fromLow?'ArrowRight':'ArrowLeft');
  assert.equal(await slider.inputValue(),String(value));assert.equal(await row(page,id).locator('output').innerText(),value+'%');
}
async function gain(page,id,wanted){
  await page.waitForFunction(({id,wanted})=>Math.abs(JAM.audio.slots.get(id).gain.gain.value-wanted)<.0001,{id,wanted});
}

try{
  await check('empty listening mixer has a clear guide and no active reset control',async()=>{
    const page=await fixture();assert.equal(await page.locator('#peerMix label').count(),0);assert(await page.locator('#peerMixEmpty').isVisible());assert(await page.locator('#resetPeerMix').isDisabled());
  });
  await check('synthetic performers get separate labelled controls at 100 percent',async()=>{
    const page=await fixture();await snapshot(page,2);await snapshot(page,3);await positions(page);
    assert.equal(await page.locator('#peerMix label').count(),2);assert(await page.locator('#peerMixEmpty').isHidden());assert(await page.locator('#resetPeerMix').isEnabled());
    for(const id of [2,3]){assert.equal(await input(page,id).inputValue(),'100');assert.equal(await input(page,id).getAttribute('aria-label'),`演奏者${id}の楽器音量`);assert.match(await row(page,id).innerText(),/グランドピアノ/);}
    assert.equal(await page.locator('#nearby').innerText(),'周囲 2人');
  });
  await check('real range keys independently change instrument gain without touching master, local volume or voice',async()=>{
    const page=await fixture();await snapshot(page,2);await snapshot(page,3);await positions(page);
    const before=await page.evaluate(()=>({master:JAM.audio.masterVolume,masterGain:JAM.audio.master.gain.value,volume:JAM.model.volume,voice:document.querySelector('#voice').getAttribute('aria-pressed')}));
    await level(page,2,0);await gain(page,2,0);assert.equal(await input(page,3).inputValue(),'100');
    await level(page,3,37);await gain(page,3,.8*(144/196)*.37);
    assert.equal(await page.evaluate(()=>JAM.audio.slots.get(2).listenVolume),0);assert.equal(await page.evaluate(()=>JAM.audio.slots.get(3).listenVolume),.37);
    const after=await page.evaluate(()=>({master:JAM.audio.masterVolume,masterGain:JAM.audio.master.gain.value,volume:JAM.model.volume,voice:document.querySelector('#voice').getAttribute('aria-pressed')}));assert.deepEqual(after,before);
    const stored=await page.evaluate(()=>JSON.parse(localStorage.getItem('flecity-jam-v4')));assert.equal(Object.hasOwn(stored,'peerVolumes'),false,'transient performer IDs must not become persistent preferences');
  });
  await check('new snapshots, volume deltas and positions retain the local listening preference',async()=>{
    const page=await fixture();await snapshot(page,2);await positions(page);await level(page,2,25);
    await snapshot(page,2,{wire:2,rev:1,volume:.4});await positions(page,[{player:2,x:7,y:0,z:0}]);
    assert.equal(await input(page,2).inputValue(),'25');assert.equal(await page.evaluate(()=>JAM.audio.slots.get(2).listenVolume),.25);await gain(page,2,.4*(64/196)*.25);
    await send(page,{type:'remote',data:{player:2,session:'synthetic-2',kind:'delta',wire:3,rev:2,ops:[{kind:'volume',value:.6}]}});
    assert.equal(await input(page,2).inputValue(),'25');await gain(page,2,.6*(64/196)*.25);
  });
  await check('wire-gap recovery preserves a muted peer before its replacement audio slot can render',async()=>{
    const page=await fixture();await snapshot(page,2);await positions(page);await level(page,2,0);
    await send(page,{type:'remote',data:{player:2,session:'synthetic-2',kind:'delta',wire:2,rev:2,ops:[]}});
    assert.equal(await page.evaluate(()=>JAM.audio.slots.has(2)),false);assert.equal(await input(page,2).inputValue(),'0');
    await snapshot(page,2,{wire:3,rev:2});
    const slot=await page.evaluate(()=>{const s=JAM.audio.slots.get(2);return {volume:s.listenVolume,gain:s.gain.gain.value};});assert.deepEqual(slot,{volume:0,gain:0});
    await positions(page);await gain(page,2,0);assert.equal(await input(page,2).inputValue(),'0');
  });
  await check('new sessions and stopped then recycled player IDs start at 100 percent',async()=>{
    const page=await fixture();await snapshot(page,2);await level(page,2,0);
    await snapshot(page,2,{session:'replacement',wire:2});assert.equal(await input(page,2).inputValue(),'100');assert.equal(await page.evaluate(()=>JAM.audio.slots.get(2).listenVolume),1);
    await level(page,2,10);await send(page,{type:'remote',data:{player:2,session:'replacement',kind:'stop',wire:3}});
    assert.equal(await page.locator('#peerMix label').count(),0);assert.equal(await page.evaluate(()=>JAM.audio.slots.has(2)),false);
    await snapshot(page,2,{session:'replacement',wire:4});assert.equal(await input(page,2).inputValue(),'100');assert.equal(await page.evaluate(()=>JAM.audio.slots.get(2).listenVolume),1);
  });
  await check('explicit expiry removes rows, local volume cache and stale performer counts',async()=>{
    const page=await fixture();await snapshot(page,2);await level(page,2,0);await send(page,{type:'expire',player:2,session:'synthetic-2'});
    assert.equal(await page.locator('#peerMix label').count(),0);assert.equal(await page.locator('#nearby').innerText(),'周囲 0人');assert(await page.locator('#peerMixEmpty').isVisible());
    assert.equal(await page.evaluate(()=>JAM.audio.slots.has(2)),false);
    await snapshot(page,2,{wire:2});assert.equal(await input(page,2).inputValue(),'100');assert.equal(await page.evaluate(()=>JAM.audio.slots.get(2).listenVolume),1);
  });
  await check('automatic timeout removes inactive rows and reset clears every cached peer preference',async()=>{
    const page=await fixture();await snapshot(page,2);await level(page,2,0);
    await page.waitForFunction(()=>JAM.replicas.states.size===0,null,{timeout:5500});assert.equal(await page.locator('#peerMix label').count(),0);assert(await page.locator('#resetPeerMix').isDisabled());
    await snapshot(page,2,{wire:2});await snapshot(page,3);await level(page,2,0);await level(page,3,0);
    await send(page,{type:'reset'});assert.equal(await page.locator('#peerMix label').count(),0);assert.equal(await page.evaluate(()=>JAM.audio.slots.size),0);assert.equal(await page.locator('#nearby').innerText(),'周囲 0人');
    await send(page,{type:'open'});await page.click('#settingsToggle');await snapshot(page,2);assert.equal(await input(page,2).inputValue(),'100');
  });
  await check('joining and leaving performers preserve the existing slider node, focus and arrow-key interaction',async()=>{
    const page=await fixture();await snapshot(page,3);await level(page,3,44);const node=await input(page,3).elementHandle();
    await snapshot(page,2);await snapshot(page,4);assert(await node.evaluate(element=>element===document.querySelector('#peerMix label[data-player="3"] input')));
    assert.equal(await page.evaluate(()=>document.activeElement===document.querySelector('#peerMix label[data-player="3"] input')),true);
    await page.keyboard.press('ArrowLeft');assert.equal(await input(page,3).inputValue(),'43');assert.equal(await page.evaluate(()=>JAM.audio.slots.get(3).listenVolume),.43);
    await send(page,{type:'remote',data:{player:2,session:'synthetic-2',kind:'stop',wire:2}});
    assert.equal(await page.evaluate(()=>document.activeElement===document.querySelector('#peerMix label[data-player="3"] input')),true,'removing an earlier row must not blur the remaining slider');
  });
  await check('opening listening settings and adjusting a peer preserves held piano notes and PTT input state',async()=>{
    const page=await fixture(false);await snapshot(page,2);await page.locator('#playArea').focus();await page.keyboard.down('z');await page.keyboard.down('n');
    await page.click('#settingsToggle');assert.equal(await page.evaluate(()=>JAM.model.notes.size),1);assert.equal(await page.locator('#voice').getAttribute('aria-pressed'),'true');
    await level(page,2,0);assert.equal(await page.evaluate(()=>JAM.model.notes.size),1);assert.equal(await page.locator('#voice').getAttribute('aria-pressed'),'true');
    await page.keyboard.up('z');await page.keyboard.up('n');assert.equal(await page.evaluate(()=>JAM.model.notes.size),0);assert.equal(await page.locator('#voice').getAttribute('aria-pressed'),'false');
  });
  await check('reset restores every peer to 100 percent and pointer adjustment returns focus to playing',async()=>{
    const page=await fixture();await snapshot(page,2);await snapshot(page,3);await positions(page);await level(page,2,0);await level(page,3,25);
    await page.click('#resetPeerMix');for(const id of [2,3]){assert.equal(await input(page,id).inputValue(),'100');assert.equal(await page.evaluate(id=>JAM.audio.slots.get(id).listenVolume,id),1);}
    assert.equal(await page.evaluate(()=>document.activeElement.id),'playArea');
    await input(page,2).scrollIntoViewIfNeeded();const box=await input(page,2).boundingBox();assert(box);await page.mouse.move(box.x+box.width*.5,box.y+box.height/2);await page.mouse.down();await page.mouse.move(box.x+box.width*.3,box.y+box.height/2,{steps:5});await page.mouse.up();
    assert.equal(await page.evaluate(()=>document.activeElement.id),'playArea');const value=Number(await input(page,2).inputValue());assert(value>0&&value<100);assert.equal(await page.evaluate(()=>JAM.audio.slots.get(2).listenVolume),value/100);
    await page.keyboard.down('z');await page.keyboard.down('Space');await page.keyboard.up('z');assert.equal(await page.evaluate(()=>JAM.model.notes.size),1);await page.keyboard.up('Space');assert.equal(await page.evaluate(()=>JAM.model.notes.size),0);
  });
  await check('seven synthetic performer controls stay readable and inside the settings at 390, 1366 and 1920 widths',async()=>{
    const page=await fixture();for(let id=2;id<=8;id++)await snapshot(page,id);
    for(const [width,height]of [[390,844],[1366,768],[1920,1080]]){
      await page.setViewportSize({width,height});await page.locator('#peerMix').scrollIntoViewIfNeeded();
      const geometry=await page.locator('#peerMix').evaluate(list=>{
        const rect=list.getBoundingClientRect(),bad=[];
        for(const row of list.children)for(const child of row.children){const r=child.getBoundingClientRect();if(r.left<rect.left-.5||r.right>rect.right+.5||r.width<1)bad.push(row.dataset.player+':'+child.tagName);}
        return {bad,screen:innerWidth,scroll:document.documentElement.scrollWidth};
      });
      assert.deepEqual(geometry.bad,[]);assert(geometry.scroll<=geometry.screen+.5);assert.equal(await page.locator('#peerMix label').count(),7);
      await page.screenshot({path:path.join(evidence,`mix-${width}.png`)});
    }
  });
}finally{
  for(const page of pages)await page.close().catch(()=>{});await browser.close();
  const report={at:new Date().toISOString(),scope:'Offline headless Chromium; synthetic remote snapshots/positions exercise app routing and AudioRack nodes. Local mixer interaction uses real browser keyboard/mouse. No FiveM, microphone, other player, actual spatial listening or Voice resource.',passed:results.filter(result=>result.status==='PASS').length,failed:results.filter(result=>result.status==='FAIL').length,results,pageErrors:errors,liveMultiplayerAudio:'NOT_RUN',nativePTT:'NOT_RUN'};
  fs.writeFileSync(path.join(evidence,'mix-browser-results.json'),JSON.stringify(report,null,2)+'\n');
  console.log(`Mix browser: ${report.passed} PASS, ${report.failed} FAIL; report ${evidence}`);if(report.failed||errors.length)process.exitCode=1;
}
