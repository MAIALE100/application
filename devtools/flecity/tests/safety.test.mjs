import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { repo,state,inside,identifier,noLinks,inventory,sha,copyTree,redact,readJSON,command,newRun,result,saveRun } from '../core.mjs';
import { manifestCheck,resolveNuiAsset } from '../checks.mjs';
import { backupTree,replaceTree,targetFor,approvedServer,mergeCandidate } from '../deployment.mjs';
import { assertDisposableDatadir } from '../database.mjs';
import { scaffold } from '../scaffold.mjs';
import { literalCreateTables } from '../adapters/schema-smoke.mjs';
const parent=path.join(state,'test-fixtures');fs.mkdirSync(parent,{recursive:true});
function fixture(t){
  const root=fs.mkdtempSync(path.join(parent,'safety-'));
  t.after(()=>{inside(parent,path.relative(parent,root));noLinks(root);fs.rmSync(root,{recursive:true,force:true});});
  return root;
}
function write(root,name,text){const file=inside(root,name);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,text);}
for(const bad of ['../outside','..','/','C:\\','C:drive','\\\\server\\share']){
  test('reject traversal/absolute target '+bad,()=>assert.throws(()=>inside(repo,bad)));
}
for(const bad of ['a/../../x','../base','Base','con','lpt1','a b','a;stop','']){
  test('reject project ID '+JSON.stringify(bad),()=>assert.throws(()=>identifier(bad)));
}
test('manifest globs and comments; external scripts ignored',t=>{
  const root=fixture(t);write(root,'fxmanifest.lua',"fx_version 'cerulean'\nclient_scripts {'client/*.lua','@other/init.lua'}\nfiles {'web/**/*'}\n-- ui_page 'http://localhost:3000/'");
  write(root,'client/main.lua','');write(root,'web/index.html','');assert.doesNotThrow(()=>manifestCheck(root));
  fs.unlinkSync(path.join(root,'client/main.lua'));assert.throws(()=>manifestCheck(root),/Missing/);
});
test('manifest rejects missing assets and traversal',t=>{
  const root=fixture(t);write(root,'fxmanifest.lua',"fx_version 'cerulean'\nfiles {'../secret'}");
  assert.throws(()=>manifestCheck(root),/escapes/);
});
test('NUI resource-root URLs resolve inside resource; traversal rejected',t=>{
  const root=fixture(t),html=path.join(root,'ui','dist','index.html');
  write(root,'ui/dist/assets/app.js','fixture');
  assert.equal(resolveNuiAsset(root,html,'/ui/dist/assets/app.js'),path.join(root,'ui','dist','assets','app.js'));
  assert.equal(resolveNuiAsset(root,html,'assets/app.js'),path.join(root,'ui','dist','assets','app.js'));
  assert.throws(()=>resolveNuiAsset(root,html,'../../../outside.js'));
  assert.throws(()=>resolveNuiAsset(root,html,'/%2e%2e/outside.js'));
});
test('backup verifies complete tree including node_modules',t=>{
  const root=fixture(t),source=path.join(root,'source');
  write(source,'fxmanifest.lua','fixture');write(source,'node_modules/dependency/index.js','retained');write(source,'.git/config','metadata');
  const b=backupTree(source,path.join(root,'backups'));
  assert.deepEqual(inventory(path.join(b,'resource'),true),inventory(source,true));
  assert.equal(readJSON(path.join(b,'backup.json')).hash,sha(JSON.stringify(inventory(source,true))));
});
for(const failpoint of ['before','after']){
  test('failed deploy restores target: '+failpoint,t=>{
    const root=fixture(t),source=path.join(root,'source'),target=path.join(root,'resources','demo');
    write(source,'version.txt','new');write(target,'version.txt','old');
    const original=inventory(target);
    assert.throws(()=>replaceTree(source,target,root,sha(JSON.stringify(original)),failpoint),/Injected/);
    assert.deepEqual(inventory(target),original);
  });
}
test('deploy and restore round trip retain previous copy',t=>{
  const root=fixture(t),source=path.join(root,'source'),target=path.join(root,'resources','demo');
  write(source,'new.txt','new');write(target,'old.txt','old');write(target,'.git/config','original metadata');
  const old=inventory(target,true),b=backupTree(target,path.join(root,'backups'));
  const applied=replaceTree(source,target,root,sha(JSON.stringify(old)));
  assert.deepEqual(inventory(target),inventory(source));assert.deepEqual(inventory(applied.previous,true),old);
  replaceTree(path.join(b,'resource'),target,root,sha(JSON.stringify(inventory(target,true))));
  assert.deepEqual(inventory(target,true),old);
});
test('deploy rejects changed target before any switch',t=>{
  const root=fixture(t),source=path.join(root,'source'),target=path.join(root,'resources','demo');
  write(source,'a','new');write(target,'a','old');const digest=sha(JSON.stringify(inventory(target)));
  write(target,'a','concurrent');
  assert.throws(()=>replaceTree(source,target,root,digest),/changed/);
  assert.equal(fs.readFileSync(path.join(target,'a'),'utf8'),'concurrent');
});
test('junctions are refused in destination and source',t=>{
  const root=fixture(t),outside=path.join(root,'outside'),link=path.join(root,'link');fs.mkdirSync(outside);
  try{fs.symlinkSync(outside,link,'junction');}catch(e){if(e.code==='EPERM'){t.skip('OS disallows junction creation');return;}throw e;}
  assert.throws(()=>noLinks(path.join(link,'future.txt')),/junction/);
  assert.throws(()=>inventory(root),/junction/);
});
test('DB datadir cannot be existing server data',()=>{
  assert.throws(()=>assertDisposableDatadir(path.join(state,'db'),'D:\\MariaDB\\data'));
  assert.throws(()=>assertDisposableDatadir(path.join(state,'db'),path.join(state,'db')));
});
test('production and mismatched resource destinations are blocked',()=>{
  const p={id:'fixture',resource:'fixture'};
  assert.throws(()=>targetFor(p,{type:'production',root:approvedServer,targets:{fixture:'resources/fixture'}}));
  assert.throws(()=>targetFor(p,{type:'test',root:'D:\\Production',targets:{fixture:'resources/fixture'}}));
  assert.throws(()=>targetFor(p,{type:'test',root:approvedServer,targets:{fixture:'txData/profile/resources/other'}}));
  assert.throws(()=>targetFor(p,{type:'test',root:approvedServer,targets:{fixture:'../fixture'}}));
  assert.throws(()=>targetFor(p,{type:'test',root:approvedServer,targets:{fixture:'txData/profile/cache/fixture'}}));
});
test('resource-root enrollment rejects paths normalized outside resources',()=>{
  const p={id:'fixture',resource:'fixture'},env={type:'test',root:approvedServer,resourcesRoot:'txData/profile/resources',targets:{fixture:'txData/profile/resources/fixture'}};
  assert.equal(targetFor(p,env),path.resolve(approvedServer,'txData/profile/resources/fixture'));
  env.targets.fixture='txData/profile/resources/../fixture';
  assert.throws(()=>targetFor(p,env));
  env.targets.fixture='txData/profile/resources/../../other/resources/fixture';
  assert.throws(()=>targetFor(p,env));
});
for(const kind of ['resource','lb-phone','job','game'])for(const language of ['lua','js']){
  test('generate '+kind+'/'+language+' and reject overwrite',t=>{
    const root=fixture(t),registry=path.join(root,'tools','projects'),id='fixture_'+kind.replace('-','_');
    const target=scaffold(id,kind,root,registry,language);
    assert.doesNotThrow(()=>manifestCheck(target));
    assert(fs.existsSync(path.join(target,'tests/flecity.mjs')));
    const before=inventory(target);assert.throws(()=>scaffold(id,kind,root,registry),/overwrite/);
    assert.deepEqual(inventory(target),before);
    const p=readJSON(path.join(registry,id+'.json'));assert.equal(p.kind,kind);assert(p.logTags.length);
    if(language==='js')for(const rel of ['config.js','client/main.js','server/main.js'])assert(command(process.execPath,['--check',path.join(target,rel)]).ok);
  });
}
test('redact DB URLs and credential-like output',()=>{
  const text=redact('mysql://root:secret@localhost/db password=abc token:xyz discord:123 test@example.org');
  for(const secret of ['root:secret','abc','xyz','discord:123','test@example.org'])assert(!text.includes(secret));
});
test('literal DDL extraction handles default engine and skips ALTER',()=>{
  const text='MySQL.query.await([[CREATE TABLE IF NOT EXISTS fixture (id INT PRIMARY KEY)]])\nMySQL.query.await([[ALTER TABLE fixture ADD other INT]])';
  assert.equal(literalCreateTables(text).length,1);
  assert.throws(()=>literalCreateTables('no DDL'));
  assert.throws(()=>literalCreateTables('[[CREATE TABLE IF NOT EXISTS fixture (%s)]]'));
});
test('NOT_RUN never becomes PASS; all-suite results keep separate status',t=>{
  const id='status_fixture_'+Date.now(),dir=path.join(state,'projects',id),run=newRun(id,'all');
  t.after(()=>{inside(state,path.relative(state,dir));noLinks(dir);fs.rmSync(dir,{recursive:true,force:true});});
  run.activeSuite='static';result(run,'fixture static','PASS','executed');
  run.activeSuite='live';result(run,'fixture live','NOT_RUN','not executed');
  assert.equal(saveRun(run).status,'NOT_RUN');
  assert.equal(readJSON(path.join(dir,'static-latest.json')).status,'PASS');
  assert.equal(readJSON(path.join(dir,'live-latest.json')).status,'NOT_RUN');
  assert.equal(readJSON(path.join(dir,'db-latest.json')).status,'NOT_RUN');
});
test('candidate assembly preserves deployed-only files and unchanged bytes',t=>{
  const root=fixture(t),source=path.join(root,'source'),deployed=path.join(root,'deployed'),candidate=path.join(root,'candidate');
  write(source,'client.lua','print("same")\n');write(deployed,'client.lua','print("same")\r\n');
  write(source,'server.lua','print("fixed")\n');write(deployed,'server.lua','print("old")\r\n');
  write(deployed,'README.md','retained');write(source,'tests/regression.lua','assert(true)');
  const before=inventory(deployed,true),changes=mergeCandidate(source,deployed,candidate);
  assert.deepEqual(inventory(deployed,true),before);
  assert.equal(fs.readFileSync(path.join(candidate,'client.lua'),'utf8'),'print("same")\r\n');
  assert.equal(fs.readFileSync(path.join(candidate,'README.md'),'utf8'),'retained');
  assert.deepEqual(changes.changed,['server.lua']);assert.deepEqual(changes.added,[path.join('tests','regression.lua')]);
});
