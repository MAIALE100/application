import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {repo,tool,state,local,readJSON,sha,inside,noLinks,inventory} from './core.mjs';

export function comparePixels(a,b,{tolerance=8,maxChangedRatio=0.001,masks=[]}={}){
  if(!Number.isInteger(tolerance)||tolerance<0||tolerance>255||!Number.isFinite(maxChangedRatio)||maxChangedRatio<0||maxChangedRatio>0.05)throw Error('Invalid comparison thresholds');
  if(a.width!==b.width||a.height!==b.height||a.data.length!==a.width*a.height*4||b.data.length!==b.width*b.height*4)throw Error('Image dimensions differ');
  for(const r of masks)if(![r.x,r.y,r.width,r.height].every(Number.isInteger)||r.x<0||r.y<0||r.width<=0||r.height<=0||r.x+r.width>a.width||r.y+r.height>a.height)throw Error('Invalid dynamic mask');
  let changed=0,masked=0;const pixels=a.width*a.height;
  if(pixels<=0)throw Error('Empty image');
  for(let p=0;p<pixels;p++){
    const x=p%a.width,y=Math.floor(p/a.width);
    if(masks.some(r=>x>=r.x&&y>=r.y&&x<r.x+r.width&&y<r.y+r.height)){masked++;continue;}
    if([0,1,2,3].some(c=>Math.abs(a.data[p*4+c]-b.data[p*4+c])>tolerance))changed++;
  }
  if(masked/pixels>0.2)throw Error('Dynamic masks exceed 20% of image');
  const ratio=changed/(pixels-masked);return {status:ratio<=maxChangedRatio?'PASS':'FAIL',changed,pixels,masked,changedRatio:ratio};
}
export async function compareApprovedImage(config){
  const dir=path.join(tool,'ui-baselines',config.id),approval=path.join(dir,'approval.json');noLinks(approval);
  if(!fs.existsSync(approval))return {status:'NOT_RUN',reason:'No user-approved visual baseline; no automatic baseline creation'};
  const approved=readJSON(approval);
  if(approved.userApproved!==true||approved.project!==config.id||typeof approved.approvalId!=='string'||!approved.approvalId) return {status:'BLOCKED',reason:'Visual baseline approval missing'};
  const resultPath=path.join(state,'projects',config.id,'nui-latest.json');noLinks(resultPath);
  if(!fs.existsSync(resultPath))return {status:'NOT_RUN',reason:'Current NUI screenshot not available'};
  const run=readJSON(resultPath);
  if(run.status!=='PASS'||run.sourceHash!==sha(JSON.stringify(inventory(config.source))))return {status:'NOT_RUN',reason:'Screenshot is not from passing tests of current source bytes'};
  const current=inside(state,path.relative(state,path.join(run.dir,'screenshots/nui-success.png'))),baseline=inside(dir,approved.file);noLinks(current);noLinks(baseline);
  if(sha(fs.readFileSync(baseline))!==approved.sha256)return {status:'BLOCKED',reason:'Approved baseline hash mismatch'};
  const require=createRequire(local().browser.module),{PNG}=require('pngjs');
  const result=comparePixels(PNG.sync.read(fs.readFileSync(baseline)),PNG.sync.read(fs.readFileSync(current)),approved.comparison||{});
  return {...result,baseline:path.relative(repo,baseline),current:path.relative(repo,current),approvalId:approved.approvalId,sourceHash:run.sourceHash};
}
