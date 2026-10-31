import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';

// Read-only source audit. Never follows junctions or prints file contents.
const current=process.cwd(), original='D:/FiveM_Dev/application';
const backup='D:/FiveM_Dev_Backups/application-20261031-200209';
const out=path.join(current,'devtools/flecity/reports/migration-20261031');
fs.mkdirSync(out,{recursive:true});
function git(root,...args){
  const r=spawnSync('git',['-c','safe.directory='+root,'-C',root,...args],{encoding:'utf8',env:{...process.env,GIT_OPTIONAL_LOCKS:'0'}});
  if(r.status!==0)throw Error(r.stderr);return r.stdout;
}
const excluded=new Set(['.git','node_modules','.flecity-dev','.vite']);
function inventory(root){
  const entries={}, skipped=[];
  function walk(dir){
    if(!fs.existsSync(dir))return;
    for(const e of fs.readdirSync(dir,{withFileTypes:true})){
      const file=path.join(dir,e.name),rel=path.relative(root,file).replaceAll('\\','/');
      if(e.isSymbolicLink()){skipped.push(rel);continue;}
      if(excluded.has(e.name)){skipped.push(rel);continue;}
      if(e.isDirectory())walk(file);
      else if(e.isFile())entries[rel]=crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
    }
  }
  walk(root);return {entries,skipped};
}
const old=inventory(original),fresh=inventory(current),saved=inventory(backup);
const changes=[];
for(const rel of [...new Set([...Object.keys(old.entries),...Object.keys(fresh.entries)])].sort()){
  const a=old.entries[rel],b=fresh.entries[rel];
  if(a!==b)changes.push({path:rel,status:!b?'OLD_ONLY':!a?'NEW_ONLY':'DIFFERENT',oldSha256:a,newSha256:b,backupMatchesOld:a!==undefined&&saved.entries[rel]===a});
}
const status=git(original,'status','--porcelain=v1','-z','-uall').split('\0').filter(Boolean);
const imports={};
const localPath=path.join(original,'.flecity-dev/local.json');
const local=fs.existsSync(localPath)?JSON.parse(fs.readFileSync(localPath,'utf8').replace(/^\uFEFF/,'')):{};
for(const id of ['base','link','wave','mining']){
  const relative=local.sources?.[id]?.path||path.join('.flecity-dev/sources',id);
  if(path.isAbsolute(relative)||relative.split(/[\\/]/).includes('..'))throw Error('Unexpected source path');
  const root=path.join(original,relative);
  const inv=inventory(root),other=inventory(path.join(backup,relative));
  imports[id]={root,files:Object.keys(inv.entries).length,hashes:inv.entries,skipped:inv.skipped,backupMatches:JSON.stringify(inv.entries)===JSON.stringify(other.entries)};
}
const result={original,current,backup,originalHead:git(original,'rev-parse','HEAD').trim(),newHead:git(current,'rev-parse','HEAD').trim(),originalBranch:git(original,'branch','--show-current').trim(),originalStatus:status,newStatus:git(current,'status','--porcelain=v1','-z','-uall').split('\0').filter(Boolean),changes,imports,exclusions:{old:old.skipped,new:fresh.skipped,backup:saved.skipped}};
fs.writeFileSync(path.join(out,'inventory.json'),JSON.stringify(result,null,2)+'\n');
fs.writeFileSync(path.join(out,'original-only-changes.tsv'),'status\tpath\tbackup_matches_old\n'+changes.filter(x=>x.status!=='NEW_ONLY').map(x=>[x.status,x.path,x.backupMatchesOld].join('\t')).join('\n')+'\n');
const summary={originalChanges:status.length,groups:{},imports:Object.fromEntries(Object.entries(imports).map(([id,x])=>[id,{files:x.files,backupMatches:x.backupMatches}]))};
for(const c of changes){const k=c.path.split('/')[0];summary.groups[k]??={};summary.groups[k][c.status]=(summary.groups[k][c.status]||0)+1;}
console.log(JSON.stringify(summary,null,2));
