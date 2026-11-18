import {beginPlaying,stopPlaying} from './ui-actions.mjs';
// Isolated Chromium keyboard/layout QA. No FiveM, server, microphone or MIDI device is used.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';

const resource=fileURLToPath(new URL('../',import.meta.url)),web=path.join(resource,'web');
const evidence=path.resolve(process.env.JAM_HANDS_REPORT_DIR||path.join(resource,'../.flecity-dev/jam/hands-browser'));
fs.mkdirSync(evidence,{recursive:true});
const modulePath=process.env.JAM_PLAYWRIGHT_MODULE||'C:/Users/suivx/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
const {chromium}=await import(path.isAbsolute(modulePath)?pathToFileURL(modulePath):modulePath);
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--autoplay-policy=no-user-gesture-required']});
const HOME=['KeyA','KeyW','KeyS','KeyE','KeyD','KeyF','KeyT','KeyG','KeyY','KeyH','KeyU','KeyJ','KeyK','KeyO','KeyL','KeyP','Semicolon','Quote'];
const WHITE=['KeyA','KeyS','KeyD','KeyF','KeyG','KeyH','KeyJ','KeyK','KeyL','Semicolon','Quote'];
const BLACK=['KeyW','KeyE','KeyT','KeyY','KeyU','KeyO','KeyP'];
const key=code=>({Semicolon:';',Quote:"'"}[code]||code.replace(/^Key/,'').toLowerCase());
const results=[],errors=[],outside=[],pages=[];
async function check(name,fn){
  try{await fn();results.push({name,status:'PASS'});console.log('PASS '+name);}
  catch(error){results.push({name,status:'FAIL',error:String(error.stack||error)});console.error('FAIL '+name+': '+error.message);}
}
async function fixture(){
  const page=await browser.newPage({viewport:{width:1366,height:768}});pages.push(page);
  page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/*',async route=>{
    const url=new URL(route.request().url());
    if(url.origin!=='https://jam.test'){outside.push(url.origin);await route.abort();return;}
    const file=path.resolve(web,decodeURIComponent(url.pathname).replace(/^\//,'')||'index.html');
    if(!file.startsWith(web+path.sep)||!fs.existsSync(file)){await route.fulfill({status:404,body:'Not found'});return;}
    const mime={'.html':'text/html','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.ogg':'audio/ogg','.wav':'audio/wav'};
    await route.fulfill({status:200,contentType:mime[path.extname(file)]||'application/octet-stream',body:fs.readFileSync(file)});
  });
  await page.goto('https://jam.test/');await page.waitForFunction(()=>window.JAM);return page;
}
async function start(page){await beginPlaying(page);}
const notes=page=>page.evaluate(()=>[...JAM.model.notes.values()].map(({id,pitch,held})=>({id,pitch,held})));
const assigned=page=>page.evaluate(()=>JAM.model.bindings);
const guide=page=>page.locator('#physicalLayout .pc-key').evaluateAll(cells=>cells.map(cell=>({
  code:cell.dataset.code,pitch:Number(cell.dataset.pitch),black:cell.classList.contains('black'),
  pressed:cell.classList.contains('pressed'),label:cell.querySelector('kbd')?.textContent,
  x:cell.getBoundingClientRect().x+cell.getBoundingClientRect().width/2
})));

try{
  await check('fresh settings open home18 with eighteen unique keys and no reserved voice or pedal keys',async()=>{
    const page=await fixture();assert.equal(await page.locator('#keyLayout').inputValue(),'home18');
    assert.deepEqual(await assigned(page),HOME);assert.equal(new Set(await assigned(page)).size,18);
    assert(!HOME.includes('KeyN')&&!HOME.includes('Space'));
    assert.equal(await page.evaluate(()=>JAM.model.octave),3);
    assert.match(await page.locator('#mappedRange').innerText(),/18/);
    assert(await page.locator('#physicalLayout').isVisible());
  });
  await check('home white keys use one physical row with left and right hands separated',async()=>{
    const page=await fixture(),cells=await guide(page);
    assert.deepEqual(cells.filter(cell=>!cell.black).map(cell=>cell.code),WHITE);
    const left=cells.filter(cell=>['KeyA','KeyS','KeyD','KeyF','KeyG'].includes(cell.code));
    const right=cells.filter(cell=>['KeyH','KeyJ','KeyK','KeyL','Semicolon','Quote'].includes(cell.code));
    assert.equal(left.length,5);assert.equal(right.length,6);
    assert(Math.max(...left.map(cell=>cell.x))<Math.min(...right.map(cell=>cell.x)),'hands must occupy disjoint horizontal regions');
    assert.equal(await page.locator('#keyboard .key.mapped:not(.black)').count(),11);
  });
  await check('home black keys are the upper row and match the sounding semitone offsets',async()=>{
    const page=await fixture(),cells=await guide(page),base=48;
    assert.deepEqual(cells.filter(cell=>cell.black).map(cell=>cell.code),BLACK);
    for(const [offset,code]of HOME.entries()){
      const cell=cells.find(cell=>cell.code===code);assert(cell,code);assert.equal(cell.pitch,base+offset,code);
      const piano=page.locator(`#keyboard .key[data-code="${code}"]`);
      assert.equal(Number(await piano.getAttribute('data-pitch')),cell.pitch,code);
      assert.equal(await piano.evaluate(node=>node.classList.contains('black')),cell.black,code);
    }
    const row=await page.locator('#physicalLayout').evaluate(node=>{
      const cells=[...node.querySelectorAll('.pc-key')];
      return {black:cells.filter(c=>c.classList.contains('black')).map(c=>c.getBoundingClientRect().y),white:cells.filter(c=>!c.classList.contains('black')).map(c=>c.getBoundingClientRect().y)};
    });
    assert(Math.max(...row.black)<Math.min(...row.white),'black-key guide must remain above white-key guide');
  });
  await check('all eighteen real browser keys produce the displayed pitch and release cleanly',async()=>{
    const page=await fixture();await start(page);
    for(const [offset,code]of HOME.entries()){
      await page.keyboard.down(key(code));
      assert.deepEqual((await notes(page)).map(note=>note.pitch),[48+offset],code);
      const marked=await guide(page);assert(marked.find(cell=>cell.code===code)?.pressed,code+' guide press');
      await page.keyboard.up(key(code));assert.equal((await notes(page)).length,0,code+' release');
    }
  });
  await check('both hands can hold a chord and repeated keydown does not add another note',async()=>{
    const page=await fixture();await start(page);const chord=['a','d','g','h','k',';'];
    for(const code of chord)await page.keyboard.down(code);
    assert.deepEqual((await notes(page)).map(note=>note.pitch),[48,52,55,57,60,64]);
    const ids=(await notes(page)).map(note=>note.id);await page.keyboard.down('a');
    assert.deepEqual((await notes(page)).map(note=>note.id),ids);
    for(const code of chord)await page.keyboard.up(code);assert.equal((await notes(page)).length,0);
  });
  await check('held notes retain pitch and release identity through arrow octave changes',async()=>{
    const page=await fixture();await start(page);await page.keyboard.down('a');await page.keyboard.down('k');
    const before=await notes(page);await page.keyboard.press('ArrowUp');assert.equal(await page.locator('#octave').innerText(),'4');
    assert.deepEqual(await notes(page),before);await page.keyboard.up('a');await page.keyboard.up('k');assert.equal((await notes(page)).length,0);
    await page.keyboard.down('a');assert.equal((await notes(page))[0].pitch,60);await page.keyboard.up('a');
    await page.keyboard.press('ArrowDown');assert.equal(await page.locator('#octave').innerText(),'3');
    assert.equal((await guide(page)).find(cell=>cell.code==='KeyA').pitch,48);
  });
  await check('N never becomes a note and Space remains a sustain pedal',async()=>{
    const page=await fixture();await start(page);await page.keyboard.press('n');assert.equal((await notes(page)).length,0);
    await page.keyboard.down('a');await page.keyboard.down('Space');await page.keyboard.up('a');
    assert.equal((await notes(page)).length,1);assert.equal((await notes(page))[0].held,false);
    assert.equal(await page.evaluate(()=>JAM.model.sustain),true);
    await page.keyboard.up('Space');assert.equal((await notes(page)).length,0);assert.equal(await page.evaluate(()=>JAM.model.sustain),false);
  });
  await check('Quote uses one physical code and visibly explains both JIS colon and US apostrophe',async()=>{
    const page=await fixture();const label=await page.locator('#keyboard .key[data-code="Quote"] kbd').innerText();
    assert(label.includes(':')&&label.includes("'"),label);
    const cell=(await guide(page)).find(item=>item.code==='Quote');assert.equal(cell.label,label);
    await page.evaluate(()=>{window.handsKeyEvents=[];window.addEventListener('keydown',event=>window.handsKeyEvents.push({code:event.code,key:event.key}),true);});
    await start(page);await page.keyboard.down("'");assert.equal((await notes(page))[0].pitch,65);await page.keyboard.up("'");
    assert.deepEqual(await page.evaluate(()=>handsKeyEvents.filter(event=>event.code==='Quote')),[{code:'Quote',key:"'"}]);
    assert.equal((await notes(page)).length,0);
  });
  await check('octave changes update every guide pitch and label without changing key assignments',async()=>{
    const page=await fixture();await start(page);const before=await guide(page);
    await page.keyboard.press('ArrowUp');const after=await guide(page);assert.equal(after.length,18);
    for(const cell of before){const next=after.find(item=>item.code===cell.code);assert(next);assert.equal(next.pitch,cell.pitch+12);assert.equal(next.label,cell.label);}
    assert.deepEqual(await assigned(page),HOME);
  });
  await check('home18, retained 25, 36 and legacy modes switch without leaking held keys',async()=>{
    const page=await fixture();await start(page);
    for(const [mode,count,first]of [['piano',25,'KeyZ'],['expanded',36,'KeyA'],['legacy',18,'KeyA'],['home18',18,'KeyA']]){
      const heldKey=key((await assigned(page))[0]);await page.locator('#playArea').focus();await page.keyboard.down(heldKey);
      assert.equal((await notes(page)).length,1,'pre-switch held note');await page.selectOption('#keyLayout',mode);
      assert.equal((await assigned(page)).length,count);assert.equal((await assigned(page))[0],first);assert.equal((await notes(page)).length,0,mode);
      await page.keyboard.up(heldKey);assert.equal((await notes(page)).length,0);
    }
    assert.deepEqual(await assigned(page),HOME);assert(await page.locator('#physicalLayout').isVisible());
  });
  await check('reserved N and Space cannot silently replace a home note in the binding editor',async()=>{
    const page=await fixture();await page.click('#settingsToggle');const first=page.locator('#bindings button').first();
    for(const reserved of ['n','Space']){
      await first.click();await page.keyboard.press(reserved);assert.deepEqual(await assigned(page),HOME);
      assert.equal(await page.locator('#bindings .capturing').count(),1);assert(await page.locator('#error').isVisible());
    }
  });
  await check('all instrument choices retain their ranges and an exact eighteen-key home assignment',async()=>{
    const page=await fixture(),catalog=JSON.parse(fs.readFileSync(path.join(web,'catalog.json'),'utf8'));
    for(const spec of catalog.instruments){
      await page.selectOption('#instrument',spec.id);assert.deepEqual(await assigned(page),HOME,spec.id);
      const cells=await page.locator('#keyboard .key:not(:disabled)').evaluateAll(nodes=>nodes.map(node=>Number(node.dataset.pitch)));
      assert(cells.length>0&&cells.every(pitch=>pitch>=spec.min&&pitch<=spec.max),spec.id);
      if(spec.kind==='drums'){assert(await page.locator('#keyLayout').isDisabled());assert(!(await page.locator('#physicalLayout').isVisible()));}
      else{assert(!(await page.locator('#keyLayout').isDisabled()));assert.equal((await guide(page)).length,18);}
    }
  });
  await check('home guide and keyboard remain inside 390, 1366 and 1920 pixel views',async()=>{
    const page=await fixture();
    for(const [width,height]of [[390,844],[1366,768],[1920,1080]]){
      await page.setViewportSize({width,height});await page.waitForTimeout(30);
      const geometry=await page.locator('#panel').evaluate(panel=>{
        const r=panel.getBoundingClientRect(),guide=document.querySelector('#physicalLayout').getBoundingClientRect();
        const cells=[...document.querySelectorAll('#physicalLayout .pc-key')].map(cell=>{const c=cell.getBoundingClientRect();return {left:c.left,right:c.right};});
        return {left:r.left,right:r.right,bottom:r.bottom,width:innerWidth,height:innerHeight,scroll:document.documentElement.scrollWidth,guideLeft:guide.left,guideRight:guide.right,cells};
      });
      assert(geometry.left>=-.5&&geometry.right<=width+.5&&geometry.bottom<=height+.5&&geometry.scroll<=width+.5,JSON.stringify(geometry));
      assert(geometry.guideLeft>=geometry.left-.5&&geometry.guideRight<=geometry.right+.5,JSON.stringify(geometry));
      assert(geometry.cells.every(cell=>cell.left>=geometry.left-.5&&cell.right<=geometry.right+.5),'guide cells must remain inside the panel: '+JSON.stringify(geometry));
      assert(await page.locator('#keyboardViewport').isVisible());assert(await page.locator('#physicalLayout').isVisible());assert.equal((await guide(page)).length,18);
      await page.screenshot({path:path.join(evidence,`home18-${width}.png`)});
    }
  });
}finally{
  for(const page of pages)if(!page.isClosed())await page.close();await browser.close();
  const report={at:new Date().toISOString(),scope:'Isolated headless Chromium with real browser key presses and local sample decoding; no game, server, microphone or MIDI hardware. Read-only DOM/model observations; no direct note injection.',passed:results.filter(item=>item.status==='PASS').length,failed:results.filter(item=>item.status==='FAIL').length,results,pageErrors:errors,outsideOrigins:[...new Set(outside)],fiveMControls:'NOT_RUN',actualSound:'NOT_RUN',physicalJISKeyboard:'NOT_RUN',physicalRollover:'NOT_RUN',nativePTT:'NOT_RUN'};
  fs.writeFileSync(path.join(evidence,'hands-browser-results.json'),JSON.stringify(report,null,2)+'\n');
  console.log(`Hands browser: ${report.passed} PASS, ${report.failed} FAIL; report ${evidence}`);if(report.failed||errors.length||outside.length)process.exitCode=1;
}
