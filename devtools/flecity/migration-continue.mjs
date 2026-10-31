// One-shot, fail-before-write import of reviewed, nonconflicting source trees.
import fs from 'node:fs';
import path from 'node:path';
import {repo,files,inventory,noLinks,inside,sha,readJSON} from './core.mjs';

const previous=readJSON(path.join(repo,'devtools/flecity/reports/migration-20261031/inventory.json'));
const origin='D:/FiveM_Dev/application';
const backup='D:/FiveM_Dev_Backups/application-20261031-200209';
const specs=[
  {id:'base',source:previous.imports.base.root,target:'flecity_base'},
  {id:'link',sharedWith:['loop'],source:previous.imports.link.root,target:'flecity_sources/flecity_games'},
  {id:'wave',source:previous.imports.wave.root,target:'wave'},
  {id:'flepri',source:path.join(origin,'puribooth'),target:'puribooth'}
];
const excluded=new Set(['dev-auto-reload.enabled','dev-build.txt','dev-reload-v2.active','dev-reload.token','dev-runtime.txt','runtime-active.txt']);
const plans=[];
for(const spec of specs){
  const target=inside(repo,spec.target);noLinks(target);
  if(fs.existsSync(target))throw Error('Existing destination: '+spec.target);
  const entries=[],omitted=[];
  for(const file of files(spec.source)){
    const rel=path.relative(spec.source,file).replaceAll('\\','/');
    if(excluded.has(rel)){omitted.push(rel);continue;}
    if(/(^|\/)(\.env(?:\..*)?|local\.json)$|\.(token|key|pem|pfx)$/i.test(rel))throw Error('Sensitive filename: '+rel);
    const bytes=fs.readFileSync(file),hash=sha(bytes);
    const saved=path.join(backup,path.relative(origin,file));noLinks(saved);
    if(!fs.existsSync(saved)||sha(fs.readFileSync(saved))!==hash)throw Error('Backup mismatch: '+rel);
    if(/\.(lua|[cm]?js|json|md|html|css|txt|py)$/i.test(rel)&&/cfxk_[\w-]{15,}|sk-(?:proj-)?[\w-]{25,}|-----BEGIN .*PRIVATE KEY|mysql:\/\//.test(bytes.toString('utf8')))throw Error('Secret candidate: '+rel);
    entries.push({rel,hash,bytes});
  }
  plans.push({...spec,entries,omitted});
}
const protectedTree=inventory(path.join(repo,'puriphoto'));
for(const plan of plans){
  for(const entry of plan.entries){
    const dest=inside(inside(repo,plan.target),entry.rel);noLinks(dest);
    fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,entry.bytes,{flag:'wx'});
    if(sha(fs.readFileSync(dest))!==entry.hash)throw Error('Copy mismatch');
  }
}
const reportDir=path.join(repo,'devtools/flecity/reports/independent-20261031');fs.mkdirSync(reportDir,{recursive:true});
fs.writeFileSync(path.join(reportDir,'imports.json'),JSON.stringify(plans.map(({entries,...p})=>({...p,entries:entries.map(({rel,hash})=>({path:rel,sha256:hash}))})),null,2)+'\n',{flag:'wx'});
fs.writeFileSync(path.join(reportDir,'puriphoto-protected.json'),JSON.stringify(protectedTree,null,2)+'\n',{flag:'wx'});
if(JSON.stringify(inventory(path.join(repo,'puriphoto')))!==JSON.stringify(protectedTree))throw Error('Protected tree changed');
console.log(JSON.stringify(plans.map(p=>({id:p.id,target:p.target,files:p.entries.length,omitted:p.omitted})),null,2));
