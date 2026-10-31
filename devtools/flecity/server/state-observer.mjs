import {getEndpoint,validateCounts} from './connection.mjs';
import {redact} from '../core.mjs';

export async function localThenObservation(work,observe=observePublicState){
  const results=await work();
  let serverObservation;
  try{serverObservation=await observe();}catch(e){serverObservation={status:'UNKNOWN',healthy:false,players:null,authoritative:false,errors:[redact(e.message)]};}
  return {results,serverObservation};
}

// No config writes, bridge requests, process starts or player identifiers are saved.
export async function observePublicState(fetch=getEndpoint,now=Date.now){
  const readings=await Promise.allSettled(['info.json','dynamic.json','players.json'].map(fetch));
  const errors=readings.filter(x=>x.status==='rejected').map(x=>redact(x.reason?.message||'Unavailable'));
  if(errors.length)return {status:readings.every(x=>x.status==='rejected')&&errors.every(x=>/ECONNREFUSED/.test(x))?'UNREACHABLE':'UNKNOWN',healthy:false,players:null,authoritative:false,checkedAt:new Date(now()).toISOString(),errors};
  try{
    const [info,dynamic,players]=readings.map(x=>x.value);
    if(typeof info?.server!=='string'||!Array.isArray(info.resources))throw Error('Unrecognized server response');
    const counts=validateCounts(dynamic,players);
    return {status:counts.consistent?'RUNNING':'UNKNOWN',healthy:counts.consistent,players:counts.consistent?counts.dynamicCount:null,authoritative:false,
      nativeProof:'NOT_RUN — installed bridge status capability has not been approved',checkedAt:new Date(now()).toISOString()};
  }catch(e){return {status:'UNKNOWN',healthy:false,players:null,authoritative:false,errors:[redact(e.message)],checkedAt:new Date(now()).toISOString()};}
}
