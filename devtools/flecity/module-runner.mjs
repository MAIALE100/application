import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import { repo,inside,noLinks,redact } from './core.mjs';
const [file,source]=process.argv.slice(2);
try{
  const moduleFile=inside(repo,file),sourceRoot=inside(repo,source);noLinks(moduleFile);noLinks(sourceRoot);
  const module=await import(pathToFileURL(moduleFile).href);
  if(typeof module.run!=='function')throw Error('Rule module must export async run(ctx)');
  const ctx={source:sourceRoot,read:relative=>{
    const target=inside(sourceRoot,relative);noLinks(target);
    return fs.readFileSync(target,'utf8');
  }};
  console.log(redact(await module.run(ctx)));
}catch(e){console.error(redact(e.stack||e.message));process.exitCode=1;}
