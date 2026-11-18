// Synthetic preference migration in an isolated browser. No FiveM or user profile is accessed.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';

const resource=fileURLToPath(new URL('../',import.meta.url)),web=path.join(resource,'web');
const evidence=path.resolve(process.env.JAM_HANDS_REPORT_DIR||path.join(resource,'../.flecity-dev/jam/hands-migration-browser'));
fs.mkdirSync(evidence,{recursive:true});
const modulePath=process.env.JAM_PLAYWRIGHT_MODULE||'C:/Users/suivx/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
const {chromium}=await import(path.isAbsolute(modulePath)?pathToFileURL(modulePath):modulePath);
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--autoplay-policy=no-user-gesture-required']});
// These release-0.4.2 arrays are pinned independently of the implementation constants.
const legacy=['KeyA','KeyW','KeyS','KeyE','KeyD','KeyF','KeyT','KeyG','KeyY','KeyH','KeyU','KeyJ','KeyK','KeyO','KeyL','KeyP','Semicolon','Quote'];
const piano=['KeyZ','KeyS','KeyX','KeyD','KeyC','KeyV','KeyG','KeyB','KeyH','KeyQ','Digit2','KeyW','KeyE','Digit4','KeyR','Digit5','KeyT','KeyY','Digit7','KeyU','Digit8','KeyI','Digit9','KeyO','KeyP'];
const expanded=['KeyA','KeyS','KeyD','KeyF','KeyG','KeyH','KeyJ','KeyK','KeyL','Semicolon','Quote','Backslash','KeyQ','KeyW','KeyE','KeyR','KeyT','KeyY','KeyU','KeyI','KeyO','KeyP','BracketLeft','BracketRight','Digit1','Digit2','Digit3','Digit4','Digit5','Digit6','Digit7','Digit8','Digit9','Digit0','Minus','Equal'];
const drums=['KeyA','KeyS','KeyD','KeyF','KeyG','KeyH','KeyJ','KeyK'];
const custom={legacy:['KeyZ',...legacy.slice(1)],piano:['KeyA',...piano.slice(1)],expanded:['KeyC',...expanded.slice(1)]};
const customHome=['KeyC',...legacy.slice(1)],customDrums=['KeyZ','KeyX','KeyC','KeyV','KeyB','KeyM','Comma','Period'];
const results=[],errors=[],pages=[];
async function check(name,fn){
  try{await fn();results.push({name,status:'PASS'});console.log('PASS '+name);}
  catch(error){results.push({name,status:'FAIL',error:String(error.stack||error)});console.error('FAIL '+name+': '+error.message);}
}
async function fixture(records={},failSave=false){
  const page=await browser.newPage({viewport:{width:1366,height:768}});pages.push(page);page.on('pageerror',error=>errors.push(error.message));
  await page.addInitScript(({records,failSave})=>{
    // Seed once per tab, so reloading cannot conceal an application deleting old data.
    if(!sessionStorage.getItem('jam-hands-fixture-seeded')){
      for(const [version,raw]of Object.entries(records))localStorage.setItem('flecity-jam-'+version,raw);
      sessionStorage.setItem('jam-hands-fixture-seeded','yes');
    }
    if(failSave){
      const set=Storage.prototype.setItem;
      Storage.prototype.setItem=function(key,value){if(this===localStorage&&key==='flecity-jam-v5')throw new DOMException('isolated fixture quota','QuotaExceededError');return set.call(this,key,value);};
    }
  },{records,failSave});
  await page.route('**/*',async route=>{
    const url=new URL(route.request().url());assert.equal(url.origin,'https://jam.test','fixture must stay offline');
    const file=path.resolve(web,decodeURIComponent(url.pathname).replace(/^\//,'')||'index.html');assert(file.startsWith(web+path.sep));
    const mime={'.html':'text/html','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.ogg':'audio/ogg','.wav':'audio/wav'};
    await route.fulfill({status:200,contentType:mime[path.extname(file)]||'application/octet-stream',body:fs.readFileSync(file)});
  });
  await page.goto('https://jam.test/');await page.waitForFunction(()=>window.JAM);return page;
}
const protectedOld=records=>Object.fromEntries(['v1','v2','v3','v4'].map(version=>[version,records[version]??null]));
const rawOld=page=>page.evaluate(()=>Object.fromEntries(['v1','v2','v3','v4'].map(version=>[version,localStorage.getItem('flecity-jam-'+version)])));
const saved=page=>page.evaluate(()=>JSON.parse(localStorage.getItem('flecity-jam-v5')));
const current=page=>page.evaluate(()=>({layout:document.querySelector('#keyLayout').value,keys:[...JAM.model.bindings]}));
const drumKeys=page=>page.evaluate(()=>[...JAM.model.drumBindings]);
async function reload(page){await page.reload();await page.waitForFunction(()=>window.JAM);}
function originals(){
  return {v1:JSON.stringify({keys:custom.legacy,listen:.21,muted:true},null,2),v2:JSON.stringify({version:2,layout:'expanded',bindings:{legacy:custom.legacy,expanded:custom.expanded},listen:.32,muted:true,zoom:80},null,2)};
}
const v3Stock=()=>JSON.stringify({version:3,layout:'piano',bindings:{piano,legacy:custom.legacy,expanded:custom.expanded},listen:.43,muted:false,zoom:140,velocity:67,performVolume:42,showGuide:false},null,2);

try{
  await check('fresh profile uses independent home18 while all older preset arrays remain available',async()=>{
    const page=await fixture();assert.deepEqual(await current(page),{layout:'home18',keys:legacy});
    const record=await saved(page);assert.equal(record.version,5);
    assert.deepEqual(record.bindings,{home18:legacy,piano,legacy,expanded,drums});
    const options=await page.locator('#keyLayout option').evaluateAll(items=>items.map(item=>item.value));
    assert.equal(new Set(options).size,4);for(const mode of ['home18','piano','legacy','expanded'])assert(options.includes(mode));
    assert.deepEqual(await rawOld(page),protectedOld({}));
    await page.screenshot({path:path.join(evidence,'fresh-home18.png')});
  });
  await check('stock v3 piano copies to home18 with every old raw record, slot and scalar retained',async()=>{
    const records={...originals(),v3:v3Stock()},page=await fixture(records);
    assert.deepEqual(await current(page),{layout:'home18',keys:legacy});assert.deepEqual(await rawOld(page),protectedOld(records));
    const record=await saved(page);assert.equal(record.version,5);
    assert.deepEqual(record.bindings,{home18:legacy,piano,legacy:custom.legacy,expanded:custom.expanded,drums});
    for(const [name,value]of Object.entries({listen:.43,muted:false,zoom:140,velocity:67,performVolume:42,showGuide:false}))assert.equal(record[name],value,name);
    assert.equal(await page.locator('#listenVolume').inputValue(),'43');assert.equal(await page.locator('#keyboardZoom').inputValue(),'140');
    assert.equal(await page.locator('#velocity').inputValue(),'67');assert.equal(await page.locator('#performVolume').inputValue(),'42');
    assert.equal(await page.locator('#mute').getAttribute('aria-pressed'),'false');assert.equal(await page.locator('#guideToggle').getAttribute('aria-expanded'),'false');
    for(const mode of ['legacy','expanded','piano']){await page.selectOption('#keyLayout',mode);assert.deepEqual((await current(page)).keys,mode==='piano'?piano:custom[mode]);}
    await reload(page);assert.equal((await current(page)).layout,'piano','explicitly selecting old stock piano must not be migrated a second time');
    assert.deepEqual(await rawOld(page),protectedOld(records));
  });
  for(const mode of ['piano','legacy','expanded'])await check(`custom v3 ${mode} selection remains playable and independent of home18`,async()=>{
    const records={...originals(),v3:JSON.stringify({version:3,layout:mode,bindings:custom,listen:.51,velocity:73,performVolume:38},null,2)},page=await fixture(records);
    assert.deepEqual(await current(page),{layout:mode,keys:custom[mode]});
    await page.selectOption('#keyLayout','home18');assert.deepEqual((await current(page)).keys,legacy);
    await page.selectOption('#keyLayout',mode);await reload(page);assert.deepEqual(await current(page),{layout:mode,keys:custom[mode]});
    assert.deepEqual(await rawOld(page),protectedOld(records));const record=await saved(page);assert.deepEqual(record.bindings[mode],custom[mode]);assert.deepEqual(record.bindings.home18,legacy);assert.deepEqual(record.bindings.drums,drums);
    await page.click('#start');await page.waitForFunction(()=>Boolean(JAM.session));
    const pitch=await page.evaluate(()=>(JAM.model.octave+1)*12),code=custom[mode][0];await page.keyboard.down(code);
    try{assert.deepEqual(await page.evaluate(()=>[...JAM.model.notes.values()].map(note=>({pitch:note.pitch,velocity:note.velocity}))),[{pitch,velocity:73}]);}
    finally{await page.keyboard.up(code);}
    assert.equal(await page.evaluate(()=>JAM.model.notes.size),0);
  });
  await check('valid v4 old-piano choice is copied unchanged to v5 and remains selected on reload',async()=>{
    const records={...originals(),v3:v3Stock(),v4:JSON.stringify({version:4,layout:'piano',bindings:{home18:legacy,piano,legacy:custom.legacy,expanded:custom.expanded},listen:.19,muted:true,zoom:90,velocity:114,performVolume:24,showGuide:true})};
    const page=await fixture(records);assert.deepEqual(await current(page),{layout:'piano',keys:piano});
    await page.selectOption('#keyLayout','home18');await page.selectOption('#keyLayout','piano');
    await reload(page);await reload(page);assert.deepEqual(await current(page),{layout:'piano',keys:piano});
    const record=await saved(page);for(const [name,value]of Object.entries({listen:.19,muted:true,zoom:90,velocity:114,performVolume:24,showGuide:true}))assert.equal(record[name],value,name);
    assert.equal(record.version,5);assert.deepEqual(record.bindings.drums,drums);
    assert.deepEqual(await rawOld(page),protectedOld(records));
  });
  await check('every valid v4 selection copies all four custom slots and scalar values without rewriting v4',async()=>{
    const slots={home18:customHome,...custom},scalars={listen:.17,muted:true,zoom:110,velocity:81,performVolume:29,showGuide:false};
    for(const layout of ['home18','piano','legacy','expanded']){
      const records={...originals(),v3:v3Stock(),v4:JSON.stringify({version:4,layout,bindings:slots,...scalars},null,2)},page=await fixture(records);
      assert.deepEqual(await current(page),{layout,keys:slots[layout]});
      const record=await saved(page);assert.equal(record.version,5);assert.deepEqual(record.bindings,{...slots,drums});
      for(const [name,value]of Object.entries(scalars))assert.equal(record[name],value,layout+':'+name);
      await page.selectOption('#keyLayout',layout==='home18'?'piano':'home18');await page.selectOption('#keyLayout',layout);
      await reload(page);assert.deepEqual(await current(page),{layout,keys:slots[layout]});assert.deepEqual(await rawOld(page),protectedOld(records));
      await page.close();
    }
  });
  await check('valid v5 wins over all old preferences and preserves five independent slots including real drum-key input',async()=>{
    const slots={home18:customHome,...custom,drums:customDrums},scalars={listen:.62,muted:false,zoom:150,velocity:117,performVolume:53,showGuide:true};
    const records={...originals(),v3:v3Stock(),v4:JSON.stringify({version:4,layout:'piano',bindings:{home18:legacy,piano,legacy,expanded},listen:.11,velocity:33}),v5:JSON.stringify({version:5,layout:'expanded',bindings:slots,...scalars},null,2)};
    const page=await fixture(records);assert.deepEqual(await current(page),{layout:'expanded',keys:custom.expanded});
    let record=await saved(page);assert.equal(record.version,5);assert.deepEqual(record.bindings,slots);
    for(const [name,value]of Object.entries(scalars))assert.equal(record[name],value,name);
    for(const layout of ['home18','piano','legacy','expanded']){await page.selectOption('#keyLayout',layout);assert.deepEqual(await current(page),{layout,keys:slots[layout]});}
    await page.selectOption('#instrument','drums');assert.deepEqual(await drumKeys(page),customDrums);
    await page.click('#start');await page.waitForFunction(()=>Boolean(JAM.session));await page.locator('#playArea').focus();
    await page.keyboard.down('z');assert.deepEqual(await page.evaluate(()=>[...JAM.model.notes.values()].map(note=>({pitch:note.pitch,velocity:note.velocity}))),[{pitch:36,velocity:117}]);
    await page.keyboard.up('z');assert.equal(await page.evaluate(()=>JAM.model.notes.size),0);
    await page.screenshot({path:path.join(evidence,'v5-custom-drums.png')});
    await page.click('#start');await page.waitForFunction(()=>!JAM.session);
    await page.selectOption('#instrument','piano');assert.deepEqual(await current(page),{layout:'expanded',keys:custom.expanded});
    await reload(page);record=await saved(page);assert.deepEqual(record.bindings,slots);assert.deepEqual(await rawOld(page),protectedOld(records));
    await page.selectOption('#instrument','drums');assert.deepEqual(await drumKeys(page),customDrums);
  });
  await check('a valid drum slot present in v4 copies to v5 without rewriting the original v4 bytes',async()=>{
    const records={...originals(),v3:v3Stock(),v4:JSON.stringify({version:4,layout:'home18',bindings:{home18:customHome,...custom,drums:customDrums}},null,2)},page=await fixture(records);
    assert.deepEqual(await current(page),{layout:'home18',keys:customHome});assert.deepEqual((await saved(page)).bindings.drums,customDrums);
    await page.selectOption('#instrument','drums');assert.deepEqual(await drumKeys(page),customDrums);
    await reload(page);assert.deepEqual((await saved(page)).bindings.drums,customDrums);assert.deepEqual(await rawOld(page),protectedOld(records));
  });
  await check('missing or unsafe v5 drum slots fall back to eight default keys without changing melodic slots',async()=>{
    const invalid=[undefined,null,drums.slice(0,7),['KeyA',...drums.slice(0,7)],['KeyN',...drums.slice(1)],['Space',...drums.slice(1)],['bad-code',...drums.slice(1)]];
    for(const drumSlot of invalid){
      const slots={home18:customHome,...custom},records={...originals(),v3:v3Stock(),v4:JSON.stringify({version:4,layout:'piano',bindings:{home18:legacy,piano,legacy,expanded}}),v5:JSON.stringify({version:5,layout:'home18',bindings:{...slots,drums:drumSlot}})};
      const page=await fixture(records);assert.deepEqual(await current(page),{layout:'home18',keys:customHome});
      const record=await saved(page);assert.deepEqual(record.bindings,{...slots,drums});assert.deepEqual(await rawOld(page),protectedOld(records));
      await page.selectOption('#instrument','drums');assert.deepEqual(await drumKeys(page),drums);await page.close();
    }
  });
  await check('malformed or unsafe v5 falls back to valid v4 without changing any v1-v4 bytes',async()=>{
    const protectedRecords={...originals(),v3:v3Stock(),v4:JSON.stringify({version:4,layout:'legacy',bindings:{home18:customHome,...custom},listen:.35,velocity:69,performVolume:41},null,2)};
    const unsafe=[...legacy];unsafe[0]='KeyN';
    for(const v5 of ['{','null','[]','"invalid"',JSON.stringify({version:5,layout:'home18',bindings:{home18:unsafe},listen:null,velocity:0,performVolume:200})]){
      const page=await fixture({...protectedRecords,v5});assert.deepEqual(await current(page),{layout:'legacy',keys:custom.legacy});
      const record=await saved(page);assert.equal(record.version,5);assert.equal(record.listen,.35);assert.equal(record.velocity,69);assert.equal(record.performVolume,41);
      assert.deepEqual(record.bindings.drums,drums);assert.deepEqual(await rawOld(page),protectedOld(protectedRecords));await page.close();
    }
  });
  await check('customizing and resetting home18 never modifies any old custom preset slot',async()=>{
    const records={...originals(),v3:JSON.stringify({version:3,layout:'expanded',bindings:custom},null,2)},page=await fixture(records);
    await page.selectOption('#keyLayout','home18');await page.click('#settingsToggle');
    await page.locator('#bindings button').first().click();await page.keyboard.press('c');assert.equal((await current(page)).keys[0],'KeyC');
    for(const mode of ['piano','legacy','expanded']){await page.selectOption('#keyLayout',mode);assert.deepEqual((await current(page)).keys,custom[mode]);}
    await page.selectOption('#keyLayout','home18');assert.equal((await current(page)).keys[0],'KeyC');await page.click('#resetKeys');assert.deepEqual((await current(page)).keys,legacy);
    await reload(page);const record=await saved(page);assert.deepEqual(record.bindings,{home18:legacy,...custom,drums});assert.deepEqual(await rawOld(page),protectedOld(records));
  });
  await check('malformed or unsafe v4 records fall back to valid v3 without altering protected old records',async()=>{
    const protectedRecords={...originals(),v3:JSON.stringify({version:3,layout:'piano',bindings:custom,listen:.36,velocity:68,performVolume:44})};
    const unsafe=[...legacy];unsafe[0]='KeyN';
    for(const v4 of ['{','null','[]','"invalid"',JSON.stringify({version:4,layout:'home18',bindings:{home18:unsafe},listen:null,velocity:0,performVolume:200,showGuide:'false'})]){
      const page=await fixture({...protectedRecords,v4});assert.deepEqual(await current(page),{layout:'piano',keys:custom.piano});
      assert.deepEqual(await rawOld(page),protectedOld({...protectedRecords,v4}));const record=await saved(page);assert.equal(record.version,5);assert.equal(record.velocity,68);assert.equal(record.performVolume,44);assert.equal(record.listen,.36);assert.deepEqual(record.bindings.drums,drums);
      await page.close();
    }
  });
  await check('v5 storage failure preserves v1 through v4 raw records and reports unsaved changes',async()=>{
    const records={...originals(),v3:v3Stock(),v4:JSON.stringify({version:4,layout:'piano',bindings:{home18:customHome,...custom,piano},listen:.27},null,2)},page=await fixture(records,true);
    assert.equal((await current(page)).layout,'piano');assert.deepEqual(await rawOld(page),protectedOld(records));assert.equal(await page.evaluate(()=>localStorage.getItem('flecity-jam-v5')),null);
    await page.click('#guideToggle');assert.match(await page.locator('#notice').innerText(),/保存できません/);assert(await page.locator('#notice').isVisible());
    assert.deepEqual(await rawOld(page),protectedOld(records));assert.equal(await page.evaluate(()=>localStorage.getItem('flecity-jam-v5')),null);
    await reload(page);assert.equal((await current(page)).layout,'piano');assert.deepEqual(await rawOld(page),protectedOld(records));
  });
}finally{
  for(const page of pages)if(!page.isClosed())await page.close().catch(()=>{});await browser.close();
  const report={at:new Date().toISOString(),scope:'Isolated headless Chromium with synthetic v1-v5 records. Real browser keys, clicks and reloads; no FiveM, actual user settings, microphone, hardware MIDI or external server. v1-v4 raw records are preserved; only v5 is written.',passed:results.filter(result=>result.status==='PASS').length,failed:results.filter(result=>result.status==='FAIL').length,results,pageErrors:errors,liveHandsComfort:'NOT_RUN',actualSound:'NOT_RUN',physicalJISKeyboard:'NOT_RUN'};
  fs.writeFileSync(path.join(evidence,'hands-migration-browser-results.json'),JSON.stringify(report,null,2)+'\n');
  console.log(`Hands migration browser: ${report.passed} PASS, ${report.failed} FAIL; report ${evidence}`);if(report.failed||errors.length)process.exitCode=1;
}
