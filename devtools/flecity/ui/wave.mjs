import assert from 'node:assert/strict';
import {captureLayout,saveLayout} from './layout-audit.mjs';

export async function prepare(ctx,page){
 await page.addInitScript(()=>{
  globalThis.__waveCalls=[];
  globalThis.fetchNui=async(event,request)=>{
   if(event!=='wave:callback')throw Error('Unexpected event');
   __waveCalls.push(request.action);
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
}
