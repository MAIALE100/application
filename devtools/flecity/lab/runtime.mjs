import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import net from 'node:net';
import dgram from 'node:dgram';
import {state,tool,repo,inside,noLinks,files,sha,json,readJSON,copyTree,inventory,project,redact} from '../core.mjs';
export const labRoot=path.join(state,'lab');
export const ports={game:30130,database:33130,control:43130};
export const artifactSource=String.raw`D:\FiveM_Test_Server\server`;
export const oxSource=String.raw`D:\FiveM_Test_Server\txData\Qbox_D233FD.base\resources\[ox]\oxmysql`;
export function labPath(relative){const p=inside(labRoot,relative);noLinks(p);return p;}
export async function freePort(port,udp=false){
  if(!Object.values(ports).includes(port))throw Error('Unregistered lab port');
  await new Promise((resolve,reject)=>{
    const socket=udp?dgram.createSocket('udp4'):net.createServer();
    socket.once('error',reject);
    if(udp)socket.bind(port,'127.0.0.1',()=>socket.close(resolve));
    else socket.listen(port,'127.0.0.1',()=>socket.close(resolve));
  });
}
export async function readiness(){
  if(os.freemem()<4*2**30)throw Error('Less than 4 GiB available RAM; no lab process started');
  await freePort(ports.game);await freePort(ports.game,true);await freePort(ports.database);await freePort(ports.control);
  return {availableGiB:os.freemem()/2**30,totalGiB:os.totalmem()/2**30,ports,checkedAt:new Date().toISOString()};
}
export function initialize(){
  const runtime=labPath('runtime/fxserver');
  if(!fs.existsSync(runtime)){
    noLinks(artifactSource);fs.mkdirSync(runtime,{recursive:true});
    const hashes={};
    for(const source of files(artifactSource)){
      const relative=path.relative(artifactSource,source),parts=relative.split(path.sep);
      if(!artifactAllowed(relative))continue;
      const dest=inside(runtime,relative);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.copyFileSync(source,dest);
      hashes[relative]=sha(fs.readFileSync(dest));
    }
    json(labPath('runtime/source.json'),{origin:artifactSource,files:hashes,credentialsCopied:false,copied:new Date().toISOString()});
  }
  if(!fs.existsSync(path.join(runtime,'FXServer.exe')))throw Error('Runtime incomplete');
  // Never read/copy server.cfg, txData, private keys or player database.
  const ox=labPath('runtime/oxmysql');
  if(!fs.existsSync(ox))copyTree(oxSource,ox);
  json(labPath('environment.json'),{version:1,ports,mode:'documented sv_lan; loopback only; no clients',resources:['oxmysql','qbx_core (test double)','lb-phone (test double)','flecity_base','flecity_games','flecity_validation'],realQboxPhone:false});
  return runtime;
}
export function makeInstance(){
  const id=crypto.randomUUID(),dir=labPath('instances/'+id);fs.mkdirSync(dir,{recursive:true});
  fs.mkdirSync(path.join(dir,'logs'));fs.mkdirSync(path.join(dir,'resources'));
  for(const resource of ['qbx_core','lb-phone','flecity_validation'])copyTree(path.join(tool,'lab/resources',resource),path.join(dir,'resources',resource));
  copyTree(labPath('runtime/oxmysql'),path.join(dir,'resources','oxmysql'));
  const staged={};
  for(const [id,binding] of Object.entries(registry())){
    const config=project(id),dest=path.join(dir,'resources',config.resource);
    if(fs.existsSync(dest))throw Error('Shared resource source collision; register one canonical source for '+config.resource);
    const before=JSON.stringify(inventory(config.source));copyTree(config.source,dest);
    if(JSON.stringify(inventory(dest))!==before||JSON.stringify(inventory(config.source))!==before)throw Error('Source changed during lab staging: '+id);
    staged[id]={resource:config.resource,source:config.source,files:inventory(dest)};
    if(binding.adapter!=='built-in'){
      const source=inside(repo,binding.adapter);noLinks(source);
      const target=path.join(dir,'resources','flecity_validation','adapters',id+'.lua');
      fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(source,target);
    }
  }
  json(path.join(dir,'resources','flecity_validation','projects.json'),registry());
  json(path.join(dir,'instance.json'),{id,dir,created:new Date().toISOString(),staged,credentialsCopied:false});
  return {id,dir,staged};
}
export function safeLog(text,secrets=[]){
  let output=String(text);
  for(const secret of secrets)if(secret)output=output.replaceAll(secret,'[REDACTED]');
  return redact(output).replace(/cfxk_[A-Za-z0-9_-]+/g,'[LICENSE REDACTED]').replace(/(authorization:\s*Bearer\s+)\S+/gi,'$1[REDACTED]');
}
export function loadLicense(){
  const file=labPath('private/license.cfg');
  if(!fs.existsSync(file))throw Error('Dedicated license file missing: '+file);
  return parseLicense(fs.readFileSync(file,'utf8'));
}
export function parseLicense(text){
  const active=text.split(/\r?\n/).map(l=>l.trim()).filter(l=>l&&!l.startsWith('#'));
  if(active.length!==1)throw Error('License file must contain one key directive only');
  const match=active[0].match(/^(?:set\s+)?sv_licenseKey\s+"([A-Za-z0-9_-]{20,512})"$/);
  if(!match)throw Error('Dedicated validation key not configured; use the private license.cfg file');
  return match[1];
}
export function artifactAllowed(relative){
  const parts=relative.split(/[\\/]/),name=parts.at(-1).toLowerCase();
  return !parts.some(p=>['crashes','cache','logs','txData'].includes(p))&&
    !/\.(key|crt|pem|log|dmp)$/i.test(name)&&
    !/^(?:server\.cfg.*|admins\.json|config\.json)$/.test(name);
}
export function registry(){
  const file=labPath('projects.json');
  if(!fs.existsSync(file))json(file,{base:{adapter:'built-in',resource:'flecity_base'},link:{adapter:'built-in',resource:'flecity_games'}});
  return readJSON(file);
}
