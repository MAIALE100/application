// Real browser pointer/keyboard interaction on an isolated mock origin. No game or user data.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';

const resource=fileURLToPath(new URL('../',import.meta.url)),web=path.join(resource,'web');
const evidence=path.resolve(process.env.JAM_FLOATING_REPORT_DIR||path.join(resource,'../.flecity-dev/jam/floating-browser'));
fs.mkdirSync(evidence,{recursive:true});
const modulePath=process.env.JAM_PLAYWRIGHT_MODULE||'C:/Users/suivx/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
const {chromium}=await import(path.isAbsolute(modulePath)?pathToFileURL(modulePath):modulePath);
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--autoplay-policy=no-user-gesture-required']});
const results=[],fixtures=[],errors=[],outside=[];
const windowKey='flecity-jam-window-v1';
async function check(name,fn){
  try{await fn();results.push({name,status:'PASS'});console.log('PASS '+name);}
  catch(error){results.push({name,status:'FAIL',error:String(error.stack||error)});console.error('FAIL '+name+': '+error.message);}
}
async function message(page,data){await page.evaluate(value=>window.dispatchEvent(new MessageEvent('message',{data:value})),data);}
async function settle(page){await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));}
async function fixture({windowRaw,failSave=false,preview=false,viewport={width:1366,height:768}}={}){
  const page=await browser.newPage({viewport}),f={page,calls:[]};fixtures.push(f);page.on('pageerror',error=>errors.push(error.message));
  await page.addInitScript(({windowRaw,failSave,preview,windowKey})=>{
    if(!sessionStorage.getItem('floating-seeded')){
      if(windowRaw!==undefined)localStorage.setItem(windowKey,windowRaw);
      localStorage.setItem('flecity-jam-v1','{"keys":[],"protected":"synthetic old record"}');sessionStorage.setItem('floating-seeded','yes');
    }
    if(!preview)window.GetParentResourceName=()=> 'jam.test';
    if(failSave){const set=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(this===localStorage&&key===windowKey)throw new DOMException('isolated quota','QuotaExceededError');return set.call(this,key,value);};}
  },{windowRaw,failSave,preview,windowKey});
  await page.route('**/*',async route=>{
    const request=route.request(),url=new URL(request.url());
    if(url.origin!=='https://jam.test'){outside.push(url.origin);await route.abort();return;}
    if(request.method()==='POST'){
      f.calls.push({name:url.pathname.slice(1),body:request.postDataJSON(),at:Date.now()});
      await route.fulfill({status:200,contentType:'application/json',body:'{"ok":true}'});return;
    }
    const file=path.resolve(web,decodeURIComponent(url.pathname).replace(/^\//,'')||'index.html');assert(file.startsWith(web+path.sep));
    const mime={'.html':'text/html','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.ogg':'audio/ogg','.wav':'audio/wav'};
    let body=fs.readFileSync(file);
    // Observe completed cache warming only; no musical input, model or session is replaced.
    if(path.basename(file)==='audio.mjs')body=Buffer.from(body.toString('utf8')+'\nconst floatingUnlock=AudioRack.prototype.unlock;AudioRack.prototype.unlock=function(...args){window.__floatingRack=this;return floatingUnlock.apply(this,args);};\n');
    await route.fulfill({status:200,contentType:mime[path.extname(file)]||'application/octet-stream',body});
  });
  await page.goto('https://jam.test/');
  if(preview)await page.waitForFunction(()=>window.JAM);
  else{
    await page.waitForFunction(()=>document.querySelector('#instrument').options.length>0);
    await message(page,{type:'open',voice:{token:'floating-epoch',enabled:true}});
  }
  await page.waitForFunction(()=>document.querySelector('#panel').dataset.windowReady==='true');await settle(page);
  if(!preview)await page.waitForFunction(()=>window.__floatingRack?.catalog.get('piano').samples.every(sample=>__floatingRack.buffers.has(sample.file)),null,{timeout:15000});
  return f;
}
const starts=f=>f.calls.filter(call=>call.name==='start');
const voices=f=>f.calls.filter(call=>call.name==='voice');
const ops=f=>f.calls.filter(call=>call.name==='input').flatMap(call=>call.body.ops||[]);
async function waitFor(f,predicate){for(let i=0;i<150&&!predicate(f);i++)await f.page.waitForTimeout(20);assert(predicate(f),'mock bridge condition timed out');}
async function ack(f,session='floating-session'){
  await message(f.page,{type:'control',data:{kind:'started',session,instrument:await f.page.locator('#instrument').inputValue(),maxNotes:16,maxNoteMs:120000}});
  await f.page.waitForFunction(()=>document.querySelector('#panel').dataset.performing==='true');
}
async function rect(page){return page.locator('#panel').evaluate(panel=>{const r=panel.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom};});}
async function within(page){const r=await rect(page),v=page.viewportSize();assert(r.x>=7.5&&r.y>=7.5&&r.right<=v.width-7.5&&r.bottom<=v.height-7.5,JSON.stringify({r,v}));return r;}
async function drag(page,dx,dy){const b=await page.locator('#panelDrag').boundingBox();assert(b);const x=b.x+b.width/2,y=b.y+b.height/2;await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+dx,y+dy,{steps:8});await page.mouse.up();await settle(page);}
async function settings(page){if(await page.locator('#settings').isHidden())await page.click('#settingsToggle');await settle(page);}
async function windowPrefs(page){return page.evaluate(key=>JSON.parse(localStorage.getItem(key)),windowKey);}

try{
  await check('open exposes no start button, focuses the playable area and waits for a genuine note',async()=>{
    const f=await fixture();assert.equal(await f.page.locator('#start').count(),0);assert.equal(await f.page.evaluate(()=>document.activeElement.id),'playArea');
    assert.equal(await f.page.locator('#panel').getAttribute('aria-busy'),'false');assert.equal(await f.page.locator('#panel').getAttribute('data-performing'),'false');
    assert.equal(starts(f).length,0);assert.equal(voices(f).length,0);await within(f.page);
  });
  await check('real handle dragging moves the window without starting notes or shifting keyboard pitch',async()=>{
    const f=await fixture({viewport:{width:1366,height:1080}}),before=await rect(f.page),octave=await f.page.locator('#octave').innerText();await drag(f.page,45,-35);const after=await within(f.page);
    assert(Math.abs(after.x-before.x-45)<1&&Math.abs(after.y-before.y+35)<1,JSON.stringify({before,after}));assert.equal(await f.page.locator('#octave').innerText(),octave);
    assert.equal(await f.page.locator('#voiceCount').innerText(),'0音');assert.equal(starts(f).length,0);const saved=await windowPrefs(f.page);assert(saved.x>=0&&saved.x<=1&&saved.y>=0&&saved.y<=1);
    await f.page.screenshot({path:path.join(evidence,'dragged-1366.png')});
  });
  await check('real pointer movement clamps all four window edges to the visible viewport',async()=>{
    const f=await fixture();
    for(const [dx,dy,edge]of [[-3000,0,'left'],[3000,0,'right'],[0,-3000,'top'],[0,3000,'bottom']]){
      await drag(f.page,dx,dy);const r=await within(f.page),v=f.page.viewportSize();
      assert(Math.abs(({left:r.x,right:v.width-r.right,top:r.y,bottom:v.height-r.bottom})[edge]-8)<1,JSON.stringify({edge,r,v}));
    }
  });
  await check('handle arrows move 10 pixels, Shift arrows move 40 and Home resets without playing or changing octaves',async()=>{
    const f=await fixture({viewport:{width:1366,height:1080}});await drag(f.page,0,-80);const before=await rect(f.page),octave=await f.page.locator('#octave').innerText();await f.page.locator('#panelDrag').focus();
    await f.page.keyboard.press('ArrowLeft');let r=await rect(f.page);assert(Math.abs(r.x-before.x+10)<1);
    await f.page.keyboard.press('Shift+ArrowUp');r=await rect(f.page);assert(Math.abs(r.y-before.y+40)<1);
    assert.equal(await f.page.locator('#octave').innerText(),octave);assert.equal(starts(f).length,0);await f.page.keyboard.press('Home');await settle(f.page);
    assert.deepEqual(await windowPrefs(f.page),{version:1,x:.5,y:1,size:'normal'});await within(f.page);
  });
  await check('reset button restores both position and size independently of musical preferences',async()=>{
    const f=await fixture(),oldMusic=await f.page.evaluate(()=>localStorage.getItem('flecity-jam-v5'));await settings(f.page);await f.page.selectOption('#panelSize','small');await settle(f.page);await drag(f.page,-90,-40);
    await f.page.click('#resetPanel');await settle(f.page);assert.deepEqual(await windowPrefs(f.page),{version:1,x:.5,y:1,size:'normal'});assert.equal(await f.page.locator('#panelSize').inputValue(),'normal');
    assert.equal(await f.page.evaluate(()=>localStorage.getItem('flecity-jam-v5')),oldMusic);assert.equal(starts(f).length,0);await within(f.page);
  });
  await check('three window sizes persist with normalized position through reload while microphone intent does not persist',async()=>{
    const f=await fixture({viewport:{width:1920,height:1080}}),widths=[];
    for(const size of ['small','normal','large']){await settings(f.page);await f.page.selectOption('#panelSize',size);await settle(f.page);widths.push((await within(f.page)).width);}
    assert(widths[0]<widths[1]&&widths[1]<widths[2],JSON.stringify(widths));await drag(f.page,-65,-40);const saved=await windowPrefs(f.page),before=await rect(f.page);
    await f.page.reload();await f.page.waitForFunction(()=>document.querySelector('#instrument').options.length>0);await message(f.page,{type:'open',voice:{token:'after-reload',enabled:true}});await settle(f.page);
    assert.deepEqual(await windowPrefs(f.page),saved);const after=await rect(f.page);assert(Math.abs(after.x-before.x)<1&&Math.abs(after.width-before.width)<1);
    assert.equal(voices(f).length,0);assert.deepEqual(Object.keys(saved).sort(),['size','version','x','y']);
  });
  await check('window remains bounded and essential controls remain reachable after resizing across four viewport widths',async()=>{
    const f=await fixture({viewport:{width:1920,height:1080}});await drag(f.page,300,100);
    for(const [width,height]of [[390,844],[1366,768],[1920,1080],[2560,1440]]){
      await f.page.setViewportSize({width,height});await settle(f.page);await within(f.page);
      for(const id of ['panelDrag','close','voice']){const r=await f.page.locator('#'+id).boundingBox();assert(r&&r.x>=0&&r.y>=0&&r.x+r.width<=width+.5&&r.y+r.height<=height+.5,JSON.stringify({id,r,width,height}));}
      assert.equal(await f.page.evaluate(()=>document.documentElement.scrollWidth),width);await f.page.screenshot({path:path.join(evidence,`floating-${width}.png`)});
    }
  });
  await check('settings growth and compact mode keep the sticky header and automatic conversation control accessible',async()=>{
    const f=await fixture({viewport:{width:390,height:844}});await settings(f.page);await within(f.page);await f.page.locator('#bpm').scrollIntoViewIfNeeded();
    const voice=await f.page.locator('#voice').boundingBox(),close=await f.page.locator('#close').boundingBox();assert(voice&&voice.y>=0&&voice.y+voice.height<844);assert(close&&close.y>=0);
    await f.page.click('#compact');await settle(f.page);assert(await f.page.locator('#playArea').isHidden());await within(f.page);
    await f.page.click('#compact');await settle(f.page);assert(await f.page.locator('#playArea').isVisible());await within(f.page);assert.equal(starts(f).length,0);
  });
  await check('malformed or unsafe saved window preferences fall back to bounded normal layout',async()=>{
    for(const raw of ['{','null',JSON.stringify({version:1,x:-1,y:2,size:'large'}),JSON.stringify({version:1,x:.5,y:.5,size:'unknown'})]){
      const f=await fixture({windowRaw:raw});await within(f.page);await settings(f.page);assert.equal(await f.page.locator('#panelSize').inputValue(),'normal');assert.equal(starts(f).length,0);await f.page.close();
    }
  });
  await check('window storage errors keep movement usable and preserve musical settings without false persistence',async()=>{
    const f=await fixture({failSave:true}),before=await rect(f.page),music=await f.page.evaluate(()=>localStorage.getItem('flecity-jam-v5'));await drag(f.page,35,-25);const after=await within(f.page);
    assert(Math.abs(after.x-before.x-35)<1);assert.match(await f.page.locator('#notice').innerText(),/画面位置.*保存できません/);assert.equal(await windowPrefs(f.page),null);
    assert.equal(await f.page.evaluate(()=>localStorage.getItem('flecity-jam-v5')),music);assert.equal(await f.page.evaluate(()=>localStorage.getItem('flecity-jam-v1')),'{"keys":[],"protected":"synthetic old record"}');
  });
  await check('first real key chord starts exactly once, honors repeats and enables only authenticated session voice leases',async()=>{
    const f=await fixture();await f.page.keyboard.down('KeyA');await f.page.keyboard.down('KeyW');await f.page.keyboard.down('KeyA');await waitFor(f,x=>starts(x).length===1);
    assert.equal(await f.page.locator('#panel').getAttribute('aria-busy'),'true');assert.equal(await f.page.locator('#voiceCount').innerText(),'0音');assert.equal(voices(f).length,0);
    await ack(f);assert.equal(await f.page.locator('#voiceCount').innerText(),'2音');await waitFor(f,x=>ops(x).filter(op=>op.kind==='on').length===2);
    await f.page.waitForTimeout(240);assert(starts(f).length===1&&voices(f).length>=2);assert(voices(f).filter(call=>call.body.held).every(call=>call.body.automatic===true&&call.body.session==='floating-session'&&call.body.token==='floating-epoch'));
    await f.page.keyboard.up('KeyA');await f.page.keyboard.up('KeyW');assert.equal(await f.page.locator('#voiceCount').innerText(),'0音');await f.page.click('#voice');await waitFor(f,x=>voices(x).at(-1)?.body.held===false);
    const count=voices(f).length;await f.page.waitForTimeout(250);assert.equal(voices(f).length,count);
  });
  await check('a fresh initial short tap sounds exactly once and releases after prompt authenticated acknowledgement',async()=>{
    const f=await fixture();await f.page.keyboard.down('KeyA');await waitFor(f,x=>starts(x).length===1);await f.page.keyboard.up('KeyA');await ack(f);await waitFor(f,x=>ops(x).some(op=>op.kind==='off'));
    assert.equal(ops(f).filter(op=>op.kind==='on').length,1);assert.equal(ops(f).filter(op=>op.kind==='off').length,1);assert.equal(await f.page.locator('#voiceCount').innerText(),'0音');
  });
  await check('an old released tap and an overlong initial key age are not replayed after startup delays',async()=>{
    for(const releaseLate of [false,true]){
      const f=await fixture();await f.page.keyboard.down('KeyA');await waitFor(f,x=>starts(x).length===1);if(!releaseLate)await f.page.keyboard.up('KeyA');
      await f.page.waitForTimeout(400);if(releaseLate)await f.page.keyboard.up('KeyA');await ack(f);await f.page.waitForTimeout(40);
      assert.equal(ops(f).filter(op=>op.kind==='on').length,0);assert.equal(await f.page.locator('#voiceCount').innerText(),'0音');
    }
  });
  await check('repeated initial taps of the same physical key retain only the most recent brief strike',async()=>{
    const f=await fixture();await f.page.keyboard.down('KeyA');await waitFor(f,x=>starts(x).length===1);await f.page.keyboard.up('KeyA');await f.page.keyboard.press('KeyA');await ack(f);
    await waitFor(f,x=>ops(x).some(op=>op.kind==='off'));assert.equal(starts(f).length,1);assert.equal(ops(f).filter(op=>op.kind==='on').length,1);assert.equal(ops(f).filter(op=>op.kind==='off').length,1);
  });
  await check('first pointer hold starts a note and dragging the window during held keys does not swallow releases',async()=>{
    const f=await fixture(),key=f.page.locator('#keyboard [data-code="KeyA"]');await key.scrollIntoViewIfNeeded();const b=await key.boundingBox();assert(b);
    await f.page.mouse.move(b.x+b.width/2,b.y+b.height-12);await f.page.mouse.down();await waitFor(f,x=>starts(x).length===1);await ack(f);assert.equal(await f.page.locator('#voiceCount').innerText(),'1音');
    await f.page.mouse.move(2,2);await f.page.mouse.up();assert.equal(await f.page.locator('#voiceCount').innerText(),'0音');
    await f.page.locator('#playArea').focus();await f.page.keyboard.down('KeyA');assert.equal(await f.page.locator('#voiceCount').innerText(),'1音');await drag(f.page,25,-15);
    await f.page.keyboard.up('KeyA');assert.equal(await f.page.locator('#voiceCount').innerText(),'0音');await within(f.page);
  });
  await check('pointer cancellation before startup acknowledgement leaves no queued note or later sound',async()=>{
    const f=await fixture(),key=f.page.locator('#keyboard [data-code="KeyA"]');await key.scrollIntoViewIfNeeded();const b=await key.boundingBox();assert(b);
    await f.page.mouse.move(b.x+b.width/2,b.y+b.height-12);await f.page.mouse.down();await waitFor(f,x=>starts(x).length===1);
    // A cancellation is an OS lifecycle signal; the press and movement remain real pointer actions.
    await key.dispatchEvent('pointercancel',{pointerId:1,bubbles:true});await f.page.mouse.up();await ack(f);await f.page.waitForTimeout(40);
    assert.equal(await f.page.locator('#voiceCount').innerText(),'0音');assert.equal(ops(f).filter(op=>op.kind==='on').length,0);
  });
  await check('denied startup requires a fresh key and closing during pending startup rejects late acknowledgement',async()=>{
    const f=await fixture();await f.page.keyboard.down('KeyA');await waitFor(f,x=>starts(x).length===1);await message(f.page,{type:'control',data:{kind:'denied',reason:'permission'}});
    assert.equal(await f.page.locator('#panel').getAttribute('aria-busy'),'false');assert.equal(await f.page.locator('#voiceCount').innerText(),'0音');await f.page.keyboard.up('KeyA');await f.page.keyboard.down('KeyA');await waitFor(f,x=>starts(x).length===2);
    await f.page.keyboard.press('Escape');await f.page.keyboard.up('KeyA');await message(f.page,{type:'control',data:{kind:'started',session:'late-session',instrument:'piano'}});await f.page.waitForTimeout(40);
    assert(await f.page.locator('#panel').isHidden());assert.equal(ops(f).filter(op=>op.kind==='on').length,0);assert.equal(voices(f).filter(call=>call.body.held).length,0);
  });
  await check('synthetic MIDI retains its own velocity when it is the first note that automatically starts the session',async()=>{
    const f=await fixture({preview:true});assert.equal(await f.page.evaluate(()=>JAM.session),null);await f.page.evaluate(()=>JAM.midi.receive([0x90,60,57]));
    await f.page.waitForFunction(()=>Boolean(JAM.session));assert.deepEqual(await f.page.evaluate(()=>[...JAM.model.notes.values()].map(({pitch,velocity})=>({pitch,velocity}))),[{pitch:60,velocity:57}]);
    await f.page.evaluate(()=>JAM.midi.receive([0x80,60,0]));assert.equal(await f.page.locator('#voiceCount').innerText(),'0音');
  });
}finally{
  for(const f of fixtures)if(!f.page.isClosed())await f.page.close().catch(()=>{});await browser.close();
  const report={at:new Date().toISOString(),scope:'Isolated headless Chromium with actual mouse movement, pointer capture and physical-code keyboard operations. Mock NUI authentication callbacks, synthetic MIDI and a simulated pointercancel are explicit fixture signals. Warm-cache observation exposes only AudioRack; production files are unmodified. No FiveM, Voice resource, microphone or user settings are accessed.',passed:results.filter(r=>r.status==='PASS').length,failed:results.filter(r=>r.status==='FAIL').length,results,pageErrors:errors,outsideOrigins:outside,actualFiveM:'NOT_RUN',actualSoundAndConversation:'NOT_RUN',physicalNotebookComfort:'NOT_RUN'};
  fs.writeFileSync(path.join(evidence,'floating-browser-results.json'),JSON.stringify(report,null,2)+'\n');console.log(`Floating browser: ${report.passed} PASS, ${report.failed} FAIL; report ${evidence}`);if(report.failed||errors.length||outside.length)process.exitCode=1;
}
