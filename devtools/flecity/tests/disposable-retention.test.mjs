import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {releaseDisposableDatadir} from '../database.mjs';
test('disposable cleanup refuses live, failed, outside-root or non-datadir targets and preserves evidence',t=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'flecity-db-release-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const data=path.join(root,'fixture/data');fs.mkdirSync(data,{recursive:true});fs.writeFileSync(path.join(data,'owned-fixture'),'synthetic');fs.writeFileSync(path.join(root,'result.json'),'evidence');
 const good={stopped:true,graceful:true,testsPassed:true};
 for(const proof of [{...good,stopped:false},{...good,graceful:false},{...good,testsPassed:false},{}])assert.throws(()=>releaseDisposableDatadir(root,data,proof));
 assert.throws(()=>releaseDisposableDatadir(data,root,good));assert.throws(()=>releaseDisposableDatadir(root,path.join(root,'result.json'),good));
 assert(fs.existsSync(data));releaseDisposableDatadir(root,data,good);assert(!fs.existsSync(data));assert.equal(fs.readFileSync(path.join(root,'result.json'),'utf8'),'evidence');
});
