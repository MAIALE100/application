import fs from 'node:fs';
import path from 'node:path';
import { repo,state,tool,project,local,saveLocal,readJSON,json,command,files,noLinks,inside,inventory,sha,identifier,locked,luaRuntime,luaCompiler } from './core.mjs';
import { runProject } from './checks.mjs';
import { scaffold,register,importSource,checkpoint,gitSnapshot } from './scaffold.mjs';
import { backup,plan,apply,prepareCandidate } from './deployment.mjs';
import {preflight} from './preflight.mjs';
import {labCommand} from './lab/client.mjs';
import {serverCommand} from './server/readonly.mjs';
import { attach,collect } from './evidence.mjs';
import {createFixturePlan,verifyFixtureDB} from './fixtures/plan.mjs';

const argv=process.argv.slice(2),verb=argv.shift(),id=argv.shift();
function option(name,fallback=null){const i=argv.indexOf('--'+name);return i<0?fallback:argv[i+1];}
const flag=name=>argv.includes('--'+name);
function help(){
  console.log([
    'Flecity local tools (Node.js 22+, no GitHub/network requirement)',
    'flecity list | doctor',
    'flecity fixture plan | fixture verify-db --plan <uuid> (explicit per-plan DB approval required)',
    'flecity server check|logs|verify <project> (existing server, read-only)',
    'flecity server plan-bridge (prepare only; initial approval required)',
    'flecity server run <project> (approved bridge only; correlated native summary)',
    'flecity server prepare-client <project> (read-only scenario plan; no client actions)',
    'flecity new <id> --kind lb-phone|job|game|resource [--language lua|js]',
    'flecity register <id> --source <repo-relative-directory> --kind <kind> --resource <resource>',
    'flecity import <id> --from <existing-resource-directory> [--provenance <note>]',
    'flecity snapshot <id> --ref <local-git-ref> [--resource-path <git-tree-directory>]',
    'flecity test <id|all> --suite static|db|nui|game|live|all',
    'flecity status <id|all>',
    'flecity checkpoint <id> --message <local-note>',
    'flecity checkpoint toolkit --message <local-note>',
    'flecity module <id> --file <repo-relative-rule-module.mjs>',
    'flecity backup <id>',
    'flecity candidate <id> (local-only merge preserving deployed-only files)',
    'flecity preflight <id> (read-only; never starts a live test)',
    'flecity plan <id> [--restore <backup-id>]',
    'flecity apply <id> --plan <uuid> --offline-confirm <resource> --db-backup-confirmed [--review-confirmed <uuid>] [--allow-shared-resource] [--allow-removals]',
    'flecity logs <id> --run <run-id>',
    'flecity attach <id> --file <image-or-text> --kind screenshot|note',
    'No command stops/restarts the whole existing FXServer or accesses license keys.'
  ].join('\n'));
}
try{
  if(verb==='fixture'){
    if(id==='plan')console.log(createFixturePlan().file);
    else if(id==='verify-db')process.exitCode=await verifyFixtureDB(option('plan'));
    else throw Error('Expected fixture plan or verify-db');
  }
  else if(verb==='server'){await serverCommand(id,argv[0]);}
  else if(verb==='lab'){throw Error('Dedicated server retired by user instruction; use flecity server check/logs/verify');}
  else if(!verb||verb==='help'){help();}
  else if(verb==='list'){
    for(const file of files(path.join(tool,'projects')).filter(f=>f.endsWith('.json'))){
      const p=readJSON(file);console.log(p.id.padEnd(12)+p.kind.padEnd(10)+p.resource+' <- '+project(p.id).source);
    }
  }else if(verb==='doctor'){
    console.log('Node: '+process.version);
    console.log('Git: '+command('git',['--version']).output.trim());
    console.log('Lua: '+(luaRuntime()||'NOT FOUND')+' | luac: '+(luaCompiler()||'NOT FOUND'));
    console.log('MariaDB bin: '+(local().mariaBin||'NOT CONFIGURED'));
    console.log('Deployment enabled: '+(local().server?.deploymentEnabled===true));
  }else if(verb==='module'){
    const p=project(id),rel=option('file'),file=inside(repo,rel);noLinks(file);
    if(!file.endsWith('.mjs')||!fs.existsSync(file))throw Error('Expected existing .mjs rule/AI module');
    const checked=command(process.execPath,['--check',file]);if(!checked.ok)throw Error(checked.output);
    const configFile=path.join(tool,'projects',p.id+'.json'),raw=readJSON(configFile);
    raw.modules=[...new Set([...(raw.modules||[]),rel])];json(configFile,raw);console.log('Module registered; run --suite game');
  }else if(verb==='new'){console.log(scaffold(id,option('kind','resource'),repo,path.join(tool,'projects'),option('language','lua')));}
  else if(verb==='register'){console.log(register(id,option('source',id),option('kind','resource'),option('resource',id)));}
  else if(verb==='import'){
    project(id);const source=option('from');if(!source)throw Error('--from required');
    console.log(importSource(id,path.resolve(source),option('provenance','local read-only source copy')));
  }else if(verb==='snapshot'){
    project(id);const raw=readJSON(path.join(tool,'projects',id+'.json')),ref=option('ref');if(!ref)throw Error('--ref required');
    console.log(gitSnapshot(id,ref,option('resource-path',raw.source)));
  }else if(verb==='test'){
    const ids=id==='all'?fs.readdirSync(path.join(tool,'projects')).filter(f=>f.endsWith('.json')).map(f=>path.basename(f,'.json')):[id];
    let code=0;
    for(const name of ids){
      const run=await locked('test-'+project(name).resource,()=>runProject(project(name),option('suite','static')));
      if(run.status==='FAIL')code=1;else if(run.status!=='PASS'&&code===0)code=2;
    }
    process.exitCode=code;
  }else if(verb==='status'){
    const ids=id==='all'?fs.readdirSync(path.join(tool,'projects')).filter(f=>f.endsWith('.json')).map(f=>path.basename(f,'.json')):[id];
    for(const name of ids){
      identifier(name);const file=path.join(state,'projects',name,'latest.json');
      if(!fs.existsSync(file)){console.log(name+': NOT_RUN');continue;}
      const r=readJSON(file);console.log(name+': '+r.status+' ('+r.suite+') '+r.id);
      for(const suite of ['static','db','nui','game','live','preflight','server-readonly','server-native','client-plan']){
        const f=path.join(state,'projects',name,suite+'-latest.json');
        const s=fs.existsSync(f)?readJSON(f):null;
        console.log('  '+suite.padEnd(7)+(s?.status||'NOT_RUN').padEnd(9)+' source='+(s?.sourceHash?.slice(0,12)||'-'));
      }
      for(const c of r.checks.filter(c=>c.status!=='PASS'))console.log('  '+c.status+' '+c.name+': '+c.detail.split('\n')[0]);
    }
  }else if(verb==='checkpoint'){
    console.log(await locked('checkpoint-'+id,()=>{
      if(id!=='toolkit')return checkpoint(project(id),option('message','local checkpoint'));
      const staging=path.join(state,'toolkit-source',Date.now().toString());
      fs.mkdirSync(staging,{recursive:true});
      for(const source of [...files(tool),path.join(repo,'devtools','AGENTS.md'),path.join(repo,'.gitignore'),path.join(repo,'flecity.cmd'),path.join(repo,'FLECITY_DEVELOPMENT.md'),path.join(repo,'AGENTS.md')]){
        if(!fs.existsSync(source))continue;
        const dest=inside(staging,path.relative(repo,source));fs.mkdirSync(path.dirname(dest),{recursive:true});fs.copyFileSync(source,dest);
      }
      return checkpoint({id:'toolkit',source:staging},option('message','local toolkit checkpoint'));
    }));
  }
  else if(verb==='backup'){await locked('deploy-'+project(id).resource,()=>backup(project(id)));}
  else if(verb==='candidate'){await locked('deploy-'+project(id).resource,()=>prepareCandidate(project(id)));}
  else if(verb==='preflight'){const r=await preflight(project(id));process.exitCode=r.status==='PASS'?0:2;}
  else if(verb==='plan'){await locked('deploy-'+project(id).resource,()=>plan(project(id),option('restore')));}
  else if(verb==='apply'){await apply(project(id),option('plan'),{offline:option('offline-confirm'),dbBackupConfirmed:flag('db-backup-confirmed'),shared:flag('allow-shared-resource'),removals:flag('allow-removals'),reviewed:option('review-confirmed')});}
  else if(verb==='logs'){collect(project(id),option('run'));}
  else if(verb==='attach'){attach(project(id),path.resolve(option('file')),option('kind','note'));}
  else throw Error('Unknown command: '+verb);
}catch(e){console.error('BLOCKED: '+e.message);process.exitCode=1;}
