export function assertBridgeApproval(approval){
  if(approval?.userApproved!==true||approval.rollbackConsoleVerified!==true||approval.kind!=='selftest-bridge-v1')
    throw Error('User approval and authenticated rollback console are required');
  if(!/^[a-f0-9-]{36}$/.test(approval.planId||''))throw Error('Invalid approved plan');
  for(const id of ['base','link'])if(!/^[a-f0-9]{64}$/.test(approval.auditedTargets?.[id]||''))throw Error('Deployed code audit identity missing');
}
