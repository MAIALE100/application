// Offline browser interaction checks. FiveM, microphone and MIDI hardware are not used.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';

const resource=fileURLToPath(new URL('../',import.meta.url)),web=path.join(resource,'web');
const evidence=path.resolve(process.env.JAM_USABILITY_REPORT_DIR||path.join(resource,'../.flecity-dev/jam/usability-browser'));
fs.mkdirSync(evidence,{recursive:true});
const modulePath=process.env.JAM_PLAYWRIGHT_MODULE||'C:/Users/suivx/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
const {chromium}=await import(path.isAbsolute(modulePath)?pathToFileURL(modulePath):modulePath);
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--autoplay-policy=no-user-gesture-required']});
const results=[],errors=[],pages=[];
async function check(name,fn){
  try{await fn();results.push({name,status:'PASS'});console.log('PASS '+name);}
  catch(error){results.push({name,status:'FAIL',error:String(error.stack||error)});console.error('FAIL '+name+': '+error.message);}
}
async function fixture(seed){
  const page=await browser.newPage({viewport:{width:1366,height:768}});pages.push(page);
  page.on('pageerror',error=>errors.push(error.message));
  if(seed)await page.addInitScript(records=>{for(const [key,raw]of Object.entries(records))localStorage.setItem('flecity-jam-'+key,raw);},seed);
  await page.route('**/*',async route=>{
    const url=new URL(route.request().url());assert.equal(url.origin,'https://jam.test','offline fixture must not contact other origins');
    const file=path.resolve(web,decodeURIComponent(url.pathname).replace(/^\//,'')||'index.html');
    assert(file.startsWith(web+path.sep));
    const mime={'.html':'text/html','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.ogg':'audio/ogg','.wav':'audio/wav'};
    await route.fulfill({status:200,contentType:mime[path.extname(file)]||'application/octet-stream',body:fs.readFileSync(file)});
  });
  await page.goto('https://jam.test/');await page.waitForFunction(()=>window.JAM);return page;
}
async function start(page){await page.click('#start');await page.waitForFunction(()=>Boolean(JAM.session));await page.locator('#playArea').focus();}
const notes=page=>page.evaluate(()=>[...JAM.model.notes.values()].map(({pitch,velocity,held})=>({pitch,velocity,held})));
async function range(page,id,value){
  const input=page.locator('#'+id),min=Number(await input.getAttribute('min')),max=Number(await input.getAttribute('max'));
  await input.focus();const fromMin=value-min<=max-value;await page.keyboard.press(fromMin?'Home':'End');
  for(let i=0;i<(fromMin?value-min:max-value);i++)await page.keyboard.press(fromMin?'ArrowRight':'ArrowLeft');
  assert.equal(await input.inputValue(),String(value));
}
async function sustainChord(page){
  await page.keyboard.down('z');await page.keyboard.down('Space');await page.keyboard.up('z');
  assert.equal(await page.evaluate(()=>JAM.model.sustain),true);assert.equal((await notes(page)).length,1);
  await page.keyboard.up('Space');assert.equal((await notes(page)).length,0);
}

try{
  await check('new controls retain prior loudness and strength defaults without hiding the piano',async()=>{
    const page=await fixture();assert.equal(await page.locator('#velocity').inputValue(),'100');
    assert.equal(await page.locator('#performVolume').inputValue(),'75');assert.equal(await page.evaluate(()=>JAM.model.volume),.75);
    assert(await page.locator('#physicalLayout').isVisible());assert(await page.locator('#keyboard').isVisible());
    assert.equal(await page.locator('#guideToggle').getAttribute('aria-expanded'),'true');
    for(const [width,height]of [[390,844],[1366,768],[1920,1080]]){
      await page.setViewportSize({width,height});
      const g=await page.locator('#panel').evaluate(p=>{const r=p.getBoundingClientRect();return {left:r.left,right:r.right,bottom:r.bottom,width:innerWidth,height:innerHeight,scroll:document.documentElement.scrollWidth};});
      assert(g.left>=-.5&&g.right<=g.width+.5&&g.bottom<=g.height+.5&&g.scroll<=g.width+.5,JSON.stringify(g));
      await page.screenshot({path:path.join(evidence,`usability-${width}.png`)});
    }
    await page.setViewportSize({width:1366,height:768});
    const catalog=JSON.parse(fs.readFileSync(path.join(web,'catalog.json'),'utf8'));
    assert.equal(await page.locator('#instrument option').count(),catalog.instruments.length);
    for(const spec of catalog.instruments){
      await page.selectOption('#instrument',spec.id);
      assert.equal(await page.locator('#instrument option:checked').innerText(),spec.name);
      const mapped=await page.locator('#keyboard button[data-code]:not(:disabled)').evaluateAll(buttons=>buttons.map(button=>Number(button.dataset.pitch)));
      assert(mapped.length>0&&mapped.every(pitch=>pitch>=spec.min&&pitch<=spec.max),spec.id+' has invalid playable bounds');
      assert.equal(await page.locator('#keyLayout').isDisabled(),spec.kind==='drums');
      assert.equal(await page.locator('#guideToggle').isDisabled(),spec.kind==='drums');
      assert.equal(await page.locator('#velocity').inputValue(),'100');assert.equal(await page.locator('#performVolume').inputValue(),'75');
      if(spec.kind==='drums'){
        const pads=await page.locator('#keyboard .key').evaluateAll(buttons=>{
          const view=document.querySelector('#keyboardViewport').getBoundingClientRect();
          return buttons.map(button=>{const r=button.getBoundingClientRect();return {code:button.dataset.code,inside:r.left>=view.left-.5&&r.right<=view.right+.5&&r.top>=view.top-.5&&r.bottom<=view.bottom+.5};});
        });
        assert.equal(pads.length,8);assert(pads.every(pad=>pad.inside),'every drum pad must remain inside its viewport: '+JSON.stringify(pads));
      }
      await page.screenshot({path:path.join(evidence,`instrument-${spec.id}.png`)});
    }
  });
  await check('real PC keyboard notes use the selected strength',async()=>{
    const page=await fixture();await range(page,'velocity',40);await start(page);await page.keyboard.down('z');
    try{assert.deepEqual(await notes(page),[{pitch:48,velocity:40,held:true}]);}finally{await page.keyboard.up('z');}
    assert.equal(await page.locator('#velocityValue').innerText(),'40');
  });
  await check('real mouse notes use strength 127 and release outside the key',async()=>{
    const page=await fixture();await range(page,'velocity',127);await start(page);
    const key=page.locator('#keyboard button[data-pitch="60"]');await key.scrollIntoViewIfNeeded();const box=await key.boundingBox();assert(box);
    await page.mouse.move(box.x+box.width/2,box.y+box.height*.8);await page.mouse.down();
    try{assert.deepEqual(await notes(page),[{pitch:60,velocity:127,held:true}]);}finally{await page.mouse.move(2,2);await page.mouse.up();}
    assert.equal((await notes(page)).length,0);
  });
  await check('strength changes affect new notes while held notes retain their original velocity',async()=>{
    const page=await fixture();await range(page,'velocity',55);await start(page);await page.keyboard.down('z');
    await range(page,'velocity',120);await page.locator('#playArea').focus();await page.keyboard.down('p');
    try{assert.deepEqual((await notes(page)).map(note=>[note.pitch,note.velocity]),[[48,55],[72,120]]);}
    finally{await page.keyboard.up('z');await page.keyboard.up('p');}
    assert.equal((await notes(page)).length,0);
  });
  await check('simulated MIDI parser input retains its own velocity independently of the PC slider',async()=>{
    const page=await fixture();await range(page,'velocity',40);await start(page);
    await page.evaluate(()=>JAM.midi.receive([0x90,60,27]));
    assert.deepEqual(await notes(page),[{pitch:60,velocity:27,held:true}]);
    await page.evaluate(()=>JAM.midi.receive([0x80,60,0]));assert.equal((await notes(page)).length,0);
    assert.equal(await page.locator('#velocity').inputValue(),'40');
  });
  await check('guide hiding preserves held notes, keyboard, octave and voice controls',async()=>{
    const page=await fixture();await start(page);await page.keyboard.down('z');
    await page.click('#guideToggle');assert(await page.locator('#physicalLayout').isHidden());
    assert(await page.locator('#keyboard').isVisible());assert(await page.locator('#octUp').isVisible());assert(await page.locator('#voice').isVisible());
    assert.equal(await page.locator('#guideToggle').getAttribute('aria-expanded'),'false');assert.equal((await notes(page))[0].pitch,48);
    await page.keyboard.up('z');await sustainChord(page);
    await page.click('#guideToggle');assert(await page.locator('#physicalLayout').isVisible());
  });
  await check('guide preference remains independent of legacy and expanded presets',async()=>{
    const page=await fixture();await page.click('#guideToggle');
    for(const layout of ['legacy','expanded']){await page.selectOption('#keyLayout',layout);assert(await page.locator('#guideToggle').isDisabled());assert(await page.locator('#physicalLayout').isHidden());}
    await page.selectOption('#keyLayout','piano');assert(await page.locator('#guideToggle').isEnabled());assert(await page.locator('#physicalLayout').isHidden());
    await page.click('#guideToggle');assert(await page.locator('#physicalLayout').isVisible());assert.equal(await page.locator('#keyboard button[data-code]:not(:disabled)').count(),25);
  });
  await check('strength, performer volume and guide choice reload without changing v1 or v2 bytes',async()=>{
    const legacy=['KeyA','KeyW','KeyS','KeyE','KeyD','KeyF','KeyT','KeyG','KeyY','KeyH','KeyU','KeyJ','KeyK','KeyO','KeyL','KeyP','Semicolon','KeyC'];
    const expanded=['KeyC','KeyS','KeyD','KeyF','KeyG','KeyH','KeyJ','KeyK','KeyL','Semicolon','Quote','Backslash','KeyQ','KeyW','KeyE','KeyR','KeyT','KeyY','KeyU','KeyI','KeyO','KeyP','BracketLeft','BracketRight','Digit1','Digit2','Digit3','Digit4','Digit5','Digit6','Digit7','Digit8','Digit9','Digit0','Minus','Equal'];
    const v1=JSON.stringify({keys:legacy,listen:.31}),v2=JSON.stringify({version:2,layout:'expanded',bindings:{expanded},listen:.42,muted:false,zoom:120});
    const page=await fixture({v1,v2});await page.selectOption('#keyLayout','piano');
    await range(page,'velocity',64);await range(page,'performVolume',30);await page.click('#guideToggle');
    await page.reload();await page.waitForFunction(()=>window.JAM);
    assert.equal(await page.locator('#velocity').inputValue(),'64');assert.equal(await page.locator('#performVolume').inputValue(),'30');
    assert.equal(await page.evaluate(()=>JAM.model.volume),.3);assert(await page.locator('#physicalLayout').isHidden());
    assert.equal(await page.locator('#listenVolume').inputValue(),'42');assert.equal(await page.locator('#keyboardZoom').inputValue(),'120');
    assert.equal(await page.evaluate(()=>localStorage.getItem('flecity-jam-v1')),v1);assert.equal(await page.evaluate(()=>localStorage.getItem('flecity-jam-v2')),v2);
    const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('flecity-jam-v3')));assert.deepEqual(saved.bindings.legacy,legacy);assert.deepEqual(saved.bindings.expanded,expanded);
    await page.selectOption('#instrument','guitar');assert.equal(await page.evaluate(()=>JAM.model.volume),.3);assert.equal(await page.locator('#velocity').inputValue(),'64');
  });
  await check('invalid optional preference fields fall back safely while valid old preferences survive',async()=>{
    const page=await fixture({v3:JSON.stringify({version:3,velocity:0,performVolume:-1,showGuide:'false',listen:.28,zoom:140})});
    assert.equal(await page.locator('#velocity').inputValue(),'100');assert.equal(await page.locator('#performVolume').inputValue(),'75');assert(await page.locator('#physicalLayout').isVisible());
    assert.equal(await page.locator('#listenVolume').inputValue(),'28');assert.equal(await page.locator('#keyboardZoom').inputValue(),'140');
  });
  await check('pointer use of play controls returns focus so Space remains a sustain pedal',async()=>{
    const page=await fixture();await start(page);
    for(const id of ['viewHome','viewLeft','viewRight','panic','mute','guideToggle','octUp','octDown']){
      await page.click('#'+id);assert.equal(await page.evaluate(()=>document.activeElement.id),'playArea',id);
      await sustainChord(page);
    }
    await page.click('#settingsToggle');assert.equal(await page.evaluate(()=>document.activeElement.id),'playArea');
    await page.click('#resetKeys');assert.equal(await page.evaluate(()=>document.activeElement.id),'playArea');await sustainChord(page);
  });
  await check('keyboard activation keeps focus on controls for subsequent Tab navigation',async()=>{
    const page=await fixture();await start(page);
    for(const id of ['viewHome','mute','guideToggle','panic','octUp','octDown']){
      await page.locator('#'+id).focus();await page.keyboard.press('Enter');assert.equal(await page.evaluate(()=>document.activeElement.id),id);
    }
  });
  await check('real slider drag returns focus to playing without changing keyboard navigation behavior',async()=>{
    const page=await fixture();await start(page);
    for(const id of ['velocity','performVolume','listenVolume','keyboardZoom']){
      const slider=page.locator('#'+id);await slider.scrollIntoViewIfNeeded();const box=await slider.boundingBox();assert(box);
      await page.mouse.move(box.x+box.width*.5,box.y+box.height/2);await page.mouse.down();await page.mouse.move(box.x+box.width*.7,box.y+box.height/2,{steps:5});await page.mouse.up();
      assert.equal(await page.evaluate(()=>document.activeElement.id),'playArea',id);await sustainChord(page);
      await slider.focus();await page.keyboard.press('ArrowLeft');assert.equal(await page.evaluate(()=>document.activeElement.id),id);
    }
  });
  await check('compact-mode pointer activation keeps keyboard sustain available without reopening the piano',async()=>{
    const page=await fixture();await start(page);await page.click('#compact');
    assert.equal(await page.evaluate(()=>document.activeElement.id),'panel');assert(await page.locator('#playArea').isHidden());
    await sustainChord(page);assert(await page.locator('#playArea').isHidden());
    await page.click('#compact');assert.equal(await page.evaluate(()=>document.activeElement.id),'playArea');assert(await page.locator('#keyboard').isVisible());
  });
}finally{
  for(const page of pages)await page.close().catch(()=>{});await browser.close();
  const report={at:new Date().toISOString(),scope:'Isolated headless Chromium; real mouse and keyboard actions for performance/UI. MIDI receive packets are simulated parser input. FiveM, real audio listening, hardware MIDI and PTT NOT_RUN.',passed:results.filter(result=>result.status==='PASS').length,failed:results.filter(result=>result.status==='FAIL').length,results,pageErrors:errors};
  fs.writeFileSync(path.join(evidence,'usability-browser-results.json'),JSON.stringify(report,null,2)+'\n');
  console.log(`Usability browser: ${report.passed} PASS, ${report.failed} FAIL; report ${evidence}`);if(report.failed||errors.length)process.exitCode=1;
}
