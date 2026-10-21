local RESOURCE = GetCurrentResourceName()

local playAppOpen=false
local phoneOpen=false
local playLifecycleGeneration=0

local function bumpPlayLifecycle()
    playLifecycleGeneration=playLifecycleGeneration+1
    return playLifecycleGeneration
end

local function pushPlaySuspend(reason)
    if GetResourceState('lb-phone')~='started' then return end
    pcall(function()
        exports['lb-phone']:SendCustomAppMessage(FlecityGamesConfig.Apps.Play.identifier,{
            type='playSuspend',
            reason=tostring(reason or 'close')
        })
    end)
end

local function requestPlayCleanup(reason)
    local generation=bumpPlayLifecycle()
    pushPlaySuspend(reason)
    CreateThread(function()
        Wait(3500)
        if generation~=playLifecycleGeneration then return end
        if playAppOpen and phoneOpen then return end
        TriggerServerEvent('flecity_games:server:playClosed')
    end)
end

local function playOnOpen()
    playAppOpen=true
    bumpPlayLifecycle()
end

local function playOnClose()
    playAppOpen=false
    requestPlayCleanup('app_close')
end

RegisterNetEvent('lb-phone:phoneToggled',function(open)
    phoneOpen=open==true
    if phoneOpen then
        bumpPlayLifecycle()
    else
        requestPlayCleanup('phone_close')
    end
end)

local function addApp(app)
    local callOk, ok, err = pcall(function()
        local data={
            identifier=app.identifier,name=app.name,description=app.description,developer=app.developer,
            defaultApp=app.defaultApp,ui=RESOURCE..'/'..app.ui,
            icon=('https://cfx-nui-%s/%s'):format(RESOURCE,app.icon),fixBlur=false
        }
        if app.identifier==FlecityGamesConfig.Apps.Play.identifier then
            data.onOpen=playOnOpen
            data.onClose=playOnClose
        end
        return exports['lb-phone']:AddCustomApp(data)
    end)
    if not callOk then
        print(('[FlecityGames] AddCustomApp(%s) API error: %s'):format(app.identifier,tostring(ok)))
        return false
    end
    if ok or err=='APP_ALREADY_EXISTS' then return true end
    print(('[FlecityGames] AddCustomApp(%s) failed: %s'):format(app.identifier,tostring(err)))
    return false
end

local function registerApps()
    if GetResourceState('lb-phone')~='started' then return end
    for attempt=1,5 do
        Wait(attempt==1 and 500 or 300)
        local playOk=addApp(FlecityGamesConfig.Apps.Play)
        local partyOk=addApp(FlecityGamesConfig.Apps.Party)
        if playOk and partyOk then
            print(('[FlecityGames] custom apps ready (attempt %d)'):format(attempt))
            return
        end
    end
    print('[FlecityGames] custom app registration did not fully complete after retries')
end

CreateThread(function()
    while GetResourceState('lb-phone')~='started' do Wait(500) end
    registerApps()
end)

AddEventHandler('onResourceStart',function(resource)
    if resource=='lb-phone' then CreateThread(registerApps) end
end)

AddEventHandler('onResourceStop',function(resource)
    if resource~=RESOURCE or GetResourceState('lb-phone')~='started' then return end
    pcall(function() exports['lb-phone']:RemoveCustomApp(FlecityGamesConfig.Apps.Play.identifier) end)
    pcall(function() exports['lb-phone']:RemoveCustomApp(FlecityGamesConfig.Apps.Party.identifier) end)
end)

local callbackMap={
    playBootstrap='flecity_games:play:bootstrap',
    playStartSession='flecity_games:play:startSession',
    playActivateSession='flecity_games:play:activateSession',
    playCancelSession='flecity_games:play:cancelSession',
    playResetSave='flecity_games:play:resetSave',
    playSave='flecity_games:play:save',
    playSubmitScore='flecity_games:play:submitScore',
    playHighLowGuess='flecity_games:play:highLowGuess',
    playSubmitSimonRound='flecity_games:play:submitSimonRound',
    playRanking='flecity_games:play:ranking',
    playStatistics='flecity_games:play:statistics',
    profileGetSettings='flecity_games:profile:getSettings',
    profileUpdateSettings='flecity_games:profile:updateSettings',
    partyGetConfig='flecity_games:party:getConfig',
    partyCreateRoom='flecity_games:party:createRoom',
    partyJoinRoom='flecity_games:party:joinRoom',
    partyGetRoom='flecity_games:party:getRoom',
    partySetReady='flecity_games:party:setReady',
    partySelectGame='flecity_games:party:selectGame',
    partyStartRound='flecity_games:party:startRound',
    partySubmitReaction='flecity_games:party:submitReaction',
    partySubmitStopBattle='flecity_games:party:submitStopBattle',
    partySubmitVote='flecity_games:party:submitVote',
    partySubmitMajority='flecity_games:party:submitMajority',
    partySubmitMinority='flecity_games:party:submitMinority',
    partySubmitTicTac='flecity_games:party:submitTicTac',
    partySubmitWordWolfVote='flecity_games:party:submitWordWolfVote',
    partySubmitLiarVote='flecity_games:party:submitLiarVote',
    partyAddDrawStroke='flecity_games:party:addDrawStroke',
    partyClearDrawing='flecity_games:party:clearDrawing',
    partySubmitDrawGuess='flecity_games:party:submitDrawGuess',
    partySubmitTelephoneDrawing='flecity_games:party:submitTelephoneDrawing',
    partySubmitTelephoneText='flecity_games:party:submitTelephoneText',
    partyReturnLobby='flecity_games:party:returnLobby',
    partyLeaveRoom='flecity_games:party:leaveRoom'
}

RegisterNetEvent('flecity_games:client:partyUpdate',function(room)
    if GetResourceState('lb-phone')~='started' or type(room)~='table' then return end
    local ok,success,err=pcall(function()
        return exports['lb-phone']:SendCustomAppMessage(FlecityGamesConfig.Apps.Party.identifier,{
            type='partyUpdate',
            room=room
        })
    end)
    if FlecityGamesConfig.Debug and (not ok or success==false) then
        print(('[FlecityGames] PARTY push failed: %s'):format(tostring(err or success)))
    end
end)

RegisterNetEvent('flecity_games:client:partyDrawStroke',function(data)
    if GetResourceState('lb-phone')~='started' or type(data)~='table' then return end
    pcall(function()
        exports['lb-phone']:SendCustomAppMessage(FlecityGamesConfig.Apps.Party.identifier,{
            type='partyDrawStroke',
            token=data.token,
            revision=data.revision,
            points=data.points
        })
    end)
end)

RegisterNetEvent('flecity_games:client:partyDrawClear',function(data)
    if GetResourceState('lb-phone')~='started' or type(data)~='table' then return end
    pcall(function()
        exports['lb-phone']:SendCustomAppMessage(FlecityGamesConfig.Apps.Party.identifier,{
            type='partyDrawClear',
            token=data.token,
            revision=data.revision
        })
    end)
end)

RegisterNUICallback('flecityGames:callback',function(data,cb)
    if type(data)~='table' then return cb({ok=false,error='INVALID_REQUEST'}) end

    local action=tostring(data.action or '')
    if action=='bridgePing' then
        return cb({
            ok=true,
            bridge='lb-phone',
            resource=RESOURCE,
            version=GetResourceMetadata(RESOURCE,'version',0) or 'unknown',
            lbPhoneState=GetResourceState('lb-phone')
        })
    end

    local callbackName=callbackMap[action]
    if not callbackName then return cb({ok=false,error='UNKNOWN_ACTION'}) end
    local ok,result=pcall(function()
        return exports['lb-phone']:AwaitCallback(callbackName,type(data.payload)=='table' and data.payload or {})
    end)
    if not ok then
        if FlecityGamesConfig.Debug then print(('[FlecityGames] callback %s failed: %s'):format(callbackName,tostring(result))) end
        return cb({ok=false,error='PHONE_CALLBACK_FAILED'})
    end
    cb(result or {ok=false,error='EMPTY_RESPONSE'})
end)
