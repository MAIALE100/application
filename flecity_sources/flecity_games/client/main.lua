local RESOURCE = GetCurrentResourceName()

-- A single presentation lease prevents the phone and independent NUI mutating together.
local screen=nil
local pendingReturn=nil
local lastReturned=nil
local screenSerial=0
local function screenOwns(app) return screen and screen.app==app end
local function releaseScreenFocus()
    SetNuiFocus(false,false)
    SetNuiFocusKeepInput(false)
end
local playAppOpen=false
local partyAppOpen=false
local partyPushSuspended=false
local phoneOpen=false
local playLifecycleGeneration=0
local partyLifecycleGeneration=0

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
    if screenOwns('play') then return end
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

local function sendPartyLifecycle(messageType,reason)
    if GetResourceState('lb-phone')~='started' then return end
    pcall(function()
        exports['lb-phone']:SendCustomAppMessage(FlecityGamesConfig.Apps.Party.identifier,{
            type=messageType,
            reason=tostring(reason or '')
        })
    end)
end

local function schedulePartyResume(reason)
    partyLifecycleGeneration=partyLifecycleGeneration+1
    local generation=partyLifecycleGeneration
    CreateThread(function()
        Wait(250)
        if generation~=partyLifecycleGeneration or not partyAppOpen or partyPushSuspended then return end
        sendPartyLifecycle('partyResume',reason or 'app_open')
    end)
end

local function partyOnOpen()
    partyAppOpen=true
    partyPushSuspended=false
    schedulePartyResume('app_open')
end

local function signalPartyClosed()
    TriggerServerEvent('flecity_games:server:partyClosed')
end

local function partyOnClose()
    if screenOwns('party') then return end
    if partyAppOpen then
        sendPartyLifecycle('partySuspend','app_close')
        signalPartyClosed()
    end
    partyAppOpen=false
    partyPushSuspended=true
    partyLifecycleGeneration=partyLifecycleGeneration+1
end

RegisterNetEvent('lb-phone:phoneToggled',function(open)
    phoneOpen=open==true
    if screen and screen.ready and phoneOpen then
        pcall(function() exports['lb-phone']:ToggleOpen(false) end)
        SetNuiFocus(true,true);SetNuiFocusKeepInput(false)
        return
    end
    if phoneOpen then
        bumpPlayLifecycle()
        if partyAppOpen then
            partyPushSuspended=false
            schedulePartyResume('phone_open')
        end
    else
        requestPlayCleanup('phone_close')
        if partyAppOpen and not screenOwns('party') then
            sendPartyLifecycle('partySuspend','phone_close')
            signalPartyClosed()
        end
        if not screenOwns('party') then partyPushSuspended=true end
        partyLifecycleGeneration=partyLifecycleGeneration+1
    end
end)

local uiCacheBust=tostring(GetGameTimer())

local function makeAppData(app)
    local data={
        identifier=app.identifier,name=app.name,description=app.description,developer=app.developer,
        defaultApp=app.defaultApp,game=app.game,size=app.size,price=app.price,
        images=app.images,ui=RESOURCE..'/'..app.ui..'?cb='..uiCacheBust,
        icon=(('https://cfx-nui-%s/%s?cb=%s'):format(RESOURCE,app.icon,uiCacheBust)),fixBlur=true
    }
    if app.identifier==FlecityGamesConfig.Apps.Play.identifier then
        data.onOpen=playOnOpen
        data.onClose=playOnClose
    elseif app.identifier==FlecityGamesConfig.Apps.Party.identifier then
        data.onOpen=partyOnOpen
        data.onClose=partyOnClose
    end
    return data
end

local function addApp(app)
    local data=makeAppData(app)
    local callOk, ok, err = pcall(function()
        return exports['lb-phone']:AddCustomApp(data)
    end)
    if not callOk then
        print(('[FlecityGames] AddCustomApp(%s) API error: %s'):format(app.identifier,tostring(ok)))
        return false
    end
    if ok then return true end

    if err=='APP_ALREADY_EXISTS' then
        -- Re-register instead of accepting stale metadata. This is important
        -- when flags such as fixBlur change while lb-phone remains running.
        pcall(function() exports['lb-phone']:RemoveCustomApp(app.identifier) end)
        Wait(75)
        local retryCallOk,retryOk,retryErr=pcall(function()
            return exports['lb-phone']:AddCustomApp(makeAppData(app))
        end)
        if retryCallOk and retryOk then
            print(('[FlecityGames] refreshed custom app registration: %s'):format(app.identifier))
            return true
        end
        print(('[FlecityGames] refresh AddCustomApp(%s) failed: %s'):format(app.identifier,tostring(retryErr or retryOk)))
        return false
    end

    print(('[FlecityGames] AddCustomApp(%s) failed: %s'):format(app.identifier,tostring(err)))
    return false
end

local function appEnabled(app)
    return type(app)=='table' and app.enabled~=false
end

local function registerApps()
    if GetResourceState('lb-phone')~='started' then return end
    for attempt=1,5 do
        Wait(attempt==1 and 500 or 300)
        local playOk=not appEnabled(FlecityGamesConfig.Apps.Play) or addApp(FlecityGamesConfig.Apps.Play)
        local partyOk=not appEnabled(FlecityGamesConfig.Apps.Party) or addApp(FlecityGamesConfig.Apps.Party)
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
    if resource=='lb-phone' or resource==RESOURCE then
        screen=nil;pendingReturn=nil;lastReturned=nil;releaseScreenFocus();SendNUIMessage({type='screenHide'})
    end
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
    playQuickRound='flecity_games:play:quickRound',
    playStopRound='flecity_games:play:stopRound',
    playHighLowGuess='flecity_games:play:highLowGuess',
    playSubmitSimonRound='flecity_games:play:submitSimonRound',
    playRanking='flecity_games:play:ranking',
    playStatistics='flecity_games:play:statistics',
    profileGetSettings='flecity_games:profile:getSettings',
    profileUpdateSettings='flecity_games:profile:updateSettings',
    partyGetConfig='flecity_games:party:getConfig',
    partyGetPlus='flecity_games:party:getPlus',
    partySubscribePlus='flecity_games:party:subscribePlus',
    partyCancelPlus='flecity_games:party:cancelPlus',
    partyCreateRoom='flecity_games:party:createRoom',
    partyJoinRoom='flecity_games:party:joinRoom',
    partyGetRoom='flecity_games:party:getRoom',
    partySetReady='flecity_games:party:setReady',
    partySelectGame='flecity_games:party:selectGame',
    partySetMastermindOptions='flecity_games:party:setMastermindOptions',
    partySetShogiOptions='flecity_games:party:setShogiOptions',
    partyStartRound='flecity_games:party:startRound',
    partySubmitReaction='flecity_games:party:submitReaction',
    partySubmitStopBattle='flecity_games:party:submitStopBattle',
    partySubmitVote='flecity_games:party:submitVote',
    partySubmitMajority='flecity_games:party:submitMajority',
    partySubmitMinority='flecity_games:party:submitMinority',
    partySubmitCodeBreak='flecity_games:party:submitCodeBreak',
    partySubmitReversi='flecity_games:party:submitReversi',
    partySubmitGomoku='flecity_games:party:submitGomoku',
    partySubmitConnect4='flecity_games:party:submitConnect4',
    partySubmitMiniShogi='flecity_games:party:submitMiniShogi',
    partySubmitTicTac='flecity_games:party:submitTicTac',
    partySubmitWordWolfVote='flecity_games:party:submitWordWolfVote',
    partySubmitLiarVote='flecity_games:party:submitLiarVote',
    partyAddDrawStroke='flecity_games:party:addDrawStroke',
    partyClearDrawing='flecity_games:party:clearDrawing',
    partySubmitDrawGuess='flecity_games:party:submitDrawGuess',
    partySubmitTelephoneDrawing='flecity_games:party:submitTelephoneDrawing',
    partySubmitTelephoneText='flecity_games:party:submitTelephoneText',
    partySubmitNgWordClue='flecity_games:party:submitNgWordClue',
    partySubmitNgWordGuess='flecity_games:party:submitNgWordGuess',
    partySubmitFakeAnswer='flecity_games:party:submitFakeAnswer',
    partySubmitFakeVote='flecity_games:party:submitFakeVote',
    partySubmitBombPass='flecity_games:party:submitBombPass',
    partySubmitMemoryChain='flecity_games:party:submitMemoryChain',
    partySubmitFallBattle='flecity_games:party:submitFallBattle',
    partyReturnLobby='flecity_games:party:returnLobby',
    partyLeaveRoom='flecity_games:party:leaveRoom'
}

RegisterNetEvent('flecity_games:client:partyUpdate',function(room)
    if screenOwns('party') and screen.ready and type(room)=='table' then SendNUIMessage({type='partyUpdate',room=room});return end
    if GetResourceState('lb-phone')~='started' or type(room)~='table' or not partyAppOpen or partyPushSuspended then return end
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
    if screenOwns('party') and screen.ready and type(data)=='table' then SendNUIMessage({type='partyDrawStroke',token=data.token,revision=data.revision,points=data.points});return end
    if GetResourceState('lb-phone')~='started' or type(data)~='table' or not partyAppOpen or partyPushSuspended then return end
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
    if screenOwns('party') and screen.ready and type(data)=='table' then SendNUIMessage({type='partyDrawClear',token=data.token,revision=data.revision});return end
    if GetResourceState('lb-phone')~='started' or type(data)~='table' or not partyAppOpen or partyPushSuspended then return end
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
    local payload=type(data.payload)=='table' and data.payload or {}
    local app=payload.app
    local isExpanded=data.surface=='expanded'
    if action=='localDiagnostics' then
        local ped=PlayerPedId()
        return cb({ok=true,state={dead=IsEntityDead(ped),ragdoll=IsPedRagdoll(ped),falling=IsPedFalling(ped),freezeProbeAvailable=type(IsEntityPositionFrozen)=='function',frozen=type(IsEntityPositionFrozen)=='function' and IsEntityPositionFrozen(ped) or false,nuiFocused=IsNuiFocused(),phoneOpen=phoneOpen,expanded=screen~=nil}})
    end
    if action:sub(1,6)=='screen' then
        if app~='play' and app~='party' then return cb({ok=false,error='INVALID_APP'}) end
        local appConfig=app=='play' and FlecityGamesConfig.Apps.Play or FlecityGamesConfig.Apps.Party
        if not appEnabled(appConfig) then return cb({ok=false,error='APP_DISABLED'}) end
        if action=='screenStatus' then return cb({ok=true,owner=screen and 'expanded' or 'phone',ready=screen and screen.ready or false,returnPending=pendingReturn~=nil}) end
        if action=='screenClaim' and not isExpanded then
            if pendingReturn and pendingReturn.app==app then return cb({ok=true,state=pendingReturn.state,lease=pendingReturn.lease}) end
            return cb({ok=true,parked=screenOwns(app)})
        end
        if action=='screenReturned' and not isExpanded and lastReturned and lastReturned.app==app and lastReturned.lease==payload.lease then return cb({ok=true}) end
        if action=='screenReturned' and not isExpanded and pendingReturn and pendingReturn.app==app and payload.lease==pendingReturn.lease then
            lastReturned={app=app,lease=pendingReturn.lease};pendingReturn=nil
            if app=='party' then partyAppOpen=true;partyPushSuspended=false end
            return cb({ok=true})
        end
        if action=='screenOpen' and not isExpanded and not screen and not pendingReturn and phoneOpen then
            if type(payload.state)~='table' or #json.encode(payload.state)>524288 then return cb({ok=false,error='INVALID_STATE'}) end
            screenSerial=screenSerial+1
            screen={app=app,lease=tostring(GetGameTimer())..'-'..screenSerial,state=payload.state,ready=false}
            bumpPlayLifecycle();partyLifecycleGeneration=partyLifecycleGeneration+1
            SendNUIMessage({type='screenOpen',app=app,lease=screen.lease,state=screen.state})
            local id=screen.lease
            CreateThread(function()
                Wait(8000)
                if screen and screen.lease==id and not screen.ready then
                    pendingReturn=screen;screen=nil;releaseScreenFocus();SendNUIMessage({type='screenHide'})
                    pcall(function() exports['lb-phone']:SendCustomAppMessage(appConfig.identifier,{type='screenRestore'}) end)
                end
            end)
            return cb({ok=true,lease=id})
        end
        if screen and screen.app==app and screen.lease==payload.lease and isExpanded then
            if action=='screenReady' and screen.ready then return cb({ok=true}) end
            if action=='screenReady' and not screen.ready then
                screen.ready=true;screen.state=nil
                pcall(function() exports['lb-phone']:ToggleOpen(false) end)
                SetNuiFocus(true,true);SetNuiFocusKeepInput(false)
                return cb({ok=true})
            end
            if action=='screenClose' and screen.ready and type(payload.state)=='table' and #json.encode(payload.state)<=524288 then
                pendingReturn={app=app,lease=screen.lease,state=payload.state};screen=nil
                releaseScreenFocus();SendNUIMessage({type='screenHide'})
                pcall(function() exports['lb-phone']:ToggleOpen(true) end)
                CreateThread(function() Wait(300);pcall(function() exports['lb-phone']:SendCustomAppMessage(appConfig.identifier,{type='screenReturn'}) end) end)
                return cb({ok=true})
            end
        end
        return cb({ok=false,error='SCREEN_LEASE_MISMATCH'})
    end
    if screen then
        if not isExpanded or data.lease~=screen.lease or not screen.ready then return cb({ok=false,error='APP_SUSPENDED'}) end
        if (action:sub(1,5)=='party' and screen.app~='party') or (action:sub(1,4)=='play' and screen.app~='play') then return cb({ok=false,error='APP_SUSPENDED'}) end
    elseif isExpanded then return cb({ok=false,error='APP_SUSPENDED'}) end
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
    -- NUI promises can resolve after LB Phone has already suspended/closed PARTY.
    -- Reject any PARTY request that reaches the client after that lifecycle edge so
    -- stale polling/submits (including GetRoom presence recovery) never reach server.
    if action:sub(1,5)=='party' and not screenOwns('party') and (not partyAppOpen or partyPushSuspended) then
        return cb({ok=false,error='APP_SUSPENDED'})
    end
    local ok,result=pcall(function()
        return exports['lb-phone']:AwaitCallback(callbackName,type(data.payload)=='table' and data.payload or {})
    end)
    if not ok then
        if FlecityGamesConfig.Debug then print(('[FlecityGames] callback %s failed: %s'):format(callbackName,tostring(result))) end
        return cb({ok=false,error='PHONE_CALLBACK_FAILED'})
    end
    cb(result or {ok=false,error='EMPTY_RESPONSE'})
end)
