local RESOURCE=GetCurrentResourceName()
local running=false
local projects=json.decode(LoadResourceFile(RESOURCE,'projects.json') or '{}')
local function response(id,checks)
    SaveResourceFile(RESOURCE,'result.json',json.encode({id=id,checks=checks,completed=true,mode='FXServer+oxmysql+MariaDB; QBox/phone doubles'}),-1)
end
local function call(name,source,payload)return exports['lb-phone']:ValidationCall(name,source,payload or {}) end
local function waitForCallback(name)
    local deadline=GetGameTimer()+20000
    while GetGameTimer()<deadline do
        if exports['lb-phone']:ValidationReady(name) then return end
        Wait(100)
    end
    error('Callback registration timeout: '..name)
end
local function runBase(check)
    waitForCallback('flecity_base:bootstrap')
    local boot=call('flecity_base:bootstrap',1001)
    check('BASE bootstrap through real handler',boot.ok and type(boot.workspaces)=='table')
    local created=call('flecity_base:workspaceCreate',1001,{name='Validation workspace',workspaceType='custom',icon='folder'})
    check('BASE workspace persisted',created.ok and tonumber(created.workspaceId)~=nil)
    local workspace=created.workspaceId
    local denied=call('flecity_base:workspaceGet',1002,{workspaceId=workspace})
    check('BASE cross-workspace access denied',denied.ok==false and denied.error=='NOT_A_MEMBER')
    local field=call('flecity_base:stockFieldCreate',1001,{workspaceId=workspace,label='Location',fieldType='text'})
    check('BASE custom field created',field.ok and field.fieldId~=nil)
    local item=call('flecity_base:stockCreate',1001,{workspaceId=workspace,name='Fixture item',quantity=5,minimumQuantity=1,unit='unit',customValues={[tostring(field.fieldId)]='retained'}})
    check('BASE stock initial quantity and history committed',item.ok)
    local list=call('flecity_base:stockList',1001,{workspaceId=workspace})
    check('BASE stock readable',list.ok and #list.items==1)
    local itemId=list.items[1].id
    local adjusted=call('flecity_base:stockAdjust',1001,{workspaceId=workspace,id=itemId,delta=2,note='lab'})
    check('BASE stock transaction API',adjusted.ok)
    local rows=MySQL.query.await('SELECT quantity FROM flecity_base_stock_items WHERE id=?',{itemId})
    check('BASE DB quantity is 7',rows[1] and rows[1].quantity==7)
    local history=MySQL.query.await('SELECT * FROM flecity_base_stock_movements WHERE item_id=? ORDER BY id',{itemId})
    check('BASE initial/adjustment history chain',#history==2 and history[1].after_quantity==5 and history[2].before_quantity==5 and history[2].after_quantity==7)
    local underflow=call('flecity_base:stockAdjust',1001,{workspaceId=workspace,id=itemId,delta=-100})
    check('BASE negative stock rejected',underflow.ok==false)
end
local function runLink(check)
    waitForCallback('flecity_games:party:createRoom')
    local created=call('flecity_games:party:createRoom',1001,{})
    check('LINK room created through real handler',created.ok and created.room~=nil)
    local code=created.room.code
    local joined=call('flecity_games:party:joinRoom',1002,{code=code})
    check('LINK second identity joins',joined.ok and joined.room~=nil)
    local forged=call('flecity_games:party:selectGame',1002,{gameId='tic_tac'})
    check('LINK host authority enforced',forged.ok==false)
    local selected=call('flecity_games:party:selectGame',1001,{gameId='tic_tac'})
    check('LINK host game selection',selected.ok)
    check('LINK host ready',call('flecity_games:party:setReady',1001,{ready=true}).ok)
    check('LINK member ready',call('flecity_games:party:setReady',1002,{ready=true}).ok)
    local started=call('flecity_games:party:startRound',1001,{})
    check('LINK starts two-identity round',started.ok and started.room~=nil)
    local outsider=call('flecity_games:party:getRoom',1003,{})
    check('LINK outsider cannot read room',outsider.ok==false)
    check('LINK member leaves',call('flecity_games:party:leaveRoom',1002,{}).ok)
    check('LINK host leaves',call('flecity_games:party:leaveRoom',1001,{}).ok)
end
RegisterCommand('validation_run',function(source,args)
    if source~=0 or running then return end
    local project=args[1]
    local id=args[2]
    if not projects[project] or not id or not id:match('^[%w%-]+$') then return end
    running=true
    CreateThread(function()
        local checks={}
        local function check(name,ok)
            checks[#checks+1]={name=name,status=ok and 'PASS' or 'FAIL'}
            if not ok then error(name) end
        end
        exports.qbx_core:SetActors('LAB_'..id)
        local ok,err=pcall(function()
            if project=='base' then runBase(check)
            elseif project=='link' then runLink(check)
            else
                local code=assert(LoadResourceFile(RESOURCE,'adapters/'..project..'.lua'),'Missing project adapter')
                local adapter=assert(load(code,'@validation/'..project))()
                adapter({check=check,call=call,skip=function(name,detail)checks[#checks+1]={name=name,status='NOT_RUN',detail=detail}end})
            end
        end)
        if not ok then checks[#checks+1]={name='runtime',status='FAIL',detail=tostring(err)} end
        response(id,checks)
        print('[VALIDATION] '..project..' completed '..id)
        running=false
    end)
end,true)
CreateThread(function()
    Wait(1000)print('[VALIDATION] harness ready; no clients, no license secrets')
    while true do
        local states={}
        for _,binding in pairs(projects) do states[binding.resource]=GetResourceState(binding.resource) end
        SaveResourceFile(RESOURCE,'state.json',json.encode(states),-1)
        Wait(100)
    end
end)
