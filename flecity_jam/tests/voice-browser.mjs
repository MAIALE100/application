// Isolated Chromium NUI-contract QA. No game, microphone, Voice resource or server is used.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';

const resource=fileURLToPath(new URL('../',import.meta.url)),web=path.join(resource,'web');
const evidence=path.resolve(process.env.JAM_VOICE_REPORT_DIR||path.join(resource,'../.flecity-dev/jam/voice-browser'));
fs.mkdirSync(evidence,{recursive:true});
const modulePath=process.env.JAM_PLAYWRIGHT_MODULE||'C:/Users/suivx/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
const {chromium}=await import(path.isAbsolute(modulePath)?pathToFileURL(modulePath):modulePath);
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--autoplay-policy=no-user-gesture-required']});
const results=[],errors=[],fixtures=[];
async function check(name,fn){
  try{await fn();results.push({name,status:'PASS'});console.log('PASS '+name);}
  catch(error){results.push({name,status:'FAIL',error:String(error.stack||error)});console.error('FAIL '+name+': '+error.message);}
}
const fulfill=(route,result={ok:true})=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(result)});
async function message(page,data){await page.evaluate(value=>window.dispatchEvent(new MessageEvent('message',{data:value})),data);}
async function waitFor(f,predicate){
  for(let i=0;i<150;i++){if(predicate(f))return;await f.page.waitForTimeout(20);}
  assert(predicate(f),'mock callback condition timed out');
}
async function fixture(reply){
  const page=await browser.newPage({viewport:{width:1366,height:768}}),f={page,calls:[],outside:[],pending:[]};fixtures.push(f);
  page.on('pageerror',error=>errors.push(error.message));
  await page.addInitScript(()=>{window.GetParentResourceName=()=> 'jam.test';});
  await page.route('**/*',async route=>{
    const request=route.request(),url=new URL(request.url());
    if(url.origin!=='https://jam.test'){f.outside.push(url.origin);await route.abort();return;}
    if(request.method()==='POST'){
      const call={name:url.pathname.slice(1),body:JSON.parse(request.postData()||'{}'),at:Date.now()};f.calls.push(call);
      assert(['ready','pulse','start','input','stop','close','voice'].includes(call.name),'unexpected callback '+call.name);
      if(call.name==='voice'&&reply){
        const result=reply(call,f,route);
        if(result===null){f.pending.push(route);return;}
        if(result==='abort'){await route.abort('failed');return;}
        await fulfill(route,result);return;
      }
      await fulfill(route);return;
    }
    const relative=decodeURIComponent(url.pathname).replace(/^\//,'')||'index.html',file=path.resolve(web,relative);
    if(!file.startsWith(web+path.sep)||!fs.existsSync(file)){await route.fulfill({status:404,body:'Not found'});return;}
    const mime={'.html':'text/html','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.ogg':'audio/ogg','.wav':'audio/wav'};
    await route.fulfill({status:200,contentType:mime[path.extname(file)]||'application/octet-stream',body:fs.readFileSync(file)});
  });
  await page.goto('https://jam.test/');
  await message(page,{type:'open',instrument:'piano',range:15,reserved:['KeyN','CapsLock'],voice:{token:'epoch-1',enabled:true}});
  await page.locator('#panel').waitFor({state:'visible'});await page.locator('#voice:not(:disabled)').waitFor();
  await page.locator('#playArea').focus();return f;
}
const voices=f=>f.calls.filter(call=>call.name==='voice');
const held=page=>page.locator('#voice').getAttribute('aria-pressed');
async function perform(f){
  await f.page.click('#start');await waitFor(f,x=>x.calls.some(call=>call.name==='start'));
  await message(f.page,{type:'control',data:{kind:'started',session:'voice-qa',instrument:'piano',maxNotes:16,maxNoteMs:120000}});
  await f.page.locator('#playArea').focus();assert.match(await f.page.locator('#start').innerText(),/休む/);
}
async function closeFixture(f){
  for(const route of f.pending)await fulfill(route).catch(()=>{});
  await f.page.close();
}

try{
  await check('voice button and status remain readable at 390, 1366 and 1920 widths',async()=>{
    const f=await fixture();
    for(const [width,height]of [[390,844],[1366,768],[1920,1080]]){
      await f.page.setViewportSize({width,height});
      const geometry=await f.page.locator('#voice').evaluate(button=>{
        const b=button.getBoundingClientRect(),p=document.querySelector('#panel').getBoundingClientRect();
        return {left:b.left,right:b.right,top:b.top,bottom:b.bottom,width:b.width,height:b.height,pLeft:p.left,pRight:p.right,screen:innerWidth};
      });
      assert(geometry.width>=44&&geometry.height>=44,JSON.stringify(geometry));
      assert(geometry.left>=geometry.pLeft-.5&&geometry.right<=geometry.pRight+.5&&geometry.right<=geometry.screen+.5,JSON.stringify(geometry));
      assert(await f.page.locator('#voiceStatus').isVisible());
      await f.page.screenshot({path:path.join(evidence,`voice-${width}.png`)});
    }
    await closeFixture(f);
  });
  await check('real N hold renews with monotonic POSTs, ignores repeat and releases on keyup',async()=>{
    const f=await fixture();await f.page.keyboard.down('n');await waitFor(f,x=>voices(x).length>=1);
    assert.equal(await held(f.page),'true');assert.deepEqual(voices(f)[0].body,{token:'epoch-1',seq:1,held:true});
    await f.page.keyboard.down('n');await f.page.waitForTimeout(460);await f.page.keyboard.up('n');
    await waitFor(f,x=>voices(x).at(-1)?.body.held===false);
    const packets=voices(f).map(call=>call.body);assert(packets.length>=3);
    assert(packets.slice(0,-1).every(packet=>packet.held));
    assert.deepEqual(packets.map(packet=>packet.seq),packets.map((_,i)=>i+1));
    assert(packets.every(packet=>Object.keys(packet).sort().join(',')==='held,seq,token'));
    const count=packets.length;await f.page.waitForTimeout(260);assert.equal(voices(f).length,count);assert.equal(await held(f.page),'false');
    await closeFixture(f);
  });
  await check('N coexists with real piano chords, sustain and arrow octave changes without becoming a note',async()=>{
    const f=await fixture();await perform(f);
    await f.page.keyboard.down('n');await f.page.keyboard.down('z');await f.page.keyboard.down('p');
    assert.equal(await f.page.locator('#voiceCount').innerText(),'2音');
    assert.equal(await f.page.locator('#keyboard .pressed[data-pitch="48"]').count(),1);
    assert.equal(await f.page.locator('#keyboard .pressed[data-pitch="72"]').count(),1);
    await f.page.keyboard.down('Space');await f.page.keyboard.press('ArrowUp');
    assert.equal(await f.page.locator('#octave').innerText(),'4');assert.equal(await f.page.locator('#sustain').getAttribute('aria-pressed'),'true');
    await f.page.keyboard.up('z');await f.page.keyboard.up('p');assert.equal(await f.page.locator('#voiceCount').innerText(),'2音');
    await f.page.keyboard.up('Space');assert.equal(await f.page.locator('#voiceCount').innerText(),'0音');
    assert.equal(await held(f.page),'true');await f.page.keyboard.up('n');await waitFor(f,x=>voices(x).at(-1)?.body.held===false);
    await closeFixture(f);
  });
  await check('focused voice button handles Enter and Space holds without triggering piano sustain',async()=>{
    const f=await fixture();await perform(f);await f.page.locator('#voice').focus();
    await f.page.keyboard.down('Space');await waitFor(f,x=>voices(x).some(call=>call.body.held));
    assert.equal(await held(f.page),'true');assert.equal(await f.page.locator('#sustain').getAttribute('aria-pressed'),'false');
    await f.page.keyboard.up('Space');await waitFor(f,x=>voices(x).at(-1)?.body.held===false);
    await f.page.keyboard.down('Enter');await f.page.keyboard.down('n');await f.page.keyboard.up('Enter');
    assert.equal(await held(f.page),'true');await f.page.keyboard.up('n');
    await waitFor(f,x=>voices(x).at(-1)?.body.held===false);assert.equal(await f.page.locator('#voiceCount').innerText(),'0音');
    await closeFixture(f);
  });
  await check('voice button keyup releases after real Tab navigation moves focus elsewhere',async()=>{
    const f=await fixture();await perform(f);
    for(const code of ['Space','Enter']){
      await f.page.locator('#voice').focus();await f.page.keyboard.down(code);await waitFor(f,x=>voices(x).at(-1)?.body.held===true);
      await f.page.keyboard.press('Tab');assert.equal(await f.page.locator('#voice').evaluate(node=>document.activeElement===node),false);
      await f.page.keyboard.up(code);await waitFor(f,x=>voices(x).at(-1)?.body.held===false);
      assert.equal(await held(f.page),'false');const count=voices(f).length;await f.page.waitForTimeout(260);assert.equal(voices(f).length,count);
    }
    await closeFixture(f);
  });
  await check('real voice pointer capture releases when the mouse is lifted outside the button',async()=>{
    const f=await fixture(),box=await f.page.locator('#voice').boundingBox();assert(box);
    await f.page.mouse.move(box.x+box.width/2,box.y+box.height/2);await f.page.mouse.down();
    await waitFor(f,x=>voices(x).some(call=>call.body.held));await f.page.mouse.move(2,2);await f.page.mouse.up();
    await waitFor(f,x=>voices(x).at(-1)?.body.held===false);assert.equal(await held(f.page),'false');await closeFixture(f);
  });
  await check('real pointer hold followed by simulated pointercancel clears the request and renewal',async()=>{
    const f=await fixture(),box=await f.page.locator('#voice').boundingBox();assert(box);
    await f.page.mouse.move(box.x+box.width/2,box.y+box.height/2);await f.page.mouse.down();await waitFor(f,x=>voices(x).some(call=>call.body.held));
    await f.page.dispatchEvent('#voice','pointercancel',{pointerId:1,button:0,bubbles:true});await f.page.mouse.up();
    await waitFor(f,x=>voices(x).at(-1)?.body.held===false);const count=voices(f).length;
    await f.page.waitForTimeout(260);assert.equal(voices(f).length,count);assert.equal(await held(f.page),'false');await closeFixture(f);
  });
  await check('modifier combinations, form focus and key capture cannot start voice requests',async()=>{
    const f=await fixture();
    for(const modifier of ['Control','Alt','Meta']){await f.page.keyboard.down(modifier);await f.page.keyboard.press('n');await f.page.keyboard.up(modifier);}
    assert.equal(voices(f).length,0);
    await f.page.click('#settingsToggle');await f.page.locator('#bpm').focus();await f.page.keyboard.press('n');assert.equal(voices(f).length,0);
    await f.page.locator('#playArea').focus();await f.page.keyboard.down('n');await waitFor(f,x=>voices(x).some(call=>call.body.held));
    await f.page.locator('#bindings button').first().click();await waitFor(f,x=>voices(x).at(-1)?.body.held===false);
    await f.page.keyboard.up('n');const count=voices(f).length;await f.page.keyboard.press('n');
    assert.equal(voices(f).length,count);assert.match(await f.page.locator('#error').innerText(),/予約/);await closeFixture(f);
  });
  await check('performance stop and instrument changes release held voice without restarting it',async()=>{
    const f=await fixture();await perform(f);await f.page.keyboard.down('n');await waitFor(f,x=>voices(x).some(call=>call.body.held));
    await f.page.click('#start');await waitFor(f,x=>voices(x).at(-1)?.body.held===false);await f.page.keyboard.up('n');
    await f.page.locator('#playArea').focus();await f.page.keyboard.down('n');await waitFor(f,x=>voices(x).at(-1)?.body.held===true);
    await f.page.selectOption('#instrument','guitar');await waitFor(f,x=>voices(x).at(-1)?.body.held===false);await f.page.keyboard.up('n');
    const count=voices(f).length;await f.page.waitForTimeout(260);assert.equal(voices(f).length,count);assert.equal(await held(f.page),'false');await closeFixture(f);
  });
  await check('new voice epoch clears old holds and ignores a late rejected old callback',async()=>{
    const f=await fixture(call=>call.body.token==='epoch-1'&&call.body.held?null:{ok:true});
    await f.page.keyboard.down('n');await waitFor(f,x=>x.pending.length===1);
    await message(f.page,{type:'voiceState',voice:{token:'epoch-2',enabled:true},held:false,talking:false});assert.equal(await held(f.page),'false');
    await f.page.keyboard.up('n');await f.page.keyboard.down('n');await waitFor(f,x=>voices(x).some(call=>call.body.token==='epoch-2'));
    assert.deepEqual(voices(f).find(call=>call.body.token==='epoch-2').body,{token:'epoch-2',seq:1,held:true});
    await fulfill(f.pending.shift(),{ok:false});await f.page.waitForTimeout(60);
    assert(await f.page.locator('#voice').isEnabled());assert.equal(await held(f.page),'true');assert(await f.page.locator('#error').isHidden());
    await f.page.keyboard.up('n');await waitFor(f,x=>voices(x).at(-1)?.body.held===false);await closeFixture(f);
  });
  await check('Lua expiry cancels a held request and does not renew until a fresh key press',async()=>{
    const f=await fixture();await f.page.keyboard.down('n');await waitFor(f,x=>voices(x).length===1);
    await message(f.page,{type:'voiceState',voice:{token:'epoch-1',enabled:true},held:false,talking:false,expired:true});
    assert.equal(await held(f.page),'false');const count=voices(f).length;
    await f.page.keyboard.down('n');await f.page.waitForTimeout(300);assert.equal(voices(f).length,count);
    await f.page.keyboard.up('n');await f.page.keyboard.down('n');await waitFor(f,x=>voices(x).length>count);
    assert(voices(f).at(-1).body.held);await f.page.keyboard.up('n');await closeFixture(f);
  });
  await check('rejected or failed held callbacks disable voice, release once and do not retry',async()=>{
    for(const response of [{ok:false},'abort']){
      const f=await fixture(call=>call.body.held?response:{ok:true});await f.page.keyboard.down('n');
      await f.page.locator('#voice:disabled').waitFor();await waitFor(f,x=>voices(x).some(call=>call.body.held===false));
      assert.equal(await held(f.page),'false');assert.match(await f.page.locator('#error').innerText(),/応答を確認できません/);
      await f.page.keyboard.up('n');await f.page.keyboard.press('n');const count=voices(f).length;await f.page.waitForTimeout(300);assert.equal(voices(f).length,count);
      assert.equal(voices(f).filter(call=>call.body.held).length,1);assert.equal(voices(f).filter(call=>!call.body.held).length,1);await closeFixture(f);
    }
  });
  await check('delayed held callback times out safely without renewal, replay or automatic re-enable',async()=>{
    const f=await fixture(call=>call.body.held?null:{ok:true});await f.page.keyboard.down('n');await waitFor(f,x=>x.pending.length===1);
    await f.page.waitForTimeout(450);assert.equal(voices(f).length,1,'pending request must not fan out renewal POSTs');
    await f.page.locator('#voice:disabled').waitFor({timeout:3500});await waitFor(f,x=>voices(x).some(call=>!call.body.held));
    await fulfill(f.pending.shift()).catch(()=>{});await f.page.keyboard.up('n');await f.page.keyboard.press('n');
    await f.page.waitForTimeout(300);assert.equal(voices(f).filter(call=>call.body.held).length,1);assert(await f.page.locator('#voice').isDisabled());assert.equal(await held(f.page),'false');await closeFixture(f);
  });
  await check('Escape and simulated blur/pagehide release voice and stop renewal when JAM closes',async()=>{
    for(const reason of ['Escape','blur','pagehide']){
      const f=await fixture();await f.page.keyboard.down('n');await waitFor(f,x=>voices(x).some(call=>call.body.held));
      if(reason==='Escape')await f.page.keyboard.press('Escape');else await f.page.evaluate(type=>window.dispatchEvent(new Event(type)),reason);
      await f.page.locator('#panel').waitFor({state:'hidden'});await waitFor(f,x=>voices(x).at(-1)?.body.held===false);await f.page.keyboard.up('n');
      const count=voices(f).length;await f.page.waitForTimeout(260);assert.equal(voices(f).length,count);assert.equal(await held(f.page),'false');assert(f.calls.some(call=>call.name==='close'));await closeFixture(f);
    }
  });
  await check('disabled voice configuration refuses keyboard and pointer holds',async()=>{
    const f=await fixture();await message(f.page,{type:'voiceState',voice:{token:'epoch-off',enabled:false},held:false,talking:false});
    assert(await f.page.locator('#voice').isDisabled());await f.page.keyboard.press('n');assert.equal(voices(f).length,0);await closeFixture(f);
  });
}finally{
  for(const f of fixtures)if(!f.page.isClosed())await closeFixture(f).catch(()=>{});
  await browser.close();
  const report={at:new Date().toISOString(),scope:'Isolated headless Chromium; real browser keyboard/mouse with mocked NUI callbacks. Lua states, blur, pagehide and pointercancel are simulated. No FiveM, microphone, Voice resource or real server.',passed:results.filter(result=>result.status==='PASS').length,failed:results.filter(result=>result.status==='FAIL').length,results,pageErrors:errors,outsideOrigins:[...new Set(fixtures.flatMap(f=>f.outside))],callbacks:fixtures.map((f,index)=>({fixture:index,voice:f.calls.filter(call=>call.name==='voice')})),liveNativePTT:'NOT_RUN',voiceAudio:'NOT_RUN'};
  fs.writeFileSync(path.join(evidence,'voice-browser-results.json'),JSON.stringify(report,null,2)+'\n');
  console.log(`Voice browser: ${report.passed} PASS, ${report.failed} FAIL; report ${evidence}`);
  if(report.failed||errors.length||report.outsideOrigins.length)process.exitCode=1;
}
