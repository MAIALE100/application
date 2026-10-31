import {spawn} from 'node:child_process';
import {redact} from './core.mjs';

export function eligible(id,policy,history,now=Date.now()){
  const app=policy.apps[id];
  if(!app||app.automation!=='ACTIVE'||app.migration==='PAUSED'||app.migration==='BLOCKED')return false;
  return !(history[id]?.nextEligibleAt>now);
}
export async function isolatedJobs(jobs,execute,history,now=Date.now()){
  const results=[];
  for(const job of jobs){
    let result;
    try{result=await execute(job);}catch(e){result={status:'FAIL',detail:redact(e.message)};}
    const failed=['FAIL','BLOCKED'].includes(result.status);
    const failures=failed?(history[job.id]?.failures||0)+1:0;
    history[job.id]={failures,nextEligibleAt:failed?now+(failures>=3?24*3600000:3600000):0,lastStatus:result.status};
    results.push({id:job.id,...result});
  }
  return results;
}
export function runNode(args,{cwd,timeout=120000}={}){
  return new Promise(resolve=>{
    const child=spawn(process.execPath,args,{cwd,windowsHide:true,shell:false,stdio:['ignore','pipe','pipe']});
    let output='',timedOut=false,overflow=false;
    const append=chunk=>{if(output.length<2*1024*1024)output+=chunk;else{overflow=true;stop();}};
    const stop=()=>{
      if(process.platform==='win32'&&child.pid){
        const kill=spawn('taskkill.exe',['/PID',String(child.pid),'/T','/F'],{windowsHide:true,stdio:'ignore'});
        kill.on('error',()=>child.kill());kill.on('close',code=>{if(code!==0)child.kill();});
        const fallback=setTimeout(()=>child.kill(),2000);fallback.unref();
      }else child.kill('SIGKILL');
    };
    child.stdout.on('data',append);child.stderr.on('data',append);
    const timer=setTimeout(()=>{timedOut=true;stop();},Math.max(1,timeout));
    child.on('error',error=>{clearTimeout(timer);resolve({status:'FAIL',code:null,output:redact(error.message)});});
    child.on('close',code=>{clearTimeout(timer);resolve({status:code===0&&!timedOut&&!overflow?'PASS':code===2&&!timedOut&&!overflow?'NOT_RUN':'FAIL',code,timedOut,overflow,output:redact(output)});});
  });
}
