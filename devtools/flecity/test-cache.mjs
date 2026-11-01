import fs from 'node:fs';
import path from 'node:path';
import {files,inventory,sha,state,tool,json,noLinks} from './core.mjs';

const suites=new Set(['static','db','nui','visual','game','virtual-multiplayer','tests']);
const maxAgeMs=12*60*60*1000;

export function testCodeHash(){
  const paths=files(tool).filter(file=>/\.(?:mjs|js|lua|ps1|json)$/.test(file)&&
    !path.relative(tool,file).split(path.sep).some(part=>['reports','node_modules'].includes(part)));
  return sha(JSON.stringify(paths.map(file=>[path.relative(tool,file).split(path.sep).join('/'),sha(fs.readFileSync(file))])));
}
export function cacheIdentity({source,suite,conditions={},codeHash=testCodeHash()}){
  if(!suites.has(suite))throw Error('Unrecognized cache suite');
  noLinks(source);
  return {sourceHash:sha(JSON.stringify(inventory(source))),testCodeHash:codeHash,
    conditionsHash:sha(JSON.stringify({suite,conditions,node:process.version,platform:process.platform})),suite};
}
export async function runCached({app,source,suite,conditions={},execute,now=Date.now,root=path.join(state,'test-cache'),codeHash}){
  if(!/^[a-z][a-z0-9_-]*$/.test(app)||typeof execute!=='function')throw Error('Invalid cache request');
  const identity=cacheIdentity({source,suite,conditions,codeHash});
  const file=path.join(root,app,suite+'.json');noLinks(file);
  if(fs.existsSync(file)){
    try{
      const prior=JSON.parse(fs.readFileSync(file,'utf8'));
      if(prior.status==='PASS'&&Object.keys(identity).every(key=>prior[key]===identity[key])&&
        Number.isFinite(prior.checkedAtMs)&&prior.checkedAtMs<=now()&&now()-prior.checkedAtMs<=maxAgeMs){
        return {status:'PASS',code:0,output:'PASS cached exact source/test/conditions '+prior.checkedAt,reused:true,stats:prior.stats,cache:prior};
      }
    }catch{} // Invalid evidence never grants PASS.
  }
  const result=await execute();
  if(result.status==='PASS')json(file,{...identity,status:'PASS',stats:result.stats||null,checkedAtMs:now(),checkedAt:new Date(now()).toISOString()});
  return {...result,reused:false,cache:identity};
}
