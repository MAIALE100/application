import crypto from 'node:crypto';
const clone=value=>structuredClone(value);
export const digest=value=>crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
export const policies={
  flecity_base_workspaces:{owner:'owner_citizenid'},
  flecity_base_members:{parent:'flecity_base_workspaces',foreign:'workspace_id'},
  flecity_base_stock_items:{parent:'flecity_base_workspaces',foreign:'workspace_id'},
  flecity_base_stock_movements:{parent:'flecity_base_stock_items',foreign:'item_id'},
  flecity_game_profiles:{owner:'player_identifier'}
};
// Offline storage only. This is deliberately NOT a live SQL authorization layer.
// A future live adapter must enforce these constraints server-side before any SQL.
export class FixtureScope{
  #rows;#baseline;#ledger={};#events=[];#closed=false;
  constructor(project,baseline={}){
    this.runId=crypto.randomUUID();this.project=project;
    this.owner='FCT_'+this.runId.replaceAll('-','');
    this.label='FCT-'+this.runId.slice(0,8);
    for(const key of ['runId','owner','label','project'])Object.defineProperty(this,key,{writable:false});
    this.#rows=clone(baseline);this.#baseline=clone(baseline);
    for(const table of Object.keys(baseline))if(!policies[table])throw Error('Unknown fixture table');
  }
  #assertOpen(){if(this.#closed)throw Error('Fixture scope closed');}
  #owned(table,id){
    if(!policies[table]||!this.#ledger[table]?.[id])throw Error('Row not owned by this exact run');
    const row=this.#rows[table]?.[id];
    if(!row||digest(row)!==this.#ledger[table][id])throw Error('Fixture changed outside guard');
    return row;
  }
  #validate(table,row){
    const p=policies[table];if(!p)throw Error('Table not allowed');
    if(p.owner&&row[p.owner]!==this.owner)throw Error('Foreign identity');
    if(p.parent)this.#owned(p.parent,String(row[p.foreign]));
    if(table==='flecity_base_members'&&row.citizenid!==this.owner)throw Error('Foreign member');
    if(table==='flecity_base_stock_items'&&row.created_by!==this.owner)throw Error('Foreign stock creator');
    if(table==='flecity_base_stock_movements'){
      if(row.actor_citizenid!==this.owner)throw Error('Foreign movement actor');
      const item=this.#owned(p.parent,String(row.item_id));
      if(row.workspace_id!==item.workspace_id)throw Error('Cross-workspace movement');
    }
  }
  insert(table,id,row){
    this.#assertOpen();id=String(id);
    if(!/^[A-Za-z0-9_-]+$/.test(id)||['__proto__','constructor','prototype'].includes(id))throw Error('Invalid fixture key');
    if(row.id!==undefined&&String(row.id)!==id)throw Error('Fixture primary key mismatch');
    this.#validate(table,row);
    if(Object.hasOwn(this.#rows[table]||{},id))throw Error('Existing row collision; never adopt by prefix');
    const next=clone(row);this.#rows[table]??={};this.#rows[table][id]=next;
    this.#ledger[table]??={};this.#ledger[table][id]=digest(next);
    this.#events.push({operation:'insert',table,id,before:null,after:clone(next)});return clone(next);
  }
  update(table,id,patch){
    this.#assertOpen();id=String(id);const before=clone(this.#owned(table,id)),next={...before,...clone(patch)};
    const p=policies[table];
    for(const key of ['id',p.owner,p.foreign,'workspace_id','created_by','actor_citizenid','citizenid'].filter(Boolean))
      if(next[key]!==before[key])throw Error('Ownership/relationship keys immutable');
    this.#validate(table,next);this.#rows[table][id]=next;this.#ledger[table][id]=digest(next);
    this.#events.push({operation:'update',table,id,before,after:clone(next)});return clone(next);
  }
  read(table,id){return clone(this.#rows[table]?.[String(id)]??null);}
  list(table){return clone(Object.values(this.#rows[table]||{}));}
  snapshot(){return clone(this.#rows);}
  transaction(fn){
    this.#assertOpen();const before=[clone(this.#rows),clone(this.#ledger),clone(this.#events)];
    try{return fn();}catch(e){[this.#rows,this.#ledger,this.#events]=before;throw e;}
  }
  receipt(){return {version:1,mode:'offline-only',runId:this.runId,project:this.project,owner:this.owner,label:this.label,
    baseline:clone(this.#baseline),rows:this.snapshot(),ledger:clone(this.#ledger),events:clone(this.#events),closed:this.#closed};}
  cleanupPlan(){
    const receipt=this.receipt();assertProtectedUnchanged(receipt);
    for(const [t,ids]of Object.entries(this.#ledger))for(const id of Object.keys(ids))this.#owned(t,id);
    return {runId:this.runId,expected:digest(receipt.rows),deleteExact:Object.entries(this.#ledger).flatMap(([table,ids])=>Object.keys(ids).map(id=>({table,id}))).reverse()};
  }
  cleanup(plan){
    this.#assertOpen();const fresh=this.cleanupPlan();
    if(digest(fresh)!==digest(plan))throw Error('Cleanup plan stale or broadened; hold for review');
    for(const {table,id}of fresh.deleteExact)delete this.#rows[table][id];
    this.#closed=true;assertProtectedUnchanged(this.receipt());
    for(const [table,ids]of Object.entries(this.#ledger))for(const id of Object.keys(ids))if(this.#rows[table]?.[id])throw Error('Fixture cleanup incomplete');
    return this.receipt();
  }
}
export function assertProtectedUnchanged(receipt){
  const {baseline,rows,ledger}=receipt;
  for(const table of new Set([...Object.keys(baseline),...Object.keys(rows)])){
    for(const id of new Set([...Object.keys(baseline[table]||{}),...Object.keys(rows[table]||{})])){
      const before=baseline[table]?.[id],after=rows[table]?.[id];
      if(ledger[table]?.[id]){if(before!==undefined)throw Error('Ledger overlaps pre-existing row');}
      else if(digest(before??null)!==digest(after??null))throw Error('Non-fixture row changed: '+table+'/'+id);
    }
  }
  return true;
}
