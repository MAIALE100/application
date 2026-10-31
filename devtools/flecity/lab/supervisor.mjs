import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import crypto from 'node:crypto';
import {once} from 'node:events';
import {fileURLToPath} from 'node:url';
import {local,launch,command,json,inventory,copyTree,project,noLinks} from '../core.mjs';
import {labRoot,labPath,ports,readiness,initialize,makeInstance,safeLog,loadLicense} from './runtime.mjs';

export async function serve(){
  throw Error('Dedicated FXServer startup disabled: existing-test-server-only policy');
  const marker=labPath('owner.lock');
  const fd=fs.openSync(marker,'wx');fs.writeFileSync(fd,String(process.pid));
  const token=crypto.randomBytes(32).toString('hex'),rootPassword=crypto.randomBytes(24).toString('hex'),userPassword=crypto.randomBytes(24).toString('hex');
  const secrets=[token,rootPassword,userPassword];
  let maria,fx,instance,api,active=false,busy=false,closing=false;
  const bin=local().mariaBin;
  let stdoutLog;
  const live=child=>child&&child.exitCode===null&&child.signalCode===null;
  function log(text){if(stdoutLog)fs.appendFileSync(stdoutLog,safeLog(text,secrets));}
  function attach(child,label){
    for(const stream of [child.stdout,child.stderr]){
      let pending='';
      stream.on('data',chunk=>{pending+=chunk.toString('utf8');let i;while((i=pending.indexOf('\n'))>=0){log(label+' '+pending.slice(0,i+1));pending=pending.slice(i+1);}});
      stream.on('end',()=>{if(pending)log(label+' '+pending+'\n');});
    }
    child.on('error',e=>log(label+' process error '+e.code+'\n'));
  }
  const clientArgs=()=>['--no-defaults','--skip-ssl','--protocol=TCP','--host=127.0.0.1','--port='+ports.database,'--user=root','--batch','--raw','--skip-column-names','--skip-reconnect'];
  function sql(text){
    const r=command(path.join(bin,'mariadb.exe'),clientArgs(),{input:text,env:{...process.env,MYSQL_PWD:rootPassword},timeout:10000});
    if(!r.ok)throw Error(safeLog(r.output||r.error,secrets));return r.output;
  }
  async function waitUntil(fn,timeout=30000){
    const end=Date.now()+timeout;let last;
    while(Date.now()<end){try{const value=await fn();if(value)return value;}catch(e){last=e;}
      await new Promise(r=>setTimeout(r,200));}
    throw Error('Readiness timeout'+(last?': '+safeLog(last.message,secrets):''));
  }
  async function stopChild(child,graceful){
    if(!live(child))return;
    try{graceful();}catch{}
    await Promise.race([once(child,'exit'),new Promise(r=>setTimeout(r,5000))]);
    if(live(child)){child.kill();await Promise.race([once(child,'exit'),new Promise(r=>setTimeout(r,3000))]);}
    if(live(child))throw Error('Owned child did not stop');
  }
  async function shutdown(){
    if(closing)return;closing=true;active=false;
    try{
      await stopChild(fx,()=>fx.stdin.write('quit Flecity isolated validation complete\n'));
      await stopChild(maria,()=>command(path.join(bin,'mariadb-admin.exe'),[...clientArgs().filter(a=>a!=='--skip-reconnect'),'shutdown'],{env:{...process.env,MYSQL_PWD:rootPassword},timeout:5000}));
      log('SUPERVISOR owned processes stopped\n');
      if(instance)json(path.join(instance.dir,'stopped.json'),{at:new Date().toISOString(),fxStopped:!live(fx),dbStopped:!live(maria)});
    }finally{
      if(api){api.closeAllConnections();await new Promise(r=>api.close(r));}
      fs.closeSync(fd);fs.unlinkSync(marker);
      json(labPath('status.json'),{active:false,stopped:new Date().toISOString(),instance:instance?.id});
    }
  }
  try{
    const license=loadLicense();secrets.push(license);
    const capacity=await readiness();const runtime=initialize();instance=makeInstance();
    stdoutLog=path.join(instance.dir,'logs','process.log');
    json(path.join(instance.dir,'capacity.json'),capacity);
    const datadir=path.join(instance.dir,'database');
    const init=command(path.join(bin,'mariadb-install-db.exe'),['--datadir='+datadir,'--password='+rootPassword,'--skip-networking','--silent'],{timeout:60000});
    log('DB INIT '+init.output+'\n');if(!init.ok)throw Error('Private database initialization failed');
    maria=launch(path.join(bin,'mariadbd.exe'),['--no-defaults','--skip-ssl','--basedir='+path.dirname(bin),'--datadir='+datadir,'--bind-address=127.0.0.1','--port='+ports.database,'--skip-name-resolve','--local-infile=0','--innodb-buffer-pool-size=64M','--max-connections=32','--pid-file='+path.join(instance.dir,'database.pid'),'--log-error='+path.join(instance.dir,'logs','database.err')],{cwd:instance.dir});
    attach(maria,'DB');
    await waitUntil(()=>{
      if(!live(maria))throw Error('Private DB exited');
      const actual=sql('SELECT @@datadir;').trim();
      if(path.resolve(actual)!==path.resolve(datadir))throw Error('PRIVATE DB IDENTITY MISMATCH');
      return true;
    });
    const dbName='flecity_validation_'+crypto.randomBytes(6).toString('hex');
    sql("CREATE DATABASE "+dbName+" CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci; CREATE USER 'flecity_fixture'@'127.0.0.1' IDENTIFIED BY '"+userPassword+"'; GRANT ALL ON "+dbName+".* TO 'flecity_fixture'@'127.0.0.1';");
    const cfg=[
      '# Generated private LAN validation. No existing server cfg or license key is used.',
      'set sv_lan true',
      'set sv_licenseKey "'+license+'"',
      'endpoint_add_tcp "127.0.0.1:'+ports.game+'"',
      'endpoint_add_udp "127.0.0.1:'+ports.game+'"',
      'sv_maxclients 2','set onesync off','sv_master1 ""','sv_hostname "Flecity Isolated Validation"',
      'sets sv_projectName "Flecity validation"','sets sv_projectDesc "Private automated server-side tests"',
      'sv_endpointPrivacy true','sv_scriptHookAllowed false',
      'set mysql_connection_string "mysql://flecity_fixture:'+userPassword+'@127.0.0.1:'+ports.database+'/'+dbName+'?charset=utf8mb4"',
      'set mysql_debug false','set mysql_ui false',
      'ensure oxmysql','ensure qbx_core','ensure lb-phone',...Object.values(instance.staged).map(s=>'ensure '+s.resource),'ensure flecity_validation'
    ].join('\n')+'\n';
    fs.writeFileSync(path.join(instance.dir,'server.cfg'),cfg,{mode:0o600});
    fx=launch(path.join(runtime,'FXServer.exe'),['+set','sv_lan','true','+exec','server.cfg'],{cwd:instance.dir});
    attach(fx,'FX');
    // No inherited txAdmin service, existing server key or server-monitor key.
    await waitUntil(()=>{
      if(!live(fx))throw Error('Owned FXServer exited; inspect redacted process log');
      const text=fs.existsSync(stdoutLog)?fs.readFileSync(stdoutLog,'utf8'):'';
      return text.includes('[VALIDATION] harness ready');
    },45000);
    active=true;
    function status(){return {active:active&&live(fx)&&live(maria),instance:instance.id,dir:instance.dir,ports,fxPid:fx.pid,dbPid:maria.pid,mode:'real FXServer/oxmysql/MariaDB; QBox and LB Phone doubles',clientIntegration:'NOT_RUN'};}
    async function runTest(id){
      if(!instance.staged[id])throw Error('No server-side adapter staged for '+id);
      const requestId=crypto.randomUUID(),file=path.join(instance.dir,'resources','flecity_validation','result.json');
      fx.stdin.write('validation_run '+id+' '+requestId+'\n');
      const data=await waitUntil(()=>{
        if(!fs.existsSync(file))return false;
        const parsed=JSON.parse(fs.readFileSync(file,'utf8'));
        return parsed.id===requestId&&parsed.completed?parsed:false;
      },60000);
      for(const check of data.checks)if(check.detail)check.detail=safeLog(check.detail,secrets);
      const target=path.join(instance.dir,'results',id+'-'+requestId+'.json');json(target,data);
      return data;
    }
    async function update(id,restore=false){
      const staged=instance.staged[id];if(!staged)throw Error('Project not staged in this private lab');
      const resource=staged.resource,target=path.join(instance.dir,'resources',resource);
      noLinks(target);
      const source=restore?staged.lastBackup:project(id).source;
      if(!source)throw Error('No previous resource backup to restore');
      noLinks(source);
      const stateFile=path.join(instance.dir,'resources','flecity_validation','state.json');
      const resourceState=()=>fs.existsSync(stateFile)?JSON.parse(fs.readFileSync(stateFile,'utf8'))[resource]:null;
      const backup=path.join(instance.dir,'backups',resource+'-'+crypto.randomUUID());
      copyTree(target,backup);
      const next=target+'.stage-'+crypto.randomUUID(),previous=target+'.previous-'+crypto.randomUUID();
      copyTree(source,next);
      const expected=JSON.stringify(inventory(target));
      let moved=false,switched=false;
      try{
        fx.stdin.write('stop '+resource+'\n');await waitUntil(()=>resourceState()==='stopped',5000);
        if(JSON.stringify(inventory(target))!==expected)throw Error('Private resource changed while update was prepared');
        fs.renameSync(target,previous);moved=true;fs.renameSync(next,target);switched=true;
        fx.stdin.write('ensure '+resource+'\n');await waitUntil(()=>resourceState()==='started',10000);
        staged.lastBackup=backup;
      }
      catch(e){
        if(switched){
          fx.stdin.write('stop '+resource+'\n');await waitUntil(()=>resourceState()==='stopped',5000);
          fs.renameSync(target,target+'.failed-'+crypto.randomUUID());
        }
        if(moved)fs.renameSync(previous,target);
        fx.stdin.write('ensure '+resource+'\n');
        await waitUntil(()=>resourceState()==='started',10000);
        throw e;
      }
      return {resource,backup,privateOnly:true,files:inventory(target)};
    }
    api=http.createServer(async(req,res)=>{
      const send=(code,value)=>{res.writeHead(code,{'Content-Type':'application/json'});res.end(JSON.stringify(value));};
      if(req.headers.authorization!=='Bearer '+token){send(403,{error:'Forbidden'});return;}
      if(req.method==='GET'&&req.url==='/status'){send(200,status());return;}
      if(req.method==='GET'&&req.url==='/logs'){
        const tail=file=>fs.existsSync(file)?safeLog(fs.readFileSync(file,'utf8').slice(-262144),secrets):'';
        send(200,{instance:instance.id,process:tail(stdoutLog),database:tail(path.join(instance.dir,'logs','database.err'))});return;
      }
      if(req.method!=='POST'||!['/test','/update','/restore','/stop'].includes(req.url)){send(404,{error:'Unsupported operation'});return;}
      if(busy){send(409,{error:'Lab operation already running'});return;}
      let body='';req.on('data',d=>{body+=d;if(body.length>4096)req.destroy();});
      req.on('end',async()=>{
        busy=true;
        try{
          const data=JSON.parse(body||'{}');let value;
          if(req.url==='/stop'){send(200,{stopping:true});setTimeout(()=>shutdown().then(()=>process.exit(0)).catch(()=>process.exit(1)),100);return;}
          if(!active)throw Error('Lab not active');
          if(req.url==='/test')value=await runTest(data.project);
          if(req.url==='/update')value=await update(data.project);
          if(req.url==='/restore')value=await update(data.project,true);
          send(200,value);
        }catch(e){log('CONTROL '+safeLog(e.message,secrets)+'\n');send(500,{error:safeLog(e.message,secrets)});}
        finally{busy=false;}
      });
    });
    await new Promise((resolve,reject)=>{api.once('error',reject);api.listen(ports.control,'127.0.0.1',resolve);});
    json(labPath('connection.json'),{token,port:ports.control,instance:instance.id,ownerPid:process.pid},{mode:0o600});
    json(labPath('status.json'),status());
    process.once('SIGINT',()=>shutdown().then(()=>process.exit(0)));
    process.once('SIGTERM',()=>shutdown().then(()=>process.exit(0)));
    log('SUPERVISOR private lab ready\n');
  }catch(e){
    const message=safeLog(e.stack||e.message,secrets);
    log('STARTUP '+message+'\n');json(labPath('startup-error.json'),{error:message,instance:instance?.id});
    await shutdown().catch(()=>{});process.exitCode=1;
  }
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))await serve();
