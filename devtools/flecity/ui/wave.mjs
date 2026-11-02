import assert from 'node:assert/strict';
import {captureLayout,saveLayout} from './layout-audit.mjs';

export async function prepare(ctx,page){
 await page.context().addInitScript(()=>{
  globalThis.__waveCalls=[];
  if(new URLSearchParams(location.search).get('surface')==='expanded'){
   globalThis.GetParentResourceName=()=> 'wave';
   const nativeFetch=globalThis.fetch.bind(globalThis);
   globalThis.fetch=(url,options)=>String(url).startsWith('https://wave/wave:callback')
    ?Promise.resolve({json:async()=>globalThis.fetchNui('wave:callback',JSON.parse(options.body))})
    :nativeFetch(url,options);
  }
  globalThis.fetchNui=async(event,request)=>{
   if(event!=='wave:callback')throw Error('Unexpected event');
   __waveCalls.push(request.action);
   if(request.action==='waveScreenOpen'){globalThis.__waveScreenState=request.payload.state;return {ok:true,lease:'fixture-wave-1'};}
   if(request.action==='waveScreenClose'){globalThis.__waveScreenState=request.payload.state;return {ok:true};}
   if(request.action==='waveScreenClaim')return globalThis.__waveReturnState?{ok:true,state:globalThis.__waveReturnState,lease:'fixture-wave-1'}:{ok:true,parked:!!globalThis.__waveScreenState};
   if(request.action==='waveScreenReady'||request.action==='waveScreenReturned'||request.action==='waveScreenFailed')return {ok:true};
   const base={ok:true,tracks:[],projects:[],playlists:[],albums:[],artists:[]};
   if(request.action==='bootstrap')return {...base,home:[],homeSections:{newest:[],trending:[]},config:{economy:{defaultTrackPrice:5000},subscription:{enabled:false},limits:{maxBars:128}},artist:null,wallet:{},canAdmin:false};
   if(request.action==='listHome')return {...base,sections:{newest:[],trending:[]}};
   return base;
  };
 });
}

export async function scenario(ctx,page){
 await page.waitForFunction(()=>document.querySelector('#status')?.textContent!=='WAVEを起動しています…');
 const layouts=[];
 for(const [width,height] of [[390,844],[1366,768],[1920,1080],[2560,1440]]){
  await page.setViewportSize({width,height});
  if(width===390){
   const toggleTop=await page.locator('#waveScreenToggle').evaluate(el=>el.getBoundingClientRect().top);
   assert(toggleTop>=56,`WAVE expansion button intersects LB Phone status strip: ${toggleTop}px`);
  }
  for(const view of ['home','search','library','studio','profile']){
   await page.locator(`.bottom-nav button[data-view="${view}"]`).click();
   assert(await page.locator('#view-'+view).isVisible(),view+' did not open');
   if(view==='search'){
    await page.locator('#searchInput').fill('検証');
    assert(await page.locator('#searchInput').evaluate(el=>document.activeElement===el));
    await page.locator('#searchButton').click();
   }
   if(view==='studio'){
    await page.locator('#projectTitleInput').fill('大画面の検証');
    assert(await page.locator('#projectTitleInput').evaluate(el=>document.activeElement===el));
   }
   layouts.push({view,...await captureLayout(ctx,page,`wave-${view}-${width}`)});
  }
 }
 saveLayout(ctx,'wave-layout',layouts);
 assert(layouts.every(r=>!r.horizontalOverflow&&!r.textClipping.length),'WAVE viewport overflow or cut button text: wave-layout.json');
 assert((await page.evaluate(()=>__waveCalls)).includes('bootstrap'));
 await page.setViewportSize({width:390,height:844});
 await page.locator('.bottom-nav button[data-view="studio"]').click();
 await page.locator('#projectTitleInput').fill('切替中の制作データ');
 await page.locator('#pianoGrid .step-cell').first().click();
 await page.locator('#bpmInput').fill('138');
 await page.locator('#bpmInput').dispatchEvent('change');
 await page.locator('#waveScreenToggle').click();
 assert(await page.evaluate(()=>WaveScreen.parked),'Phone surface stayed writable after expansion');
 const saved=await page.evaluate(()=>globalThis.__waveScreenState);
 assert(saved?.project,'WAVE project was not transferred');
 const expanded=await page.context().newPage();
 try{
  await expanded.goto(new URL('index.html?surface=expanded&lease=fixture-wave-1',page.url()).href,{waitUntil:'load'});
  await expanded.evaluate(value=>window.postMessage({type:'waveScreenImport',lease:'fixture-wave-1',state:value},location.origin),saved);
  await expanded.waitForFunction(()=>window.WaveScreen?.parked===false);
  assert(await expanded.locator('#view-studio').isVisible());
  assert.equal(await expanded.locator('#projectTitleInput').inputValue(),'切替中の制作データ');
  assert.equal(await expanded.locator('#bpmInput').inputValue(),'138');
  assert(await expanded.locator('#pianoGrid .step-cell.on').count()>0,'Edited note was lost on expansion');
  await expanded.locator('#playProject').click();
  await expanded.locator('#stopProject').click();
  const expandedLayouts=[];
  for(const [width,height] of [[1366,768],[1920,1080],[2560,1440],[390,844]]){
   await expanded.setViewportSize({width,height});
   for(const view of ['home','search','library','studio','profile']){
    await expanded.locator(`.bottom-nav button[data-view="${view}"]`).click();
    assert(await expanded.locator('#view-'+view).isVisible());
    expandedLayouts.push({view,...await captureLayout(ctx,expanded,`wave-expanded-${view}-${width}`)});
   }
  }
  saveLayout(ctx,'wave-expanded-layout',expandedLayouts);
  assert(expandedLayouts.every(r=>!r.horizontalOverflow&&!r.textClipping.length&&(r.viewport.width<900||!r.overlaps.length)),'WAVE expanded geometry requires review');
  await expanded.locator('.bottom-nav button[data-view="studio"]').click();
  await expanded.locator('#waveScreenToggle').click();
  const returned=await expanded.evaluate(()=>globalThis.__waveScreenState);
  assert(returned?.project,'Expanded WAVE project was not returned');
  await page.evaluate(value=>{globalThis.__waveReturnState=value;window.postMessage({type:'waveScreenReturn'},location.origin);},returned);
  await page.waitForFunction(()=>WaveScreen.parked===false);
  assert.equal(await page.locator('#projectTitleInput').inputValue(),'切替中の制作データ');
  assert.equal(await page.locator('#bpmInput').inputValue(),'138');
  assert(await page.locator('#pianoGrid .step-cell.on').count()>0,'Edited note was lost on phone return');
 }finally{await expanded.close();}
 await page.locator('.bottom-nav button[data-view="library"]').click();
 await page.locator('#waveScreenToggle').click();
 const libraryState=await page.evaluate(()=>globalThis.__waveScreenState);
 const expandedLibrary=await page.context().newPage();
 let libraryReturn;
 try{
  await expandedLibrary.goto(new URL('index.html?surface=expanded&lease=fixture-wave-1',page.url()).href,{waitUntil:'load'});
  await expandedLibrary.evaluate(value=>window.postMessage({type:'waveScreenImport',lease:'fixture-wave-1',state:value},location.origin),libraryState);
  await expandedLibrary.waitForFunction(()=>WaveScreen.parked===false);
  assert(await expandedLibrary.locator('#view-library').isVisible(),'Library did not transfer to Library');
  await expandedLibrary.locator('#waveScreenToggle').click();
  libraryReturn=await expandedLibrary.evaluate(()=>globalThis.__waveScreenState);
  await page.evaluate(value=>{globalThis.__waveReturnState=value;window.postMessage({type:'waveScreenReturn'},location.origin);},libraryReturn);
  await page.waitForFunction(()=>WaveScreen.parked===false);
  assert(await page.locator('#view-library').isVisible(),'Library did not return to Library');
  await page.waitForTimeout(100);
  assert(!/APP_SUSPENDED/.test(await page.locator('#status').textContent()),'Library callback ran while phone was parked');
 }finally{await expandedLibrary.close();}
 for(const [view,returnState] of [['studio',saved],['library',libraryReturn]]){
  const freshPhone=await page.context().newPage();
  try{
   await freshPhone.addInitScript(value=>{globalThis.__waveReturnState=value;},returnState);
   await freshPhone.goto(page.url(),{waitUntil:'load'});
   await freshPhone.waitForFunction(()=>window.WaveScreen?.parked===false);
   assert(await freshPhone.locator('#view-'+view).isVisible(),`Fresh LB Phone iframe returned to ${view}`);
   const calls=await freshPhone.evaluate(()=>globalThis.__waveCalls);
   assert(calls.indexOf('bootstrap')>=0&&calls.indexOf('bootstrap')<calls.indexOf('waveScreenReturned'),'Return was acknowledged before phone bootstrap');
   assert(!/APP_SUSPENDED|起動失敗/.test(await freshPhone.locator('#status').textContent()));
   if(view==='studio'){
    assert.equal(await freshPhone.locator('#projectTitleInput').inputValue(),'切替中の制作データ');
    assert.equal(await freshPhone.locator('#bpmInput').inputValue(),'138');
    assert(await freshPhone.locator('#pianoGrid .step-cell.on').count()>0);
   }
  }finally{await freshPhone.close();}
 }
}
