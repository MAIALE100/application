import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {approvedServer} from '../deployment.mjs';
import {repo,tool,state,readJSON,inventory,sha,json,noLinks} from '../core.mjs';

const relativeTargets={flecity_games:'txData/Qbox_D233FD.base/resources/flecity_games',wave:'txData/Qbox_D233FD.base/resources/[lb-phone]/wave'};
const packageName='FLECITY-THREE-APP-TEST-UPDATE-REVIEW_ONLY-v3.zip';
export function inspectThreeAppDelta({policy,baseline,reviewed,packageRoot,zipPath}){
  if(policy?.serverRoot!==approvedServer||policy?.production!=='never')throw Error('Only the named test server is allowed');
  noLinks(packageRoot);noLinks(zipPath);
  if(sha(fs.readFileSync(zipPath))!==policy.packageSha256)throw Error('Update ZIP SHA mismatch');
  const packageManifest=readJSON(path.join(packageRoot,'UPDATE_MANIFEST.json'));
  if(packageManifest.status!=='REVIEW_ONLY_NOT_DEPLOYABLE'||packageManifest.entries.length!==2)throw Error('Unexpected package manifest');
  const plans=[];
  for(const resource of ['flecity_games','wave']){
    const target=path.resolve(approvedServer,relativeTargets[resource]);noLinks(target);
    const known=baseline.resources?.[resource]?.sha256;
    if(!known)throw Error('Missing Phase 1 baseline');
    const current=inventory(target,true);
    // The file inventory is compared by key and digest; no unexpected file may be silently removed.
    if(Object.keys(current).length!==Object.keys(known).length||Object.entries(known).some(([file,hash])=>current[file]!==hash))
      throw Error('Installed '+resource+' differs from Phase 1 baseline');
    const allowed=policy.allowedChanges?.[resource];
    if(!Array.isArray(allowed)||allowed.length!==1)throw Error('Unexpected change allowlist');
    const relative=allowed[0];
    const entry=packageManifest.entries.find(e=>e.path===resource+'/'+relative);
    if(!entry||packageManifest.entries.filter(e=>e.path.startsWith(resource+'/')).length!==1)throw Error('Package change list differs');
    const payload=path.join(packageRoot,resource,relative);noLinks(payload);
    const after=sha(fs.readFileSync(payload));
    if(current[relative]!==entry.baselineSha256||after!==entry.candidateSha256||
      after!==reviewed?.apps?.[resource==='flecity_games'?'loop':'wave']?.candidateUpdates?.[relative]||
      after===current[relative])throw Error('Candidate hash mismatch');
    const next={...current,[relative]:after};
    plans.push({resource,serverRoot:approvedServer,target,changed:[relative],removed:[],
      beforeSha256:current[relative],afterSha256:after,targetHash:sha(JSON.stringify(current)),
      sourceHash:sha(JSON.stringify(next)),
      payload,packageSha256:policy.packageSha256,status:'REVIEW_ONLY'});
  }
  return {status:'REVIEW_ONLY',reason:'Fresh backups and authenticated target restart not yet verified',plans};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const policy=readJSON(path.join(tool,'TEST_DEPLOY_POLICY.json'));
  const baseline=readJSON(path.join(repo,'reports/phase1-20261101/RESOURCE_MANIFEST.json'));
  const reviewed=readJSON(path.join(repo,'reports/three-app-20261101/MANIFEST.json'));
  const release=path.join(state,'releases/final-prep-20261101');
  const inspected=inspectThreeAppDelta({policy,baseline,reviewed,packageRoot:path.join(release,'update-verify-v3'),zipPath:path.join(release,packageName)});
  const file=path.join(state,'releases/final-prep-20261101/test-deploy-plan.json');json(file,{...inspected,checkedAt:new Date().toISOString()});
  console.log('REVIEW_ONLY exact test-server two-file plan saved; no server files changed');
}
