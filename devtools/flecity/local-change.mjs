import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {command,inside,noLinks,sha,json,readJSON,repo,inventory,identifier} from './core.mjs';
import {checkpoint} from './scaffold.mjs';

export function localRegressionGate(app,peers,results){
  const affected=[app,...peers];
  if(results.find(r=>r.id==='toolkit')?.status!=='PASS')return false;
  return affected.every(id=>{
    const r=results.find(r=>r.id===id);
    const required=['static','nui',...(id==='link'?['game','virtual-multiplayer']:[])];
    return r?.sourceUnchanged===true&&required.every(s=>r.suites?.some(t=>t.suite===s&&t.status==='PASS'))&&!r.suites?.some(s=>s.status==='FAIL'||s.status==='BLOCKED');
  });
}
export function prepareLocalChange(file,policy,workspace=repo){
  const proposalRoot=path.join(workspace,'.flecity-dev','proposals');inside(proposalRoot,path.relative(proposalRoot,path.resolve(file)));noLinks(file);
  const proposal=readJSON(file),profile=policy.apps[proposal.app];
  identifier(proposal.app);for(const peer of profile?.sharedWith||[])identifier(peer);
  if(policy.mode!=='submission-priority'||profile?.track!=='submission'||profile.automation!=='ACTIVE')throw Error('Proposal is not an active submission app');
  if(typeof proposal.reason!=='string'||!proposal.reason.trim()||!Array.isArray(proposal.changes)||proposal.changes.length<1||proposal.changes.length>5)throw Error('Expected reason and 1-5 exact text changes');
  const root=inside(workspace,profile.source);noLinks(root);
  const git=args=>command('git',args,{cwd:workspace});
  const branch=git(['branch','--show-current']);if(!branch.ok||!branch.output.trim().startsWith('codex/'))throw Error('Dedicated codex branch required');
  const staged=git(['diff','--cached','--name-only']);if(!staged.ok||staged.output.trim())throw Error('Existing staged changes must be preserved');
  const dirty=git(['status','--porcelain','--untracked-files=all','--',path.relative(workspace,root)]);
  if(!dirty.ok||dirty.output.trim())throw Error('Existing app changes must be preserved');
  const seen=new Set(),changes=[];
  for(const c of proposal.changes){
    const target=inside(root,c.path);noLinks(target);
    if(seen.has(target)||! /\.(lua|js|mjs|json|css|html|md|sql)$/.test(target)||/(^|[\\/])\.(git|codex|agents)([\\/]|$)|(?:private|credential|license|secret|approval).*\.json$/i.test(target))throw Error('Duplicate or forbidden proposal path');
    seen.add(target);
    if(typeof c.content!=='string'||Buffer.byteLength(c.content)>1024*1024||/cfxk_[\w-]{15,}|sk-(?:proj-)?[\w-]{25,}|-----BEGIN .*PRIVATE KEY|mysql:\/\//.test(c.content))throw Error('Oversized or sensitive proposal');
    const before=fs.existsSync(target)?fs.readFileSync(target):null;
    if((before?sha(before):null)!==c.baseSha256)throw Error('Source changed before proposal');
    if(before&&sha(before)===sha(c.content))throw Error('Proposal contains no change');
    changes.push({target,relative:path.relative(workspace,target),before:before?.toString('base64')??null,content:c.content,afterHash:sha(c.content)});
  }
  return {id:crypto.randomUUID(),app:proposal.app,peers:profile.sharedWith||[],reason:proposal.reason,workspace,sourceRoot:root,changes};
}
export function applyLocalChange(change){
  const dir=path.join(change.workspace,'.flecity-dev','development',change.id);noLinks(dir);fs.mkdirSync(dir,{recursive:true});
  json(path.join(dir,'before.json'),change);
  // Validate the entire batch before the first write.
  for(const c of change.changes){noLinks(c.target);const current=fs.existsSync(c.target)?sha(fs.readFileSync(c.target)):null;if(current!==(c.before===null?null:sha(Buffer.from(c.before,'base64'))))throw Error('Concurrent source change');}
  const applied=[];
  try{for(const c of change.changes){fs.mkdirSync(path.dirname(c.target),{recursive:true});fs.writeFileSync(c.target,c.content,{flag:c.before===null?'wx':'w'});applied.push(c);}}
  catch(e){
    json(path.join(dir,'result.json'),{status:'APPLY_FAILED_REVIEW',app:change.app,reason:'Write failed; inspect saved before.json, do not assume a fully applied proposal'});
    for(const c of applied.reverse()){
      if(sha(fs.readFileSync(c.target))!==c.afterHash)throw Error('Partial proposal has concurrent edits; review saved before.json');
      if(c.before===null)fs.unlinkSync(c.target);else fs.writeFileSync(c.target,Buffer.from(c.before,'base64'));
    }
    throw Error('APPLY_FAILED_REVIEW: '+e.message+'; saved '+path.join(dir,'before.json'));
  }
  return change;
}
export function rollbackLocalChange(change){
  // Never revert someone else's intervening edit; retain both versions for review instead.
  for(const c of change.changes){noLinks(c.target);if(!fs.existsSync(c.target)||sha(fs.readFileSync(c.target))!==c.afterHash)throw Error('Concurrent edits: automatic rollback refused');}
  for(const c of change.changes){if(c.before===null)fs.unlinkSync(c.target);else fs.writeFileSync(c.target,Buffer.from(c.before,'base64'));}
}
export function finishLocalChange(change,results){
  const journal=path.join(change.workspace,'.flecity-dev','development',change.id,'result.json');
  if(!localRegressionGate(change.app,change.peers,results)){
    try{rollbackLocalChange(change);json(journal,{status:'ROLLED_BACK',app:change.app,reason:'Required local regression did not pass'});return {status:'ROLLED_BACK',app:change.app};}
    catch(e){json(journal,{status:'REVIEW_REQUIRED',app:change.app,reason:e.message});return {status:'REVIEW_REQUIRED',app:change.app,reason:e.message};}
  }
  const appCommits={};
  try{
    for(const c of change.changes)if(sha(fs.readFileSync(c.target))!==c.afterHash)throw Error('Tested bytes changed');
    const sourceHash=sha(JSON.stringify(inventory(change.sourceRoot)));
    if([change.app,...change.peers].some(id=>results.find(r=>r.id===id)?.sourceHash!==sourceHash))throw Error('Source tree changed or shared apps tested different bytes');
    for(const id of [change.app,...change.peers])appCommits[id]=checkpoint({id,source:change.sourceRoot},change.reason,path.join(change.workspace,'.flecity-dev'));
    const git=args=>{const r=command('git',args,{cwd:change.workspace});if(!r.ok)throw Error(r.output);return r.output.trim();};
    if(git(['diff','--cached','--name-only']))throw Error('Other changes staged during regression');
    const paths=change.changes.map(c=>c.relative);git(['add','--',...paths]);
    git(['-c','core.hooksPath=NUL','commit','-m','fix('+change.app+'): '+change.reason.slice(0,120),'--',...paths]);
    const commit=git(['rev-parse','HEAD']);json(journal,{status:'COMMITTED',app:change.app,paths,commit,appCommits});return {status:'COMMITTED',app:change.app,paths,commit,appCommits};
  }catch(e){const status=Object.keys(appCommits).length?'APP_LOCAL_SAVED_PARENT_PENDING':'VERIFIED_UNSAVED';json(journal,{status,app:change.app,appCommits,reason:e.message});return {status,app:change.app,appCommits,reason:'Verified changes retained; inspect local Git save result'};}
}
