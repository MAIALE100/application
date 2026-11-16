// Isolated Chromium WebAudio rendering. This does not test FiveM CEF speakers or sound quality.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const root=fileURLToPath(new URL('../',import.meta.url));
const web=path.join(root,'web');
const modulePath=process.env.JAM_PLAYWRIGHT_MODULE||'playwright';
const {chromium}=await import(path.isAbsolute(modulePath)?pathToFileURL(modulePath):modulePath);
const browser=await chromium.launch({channel:process.env.JAM_BROWSER_CHANNEL||'chrome',headless:true,
  args:['--autoplay-policy=no-user-gesture-required']});

const sha256=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const report={scope:'Local Chromium OfflineAudioContext only; FiveM CEF output and listening NOT_RUN',
  browser:browser.version(),source:{audioSha256:sha256(path.join(web,'audio.mjs')),
    catalogSha256:sha256(path.join(web,'catalog.json'))},instruments:[],clarinetLoop:null,pianoBoundary:null};

try {
  const page=await browser.newPage();
  await page.route('**/*',async route=>{
    const url=new URL(route.request().url());
    if(url.origin!=='https://jam.test'){await route.abort();return;}
    if(url.pathname==='/blank.html'){
      await route.fulfill({status:200,contentType:'text/html',body:'<!doctype html><title>JAM audio QA</title>'});return;
    }
    const relative=decodeURIComponent(url.pathname).replace(/^\//,'');
    const file=path.resolve(web,relative);
    if(!file.startsWith(web+path.sep)||!fs.existsSync(file)){await route.fulfill({status:404});return;}
    const mime={'.mjs':'text/javascript','.json':'application/json','.ogg':'audio/ogg','.wav':'audio/wav'};
    await route.fulfill({status:200,contentType:mime[path.extname(file)]||'application/octet-stream',body:fs.readFileSync(file)});
  });
  await page.goto('https://jam.test/blank.html');
  const metrics=await page.evaluate(async()=>{
    const {AudioRack}=await import('./audio.mjs');
    const catalog=await (await fetch('catalog.json')).json();
    const rate=48000;
    const rms=(ch,start,end)=>{
      let sum=0;
      for(let i=Math.round(start*rate);i<Math.round(end*rate);i++)sum+=ch[i]*ch[i];
      return Math.sqrt(sum/(Math.round((end-start)*rate)));
    };
    const peak=ch=>ch.reduce((max,value)=>Math.max(max,Math.abs(value)),0);
    const render=async(instrument,pitch,velocity=100,releaseAt=.5,seconds=3)=>{
      const ctx=new OfflineAudioContext(2,rate*seconds,rate);
      const rack=new AudioRack(catalog,ctx);
      await rack.load(instrument);
      rack.sync('local',{instrument,volume:.75,notes:[{id:1,pitch,velocity,held:true,age:0}]});
      const suspended=releaseAt==null?null:ctx.suspend(releaseAt);
      const finished=ctx.startRendering();
      if(suspended){
        await suspended;
        rack.sync('local',{instrument,volume:.75,notes:[]});
        await ctx.resume();
      }
      const output=await finished;
      const ch=output.getChannelData(0);
      return {instrument,pitch,velocity,releaseAt,firstRms:rms(ch,.08,.35),
        tailRms:rms(ch,seconds-.2,seconds),peak:peak(ch),nodesAfter:rack.stats().nodes,
        cacheBytes:rack.stats().cacheBytes};
    };
    const instruments=[];
    for(const [id,pitch]of [['piano',60],['guitar',60],['bass',34],['clarinet',62],['drums',36]])
      instruments.push(await render(id,pitch));
    const clarinetLoop=await render('clarinet',65,100,null,4);
    const soft=await render('piano',80,74,null,2);
    const forte=await render('piano',80,75,null,2);
    const pianoBoundary={midi:80,softRms:soft.firstRms,forteRms:forte.firstRms,
      differenceDb:20*Math.log10(forte.firstRms/soft.firstRms),softPeak:soft.peak,fortePeak:forte.peak};
    return {instruments,clarinetLoop,pianoBoundary};
  });
  report.instruments=metrics.instruments;
  report.clarinetLoop=metrics.clarinetLoop;
  report.pianoBoundary=metrics.pianoBoundary;
  for(const item of report.instruments){
    assert(item.firstRms>1e-5,`${item.instrument}: silent initial note`);
    assert(item.peak<.99,`${item.instrument}: clipped`);
    assert(item.tailRms<1e-5,`${item.instrument}: sound after stop`);
    assert.equal(item.nodesAfter,0,`${item.instrument}: leaked source nodes`);
  }
  assert(report.clarinetLoop.tailRms>1e-5,'clarinet held loop went silent');
  assert(report.clarinetLoop.peak<.99,'clarinet held loop clipped');
  assert(Math.abs(report.pianoBoundary.differenceDb)<2,'piano velocity boundary jumped');
  const destination=process.env.JAM_AUDIO_RENDER_REPORT;
  if(destination){fs.mkdirSync(path.dirname(destination),{recursive:true});fs.writeFileSync(destination,JSON.stringify(report,null,2)+'\n');}
  console.log(JSON.stringify({status:'PASS',instruments:report.instruments.map(({instrument,firstRms,peak,tailRms})=>({instrument,firstRms,peak,tailRms})),
    clarinetLoopTailRms:report.clarinetLoop.tailRms,pianoBoundaryDb:report.pianoBoundary.differenceDb}));
  await page.close();
} finally {
  await browser.close();
}
