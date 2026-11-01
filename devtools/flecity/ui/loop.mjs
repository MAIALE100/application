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
globalThis.__loopAudit={suspend:suspendActivePlay,stackPosition,stackInputTime,settled:()=>!launchLocked,
 showExpandedList:()=>{globalThis.__phoneScreen=FlecityScreen;globalThis.__phoneFetch=globalThis.fetch;globalThis.FlecityScreen={...FlecityScreen,expanded:true,surface:'expanded'};globalThis.GetParentResourceName=()=> 'flecity_games';globalThis.fetch=(url,options)=>String(url).startsWith('https://flecity_games/flecityGames:callback')?Promise.resolve({json:()=>globalThis.fetchNui('flecityGames:callback',JSON.parse(options.body))}):globalThis.__phoneFetch(url,options);renderGames(bootstrapData.games);},
 showPhoneList:()=>{globalThis.FlecityScreen=globalThis.__phoneScreen;globalThis.fetch=globalThis.__phoneFetch;delete globalThis.GetParentResourceName;renderGames(bootstrapData.games);},
 states:()=>({block:!!block,merge:!!merge,fall:!!fallGame,mines:!!mines,nonogram:!!nonogram,stack:!!stackGame,memory:!!memory,sort:!!sortGame,slide:!!slideGame,color:!!colorMatch,number:!!numberRush,high:!!highLow,simon:!!simon}),
 timers:()=>[stackRaf,fallGravityClock,fallSoftClock,minesClock,nonogramClock,memoryClock,sortClock,slideClock,colorMatchClock,numberRushClock,highLowClock,memoryFlipTimer,simonTimer],
 startFall:()=>openFall(true),moveFall:()=>moveFallHorizontal(-1),rotateFall:()=>rotateFall(),dropFall:()=>dropFall(),
 fallState:()=>fallGame&&({x:fallGame.x,y:fallGame.y,rotation:fallGame.rotation,pieces:fallGame.pieces,heldPiece:fallGame.heldPiece,holdUsed:fallGame.holdUsed}),
 quick:()=>tapButton.onclick(),stop:()=>stopButton.onclick(),color:startColorMatch,number:startNumberRush,high:startHighLow,simon:startSimon};
` }));
  ctx.loopAudit={games,coverage:[]};
}

export async function scenario(ctx,page){
  const layouts=[];
  await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('LOOP 準備完了'));
  const screens={quick_tap:'quickTap',stop:'stopGame',stack:'stackGame',block:'blockGame',merge:'mergeGame',fall:'fallGame',mines:'minesGame',nonogram:'nonogramGame',memory:'memoryGame',sort:'sortGame',slide:'slideGame',color_match:'colorMatchGame',number_rush:'numberRushGame',high_low:'highLowGame',simon:'simonGame'};
  assert.equal(await page.locator('#games button.game').count(),15,'Phone library does not contain all registered games');
  await page.setViewportSize({width:390,height:844});
  const header=await page.evaluate(()=>{const bar=document.querySelector('#screenBar').getBoundingClientRect();return {top:bar.top,buttonTop:document.querySelector('#screenBar button').getBoundingClientRect().top};});
  assert(header.top>=64&&header.buttonTop>=64,'Phone controls intersect the notch/status safe area');
  for(const game of ctx.loopAudit.games){
    for(let cycle=0;cycle<2;cycle++){
      await page.locator('#games button.game[data-game="'+game.id+'"]').click();
      assert(await page.locator('#'+screens[game.id]).isVisible(),game.id+' did not open');
      if(['quick_tap','stop','color_match','number_rush','high_low','simon'].includes(game.id)){
        const method={quick_tap:'quick',stop:'stop',color_match:'color',number_rush:'number',high_low:'high',simon:'simon'}[game.id];
        await page.evaluate(method=>globalThis.__loopAudit[method](),method);
      }
      if(cycle===0){
        for(const [width,height] of [[390,844],[1366,768],[1920,1080],[2560,1440]]){
          await page.setViewportSize({width,height});
          await page.evaluate(expanded=>document.body.classList.toggle('screen-expanded',expanded),width>600);
          layouts.push({game:game.id,...await captureLayout(ctx,page,`loop-${game.id}-${width}`)});
        }
        await page.evaluate(()=>document.body.classList.remove('screen-expanded'));
      }
      await page.evaluate(()=>globalThis.__loopAudit.suspend());
      assert(await page.locator('#home').isVisible());
      assert(await page.evaluate(()=>Object.values(__loopAudit.states()).every(v=>!v)),'State leaked after '+game.id);
      assert.equal(await page.evaluate(()=>__loopRunningTimers()),0,'An uncancelled frame/interval survived '+game.id);
    }
    ctx.loopAudit.coverage.push({game:game.id,openSuspendReopenCycles:2,status:'PASS',scope:'Mock NUI lifecycle, not full game completion'});
  }
  saveLayout(ctx,'loop-layout',layouts);
  assert.equal(layouts.filter(r=>r.horizontalOverflow||r.headerOverlap||r.statusOverBar||r.clipped.length||r.textClipping.length||r.overlaps.length).length,0,'LOOP control/header geometry requires review; see loop-layout.json');
  await page.evaluate(()=>__loopAudit.showExpandedList());
  assert.equal(await page.locator('#games button.game').count(),15,'Expanded library hid registered games');
  for(const game of ctx.loopAudit.games){
   await page.locator('#games button.game[data-game="'+game.id+'"]').click();
   try{await page.locator('#'+screens[game.id]).waitFor({state:'visible',timeout:3000});}
   catch(error){throw Error(`${game.id} expanded launch failed: ${await page.locator('#status').textContent()}; ${error.message}`);}
   await page.waitForFunction(()=>__loopAudit.settled());
   await page.evaluate(()=>__loopAudit.suspend());
  }
  await page.evaluate(()=>__loopAudit.showPhoneList());
  const fallBefore=await page.evaluate(()=>FlecityTetrisPerf());
  for(let cycle=0;cycle<50;cycle++){
    await page.evaluate(()=>__loopAudit.startFall());
    assert(await page.locator('#fallGame').isVisible(),`Tetris start failed at cycle ${cycle}`);
    await page.evaluate(()=>__loopAudit.suspend());
    assert.equal(await page.evaluate(()=>__loopRunningTimers()),0,`Tetris timer leak at cycle ${cycle}`);
  }
  const fallAfter=await page.evaluate(()=>FlecityTetrisPerf());
  assert.equal(fallAfter.gravityTimers,0);
  assert.equal(fallAfter.softTimers,0);
  assert.equal(fallAfter.controls.bindings,fallBefore.controls.bindings,'Tetris keyboard handlers multiplied');
  fs.writeFileSync(path.join(ctx.run.dir,'tetris-cycles.json'),JSON.stringify({cycles:50,before:fallBefore,after:fallAfter,scope:'Mock NUI lifecycle'},null,2)+'\n');
  await page.evaluate(()=>__loopAudit.startFall());
  await page.evaluate(()=>document.activeElement?.blur());
  const atStart=await page.evaluate(()=>__loopAudit.fallState());
  await page.keyboard.press('a');
  assert.equal((await page.evaluate(()=>__loopAudit.fallState())).x,atStart.x-1,'A did not move left');
  await page.keyboard.press('d');
  assert.equal((await page.evaluate(()=>__loopAudit.fallState())).x,atStart.x,'D did not move right');
  await page.keyboard.press('w');
  assert.notEqual((await page.evaluate(()=>__loopAudit.fallState())).rotation,atStart.rotation,'W did not rotate');
  await page.keyboard.press('c');
  assert.equal((await page.evaluate(()=>__loopAudit.fallState())).holdUsed,true,'C did not hold');
  const beforeSpace=(await page.evaluate(()=>__loopAudit.fallState())).pieces;
  await page.keyboard.press('Space');
  assert.equal((await page.evaluate(()=>__loopAudit.fallState())).pieces,beforeSpace+1,'Space did not hard drop');
  await page.keyboard.press('Shift');
  assert.equal((await page.evaluate(()=>__loopAudit.fallState())).holdUsed,true,'Shift did not hold after the next piece');
  await page.waitForTimeout(130);
  const beforeS=(await page.evaluate(()=>__loopAudit.fallState())).pieces;
  await page.keyboard.press('s');
  assert.equal((await page.evaluate(()=>__loopAudit.fallState())).pieces,beforeS+1,'S did not hard drop');
  const input=page.locator('input').first();await input.focus();
  const beforeFocused=(await page.evaluate(()=>__loopAudit.fallState())).pieces;
  await page.keyboard.press('Space');
  assert.equal((await page.evaluate(()=>__loopAudit.fallState())).pieces,beforeFocused,'Input focus did not suppress game controls');
  await page.evaluate(()=>__loopAudit.suspend());
  // A clock jump represents a long frame/suspension gap; it is not five minutes of human play.
  await page.clock.install();await page.evaluate(()=>__loopAudit.startFall());await page.clock.fastForward(5*60*1000);
  await page.evaluate(()=>__loopAudit.suspend());assert(await page.locator('#home').isVisible());
  const timing=await page.evaluate(()=>{
    const now=performance.now();return {old:__loopAudit.stackInputTime({timeStamp:now-10000}),now,
      positions:[0,1,1000,300000,8*3600000].map(t=>__loopAudit.stackPosition(t,72,65,false))};
  });
  assert(timing.old>=timing.now-161&&timing.old<=timing.now);
  assert(timing.positions.every(x=>Number.isFinite(x)&&x>=0&&x<=28));
  const realtimeMs=Number(process.env.FLECITY_TETRIS_REALTIME_MS||0);
  if(realtimeMs>=10000){
    const cdp=await page.context().newCDPSession(page);
    const heap=async()=>{try{return (await cdp.send('Runtime.getHeapUsage')).usedSize;}catch{return null;}};
    const browserHeapBefore=await heap();
    const stress=await page.evaluate(async durationMs=>{
      let restarts=0,drops=0,starting=false;
      const sample=()=>({at:Date.now(),heapBytes:performance.memory?.usedJSHeapSize??null,
        timers:__loopRunningTimers(),metrics:FlecityTetrisPerf()});
      const before=sample();let middle=null;
      await __loopAudit.startFall();restarts++;
      await new Promise(resolve=>{
        const begun=Date.now();
        const clock=setInterval(()=>{
          const elapsed=Date.now()-begun;
          if(!middle&&elapsed>=durationMs/2)middle=sample();
          if(elapsed>=durationMs){clearInterval(clock);resolve();return;}
          if(!fallGame||fallGame.ended||fallGame.finished){
            if(!starting){starting=true;Promise.resolve(__loopAudit.startFall()).then(()=>restarts++).finally(()=>starting=false);}
          }else if(!fallGame.busy){
            __loopAudit.moveFall();
            if(drops%7===0)__loopAudit.rotateFall();
            __loopAudit.dropFall();drops++;
          }
        },250);
      });
      await __loopAudit.suspend();
      return {durationMs,restarts,drops,before,middle,after:sample(),scope:'Real-wall-clock mock NUI operation, not FiveM clients'};
    },realtimeMs);
    stress.browserHeapBytes={before:browserHeapBefore,after:await heap()};
    fs.writeFileSync(path.join(ctx.run.dir,'tetris-longrun.json'),JSON.stringify(stress,null,2)+'\n');
    assert(stress.drops>Math.floor(realtimeMs/5000),`Long-run Tetris made insufficient progress: drops=${stress.drops}, restarts=${stress.restarts}`);
    assert.equal(stress.after.timers,0,'Long-run Tetris leaked timers');
    assert.equal(stress.after.metrics.controls.bindings,stress.before.metrics.controls.bindings,'Keyboard bindings grew during long run');
  }
  await page.setViewportSize({width:360,height:780});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Phone viewport overflows');
  fs.writeFileSync(path.join(ctx.run.dir,'loop-coverage.json'),JSON.stringify({games:ctx.loopAudit.coverage,clockJumpMinutes:5,fullGameCompletion:'NOT_RUN',realLongPlay:'NOT_RUN',realFiveM:'NOT_RUN'},null,2)+'\n');
}
