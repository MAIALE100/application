local RESOURCE = GetCurrentResourceName()

local function addApp(app)
    local ok, err = exports['lb-phone']:AddCustomApp({
        identifier=app.identifier,name=app.name,description=app.description,developer=app.developer,
        defaultApp=app.defaultApp,ui=RESOURCE..'/'..app.ui,
        icon=('https://cfx-nui-%s/%s'):format(RESOURCE,app.icon),fixBlur=true
    })
    if not ok and err~='APP_ALREADY_EXISTS' then
        print(('[FlecityGames] AddCustomApp(%s) failed: %s'):format(app.identifier,tostring(err)))
    end
end

local function registerApps()
    if GetResourceState('lb-phone')~='started' then return end
    Wait(500)
    addApp(FlecityGamesConfig.Apps.Play)
    addApp(FlecityGamesConfig.Apps.Party)
end

CreateThread(function()
    while GetResourceState('lb-phone')~='started' do Wait(500) end
    registerApps()
end)

AddEventHandler('onResourceStart',function(resource)
    if resource=='lb-phone' then CreateThread(registerApps) end
end)

local callbackMap={
    playBootstrap='flecity_games:play:bootstrap',
    playStartSession='flecity_games:play:startSession',
    playCancelSession='flecity_games:play:cancelSession',
    playResetSave='flecity_games:play:resetSave',
    playSave='flecity_games:play:save',
    playSubmitScore='flecity_games:play:submitScore',
    playRanking='flecity_games:play:ranking',
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
    partySubmitWordWolfVote='flecity_games:party:submitWordWolfVote',
    partySubmitLiarVote='flecity_games:party:submitLiarVote',
    partyReturnLobby='flecity_games:party:returnLobby',
    partyLeaveRoom='flecity_games:party:leaveRoom'
}

RegisterNUICallback('flecityGames:callback',function(data,cb)
    if type(data)~='table' then return cb({ok=false,error='INVALID_REQUEST'}) end
    local callbackName=callbackMap[tostring(data.action or '')]
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
