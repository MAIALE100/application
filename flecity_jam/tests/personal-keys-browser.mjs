import {beginPlaying,stopPlaying} from './ui-actions.mjs';
// Isolated Chromium interaction checks for personal mappings. No game or user profile is used.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';

const resource=fileURLToPath(new URL('../',import.meta.url)),web=path.join(resource,'web');
const evidence=path.resolve(process.env.JAM_PERSONAL_KEYS_REPORT_DIR||path.join(resource,'../.flecity-dev/jam/personal-keys-browser'));
fs.mkdirSync(evidence,{recursive:true});
const modulePath=process.env.JAM_PLAYWRIGHT_MODULE||'C:/Users/suivx/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
const {chromium}=await import(path.isAbsolute(modulePath)?pathToFileURL(modulePath):modulePath);
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--autoplay-policy=no-user-gesture-required']});
// Pinned independently, so a product constant accidentally changing cannot bless the migration.
const home=['KeyA','KeyW','KeyS','KeyE','KeyD','KeyF','KeyT','KeyG','KeyY','KeyH','KeyU','KeyJ','KeyK','KeyO','KeyL','KeyP','Semicolon','Quote'];
const piano=['KeyZ','KeyS','KeyX','KeyD','KeyC','KeyV','KeyG','KeyB','KeyH','KeyQ','Digit2','KeyW','KeyE','Digit4','KeyR','Digit5','KeyT','KeyY','Digit7','KeyU','Digit8','KeyI','Digit9','KeyO','KeyP'];
const expanded=['KeyA','KeyS','KeyD','KeyF','KeyG','KeyH','KeyJ','KeyK','KeyL','Semicolon','Quote','Backslash','KeyQ','KeyW','KeyE','KeyR','KeyT','KeyY','KeyU','KeyI','KeyO','KeyP','BracketLeft','BracketRight','Digit1','Digit2','Digit3','Digit4','Digit5','Digit6','Digit7','Digit8','Digit9','Digit0','Minus','Equal'];
const drums=['KeyA','KeyS','KeyD','KeyF','KeyG','KeyH','KeyJ','KeyK'];
const drumPitches=[36,38,42,46,45,50,49,51];
const defaults={home18:home,piano,legacy:home,expanded,drums};
const custom={home18:['KeyC',...home.slice(1)],piano:['KeyA',...piano.slice(1)],legacy:['KeyZ',...home.slice(1)],expanded:['KeyC',...expanded.slice(1)],drums:['KeyQ',...drums.slice(1)]};
const scalars={listen:.37,muted:false,zoom:110,velocity:83,performVolume:48,showGuide:false};
const results=[],pages=[],errors=[],outside=[],requests=[];
async function check(name,fn){
  try{await fn();results.push({name,status:'PASS'});console.log('PASS '+name);}
  catch(error){results.push({name,status:'FAIL',error:String(error.stack||error)});console.error('FAIL '+name+': '+error.message);}
}
async function fixture({records={},failSave=false,nui=false}={}){
  const page=await browser.newPage({viewport:{width:1366,height:768}});pages.push(page);
  page.on('pageerror',error=>errors.push(error.message));
  await page.addInitScript(({records,failSave,nui})=>{
    // Reloads must observe actual persistence, not reseeded values.
    if(!sessionStorage.getItem('jam-personal-seeded')){
      for(const [version,raw]of Object.entries(records))localStorage.setItem('flecity-jam-'+version,raw);
      sessionStorage.setItem('jam-personal-seeded','yes');
    }
    if(failSave){const set=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){
      if(this===localStorage&&key==='flecity-jam-v5')throw new DOMException('isolated quota','QuotaExceededError');return set.call(this,key,value);
    };}
    if(nui)window.GetParentResourceName=()=> 'jam.test';
  },{records,failSave,nui});
  await page.route('**/*',async route=>{
    const request=route.request(),url=new URL(request.url());
    if(url.origin!=='https://jam.test'){outside.push(request.url());await route.abort();return;}
    if(request.method()==='POST'){
      requests.push({page:pages.indexOf(page),endpoint:url.pathname,body:request.postDataJSON()});
      await route.fulfill({status:200,contentType:'application/json',body:'{"ok":true}'});return;
    }
    const file=path.resolve(web,decodeURIComponent(url.pathname).replace(/^\//,'')||'index.html');assert(file.startsWith(web+path.sep));
    const mime={'.html':'text/html','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.ogg':'audio/ogg','.wav':'audio/wav'};
    await route.fulfill({status:200,contentType:mime[path.extname(file)]||'application/octet-stream',body:fs.readFileSync(file)});
  });
  await page.goto('https://jam.test/');
  if(nui){
    await page.waitForFunction(()=>document.querySelector('#instrument').options.length>0);
    await page.evaluate(()=>window.postMessage({type:'open',voice:{token:'synthetic-personal',enabled:true}},'*'));
    await page.locator('#panel').waitFor({state:'visible'});
  }else await page.waitForFunction(()=>window.JAM);
  return page;
}
const button=(page,index)=>page.locator(`#bindings button[data-binding-index="${index}"]`);
const saved=page=>page.evaluate(()=>JSON.parse(localStorage.getItem('flecity-jam-v5')));
const rawOld=page=>page.evaluate(()=>Object.fromEntries(['v1','v2','v3','v4'].map(v=>[v,localStorage.getItem('flecity-jam-'+v)])));
const expectedOld=records=>Object.fromEntries(['v1','v2','v3','v4'].map(v=>[v,records[v]??null]));
const mappings=page=>page.evaluate(()=>({melodic:[...JAM.model.bindings],drums:[...JAM.model.drumBindings]}));
const notes=page=>page.evaluate(()=>[...JAM.model.notes.values()].map(({pitch,velocity,held})=>({pitch,velocity,held})));
async function capture(page,index){
  if(!await page.locator('#settings').isVisible())await page.click('#editKeys');
  await button(page,index).click();assert.equal(await button(page,index).getAttribute('aria-pressed'),'true');
  assert(await page.locator('#cancelBinding').isVisible());
}
async function reload(page){await page.reload();await page.waitForFunction(()=>window.JAM);}
async function start(page){await beginPlaying(page);}
function oldRecords(){return {
  v1:JSON.stringify({keys:custom.legacy,listen:.12},null,2),
  v2:JSON.stringify({version:2,layout:'expanded',bindings:{legacy:custom.legacy,expanded:custom.expanded}},null,2),
  v3:JSON.stringify({version:3,layout:'piano',bindings:{piano,legacy:custom.legacy,expanded:custom.expanded}},null,2),
  v4:JSON.stringify({version:4,layout:'home18',bindings:custom,...scalars},null,2)
};}

try{
  await check('keyboard-side entry opens the personal editor with explicit local automatic-save and capture status',async()=>{
    const page=await fixture();assert(await page.locator('#editKeys').isVisible());assert(await page.locator('#settings').isHidden());
    await page.click('#editKeys');assert(await page.locator('#settings').isVisible());assert.equal(await page.locator('#editKeys').getAttribute('aria-expanded'),'true');
    assert.match(await page.locator('#bindingTarget').innerText(),/ホーム段18音/);assert.match(await page.locator('#bindingStatus').innerText(),/このPC.*自動保存/);
    assert.deepEqual(await page.locator('#bindings button').evaluateAll(items=>items.map(item=>[Number(item.dataset.bindingIndex),item.getAttribute('aria-pressed')])),home.map((_,i)=>[i,'false']));
    await capture(page,2);assert.equal(await page.locator('#bindings [aria-pressed="true"]').count(),1);assert.match(await page.locator('#bindingStatus').innerText(),/交換/);
  });
  await check('an already assigned melodic key swaps two pitches and both physical keys play the new mapping',async()=>{
    const page=await fixture();await capture(page,0);await page.keyboard.press('KeyW');
    const expected=[...home];[expected[0],expected[1]]=[expected[1],expected[0]];
    assert.deepEqual((await mappings(page)).melodic,expected);assert.deepEqual((await saved(page)).bindings.home18,expected);
    assert.match(await page.locator('#bindingStatus').innerText(),/2音.*交換.*保存済み/);assert.equal(new Set(expected).size,18);
    const base=await page.evaluate(()=>(JAM.model.octave+1)*12);
    assert.equal(await page.locator(`#keyboard [data-pitch="${base}"]`).getAttribute('data-code'),'KeyW');
    assert.equal(await page.locator(`#keyboard [data-pitch="${base+1}"]`).getAttribute('data-code'),'KeyA');
    await start(page);await page.keyboard.down('KeyW');await page.keyboard.down('KeyA');
    assert.deepEqual((await notes(page)).map(n=>n.pitch).sort((a,b)=>a-b),[base,base+1]);
    await page.keyboard.up('KeyW');await page.keyboard.up('KeyA');assert.equal((await notes(page)).length,0);
  });
  await check('an unused physical key changes only one note, updates the guide and survives reload',async()=>{
    const page=await fixture();await capture(page,0);await page.keyboard.press('KeyC');const expected=['KeyC',...home.slice(1)];
    assert.deepEqual((await mappings(page)).melodic,expected);assert.deepEqual((await saved(page)).bindings.home18,expected);
    const base=await page.evaluate(()=>(JAM.model.octave+1)*12);assert.equal(await page.locator(`#keyboard [data-pitch="${base}"]`).getAttribute('data-code'),'KeyC');
    await start(page);await page.keyboard.press('KeyA');assert.equal((await notes(page)).length,0);
    await page.keyboard.down('KeyC');assert.equal((await notes(page))[0].pitch,base);await page.keyboard.up('KeyC');
    await reload(page);assert.deepEqual((await mappings(page)).melodic,expected);assert.equal((await saved(page)).version,5);
  });
  await check('choosing the same key is a no-op and never duplicates or changes any stored preset',async()=>{
    const page=await fixture(),before=await saved(page);await capture(page,0);await page.keyboard.press('KeyA');
    assert.deepEqual((await mappings(page)).melodic,home);assert.deepEqual(await saved(page),before);
    assert.equal(await page.locator('#bindings [aria-pressed="true"]').count(),0);assert(await page.locator('#cancelBinding').isHidden());
  });
  await check('capture can be cancelled by pointer, native Tab navigation, Enter and Space without changing data',async()=>{
    const page=await fixture(),before=await saved(page);
    await capture(page,0);await page.click('#cancelBinding');assert(await page.locator('#cancelBinding').isHidden());assert.deepEqual(await saved(page),before);
    for(const key of ['Enter','Space']){
      await capture(page,0);await page.keyboard.press('Shift+Tab');assert.equal(await page.evaluate(()=>document.activeElement.id),'resetKeys');
      await page.keyboard.press('Shift+Tab');assert.equal(await page.evaluate(()=>document.activeElement.id),'cancelBinding');
      await page.keyboard.press(key);assert(await page.locator('#cancelBinding').isHidden());assert(await page.locator('#panel').isVisible());assert.deepEqual(await saved(page),before);
    }
  });
  await check('Escape during capture still closes JAM completely and leaves every saved mapping unchanged',async()=>{
    const page=await fixture(),before=await saved(page);await capture(page,3);await page.keyboard.press('Escape');
    assert(await page.locator('#panel').isHidden());assert.deepEqual(await saved(page),before);assert.deepEqual((await mappings(page)).melodic,home);
  });
  await check('an operating-system repeated key cannot accidentally confirm a key capture',async()=>{
    const page=await fixture();await start(page);await page.keyboard.down('KeyA');assert.equal((await notes(page)).length,1);
    await capture(page,2);assert.equal((await notes(page)).length,0);await page.keyboard.down('KeyA');
    assert.deepEqual((await mappings(page)).melodic,home);assert.equal(await button(page,2).getAttribute('aria-pressed'),'true');
    await page.keyboard.up('KeyA');await page.keyboard.press('KeyC');assert.equal((await mappings(page)).melodic[2],'KeyC');
  });
  await check('Ctrl, Alt, Meta and an IME-composing event do not capture a key or modify saved mappings',async()=>{
    const page=await fixture(),before=await saved(page);await capture(page,0);
    for(const modifier of ['Control','Alt','Meta']){
      await page.keyboard.down(modifier);await page.keyboard.press('KeyC');await page.keyboard.up(modifier);
      assert.equal(await button(page,0).getAttribute('aria-pressed'),'true');assert.deepEqual(await saved(page),before);
    }
    // Browser exposes no hardware IME automation: only this composition guard is an explicitly synthetic event.
    await button(page,0).evaluate(element=>element.dispatchEvent(new KeyboardEvent('keydown',{code:'KeyC',key:'c',bubbles:true,cancelable:true,isComposing:true})));
    assert.equal(await button(page,0).getAttribute('aria-pressed'),'true');assert.deepEqual(await saved(page),before);
    await page.keyboard.press('KeyC');assert.equal((await mappings(page)).melodic[0],'KeyC');
  });
  await check('reserved voice, pedal and octave keys are rejected during capture without starting PTT or sustain',async()=>{
    const page=await fixture(),before=await saved(page);await start(page);const octave=await page.evaluate(()=>JAM.model.octave);await capture(page,0);
    for(const key of ['KeyN','CapsLock','Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','F8']){
      await page.keyboard.press(key);assert.equal(await button(page,0).getAttribute('aria-pressed'),'true');assert.deepEqual(await saved(page),before);
      assert.equal(await page.locator('#voice').getAttribute('aria-pressed'),'true','binding capture must not change the automatic-conversation preference');assert.equal(await page.evaluate(()=>JAM.model.sustain),false);assert.equal(await page.evaluate(()=>JAM.model.octave),octave);
    }
    assert.match(await page.locator('#error').innerText(),/予約済み/);await page.click('#cancelBinding');
    await page.evaluate(()=>JAM.message({type:'open',reserved:['KeyC']}));await capture(page,0);await page.keyboard.press('KeyC');assert.deepEqual((await mappings(page)).melodic,home);
    assert.equal(await button(page,0).getAttribute('aria-pressed'),'true');
  });
  await check('drum pads swap independently and physical drum keys plus synthetic MIDI retain their expected pitches',async()=>{
    const page=await fixture();await page.selectOption('#instrument','drums');assert.equal(await page.locator('#keyLayout').isDisabled(),true);
    await capture(page,0);assert.equal(await page.locator('#bindings button').count(),8);assert.match(await page.locator('#bindingTarget').innerText(),/ドラム8パッド/);
    await page.keyboard.press('KeyS');const expected=[...drums];[expected[0],expected[1]]=[expected[1],expected[0]];
    assert.deepEqual(await mappings(page),{melodic:home,drums:expected});assert.deepEqual((await saved(page)).bindings.drums,expected);
    assert.equal(await page.locator('#keyboard [data-pitch="36"]').getAttribute('data-code'),'KeyS');assert.equal(await page.locator('#keyboard [data-pitch="38"]').getAttribute('data-code'),'KeyA');
    await start(page);await page.keyboard.down('KeyS');await page.keyboard.down('KeyA');assert.deepEqual((await notes(page)).map(n=>n.pitch).sort((a,b)=>a-b),[36,38]);
    await page.keyboard.up('KeyS');await page.keyboard.up('KeyA');assert.equal((await notes(page)).length,0);
    await page.evaluate(()=>JAM.midi.receive([0x90,36,57]));assert.deepEqual(await notes(page),[{pitch:36,velocity:57,held:true}]);
    await page.evaluate(()=>JAM.midi.receive([0x80,36,0]));assert.equal((await notes(page)).length,0);
    assert.deepEqual(await page.locator('#keyboard [data-pitch]').evaluateAll(items=>items.map(item=>Number(item.dataset.pitch))),drumPitches);
  });
  await check('drum and four melodic presets remain independent across instrument changes and browser reloads',async()=>{
    const records=oldRecords(),page=await fixture({records});assert.deepEqual(await rawOld(page),expectedOld(records));
    await page.selectOption('#instrument','drums');await capture(page,1);await page.keyboard.press('KeyM');
    const expectedDrums=[...custom.drums];expectedDrums[1]='KeyM';
    for(const mode of ['home18','piano','legacy','expanded']){
      await page.selectOption('#instrument','piano');await page.selectOption('#keyLayout',mode);assert.deepEqual((await mappings(page)).melodic,custom[mode]);
      await page.selectOption('#instrument','drums');assert.deepEqual((await mappings(page)).drums,expectedDrums);
    }
    await reload(page);await page.selectOption('#instrument','drums');assert.deepEqual((await mappings(page)).drums,expectedDrums);
    const record=await saved(page);assert.deepEqual(record.bindings,{...custom,drums:expectedDrums});
    for(const [key,value]of Object.entries(scalars))assert.equal(record[key],value,key);assert.deepEqual(await rawOld(page),expectedOld(records));
  });
  await check('reset restores only the current melodic preset or drum slot while all other custom mappings survive',async()=>{
    const records=oldRecords(),page=await fixture({records});await page.click('#editKeys');await page.click('#resetKeys');
    let expected={...custom,home18:home};assert.deepEqual((await saved(page)).bindings,expected);assert.match(await page.locator('#bindingStatus').innerText(),/この配列だけ.*他の配列.*保持/);
    await capture(page,0);await page.keyboard.press('KeyM');expected={...expected,home18:['KeyM',...home.slice(1)]};
    await page.selectOption('#instrument','drums');await page.click('#resetKeys');expected={...expected,drums};assert.deepEqual((await saved(page)).bindings,expected);
    await page.selectOption('#instrument','piano');assert.deepEqual((await mappings(page)).melodic,expected.home18);
    await reload(page);assert.deepEqual((await saved(page)).bindings,expected);assert.deepEqual(await rawOld(page),expectedOld(records));
  });
  await check('v5 preference wins over v4, preserving all old raw records, five slots and non-mapping settings',async()=>{
    const records={...oldRecords(),v5:JSON.stringify({version:5,layout:'piano',bindings:defaults,...scalars,velocity:121,performVolume:26},null,2)},page=await fixture({records});
    assert.equal(await page.locator('#keyLayout').inputValue(),'piano');assert.deepEqual((await saved(page)).bindings,defaults);
    await capture(page,0);await page.keyboard.press('KeyM');const expected={...defaults,piano:['KeyM',...piano.slice(1)]};
    await reload(page);const record=await saved(page);assert.equal(record.version,5);assert.equal(record.layout,'piano');assert.deepEqual(record.bindings,expected);
    assert.equal(record.velocity,121);assert.equal(record.performVolume,26);for(const key of ['listen','muted','zoom','showGuide'])assert.equal(record[key],scalars[key]);
    assert.deepEqual(await rawOld(page),expectedOld(records));
  });
  await check('storage failure reports a temporary unsaved mapping and reload falls back without changing older data',async()=>{
    const records=oldRecords(),page=await fixture({records,failSave:true});assert.equal(await saved(page),null);
    await capture(page,0);await page.keyboard.press('KeyM');assert.equal((await mappings(page)).melodic[0],'KeyM');assert.equal(await saved(page),null);
    assert.match(await page.locator('#bindingStatus').innerText(),/保存できません.*今回のみ/);assert.doesNotMatch(await page.locator('#bindingStatus').innerText(),/保存済み/);
    assert.match(await page.locator('#notice').innerText(),/保存できません/);assert.deepEqual(await rawOld(page),expectedOld(records));
    await reload(page);assert.deepEqual((await mappings(page)).melodic,custom.home18);assert.equal(await saved(page),null);assert.deepEqual(await rawOld(page),expectedOld(records));
  });
  await check('personal mappings autosave only on this browser and never appear in NUI bridge requests',async()=>{
    const page=await fixture({nui:true}),pageId=pages.indexOf(page);await capture(page,0);await page.keyboard.press('KeyC');
    await page.selectOption('#instrument','drums');await capture(page,0);await page.keyboard.press('KeyQ');
    const record=await saved(page);assert.equal(record.bindings.home18[0],'KeyC');assert.equal(record.bindings.drums[0],'KeyQ');
    await page.keyboard.press('Escape');await page.waitForTimeout(100);
    const calls=requests.filter(item=>item.page===pageId);assert(calls.some(item=>item.endpoint==='/ready'));assert(calls.some(item=>item.endpoint==='/close'));
    for(const call of calls){assert(['/ready','close','/close','/pulse','/voice'].includes(call.endpoint),JSON.stringify(call));assert.doesNotMatch(JSON.stringify(call.body),/bindings|keySets|home18|KeyC|KeyQ|keymapping/);}
  });
  await check('personal mapping cards and cancellation stay readable without horizontal overflow at 390, 1366 and 1920 pixels',async()=>{
    const page=await fixture();
    for(const [width,height]of [[390,844],[1366,768],[1920,1080]]){
      await page.setViewportSize({width,height});await page.selectOption('#instrument','piano');await page.click('#editKeys');await capture(page,0);
      for(const mode of ['melodic','drums']){
        if(mode==='drums'){await page.selectOption('#instrument','drums');await capture(page,0);}
        const geometry=await page.evaluate(()=>{
          const panel=document.querySelector('#panel'),settings=document.querySelector('#settings'),rect=panel.getBoundingClientRect();
          const cards=[...document.querySelectorAll('#bindings button')].map(button=>{const r=button.getBoundingClientRect();return {left:r.left,right:r.right,width:r.width,height:r.height,scroll:button.scrollWidth,client:button.clientWidth,font:parseFloat(getComputedStyle(button).fontSize)};});
          const extra=['bindingTarget','bindingStatus','cancelBinding','resetKeys'].map(id=>{const element=document.getElementById(id),r=element.getBoundingClientRect();return {id,left:r.left,right:r.right,font:parseFloat(getComputedStyle(element).fontSize)};});
          return {width:innerWidth,documentWidth:document.documentElement.scrollWidth,panel:{left:rect.left,right:rect.right,scroll:panel.scrollWidth,client:panel.clientWidth},settings:{scroll:settings.scrollWidth,client:settings.clientWidth},cards,extra};
        });
        assert(geometry.documentWidth<=width+.5&&geometry.panel.left>=-.5&&geometry.panel.right<=width+.5,JSON.stringify(geometry));
        assert(geometry.panel.scroll<=geometry.panel.client+1&&geometry.settings.scroll<=geometry.settings.client+1,JSON.stringify(geometry));
        assert.equal(geometry.cards.length,mode==='drums'?8:18);
        assert(geometry.cards.every(card=>card.width>=70&&card.height>=44&&card.left>=0&&card.right<=width+.5&&card.scroll<=card.client+1&&card.font>=12),JSON.stringify(geometry));
        assert(geometry.extra.every(item=>item.left>=0&&item.right<=width+.5&&item.font>=12),JSON.stringify(geometry));
        await page.screenshot({path:path.join(evidence,`personal-${mode}-${width}.png`)});
      }
    }
  });
}finally{
  for(const page of pages)if(!page.isClosed())await page.close().catch(()=>{});await browser.close();
  const report={at:new Date().toISOString(),scope:'Isolated headless Chromium, synthetic localStorage v1-v5 and a same-origin mock NUI bridge. Actual browser keyboard, clicks, native Tab/Enter/Space and reload used for mappings. The composition flag and MIDI packets are explicitly synthetic. No game, user settings, real server, microphone or hardware MIDI.',passed:results.filter(result=>result.status==='PASS').length,failed:results.filter(result=>result.status==='FAIL').length,results,pageErrors:errors,outsideOrigins:outside,nuiRequests:requests,physicalJISKeyboard:'NOT_RUN',liveHandsComfort:'NOT_RUN',actualSound:'NOT_RUN',nativeFiveMInputAndPTT:'NOT_RUN',hardwareMIDI:'NOT_RUN'};
  fs.writeFileSync(path.join(evidence,'personal-keys-browser-results.json'),JSON.stringify(report,null,2)+'\n');
  console.log(`Personal keys browser: ${report.passed} PASS, ${report.failed} FAIL; report ${evidence}`);if(report.failed||errors.length||outside.length)process.exitCode=1;
}
