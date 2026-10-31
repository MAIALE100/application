import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {backupTree} from '../deployment.mjs';
import {copyTree,inventory,sha} from '../core.mjs';

test('isolated complete-resource backup restores exact bytes and detects corruption',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'flecity-backup-drill-'));
 try{
  const source=path.join(root,'source'),backups=path.join(root,'backups'),restored=path.join(root,'restored');
  fs.mkdirSync(path.join(source,'web'),{recursive:true});fs.mkdirSync(backups);
  fs.writeFileSync(path.join(source,'fxmanifest.lua'),'fx_version "cerulean"\n');
  fs.writeFileSync(path.join(source,'web','app.js'),'window.fixture=true;\n');
  const original=inventory(source,true),backup=backupTree(source,backups,{resource:'fixture-only'});
  const manifest=JSON.parse(fs.readFileSync(path.join(backup,'backup.json'),'utf8'));
  assert.deepEqual(manifest.files,original);
  assert.equal(manifest.hash,sha(JSON.stringify(original)));
  copyTree(path.join(backup,'resource'),restored,true);
  assert.deepEqual(inventory(restored,true),original);
  fs.writeFileSync(path.join(restored,'web','app.js'),'corrupted');
  assert.notDeepEqual(inventory(restored,true),original);
  assert.deepEqual(inventory(path.join(backup,'resource'),true),original);
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
