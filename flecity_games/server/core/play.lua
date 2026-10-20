FlecityGamesPlay = FlecityGamesPlay or {}
local sessions={}

local function identifier(source) return FlecityGamesFramework.GetIdentifier(source) end
local function gameFor(id)
    local game=FlecityGamesRegistry.Get(id)
    if not game or game.app~='play' or game.enabled~=true then return nil end
    return game
end
local function newToken(playerIdentifier,gameId)
    return ('%s:%s:%d:%06d'):format(playerIdentifier,gameId,os.time(),math.random(0,999999))
end
local function touchProfile(source,playerIdentifier)
    local displayName=FlecityGamesFramework.GetCharacterName(source):sub(1,100)
    MySQL.query.await([[INSERT INTO flecity_game_profiles (player_identifier,display_name,last_seen_at)
        VALUES (?,?,CURRENT_TIMESTAMP)
        ON DUPLICATE KEY UPDATE display_name=VALUES(display_name),last_seen_at=CURRENT_TIMESTAMP]],{playerIdentifier,displayName})
end

local function trianglePosition(elapsedMs,periodMs,phaseMs)
    local period=math.max(400,tonumber(periodMs) or 1800)
    local phase=tonumber(phaseMs) or 0
    local cycle=(math.max(0,tonumber(elapsedMs) or 0)+phase)%period
    local half=period/2
    if cycle<=half then return (cycle/half)*100 end
    return ((period-cycle)/half)*100
end

local function generateMines(seed,size,mineCount)
    local total=size*size
    local state=math.floor(tonumber(seed) or 1)%2147483647
    if state<=0 then state=1 end
    local mines={}
    local count=0
    while count<mineCount do
        state=(state*16807)%2147483647
        local index=(state-1)%total
        if not mines[index] then mines[index]=true count=count+1 end
    end
    return mines
end

function FlecityGamesPlay.Bootstrap(source)
    local id=identifier(source)
    if not id then return {ok=false,error='PLAYER_NOT_READY'} end
    touchProfile(source,id)

    local saves=MySQL.query.await([[SELECT game_id,state_json,score,elapsed_ms,seed,game_version,updated_at
        FROM flecity_game_saves WHERE player_identifier=? ORDER BY updated_at DESC]],{id}) or {}
    for _,save in ipairs(saves) do
        save.state=json.decode(save.state_json or '{}') or {}
        save.state_json=nil
    end

    local best={}
    for _,game in ipairs(FlecityGamesRegistry.List('play',true)) do
        if game.supportsRanking then
            local order=game.rankingOrder=='asc' and 'ASC' or 'DESC'
            local row=MySQL.single.await(([[SELECT score,duration_ms,created_at FROM flecity_game_scores
                WHERE player_identifier=? AND game_id=? ORDER BY score %s,created_at ASC LIMIT 1]]):format(order),{id,game.id})
            if row then best[game.id]=row end
        end
    end
    return {ok=true,games=FlecityGamesRegistry.List('play',false),saves=saves,best=best}
end

function FlecityGamesPlay.StartSession(source,data)
    if not FlecityGamesRateLimit.Allow(source,'play_start',FlecityGamesConfig.RateLimits.PlayStartMs) then return {ok=false,error='RATE_LIMIT'} end
    local id=identifier(source)
    local game=gameFor(type(data)=='table' and data.gameId or nil)
    if not id then return {ok=false,error='PLAYER_NOT_READY'} end
    if not game then return {ok=false,error='GAME_UNAVAILABLE'} end

    local token=newToken(id,game.id)
    local resumeSeed=type(data)=='table' and tonumber(data.resumeSeed) or nil
    local seed=math.random(1,2147483646)
    if game.supportsResume==true and resumeSeed and resumeSeed>=1 and resumeSeed<=2147483646 then seed=math.floor(resumeSeed) end
    local challenge={}
    if game.id=='quick_tap' then challenge.delayMs=math.random(1200,3500) end
    if game.id=='stop' then
        challenge.targetPct=math.random(15,85)
        challenge.periodMs=math.random(1500,2400)
        challenge.phaseMs=math.random(0,challenge.periodMs-1)
    end
    if game.id=='mines' then
        challenge.size=8
        challenge.mines=10
    end

    local startedTick=GetGameTimer()
    sessions[token]={playerIdentifier=id,source=tonumber(source),gameId=game.id,seed=seed,startedAt=os.time(),startedTick=startedTick,challenge=challenge}
    return {ok=true,game=game,sessionToken=token,seed=seed,challenge=challenge,serverTick=GetGameTimer(),startedTick=startedTick}
end

function FlecityGamesPlay.CancelSession(source,data)
    if type(data)~='table' then return {ok=false,error='INVALID_REQUEST'} end
    local id=identifier(source)
    local token=tostring(data.sessionToken or '')
    local session=sessions[token]
    if not id then return {ok=false,error='PLAYER_NOT_READY'} end
    if session and session.playerIdentifier==id then sessions[token]=nil end
    return {ok=true}
end

function FlecityGamesPlay.ResetSave(source,data)
    local id=identifier(source)
    if not id or type(data)~='table' then return {ok=false,error='INVALID_REQUEST'} end
    local game=gameFor(data.gameId)
    if not game then return {ok=false,error='GAME_UNAVAILABLE'} end
    if game.supportsResume~=true then return {ok=false,error='RESUME_NOT_SUPPORTED'} end
    MySQL.query.await('DELETE FROM flecity_game_saves WHERE player_identifier=? AND game_id=?',{id,game.id})
    return {ok=true}
end

function FlecityGamesPlay.Save(source,data)
    if not FlecityGamesRateLimit.Allow(source,'play_save',FlecityGamesConfig.RateLimits.PlaySaveMs) then return {ok=false,error='RATE_LIMIT'} end
    local id=identifier(source)
    if not id or type(data)~='table' then return {ok=false,error='INVALID_REQUEST'} end
    local game=gameFor(data.gameId)
    if not game then return {ok=false,error='GAME_UNAVAILABLE'} end
    if game.supportsResume~=true then return {ok=false,error='RESUME_NOT_SUPPORTED'} end
    if type(data.state)~='table' then return {ok=false,error='INVALID_STATE'} end

    local encoded=json.encode(data.state)
    if not encoded or #encoded>FlecityGamesConfig.Play.SaveStateMaxBytes then return {ok=false,error='STATE_TOO_LARGE'} end
    local score=tonumber(data.score) or 0
    local elapsed=math.max(0,math.min(28800000,math.floor(tonumber(data.elapsedMs) or 0)))
    local seed=tostring(data.seed or ''):sub(1,64)

    MySQL.query.await([[INSERT INTO flecity_game_saves
        (player_identifier,game_id,state_json,score,elapsed_ms,seed,game_version)
        VALUES (?,?,?,?,?,?,?)
        ON DUPLICATE KEY UPDATE state_json=VALUES(state_json),score=VALUES(score),elapsed_ms=VALUES(elapsed_ms),
        seed=VALUES(seed),game_version=VALUES(game_version),updated_at=CURRENT_TIMESTAMP]],
        {id,game.id,encoded,score,elapsed,seed,game.version or 1})
    return {ok=true,updatedAt=os.time()}
end

local function validateScore(game,score)
    if not score or score~=score or score==math.huge or score==-math.huge then return nil end
    if game.id=='quick_tap' then
        if score<70 or score>3000 then return nil end
        return math.floor(score*1000+0.5)/1000
    end
    if game.id=='stop' then
        if score<0 or score>1000 then return nil end
        return math.floor(score+0.5)
    end
    if game.id=='block' or game.id=='merge' then
        if score<0 or score>50000000 then return nil end
        return math.floor(score)
    end
    if game.id=='mines' then
        if score<1000 or score>28800000 then return nil end
        return math.floor(score)
    end
    if score<-100000000 or score>100000000 then return nil end
    return score
end

function FlecityGamesPlay.SubmitScore(source,data)
    if not FlecityGamesRateLimit.Allow(source,'score_submit',FlecityGamesConfig.RateLimits.ScoreSubmitMs) then return {ok=false,error='RATE_LIMIT'} end
    if type(data)~='table' then return {ok=false,error='INVALID_REQUEST'} end
    local id=identifier(source)
    local token=tostring(data.sessionToken or '')
    local session=sessions[token]
    if not id then return {ok=false,error='PLAYER_NOT_READY'} end
    if not session or session.playerIdentifier~=id then return {ok=false,error='INVALID_SESSION'} end

    local game=gameFor(session.gameId)
    if not game then sessions[token]=nil return {ok=false,error='GAME_UNAVAILABLE'} end
    if os.time()-session.startedAt>FlecityGamesConfig.Play.SessionMaxAgeSeconds then sessions[token]=nil return {ok=false,error='EXPIRED_SESSION'} end

    local durationMs=math.max(0,math.min(28800000,math.floor(tonumber(data.durationMs) or 0)))
    local serverElapsed=math.max(0,GetGameTimer()-session.startedTick)
    local rawScore=tonumber(data.score)
    local metadata={serverElapsedMs=serverElapsed}

    if game.id=='quick_tap' then
        local quickScore=tonumber(data.score)
        if not quickScore then return {ok=false,error='INVALID_SCORE'} end
        local delayMs=tonumber(session.challenge.delayMs) or 0
        if durationMs<quickScore or serverElapsed<math.max(0,delayMs+quickScore-350) then return {ok=false,error='IMPOSSIBLE_TIMING'} end
    elseif game.id=='stop' then
        local actionMs=math.floor(tonumber(data.actionMs) or -1)
        if actionMs<100 or actionMs>60000 then return {ok=false,error='INVALID_TIMING'} end
        if actionMs>serverElapsed+250 or serverElapsed-actionMs>2500 then return {ok=false,error='IMPOSSIBLE_TIMING'} end
        local marker=trianglePosition(actionMs,session.challenge.periodMs,session.challenge.phaseMs)
        local target=tonumber(session.challenge.targetPct) or 50
        local distance=math.abs(marker-target)
        rawScore=math.max(0,1000-(distance*10))
        durationMs=actionMs
        metadata.markerPct=math.floor(marker*100+0.5)/100
        metadata.targetPct=target
        metadata.distancePct=math.floor(distance*100+0.5)/100
        metadata.actionMs=actionMs
    elseif game.id=='mines' then
        if type(data.revealed)~='table' then return {ok=false,error='INVALID_CLEAR_STATE'} end
        local size=tonumber(session.challenge.size) or 8
        local mineCount=tonumber(session.challenge.mines) or 10
        local mines=generateMines(session.seed,size,mineCount)
        local seen={}
        local revealedCount=0
        for _,value in ipairs(data.revealed) do
            local index=tonumber(value)
            if not index or index~=math.floor(index) or index<0 or index>=size*size then return {ok=false,error='INVALID_CLEAR_STATE'} end
            if mines[index] then return {ok=false,error='MINE_REVEALED'} end
            if not seen[index] then seen[index]=true revealedCount=revealedCount+1 end
        end
        if revealedCount~=(size*size-mineCount) then return {ok=false,error='INCOMPLETE_CLEAR'} end
        rawScore=durationMs
        metadata.revealedCount=revealedCount
        metadata.boardSize=size
        metadata.mineCount=mineCount
    end

    local score=validateScore(game,rawScore)
    if score==nil then return {ok=false,error='INVALID_SCORE'} end

    if MySQL.scalar.await('SELECT 1 FROM flecity_game_scores WHERE session_token=? LIMIT 1',{token}) then
        sessions[token]=nil
        return {ok=false,error='DUPLICATE_SUBMIT'}
    end

    local ok,insertId=pcall(function()
        return MySQL.insert.await([[INSERT INTO flecity_game_scores
            (player_identifier,game_id,score,duration_ms,session_token,metadata_json)
            VALUES (?,?,?,?,?,?)]],{id,game.id,score,durationMs,token,json.encode(metadata)})
    end)
    if not ok or not insertId then return {ok=false,error='SCORE_SAVE_FAILED'} end

    sessions[token]=nil
    if game.supportsResume then MySQL.query.await('DELETE FROM flecity_game_saves WHERE player_identifier=? AND game_id=?',{id,game.id}) end
    return {ok=true,score=score,details=metadata}
end

function FlecityGamesPlay.Ranking(source,data)
    if not FlecityGamesRateLimit.Allow(source,'ranking',FlecityGamesConfig.RateLimits.RankingMs) then return {ok=false,error='RATE_LIMIT'} end
    local id=identifier(source)
    if not id then return {ok=false,error='PLAYER_NOT_READY'} end
    if type(data)~='table' then return {ok=false,error='INVALID_REQUEST'} end

    local game=gameFor(data.gameId)
    if not game or game.supportsRanking~=true then return {ok=false,error='RANKING_UNAVAILABLE'} end
    local period=tostring(data.period or 'today')
    local wherePeriod=''
    if period=='today' then wherePeriod=' AND s.created_at >= CURDATE()'
    elseif period=='week' then wherePeriod=' AND s.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)'
    elseif period~='all' then return {ok=false,error='INVALID_PERIOD'} end

    local order=game.rankingOrder=='asc' and 'ASC' or 'DESC'
    local aggregate=game.rankingOrder=='asc' and 'MIN' or 'MAX'
    local limit=math.max(1,math.min(50,FlecityGamesConfig.Play.RankingLimit or 20))
    local sql=([[SELECT COALESCE(p.display_name,'Player') AS display_name,%s(s.score) AS score
        FROM flecity_game_scores s LEFT JOIN flecity_game_profiles p ON p.player_identifier=s.player_identifier
        WHERE s.game_id=? %s
        GROUP BY s.player_identifier,p.display_name
        ORDER BY score %s,display_name ASC LIMIT %d]]):format(aggregate,wherePeriod,order,limit)
    return {ok=true,gameId=game.id,period=period,rows=MySQL.query.await(sql,{game.id}) or {}}
end

function FlecityGamesPlay.DebugSelftest()
    local quick=gameFor('quick_tap')
    local stop=gameFor('stop')
    local block=gameFor('block')
    local merge=gameFor('merge')
    local minesGame=gameFor('mines')
    local testMines=generateMines(12345,8,10)
    local testMineCount=0 for _ in pairs(testMines) do testMineCount=testMineCount+1 end
    local sample={board={{0,1},{1,0}},pieces={{shape=1}},score=120,combo=2}
    local encoded=json.encode(sample)
    local decoded=encoded and json.decode(encoded) or nil
    return {
        quickRejectLow=quick and validateScore(quick,69)==nil or false,
        quickAcceptNormal=quick and validateScore(quick,180)~=nil or false,
        stopRejectHigh=stop and validateScore(stop,1001)==nil or false,
        stopMidpoint=math.abs(trianglePosition(450,1800,0)-50)<0.001,
        blockRejectNegative=block and validateScore(block,-1)==nil or false,
        blockAcceptInteger=block and validateScore(block,120)==120 or false,
        mergeAcceptInteger=merge and validateScore(merge,2048)==2048 or false,
        minesValidateTime=minesGame and validateScore(minesGame,60000)==60000 or false,
        minesSeedCount=testMineCount==10,
        saveRoundTrip=decoded and decoded.score==120 and decoded.combo==2 or false,
        saveWithinLimit=encoded and #encoded<=FlecityGamesConfig.Play.SaveStateMaxBytes or false
    }
end

function FlecityGamesPlay.DropSource(source)
    local src=tonumber(source)
    for _,session in pairs(sessions) do if session.source==src then session.source=nil end end
end

function FlecityGamesPlay.Cleanup()
    local now=os.time()
    for token,session in pairs(sessions) do
        if now-session.startedAt>FlecityGamesConfig.Play.SessionMaxAgeSeconds then sessions[token]=nil end
    end
end
