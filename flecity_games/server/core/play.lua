FlecityGamesPlay = FlecityGamesPlay or {}
local sessions = {}

local function identifier(source) return FlecityGamesFramework.GetIdentifier(source) end
local function gameFor(id)
    local game = FlecityGamesRegistry.Get(id)
    if not game or game.app ~= 'play' or game.enabled ~= true then return nil end
    return game
end

local function newToken(playerIdentifier, gameId)
    return ('%s:%s:%d:%06d'):format(playerIdentifier, gameId, os.time(), math.random(0, 999999))
end

local function touchProfile(playerIdentifier)
    MySQL.query.await([[INSERT INTO flecity_game_profiles (player_identifier,last_seen_at)
        VALUES (?,CURRENT_TIMESTAMP)
        ON DUPLICATE KEY UPDATE last_seen_at=CURRENT_TIMESTAMP]], {playerIdentifier})
end

function FlecityGamesPlay.Bootstrap(source)
    local id = identifier(source)
    if not id then return {ok=false,error='PLAYER_NOT_READY'} end
    touchProfile(id)

    local saves = MySQL.query.await([[SELECT game_id,score,elapsed_ms,seed,game_version,updated_at
        FROM flecity_game_saves WHERE player_identifier=? ORDER BY updated_at DESC]], {id}) or {}

    local best = {}
    for _, game in ipairs(FlecityGamesRegistry.List('play', true)) do
        if game.supportsRanking then
            local order = game.rankingOrder == 'asc' and 'ASC' or 'DESC'
            local row = MySQL.single.await(([[SELECT score,duration_ms,created_at FROM flecity_game_scores
                WHERE player_identifier=? AND game_id=? ORDER BY score %s,created_at ASC LIMIT 1]]):format(order), {id,game.id})
            if row then best[game.id] = row end
        end
    end

    return {ok=true,games=FlecityGamesRegistry.List('play',false),saves=saves,best=best}
end

function FlecityGamesPlay.StartSession(source, data)
    if not FlecityGamesRateLimit.Allow(source,'play_start',FlecityGamesConfig.RateLimits.PlayStartMs) then return {ok=false,error='RATE_LIMIT'} end
    local id = identifier(source)
    local game = gameFor(type(data)=='table' and data.gameId or nil)
    if not id then return {ok=false,error='PLAYER_NOT_READY'} end
    if not game then return {ok=false,error='GAME_UNAVAILABLE'} end

    local token = newToken(id,game.id)
    local seed = math.random(1,2147483646)
    local challenge = {}
    if game.id == 'quick_tap' then challenge.delayMs = math.random(1200,3500) end

    sessions[token] = {playerIdentifier=id,source=tonumber(source),gameId=game.id,seed=seed,startedAt=os.time(),startedTick=GetGameTimer(),challenge=challenge}
    return {ok=true,game=game,sessionToken=token,seed=seed,challenge=challenge}
end

function FlecityGamesPlay.Save(source, data)
    if not FlecityGamesRateLimit.Allow(source,'play_save',FlecityGamesConfig.RateLimits.PlaySaveMs) then return {ok=false,error='RATE_LIMIT'} end
    local id = identifier(source)
    if not id or type(data)~='table' then return {ok=false,error='INVALID_REQUEST'} end

    local game = gameFor(data.gameId)
    if not game then return {ok=false,error='GAME_UNAVAILABLE'} end
    if game.supportsResume ~= true then return {ok=false,error='RESUME_NOT_SUPPORTED'} end
    if type(data.state) ~= 'table' then return {ok=false,error='INVALID_STATE'} end

    local encoded = json.encode(data.state)
    if not encoded or #encoded > FlecityGamesConfig.Play.SaveStateMaxBytes then return {ok=false,error='STATE_TOO_LARGE'} end

    local score = tonumber(data.score) or 0
    local elapsed = math.max(0,math.min(28800000,math.floor(tonumber(data.elapsedMs) or 0)))
    local seed = tostring(data.seed or ''):sub(1,64)

    MySQL.query.await([[INSERT INTO flecity_game_saves
        (player_identifier,game_id,state_json,score,elapsed_ms,seed,game_version)
        VALUES (?,?,?,?,?,?,?)
        ON DUPLICATE KEY UPDATE state_json=VALUES(state_json),score=VALUES(score),elapsed_ms=VALUES(elapsed_ms),
        seed=VALUES(seed),game_version=VALUES(game_version),updated_at=CURRENT_TIMESTAMP]],
        {id,game.id,encoded,score,elapsed,seed,game.version or 1})

    return {ok=true,updatedAt=os.time()}
end

local function validateScore(game, score)
    if not score or score~=score or score==math.huge or score==-math.huge then return nil end
    if game.id == 'quick_tap' then
        if score < 70 or score > 3000 then return nil end
        return math.floor(score*1000+0.5)/1000
    end
    if game.id == 'block' then
        if score < 0 or score > 50000000 then return nil end
        return math.floor(score)
    end
    if score < -100000000 or score > 100000000 then return nil end
    return score
end

function FlecityGamesPlay.SubmitScore(source, data)
    if not FlecityGamesRateLimit.Allow(source,'score_submit',FlecityGamesConfig.RateLimits.ScoreSubmitMs) then return {ok=false,error='RATE_LIMIT'} end
    if type(data)~='table' then return {ok=false,error='INVALID_REQUEST'} end

    local id = identifier(source)
    local token = tostring(data.sessionToken or '')
    local session = sessions[token]
    if not id then return {ok=false,error='PLAYER_NOT_READY'} end
    if not session or session.playerIdentifier~=id then return {ok=false,error='INVALID_SESSION'} end

    local game = gameFor(session.gameId)
    if not game then sessions[token]=nil return {ok=false,error='GAME_UNAVAILABLE'} end
    if os.time()-session.startedAt > FlecityGamesConfig.Play.SessionMaxAgeSeconds then sessions[token]=nil return {ok=false,error='EXPIRED_SESSION'} end

    local score = validateScore(game,tonumber(data.score))
    if score==nil then return {ok=false,error='INVALID_SCORE'} end
    local durationMs = math.max(0,math.min(28800000,math.floor(tonumber(data.durationMs) or 0)))
    local serverElapsed = math.max(0,GetGameTimer()-session.startedTick)

    if game.id == 'quick_tap' then
        local delayMs = tonumber(session.challenge.delayMs) or 0
        if durationMs < score or serverElapsed < math.max(0,delayMs+score-350) then return {ok=false,error='IMPOSSIBLE_TIMING'} end
    end

    if MySQL.scalar.await('SELECT 1 FROM flecity_game_scores WHERE session_token=? LIMIT 1',{token}) then
        sessions[token]=nil
        return {ok=false,error='DUPLICATE_SUBMIT'}
    end

    local ok, insertId = pcall(function()
        return MySQL.insert.await([[INSERT INTO flecity_game_scores
            (player_identifier,game_id,score,duration_ms,session_token,metadata_json)
            VALUES (?,?,?,?,?,?)]], {id,game.id,score,durationMs,token,json.encode({serverElapsedMs=serverElapsed})})
    end)
    if not ok or not insertId then return {ok=false,error='SCORE_SAVE_FAILED'} end

    sessions[token]=nil
    if game.supportsResume then MySQL.query.await('DELETE FROM flecity_game_saves WHERE player_identifier=? AND game_id=?',{id,game.id}) end
    return {ok=true,score=score}
end

function FlecityGamesPlay.Ranking(source, data)
    if not FlecityGamesRateLimit.Allow(source,'ranking',FlecityGamesConfig.RateLimits.RankingMs) then return {ok=false,error='RATE_LIMIT'} end
    local id = identifier(source)
    if not id then return {ok=false,error='PLAYER_NOT_READY'} end
    if type(data)~='table' then return {ok=false,error='INVALID_REQUEST'} end

    local game = gameFor(data.gameId)
    if not game or game.supportsRanking~=true then return {ok=false,error='RANKING_UNAVAILABLE'} end

    local period = tostring(data.period or 'today')
    local wherePeriod = ''
    if period=='today' then wherePeriod=' AND s.created_at >= CURDATE()'
    elseif period=='week' then wherePeriod=' AND s.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)'
    elseif period~='all' then return {ok=false,error='INVALID_PERIOD'} end

    local order = game.rankingOrder=='asc' and 'ASC' or 'DESC'
    local limit = math.max(1,math.min(50,FlecityGamesConfig.Play.RankingLimit or 20))
    local sql = ([[SELECT s.player_identifier,s.score,s.duration_ms,s.created_at
        FROM flecity_game_scores s WHERE s.game_id=? %s
        ORDER BY s.score %s,s.created_at ASC LIMIT %d]]):format(wherePeriod,order,limit)

    return {ok=true,gameId=game.id,period=period,rows=MySQL.query.await(sql,{game.id}) or {}}
end

function FlecityGamesPlay.DropSource(source)
    local src = tonumber(source)
    for _, session in pairs(sessions) do if session.source==src then session.source=nil end end
end

function FlecityGamesPlay.Cleanup()
    local now = os.time()
    for token, session in pairs(sessions) do
        if now-session.startedAt > FlecityGamesConfig.Play.SessionMaxAgeSeconds then sessions[token]=nil end
    end
end
