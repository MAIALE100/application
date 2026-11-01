import assert from 'node:assert/strict';
import {captureLayout,saveLayout} from './layout-audit.mjs';

export async function prepare(ctx,page){
 await page.context().addInitScript(()=>{
  globalThis.__waveCalls=[];
  globalThis.fetchNui=async(event,request)=>{
   if(event!=='wave:callback')throw Error('Unexpected event');
   __waveCalls.push(request.action);
   if(request.action==='waveScreenOpen'){globalThis.__waveScreenState=request.payload.state;return {ok:true,lease:'fixture-wave-1'};}
   if(request.action==='waveScreenClose'){globalThis.__waveScreenState=request.payload.state;return {ok:true};}
   if(request.action==='waveScreenClaim')return globalThis.__waveReturnState?{ok:true,state:globalThis.__waveReturnState,lease:'fixture-wave-1'}:{ok:true,parked:!!globalThis.__waveScreenState};
   if(request.action==='waveScreenReady'||request.action==='waveScreenReturned')return {ok:true};
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
 }finally{await expanded.close();}
}
