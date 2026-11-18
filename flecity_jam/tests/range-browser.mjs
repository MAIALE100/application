// Isolated native-select and mock NUI checks; no FiveM, player settings or external server.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {DEFAULT_KEYS,PIANO_KEYS,EXPANDED_KEYS,DRUM_KEYS} from '../web/model.mjs';

const resource=fileURLToPath(new URL('../',import.meta.url)),web=path.join(resource,'web');
const evidence=path.resolve(process.env.JAM_RANGE_REPORT_DIR||path.join(resource,'../.flecity-dev/jam/QA/range-browser'));
fs.mkdirSync(evidence,{recursive:true});
const modulePath=process.env.JAM_PLAYWRIGHT_MODULE||'C:/Users/suivx/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
const {chromium}=await import(path.isAbsolute(modulePath)?pathToFileURL(modulePath):modulePath);
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--autoplay-policy=no-user-gesture-required']});
const allowed=[5,10,15,20,25],rangeKey='flecity-jam-range-v1';
const results=[],fixtures=[],errors=[],outside=[];
const protectedRecords={
  'flecity-jam-v1':'{"keys":[],"protected":"synthetic legacy record"}',
  'flecity-jam-v2':'{"version":2,"protected":"synthetic v2 record"}',
  'flecity-jam-v3':'{"version":3,"protected":"synthetic v3 record"}',
  'flecity-jam-v4':'{"version":4,"protected":"synthetic v4 record"}',
  'flecity-jam-v5':JSON.stringify({version:5,layout:'home18',bindings:{home18:DEFAULT_KEYS,piano:PIANO_KEYS,legacy:DEFAULT_KEYS,expanded:EXPANDED_KEYS,drums:DRUM_KEYS},listen:.37,muted:false,zoom:110,velocity:83,performVolume:48,showGuide:false}),
  'flecity-jam-window-v1':'{"version":1,"x":0.5,"y":1,"size":"normal"}'
};
async function check(name,fn){try{await fn();results.push({name,status:'PASS'});console.log('PASS '+name);}catch(error){results.push({name,status:'FAIL',error:String(error.stack||error)});console.error('FAIL '+name+': '+error.message);}}
async function message(page,data){await page.evaluate(value=>window.dispatchEvent(new MessageEvent('message',{data:value})),data);}
const syncs=f=>f.calls.filter(call=>call.name==='input'&&call.body.kind==='sync');
const starts=f=>f.calls.filter(call=>call.name==='start');
const badge=page=>page.locator('#rangeBadge').innerText();
const options=page=>page.locator('#shareRange option').evaluateAll(items=>items.map(item=>Number(item.value)));
const rangeRecord=page=>page.evaluate(key=>localStorage.getItem(key),rangeKey);
const protectedCurrent=page=>page.evaluate(keys=>Object.fromEntries(keys.map(key=>[key,localStorage.getItem(key)])),Object.keys(protectedRecords));
async function waitFor(f,predicate){for(let i=0;i<150&&!predicate(f);i++)await f.page.waitForTimeout(20);assert(predicate(f),'mock callback condition timed out');}
async function open(f,extra={}){await message(f.page,{type:'open',range:f.defaultRange,rangeOptions:f.options,voice:{token:'range-epoch',enabled:true},...extra});await f.page.locator('#shareRange').waitFor();}
async function fixture({raw,rangeOptions=allowed,defaultRange=15,failSave=false}={}){
  const page=await browser.newPage({viewport:{width:1366,height:768}}),f={page,calls:[],options:rangeOptions,defaultRange,rejectRange:null,session:null};fixtures.push(f);page.on('pageerror',error=>errors.push(error.message));
  await page.addInitScript(({records,raw,rangeKey,failSave})=>{
    if(!sessionStorage.getItem('range-fixture-seeded')){
      for(const [key,value]of Object.entries(records))localStorage.setItem(key,value);
      if(raw!==undefined)localStorage.setItem(rangeKey,raw);sessionStorage.setItem('range-fixture-seeded','yes');
    }
    window.GetParentResourceName=()=> 'jam.test';
    if(failSave){const set=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(this===localStorage&&key===rangeKey)throw new DOMException('isolated quota','QuotaExceededError');return set.call(this,key,value);};}
  },{records:protectedRecords,raw,rangeKey,failSave});
  await page.route('**/*',async route=>{
    const request=route.request(),url=new URL(request.url());
    if(url.origin!=='https://jam.test'){outside.push(url.origin);await route.abort();return;}
    if(request.method()==='POST'){
      const call={name:url.pathname.slice(1),body:request.postDataJSON(),at:Date.now()};f.calls.push(call);
      const rejected=call.name==='input'&&call.body.kind==='sync'&&call.body.range===f.rejectRange;
      await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:!rejected})});return;
    }
    const file=path.resolve(web,decodeURIComponent(url.pathname).replace(/^\//,'')||'index.html');assert(file.startsWith(web+path.sep));
    const mime={'.html':'text/html','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.ogg':'audio/ogg','.wav':'audio/wav'};
    let body=fs.readFileSync(file);
    // Observe cache readiness so held-note tests do not depend on arbitrary audio load delays.
    if(path.basename(file)==='audio.mjs')body=Buffer.from(body.toString('utf8')+'\nconst rangeUnlock=AudioRack.prototype.unlock;AudioRack.prototype.unlock=function(...args){window.__rangeRack=this;return rangeUnlock.apply(this,args);};\n');
    await route.fulfill({status:200,contentType:mime[path.extname(file)]||'application/octet-stream',body});
  });
  await page.goto('https://jam.test/');await page.waitForFunction(()=>document.querySelector('#instrument').options.length>0);await open(f);
  await page.waitForFunction(()=>window.__rangeRack?.catalog.get('piano').samples.every(sample=>__rangeRack.buffers.has(sample.file)),null,{timeout:15000});return f;
}
async function choose(f,value,{pointer=false}={}){
  const select=f.page.locator('#shareRange'),values=await options(f.page);assert(values.includes(value),'requested test range must be available');
  await select.scrollIntoViewIfNeeded();if(pointer)await select.click();else{await select.focus();await f.page.keyboard.press('Alt+ArrowDown');}
  const current=Number(await select.inputValue()),delta=values.indexOf(value)-values.indexOf(current);
  for(let i=0;i<Math.abs(delta);i++)await f.page.keyboard.press(delta>0?'ArrowDown':'ArrowUp');await f.page.keyboard.press('Enter');
  assert.equal(await select.inputValue(),String(value));
}
async function perform(f,{hold=false,confirmed}={}){
  if(confirmed===undefined)confirmed=Number(await f.page.locator('#shareRange').inputValue());
  const count=starts(f).length;await f.page.locator('#playArea').focus();await f.page.keyboard.down('KeyA');await waitFor(f,x=>starts(x).length>count);
  f.session='range-session-'+fixtures.indexOf(f)+'-'+count;
  await message(f.page,{type:'control',data:{kind:'started',session:f.session,instrument:'piano',range:confirmed,rangeOptions:f.options,maxNotes:16,maxNoteMs:120000}});
  await f.page.waitForFunction(()=>document.querySelector('#panel').dataset.performing==='true');if(!hold)await f.page.keyboard.up('KeyA');await waitFor(f,x=>syncs(x).length>0);
}
async function ack(f,packet,range,extra={}){await message(f.page,{type:'control',data:{kind:'range',session:f.session,range,seq:packet.body.seq,...extra}});}

try{
  await check('default native selector offers five safe choices and uses the server default without starting playback',async()=>{
    const f=await fixture();assert.deepEqual(await options(f.page),allowed);assert.equal(await f.page.locator('#shareRange').inputValue(),'15');
    assert.match(await badge(f.page),/次の演奏から適用/);assert.equal(starts(f).length,0);assert.deepEqual(await protectedCurrent(f.page),protectedRecords);
  });
  await check('actual pointer and native keyboard selection store only the independent personal range preference',async()=>{
    const f=await fixture();for(const value of [5,10,15,20,25]){await choose(f,value,{pointer:true});assert.deepEqual(JSON.parse(await rangeRecord(f.page)),{version:1,range:value});}
    assert.deepEqual(await protectedCurrent(f.page),protectedRecords);assert.equal(starts(f).length,0);assert.equal(syncs(f).length,0);
  });
  await check('a saved allowed range survives reload and reopening without modifying musical or window preferences',async()=>{
    const f=await fixture();await choose(f,25);await f.page.keyboard.press('Escape');await f.page.reload();await f.page.waitForFunction(()=>document.querySelector('#instrument').options.length>0);await open(f);
    assert.equal(await f.page.locator('#shareRange').inputValue(),'25');assert.deepEqual(JSON.parse(await rangeRecord(f.page)),{version:1,range:25});assert.deepEqual(await protectedCurrent(f.page),protectedRecords);
  });
  await check('malformed, unsupported and nonnumeric stored values fall back safely without rewriting the old range record',async()=>{
    for(const raw of ['{','null','[]','{"version":2,"range":25}','{"version":1,"range":100}','{"version":1,"range":"20"}']){
      const f=await fixture({raw});assert.equal(await f.page.locator('#shareRange').inputValue(),'15');assert.equal(await rangeRecord(f.page),raw);assert.deepEqual(await protectedCurrent(f.page),protectedRecords);await f.page.close();
    }
  });
  await check('range storage failure is reported and remains temporary rather than claiming persistence',async()=>{
    const f=await fixture({failSave:true});await choose(f,20);assert.equal(await rangeRecord(f.page),null);assert.match(await f.page.locator('#notice').innerText(),/保存できません/);
    await perform(f);assert.equal(starts(f).at(-1).body.range,20);await f.page.keyboard.press('Escape');await f.page.reload();await f.page.waitForFunction(()=>document.querySelector('#instrument').options.length>0);await open(f);
    assert.equal(await f.page.locator('#shareRange').inputValue(),'15');assert.deepEqual(await protectedCurrent(f.page),protectedRecords);
  });
  await check('open and config restrict candidates and fall back from a disallowed saved choice without erasing it',async()=>{
    const raw='{"version":1,"range":20}',f=await fixture({raw,rangeOptions:[5,15,25]});assert.deepEqual(await options(f.page),[5,15,25]);assert.equal(await f.page.locator('#shareRange').inputValue(),'15');assert.equal(await rangeRecord(f.page),raw);
    await message(f.page,{type:'config',rangeOptions:[10,20],range:25});assert.deepEqual(await options(f.page),[10,20]);
    assert((await options(f.page)).includes(Number(await f.page.locator('#shareRange').inputValue())));assert.equal(await rangeRecord(f.page),raw);assert.deepEqual(await protectedCurrent(f.page),protectedRecords);
  });
  await check('start request sends the chosen range but server started response determines the confirmed distance',async()=>{
    const f=await fixture();await choose(f,25);await perform(f,{confirmed:10});assert.equal(starts(f).at(-1).body.range,25);assert.equal(starts(f).at(-1).body.instrument,'piano');assert.match(await badge(f.page),/10m/);
    assert(!/^共有範囲\s*25m$/.test(await badge(f.page)),'a different server-confirmed distance cannot be labelled as 25m success');
  });
  await check('changing range during a held note sends the latest sync without restarting or altering the held musical state',async()=>{
    const f=await fixture();await perform(f,{hold:true});const initialStart=starts(f).length,stops=f.calls.filter(call=>call.name==='stop').length;
    const before=syncs(f).at(-1).body,pitch=Number(await f.page.locator('#keyboard .pressed').getAttribute('data-pitch'));assert.equal(await f.page.locator('#voiceCount').innerText(),'1音');
    await choose(f,20);await waitFor(f,x=>syncs(x).at(-1).body.range===20);const packet=syncs(f).at(-1);
    assert.equal(packet.body.notes.length,1);assert.deepEqual(packet.body.notes.map(({pitch,velocity,held})=>({pitch,velocity,held})),[{pitch,velocity:83,held:true}]);assert.equal(packet.body.sustain,before.sustain);assert.equal(packet.body.volume,before.volume);assert.equal(await f.page.locator('#voiceCount').innerText(),'1音');
    assert.equal(starts(f).length,initialStart);assert.equal(f.calls.filter(call=>call.name==='stop').length,stops);assert.match(await badge(f.page),/反映中/);assert.match(await badge(f.page),/15m/);
    await ack(f,packet,20);assert.match(await badge(f.page),/20m/);assert.doesNotMatch(await badge(f.page),/反映中/);await f.page.keyboard.up('KeyA');assert.equal(await f.page.locator('#voiceCount').innerText(),'0音');
    assert.equal(await f.page.evaluate(()=>document.activeElement.id),'playArea');await f.page.keyboard.down('KeyW');assert.equal(await f.page.locator('#voiceCount').innerText(),'1音');assert.equal(await f.page.locator('#shareRange').inputValue(),'20');await f.page.keyboard.up('KeyW');assert.equal(await f.page.locator('#voiceCount').innerText(),'0音');
  });
  await check('successful NUI delivery alone leaves a pending badge until a matching authoritative range acknowledgement',async()=>{
    const f=await fixture();await perform(f);await choose(f,20);await waitFor(f,x=>syncs(x).at(-1).body.range===20);const packet=syncs(f).at(-1);
    await f.page.waitForTimeout(250);assert.match(await badge(f.page),/反映中/);assert.match(await badge(f.page),/15m/);await ack(f,packet,20);assert.match(await badge(f.page),/20m/);assert.doesNotMatch(await badge(f.page),/反映中/);
  });
  await check('wrong-session, stale, duplicate, fractional and future acknowledgements cannot replace the latest confirmed range',async()=>{
    const f=await fixture();await perform(f);await choose(f,20);await waitFor(f,x=>syncs(x).at(-1).body.range===20);const first=syncs(f).at(-1);
    await ack(f,first,20,{session:'another-session'});await ack(f,first,100);assert.match(await badge(f.page),/反映中/);assert.match(await badge(f.page),/15m/);await ack(f,first,20);
    await choose(f,25);await waitFor(f,x=>syncs(x).at(-1).body.range===25);const latest=syncs(f).at(-1);assert(latest.body.seq>first.body.seq);await ack(f,latest,25);
    for(const [packet,range,extra]of [[first,20,{}],[latest,20,{}],[latest,10,{seq:latest.body.seq+.5}],[latest,5,{seq:latest.body.seq+100}]]){
      await ack(f,packet,range,extra);assert.match(await badge(f.page),/25m/);assert.doesNotMatch(await badge(f.page),/反映中/);
    }
  });
  await check('rejected range sync cannot claim success or replay a late old-session acknowledgement into a reopened session',async()=>{
    const f=await fixture();await perform(f);const oldSession=f.session;f.rejectRange=20;await choose(f,20);await waitFor(f,x=>syncs(x).some(packet=>packet.body.range===20));const packet=syncs(f).findLast(item=>item.body.range===20);
    await f.page.locator('#error').waitFor({state:'visible'});assert(!/^共有範囲\s*20m$/.test(await badge(f.page)));assert.equal(await f.page.locator('#panel').getAttribute('data-performing'),'false');
    f.rejectRange=null;await f.page.keyboard.press('Escape');await open(f);await perform(f,{confirmed:15});const before=await badge(f.page);await ack(f,packet,20,{session:oldSession});assert.equal(await badge(f.page),before);
  });
  await check('native range control and pending/confirmed text remain inside the panel at 390, 1366 and 1920 pixels',async()=>{
    const f=await fixture();await perform(f);await choose(f,25);await waitFor(f,x=>syncs(x).at(-1).body.range===25);assert.match(await badge(f.page),/反映中/);
    for(const [width,height]of [[390,844],[1366,768],[1920,1080]]){
      await f.page.setViewportSize({width,height});await f.page.locator('#shareRange').scrollIntoViewIfNeeded();
      const geometry=await f.page.evaluate(()=>{const rect=id=>{const r=document.getElementById(id).getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height,font:parseFloat(getComputedStyle(document.getElementById(id)).fontSize)};};return {panel:rect('panel'),select:rect('shareRange'),badge:rect('rangeBadge'),scroll:document.documentElement.scrollWidth};});
      assert(geometry.scroll<=width&&geometry.panel.left>=0&&geometry.panel.right<=width+.5,JSON.stringify(geometry));
      for(const item of [geometry.select,geometry.badge])assert(item.left>=geometry.panel.left&&item.right<=geometry.panel.right+.5&&item.font>=11,JSON.stringify(geometry));
      assert(geometry.select.height>=32);await f.page.screenshot({path:path.join(evidence,`range-${width}.png`)});
    }
  });
}finally{
  for(const f of fixtures)if(!f.page.isClosed())await f.page.close().catch(()=>{});await browser.close();
  const report={at:new Date().toISOString(),scope:'Isolated Chromium native select with real pointer/keyboard operations, synthetic local preferences and manually controlled mock NUI acknowledgements. Production files unmodified. No real FiveM/server/Voice/DB/user preferences accessed.',passed:results.filter(row=>row.status==='PASS').length,failed:results.filter(row=>row.status==='FAIL').length,results,pageErrors:errors,outsideOrigins:outside,actualFiveM:'NOT_RUN',actualDistanceAudibility:'NOT_RUN',multiplayer:'NOT_RUN'};
  fs.writeFileSync(path.join(evidence,'range-browser-results.json'),JSON.stringify(report,null,2)+'\n');console.log(`Range browser: ${report.passed} PASS, ${report.failed} FAIL; report ${evidence}`);if(report.failed||errors.length||outside.length)process.exitCode=1;
}
