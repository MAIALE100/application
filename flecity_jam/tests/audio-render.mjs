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
    const pitchMidi=(ch,start)=>{
      const signal=Array.from({length:3600},(_,i)=>ch[Math.round(start*rate)+i*3]);
      const differences=[0],normalized=[1];let total=0;
      for(let lag=1;lag<=400;lag++){
        let sum=0;for(let j=0;j<1600;j++){const d=signal[j]-signal[j+lag];sum+=d*d;}
        differences[lag]=sum;total+=sum;normalized[lag]=total?sum*lag/total:1;
      }
      for(let lag=2;lag<399;lag++)if(normalized[lag]<.12){
        while(lag<399&&normalized[lag+1]<normalized[lag])lag++;
        const a=normalized[lag-1],b=normalized[lag],c=normalized[lag+1],den=a-2*b+c;
        const refined=den?lag+(a-c)/(2*den):lag;
        return 69+12*Math.log2((rate/3/refined)/440);
      }
      return null;
    };
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
        cacheBytes:rack.stats().cacheBytes,measuredMidi:pitchMidi(ch,.24),
        heldTailMidi:releaseAt==null?pitchMidi(ch,seconds-.24):null};
    };
    const instruments=[];
    for(const [id,pitch]of [['piano',60],['guitar',60],['bass',34],['clarinet',62],['drums',36],['electric_guitar',60],['flute',72],['violin',69]])
      instruments.push(await render(id,pitch));
    const clarinetLoop=await render('clarinet',65,100,null,4);
    const sustainedLoops=[await render('flute',76,100,null,4),await render('violin',72,100,null,4)];
    const additionalRangeEdges=[];
    for(const identifier of ['electric_guitar','flute','violin']){
      const spec=catalog.instruments.find(item=>item.id===identifier);
      for(const pitch of [spec.min,spec.max])additionalRangeEdges.push(await render(identifier,pitch));
    }
    const soft=await render('piano',80,74,null,2);
    const forte=await render('piano',80,75,null,2);
    const pianoBoundary={midi:80,softRms:soft.firstRms,forteRms:forte.firstRms,
      differenceDb:20*Math.log10(forte.firstRms/soft.firstRms),softPeak:soft.peak,fortePeak:forte.peak};
    return {instruments,clarinetLoop,sustainedLoops,additionalRangeEdges,pianoBoundary};
  });
  report.instruments=metrics.instruments;
  report.clarinetLoop=metrics.clarinetLoop;
  report.sustainedLoops=metrics.sustainedLoops;
  report.additionalRangeEdges=metrics.additionalRangeEdges;
  report.pianoBoundary=metrics.pianoBoundary;
  for(const item of report.instruments){
    assert(item.firstRms>1e-5,`${item.instrument}: silent initial note`);
    assert(item.peak<.99,`${item.instrument}: clipped`);
    assert(item.tailRms<1e-5,`${item.instrument}: sound after stop`);
    assert.equal(item.nodesAfter,0,`${item.instrument}: leaked source nodes`);
    if(['electric_guitar','flute','violin'].includes(item.instrument))
      assert(item.measuredMidi!=null&&Math.abs(item.measuredMidi-item.pitch)<.5,`${item.instrument}: rendered pitch ${item.measuredMidi}`);
  }
  assert(report.clarinetLoop.tailRms>1e-5,'clarinet held loop went silent');
  assert(report.clarinetLoop.peak<.99,'clarinet held loop clipped');
  for(const item of report.sustainedLoops){
    assert(item.tailRms>1e-5,`${item.instrument}: held loop went silent`);
    assert(item.peak<.99,`${item.instrument}: held loop clipped`);
    assert(item.heldTailMidi!=null&&Math.abs(item.heldTailMidi-item.pitch)<.5,`${item.instrument}: held loop pitch ${item.heldTailMidi}`);
  }
  for(const item of report.additionalRangeEdges){
    assert(item.firstRms>1e-5&&item.peak<.99,`${item.instrument}: silent or clipped range edge ${item.pitch}`);
    assert(item.tailRms<1e-5&&item.nodesAfter===0,`${item.instrument}: unreleased range edge`);
    assert(item.measuredMidi!=null&&Math.abs(item.measuredMidi-item.pitch)<.5,`${item.instrument}: edge pitch ${item.measuredMidi}`);
  }
  assert(Math.abs(report.pianoBoundary.differenceDb)<2,'piano velocity boundary jumped');
  const destination=process.env.JAM_AUDIO_RENDER_REPORT;
  if(destination){fs.mkdirSync(path.dirname(destination),{recursive:true});fs.writeFileSync(destination,JSON.stringify(report,null,2)+'\n');}
  console.log(JSON.stringify({status:'PASS',instruments:report.instruments.map(({instrument,firstRms,peak,tailRms})=>({instrument,firstRms,peak,tailRms})),
    clarinetLoopTailRms:report.clarinetLoop.tailRms,pianoBoundaryDb:report.pianoBoundary.differenceDb}));
  await page.close();
} finally {
  await browser.close();
}
