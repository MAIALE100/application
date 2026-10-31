import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { inside,noLinks,redact,local } from './core.mjs';
import { pathToFileURL } from 'node:url';

// Offline browser only. This never launches/controls a FiveM game client.
export async function browserChecks(ctx,scenario,prepare){
  if(!ctx.nui?.entry||!scenario){ctx.skip('NUI browser scenario','No reviewed entry/scenario registered');return;}
  let playwright;
  try{playwright=await import(local().browser?.module?pathToFileURL(local().browser.module).href:'playwright');}
  catch{ctx.skip('NUI browser runtime','Optional local playwright package/browser unavailable');return;}
  const entry=inside(ctx.source,ctx.nui.entry),root=ctx.source;noLinks(entry);
  const server=http.createServer((req,res)=>{
    try{
      const relative=decodeURIComponent(new URL(req.url,'http://localhost').pathname).replace(/^\/+/,'');
      const file=inside(root,relative||ctx.nui.entry);noLinks(file);
      if(!/\.(html|js|mjs|css|svg|png|jpe?g|webp|woff2?|ttf|otf)$/i.test(file))throw Error('File type blocked');
      const types={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.svg':'image/svg+xml'};
      res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');
      res.end(fs.readFileSync(file));
    }catch{res.writeHead(404);res.end();}
  });
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
  let browser,page,prepared;const messages=[],consoleMessages=[];
  try{
    browser=await playwright.chromium.launch({headless:true,...(local().browser?.channel?{channel:local().browser.channel}:{}),timeout:15000});
    ctx.run.browser={version:browser.version(),channel:local().browser?.channel||'bundled-chromium',mockedNui:true};
    const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});
    const origin='http://127.0.0.1:'+server.address().port;
    await context.route('**/*',route=>route.request().url().startsWith(origin+'/')?route.continue():route.abort());
    await context.routeWebSocket('**/*',socket=>socket.close());
    page=await context.newPage();page.setDefaultTimeout(15000);
    page.on('console',message=>{if(['error','warning'].includes(message.type()))consoleMessages.push(message.type()+': '+message.text());});
    if(prepare)prepared=await prepare(ctx,page);
    page.on('pageerror',e=>messages.push(e.message));
    await ctx.check('NUI offline browser scenario',async()=>{
      try{
        await page.goto(origin+'/'+ctx.nui.entry.replaceAll('\\','/'),{waitUntil:'load',timeout:15000});
        await scenario(ctx,page);
        if(messages.length)throw Error(messages.join('\n'));
        await page.screenshot({path:path.join(ctx.run.dir,'screenshots','nui-success.png'),fullPage:true});
        return 'Offline browser with synthetic NUI responses; no FiveM/LB Phone integration';
      }catch(e){
        await page.screenshot({path:path.join(ctx.run.dir,'screenshots','nui-failure.png'),fullPage:true}).catch(()=>{});
        throw e;
      }
    });
  }catch(e){await ctx.check('NUI browser initialization',()=>{throw e;});}
  finally{
    if(prepared?.cleanup)await ctx.check('Offline fixture cleanup / protected-row audit',()=>prepared.cleanup());
    fs.writeFileSync(path.join(ctx.run.dir,'logs','nui-console.txt'),redact([...messages,...consoleMessages].join('\n')));
    if(browser)await browser.close();
    server.closeAllConnections();
    await new Promise(resolve=>server.close(resolve));
  }
}
