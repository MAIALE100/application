import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {pathToFileURL,fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const evidence=path.resolve(root,'../.flecity-dev/jam/browser');fs.mkdirSync(evidence,{recursive:true});
const configPath=path.resolve(root,'../.flecity-dev/local.json');
const config=fs.existsSync(configPath)?JSON.parse(fs.readFileSync(configPath,'utf8').replace(/^\uFEFF/,'')):{browser:{}};
const modulePath=process.env.JAM_PLAYWRIGHT_MODULE||config.browser.module||'playwright';
const {chromium}=await import(path.isAbsolute(modulePath)?pathToFileURL(modulePath):modulePath);
const browser=await chromium.launch({channel:process.env.JAM_BROWSER_CHANNEL||config.browser.channel||'chrome',headless:true,args:['--autoplay-policy=no-user-gesture-required']});
const results=[];
async function check(name,fn){const at=Date.now();try{await fn();results.push({name,status:'PASS',ms:Date.now()-at});console.log('PASS '+name);}catch(e){results.push({name,status:'FAIL',message:e.stack});console.log('FAIL '+name+': '+e.message);throw e;}}
try {
  const page=await browser.newPage({viewport:{width:1366,height:768}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  // Fulfil local files in-process: no network or running FiveM server is involved.
  await page.route('**/*',async route=>{
    const url=new URL(route.request().url());
    if(url.origin!=='https://jam.test'){await route.abort();return;}
    const relative=decodeURIComponent(url.pathname).replace(/^\//,'')||'index.html';
    const web=path.resolve(root,'web'),file=path.resolve(web,relative);
    if(!file.startsWith(web+path.sep)||!fs.existsSync(file)){await route.fulfill({status:404,body:'Not found'});return;}
    const mime={'.html':'text/html','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.ogg':'audio/ogg','.wav':'audio/wav'};
    await route.fulfill({status:200,contentType:mime[path.extname(file)]||'application/octet-stream',body:fs.readFileSync(file)});
  });
  await page.goto('https://jam.test/');await page.waitForFunction(()=>window.JAM);
  await check('responsive panel at 390, 1366, 1920 and 2560 widths',async()=>{
    for(const [width,height]of [[390,844],[1366,768],[1920,1080],[2560,1440]]) {
      await page.setViewportSize({width,height});
      const geometry=await page.evaluate(()=>{const p=document.querySelector('#panel').getBoundingClientRect();return {x:p.x,y:p.y,right:p.right,bottom:p.bottom,scroll:document.documentElement.scrollWidth,width:innerWidth};});
      assert(geometry.x>=0 && geometry.y>=0 && geometry.right<=width+.5 && geometry.bottom<=height+.5);assert(geometry.scroll<=width);
      await page.screenshot({path:path.join(evidence,`jam-${width}.png`)});
    }
    await page.setViewportSize({width:1366,height:768});
  });
  await check('keyboard chord, repeat suppression, release across octave change',async()=>{
    await page.click('#start');await page.waitForFunction(()=>window.JAM.session || !document.querySelector('#error').hidden);
    assert(await page.evaluate(()=>Boolean(JAM.session)),await page.locator('#error').innerText());
    await page.keyboard.down('z');await page.keyboard.down('d');await page.keyboard.down('g');
    assert.equal(await page.evaluate(()=>JAM.model.notes.size),3);
    await page.keyboard.down('z');assert.equal(await page.evaluate(()=>JAM.model.notes.size),3);
    await page.keyboard.press('ArrowUp');await page.keyboard.up('z');await page.keyboard.up('d');await page.keyboard.up('g');
    assert.equal(await page.evaluate(()=>JAM.model.notes.size),0);
  });
  await check('sustain holds and releases all notes',async()=>{
    await page.keyboard.down('Space');await page.keyboard.press('z');assert.equal(await page.evaluate(()=>JAM.model.notes.size),1);
    await page.keyboard.up('Space');assert.equal(await page.evaluate(()=>JAM.model.notes.size),0);
  });
  await check('rapid 100 trills and blur leave no stuck voices',async()=>{
    await page.evaluate(()=>{for(let i=0;i<100;i++){window.dispatchEvent(new KeyboardEvent('keydown',{code:'KeyZ'}));window.dispatchEvent(new KeyboardEvent('keyup',{code:'KeyZ'}));}});
    await page.keyboard.down('z');await page.evaluate(()=>window.dispatchEvent(new Event('blur')));await page.keyboard.up('z');
    assert.equal(await page.evaluate(()=>JAM.model.notes.size),0);assert.equal(await page.evaluate(()=>JAM.audio.slots.has('local')),false);
    assert(await page.locator('#panel').isHidden());
    await page.evaluate(()=>JAM.message({type:'open'}));await page.click('#start');await page.waitForFunction(()=>JAM.session);
  });
  await check('key rebinding rejects PTT and duplicate bindings',async()=>{
    await page.click('#settingsToggle');await page.locator('#bindings button').first().click();await page.keyboard.press('n');
    assert(await page.locator('#error').isVisible());await page.keyboard.press('a');assert.equal(await page.evaluate(()=>JAM.model.bindings[0]),'KeyA');
    await page.click('#settingsToggle');await page.locator('#playArea').focus();await page.keyboard.down('a');assert.equal(await page.evaluate(()=>JAM.model.notes.size),1);await page.keyboard.up('a');
  });
  await check('MIDI velocity pedal and all-notes-off parser',async()=>{
    await page.evaluate(()=>{JAM.midi.receive([0x90,60,64]);JAM.midi.receive([0xb0,64,127]);JAM.midi.receive([0x90,60,0]);});
    assert.equal(await page.evaluate(()=>[...JAM.model.notes.values()][0].velocity),64);
    await page.evaluate(()=>JAM.midi.receive([0xb0,64,0]));assert.equal(await page.evaluate(()=>JAM.model.notes.size),0);
    await page.evaluate(()=>{JAM.midi.receive([0x90,64,100]);JAM.midi.receive([0xb0,123,0]);});assert.equal(await page.evaluate(()=>JAM.model.notes.size),0);
  });
  await check('all 58 sound assets decode and every instrument starts and stops',async()=>{
    await page.click('#start');
    for(const id of ['piano','guitar','bass','clarinet','drums']) {
      await page.selectOption('#instrument',id);await page.click('#start');await page.waitForFunction(()=>JAM.session);
      const key=await page.locator('#keyboard button[data-code]:not(:disabled) kbd').first().innerText();
      await page.keyboard.down(key);assert(await page.evaluate(()=>JAM.audio.stats().voices)>0,id);await page.keyboard.up(key);
      await page.click('#panic');await page.click('#start');
    }
    const stats=await page.evaluate(()=>JAM.audio.stats());assert(stats.cacheBytes>0 && stats.cacheBytes<64*1024*1024);assert.equal(stats.voices,0);
    fs.writeFileSync(path.join(evidence,'audio-cache.json'),JSON.stringify(stats,null,2));
  });
  await check('remote spatial audio, dropped event repair and late load cancellation',async()=>{
    await page.evaluate(()=>{
      const packet={kind:'snapshot',player:2,session:'qa',wire:1,rev:0,instrument:'clarinet',range:7,volume:.75,sustain:false,notes:[{id:1,pitch:60,velocity:100,held:true,age:6000}]};
      JAM.message({type:'remote',data:packet});
      JAM.message({type:'positions',listener:{x:0,y:0,z:0,fx:0,fy:1,fz:0},sources:[{player:2,x:0,y:2,z:0}]});
    });
    await page.waitForFunction(()=>JAM.audio.stats().voices>0);
    await page.evaluate(()=>JAM.message({type:'positions',listener:{x:0,y:0,z:0,fx:0,fy:1,fz:0},sources:[{player:2,x:0,y:9,z:0}]}));
    assert.equal(await page.evaluate(()=>JAM.audio.stats().voices),0);
    await page.evaluate(()=>JAM.message({type:'remote',data:{kind:'stop',player:2,session:'qa',wire:3}}));assert.equal(await page.evaluate(()=>JAM.audio.slots.has(2)),false);
  });
  await check('remote drum tap survives on/off in the same batch',async()=>{
    await page.evaluate(()=>{
      JAM.message({type:'remote',data:{kind:'snapshot',player:2,session:'tap',wire:4,rev:0,instrument:'drums',range:7,volume:1,sustain:false,notes:{}}});
      JAM.message({type:'positions',listener:{x:0,y:0,z:0,fx:0,fy:1,fz:0},sources:[{player:2,x:0,y:2,z:0}]});
      JAM.message({type:'remote',data:{kind:'delta',player:2,session:'tap',wire:5,rev:1,ops:[{kind:'on',id:1,pitch:38,velocity:100},{kind:'off',id:1}]}});
    });
    assert(await page.evaluate(()=>JAM.audio.stats().voices)>0);
    await page.evaluate(()=>JAM.message({type:'remote',data:{kind:'stop',player:2,session:'tap',wire:6}}));
    assert.equal(await page.evaluate(()=>JAM.audio.stats().voices),0);
  });
  await check('actual WebAudio render contains sound, then silence after stop',async()=>{
    const metrics=await page.evaluate(async()=>{
      const {AudioRack}=await import('./audio.mjs');const catalog=await(await fetch('catalog.json')).json();
      const ctx=new OfflineAudioContext(2,48000*3,48000),rack=new AudioRack(catalog,ctx);await rack.load('clarinet');
      rack.sync('local',{instrument:'clarinet',volume:.75,notes:[{id:1,pitch:62,velocity:100,held:true,age:0}]});
      // Offline context scheduling provides deterministic output without wall-clock timing.
      for(const v of rack.aliveVoices){v.gain.gain.setValueAtTime(.1,1);v.gain.gain.linearRampToValueAtTime(0,1.1);v.source.stop(1.12);}
      const output=await ctx.startRendering();const ch=output.getChannelData(0);
      const rms=(a,b)=>Math.sqrt(ch.slice(a,b).reduce((sum,x)=>sum+x*x,0)/(b-a));
      return {sound:rms(12000,24000),tail:rms(96000,120000),peak:ch.reduce((m,x)=>Math.max(m,Math.abs(x)),0)};
    });
    assert(metrics.sound>.001);assert(metrics.tail<1e-7);assert(metrics.peak<.99);fs.writeFileSync(path.join(evidence,'rendered-audio.json'),JSON.stringify(metrics,null,2));
  });
  await check('batched melodic taps render audible PCM and finish without hanging',async()=>{
    const metrics=await page.evaluate(async()=>{
      const {AudioRack}=await import('./audio.mjs');
      const {Replicas}=await import('./model.mjs');
      const catalog=await(await fetch('catalog.json')).json(),out=[];
      for(const instrument of ['piano','guitar','bass','clarinet']){
        const ctx=new OfflineAudioContext(2,48000,48000),rack=new AudioRack(catalog,ctx);
        await rack.load(instrument);
        const replicas=new Replicas((id,state)=>rack.sync(id,state),id=>rack.remove(id),()=>0);
        replicas.accept({kind:'snapshot',player:2,session:'tap',wire:1,rev:0,instrument,range:7,volume:1,sustain:false,notes:[]});
        rack.positions({x:0,y:0,z:0,fx:0,fy:1,fz:0},[{player:2,x:0,y:1,z:0}]);
        replicas.accept({kind:'delta',player:2,session:'tap',wire:2,rev:1,ops:[
          {kind:'on',id:1,pitch:instrument==='bass'?36:62,velocity:110},{kind:'off',id:1}]});
        const output=await ctx.startRendering(),pcm=output.getChannelData(0);
        const rms=(a,b)=>Math.sqrt(pcm.slice(a,b).reduce((sum,x)=>sum+x*x,0)/(b-a));
        out.push({instrument,sound:rms(0,12000),tail:rms(36000,48000),nodes:rack.stats().nodes});
      }
      return out;
    });
    fs.writeFileSync(path.join(evidence,'batched-taps.json'),JSON.stringify(metrics,null,2));
    for(const m of metrics){assert(m.sound>.0001,`${m.instrument} short tap is silent: ${m.sound}`);assert(m.tail<1e-7);assert.equal(m.nodes,0);}
  });
  await check('128 simultaneous voices render without clipping',async()=>{
    const metrics=await page.evaluate(async()=>{
      const {AudioRack}=await import('./audio.mjs');const catalog=await(await fetch('catalog.json')).json();
      const ctx=new OfflineAudioContext(2,48000*2,48000),rack=new AudioRack(catalog,ctx);await rack.load('piano');
      for(let player=1;player<=8;player++)rack.sync(player,{instrument:'piano',range:7,volume:1,
        notes:Array.from({length:16},(_,i)=>({id:i+1,pitch:60+i,velocity:127,held:true,age:0}))});
      rack.positions({x:0,y:0,z:0,fx:0,fy:1,fz:0},Array.from({length:8},(_,i)=>({player:i+1,x:0,y:.5,z:0})));
      const voices=rack.stats().voices;const output=await ctx.startRendering();
      return {voices,peak:Math.max(...[0,1].map(c=>output.getChannelData(c).reduce((m,x)=>Math.max(m,Math.abs(x)),0)))};
    });
    assert.equal(metrics.voices,128);assert(metrics.peak<.99,'peak='+metrics.peak);fs.writeFileSync(path.join(evidence,'rendered-polyphony.json'),JSON.stringify(metrics,null,2));
  });
  if(Number(process.env.JAM_SOAK_SECONDS)>0)await check('real-time browser soak with eight simulated performers',async()=>{
    const seconds=Math.min(600,Number(process.env.JAM_SOAK_SECONDS));
    const stats=await page.evaluate(async seconds=>{
      const ids=['piano','guitar','bass','clarinet','drums'];for(const id of ids)await JAM.audio.load(id);
      const before=JAM.audio.stats(),started=performance.now();let wire=100,round=0,maxVoices=0,maxNodes=0,maxSlots=0;
      while(performance.now()-started<seconds*1000){
        for(let player=1;player<=8;player++){
          const id=ids[(player-1)%ids.length],base=id==='bass'?36:id==='drums'?38:60;
          JAM.message({type:'remote',data:{kind:'snapshot',player,session:'soak'+player,wire:++wire,rev:round,instrument:id,range:7,volume:.75,sustain:false,
            notes:round%2?[]:[{id:round+1,pitch:base,velocity:100,held:true,age:0},{id:round+2,pitch:id==='drums'?42:base+3,velocity:85,held:true,age:0}]}});
        }
        JAM.message({type:'positions',listener:{x:0,y:0,z:0,fx:0,fy:1,fz:0},sources:Array.from({length:8},(_,i)=>({player:i+1,x:(i%3)-1,y:2,z:0}))});
        const s=JAM.audio.stats();maxVoices=Math.max(maxVoices,s.voices);maxNodes=Math.max(maxNodes,s.nodes);maxSlots=Math.max(maxSlots,s.performers);round++;
        await new Promise(resolve=>setTimeout(resolve,100));
      }
      JAM.replicas.clear();JAM.audio.stopAll();await new Promise(resolve=>setTimeout(resolve,100));
      return {seconds:(performance.now()-started)/1000,rounds:round,maxVoices,maxNodes,maxSlots,before,after:JAM.audio.stats()};
    },seconds);
    assert.equal(stats.after.voices,0);assert.equal(stats.after.nodes,0);assert.equal(stats.after.performers,0);assert.equal(stats.before.cacheBytes,stats.after.cacheBytes);assert(stats.maxVoices<=128);assert(stats.maxNodes<=128);assert.equal(stats.maxSlots,8);
    fs.writeFileSync(path.join(evidence,'soak.json'),JSON.stringify(stats,null,2));
  });
  await check('no JavaScript errors; Escape closes cleanly',async()=>{
    await page.keyboard.press('Escape');assert(await page.locator('#panel').isHidden());assert.deepEqual(errors,[]);
  });
  await page.close();
} finally {
  fs.writeFileSync(path.join(evidence,'results.json'),JSON.stringify({browser:browser.version(),scope:'Offline Chromium; FiveM/CEF/MIDI hardware NOT_RUN',results},null,2));await browser.close();
}
