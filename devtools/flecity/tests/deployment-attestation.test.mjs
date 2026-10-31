import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {compareDeployment} from '../server/deployment-attestation.mjs';
test('equal version labels do not hide divergent runtime code',t=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'flecity-deployed-hash-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const source=path.join(root,'source'),target=path.join(root,'target');fs.mkdirSync(source);fs.mkdirSync(target);
 for(const dir of [source,target])fs.writeFileSync(path.join(dir,'fxmanifest.lua'),"version '0.79.6-test'\n");
 fs.writeFileSync(path.join(source,'party.lua'),'return true\n');fs.writeFileSync(path.join(target,'party.lua'),'return false\n');
 const result=compareDeployment(source,target,['fxmanifest.lua','party.lua']);
 assert.equal(result.status,'DIFFERENT');assert.deepEqual(result.files.map(r=>r.status),['MATCH','DIFFERENT']);
 assert.equal(result.mutated,false);
});
