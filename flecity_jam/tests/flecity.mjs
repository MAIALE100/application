import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {createRequire} from 'node:module';
import {spawnSync} from 'node:child_process';
const require=createRequire(import.meta.url);
export async function staticChecks(ctx) {
  ctx.exec('Keyboard / replica / audio / MIDI unit tests',process.execPath,['--test','tests/model.test.mjs','tests/audio.test.mjs','tests/midi.test.mjs']);
  await ctx.check('Licensed audio inventory and hashes',()=>{
    const catalog=JSON.parse(ctx.read('web/catalog.json'));let files=0;
    for(const spec of catalog.instruments) {
      if(!spec.url.startsWith('https://') || !['CC0-1.0','CC-BY-4.0'].includes(spec.license))throw Error('Missing license');
      for(const sample of spec.samples){
        const file=path.resolve(ctx.source,'web',sample.file);
        if(!file.startsWith(path.resolve(ctx.source,'web/samples')+path.sep))throw Error('Sample path escape');
        const hash=crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');if(hash!==sample.sha256)throw Error('Sample mismatch: '+sample.file);
        if(sample.loopEnd && !(sample.loopStart>0 && sample.loopEnd>sample.loopStart))throw Error('Invalid loop');files++;
      }
    }
    return catalog.instruments.length+' instruments / '+files+' hashed licensed assets';
  });
  const parser=path.resolve(ctx.source,'../.flecity-dev/tools/lua-parser/node_modules/luaparse');
  if(fs.existsSync(parser))await ctx.check('Lua parser (5.3 syntax subset; not Lua 5.4 execution)',()=>{
    const lua=require(parser);let n=0;
    function walk(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())walk(p);else if(p.endsWith('.lua')){lua.parse(fs.readFileSync(p,'utf8'),{luaVersion:'5.3'});n++;}}}
    walk(ctx.source);return n+' Lua files parsed';
  });else ctx.skip('Lua parser','Install luaparse or use native luac5.4');
  const runtime=path.resolve(ctx.source,'../.flecity-dev/tools/fengari-node-cli-0.1.0/node_modules/fengari-node-cli/src/lua-cli.js');
  for(const [file,expected]of [['engine.lua',21],['client.lua',10]]){
    if(!fs.existsSync(runtime)){ctx.skip('Lua simulation: '+file,'Fengari unavailable; run lua5.4 tests/'+file);continue;}
    await ctx.check('Lua simulation: '+file,()=>{
      const run=spawnSync(process.execPath,[runtime,'tests/'+file],{cwd:ctx.source,encoding:'utf8',timeout:60000,windowsHide:true});
      const text=(run.stdout||'')+(run.stderr||'');
      if(run.error||run.status!==0||!text.includes(`RESULT ${expected} PASS / 0 FAIL`))throw Error(text||run.error?.message);
      return text.trim();
    });
  }
}
