// Retained 25-note preset regression; fresh home18 has independent hands-browser coverage.
import {PIANO_KEYS} from '../web/model.mjs';
// Local Chromium interaction QA for JAM's keyboard layout. No FXServer or network is used.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {pathToFileURL,fileURLToPath} from 'node:url';

const resource=fileURLToPath(new URL('../',import.meta.url));
const web=path.resolve(resource,'web');
const evidence=path.resolve(process.env.JAM_KEYBOARD_REPORT_DIR||path.resolve(resource,'../../outputs/FLECITY_JAM_20261116/piano-keyboard-20261117/QA/keyboard'));
fs.mkdirSync(evidence,{recursive:true});
const configPath=path.resolve(resource,'../.flecity-dev/local.json');
const config=fs.existsSync(configPath)?JSON.parse(fs.readFileSync(configPath,'utf8').replace(/^\uFEFF/,'')):{browser:{}};
const modulePath=process.env.JAM_PLAYWRIGHT_MODULE||config.browser.module||'playwright';
const {chromium}=await import(path.isAbsolute(modulePath)?pathToFileURL(modulePath):modulePath);
const browser=await chromium.launch({channel:process.env.JAM_BROWSER_CHANNEL||config.browser.channel||'chrome',headless:true,args:['--autoplay-policy=no-user-gesture-required']});
const results=[],errors=[];
const stamp=new Date().toISOString();

async function check(name,fn) {
  const started=Date.now();
  try{await fn();results.push({name,status:'PASS',ms:Date.now()-started});console.log('PASS '+name);}
  catch(error){results.push({name,status:'FAIL',ms:Date.now()-started,error:String(error.stack||error)});console.error('FAIL '+name+': '+error.message);}
}
async function routeLocal(page,callbacks) {
  await page.route('**/*',async route=>{
    const url=new URL(route.request().url());
    if(url.origin==='https://flecity_jam'&&callbacks){
      callbacks.push({name:url.pathname.slice(1),body:route.request().postData()});
      await route.fulfill({status:200,contentType:'application/json',body:'{"ok":true}'});return;
    }
    if(url.origin!=='https://jam.test'){await route.abort();return;}
    const relative=decodeURIComponent(url.pathname).replace(/^\//,'')||'index.html';
    const file=path.resolve(web,relative);
    if(!file.startsWith(web+path.sep)||!fs.existsSync(file)){await route.fulfill({status:404,body:'Not found'});return;}
    const mime={'.html':'text/html','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.ogg':'audio/ogg','.wav':'audio/wav'};
    await route.fulfill({status:200,contentType:mime[path.extname(file)]||'application/octet-stream',body:fs.readFileSync(file)});
  });
}
async function newPreview(viewport={width:1366,height:768},seed) {
  const page=await browser.newPage({viewport});
  page.on('pageerror',error=>errors.push(error.message));
  if(seed===undefined){await page.addInitScript(keys=>{if(!localStorage.getItem('flecity-jam-v4'))localStorage.setItem('flecity-jam-v4',JSON.stringify({version:4,layout:'piano',bindings:{piano:keys}}));},PIANO_KEYS);}
  if(seed!==undefined)await page.addInitScript(value=>{
    const records=typeof value==='string'?{v1:value}:value;
    for(const [version,raw]of Object.entries(records))localStorage.setItem('flecity-jam-'+version,raw);
  },seed);
  await routeLocal(page);
  await page.goto('https://jam.test/');
  await page.waitForFunction(()=>window.JAM&&document.querySelector('#panel')&&!document.querySelector('#panel').hidden);
  return page;
}
const state=page=>page.evaluate(()=>({
  notes:[...JAM.model.notes.values()].map(note=>({pitch:note.pitch,held:note.held})),
  keys:[...JAM.model.keys.keys()],octave:JAM.model.octave,limit:JAM.model.limit,
  bindings:[...JAM.model.bindings],sustain:JAM.model.sustain,
  layout:document.querySelector('#keyLayout').value,
  mapped:[...document.querySelectorAll('#keyboard button[data-code]:not(:disabled)')].map(button=>({code:button.dataset.code,pitch:Number(button.dataset.pitch)}))
}));
async function start(page) {
  if(!await page.evaluate(()=>Boolean(JAM.session))){
    await page.click('#start');
    await page.waitForFunction(()=>window.JAM?.session||!document.querySelector('#error').hidden);
  }
  assert(await page.evaluate(()=>Boolean(JAM.session)),await page.locator('#error').innerText());
  await page.locator('#playArea').focus();
}
async function releaseAll(page,codes) {for(const code of codes)await page.keyboard.up(code);}

let page,legacyPage,nuiPage,compactPage,capturePage;
const migrationPages=[];
try {
  page=await newPreview();
  await check('retained piano preset maps 25 piano-shaped C3–C5 pitches',async()=>{
    const s=await state(page);
    assert.equal(s.layout,'piano');assert.equal(s.octave,3);assert.equal(s.bindings.length,25);
    assert.equal(s.mapped.length,25);
    assert.equal(s.mapped[0].pitch,48);assert.equal(s.mapped.at(-1).pitch,72);
    assert.deepEqual(s.bindings,['KeyZ','KeyS','KeyX','KeyD','KeyC','KeyV','KeyG','KeyB','KeyH','KeyQ','Digit2','KeyW','KeyE','Digit4','KeyR','Digit5','KeyT','KeyY','Digit7','KeyU','Digit8','KeyI','Digit9','KeyO','KeyP']);
  });
  await check('white keys use contiguous letter rows and black keys sit in the row above',async()=>{
    const s=await state(page),byCode=new Map(s.mapped.map(key=>[key.code,key.pitch]));
    const white=['KeyZ','KeyX','KeyC','KeyV','KeyB','KeyQ','KeyW','KeyE','KeyR','KeyT','KeyY','KeyU','KeyI','KeyO','KeyP'];
    assert.deepEqual(white.map(code=>byCode.get(code)),[48,50,52,53,55,57,59,60,62,64,65,67,69,71,72]);
    const black=['KeyS','KeyD','KeyG','KeyH','Digit2','Digit4','Digit5','Digit7','Digit8','Digit9'];
    assert(black.every(code=>[1,3,6,8,10].includes(byCode.get(code)%12)));
    assert(s.bindings.every(code=>/^(Key[A-Z]|Digit[0-9])$/.test(code)),'default needs no JIS punctuation');
    assert(!s.bindings.includes('KeyN'));assert(!s.bindings.includes('CapsLock'));
    for(const code of black)assert(await page.locator(`#keyboard button[data-code="${code}"]`).evaluate(node=>node.classList.contains('black')));
  });
  await check('390, 1366 and 1920 layouts stay within the viewport',async()=>{
    for(const [width,height] of [[1366,768],[390,844],[1920,1080]]){
      await page.setViewportSize({width,height});
      await page.waitForTimeout(80);
      if(width===1366)await page.click('#viewHome');
      const g=await page.evaluate(()=>{
        const panel=document.querySelector('#panel').getBoundingClientRect(),view=document.querySelector('#keyboardViewport').getBoundingClientRect();
        const visible=[...document.querySelectorAll('#keyboard button[data-code]:not(:disabled)')].filter(button=>{
          const r=button.getBoundingClientRect();return r.right>view.left&&r.left<view.right;
        }).length;
        const cells=[...document.querySelectorAll('#physicalLayout .pc-key')],labelOverflow=[],cellOverlaps=[];
        for(const [i,cell]of cells.entries()){
          const bounds=cell.getBoundingClientRect();
          for(const label of cell.querySelectorAll('kbd,small')){
            const r=label.getBoundingClientRect();
            if(r.left<bounds.left-.5||r.right>bounds.right+.5||r.top<bounds.top-.5||r.bottom>bounds.bottom+.5)labelOverflow.push(cell.dataset.code+':'+label.textContent);
          }
          for(const other of cells.slice(i+1)){
            const r=other.getBoundingClientRect();
            if(Math.min(bounds.right,r.right)-Math.max(bounds.left,r.left)>.5&&Math.min(bounds.bottom,r.bottom)-Math.max(bounds.top,r.top)>.5)cellOverlaps.push([cell.dataset.code,other.dataset.code]);
          }
        }
        return {panel:{left:panel.left,top:panel.top,right:panel.right,bottom:panel.bottom},screen:{width:innerWidth,height:innerHeight,scrollWidth:document.documentElement.scrollWidth},visible,labelOverflow,cellOverlaps};
      });
      assert(g.panel.left>=-.5&&g.panel.top>=-.5&&g.panel.right<=width+.5&&g.panel.bottom<=height+.5,JSON.stringify(g));
      assert(g.screen.scrollWidth<=width+.5,JSON.stringify(g));
      assert.deepEqual(g.labelOverflow,[],`${width}px physical key labels overflow: ${JSON.stringify(g.labelOverflow)}`);
      assert.deepEqual(g.cellOverlaps,[],`${width}px physical key cells overlap: ${JSON.stringify(g.cellOverlaps)}`);
      if(width===1366)assert(g.visible>=25,`only ${g.visible} mapped pitches are visible`);
      await page.screenshot({path:path.join(evidence,`keyboard-${width}.png`)});
    }
    await page.setViewportSize({width:1366,height:768});
  });
  await start(page);
  await check('real low white, black and upper white keys produce exact pitches',async()=>{
    const codes=['z','s','u','p'];
    for(const code of codes)await page.keyboard.down(code);
    try{assert.deepEqual((await state(page)).notes.map(note=>note.pitch),[48,49,67,72]);}
    finally{await releaseAll(page,codes);}
    assert.equal((await state(page)).notes.length,0);
  });
  await check('Z and X play notes while N remains silent and octave is unchanged',async()=>{
    const before=(await state(page)).octave;
    for(const code of ['z','x','n'])await page.keyboard.down(code);
    try{assert.deepEqual((await state(page)).notes.map(note=>note.pitch),[48,50]);assert.equal((await state(page)).octave,before);}
    finally{await releaseAll(page,['z','x','n']);}
    assert.equal((await state(page)).notes.length,0);
  });
  await check('long hold and repeated keydown do not retrigger a note',async()=>{
    await page.keyboard.down('z');
    const before=await page.evaluate(()=>[...JAM.model.notes.keys()]);
    await page.waitForTimeout(160);
    await page.keyboard.down('z');
    try{assert.deepEqual(await page.evaluate(()=>[...JAM.model.notes.keys()]),before);assert.equal((await state(page)).notes[0].pitch,48);}
    finally{await page.keyboard.up('z');}
    assert.equal((await state(page)).notes.length,0);
  });
  await check('sustain and octave shift keep existing notes until release',async()=>{
    await page.keyboard.down('Space');await page.keyboard.down('z');await page.keyboard.up('z');
    assert.equal((await state(page)).notes.length,1);assert.equal((await state(page)).notes[0].pitch,48);
    await page.keyboard.up('Space');assert.equal((await state(page)).notes.length,0);
    await page.keyboard.down('z');const before=(await state(page)).notes[0].pitch;
    await page.keyboard.press('ArrowUp');
    try{assert.equal((await state(page)).notes[0].pitch,before);assert.equal((await state(page)).octave,4);}
    finally{await page.keyboard.up('z');}
    assert.equal((await state(page)).notes.length,0);
    await page.keyboard.press('ArrowDown');assert.equal((await state(page)).octave,3);
  });
  await check('zoom during a held note changes display but not pitch or voice count',async()=>{
    await page.locator('#playArea').focus();await page.keyboard.down('z');
    const before=await state(page);
    await page.locator('#keyboardZoom').focus();await page.keyboard.press('End');
    try{
      const after=await state(page);assert.equal(after.notes.length,1);assert.equal(after.notes[0].pitch,before.notes[0].pitch);
      assert.equal(await page.locator('#keyboardZoom').inputValue(),'160');
    }finally{await page.keyboard.up('z');}
    assert.equal((await state(page)).notes.length,0);
  });
  await check('horizontal scroll reaches unassigned pitches and mouse plays one',async()=>{
    const viewport=page.locator('#keyboardViewport');
    await page.click('#viewRight');await page.waitForTimeout(250);
    const right=await viewport.evaluate(node=>({scroll:node.scrollLeft,max:node.scrollWidth-node.clientWidth}));
    assert(right.scroll>0&&right.max>0,JSON.stringify(right));
    const key=page.locator('#keyboard button[data-pitch="89"]');
    assert.equal(await key.getAttribute('data-code'),null);
    await key.scrollIntoViewIfNeeded();
    const box=await key.boundingBox();assert(box);
    await page.mouse.move(box.x+box.width/2,box.y+box.height*.76);await page.mouse.down();
    try{assert.deepEqual((await state(page)).notes.map(note=>note.pitch),[89]);}
    finally{await page.mouse.move(2,2);await page.mouse.up();}
    assert.equal((await state(page)).notes.length,0,'pointer capture must release outside the key');
    await page.click('#viewHome');await page.waitForTimeout(250);
  });
  await check('full piano range is scrollable and out-of-range keys are disabled',async()=>{
    const viewport=page.locator('#keyboardViewport'),bounds=page.locator('#keyboard');
    for(let n=0;n<5;n++)await page.click('#viewLeft');
    await page.waitForTimeout(50);
    const left=await viewport.evaluate(node=>node.scrollLeft);
    assert(left<1,`left edge not reached: ${left}`);
    const min=page.locator('#keyboard button[data-pitch="36"]');
    assert(await min.isEnabled());
    const leftVisible=await min.evaluate(node=>{
      const key=node.getBoundingClientRect(),view=document.querySelector('#keyboardViewport').getBoundingClientRect();return key.left>=view.left-1&&key.right<=view.right+1;
    });
    assert(leftVisible,'piano minimum pitch is not visible at left edge');
    for(let n=0;n<6;n++)await page.click('#viewRight');
    await page.waitForTimeout(50);
    const right=await viewport.evaluate(node=>({scroll:node.scrollLeft,max:node.scrollWidth-node.clientWidth}));
    assert(Math.abs(right.scroll-right.max)<1,`right edge not reached: ${JSON.stringify(right)}`);
    const max=page.locator('#keyboard button[data-pitch="93"]');
    assert(await max.isEnabled());
    const rightVisible=await max.evaluate(node=>{
      const key=node.getBoundingClientRect(),view=document.querySelector('#keyboardViewport').getBoundingClientRect();return key.left>=view.left-1&&key.right<=view.right+1;
    });
    assert(rightVisible,'piano maximum pitch is not visible at right edge');
    assert(await bounds.locator('button[data-pitch="94"]').isDisabled());
    await page.click('#viewHome');
  });
  await check('20 physical key holds stay within the 16 voice limit',async()=>{
    const codes=['z','s','x','d','c','v','g','b','h','q','2','w','e','4','r','5','t','y','7','u'];
    await page.locator('#playArea').focus();
    for(const code of codes)await page.keyboard.down(code);
    try{const s=await state(page);assert.equal(s.limit,16);assert.equal(s.notes.length,16);assert.equal(s.keys.length,16);}
    finally{await releaseAll(page,codes);}
    assert.equal((await state(page)).notes.length,0);
  });
  await check('switching between piano, 36 and 18 keys stops held notes',async()=>{
    await page.locator('#playArea').focus();await page.keyboard.down('z');assert.equal((await state(page)).notes.length,1);
    await page.selectOption('#keyLayout','legacy');
    await page.keyboard.up('z');
    assert.equal((await state(page)).notes.length,0);assert.equal((await state(page)).bindings.length,18);
    await page.selectOption('#keyLayout','expanded');assert.equal((await state(page)).bindings.length,36);
    await page.selectOption('#keyLayout','piano');assert.equal((await state(page)).bindings.length,25);
  });
  await check('custom 36-key assignment survives reload without changing v1 storage',async()=>{
    await page.selectOption('#keyLayout','expanded');
    const oldV1=await page.evaluate(()=>localStorage.getItem('flecity-jam-v1'));
    const oldV2=await page.evaluate(()=>localStorage.getItem('flecity-jam-v2'));
    await page.click('#settingsToggle');await page.locator('#bindings button').first().click();await page.keyboard.press('c');
    assert.equal((await state(page)).bindings[0],'KeyC');
    await page.click('#settingsToggle');await page.reload();await page.waitForFunction(()=>window.JAM);
    assert.equal((await state(page)).layout,'expanded');assert.equal((await state(page)).bindings[0],'KeyC');
    assert.equal(await page.evaluate(()=>localStorage.getItem('flecity-jam-v1')),oldV1);
    assert.equal(await page.evaluate(()=>localStorage.getItem('flecity-jam-v2')),oldV2);
    await start(page);await page.keyboard.down('c');
    try{assert.equal((await state(page)).notes[0].pitch,48);}
    finally{await page.keyboard.up('c');}
  });
  await check('drums remain eight pads with bounded playable range',async()=>{
    if(await page.evaluate(()=>Boolean(JAM.session)))await page.click('#start');
    await page.selectOption('#instrument','drums');await start(page);
    const s=await state(page);assert.equal(s.mapped.length,8);assert.equal(s.bindings.length,36);
    assert.equal(await page.locator('#keyboard .key').count(),8);
    await page.locator('#playArea').focus();await page.keyboard.down('a');
    try{assert.equal((await state(page)).notes[0].pitch,36);}
    finally{await page.keyboard.up('a');}
    assert.equal((await state(page)).notes.length,0);
  });
  await check('each pitched instrument enables only its declared min–max',async()=>{
    await page.click('#start');
    for(const id of ['piano','guitar','bass','clarinet']){
      await page.selectOption('#instrument',id);
      const result=await page.evaluate(()=>{
        const spec=JAM.model.spec;
        return {id:spec.id,min:spec.min,max:spec.max,keys:[...document.querySelectorAll('#keyboard button[data-pitch]')].map(button=>({pitch:Number(button.dataset.pitch),disabled:button.disabled}))};
      });
      assert.equal(result.id,id);
      assert(result.keys.some(key=>key.pitch===result.min&&!key.disabled),`${id}: minimum pitch disabled`);
      assert(result.keys.some(key=>key.pitch===result.max&&!key.disabled),`${id}: maximum pitch disabled`);
      assert(result.keys.every(key=>key.disabled===(key.pitch<result.min||key.pitch>result.max)),`${id}: key bounds mismatch`);
    }
  });
  await check('legacy custom 18-key v1 record is retained exactly and mode remains usable',async()=>{
    const old=['KeyA','KeyW','KeyS','KeyE','KeyD','KeyF','KeyT','KeyG','KeyY','KeyH','KeyU','KeyJ','KeyK','KeyO','KeyL','KeyP','Semicolon','KeyC'];
    const raw=JSON.stringify({keys:old,listen:.47,muted:false});
    legacyPage=await newPreview({width:1366,height:768},raw);
    assert.equal((await state(legacyPage)).layout,'legacy');assert.deepEqual((await state(legacyPage)).bindings,old);
    assert.equal(await legacyPage.evaluate(()=>localStorage.getItem('flecity-jam-v1')),raw);
    await legacyPage.selectOption('#keyLayout','expanded');await legacyPage.selectOption('#keyLayout','legacy');
    await legacyPage.reload();await legacyPage.waitForFunction(()=>window.JAM);
    assert.equal((await state(legacyPage)).layout,'legacy');assert.deepEqual((await state(legacyPage)).bindings,old);
    assert.equal(await legacyPage.evaluate(()=>localStorage.getItem('flecity-jam-v1')),raw);
    await start(legacyPage);await legacyPage.keyboard.down('c');
    try{assert.equal((await state(legacyPage)).notes[0].pitch,77);}
    finally{await legacyPage.keyboard.up('c');}
  });
  await check('v2 standard 36-key settings copy to home18 default without rewriting the old record',async()=>{
    const expanded=['KeyA','KeyS','KeyD','KeyF','KeyG','KeyH','KeyJ','KeyK','KeyL','Semicolon','Quote','Backslash','KeyQ','KeyW','KeyE','KeyR','KeyT','KeyY','KeyU','KeyI','KeyO','KeyP','BracketLeft','BracketRight','Digit1','Digit2','Digit3','Digit4','Digit5','Digit6','Digit7','Digit8','Digit9','Digit0','Minus','Equal'];
    const raw=JSON.stringify({version:2,layout:'expanded',bindings:{expanded},listen:.42,muted:false,zoom:120});
    const migrated=await newPreview({width:1366,height:768},{v2:raw});migrationPages.push(migrated);
    assert.equal((await state(migrated)).layout,'home18');assert.equal((await state(migrated)).bindings.length,18);
    assert.equal(await migrated.locator('#listenVolume').inputValue(),'42');assert.equal(await migrated.locator('#keyboardZoom').inputValue(),'120');
    await migrated.selectOption('#keyLayout','expanded');assert.deepEqual((await state(migrated)).bindings,expanded);
    assert.equal(await migrated.evaluate(()=>localStorage.getItem('flecity-jam-v2')),raw);
    const v5=await migrated.evaluate(()=>JSON.parse(localStorage.getItem('flecity-jam-v5')));assert.equal(v5.version,5);assert.equal(v5.layout,'expanded');
    await migrated.reload();await migrated.waitForFunction(()=>window.JAM);
    assert.equal((await state(migrated)).layout,'expanded');assert.deepEqual((await state(migrated)).bindings,expanded);
    assert.equal(await migrated.evaluate(()=>localStorage.getItem('flecity-jam-v2')),raw);
  });
  await check('v2 standard selection takes precedence over v1 custom mode while preserving both records',async()=>{
    const legacy=['KeyA','KeyW','KeyS','KeyE','KeyD','KeyF','KeyT','KeyG','KeyY','KeyH','KeyU','KeyJ','KeyK','KeyO','KeyL','KeyP','Semicolon','KeyC'];
    const expanded=['KeyA','KeyS','KeyD','KeyF','KeyG','KeyH','KeyJ','KeyK','KeyL','Semicolon','Quote','Backslash','KeyQ','KeyW','KeyE','KeyR','KeyT','KeyY','KeyU','KeyI','KeyO','KeyP','BracketLeft','BracketRight','Digit1','Digit2','Digit3','Digit4','Digit5','Digit6','Digit7','Digit8','Digit9','Digit0','Minus','Equal'];
    const raw1=JSON.stringify({keys:legacy,listen:.31,muted:false});
    const raw2=JSON.stringify({version:2,layout:'expanded',bindings:{expanded},listen:.58,muted:false,zoom:100});
    const migrated=await newPreview({width:1366,height:768},{v1:raw1,v2:raw2});migrationPages.push(migrated);
    assert.equal((await state(migrated)).layout,'home18');assert.equal(await migrated.locator('#listenVolume').inputValue(),'58');
    await migrated.selectOption('#keyLayout','legacy');assert.deepEqual((await state(migrated)).bindings,legacy);
    assert.equal(await migrated.evaluate(()=>localStorage.getItem('flecity-jam-v1')),raw1);
    assert.equal(await migrated.evaluate(()=>localStorage.getItem('flecity-jam-v2')),raw2);
  });
  await check('v2 custom 36-key selection and all original bytes survive piano switching and reload',async()=>{
    const expanded=['KeyC','KeyS','KeyD','KeyF','KeyG','KeyH','KeyJ','KeyK','KeyL','Semicolon','Quote','Backslash','KeyQ','KeyW','KeyE','KeyR','KeyT','KeyY','KeyU','KeyI','KeyO','KeyP','BracketLeft','BracketRight','Digit1','Digit2','Digit3','Digit4','Digit5','Digit6','Digit7','Digit8','Digit9','Digit0','Minus','Equal'];
    const raw=JSON.stringify({version:2,layout:'expanded',bindings:{expanded},listen:.51,muted:false,zoom:100});
    const migrated=await newPreview({width:1366,height:768},{v2:raw});migrationPages.push(migrated);
    assert.equal((await state(migrated)).layout,'expanded');assert.deepEqual((await state(migrated)).bindings,expanded);
    await migrated.selectOption('#keyLayout','piano');await migrated.selectOption('#keyLayout','expanded');
    await migrated.reload();await migrated.waitForFunction(()=>window.JAM);
    assert.equal((await state(migrated)).layout,'expanded');assert.deepEqual((await state(migrated)).bindings,expanded);
    assert.equal(await migrated.evaluate(()=>localStorage.getItem('flecity-jam-v2')),raw);
    await start(migrated);await migrated.keyboard.down('c');
    try{assert.equal((await state(migrated)).notes[0].pitch,48);}finally{await migrated.keyboard.up('c');}
  });
  await check('custom piano binding survives all preset switches and reload independently',async()=>{
    const custom=await newPreview();migrationPages.push(custom);
    await custom.click('#settingsToggle');await custom.locator('#bindings button').first().click();await custom.keyboard.press('a');
    assert.equal((await state(custom)).bindings[0],'KeyA');await custom.click('#settingsToggle');
    await custom.selectOption('#keyLayout','legacy');assert.equal((await state(custom)).bindings[0],'KeyA');
    await custom.selectOption('#keyLayout','expanded');assert.equal((await state(custom)).bindings[0],'KeyA');
    await custom.selectOption('#keyLayout','piano');assert.equal((await state(custom)).bindings[0],'KeyA');
    await custom.reload();await custom.waitForFunction(()=>window.JAM);assert.equal((await state(custom)).bindings[0],'KeyA');
    await start(custom);await custom.keyboard.down('a');
    try{assert.deepEqual((await state(custom)).notes.map(note=>note.pitch),[48]);}finally{await custom.keyboard.up('a');}
    await custom.keyboard.press('z');assert.equal((await state(custom)).notes.length,0);
  });
  await check('arrow and octave buttons keep settings note names in sync with the playable octave',async()=>{
    const settingsPage=await newPreview();migrationPages.push(settingsPage);
    await start(settingsPage);await settingsPage.click('#settingsToggle');
    const first=settingsPage.locator('#bindings button').first();
    assert.match(await first.innerText(),/^C3/);
    await settingsPage.locator('#playArea').focus();await settingsPage.keyboard.press('ArrowUp');
    assert.equal((await state(settingsPage)).octave,4);assert.match(await first.innerText(),/^C4/);
    await settingsPage.click('#octDown');assert.equal((await state(settingsPage)).octave,3);assert.match(await first.innerText(),/^C3/);
    await settingsPage.click('#octUp');assert.equal((await state(settingsPage)).octave,4);assert.match(await first.innerText(),/^C4/);
    await settingsPage.locator('#playArea').focus();await settingsPage.keyboard.press('ArrowDown');
    assert.equal((await state(settingsPage)).octave,3);assert.match(await first.innerText(),/^C3/);
  });
  await check('settings opened from compact view expands panel and remains visible',async()=>{
    compactPage=await newPreview();
    await compactPage.click('#compact');
    assert(await compactPage.locator('#panel').evaluate(node=>node.classList.contains('compact')));
    await compactPage.click('#settingsToggle');
    assert.equal(await compactPage.locator('#settingsToggle').getAttribute('aria-expanded'),'true');
    assert(await compactPage.locator('#settings').isVisible());
    assert.equal(await compactPage.locator('#panel').evaluate(node=>node.classList.contains('compact')),false);
    assert.equal(await compactPage.locator('#compact').getAttribute('aria-expanded'),'true');
  });
  await check('one Escape closes JAM even from settings or key capture',async()=>{
    await start(compactPage);
    await compactPage.keyboard.press('Escape');
    assert(await compactPage.locator('#panel').isHidden());
    assert.equal(await compactPage.evaluate(()=>Boolean(JAM.session)),false);
    assert.equal((await state(compactPage)).notes.length,0);

    capturePage=await newPreview();
    await start(capturePage);
    await capturePage.click('#settingsToggle');
    await capturePage.locator('#bindings button').first().click();
    assert(await capturePage.locator('#bindings button').first().evaluate(node=>node.classList.contains('capturing')));
    await capturePage.keyboard.press('Escape');
    assert(await capturePage.locator('#panel').isHidden());
    assert.equal(await capturePage.evaluate(()=>Boolean(JAM.session)),false);
    assert.equal((await state(capturePage)).notes.length,0);
  });
  await check('mock NUI open then simulated blur hides panel and calls close',async()=>{
    const callbacks=[];
    nuiPage=await browser.newPage({viewport:{width:1366,height:768}});
    nuiPage.on('pageerror',error=>errors.push(error.message));
    await nuiPage.addInitScript(()=>{window.GetParentResourceName=()=> 'flecity_jam';});
    await routeLocal(nuiPage,callbacks);
    await nuiPage.goto('https://jam.test/');
    await nuiPage.evaluate(()=>window.dispatchEvent(new MessageEvent('message',{data:{type:'open',instrument:'piano'}})));
    await nuiPage.locator('#panel').waitFor({state:'visible'});
    await nuiPage.evaluate(()=>window.dispatchEvent(new Event('blur')));
    await nuiPage.waitForFunction(()=>document.querySelector('#panel').hidden);
    await nuiPage.waitForTimeout(50);
    assert(callbacks.some(item=>item.name==='close'),JSON.stringify(callbacks.map(item=>item.name)));
  });
}finally{
  for(const target of [page,legacyPage,nuiPage,compactPage,capturePage,...migrationPages])if(target)await target.close().catch(()=>{});
  await browser.close();
  const summary={at:stamp,environment:'local Chromium; files fulfilled in-process; no FXServer, FiveM or external network',
    note:'Only keyboard and pointer actions create notes. The NUI focus case dispatches a simulated blur and mocks the close callback; it does not prove game input or actual Alt+Tab.',
    passed:results.filter(item=>item.status==='PASS').length,failed:results.filter(item=>item.status==='FAIL').length,results,pageErrors:errors};
  fs.writeFileSync(path.join(evidence,'keyboard-browser-results.json'),JSON.stringify(summary,null,2)+'\n');
  console.log(`Keyboard browser: ${summary.passed} PASS, ${summary.failed} FAIL; report ${evidence}`);
  if(summary.failed||errors.length)process.exitCode=1;
}
