// Retained 25-note preset; fresh home18 has separate hands-browser coverage.
import {PIANO_KEYS} from '../web/model.mjs';
// Isolated Chromium NUI-contract QA. No game, microphone, Voice resource or server is used.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';

const resource=fileURLToPath(new URL('../',import.meta.url)),web=path.join(resource,'web');
const evidence=path.resolve(process.env.JAM_VOICE_REPORT_DIR||path.join(resource,'../.flecity-dev/jam/QA/voice-browser-new'));
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
  const page=await browser.newPage({viewport:{width:1366,height:768}}),f={page,calls:[],outside:[],pending:[],session:null};fixtures.push(f);
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
  await page.addInitScript(keys=>localStorage.setItem('flecity-jam-v4',JSON.stringify({version:4,layout:'piano',bindings:{piano:keys}})),PIANO_KEYS);
  await page.goto('https://jam.test/');
  await message(page,{type:'open',instrument:'piano',range:15,reserved:['KeyN','CapsLock'],voice:{token:'epoch-1',enabled:true}});
  await page.locator('#panel').waitFor({state:'visible'});await page.locator('#voice:not(:disabled)').waitFor();
  await page.locator('#playArea').focus();return f;
}
const voices=f=>f.calls.filter(call=>call.name==='voice');
const autoOn=page=>page.locator('#voice').getAttribute('aria-pressed');
async function setAutomatic(f,enabled){
  if(await autoOn(f.page)!==String(enabled))await f.page.click('#voice');
  assert.equal(await autoOn(f.page),String(enabled));
}
async function perform(f){
  const starts=f.calls.filter(call=>call.name==='start').length;
  await f.page.locator('#playArea').focus();await f.page.keyboard.down('z');
  try{
    await waitFor(f,x=>x.calls.filter(call=>call.name==='start').length>starts);
    f.session='voice-qa-'+fixtures.indexOf(f)+'-'+starts;
    await message(f.page,{type:'control',data:{kind:'started',session:f.session,instrument:await f.page.locator('#instrument').inputValue(),maxNotes:16,maxNoteMs:120000}});
  }finally{await f.page.keyboard.up('z');}
  await f.page.waitForFunction(()=>document.querySelector('#lamp').classList.contains('active'));
  await f.page.locator('#playArea').focus();
}
async function closeFixture(f){
  for(const route of f.pending)await fulfill(route).catch(()=>{});
  await f.page.close();
}

try{
  await check('automatic conversation toggle remains readable at 390, 1366 and 1920 widths',async()=>{
    const f=await fixture();
    for(const [width,height]of [[390,844],[1366,768],[1920,1080]]){
      await f.page.setViewportSize({width,height});
      const geometry=await f.page.locator('#voice').evaluate(button=>{
        const b=button.getBoundingClientRect(),p=document.querySelector('#panel').getBoundingClientRect();
        return {left:b.left,right:b.right,width:b.width,height:b.height,pLeft:p.left,pRight:p.right,screen:innerWidth};
      });
      assert(geometry.width>=44&&geometry.height>=44,JSON.stringify(geometry));
      assert(geometry.left>=geometry.pLeft-.5&&geometry.right<=geometry.pRight+.5&&geometry.right<=geometry.screen+.5,JSON.stringify(geometry));
      assert(await f.page.locator('#voiceStatus').isVisible());await f.page.screenshot({path:path.join(evidence,`voice-${width}.png`)});
    }
    await closeFixture(f);
  });
  await check('opening enables automatic conversation intent but sends no voice until an authenticated session starts',async()=>{
    const f=await fixture();assert.equal(await autoOn(f.page),'true');await f.page.waitForTimeout(300);assert.equal(voices(f).length,0);
    await f.page.keyboard.down('z');
    try{
      await waitFor(f,x=>x.calls.some(call=>call.name==='start'));assert.equal(voices(f).length,0,'a pending performance is not voice permission');
      f.session='authenticated';await message(f.page,{type:'control',data:{kind:'started',session:f.session,instrument:'piano',maxNotes:16}});
      await waitFor(f,x=>voices(x).some(call=>call.body.held));
      assert.deepEqual(voices(f)[0].body,{token:'epoch-1',seq:1,held:true,automatic:true,session:'authenticated'});
    }finally{await f.page.keyboard.up('z');}
    await closeFixture(f);
  });
  await check('automatic conversation renews monotonically without N and an explicit OFF immediately stops renewal',async()=>{
    const f=await fixture();await perform(f);await waitFor(f,x=>voices(x).filter(call=>call.body.held).length>=3);
    const packets=voices(f).map(call=>call.body);assert(packets.every(packet=>packet.held&&packet.automatic&&packet.session===f.session));
    assert(packets.every(packet=>Object.keys(packet).sort().join(',')==='automatic,held,seq,session,token'));
    assert.deepEqual(packets.map(packet=>packet.seq),packets.map((_,i)=>i+1));
    await setAutomatic(f,false);await waitFor(f,x=>voices(x).at(-1)?.body.held===false);
    const count=voices(f).length;await f.page.waitForTimeout(320);assert.equal(voices(f).length,count);assert.equal(await autoOn(f.page),'false');
    await f.page.locator('#playArea').focus();await f.page.keyboard.press('z');await f.page.waitForTimeout(260);assert.equal(voices(f).length,count,'playing another note must not override OFF');
    await closeFixture(f);
  });
  await check('legacy N hold keeps its three-field schema, ignores repeat, and releases without enabling automatic conversation',async()=>{
    const f=await fixture();await setAutomatic(f,false);await perform(f);assert.equal(voices(f).length,0);
    await f.page.keyboard.down('n');await waitFor(f,x=>voices(x).length>=1);assert.deepEqual(voices(f)[0].body,{token:'epoch-1',seq:1,held:true});
    await f.page.keyboard.down('n');await f.page.waitForTimeout(460);await f.page.keyboard.up('n');await waitFor(f,x=>voices(x).at(-1)?.body.held===false);
    const packets=voices(f).map(call=>call.body);assert(packets.length>=3);assert(packets.slice(0,-1).every(packet=>packet.held));
    assert.deepEqual(packets.map(packet=>packet.seq),packets.map((_,i)=>i+1));assert(packets.every(packet=>Object.keys(packet).sort().join(',')==='held,seq,token'));
    const count=packets.length;await f.page.waitForTimeout(260);assert.equal(voices(f).length,count);assert.equal(await autoOn(f.page),'false');await closeFixture(f);
  });
  await check('N fallback coexists with real piano chords, sustain and arrow octave changes without becoming a note',async()=>{
    const f=await fixture();await setAutomatic(f,false);await perform(f);
    await f.page.keyboard.down('n');await f.page.keyboard.down('z');await f.page.keyboard.down('p');
    assert.equal(await f.page.locator('#voiceCount').innerText(),'2音');
    assert.equal(await f.page.locator('#keyboard .pressed[data-pitch="48"]').count(),1);assert.equal(await f.page.locator('#keyboard .pressed[data-pitch="72"]').count(),1);
    await f.page.keyboard.down('Space');await f.page.keyboard.press('ArrowUp');assert.equal(await f.page.locator('#octave').innerText(),'4');
    assert.equal(await f.page.locator('#sustain').getAttribute('aria-pressed'),'true');await f.page.keyboard.up('z');await f.page.keyboard.up('p');
    assert.equal(await f.page.locator('#voiceCount').innerText(),'2音');await f.page.keyboard.up('Space');assert.equal(await f.page.locator('#voiceCount').innerText(),'0音');
    await f.page.keyboard.up('n');await waitFor(f,x=>voices(x).at(-1)?.body.held===false);assert.equal(await autoOn(f.page),'false');await closeFixture(f);
  });
  await check('voice button Enter and Space activate the ON/OFF toggle without triggering piano sustain',async()=>{
    const f=await fixture();await perform(f);await waitFor(f,x=>voices(x).some(call=>call.body.held));
    await f.page.locator('#voice').focus();await f.page.keyboard.press('Enter');await waitFor(f,x=>voices(x).at(-1)?.body.held===false);
    assert.equal(await autoOn(f.page),'false');await f.page.locator('#voice').focus();await f.page.keyboard.press('Space');
    await waitFor(f,x=>voices(x).at(-1)?.body.held===true);assert.equal(await autoOn(f.page),'true');assert.equal(await f.page.locator('#sustain').getAttribute('aria-pressed'),'false');
    await setAutomatic(f,false);await closeFixture(f);
  });
  await check('manual N keyup releases after Tab moves focus away from the voice toggle',async()=>{
    const f=await fixture();await setAutomatic(f,false);await perform(f);await f.page.locator('#voice').focus();await f.page.keyboard.down('n');
    await waitFor(f,x=>voices(x).at(-1)?.body.held===true);await f.page.keyboard.press('Tab');assert.equal(await f.page.locator('#voice').evaluate(node=>document.activeElement===node),false);
    await f.page.keyboard.up('n');await waitFor(f,x=>voices(x).at(-1)?.body.held===false);
    const count=voices(f).length;await f.page.waitForTimeout(260);assert.equal(voices(f).length,count);assert.equal(await autoOn(f.page),'false');await closeFixture(f);
  });
  await check('sustain keyup at the voice toggle cannot leave a held note or accidentally enable automatic conversation',async()=>{
    const f=await fixture();await setAutomatic(f,false);await perform(f);
    await f.page.keyboard.down('z');await f.page.keyboard.down('Space');await f.page.keyboard.up('z');
    assert.equal(await f.page.locator('#sustain').getAttribute('aria-pressed'),'true');assert.equal(await f.page.locator('#voiceCount').innerText(),'1音');
    for(let steps=0;steps<40&&await f.page.evaluate(()=>document.activeElement.id!=='voice');steps++)await f.page.keyboard.press('Shift+Tab');
    assert(await f.page.locator('#voice').evaluate(node=>document.activeElement===node),'voice toggle not reached');await f.page.keyboard.up('Space');
    assert.equal(await f.page.locator('#sustain').getAttribute('aria-pressed'),'false');assert.equal(await f.page.locator('#voiceCount').innerText(),'0音');
    assert.equal(await autoOn(f.page),'false');assert.equal(voices(f).length,0);await closeFixture(f);
  });
  await check('an incomplete pointer gesture outside the toggle does not behave like the retired hold button',async()=>{
    const f=await fixture();await setAutomatic(f,false);await perform(f);const box=await f.page.locator('#voice').boundingBox();assert(box);
    await f.page.mouse.move(box.x+box.width/2,box.y+box.height/2);await f.page.mouse.down();await f.page.mouse.move(2,2);await f.page.mouse.up();
    await f.page.waitForTimeout(260);assert.equal(voices(f).length,0);assert.equal(await autoOn(f.page),'false');
    await setAutomatic(f,true);await waitFor(f,x=>voices(x).at(-1)?.body.held===true);await setAutomatic(f,false);await closeFixture(f);
  });
  await check('modifiers, text inputs and key capture reject N fallback while a range control permits it',async()=>{
    const f=await fixture();await setAutomatic(f,false);
    for(const modifier of ['Control','Alt','Meta']){await f.page.keyboard.down(modifier);await f.page.keyboard.press('n');await f.page.keyboard.up(modifier);}
    assert.equal(voices(f).length,0);await f.page.click('#settingsToggle');await f.page.locator('#bpm').focus();await f.page.keyboard.press('n');assert.equal(voices(f).length,0);
    await f.page.locator('#performVolume').focus();const volume=Number(await f.page.locator('#performVolume').inputValue());
    await f.page.keyboard.down('n');await waitFor(f,x=>voices(x).at(-1)?.body.held===true);await f.page.keyboard.press('ArrowLeft');assert.equal(Number(await f.page.locator('#performVolume').inputValue()),volume-1);
    await f.page.keyboard.up('n');await waitFor(f,x=>voices(x).at(-1)?.body.held===false);
    await f.page.locator('#playArea').focus();await f.page.keyboard.down('n');await waitFor(f,x=>voices(x).at(-1)?.body.held===true);
    await f.page.locator('#bindings button').first().click();await waitFor(f,x=>voices(x).at(-1)?.body.held===false);await f.page.keyboard.up('n');
    const count=voices(f).length;await f.page.keyboard.press('n');assert.equal(voices(f).length,count);assert.match(await f.page.locator('#error').innerText(),/予約/);await closeFixture(f);
  });
  await check('a server stop releases automatic conversation and explicit OFF survives instrument changes',async()=>{
    const f=await fixture();await perform(f);await waitFor(f,x=>voices(x).some(call=>call.body.held));
    await message(f.page,{type:'control',data:{kind:'stopped',session:f.session}});await waitFor(f,x=>voices(x).at(-1)?.body.held===false);
    assert.equal(await autoOn(f.page),'false');const count=voices(f).length;await f.page.waitForTimeout(280);assert.equal(voices(f).length,count);
    await f.page.selectOption('#instrument','guitar');assert.equal(await autoOn(f.page),'false');
    await f.page.locator('#playArea').focus();await f.page.keyboard.down('z');
    try{
      await waitFor(f,x=>x.calls.filter(call=>call.name==='start').length>=2);
      await message(f.page,{type:'control',data:{kind:'started',session:'guitar-new',instrument:'guitar',maxNotes:16}});
    }finally{await f.page.keyboard.up('z');}
    await f.page.waitForTimeout(280);assert.equal(voices(f).length,count);await closeFixture(f);
  });
  await check('an explicit instrument change preserves ON intent across either authenticated-epoch ordering without replaying an old callback',async()=>{
    for(const order of ['epoch-before-session','epoch-after-session']){
      const f=await fixture(call=>call.body.token==='epoch-1'&&call.body.held?null:{ok:true});await perform(f);await waitFor(f,x=>x.pending.length===1);
      await f.page.selectOption('#instrument','guitar');await waitFor(f,x=>voices(x).at(-1)?.body.held===false);assert.equal(await autoOn(f.page),'true');
      const count=voices(f).length,epoch={type:'voiceState',voice:{token:'epoch-2',enabled:true},held:false,automatic:false,talking:false};
      if(order==='epoch-before-session')await message(f.page,epoch);
      await perform(f);
      if(order==='epoch-after-session'){assert.equal(voices(f).length,count,'a new session must wait for its voice epoch');await message(f.page,epoch);}
      await waitFor(f,x=>voices(x).some(call=>call.body.token==='epoch-2'&&call.body.held));
      const current=voices(f).find(call=>call.body.token==='epoch-2'&&call.body.held);assert.equal(current.body.session,f.session);assert.equal(current.body.automatic,true);assert.equal(current.body.seq,1);
      await fulfill(f.pending.shift(),{ok:false}).catch(()=>{});await f.page.waitForTimeout(60);
      assert.equal(await autoOn(f.page),'true');assert(await f.page.locator('#error').isHidden());assert(await f.page.locator('#voice').isEnabled());
      await setAutomatic(f,false);await closeFixture(f);
    }
  });
  await check('a new voice epoch clears automatic intent and ignores a late rejected old callback after explicit re-enable',async()=>{
    const f=await fixture(call=>call.body.token==='epoch-1'&&call.body.held?null:{ok:true});await perform(f);await waitFor(f,x=>x.pending.length===1);
    await message(f.page,{type:'voiceState',voice:{token:'epoch-2',enabled:true},held:false,automatic:false,talking:false});assert.equal(await autoOn(f.page),'false');
    const count=voices(f).length;await f.page.waitForTimeout(280);assert.equal(voices(f).length,count);await setAutomatic(f,true);
    await waitFor(f,x=>voices(x).some(call=>call.body.token==='epoch-2'&&call.body.held));
    assert.deepEqual(voices(f).find(call=>call.body.token==='epoch-2').body,{token:'epoch-2',seq:1,held:true,automatic:true,session:f.session});
    await fulfill(f.pending.shift(),{ok:false});await f.page.waitForTimeout(60);assert(await f.page.locator('#voice').isEnabled());assert.equal(await autoOn(f.page),'true');assert(await f.page.locator('#error').isHidden());
    await setAutomatic(f,false);await closeFixture(f);
  });
  await check('Lua lease expiry cancels automatic conversation until the user explicitly turns it on again',async()=>{
    const f=await fixture();await perform(f);await waitFor(f,x=>voices(x).some(call=>call.body.held));
    await message(f.page,{type:'voiceState',voice:{token:'epoch-2',enabled:true},held:false,automatic:false,talking:false,expired:true});
    assert.equal(await autoOn(f.page),'false');const count=voices(f).length;await f.page.waitForTimeout(320);assert.equal(voices(f).length,count);
    await f.page.keyboard.press('z');await f.page.waitForTimeout(280);assert.equal(voices(f).length,count);
    await setAutomatic(f,true);await waitFor(f,x=>voices(x).some(call=>call.body.token==='epoch-2'&&call.body.held));await setAutomatic(f,false);await closeFixture(f);
  });
  await check('rejected or failed automatic callbacks disable voice, release once and do not retry',async()=>{
    for(const response of [{ok:false},'abort']){
      const f=await fixture(call=>call.body.held?response:{ok:true});await perform(f);
      await f.page.locator('#voice:disabled').waitFor();await waitFor(f,x=>voices(x).some(call=>call.body.held===false));assert.equal(await autoOn(f.page),'false');
      assert.match(await f.page.locator('#error').innerText(),/応答を確認できません/);await f.page.keyboard.press('n');const count=voices(f).length;
      await f.page.waitForTimeout(300);assert.equal(voices(f).length,count);assert.equal(voices(f).filter(call=>call.body.held).length,1);assert.equal(voices(f).filter(call=>!call.body.held).length,1);await closeFixture(f);
    }
  });
  await check('a delayed automatic callback times out without renewal fanout or automatic re-enable',async()=>{
    const f=await fixture(call=>call.body.held?null:{ok:true});await perform(f);await waitFor(f,x=>x.pending.length===1);
    await f.page.waitForTimeout(450);assert.equal(voices(f).length,1,'pending request must not fan out renewal POSTs');
    await f.page.locator('#voice:disabled').waitFor({timeout:3500});await waitFor(f,x=>voices(x).some(call=>!call.body.held));
    await fulfill(f.pending.shift()).catch(()=>{});await f.page.keyboard.press('n');await f.page.waitForTimeout(300);
    assert.equal(voices(f).filter(call=>call.body.held).length,1);assert(await f.page.locator('#voice').isDisabled());assert.equal(await autoOn(f.page),'false');await closeFixture(f);
  });
  await check('Escape and simulated blur or pagehide release automatic conversation and stop renewal',async()=>{
    for(const reason of ['Escape','blur','pagehide']){
      const f=await fixture();await perform(f);await waitFor(f,x=>voices(x).some(call=>call.body.held));
      if(reason==='Escape')await f.page.keyboard.press('Escape');else await f.page.evaluate(type=>window.dispatchEvent(new Event(type)),reason);
      await f.page.locator('#panel').waitFor({state:'hidden'});await waitFor(f,x=>voices(x).at(-1)?.body.held===false);
      const count=voices(f).length;await f.page.waitForTimeout(260);assert.equal(voices(f).length,count);assert.equal(await autoOn(f.page),'false');assert(f.calls.some(call=>call.name==='close'));await closeFixture(f);
    }
  });
  await check('choosing an instrument before the first note retains the original voice epoch without a needless stop or release',async()=>{
    const f=await fixture();assert.equal(voices(f).length,0);assert.equal(f.calls.filter(call=>call.name==='start').length,0);
    await f.page.selectOption('#instrument','guitar');assert.equal(await autoOn(f.page),'true');
    assert.equal(f.calls.filter(call=>call.name==='stop').length,0);assert.equal(voices(f).length,0);
    await perform(f);await waitFor(f,x=>voices(x).some(call=>call.body.held));
    assert.deepEqual(voices(f)[0].body,{token:'epoch-1',seq:1,held:true,automatic:true,session:f.session});
    assert.equal(f.calls.find(call=>call.name==='start').body.instrument,'guitar');
    assert.equal(f.calls.filter(call=>call.name==='stop').length,0);assert(voices(f).every(call=>call.body.held));
    await closeFixture(f);
  });
  await check('disabled voice refuses automatic and manual input, and restored availability does not silently enable it',async()=>{
    const f=await fixture();await message(f.page,{type:'voiceState',voice:{token:'epoch-off',enabled:false},held:false,automatic:false,talking:false});
    assert(await f.page.locator('#voice').isDisabled());await f.page.keyboard.press('n');await perform(f);await f.page.waitForTimeout(280);assert.equal(voices(f).length,0);
    await message(f.page,{type:'voiceState',voice:{token:'epoch-restored',enabled:true},held:false,automatic:false,talking:false});
    assert(await f.page.locator('#voice').isEnabled());assert.equal(await autoOn(f.page),'false');await f.page.waitForTimeout(280);assert.equal(voices(f).length,0);
    await setAutomatic(f,true);await waitFor(f,x=>voices(x).at(-1)?.body.held===true);await setAutomatic(f,false);await closeFixture(f);
  });
  await check('a mocked false hasFocus result releases automatic intent without recreating a renewal timer or disturbing held notes',async()=>{
    const f=await fixture();
    // Fault injection into the guard only; this does not demonstrate real NUI or CEF focus loss.
    await f.page.evaluate(()=>{document.hasFocus=()=>false;});
    await f.page.locator('#playArea').focus();await f.page.keyboard.down('z');
    try{
      await waitFor(f,x=>x.calls.some(call=>call.name==='start'));
      f.session='focus-guard';await message(f.page,{type:'control',data:{kind:'started',session:f.session,instrument:'piano',maxNotes:16}});
      await f.page.waitForFunction(()=>document.querySelector('#panel').dataset.performing==='true');
      await waitFor(f,x=>voices(x).some(call=>call.body.held===false));
      assert.equal(voices(f).filter(call=>call.body.held).length,0);assert.equal(await autoOn(f.page),'false');
      const count=voices(f).length;await f.page.waitForTimeout(500);
      assert.equal(voices(f).length,count,'synchronous guard release must not be followed by a stale renewal interval');
      assert.equal(voices(f).filter(call=>call.body.held).length,0);assert.equal(voices(f).filter(call=>!call.body.held).length,1);
      assert.equal(await f.page.locator('#voiceCount').innerText(),'1音');assert.equal(await f.page.locator('#keyboard .pressed[data-pitch="48"]').count(),1);
      assert.equal(await f.page.locator('#panel').getAttribute('data-performing'),'true');
    }finally{await f.page.keyboard.up('z');await f.page.evaluate(()=>{delete document.hasFocus;});}
    assert.equal(await f.page.locator('#voiceCount').innerText(),'0音');assert.equal(await autoOn(f.page),'false');
    const count=voices(f).length;await f.page.waitForTimeout(260);assert.equal(voices(f).length,count,'restored focus availability must not silently resume automatic voice');
    await closeFixture(f);
  });
}finally{
  for(const f of fixtures)if(!f.page.isClosed())await closeFixture(f).catch(()=>{});await browser.close();
  const report={at:new Date().toISOString(),scope:'Isolated headless Chromium; real keyboard/mouse with mocked NUI. Lua session grants, expiry, blur and pagehide are simulated. One case mocks document.hasFocus=false to exercise the guard; it is not evidence of actual NUI/CEF focus behavior. No FiveM, microphone, Voice resource or real server.',passed:results.filter(result=>result.status==='PASS').length,failed:results.filter(result=>result.status==='FAIL').length,results,pageErrors:errors,outsideOrigins:[...new Set(fixtures.flatMap(f=>f.outside))],callbacks:fixtures.map((f,index)=>({fixture:index,voice:voices(f)})),liveNativePTT:'NOT_RUN',voiceAudio:'NOT_RUN',microphonePrivacyInFiveM:'NOT_RUN',actualNuiFocusLoss:'NOT_RUN'};
  fs.writeFileSync(path.join(evidence,'voice-browser-results.json'),JSON.stringify(report,null,2)+'\n');
  console.log(`Voice browser: ${report.passed} PASS, ${report.failed} FAIL; report ${evidence}`);if(report.failed||errors.length||report.outsideOrigins.length)process.exitCode=1;
}
