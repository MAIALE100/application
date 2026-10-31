import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import {local,inside,noLinks,readJSON,inventory,sha} from '../core.mjs';
import {targetFor,approvedServer} from '../deployment.mjs';
const allowed=new Set(['info.json','dynamic.json','players.json']);
export async function getEndpoint(endpoint){
  if(!allowed.has(endpoint))throw Error('Only read-only FiveM endpoints are allowed');
  return await new Promise((resolve,reject)=>{
    const request=http.get('http://127.0.0.1:30120/'+endpoint,{timeout:3000},response=>{
      if(response.statusCode!==200){response.resume();reject(Error(endpoint+' HTTP '+response.statusCode));return;}
      let text='',bytes=0;
      response.on('data',d=>{bytes+=d.length;if(bytes>2*1024*1024){response.destroy(Error('Endpoint size limit'));return;}text+=d;});
      response.on('error',reject);response.on('end',()=>{try{resolve(JSON.parse(text));}catch{reject(Error(endpoint+' invalid JSON'));}});
    });
    request.on('error',reject);request.on('timeout',()=>request.destroy(Error(endpoint+' timeout')));
  });
}
export function validateCounts(dynamic,players){
  const count=Number(dynamic?.clients);
  if(!Number.isInteger(count)||count<0||!Array.isArray(players))throw Error('Cannot establish tester count');
  return {dynamicCount:count,playersCount:players.length,idle:count===0&&players.length===0,consistent:count===players.length};
}
export function assertIdle(snapshot,now=Date.now()){
  if(!snapshot?.healthy||!snapshot.testers?.idle||!snapshot.testers?.consistent)throw Error('Tester connected or state uncertain: update/restart held');
  if(!Number.isFinite(snapshot.checkedAtMs)||now<snapshot.checkedAtMs||now-snapshot.checkedAtMs>2000)throw Error('Tester observation is stale; fetch again before any mutation');
}
export function dependencies(manifest){
  const stripped=manifest.replace(/--\[\[[\s\S]*?\]\]/g,'').replace(/--[^\n]*/g,'');
  const names=[];
  for(const block of stripped.matchAll(/\bdependenc(?:y|ies)\s*(\{[\s\S]*?\}|["'][^"']+["'])/g))
    for(const [,name]of block[0].matchAll(/["']([^"']+)["']/g))if(!name.startsWith('/'))names.push(name);
  return [...new Set(names)];
}
export async function snapshot(config,{allowStoppedTarget=false}={}){
  const target=targetFor(config);
  // Read only txAdmin profile location; never read server.cfg or license files.
  const profileFile=inside(approvedServer,'txData/default/config.json');noLinks(profileFile);
  const profile=readJSON(profileFile).server?.dataPath;
  if(!profile||!path.resolve(target).startsWith(path.resolve(profile)+path.sep))throw Error('Target is outside the active test profile');
  const [info,dynamic,players]=await Promise.all(['info.json','dynamic.json','players.json'].map(getEndpoint));
  if(!Array.isArray(info.resources)||typeof info.server!=='string')throw Error('Unexpected server identity response');
  const manifest=fs.readFileSync(path.join(target,'fxmanifest.lua'),'utf8'),required=dependencies(manifest);
  const missing=required.filter(name=>!info.resources.includes(name));
  const present=info.resources.includes(config.resource);
  if(missing.length||(!present&&!allowStoppedTarget))throw Error('Required resources not reported: '+missing.concat(present?[]:[config.resource]).join(','));
  return {project:config.id,resource:config.resource,target,healthy:true,serverVersion:info.server,
    targetReported:present,dependencies:required.map(name=>({name,reported:true})),
    testers:validateCounts(dynamic,players),targetHash:sha(JSON.stringify(inventory(target,true))),
    sourceHash:sha(JSON.stringify(inventory(config.source))),sharedWith:config.sharedWith||[],
    checkedAt:new Date().toISOString(),checkedAtMs:Date.now(),licenseAccessed:false};
}
