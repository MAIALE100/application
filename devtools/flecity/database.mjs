import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { once } from 'node:events';
import { state,local,command,launch,noLinks,inside,json,redact,result } from './core.mjs';

export function assertDisposableDatadir(root,datadir) {
  const rel=path.relative(path.resolve(root),path.resolve(datadir));
  if(!rel||rel.startsWith('..')||path.isAbsolute(rel))throw Error('Datadir outside disposable root');
  noLinks(datadir);
}
export async function disposable(ctx,fn) {
  const bin=local().mariaBin;
  if(process.platform!=='win32'||!bin||!fs.existsSync(path.join(bin,'mariadb-install-db.exe'))) {
    ctx.skip('Disposable MariaDB','Set local mariaBin to existing Windows MariaDB binaries');return;
  }
  const root=path.join(state,'db'),dir=inside(root,ctx.id+'-'+crypto.randomUUID());
  const datadir=path.join(dir,'data');assertDisposableDatadir(root,datadir);
  fs.mkdirSync(dir,{recursive:true});
  const password=crypto.randomBytes(24).toString('hex'),pipe='FlecityFixture_'+crypto.randomBytes(16).toString('hex');
  const dbName='flecity_'+ctx.id.replace(/-/g,'_')+'_'+crypto.randomBytes(6).toString('hex');
  const init=command(path.join(bin,'mariadb-install-db.exe'),['--datadir='+datadir,'--password='+password,'--skip-networking','--socket='+pipe,'--silent'],{timeout:60000});
  fs.writeFileSync(path.join(ctx.run.dir,'logs','db-init.txt'),init.output.replaceAll(password,'[REDACTED]'));
  if(!init.ok){result(ctx.run,'Disposable MariaDB initialization','FAIL',init.output||init.error);return;}
  json(path.join(dir,'fixture.json'),{project:ctx.id,datadir,pipe,dbName,network:'disabled',created:new Date().toISOString()});
  const child=launch(path.join(bin,'mariadbd.exe'),['--no-defaults','--basedir='+path.dirname(bin),'--datadir='+datadir,'--skip-networking','--enable-named-pipe','--socket='+pipe,'--pid-file='+path.join(dir,'fixture.pid'),'--log-error='+path.join(dir,'server.err')]);
  let spawnError=null,output='';
  child.on('error',e=>{spawnError=e;});
  child.stdout.on('data',d=>{output+=d;});child.stderr.on('data',d=>{output+=d;});
  const ended=()=>child.exitCode!==null||child.signalCode!==null;
  const stopOnSignal=()=>child.kill();
  process.once('SIGINT',stopOnSignal);process.once('SIGTERM',stopOnSignal);
  const connection=['--no-defaults','--protocol=PIPE','--socket='+pipe,'--host=localhost','--user=root','--skip-reconnect'];
  const env={...process.env,MYSQL_PWD:password};
  async function query(sql,{expectFailure=false,database=true,timeout=20000}={}) {
    if(ended()||spawnError)throw Error('Disposable server exited');
    return await new Promise((resolve,reject)=>{
      const c=launch(path.join(bin,'mariadb.exe'),[...connection,'--batch','--raw','--skip-column-names','--default-character-set=utf8mb4','--local-infile=0',...(database?[dbName]:[])],{env});
      let out='',err='',settled=false;
      const timer=setTimeout(()=>{c.kill();done(Error('SQL timeout'));},timeout);
      function done(error,value){if(settled)return;settled=true;clearTimeout(timer);error?reject(error):resolve(value);}
      c.stdout.on('data',d=>out+=d);c.stderr.on('data',d=>err+=d);
      c.on('error',e=>done(e));c.on('close',code=>{
        if(code!==0&&!expectFailure)done(Error(redact(err).replaceAll(password,'[REDACTED]')));
        else done(null,expectFailure?{failed:code!==0,output:redact(out+err)}:out);
      });
      c.stdin.on('error',()=>{});c.stdin.end(sql+'\n');
    });
  }
  try {
    let ready=false;
    const deadline=Date.now()+25000;
    while(Date.now()<deadline){
      if(spawnError||ended())throw Error('Disposable server failed: '+(spawnError?.code||output));
      try{
        const actual=(await query('SELECT @@datadir',{database:false,timeout:1000})).trim();
        if(path.resolve(actual)!==path.resolve(datadir))throw Error('Datadir identity mismatch');
        ready=true;break;
      }catch(e){if(e.message.includes('identity mismatch'))throw e;}
      await new Promise(r=>setTimeout(r,250));
    }
    if(!ready)throw Error('Disposable server readiness timeout');
    await query('CREATE DATABASE '+dbName+' CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci',{database:false});
    result(ctx.run,'Disposable MariaDB isolation','PASS','Unique named pipe, TCP disabled, datadir identity verified; '+dbName);
    await fn({sql:query});
  }catch(e){result(ctx.run,'Disposable MariaDB','FAIL',e.message);}
  finally {
    const shutdown=command(path.join(bin,'mariadb-admin.exe'),[...connection.filter(a=>a!=='--skip-reconnect'),'shutdown'],{env,timeout:10000});
    fs.writeFileSync(path.join(ctx.run.dir,'logs','db-shutdown.txt'),shutdown.output.replaceAll(password,'[REDACTED]'));
    if(!ended()&&!spawnError) {
      await Promise.race([once(child,'exit'),new Promise(r=>setTimeout(r,3000))]);
      if(!ended()){child.kill();await Promise.race([once(child,'exit'),new Promise(r=>setTimeout(r,3000))]);}
    }
    process.removeListener('SIGINT',stopOnSignal);process.removeListener('SIGTERM',stopOnSignal);
    fs.writeFileSync(path.join(ctx.run.dir,'logs','db-process.txt'),redact(output).replaceAll(password,'[REDACTED]'));
    if(fs.existsSync(path.join(dir,'server.err')))fs.copyFileSync(path.join(dir,'server.err'),path.join(ctx.run.dir,'logs','db-server.txt'));
    json(path.join(dir,'fixture.json'),{project:ctx.id,pid:child.pid,datadir,pipe,dbName,network:'disabled',stopped:ended()||!!spawnError,graceful:shutdown.ok});
    result(ctx.run,'Disposable MariaDB shutdown',ended()||spawnError?'PASS':'FAIL','Only the spawned fixture process was addressed; data retained locally; graceful='+shutdown.ok);
  }
}
