-- LOOP-only production client. Game callbacks retain the original platform API names.
local RESOURCE = GetCurrentResourceName()
local app = FlecityGamesConfig.Apps.Play
local appOpen = false
local phoneOpen = false
local lifecycleGeneration = 0
local cacheBust = tostring(GetGameTimer())

local function bumpLifecycle()
    lifecycleGeneration = lifecycleGeneration + 1
    return lifecycleGeneration
end

local function requestCleanup(reason)
    local generation = bumpLifecycle()
    if GetResourceState('lb-phone') == 'started' then
        pcall(function()
            exports['lb-phone']:SendCustomAppMessage(app.identifier,{
                type='playSuspend',
                reason=tostring(reason or 'close')
            })
        end)
    end
    CreateThread(function()
        Wait(3500)
        if generation ~= lifecycleGeneration then return end
        if appOpen and phoneOpen then return end
        TriggerServerEvent('flecity_games:server:playClosed')
    end)
end

RegisterNetEvent('lb-phone:phoneToggled',function(open)
    phoneOpen = open == true
    if phoneOpen then
        bumpLifecycle()
    else
        requestCleanup('phone_close')
    end
end)

local function appData()
    return {
        identifier=app.identifier,
        name=app.name,
        description=app.description,
        developer=app.developer,
        defaultApp=app.defaultApp,
        game=app.game,
        size=app.size,
        price=app.price,
        images=app.images,
        ui=RESOURCE..'/'..app.ui..'?cb='..cacheBust,
        icon=('https://cfx-nui-%s/%s?cb=%s'):format(RESOURCE,app.icon,cacheBust),
        fixBlur=true,
        onOpen=function()
            appOpen=true
            bumpLifecycle()
        end,
        onClose=function()
            appOpen=false
            requestCleanup('app_close')
        end
    }
end

local function addApp()
    if GetResourceState('lb-phone')~='started' then return false end
    local ok,result,err=pcall(function()
        return exports['lb-phone']:AddCustomApp(appData())
    end)
    if ok and result then return true end
    if err=='APP_ALREADY_EXISTS' then
        pcall(function() exports['lb-phone']:RemoveCustomApp(app.identifier) end)
        Wait(75)
        ok,result,err=pcall(function()
            return exports['lb-phone']:AddCustomApp(appData())
        end)
        if ok and result then return true end
    end
    print(('[FlecityGames LOOP] custom app registration failed: %s'):format(tostring(err or result)))
    return false
end

local registrationBusy=false
local function registerApp()
    if registrationBusy or GetResourceState('lb-phone')~='started' then return end
    registrationBusy=true
    for attempt=1,5 do
        Wait(attempt==1 and 500 or 300)
        if addApp() then
            print('[FlecityGames LOOP] app registration ready')
            registrationBusy=false
            return
        end
    end
    registrationBusy=false
end

CreateThread(function()
    while GetResourceState('lb-phone')~='started' do Wait(500) end
    registerApp()
end)

AddEventHandler('onResourceStart',function(resource)
    if resource=='lb-phone' then CreateThread(registerApp) end
end)

AddEventHandler('onResourceStop',function(resource)
    if resource~=RESOURCE or GetResourceState('lb-phone')~='started' then return end
    pcall(function() exports['lb-phone']:RemoveCustomApp(app.identifier) end)
end)

local callbackMap={
    playBootstrap='flecity_games:play:bootstrap',
    playStartSession='flecity_games:play:startSession',
    playActivateSession='flecity_games:play:activateSession',
    playCancelSession='flecity_games:play:cancelSession',
    playResetSave='flecity_games:play:resetSave',
    playSave='flecity_games:play:save',
    playSubmitScore='flecity_games:play:submitScore',
    playQuickRound='flecity_games:play:quickRound',
    playStopRound='flecity_games:play:stopRound',
    playHighLowGuess='flecity_games:play:highLowGuess',
    playSubmitSimonRound='flecity_games:play:submitSimonRound',
    playRanking='flecity_games:play:ranking',
    playStatistics='flecity_games:play:statistics',
    profileGetSettings='flecity_games:profile:getSettings',
    profileUpdateSettings='flecity_games:profile:updateSettings'
}

RegisterNUICallback('flecityGames:callback',function(data,cb)
    if type(data)~='table' then return cb({ok=false,error='INVALID_REQUEST'}) end
    local action=tostring(data.action or '')
    if action=='bridgePing' then
        return cb({
            ok=true,bridge='lb-phone',resource=RESOURCE,
            version=GetResourceMetadata(RESOURCE,'version',0) or 'unknown',
            lbPhoneState=GetResourceState('lb-phone')
        })
    end
    local callbackName=callbackMap[action]
    if not callbackName then return cb({ok=false,error='UNKNOWN_ACTION'}) end
    local ok,result=pcall(function()
        return exports['lb-phone']:AwaitCallback(
            callbackName,type(data.payload)=='table' and data.payload or {}
        )
    end)
    if not ok then
        if FlecityGamesConfig.Debug then
            print(('[FlecityGames LOOP] callback %s failed: %s'):format(callbackName,tostring(result)))
        end
        return cb({ok=false,error='PHONE_CALLBACK_FAILED'})
    end
    cb(result or {ok=false,error='EMPTY_RESPONSE'})
end)
