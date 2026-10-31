-- Executes real BASE handlers with virtual identities and in-memory SQL responses.
-- No threads, callbacks, engine commands, real DB, bank, inventory, or network.
local root=arg[1] or 'flecity_base'
GetCurrentResourceName=function()return 'flecity_base'end
IsPlayerAceAllowed=function()return false end
CreateThread=function()end RegisterCommand=function()end AddEventHandler=function()end
local identities={[101]='OWNER',[102]='MANAGER',[103]='MEMBER',[104]='OUTSIDER'}
FlecityBaseFramework={GetIdentifier=function(s)return identities[s]end,GetCharacterName=function(s)return identities[s]end,GetJob=function()return nil end}
dofile(root..'/config.lua')
local writes={}
MySQL={single={await=function(sql,args)
 if sql:find('JOIN flecity_base_members',1,true) then
  if args[1]~=1 or args[2]=='OUTSIDER' then return nil end
  return {id=1,owner_citizenid='OWNER',role=args[2]:lower(),is_personal=0,name='Fixture'}
 end
 if sql:find('FROM flecity_base_tasks',1,true) then return {id=11,title='保持するタスク',details='保持',status='todo',priority='normal',assignee_citizenid='MEMBER'}end
 error('Unexpected SQL read: '..sql)
end},update={await=function(sql,args)writes[#writes+1]={sql=sql,args=args};return 1 end},insert={await=function()error('Insert forbidden in access fixture')end}}
local file=assert(io.open(root..'/server/main.lua','rb'));local code=file:read('*a');file:close()
local api=assert(load(code..'\nreturn {handlers=handlers,safeCall=safeCall}','BASE-real-handlers'))()
local h=api.handlers
local function denied(handler,actor,data,expected)
 local before=#writes local r=h[handler](actor,data)
 assert(r.ok==false and (not expected or r.error==expected),handler..': '..tostring(r.error))
 assert(#writes==before,handler..' wrote on denial')
end
for _,handler in ipairs({'noteCreate','noteUpdate','noteDelete','notePin','stockCreate','stockConfigure','stockDelete','taskCreate','taskDelete','moneyVoid'}) do
 denied(handler,103,{workspaceId=1,id=11,role='owner',citizenid='OWNER'},'MANAGER_REQUIRED')
 denied(handler,104,{workspaceId=1,id=11},'NOT_A_MEMBER')
end
denied('workspaceRename',102,{workspaceId=1,name='forged'},'OWNER_REQUIRED')
denied('noteUpdate',102,{workspaceId=2,id=11,title='x',body='x'},'NOT_A_MEMBER')
for _,workspace in ipairs({0,-1,0.5,'bad'}) do denied('noteUpdate',102,{workspaceId=workspace,id=11,title='x',body='x'})end
local function note(body)return {workspaceId=1,id=11,title='日本語メモ',body=body,category='general',tags='保持'}end
denied('noteUpdate',102,note(nil),'INVALID_NOTE_TEXT')
for _,body in ipairs({false,{},123,string.char(255),string.rep('x',FlecityBaseConfig.Limits.noteBody+1)}) do
 denied('noteUpdate',102,note(body),'INVALID_NOTE_TEXT')
end
for _,id in ipairs({0,-1,0.5,'bad'})do
 for _,handler in ipairs({'noteUpdate','noteDelete','notePin'})do local data=note('保持');data.id=id;denied(handler,102,data,'INVALID_NOTE_ID')end
end
local r=h.noteUpdate(102,note('既存の内容を正しく更新'));assert(r.ok and writes[#writes].args[2]=='既存の内容を正しく更新')
r=h.noteUpdate(102,note(string.rep('あ',FlecityBaseConfig.Limits.noteBody)));assert(r.ok,'Japanese character limit must not be treated as a byte limit')
r=h.noteUpdate(102,note(''));assert(r.ok and writes[#writes].args[2]=='','Explicit empty body must remain supported')
for _,details in ipairs({{},false,string.char(255),string.rep('x',FlecityBaseConfig.Limits.taskDetails+1)})do
 denied('taskUpdate',102,{workspaceId=1,id=11,title='保持',details=details},'INVALID_TASK_TEXT')
 denied('taskCreate',102,{workspaceId=1,title='保持',details=details},'INVALID_TASK_TEXT')
end
local before=#writes;r=h.taskUpdate(103,{workspaceId=1,id=11,status='done',title='FORGED',details='FORGED'})
assert(r.ok and #writes==before+1 and writes[#writes].args[1]=='done')
assert(not writes[#writes].sql:find('SET title=',1,true),'Member changed managed content')
denied('taskUpdate',101,{workspaceId=2,id=11,status='done'},'NOT_A_MEMBER')
for _,handler in ipairs({'stockHistory','stockAdjust','stockConfigure','stockDelete','taskUpdate','taskDelete','calculatorUpdate','calculatorDelete','moneyVoid'})do
 for _,id in ipairs({0,-1,0.5,'bad',math.huge})do
  local before=#writes local response=api.safeCall(handler,h[handler],101,{workspaceId=1,id=id})
  assert(not response.ok and response.error=='INVALID_RECORD_ID' and #writes==before,handler..' coerced invalid ID')
 end
end
print('PASS: real BASE role/scope guards, malformed workspace/record IDs, invalid UTF-8/type/length preserve notes/tasks, Japanese/explicit clear, member status-only task update; mock SQL only')
