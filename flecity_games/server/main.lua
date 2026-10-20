math.randomseed(os.time()+GetGameTimer())

local callbacks={
    ['flecity_games:play:bootstrap']=function(source) return FlecityGamesPlay.Bootstrap(source) end,
    ['flecity_games:play:startSession']=function(source,data) return FlecityGamesPlay.StartSession(source,data) end,
    ['flecity_games:play:cancelSession']=function(source,data) return FlecityGamesPlay.CancelSession(source,data) end,
    ['flecity_games:play:resetSave']=function(source,data) return FlecityGamesPlay.ResetSave(source,data) end,
    ['flecity_games:play:save']=function(source,data) return FlecityGamesPlay.Save(source,data) end,
    ['flecity_games:play:submitScore']=function(source,data) return FlecityGamesPlay.SubmitScore(source,data) end,
    ['flecity_games:play:ranking']=function(source,data) return FlecityGamesPlay.Ranking(source,data) end,
    ['flecity_games:play:statistics']=function(source) return FlecityGamesPlay.Statistics(source) end,
    ['flecity_games:profile:getSettings']=function(source) return FlecityGamesProfile.GetSettings(source) end,
    ['flecity_games:profile:updateSettings']=function(source,data) return FlecityGamesProfile.UpdateSettings(source,data) end,
    ['flecity_games:party:getConfig']=function() return FlecityGamesParty.GetConfig() end,
    ['flecity_games:party:createRoom']=function(source) return FlecityGamesParty.CreateRoom(source) end,
    ['flecity_games:party:joinRoom']=function(source,data) return FlecityGamesParty.JoinRoom(source,data) end,
    ['flecity_games:party:getRoom']=function(source) return FlecityGamesParty.GetRoom(source) end,
    ['flecity_games:party:setReady']=function(source,data) return FlecityGamesParty.SetReady(source,data) end,
    ['flecity_games:party:selectGame']=function(source,data) return FlecityGamesParty.SelectGame(source,data) end,
    ['flecity_games:party:startRound']=function(source) return FlecityGamesParty.StartRound(source) end,
    ['flecity_games:party:submitReaction']=function(source,data) return FlecityGamesParty.SubmitReaction(source,data) end,
    ['flecity_games:party:submitStopBattle']=function(source,data) return FlecityGamesParty.SubmitStopBattle(source,data) end,
    ['flecity_games:party:submitVote']=function(source,data) return FlecityGamesParty.SubmitVote(source,data) end,
    ['flecity_games:party:submitMajority']=function(source,data) return FlecityGamesParty.SubmitMajority(source,data) end,
    ['flecity_games:party:submitWordWolfVote']=function(source,data) return FlecityGamesParty.SubmitWordWolfVote(source,data) end,
    ['flecity_games:party:submitLiarVote']=function(source,data) return FlecityGamesParty.SubmitLiarVote(source,data) end,
    ['flecity_games:party:addDrawStroke']=function(source,data) return FlecityGamesParty.AddDrawStroke(source,data) end,
    ['flecity_games:party:clearDrawing']=function(source,data) return FlecityGamesParty.ClearDrawing(source,data) end,
    ['flecity_games:party:submitDrawGuess']=function(source,data) return FlecityGamesParty.SubmitDrawGuess(source,data) end,
    ['flecity_games:party:submitTelephoneDrawing']=function(source,data) return FlecityGamesParty.SubmitTelephoneDrawing(source,data) end,
    ['flecity_games:party:submitTelephoneText']=function(source,data) return FlecityGamesParty.SubmitTelephoneText(source,data) end,
    ['flecity_games:party:returnLobby']=function(source) return FlecityGamesParty.ReturnLobby(source) end,
    ['flecity_games:party:leaveRoom']=function(source) return FlecityGamesParty.LeaveRoom(source) end
}

local registeredPhoneCallbacks=0
local expectedPhoneCallbacks=0
for _ in pairs(callbacks) do expectedPhoneCallbacks=expectedPhoneCallbacks+1 end

local callbackOptions={
    ['flecity_games:play:save']={preventSpam=true,rateLimit=300,defaultReturn={ok=false,error='CALLBACK_FAILED'}},
    ['flecity_games:party:getRoom']={preventSpam=true,rateLimit=240,defaultReturn={ok=false,error='CALLBACK_FAILED'}},
    ['flecity_games:party:addDrawStroke']={preventSpam=true,rateLimit=900,defaultReturn={ok=false,error='CALLBACK_FAILED'}}
}
local defaultCallbackOptions={preventSpam=true,rateLimit=120,defaultReturn={ok=false,error='CALLBACK_FAILED'}}

local function safeCall(name,fn,source,data)
    local ok,result=pcall(fn,source,data)
    if ok then return result or {ok=false,error='EMPTY_RESPONSE'} end
    print(('[FlecityGames] callback %s failed for source=%s: %s'):format(name,tostring(source),tostring(result)))
    return {ok=false,error='SERVER_ERROR'}
end

local callbackRegistrationBusy=false
local function registerPhoneCallbacks()
    if callbackRegistrationBusy or GetResourceState('lb-phone')~='started' then return false end
    callbackRegistrationBusy=true
    registeredPhoneCallbacks=0
    for name,fn in pairs(callbacks) do
        local ok,err=pcall(function()
            exports['lb-phone']:RegisterCallback(name,function(source,data) return safeCall(name,fn,source,data) end,
                callbackOptions[name] or defaultCallbackOptions)
        end)
        if ok then
            registeredPhoneCallbacks=registeredPhoneCallbacks+1
        else
            print(('[FlecityGames] RegisterCallback(%s) API error: %s'):format(name,tostring(err)))
        end
    end
    callbackRegistrationBusy=false
    print(('[FlecityGames] LB Phone callbacks registered %d/%d'):format(registeredPhoneCallbacks,expectedPhoneCallbacks))
    return registeredPhoneCallbacks==expectedPhoneCallbacks
end

local requiredTables={'flecity_game_profiles','flecity_game_scores','flecity_game_saves','flecity_game_achievements','flecity_game_daily'}

local function startupDiagnostics()
    local failures={}
    local function check(name,ok)
        if not ok then failures[#failures+1]=name end
    end

    check('framework bridge',FlecityGamesFramework.IsReady()==true)
    check('lb-phone resource',GetResourceState('lb-phone')=='started')
    check('LB Phone callback API',registeredPhoneCallbacks==expectedPhoneCallbacks)
    check('oxmysql resource',GetResourceState('oxmysql')=='started')
    check('PLAY registry',#FlecityGamesRegistry.List('play',true)==7)
    check('PARTY registry',#FlecityGamesRegistry.List('party',true)==8)

    for _,tableName in ipairs(requiredTables) do
        local exists=tonumber(MySQL.scalar.await([[SELECT COUNT(*) FROM information_schema.TABLES
            WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=?]],{tableName}) or 0)>0
        check('DB '..tableName,exists)
    end
    local uniqueSession=tonumber(MySQL.scalar.await([[SELECT COUNT(*) FROM information_schema.STATISTICS
        WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='flecity_game_scores'
        AND INDEX_NAME='uq_flecity_game_session_token' AND NON_UNIQUE=0]]) or 0)>0
    check('DB unique session token',uniqueSession)

    for name,ok in pairs(FlecityGamesPlay.DebugSelftest()) do
        check('PLAY '..name,ok==true)
    end
    for name,ok in pairs(FlecityGamesParty.DebugSelftest()) do
        check('PARTY '..name,ok==true)
    end

    if #failures==0 then
        print('[FlecityGames] startup preflight READY_FOR_LIVE_TEST')
        return true
    end

    print(('[FlecityGames] startup preflight NOT_READY (%d failures)'):format(#failures))
    for _,name in ipairs(failures) do print('[FlecityGames]   FAIL '..name) end
    return false
end

CreateThread(function()
    while GetResourceState('lb-phone')~='started' or GetResourceState('oxmysql')~='started' do Wait(500) end
    MySQL.ready(function()
        local dbOk,dbErr=FlecityGamesDatabase.Ensure()
        if not dbOk then
            print(('[FlecityGames] database bootstrap failed: %s'):format(tostring(dbErr)))
            return
        end
        local gamesVersion=GetResourceMetadata(GetCurrentResourceName(),'version',0) or 'unknown'
        local phoneVersion=GetResourceMetadata('lb-phone','version',0) or 'unknown'
        local frameworkVersion=FlecityGamesFramework.GetVersion() or 'unknown'
        local databaseVersion=tostring(MySQL.scalar.await('SELECT VERSION()') or 'unknown')
        local artifactVersion=tostring(GetConvar('version','unknown'))
        print(('[FlecityGames] version=%s qbox=%s lb-phone=%s db=%s'):format(gamesVersion,frameworkVersion,phoneVersion,databaseVersion))
        print(('[FlecityGames] artifact=%s'):format(artifactVersion))
        print('[FlecityGames] database schema ready')
        registerPhoneCallbacks()
        startupDiagnostics()
    end)
end)

AddEventHandler('onResourceStart',function(resource)
    if resource~='lb-phone' or resource==GetCurrentResourceName() then return end
    CreateThread(function()
        Wait(500)
        if GetResourceState('lb-phone')=='started' then
            print('[FlecityGames] lb-phone restarted; re-registering server callbacks')
            registerPhoneCallbacks()
        end
    end)
end)

AddEventHandler('playerDropped',function()
    local src=source
    FlecityGamesRateLimit.Clear(src)
    FlecityGamesPlay.DropSource(src)
    FlecityGamesParty.DropSource(src)
end)

CreateThread(function()
    while true do Wait(5000) FlecityGamesPlay.Cleanup() FlecityGamesParty.Cleanup() end
end)

RegisterCommand('game_selftest',function(source)
    local prefix=source==0 and '[FlecityGames selftest]' or ('[FlecityGames selftest source=%s]'):format(source)
    local failures=0
    local function check(name,ok)
        if not ok then failures=failures+1 end
        print(('%s %-38s %s'):format(prefix,name,ok and 'PASS' or 'FAIL'))
    end

    print(prefix..' begin')
    check('registry PLAY definitions',#FlecityGamesRegistry.List('play',false)==7)
    check('registry PARTY definitions',#FlecityGamesRegistry.List('party',false)==8)
    check('registry PLAY enabled',#FlecityGamesRegistry.List('play',true)==7)
    check('registry PARTY enabled',#FlecityGamesRegistry.List('party',true)==8)

    for _,tableName in ipairs(requiredTables) do
        local exists=tonumber(MySQL.scalar.await([[SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=?]],{tableName}) or 0)>0
        check(('table %s'):format(tableName),exists)
    end

    local uniqueSession=tonumber(MySQL.scalar.await([[SELECT COUNT(*) FROM information_schema.STATISTICS
        WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='flecity_game_scores'
        AND COLUMN_NAME='session_token' AND NON_UNIQUE=0]]) or 0)>0
    check('unique score session token index',uniqueSession)

    local play=FlecityGamesPlay.DebugSelftest()
    for name,ok in pairs(play) do check('PLAY '..name,ok==true) end

    local party=FlecityGamesParty.DebugSelftest()
    for name,ok in pairs(party) do check('PARTY '..name,ok==true) end

    local roomCount,memberTotal=FlecityGamesParty.DebugCounts()
    print(('%s rooms=%d members=%d'):format(prefix,roomCount,memberTotal))
    print(('%s end failures=%d'):format(prefix,failures))
end,false)

RegisterCommand('game_preflight',function(source)
    local prefix=source==0 and '[FlecityGames preflight]' or ('[FlecityGames preflight source=%s]'):format(source)
    local failures=0
    local function check(name,ok,detail)
        if not ok then failures=failures+1 end
        print(('%s %-42s %s%s'):format(prefix,name,ok and 'PASS' or 'FAIL',detail and (' · '..tostring(detail)) or ''))
    end

    print(prefix..' begin')
    check('lb-phone resource started',GetResourceState('lb-phone')=='started',GetResourceState('lb-phone'))
    check('oxmysql resource started',GetResourceState('oxmysql')=='started',GetResourceState('oxmysql'))
    check('framework bridge ready',FlecityGamesFramework.IsReady()==true,
        ('%s / %s'):format(FlecityGamesConfig.Framework,tostring(FlecityGamesFramework.GetVersion() or 'unknown')))
    check('LB Phone runtime detected',GetResourceState('lb-phone')=='started',
        tostring(GetResourceMetadata('lb-phone','version',0) or 'version metadata unavailable'))
    check('LB Phone callback API',registeredPhoneCallbacks==expectedPhoneCallbacks,
        ('%d/%d registered'):format(registeredPhoneCallbacks,expectedPhoneCallbacks))
    check('FiveM artifact runtime',true,tostring(GetConvar('version','unknown')))

    local dbOk,dbErr=FlecityGamesDatabase.Ensure()
    check('database bootstrap',dbOk,dbErr)
    if dbOk then
        check('database runtime version',true,tostring(MySQL.scalar.await('SELECT VERSION()') or 'unknown'))
        for _,tableName in ipairs(requiredTables) do
            local exists=tonumber(MySQL.scalar.await([[SELECT COUNT(*) FROM information_schema.TABLES
                WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=?]],{tableName}) or 0)>0
            check(('table %s'):format(tableName),exists)
        end
        local settingsColumn=tonumber(MySQL.scalar.await([[SELECT COUNT(*) FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='flecity_game_profiles' AND COLUMN_NAME='settings_json']]) or 0)>0
        check('profile settings column',settingsColumn)
        local uniqueSession=tonumber(MySQL.scalar.await([[SELECT COUNT(*) FROM information_schema.STATISTICS
            WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='flecity_game_scores'
            AND INDEX_NAME='uq_flecity_game_session_token' AND NON_UNIQUE=0]]) or 0)>0
        check('unique score session index',uniqueSession)
    end

    check('PLAY 7/7 enabled',#FlecityGamesRegistry.List('play',true)==7)
    check('PARTY 8/8 enabled',#FlecityGamesRegistry.List('party',true)==8)

    for name,ok in pairs(FlecityGamesPlay.DebugSelftest()) do check('PLAY '..name,ok==true) end
    for name,ok in pairs(FlecityGamesParty.DebugSelftest()) do check('PARTY '..name,ok==true) end

    if source~=0 then
        local id=FlecityGamesFramework.GetIdentifier(source)
        check('current character identifier',type(id)=='string' and id~='',id and 'resolved' or 'missing')
        local settings=FlecityGamesProfile.GetSettings(source)
        check('profile settings read',settings and settings.ok==true)
    else
        print(prefix..' player-specific identity/settings check SKIPPED from server console')
    end

    local roomCount,memberTotal=FlecityGamesParty.DebugCounts()
    print(('%s active_rooms=%d active_members=%d'):format(prefix,roomCount,memberTotal))
    print(('%s result=%s failures=%d'):format(prefix,failures==0 and 'READY_FOR_LIVE_TEST' or 'NOT_READY',failures))
end,false)

RegisterCommand('game_healthcheck',function(source)
    local prefix=source==0 and '[FlecityGames healthcheck]' or ('[FlecityGames healthcheck source=%s]'):format(source)
    local invalidScores,invalidSaves,invalidDaily,invalidAchievements=0,0,0,0

    local scoreRows=MySQL.query.await('SELECT game_id,COUNT(*) AS n FROM flecity_game_scores GROUP BY game_id') or {}
    for _,row in ipairs(scoreRows) do
        if not FlecityGamesRegistry.Get(row.game_id) then
            invalidScores=invalidScores+tonumber(row.n or 0)
            print(('%s invalid score game_id=%s count=%s'):format(prefix,tostring(row.game_id),tostring(row.n)))
        end
    end

    local saveRows=MySQL.query.await('SELECT game_id,COUNT(*) AS n FROM flecity_game_saves GROUP BY game_id') or {}
    for _,row in ipairs(saveRows) do
        local game=FlecityGamesRegistry.Get(row.game_id)
        if not game or game.supportsResume~=true then
            invalidSaves=invalidSaves+tonumber(row.n or 0)
            print(('%s invalid save game_id=%s count=%s'):format(prefix,tostring(row.game_id),tostring(row.n)))
        end
    end

    local dailyRows=MySQL.query.await('SELECT game_id,COUNT(*) AS n FROM flecity_game_daily GROUP BY game_id') or {}
    for _,row in ipairs(dailyRows) do
        local game=FlecityGamesRegistry.Get(row.game_id)
        if not game or game.supportsDaily~=true then
            invalidDaily=invalidDaily+tonumber(row.n or 0)
            print(('%s invalid daily game_id=%s count=%s'):format(prefix,tostring(row.game_id),tostring(row.n)))
        end
    end

    local achievementRows=MySQL.query.await([[SELECT game_id,COUNT(*) AS n FROM flecity_game_achievements
        WHERE game_id IS NOT NULL GROUP BY game_id]]) or {}
    for _,row in ipairs(achievementRows) do
        if not FlecityGamesRegistry.Get(row.game_id) then
            invalidAchievements=invalidAchievements+tonumber(row.n or 0)
            print(('%s invalid achievement game_id=%s count=%s'):format(prefix,tostring(row.game_id),tostring(row.n)))
        end
    end

    print(('%s invalid_score_rows=%d invalid_save_rows=%d invalid_daily_rows=%d invalid_achievement_rows=%d (diagnostic only; no data changed)')
        :format(prefix,invalidScores,invalidSaves,invalidDaily,invalidAchievements))
end,false)
