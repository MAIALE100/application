math.randomseed(os.time()+GetGameTimer())

local callbacks={
    ['flecity_games:play:bootstrap']=function(source) return FlecityGamesPlay.Bootstrap(source) end,
    ['flecity_games:play:startSession']=function(source,data) return FlecityGamesPlay.StartSession(source,data) end,
    ['flecity_games:play:cancelSession']=function(source,data) return FlecityGamesPlay.CancelSession(source,data) end,
    ['flecity_games:play:resetSave']=function(source,data) return FlecityGamesPlay.ResetSave(source,data) end,
    ['flecity_games:play:save']=function(source,data) return FlecityGamesPlay.Save(source,data) end,
    ['flecity_games:play:submitScore']=function(source,data) return FlecityGamesPlay.SubmitScore(source,data) end,
    ['flecity_games:play:ranking']=function(source,data) return FlecityGamesPlay.Ranking(source,data) end,
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
    ['flecity_games:party:returnLobby']=function(source) return FlecityGamesParty.ReturnLobby(source) end,
    ['flecity_games:party:leaveRoom']=function(source) return FlecityGamesParty.LeaveRoom(source) end
}

local function safeCall(name,fn,source,data)
    local ok,result=pcall(fn,source,data)
    if ok then return result or {ok=false,error='EMPTY_RESPONSE'} end
    print(('[FlecityGames] callback %s failed for source=%s: %s'):format(name,tostring(source),tostring(result)))
    return {ok=false,error='SERVER_ERROR'}
end

CreateThread(function()
    while GetResourceState('lb-phone')~='started' or GetResourceState('oxmysql')~='started' do Wait(500) end
    MySQL.ready(function()
        for name,fn in pairs(callbacks) do
            exports['lb-phone']:RegisterCallback(name,function(source,data) return safeCall(name,fn,source,data) end,{
                preventSpam=true,rateLimit=30,defaultReturn={ok=false,error='CALLBACK_FAILED'}
            })
        end
        print('[FlecityGames] LB Phone callbacks registered')
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

local requiredTables={'flecity_game_profiles','flecity_game_scores','flecity_game_saves','flecity_game_achievements','flecity_game_daily'}

RegisterCommand('game_selftest',function(source)
    local prefix=source==0 and '[FlecityGames selftest]' or ('[FlecityGames selftest source=%s]'):format(source)
    local failures=0
    local function check(name,ok)
        if not ok then failures=failures+1 end
        print(('%s %-38s %s'):format(prefix,name,ok and 'PASS' or 'FAIL'))
    end

    print(prefix..' begin')
    check('registry PLAY populated',#FlecityGamesRegistry.List('play',false)>0)
    check('registry PARTY populated',#FlecityGamesRegistry.List('party',false)>0)

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

RegisterCommand('game_healthcheck',function(source)
    local prefix=source==0 and '[FlecityGames healthcheck]' or ('[FlecityGames healthcheck source=%s]'):format(source)
    local invalidScores,invalidSaves,invalidDaily=0,0,0

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

    print(('%s invalid_score_rows=%d invalid_save_rows=%d invalid_daily_rows=%d (diagnostic only; no data changed)')
        :format(prefix,invalidScores,invalidSaves,invalidDaily))
end,false)
