-- No network events, HTTP handlers, restart, stop/start, SQL or user actors.
local RESOURCE=GetCurrentResourceName()
local config=json.decode(LoadResourceFile(RESOURCE,'private.json') or '{}')
local seen={}
CreateThread(function()
    while true do
        Wait(250)
        local raw=LoadResourceFile(RESOURCE,'request.json')
        if raw and #raw<=4096 then
            local decoded,request=pcall(json.decode,raw)
            if decoded and type(request)=='table' and type(request.id)=='string' and not seen[request.id] then
                local selected=FlecityAutotestPolicy.operations[request.operation]
                local context={now=os.time(),players=GetNumPlayerIndices(),replayed=false,
                    resourceState=selected and GetResourceState(selected.resource) or 'missing'}
                local operation,reason=FlecityAutotestPolicy.Check(request,config,context)
                -- Invalid IDs/tokens are not reflected into console or result messages.
                if operation then
                    seen[request.id]=os.time()
                    print('[FLECITY_AUTOTEST] BEGIN '..request.id..' '..request.operation)
                    local ok=pcall(ExecuteCommand,operation.command)
                    SaveResourceFile(RESOURCE,'response.json',json.encode({id=request.id,status=ok and 'ISSUED' or 'FAIL',operation=request.operation,
                        proofOfPass=false,detail=ok and 'Await matching resource selftest log summary' or 'Command dispatch failed'}),-1)
                elseif reason~='UNAUTHORIZED' and request.token==config.token and request.id:match('^[%w%-]+$') and #request.id<=64 then
                    seen[request.id]=os.time()
                    SaveResourceFile(RESOURCE,'response.json',json.encode({id=request.id,status='BLOCKED',reason=reason,proofOfPass=false}),-1)
                end
            end
        end
        for id,time in pairs(seen) do if os.time()-time>600 then seen[id]=nil end end
    end
end)
