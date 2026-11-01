import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {runCached} from '../test-cache.mjs';

test('PASS is reused only for exact source, test code, conditions and freshness',async t=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'flecity-cache-'));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  const source=path.join(root,'source'),cache=path.join(root,'cache');fs.mkdirSync(source);
  fs.writeFileSync(path.join(source,'main.lua'),'old');
  let calls=0,time=100000;
  const base={app:'loop',source,suite:'static',conditions:{viewport:'phone'},root:cache,codeHash:'a'.repeat(64),now:()=>time,
    execute:async()=>{calls++;return {status:'PASS',code:0,output:'PASS'};}};
  assert.equal((await runCached(base)).reused,false);
  assert.equal((await runCached(base)).reused,true);
  assert.equal(calls,1);
  assert.equal((await runCached({...base,codeHash:'b'.repeat(64)})).reused,false);
  assert.equal((await runCached({...base,conditions:{viewport:'desktop'}})).reused,false);
  fs.writeFileSync(path.join(source,'main.lua'),'new');
  assert.equal((await runCached(base)).reused,false);
  time+=13*60*60*1000;
  assert.equal((await runCached(base)).reused,false);
});
test('FAIL or corrupt cache is never reused',async t=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'flecity-cache-fail-'));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  const source=path.join(root,'source'),cache=path.join(root,'cache');fs.mkdirSync(source);
  let calls=0;const args={app:'wave',source,suite:'nui',root:cache,codeHash:'a'.repeat(64),execute:async()=>{calls++;return {status:'FAIL',code:1,output:'FAIL'};}};
  await runCached(args);await runCached(args);assert.equal(calls,2);
  fs.mkdirSync(path.join(cache,'wave'),{recursive:true});fs.writeFileSync(path.join(cache,'wave','nui.json'),'{bad');
  await runCached(args);assert.equal(calls,3);
});
