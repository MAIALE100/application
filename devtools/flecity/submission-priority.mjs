export const submissionOrder=['loop','link','base','wave'];
export const jointReleaseApps=['loop','link'];
export function jointSubmissionDecision(apps,hashes){
  const members=jointReleaseApps.map(id=>({app:id,...submissionDecision(apps[id],hashes[id])}));
  const blockers=members.flatMap(m=>m.blockers.map(b=>m.app+':'+b));
  if(!hashes.loop||hashes.loop!==hashes.link)blockers.push('SHARED_SOURCE_MISMATCH');
  return {id:'loop_link',apps:jointReleaseApps,status:blockers.length?'NOT_READY':'SUBMISSION_CANDIDATE',mayPublish:false,blockers,members};
}
export function submissionTasks(policy){
  const suites={loop:['static','db','nui','visual'],base:['static','db','nui','visual'],link:['static','db','game','virtual-multiplayer','nui','visual'],wave:['static','db','nui','visual']};
  return [{id:'toolkit',suites:['tests']},...submissionOrder.map(id=>({id,suites:suites[id]})),
    ...Object.entries(policy.apps).filter(([,p])=>p.track==='maintenance'&&p.automation==='ACTIVE').map(([id])=>({id,suites:['static']}))];
}
export const submissionGates=['criticalBugs','automatedTests','liveFiveM','dbAndPermissions','japaneseUi','crossAppAndData','japaneseDocs','zipInspection'];
export function submissionDecision(app,currentHash){
  const blockers=[];
  if(app?.track!=='submission')blockers.push('NOT_SUBMISSION_TRACK');
  if(!currentHash||app?.auditedSourceHash!==currentHash)blockers.push('SOURCE_NOT_AUDITED');
  for(const gate of submissionGates)if(app?.gates?.[gate]!=='PASS')blockers.push(gate+':'+(app?.gates?.[gate]||'NOT_RUN'));
  if(app?.knownCriticalBugs?.length)blockers.push('CRITICAL_BUGS_REMAIN');
  return {status:blockers.length?'NOT_READY':'SUBMISSION_CANDIDATE',mayPublish:false,blockers};
}
