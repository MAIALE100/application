import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {disposable} from './database.mjs';
import {literalCreateTables} from './adapters/schema-smoke.mjs';
import {newRun,result,saveRun,sha,json,repo,noLinks} from './core.mjs';

const [dumpPath,expectedHash]=process.argv.slice(2);
const backupRoot=path.resolve('D:/FiveM_Dev_Backups/flecity-live-test');
if(!dumpPath||!expectedHash||!/^[a-f0-9]{64}$/i.test(expectedHash))throw Error('Usage: wave-db-audit <reviewed SQL backup> <SHA256>');
const dump=path.resolve(dumpPath),relative=path.relative(backupRoot,dump);
if(!relative||relative.startsWith('..')||path.isAbsolute(relative)||!dump.toLowerCase().endsWith('.sql'))throw Error('Backup path outside reviewed root');
noLinks(dump);
const stats=fs.statSync(dump);
if(!stats.isFile()||stats.size>20*1024*1024)throw Error('Unexpected backup size');
const bytes=fs.readFileSync(dump);
if(sha(bytes)!==expectedHash.toLowerCase())throw Error('Backup SHA mismatch');
const sql=bytes.toString('utf8');
if(/^(?:\s*)(?:DROP DATABASE|CREATE USER|ALTER USER|GRANT |REVOKE |SOURCE |SYSTEM |LOAD DATA)/mi.test(sql)||/INTO\s+OUTFILE/i.test(sql))throw Error('Unsafe SQL directive in backup');
if((sql.match(/^CREATE DATABASE\b/gm)||[]).length!==1||(sql.match(/^USE\s+`?Qbox_D233FD`?;/gmi)||[]).length!==1)throw Error('Backup database selector changed');

const server=fs.readFileSync(path.join(repo,'wave/server/main.lua'),'utf8');
const config=fs.readFileSync(path.join(repo,'wave/config/shared.lua'),'utf8');
const version=Number(config.match(/SchemaVersion\s*=\s*(\d+)/)?.[1]);
const ddl=literalCreateTables(server);
assert.equal(ddl.length,19);
const body=server.match(/local function ensureSchema\(\)([\s\S]*?)\r?\nend\r?\n\r?\nlocal function ensureWallet/)?.[1];
if(!body)throw Error('WAVE init function changed');
const seeds=[...body.matchAll(/MySQL\.query\.await\(\[\[([\s\S]*?)\]\]/g)].map(m=>m[1].trim());
if(seeds.length!==2||!Number.isInteger(version)||version<1)throw Error('WAVE init seed contract changed');
const seedSql=seeds.map((statement,i)=>i===1?statement.replace('?',String(version)):statement);
if(seedSql[1].includes('?'))throw Error('Unexpected schema seed parameter');

const run=newRun('wave','db-copy-audit');
const evidence={dumpSha256:expectedHash.toLowerCase(),dumpBytes:stats.size,dumpModified:stats.mtime.toISOString(),sourceSchemaVersion:version,sourceCreateCount:ddl.length};
const ctx={id:'wave',run,check:async(name,fn)=>{try{result(run,name,'PASS',await fn());}catch{result(run,name,'FAIL','Isolated audit failed; data and SQL error suppressed');}}};
const dbName='Qbox_D233FD';
const waveTables=async db=>{
 const names=(await db.sql(`SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA='${dbName}' AND TABLE_NAME LIKE 'wave\\_%' ORDER BY TABLE_NAME`)).trim().split(/\r?\n/).filter(Boolean);
 return names;
};
const definitions=async(db,schema)=>{
 const columns=await db.sql(`SELECT TABLE_NAME,COLUMN_NAME,COLUMN_TYPE,IS_NULLABLE,COALESCE(COLUMN_DEFAULT,'<NULL>'),EXTRA,ORDINAL_POSITION FROM information_schema.COLUMNS WHERE TABLE_SCHEMA='${schema}' AND TABLE_NAME LIKE 'wave\\_%' ORDER BY TABLE_NAME,ORDINAL_POSITION`);
 const indexes=await db.sql(`SELECT TABLE_NAME,INDEX_NAME,NON_UNIQUE,SEQ_IN_INDEX,COLUMN_NAME,INDEX_TYPE FROM information_schema.STATISTICS WHERE TABLE_SCHEMA='${schema}' AND TABLE_NAME LIKE 'wave\\_%' ORDER BY TABLE_NAME,INDEX_NAME,SEQ_IN_INDEX`);
 return {columnHash:sha(columns),indexHash:sha(indexes),columnCount:columns.trim().split(/\r?\n/).filter(Boolean).length,indexCount:indexes.trim().split(/\r?\n/).filter(Boolean).length};
};
const dataFingerprint=async(db,names)=>{
 const rows=[];
 for(const name of names){
  if(!/^wave_[a-z_]+$/.test(name))throw Error('Unexpected table name');
  const count=(await db.sql(`SELECT COUNT(*) FROM \`${dbName}\`.\`${name}\``)).trim();
  const checksum=(await db.sql(`CHECKSUM TABLE \`${dbName}\`.\`${name}\` EXTENDED`)).trim().split(/\t/).pop();
  rows.push({table:name,count:Number(count),checksum});
 }
 return {rows,hash:sha(JSON.stringify(rows))};
};

await disposable(ctx,async db=>{
 await ctx.check('Restore reviewed complete DB backup in isolated MariaDB',async()=>{
  try{await db.sql(sql,{database:false,timeout:120000});}catch{throw Error('Restore failed');}
  const names=await waveTables(db);
  evidence.restoredWaveTables=names.length;
  evidence.restoredTables=Number((await db.sql(`SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA='${dbName}'`)).trim());
  assert.equal(names.length,19);
  return `${evidence.restoredTables} total tables; 19 WAVE tables; backup data kept private`;
 });
 if(run.checks.some(x=>x.status==='FAIL'))return;
 await ctx.check('Compare restored WAVE columns and indexes with production DDL',async()=>{
  const names=await waveTables(db);
  const before=await definitions(db,dbName);
  const dataBefore=await dataFingerprint(db,names);
  await db.sql("CREATE DATABASE wave_expected CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci",{database:false});
  await db.sql('USE wave_expected;\n'+ddl.join(';\n')+';\n');
  const expected=await definitions(db,'wave_expected');
  evidence.restoredSchema=before;evidence.expectedSchema=expected;
  evidence.schemaMatchesFresh=before.columnHash===expected.columnHash&&before.indexHash===expected.indexHash;
  evidence.beforeDataHash=dataBefore.hash;
  evidence.rowCounts=dataBefore.rows.map(({table,count})=>({table,count}));
  if(!evidence.schemaMatchesFresh)throw Error('Schema drift');
  return `19 tables; ${before.columnCount} columns; ${before.indexCount} index columns; schema matches fresh DDL`;
 });
 if(run.checks.some(x=>x.status==='FAIL'))return;
 await ctx.check('Run actual WAVE startup SQL against restored copy without data loss',async()=>{
  const names=await waveTables(db);
  await db.sql('USE `'+dbName+'`;\n'+ddl.join(';\n')+';\n'+seedSql.join(';\n')+';\n');
  const after=await definitions(db,dbName),dataAfter=await dataFingerprint(db,names);
  evidence.afterSchema=after;evidence.afterDataHash=dataAfter.hash;
  evidence.dataUnchanged=evidence.beforeDataHash===dataAfter.hash;
  evidence.schemaUnchanged=after.columnHash===evidence.restoredSchema.columnHash&&after.indexHash===evidence.restoredSchema.indexHash;
  if(!evidence.schemaUnchanged||!evidence.dataUnchanged)throw Error('Existing WAVE data or schema changed');
  return '19 CREATE and 2 startup seed writes; all WAVE table counts/checksums and schema unchanged';
 });
 if(run.checks.some(x=>x.status==='FAIL'))return;
 await ctx.check('Rollback isolated purchase split and payout ledger writes',async()=>{
  const names=await waveTables(db),before=await dataFingerprint(db,names);
  const trackId=Number((await db.sql(`SELECT MIN(id) FROM \`${dbName}\`.wave_tracks`)).trim());
  if(!Number.isSafeInteger(trackId)||trackId<1)throw Error('No restored track for transaction fixture');
  const marker='FLECITY_AUDIT_'+crypto.randomBytes(8).toString('hex').toUpperCase();
  const statements=[
   `USE \`${dbName}\``,
   'START TRANSACTION',
   `INSERT INTO wave_purchases (buyer_citizenid,track_id,purchase_type,price) VALUES ('${marker}',${trackId},'personal',5000)`,
   `INSERT INTO wave_wallets (citizenid,balance,lifetime_earned,frozen) VALUES ('${marker}',4250,4250,0)`,
   'UPDATE wave_platform_wallet SET balance=balance+750,lifetime_earned=lifetime_earned+750 WHERE id=1',
   `INSERT INTO wave_transactions (tx_type,citizenid,track_id,gross_amount,creator_amount,platform_amount) VALUES ('track_sale','${marker}',${trackId},5000,4250,750)`,
   `UPDATE wave_wallets SET balance=0 WHERE citizenid='${marker}' AND balance=4250 AND frozen=0`,
   'SELECT ROW_COUNT()',
   'ROLLBACK'
  ];
  let output;
  try{output=await db.sql(statements.join(';\n')+';\n');}catch{throw Error('Isolated transaction failed');}
  assert.equal(Number(output.trim().split(/\r?\n/).pop()),1,'Payout conditional update');
  const after=await dataFingerprint(db,names);
  evidence.transactionRollbackPreservedData=before.hash===after.hash;
  if(!evidence.transactionRollbackPreservedData)throw Error('Rollback changed restored data');
  return '5,000 split into 4,250/750, conditional payout, ROLLBACK; all restored WAVE checksums unchanged';
 });
});
json(path.join(run.dir,'wave-db-copy-audit.json'),evidence);
const saved=saveRun(run);
process.exitCode=saved.status==='FAIL'?1:0;
