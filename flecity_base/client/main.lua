local RESOURCE = GetCurrentResourceName()
local APP = FlecityBaseConfig.App
local cacheBust = tostring(GetGameTimer())

local function appData()
    return {
        identifier = APP.identifier,
        name = APP.name,
        description = APP.description,
        developer = APP.developer,
        defaultApp = APP.defaultApp,
        game = APP.game,
        size = APP.size,
        price = APP.price,
        ui = RESOURCE .. '/' .. APP.ui .. '?cb=' .. cacheBust,
        icon = ('https://cfx-nui-%s/%s?cb=%s'):format(RESOURCE, APP.icon, cacheBust),
        fixBlur = APP.fixBlur == true
    }
end

local function addApp()
    if GetResourceState('lb-phone') ~= 'started' then return false end
    local callOk, ok, err = pcall(function()
        return exports['lb-phone']:AddCustomApp(appData())
    end)
    if callOk and ok then return true end

    if callOk and err == 'APP_ALREADY_EXISTS' then
        pcall(function() exports['lb-phone']:RemoveCustomApp(APP.identifier) end)
        Wait(75)
        local retryCallOk, retryOk, retryErr = pcall(function()
            return exports['lb-phone']:AddCustomApp(appData())
        end)
        if retryCallOk and retryOk then
            print('[BASE] refreshed LB Phone custom app registration')
            return true
        end
        print(('[BASE] AddCustomApp retry failed: %s'):format(tostring(retryErr or retryOk)))
        return false
    end

    print(('[BASE] AddCustomApp failed: %s'):format(tostring(err or ok)))
    return false
end

local function registerApp()
    for attempt = 1, 5 do
        if GetResourceState('lb-phone') == 'started' then
            Wait(attempt == 1 and 400 or 300)
            if addApp() then
                print(('[BASE] custom app ready (attempt %d)'):format(attempt))
                return
            end
        else
            Wait(500)
        end
    end
    print('[BASE] custom app registration failed after retries')
end

CreateThread(function()
    while GetResourceState('lb-phone') ~= 'started' do Wait(500) end
    registerApp()
end)

AddEventHandler('onResourceStart', function(resource)
    if resource == 'lb-phone' then CreateThread(registerApp) end
end)

AddEventHandler('onResourceStop', function(resource)
    if resource ~= RESOURCE or GetResourceState('lb-phone') ~= 'started' then return end
    pcall(function() exports['lb-phone']:RemoveCustomApp(APP.identifier) end)
end)

local callbackMap = {
    bootstrap = 'flecity_base:bootstrap',
    workspaceCreate = 'flecity_base:workspaceCreate',
    workspaceGet = 'flecity_base:workspaceGet',
    workspaceOverview = 'flecity_base:workspaceOverview',
    workspaceRename = 'flecity_base:workspaceRename',
    workspaceSettings = 'flecity_base:workspaceSettings',
    workspaceDelete = 'flecity_base:workspaceDelete',
    workspaceInvite = 'flecity_base:workspaceInvite',
    inviteAccept = 'flecity_base:inviteAccept',
    inviteDecline = 'flecity_base:inviteDecline',
    workspaceLeave = 'flecity_base:workspaceLeave',
    workspaceRemoveMember = 'flecity_base:workspaceRemoveMember',
    workspaceSetRole = 'flecity_base:workspaceSetRole',
    supportToggle = 'flecity_base:supportToggle',
    notesList = 'flecity_base:notesList',
    noteCreate = 'flecity_base:noteCreate',
    noteUpdate = 'flecity_base:noteUpdate',
    noteDelete = 'flecity_base:noteDelete',
    notePin = 'flecity_base:notePin',
    stockList = 'flecity_base:stockList',
    stockHistory = 'flecity_base:stockHistory',
    stockCreate = 'flecity_base:stockCreate',
    stockAdjust = 'flecity_base:stockAdjust',
    stockConfigure = 'flecity_base:stockConfigure',
    stockDelete = 'flecity_base:stockDelete',
    tasksList = 'flecity_base:tasksList',
    taskCreate = 'flecity_base:taskCreate',
    taskUpdate = 'flecity_base:taskUpdate',
    taskDelete = 'flecity_base:taskDelete',
    calculatorsList = 'flecity_base:calculatorsList',
    calculatorCreate = 'flecity_base:calculatorCreate',
    calculatorUpdate = 'flecity_base:calculatorUpdate',
    calculatorDelete = 'flecity_base:calculatorDelete',
    moneyList = 'flecity_base:moneyList',
    moneyAdd = 'flecity_base:moneyAdd',
    moneyVoid = 'flecity_base:moneyVoid'
}

RegisterNUICallback('flecityBase:callback', function(data, cb)
    if type(data) ~= 'table' then return cb({ok=false, error='INVALID_REQUEST'}) end
    local action = tostring(data.action or '')

    if action == 'bridgePing' then
        return cb({
            ok = true,
            resource = RESOURCE,
            version = GetResourceMetadata(RESOURCE, 'version', 0) or 'unknown',
            lbPhoneState = GetResourceState('lb-phone')
        })
    end

    local callbackName = callbackMap[action]
    if not callbackName then return cb({ok=false, error='UNKNOWN_ACTION'}) end

    local ok, result = pcall(function()
        return exports['lb-phone']:AwaitCallback(callbackName, type(data.payload) == 'table' and data.payload or {})
    end)

    if not ok then
        print(('[BASE] AwaitCallback(%s) failed: %s'):format(callbackName, tostring(result)))
        return cb({ok=false, error='BRIDGE_ERROR'})
    end

    cb(result or {ok=false, error='EMPTY_RESPONSE'})
end)
