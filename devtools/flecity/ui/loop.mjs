import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {captureLayout,saveLayout} from './layout-audit.mjs';

export async function prepare(ctx,page){
  const games=ctx.read('shared/game_registry.lua').split(/\r?\n/).filter(l=>/app='play'/.test(l)).map(l=>({
    id:l.match(/id='([^']+)'/)[1],name:l.match(/name='([^']+)'/)[1],app:'play',enabled:true,
    category:l.match(/category='([^']+)'/)[1],supportsRanking:true,supportsDaily:false,supportsResume:/supportsResume=true/.test(l)
  }));
  assert.equal(games.length,15);
  await page.addInitScript(games=>{
    const calls=[];let serial=0;globalThis.__loopCalls=calls;
    const frames=new Set(),intervals=new Set();
    const raf=globalThis.requestAnimationFrame.bind(globalThis),cancel=globalThis.cancelAnimationFrame.bind(globalThis);
    const interval=globalThis.setInterval.bind(globalThis),clear=globalThis.clearInterval.bind(globalThis);
    globalThis.requestAnimationFrame=callback=>{let id;id=raf(time=>{frames.delete(id);callback(time);});frames.add(id);return id;};
    globalThis.cancelAnimationFrame=id=>{frames.delete(id);cancel(id);};
    globalThis.setInterval=(callback,delay,...args)=>{const id=interval(callback,delay,...args);intervals.add(id);return id;};
    globalThis.clearInterval=id=>{intervals.delete(id);clear(id);};
    globalThis.__loopRunningTimers=()=>frames.size+intervals.size;
    globalThis.fetchNui=async(event,{action,payload})=>{
      if(event!=='flecityGames:callback')throw Error('Nonfixture event');calls.push({action,payload});
      if(action==='bridgePing')return {ok:true};
      if(action==='profileGetSettings'||action==='profileUpdateSettings')return {ok:true,settings:{sound:false,reducedMotion:true}};
      if(action==='playBootstrap')return {ok:true,version:'offline-submission-audit',games,saves:[],best:{},statistics:{games:[]},achievements:[],daily:null};
      if(action==='playStatistics')return {ok:true,statistics:{games:[]},achievements:[]};
      if(action==='playRanking')return {ok:true,rows:[],top:[],self:null};
      if(action==='playStartSession')return {ok:true,sessionToken:'fixture-'+(++serial),seed:20261031,challenge:{
        initialWidthPct:72,speedPctPerSec:65,width:10,height:18,rounds:20,lives:3,count:25,
        currentValue:75,pivot:50,timeLimitMs:2400,sequence:[0],previewMs:1200,
        initialTubes:[[0,1,0,1],[1,0,1,0],[2,3,2,3],[3,2,3,2],[],[]],initialBoard:[1,2,3,4,5,6,7,8,9,10,11,12,13,14,0,15]
      }};
      if(['playSave','playResetSave','playCancelSession','playActivateSession'].includes(action))return {ok:true,elapsedMs:0};
      if(action==='playSubmitScore')return {ok:true,score:payload.score||0,details:{},achievements:[]};
      throw Error('Unmocked LOOP action: '+action);
    };
  },games);
  const source=ctx.read('web/play/app.js');
  await page.route('**/web/play/app.js',route=>route.fulfill({contentType:'application/javascript',body:source+`
// Test-only exports appended to an in-memory response; production file stays untouched.
globalThis.__loopAudit={suspend:suspendActivePlay,stackPosition,stackInputTime,
 states:()=>({block:!!block,merge:!!merge,fall:!!fallGame,mines:!!mines,nonogram:!!nonogram,stack:!!stackGame,memory:!!memory,sort:!!sortGame,slide:!!slideGame,color:!!colorMatch,number:!!numberRush,high:!!highLow,simon:!!simon}),
 timers:()=>[stackRaf,fallGravityClock,fallSoftClock,minesClock,nonogramClock,memoryClock,sortClock,slideClock,colorMatchClock,numberRushClock,highLowClock,memoryFlipTimer,simonTimer],
 startFall:()=>openFall(true),moveFall:()=>moveFall(-1),rotateFall:()=>rotateFall(),dropFall:()=>dropFall(),
 quick:()=>tapButton.onclick(),stop:()=>stopButton.onclick(),color:startColorMatch,number:startNumberRush,high:startHighLow,simon:startSimon};
` }));
  ctx.loopAudit={games,coverage:[]};
}

export async function scenario(ctx,page){
  const layouts=[];
  await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('LOOP 準備完了'));
  const screens={quick_tap:'quickTap',stop:'stopGame',stack:'stackGame',block:'blockGame',merge:'mergeGame',fall:'fallGame',mines:'minesGame',nonogram:'nonogramGame',memory:'memoryGame',sort:'sortGame',slide:'slideGame',color_match:'colorMatchGame',number_rush:'numberRushGame',high_low:'highLowGame',simon:'simonGame'};
  for(const game of ctx.loopAudit.games){
    for(let cycle=0;cycle<2;cycle++){
      await page.locator('#games button.game[data-game="'+game.id+'"]').click();
      assert(await page.locator('#'+screens[game.id]).isVisible(),game.id+' did not open');
      if(['quick_tap','stop','color_match','number_rush','high_low','simon'].includes(game.id)){
        const method={quick_tap:'quick',stop:'stop',color_match:'color',number_rush:'number',high_low:'high',simon:'simon'}[game.id];
        await page.evaluate(method=>globalThis.__loopAudit[method](),method);
      }
      if(cycle===0)for(const width of [390,360]){
        await page.setViewportSize({width,height:844});
        layouts.push({game:game.id,...await captureLayout(ctx,page,`loop-${game.id}-${width}`)});
      }
      await page.evaluate(()=>globalThis.__loopAudit.suspend());
      assert(await page.locator('#home').isVisible());
      assert(await page.evaluate(()=>Object.values(__loopAudit.states()).every(v=>!v)),'State leaked after '+game.id);
      assert.equal(await page.evaluate(()=>__loopRunningTimers()),0,'An uncancelled frame/interval survived '+game.id);
    }
    ctx.loopAudit.coverage.push({game:game.id,openSuspendReopenCycles:2,status:'PASS',scope:'Mock NUI lifecycle, not full game completion'});
  }
  saveLayout(ctx,'loop-layout',layouts);
  assert.equal(layouts.filter(r=>r.horizontalOverflow||r.clipped.length||r.textClipping.length||r.overlaps.length).length,0,'LOOP control geometry requires review; see loop-layout.json');
  // A clock jump represents a long frame/suspension gap; it is not five minutes of human play.
  await page.clock.install();await page.evaluate(()=>__loopAudit.startFall());await page.clock.fastForward(5*60*1000);
  await page.evaluate(()=>__loopAudit.suspend());assert(await page.locator('#home').isVisible());
  const timing=await page.evaluate(()=>{
    const now=performance.now();return {old:__loopAudit.stackInputTime({timeStamp:now-10000}),now,
      positions:[0,1,1000,300000,8*3600000].map(t=>__loopAudit.stackPosition(t,72,65,false))};
  });
  assert(timing.old>=timing.now-161&&timing.old<=timing.now);
  assert(timing.positions.every(x=>Number.isFinite(x)&&x>=0&&x<=28));
  await page.setViewportSize({width:360,height:780});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Phone viewport overflows');
  fs.writeFileSync(path.join(ctx.run.dir,'loop-coverage.json'),JSON.stringify({games:ctx.loopAudit.coverage,clockJumpMinutes:5,fullGameCompletion:'NOT_RUN',realLongPlay:'NOT_RUN',realFiveM:'NOT_RUN'},null,2)+'\n');
}
