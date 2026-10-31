import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import crypto from 'node:crypto';
import {state,inside,noLinks,local,newRun,result} from '../core.mjs';
import {browserChecks} from '../nui.mjs';
function fixture(t){
  const id='nui_fixture_'+crypto.randomBytes(6).toString('hex'),run=newRun(id,'nui'),source=path.join(run.dir,'public');
  fs.mkdirSync(source);fs.writeFileSync(path.join(source,'index.html'),'<!doctype html><html><title>offline fixture</title><body>Fixture</body></html>');
  const ctx={id,source,nui:{entry:'index.html'},run,
    skip:(n,d)=>result(run,n,'NOT_RUN',d),
    async check(n,fn){try{result(run,n,'PASS',(await fn())||'');}catch(e){result(run,n,'FAIL',e.message);}}};
  t.after(()=>{const dir=path.join(state,'projects',id);inside(state,path.relative(state,dir));noLinks(dir);fs.rmSync(dir,{recursive:true,force:true});});
  return ctx;
}
function available(t){
  if(!local().browser?.module||!fs.existsSync(local().browser.module)){t.skip('Local browser dependency not configured');return false;}
  return true;
}
test('offline NUI blocks cross-origin HTTP and WebSocket traffic',async t=>{
  if(!available(t))return;
  let received=0;
  const probe=http.createServer((req,res)=>{received++;res.end('should not be reached');});
  probe.on('upgrade',(req,socket)=>{received++;socket.destroy();});
  await new Promise(resolve=>probe.listen(0,'127.0.0.1',resolve));
  t.after(()=>new Promise(resolve=>probe.close(resolve)));
  const ctx=fixture(t),port=probe.address().port;
  await browserChecks(ctx,async(_ctx,page)=>{
    const result=await page.evaluate(async port=>{
      const denied=await fetch('http://127.0.0.1:'+port+'/probe').then(()=>false,()=>true);
      await new Promise(resolve=>{
        const socket=new WebSocket('ws://127.0.0.1:'+port+'/probe');
        socket.onclose=socket.onerror=resolve;
        setTimeout(resolve,1000);
      });
      return denied;
    },port);
    assert.equal(result,true);assert.equal(received,0);
  });
  assert(ctx.run.checks.some(c=>c.status==='PASS'));
  assert(!ctx.run.checks.some(c=>c.status==='FAIL'||c.status==='NOT_RUN'));
  assert.equal(received,0);
});
test('failed browser assertion saves a real PNG and reports FAIL',async t=>{
  if(!available(t))return;
  const ctx=fixture(t);
  await browserChecks(ctx,async()=>{throw Error('INJECTED assertion failure');});
  assert(ctx.run.checks.some(c=>c.status==='FAIL'&&c.detail.includes('INJECTED')));
  const bytes=fs.readFileSync(path.join(ctx.run.dir,'screenshots','nui-failure.png'));
  assert.equal(bytes.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
});
