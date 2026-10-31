import fs from 'node:fs';import path from 'node:path';
import {FixtureScope,assertProtectedUnchanged} from './scope.mjs';
export async function installBaseFixture(ctx,page){
 const W='flecity_base_workspaces',S='flecity_base_stock_items',M='flecity_base_stock_movements';
 const f=new FixtureScope('base',{[W]:{
   1:{id:1,name:'試験BASE',icon:'📁',workspace_type:'custom',role:'owner',owner_citizenid:'CANARY'},
   2:{id:2,name:'閲覧用BASE',icon:'📁',workspace_type:'custom',role:'member',owner_citizenid:'CANARY'}},
   [S]:{1:{id:1,workspace_id:1,name:'不足アイテム',quantity:2,minimum_quantity:3,unit:'個',category:'試験'},
     2:{id:2,workspace_id:1,name:'通常アイテム',quantity:20,minimum_quantity:0,unit:'個',category:'試験'}}});
 let next=100;const calls=[];
 const persist=()=>fs.writeFileSync(path.join(ctx.run.dir,'fixture-recovery.json'),JSON.stringify(f.receipt(),null,2));
 await page.exposeFunction('__baseFixture',request=>{
   calls.push(request);const {action,payload={}}=request;const wid=Number(payload.workspaceId);
   try{
     let response;
     if(action==='bootstrap')response={ok:true,user:{citizenid:f.owner,name:'Fixture'},workspaces:f.list(W),templates:{custom:{label:'カスタム'}},access:{},invites:[]};
     else if(action==='workspaceGet')response={ok:true,workspace:f.read(W,wid),members:[]};
     else if(action==='workspaceOverview')response={ok:true,metrics:{notes:2,stock:f.list(S).filter(s=>s.workspace_id===wid).length,lowStock:1,openTasks:0,overdueTasks:0,balance:0},recentNotes:[],recentTasks:[],recentStock:[],recentMoney:[]};
     else if(action==='notesList')response={ok:true,notes:[{id:1,title:'日本語メモ',body:'テストの本文',category:'試験',tags:'確認',author_citizenid:'FIXTURE',updated_at:'2026-10-30 10:00:00'},{id:2,title:'<img src=x onerror="globalThis.__xss=true">',body:'表示用の文字列',category:'試験',updated_at:'2026-10-30 10:00:00'}]};
     else if(action==='stockList')response={ok:true,items:f.list(S).filter(s=>s.workspace_id===wid),customFields:[],recent:f.list(M).filter(m=>m.workspace_id===wid)};
     else if(action==='workspaceCreate'){
       if(!String(payload.name).startsWith(f.label))throw Error('Fixture label required');
       const id=next++;f.transaction(()=>{f.insert(W,id,{id,owner_citizenid:f.owner,name:payload.name,icon:payload.icon,workspace_type:payload.workspaceType,role:'owner'});
         f.insert('flecity_base_members',id+'_'+f.owner,{workspace_id:id,citizenid:f.owner,role:'owner'});});
       response={ok:true,workspaceId:id};
     }else if(action==='stockCreate'){
       if(!Number.isInteger(payload.quantity)||payload.quantity<0||payload.quantity>1000000)throw Error('Invalid fixture quantity');
       const id=next++;f.transaction(()=>{f.insert(S,id,{id,workspace_id:wid,created_by:f.owner,name:payload.name,quantity:payload.quantity,minimum_quantity:payload.minimumQuantity,unit:payload.unit,category:payload.category});
         f.insert(M,next++,{workspace_id:wid,item_id:id,actor_citizenid:f.owner,delta:payload.quantity,before_quantity:0,after_quantity:payload.quantity});});response={ok:true};
     }else if(action==='stockAdjust'){
       const before=f.read(S,payload.id);if(!before||before.workspace_id!==wid)throw Error('Wrong fixture workspace');
       const quantity=before.quantity+payload.delta;if(!Number.isInteger(quantity)||quantity<0||quantity>1000000)throw Error('Invalid quantity');
       f.transaction(()=>{f.update(S,payload.id,{quantity});f.insert(M,next++,{workspace_id:wid,item_id:payload.id,actor_citizenid:f.owner,delta:payload.delta,before_quantity:before.quantity,after_quantity:quantity});});response={ok:true};
     }else throw Error('Unreviewed callback: '+action);
     assertProtectedUnchanged(f.receipt());persist();return response;
   }catch(e){return {ok:false,error:'FIXTURE_SCOPE_DENIED',detail:e.message};}
 });
 await page.addInitScript(({label})=>{
   globalThis.GetParentResourceName=()=> 'flecity_base';globalThis.__fixtureLabel=label;globalThis.__fixtureCalls=[];
   const original=globalThis.fetch.bind(globalThis);
   globalThis.fetch=async(url,init)=>{
     if(String(url)!=='https://flecity_base/flecityBase:callback')return original(url,init);
     const request=JSON.parse(init.body);globalThis.__fixtureCalls.push(request);
     return new Response(JSON.stringify(await globalThis.__baseFixture(request)),{headers:{'Content-Type':'application/json'}});
   };
 },{label:f.label});
 return {cleanup(){persist();const plan=f.cleanupPlan();fs.writeFileSync(path.join(ctx.run.dir,'fixture-cleanup-plan.json'),JSON.stringify(plan,null,2));
   const after=f.cleanup(plan);fs.writeFileSync(path.join(ctx.run.dir,'fixture-cleaned.json'),JSON.stringify(after,null,2));
   fs.writeFileSync(path.join(ctx.run.dir,'logs','fixture-callbacks.json'),JSON.stringify(calls,null,2));return 'Exact run rows removed; baseline canaries unchanged; offline memory only';}};
}
