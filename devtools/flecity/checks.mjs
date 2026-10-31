import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { files,command,luaCompiler,result,inside,noLinks,repo,inventory,sha,saveRun,newRun,tool } from './core.mjs';
import { bookmark } from './evidence.mjs';
import { browserChecks } from './nui.mjs';
function globPattern(pattern) {
  let out='^';
  for(let i=0;i<pattern.length;i++) {
    const c=pattern[i];
    if(c==='*'&&pattern[i+1]==='*'){i++;if(pattern[i+1]==='/'){i++;out+='(?:.*/)?';}else out+='.*';}
    else if(c==='*')out+='[^/]*';
    else if(c==='?')out+='[^/]';
    else out+='\\.^$+{}()|[]'.includes(c)?'\\'+c:c;
  }
  return new RegExp(out+'$');
}
export function manifestPaths(text) {
  text=text.replace(/--\[\[[\s\S]*?\]\]/g,'').replace(/--[^\n]*/g,'');
  const output=[],re=/\b(?:shared_scripts?|client_scripts?|server_scripts?|files|ui_page)\s*(\{[\s\S]*?\}|["'][^"']+["'])/g;
  for(const block of text.matchAll(re))for(const [,name] of block[0].matchAll(/["']([^"']+)["']/g))output.push(name);
  return output;
}
export function manifestCheck(source) {
  const text=fs.readFileSync(path.join(source,'fxmanifest.lua'),'utf8');
  if(!/\bfx_version\s+['"]cerulean['"]/.test(text))throw Error('Expected fx_version cerulean');
  const list=files(source).map(f=>path.relative(source,f).split(path.sep).join('/'));
  for(const pattern of manifestPaths(text)) {
    if(pattern.startsWith('@'))continue;
    if(/^https?:\/\//i.test(pattern))throw Error('External ui_page needs project review');
    inside(source,pattern);
    if(!list.some(f=>globPattern(pattern).test(f)))throw Error('Missing manifest asset: '+pattern);
  }
  return 'Local paths exist; runtime dependencies NOT verified';
}
export function resolveNuiAsset(source,html,url){
  const decoded=decodeURIComponent(url.split(/[?#]/)[0]);
  const target=path.resolve(decoded.startsWith('/')?source:path.dirname(html),decoded.startsWith('/')?'.'+decoded:decoded);
  inside(source,path.relative(source,target));noLinks(target);return target;
}
export async function staticChecks(ctx) {
  await ctx.check('manifest',()=>manifestCheck(ctx.source));
  const all=files(ctx.source).filter(f=>!path.relative(ctx.source,f).split(path.sep).includes('node_modules'));
  for(const f of all.filter(f=>/\.(?:js|mjs|cjs)$/.test(f)))ctx.exec('JS syntax: '+path.relative(ctx.source,f),process.execPath,['--check',f]);
  const lua=all.filter(f=>f.endsWith('.lua')),luac=luaCompiler();
  if(lua.length&&!luac)ctx.skip('Lua syntax','Lua 5.4 compiler unavailable; set FLECITY_LUAC');
  else for(const f of lua)ctx.exec('Lua syntax: '+path.relative(ctx.source,f),luac,['-p',f]);
  await ctx.check('NUI local assets',()=>{
    let count=0;
    const served=manifestPaths(fs.readFileSync(path.join(ctx.source,'fxmanifest.lua'),'utf8')).filter(p=>!p.startsWith('@'));
    for(const f of all.filter(f=>f.endsWith('.html')&&served.some(p=>globPattern(p).test(path.relative(ctx.source,f).split(path.sep).join('/'))))) {
      count++;
      for(const [,url] of fs.readFileSync(f,'utf8').matchAll(/(?:src|href)\s*=\s*["']([^"']+)["']/g)) {
        if(/^(?:https?:|data:|#|nui:|javascript:)/i.test(url)||url.startsWith('//'))continue;
        const clean=url.split(/[?#]/)[0];if(!clean)continue;
        const target=resolveNuiAsset(ctx.source,f,clean);
        if(!fs.existsSync(target))throw Error('Missing NUI asset: '+path.relative(ctx.source,target));
      }
    }
    return count+' HTML files (browser behavior not tested)';
  });
  for(const f of all.filter(f=>f.endsWith('.sql')))await ctx.check('SQL source: '+path.relative(ctx.source,f),()=>{
    if(/\b(?:CREATE\s+DATABASE|USE\s+|GRANT\s+|INTO\s+OUTFILE|LOAD\s+DATA)\b/i.test(fs.readFileSync(f,'utf8')))throw Error('DB/privilege/file operation needs custom isolated adapter');
    return 'Isolation source guard only; execution is --suite db';
  });
}
export async function runProject(config,suite='static') {
  if(!['static','db','nui','live','game','all'].includes(suite))throw Error('Unknown suite');
  const run=newRun(config.id,suite);run.logStart=bookmark();
  const ctx={...config,run,read:p=>fs.readFileSync(inside(config.source,p),'utf8'),
    skip:(name,why)=>result(run,name,'NOT_RUN',why),
    async check(name,fn){try{result(run,name,'PASS',(await fn())||'');}catch(e){result(run,name,'FAIL',e.message);}},
    exec(name,exe,args,opts={}){
      const r=command(exe,args,{cwd:config.source,...opts});
      fs.writeFileSync(path.join(run.dir,'logs',String(run.checks.length).padStart(3,'0')+'.txt'),r.output);
      result(run,name,r.missing?'NOT_RUN':r.ok?'PASS':'FAIL',r.output||r.error||'');return r;
    }
  };
  try {
    if(!fs.existsSync(config.source)){result(run,'source','NOT_RUN','Not found: '+config.source);return saveRun(run);}
    run.sourceInventory=inventory(config.source);run.sourceHash=sha(JSON.stringify(run.sourceInventory));
    const adapterPath=inside(tool,'adapters/'+(config.adapter||'generic')+'.mjs');noLinks(adapterPath);
    const adapter=await import(pathToFileURL(adapterPath).href);
    let custom=null;
    if(config.testAdapter){
      const p=inside(repo,config.testAdapter);noLinks(p);
      if(fs.existsSync(p))custom=await import(pathToFileURL(p).href);
      else ctx.skip('Project adapter','Configured adapter file absent');
    }
    for(const selected of suite==='all'?['static','db','nui','game','live']:[suite]) {
      run.activeSuite=selected;
      if(selected==='static'){await staticChecks(ctx);if(adapter.static)await adapter.static(ctx);if(custom?.staticChecks)await custom.staticChecks(ctx);}
      if(selected==='db'){if(adapter.db)await adapter.db(ctx);else ctx.skip('DB integration','No project DB adapter registered');}
      if(selected==='nui')await browserChecks(ctx,custom?.nui||adapter.nui,custom?.nuiPrepare||adapter.nuiPrepare);
      if(selected==='game') {
        if(!config.modules?.length)ctx.skip('Game simulation','No rule/AI module registered');
        for(const name of config.modules||[]){
          const file=inside(repo,name);noLinks(file);
          ctx.exec('Game module: '+name,process.execPath,[path.join(tool,'module-runner.mjs'),name,path.relative(repo,ctx.source)],{timeout:60000});
        }
      }
      if(selected==='live'){
        ctx.skip('FiveM integration','Use server run for the approved read-only native selftest; this suite issues no engine commands');
        ctx.skip('NUI/FiveM client','No approved client automation configured; attach manual evidence');
      }
    }
  }catch(e){result(run,'runner','FAIL',e.message);}
  return saveRun(run);
}
