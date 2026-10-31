import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import { identifier,inside,repo,tool,json,noLinks,copyTree,inventory,local,saveLocal,state,command } from './core.mjs';
import {defaultUpdatePolicy} from './server/update-gate.mjs';

export function register(id,source,kind='resource',resource=id,workspace=repo,registry=path.join(tool,'projects')) {
  identifier(id);identifier(resource);
  if(!['resource','lb-phone','job','game'].includes(kind))throw Error('Invalid kind');
  const sourceRoot=inside(workspace,source);noLinks(sourceRoot);
  if(!fs.existsSync(path.join(sourceRoot,'fxmanifest.lua')))throw Error('Resource manifest not found');
  const target=path.join(registry,id+'.json');noLinks(target);
  if(fs.existsSync(target))throw Error('Project already registered');
  const adapter=path.join(path.dirname(registry),'project-tests',id+'.mjs');noLinks(adapter);
  if(fs.existsSync(adapter))throw Error('Adapter already exists');
  fs.mkdirSync(path.dirname(adapter),{recursive:true});
  fs.writeFileSync(adapter,"export async function staticChecks(ctx){ctx.skip('Application behavior','Add resource-specific contract tests here');}\n",{flag:'wx'});
  json(target,{id,resource,source,kind,adapter:'generic',logTags:['script:'+resource],modules:[],virtualModules:[],autoUpdate:defaultUpdatePolicy(),testAdapter:path.relative(workspace,adapter).split(path.sep).join('/')});
  return target;
}
export function scaffold(id,kind='resource',workspace=repo,registry=path.join(tool,'projects'),language='lua') {
  identifier(id);
  if(!['resource','lb-phone','job','game'].includes(kind))throw Error('Invalid kind');
  if(!['lua','js'].includes(language))throw Error('Invalid language');
  const target=inside(workspace,id);noLinks(target);
  if(fs.existsSync(target)||fs.existsSync(path.join(registry,id+'.json')))throw Error('Refusing to overwrite existing source/registration');
  const content={
    'fxmanifest.lua':"fx_version 'cerulean'\ngame 'gta5'\nauthor 'Flecity'\nversion '0.1.0-dev'\nshared_script 'config.lua'\nclient_script 'client/main.lua'\nserver_script 'server/main.lua'\n",
    'config.lua':'FlecityConfig = { Debug = false }\n',
    'client/main.lua':"-- Client entry. Authenticate and authorize mutations server-side.\n",
    'server/main.lua':"-- Server entry. Never trust client identity/role; no startup DB writes by default.\n",
    'tests/flecity.mjs':"export async function staticChecks(ctx) {\n  ctx.skip('Application behavior', 'Replace this placeholder with project contract tests');\n}\n",
    'tests/README.md':'Run: flecity test '+id+' --suite all\nNo DB adapter or live automation is enabled by default.\n',
    'DEVELOPMENT.md':'Use the repository FLECITY_DEVELOPMENT.md and flecity test '+id+'. Keep production credentials out of source.\n'
  };
  if(kind==='lb-phone'){
    content['fxmanifest.lua']+="files { 'web/**/*' }\ndependency 'lb-phone'\n";
    content['client/main.lua']="local function register()\n    exports['lb-phone']:AddCustomApp({identifier='"+id+"',name='"+id+"',description='Development app',developer='Flecity',defaultApp=false,size=100,price=0,ui=GetCurrentResourceName()..'/web/index.html',icon='https://cfx-nui-'..GetCurrentResourceName()..'/web/icon.svg',fixBlur=true})\nend\nAddEventHandler('onClientResourceStart', function(resource)\n    if resource==GetCurrentResourceName() or resource=='lb-phone' then\n        if GetResourceState('lb-phone')=='started' then register() end\n    end\nend)\nAddEventHandler('onClientResourceStop', function(resource)\n    if resource==GetCurrentResourceName() and GetResourceState('lb-phone')=='started' then exports['lb-phone']:RemoveCustomApp('"+id+"') end\nend)\n";
    content['web/index.html']='<!doctype html><html lang="ja"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+id+'</title><link rel="stylesheet" href="app.css"><main><h1>'+id+'</h1><p>開発用テンプレート</p></main><script src="app.js"></script></html>\n';
    content['web/app.css']='body{margin:0;padding:1rem;background:#111827;color:#fff;font-family:sans-serif} main{max-width:25rem;margin:auto}\n';
    content['web/app.js']="'use strict';\n// NUI callbacks belong here; server-side permissions remain mandatory.\n";
    content['web/icon.svg']='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="12" fill="#2563eb"/><path d="M16 16h32v8H24v8h20v8H24v12h-8z" fill="white"/></svg>\n';
  }
  if(language==='js'){
    content['fxmanifest.lua']=content['fxmanifest.lua'].replaceAll(".lua'",".js'");
    delete content['config.lua'];delete content['client/main.lua'];delete content['server/main.lua'];
    content['config.js']="globalThis.FlecityConfig = { Debug: false };\n";
    content['server/main.js']="// Server entry. Authenticate mutations server-side; no startup DB writes.\n";
    content['client/main.js']="// FiveM client entry.\n";
    if(kind==='lb-phone')content['client/main.js']="const identifier='"+id+"';\non('onClientResourceStart', resource=>{\n if((resource===GetCurrentResourceName()||resource==='lb-phone')&&GetResourceState('lb-phone')==='started')exports['lb-phone'].AddCustomApp({identifier,name:identifier,description:'Development app',developer:'Flecity',defaultApp:false,size:100,price:0,ui:GetCurrentResourceName()+'/web/index.html',icon:'https://cfx-nui-'+GetCurrentResourceName()+'/web/icon.svg',fixBlur:true});\n});\non('onClientResourceStop', resource=>{if(resource===GetCurrentResourceName()&&GetResourceState('lb-phone')==='started')exports['lb-phone'].RemoveCustomApp(identifier);});\n";
  }
  for(const [rel,text]of Object.entries(content)){const f=inside(target,rel);fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,text,{flag:'wx'});}
  register(id,id,kind,id,workspace,registry);
  const profile=path.join(registry,id+'.json');
  const generated=JSON.parse(fs.readFileSync(profile,'utf8'));generated.testAdapter=id+'/tests/flecity.mjs';json(profile,generated);
  return target;
}
export function importSource(id,source,provenance='local read-only import') {
  identifier(id);noLinks(source);
  if(!fs.existsSync(path.join(source,'fxmanifest.lua')))throw Error('Import source lacks fxmanifest.lua');
  const tree=inventory(source),hash=command('git',['hash-object','--stdin'],{input:JSON.stringify(tree)});
  if(!hash.ok)throw Error('Local Git unavailable');
  const dest=path.join(state,'sources',id,hash.output.trim(),path.basename(source));
  if(!fs.existsSync(dest))copyTree(source,dest);
  if(JSON.stringify(inventory(dest))!==JSON.stringify(tree))throw Error('Imported inventory mismatch');
  const cfg=local();cfg.sources??={};cfg.sources[id]={path:path.relative(repo,dest),provenance,inspectionOnly:true,imported:new Date().toISOString(),inventory:tree};
  saveLocal(cfg);return dest;
}
export function gitSnapshot(id,ref,resourcePath){
  identifier(id);inside(repo,resourcePath);
  function git(args,binary=false){
    const r=spawnSync('git',['-C',repo,...args],{encoding:binary?null:'utf8',windowsHide:true,shell:false,timeout:20000,maxBuffer:64*1024*1024});
    if(r.error||r.status!==0)throw Error('Local Git snapshot failed');
    return r.stdout;
  }
  const commit=git(['rev-parse','--verify',ref+'^{commit}']).trim();
  if(!/^[a-f0-9]{40,64}$/.test(commit))throw Error('Unexpected Git commit');
  const entries=git(['ls-tree','-rz',commit,'--',resourcePath]).split('\0').filter(Boolean);
  if(!entries.length)throw Error('Resource missing in local ref');
  const root=path.join(state,'git-exports',id,commit,crypto.randomUUID()),dest=path.join(root,path.basename(resourcePath));
  {
    for(const line of entries){
      const match=line.match(/^(100644|100755) blob ([a-f0-9]+)\t(.+)$/);
      if(!match)throw Error('Only ordinary Git blobs allowed; symlink/submodule refused');
      if(!match[3].startsWith(resourcePath+'/'))throw Error('Git resource path mismatch');
      const relative=match[3].slice(resourcePath.length+1),file=inside(dest,relative);noLinks(file);
      fs.mkdirSync(path.dirname(file),{recursive:true});
      fs.writeFileSync(file,git(['cat-file','blob',match[2]],true),{flag:'wx'});
    }
  }
  const imported=importSource(id,dest,'Complete offline local Git snapshot '+commit+' / '+resourcePath);
  const cfg=local();cfg.sources[id].inspectionOnly=false;cfg.sources[id].gitCommit=commit;saveLocal(cfg);
  return imported;
}
export function checkpoint(config,message='local checkpoint') {
  const dir=path.join(state,'projects',config.id,'git');noLinks(dir);fs.mkdirSync(dir,{recursive:true});
  const git=(args)=>{const r=command('git',['-C',dir,...args]);if(!r.ok)throw Error(r.output);return r.output.trim();};
  if(!fs.existsSync(path.join(dir,'.git')))git(['init']);
  const snap=path.join(dir,'snapshots',new Date().toISOString().replace(/[:.]/g,'-'));
  copyTree(config.source,snap);
  git(['add','--','snapshots']);git(['-c','user.name=Flecity Local','-c','user.email=local@invalid','-c','core.hooksPath=NUL','commit','-m',message]);
  return git(['rev-parse','HEAD']);
}
