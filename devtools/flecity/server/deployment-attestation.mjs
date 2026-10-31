import fs from 'node:fs';import path from 'node:path';
import {sha,command,noLinks,repo,inside} from '../core.mjs';
import {targetFor,approvedServer} from '../deployment.mjs';

// Read-only fingerprint of reviewed runtime entrypoints. Never infers equality from fxmanifest.version.
export const attestedFiles=['fxmanifest.lua','server/core/party.lua','web/party/app.js','web/play/app.js','client/main.lua','shared/game_registry.lua','web/shared/errors.js'];
export function compareDeployment(source,target,files=attestedFiles){
 const rows=files.map(file=>{
  const sourceFile=path.join(source,file),targetFile=path.join(target,file);
  noLinks(sourceFile);noLinks(targetFile);
  const sourceSha256=fs.existsSync(sourceFile)?sha(fs.readFileSync(sourceFile)):null;
  const deployedSha256=fs.existsSync(targetFile)?sha(fs.readFileSync(targetFile)):null;
  return {file,sourceSha256,deployedSha256,status:!sourceSha256||!deployedSha256?'MISSING':sourceSha256===deployedSha256?'MATCH':'DIFFERENT'};
 });
 const status=rows.some(r=>r.status==='MISSING')?'INCOMPLETE':rows.every(r=>r.status==='MATCH')?'MATCH':'DIFFERENT';
 return {status,scope:'selected runtime entrypoints; full resource identity requires a complete reviewed manifest',files:rows,checkedAt:new Date().toISOString(),mutated:false};
}
export function deploymentAttestation(config){
 let target,discovery='REGISTERED';
 try{target=targetFor(config);}catch{
  // Inspection fallback only. This path is never passed to deployment or update code.
  const txData=inside(approvedServer,'txData');
  try{
   const candidates=fs.readdirSync(txData,{withFileTypes:true}).filter(e=>e.isDirectory())
    .map(e=>inside(txData,path.join(e.name,'resources',config.resource)))
    .filter(p=>fs.existsSync(path.join(p,'fxmanifest.lua')));
   if(candidates.length!==1)return {status:'TARGET_UNAVAILABLE',reason:'Expected exactly one inspected test resource; found '+candidates.length,mutated:false};
   target=candidates[0];noLinks(target);discovery='READ_ONLY_INSPECTED_PATH';
  }catch(e){return {status:'TARGET_UNAVAILABLE',reason:e.message,mutated:false};}
 }
 const git=command('git',['rev-parse','HEAD'],{cwd:repo});
 const dirty=command('git',['status','--porcelain','--',path.relative(repo,config.source)],{cwd:repo});
 return {...compareDeployment(config.source,target),resource:config.resource,target,discovery,workspaceHead:git.ok?git.output.trim():null,workspaceSourceDirty:!dirty.ok||!!dirty.output.trim()};
}
