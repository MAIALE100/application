FlecityGamesPlay = FlecityGamesPlay or {}
local sessions={}

local function identifier(source) return FlecityGamesFramework.GetIdentifier(source) end
local function gameFor(id)
    local game=FlecityGamesRegistry.Get(id)
    if not game or game.app~='play' or game.enabled~=true then return nil end
    return game
end
local function newToken(_,gameId)
    return ('play:%s:%d:%06d:%06d'):format(
        tostring(gameId or 'game'),
        os.time(),
        GetGameTimer()%1000000,
        math.random(0,999999)
    )
end
local function touchProfile(source,playerIdentifier)
    local displayName=FlecityGamesFramework.GetCharacterName(source):sub(1,100)
    MySQL.query.await([[INSERT INTO flecity_game_profiles (player_identifier,display_name,last_seen_at)
        VALUES (?,?,CURRENT_TIMESTAMP)
        ON DUPLICATE KEY UPDATE display_name=VALUES(display_name),last_seen_at=CURRENT_TIMESTAMP]],{playerIdentifier,displayName})
end

local function seededNext(state)
    state=math.floor(tonumber(state) or 1)%2147483647
    if state<=0 then state=1 end
    state=(state*16807)%2147483647
    return state,(state-1)/2147483646
end
local function seededInt(state,minValue,maxValue)
    local nextState,value=seededNext(state)
    return nextState,minValue+math.floor(value*(maxValue-minValue+1))
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
    local mines={} local count=0
    while count<mineCount do
        state=(state*16807)%2147483647
        local index=(state-1)%total
        if not mines[index] then mines[index]=true count=count+1 end
    end
    return mines
end
local function generateNonogram(seed,size)
    local state=math.floor(tonumber(seed) or 1)%2147483647
    if state<=0 then state=1 end
    local filled={} local count=0
    for index=0,(size*size)-1 do
        state=(state*16807)%2147483647
        if ((state-1)%100)<45 then filled[index]=true count=count+1 end
    end
    if count==0 then filled[0]=true count=1 end
    return filled,count
end
local function normalizeIndexList(values,maxExclusive)
    if type(values)~='table' then return nil end
    local seen,out={},{}
    for _,value in ipairs(values) do
        local index=tonumber(value)
        if not index or index~=math.floor(index) or index<0 or index>=maxExclusive then return nil end
        if not seen[index] then
            seen[index]=true
            out[#out+1]=index
        end
    end
    table.sort(out)
    return out,seen
end
local BLOCK_SHAPES={
    {{0,0}},{{0,0},{1,0}},{{0,0},{1,0},{2,0}},{{0,0},{0,1}},{{0,0},{0,1},{0,2}},
    {{0,0},{1,0},{0,1},{1,1}},{{0,0},{0,1},{1,1}},{{1,0},{0,1},{1,1}},{{0,0},{1,0},{2,0},{1,1}}
}
local function emptyBlockBoard()
    local board={} for y=1,8 do board[y]={} for x=1,8 do board[y][x]=false end end
    return board
end
local function nextBlockPiece(state)
    local nextState,value=seededNext(state)
    return nextState,1+math.floor(value*#BLOCK_SHAPES)
end
local function refillBlockPieces(state)
    local pieces={}
    for i=1,3 do state,pieces[i]=nextBlockPiece(state) end
    return state,pieces
end
local function canPlaceBlock(board,shapeIndex,x,y)
    local shape=BLOCK_SHAPES[shapeIndex]
    if not shape then return false end
    for _,point in ipairs(shape) do
        local xx=x+point[1] local yy=y+point[2]
        if xx<0 or xx>=8 or yy<0 or yy>=8 or board[yy+1][xx+1] then return false end
    end
    return true
end
local function clearBlockLines(board)
    local rows,cols={},{}
    for y=1,8 do
        local full=true for x=1,8 do if not board[y][x] then full=false break end end
        if full then rows[#rows+1]=y end
    end
    for x=1,8 do
        local full=true for y=1,8 do if not board[y][x] then full=false break end end
        if full then cols[#cols+1]=x end
    end
    for _,y in ipairs(rows) do for x=1,8 do board[y][x]=false end end
    for _,x in ipairs(cols) do for y=1,8 do board[y][x]=false end end
    return #rows+#cols
end
local function replayBlockState(seed,history)
    if type(history)~='table' or #history>5000 then return nil end
    local board=emptyBlockBoard()
    local state=seed
    local pieces
    state,pieces=refillBlockPieces(state)
    local score,combo=0,0
    local normalizedHistory={}
    for _,move in ipairs(history) do
        if type(move)~='table' then return nil end
        local slot=tonumber(move[1]) local x=tonumber(move[2]) local y=tonumber(move[3])
        if not slot or not x or not y or slot~=math.floor(slot) or x~=math.floor(x) or y~=math.floor(y) then return nil end
        if slot<0 or slot>2 or x<0 or x>7 or y<0 or y>7 then return nil end
        local shapeIndex=pieces[slot+1]
        if not shapeIndex or not canPlaceBlock(board,shapeIndex,x,y) then return nil end
        normalizedHistory[#normalizedHistory+1]={slot,x,y}
        local shape=BLOCK_SHAPES[shapeIndex]
        for _,point in ipairs(shape) do board[y+point[2]+1][x+point[1]+1]=true end
        score=score+(#shape*10)
        pieces[slot+1]=false
        local lines=clearBlockLines(board)
        if lines>0 then
            combo=combo+1
            score=score+math.floor(lines*100*(1+math.min(combo,8)*0.2)+0.5)
        else combo=0 end
        if not pieces[1] and not pieces[2] and not pieces[3] then state,pieces=refillBlockPieces(state) end
    end
    local publicPieces={}
    for i=1,3 do publicPieces[i]=pieces[i] and {shape=pieces[i]-1} or false end
    local publicBoard={}
    for y=1,8 do
        publicBoard[y]={}
        for x=1,8 do publicBoard[y][x]=board[y][x] and 1 or 0 end
    end
    return {
        score=score,combo=combo,board=publicBoard,pieces=publicPieces,
        rngState=state,history=normalizedHistory
    }
end
local function replayBlock(seed,history)
    local state=replayBlockState(seed,history)
    return state and state.score or nil
end

local function emptyMergeBoard()
    local board={} for y=1,4 do board[y]={0,0,0,0} end
    return board
end
local function spawnMergeTile(board,state)
    local empty={}
    for y=1,4 do for x=1,4 do if board[y][x]==0 then empty[#empty+1]={x=x,y=y} end end end
    if #empty==0 then return state,false end
    local pick,value
    state,value=seededNext(state) pick=1+math.floor(value*#empty)
    local spot=empty[pick]
    state,value=seededNext(state)
    board[spot.y][spot.x]=value<0.9 and 2 or 4
    return state,true
end
local function compressMergeLine(line)
    local values={} for _,v in ipairs(line) do if v~=0 then values[#values+1]=v end end
    local out={} local gained=0 local i=1
    while i<=#values do
        if i<#values and values[i]==values[i+1] then
            local v=values[i]*2 out[#out+1]=v gained=gained+v i=i+2
        else out[#out+1]=values[i] i=i+1 end
    end
    while #out<4 do out[#out+1]=0 end
    return out,gained
end
local function boardsEqual(a,b)
    for y=1,4 do for x=1,4 do if a[y][x]~=b[y][x] then return false end end end
    return true
end
local function cloneMergeBoard(board)
    local out={} for y=1,4 do out[y]={board[y][1],board[y][2],board[y][3],board[y][4]} end
    return out
end
local function applyMergeMove(board,direction)
    local before=cloneMergeBoard(board) local gained=0
    if direction=='left' or direction=='right' then
        for y=1,4 do
            local line={board[y][1],board[y][2],board[y][3],board[y][4]}
            if direction=='right' then line={line[4],line[3],line[2],line[1]} end
            local out,add=compressMergeLine(line) gained=gained+add
            if direction=='right' then out={out[4],out[3],out[2],out[1]} end
            board[y]=out
        end
    elseif direction=='up' or direction=='down' then
        for x=1,4 do
            local line={board[1][x],board[2][x],board[3][x],board[4][x]}
            if direction=='down' then line={line[4],line[3],line[2],line[1]} end
            local out,add=compressMergeLine(line) gained=gained+add
            if direction=='down' then out={out[4],out[3],out[2],out[1]} end
            for y=1,4 do board[y][x]=out[y] end
        end
    else return false,0 end
    return not boardsEqual(before,board),gained
end
local function replayMergeState(seed,history)
    if type(history)~='table' or #history>10000 then return nil end
    local board=emptyMergeBoard() local state=seed local score=0
    local normalizedHistory={}
    state=select(1,spawnMergeTile(board,state))
    state=select(1,spawnMergeTile(board,state))
    for _,direction in ipairs(history) do
        direction=tostring(direction or '')
        local moved,gained=applyMergeMove(board,direction)
        if not moved then return nil end
        normalizedHistory[#normalizedHistory+1]=direction
        score=score+gained
        state=select(1,spawnMergeTile(board,state))
    end
    return {score=score,board=board,rngState=state,moves=#normalizedHistory,history=normalizedHistory}
end
local function replayMerge(seed,history)
    local state=replayMergeState(seed,history)
    return state and state.score or nil
end

local function challengeFor(game,seed)
    local challenge={} local state=seed
    if game.id=='quick_tap' then
        state,challenge.delayMs=seededInt(state,1200,3500)
    elseif game.id=='stop' then
        state,challenge.targetPct=seededInt(state,15,85)
        state,challenge.periodMs=seededInt(state,1500,2400)
        state,challenge.phaseMs=seededInt(state,0,challenge.periodMs-1)
    elseif game.id=='mines' then
        challenge.size=8 challenge.mines=10
    elseif game.id=='stack' then
        challenge.initialWidthPct=72 challenge.speedPctPerSec=65
    elseif game.id=='nonogram' then
        challenge.size=5
    end
    return challenge
end

local function currentDatabaseDate()
    local row=MySQL.single.await([[SELECT DATE_FORMAT(CURDATE(),'%Y-%m-%d') AS challenge_date]])
    return row and tostring(row.challenge_date or '') or os.date('%Y-%m-%d')
end
local function dailyCandidates()
    local out={}
    for _,gameId in ipairs(FlecityGamesConfig.Play.DailyCandidates or {}) do
        local game=gameFor(gameId)
        if game and game.supportsDaily==true then out[#out+1]=game end
    end
    return out
end
local function dailyChallenge()
    local date=currentDatabaseDate()
    local row=MySQL.single.await([[SELECT DATE_FORMAT(challenge_date,'%Y-%m-%d') AS challenge_date,game_id,seed,config_json
        FROM flecity_game_daily WHERE challenge_date=? LIMIT 1]],{date})
    if not row then
        local candidates=dailyCandidates()
        if #candidates==0 then return nil end
        local numeric=tonumber(date:gsub('%D','')) or 1
        local index=(numeric%#candidates)+1
        local seed=((numeric*48271)%2147483646)+1
        MySQL.query.await([[INSERT IGNORE INTO flecity_game_daily (challenge_date,game_id,seed,config_json)
            VALUES (?,?,?,?)]],{date,candidates[index].id,tostring(seed),json.encode({version=1})})
        row=MySQL.single.await([[SELECT DATE_FORMAT(challenge_date,'%Y-%m-%d') AS challenge_date,game_id,seed,config_json
            FROM flecity_game_daily WHERE challenge_date=? LIMIT 1]],{date})
    end
    if not row then return nil end
    local game=gameFor(row.game_id)
    if not game or game.supportsDaily~=true then return nil end
    return {
        date=tostring(row.challenge_date or date),
        gameId=game.id,
        game=game,
        seed=tonumber(row.seed) or 1,
        config=json.decode(row.config_json or '{}') or {}
    }
end

local function statisticsFor(playerIdentifier)
    local rows=MySQL.query.await([[SELECT game_id,COUNT(*) AS play_count,SUM(duration_ms) AS total_play_time_ms,
        MIN(score) AS min_score,MAX(score) AS max_score,MIN(duration_ms) AS best_time_ms
        FROM flecity_game_scores WHERE player_identifier=? GROUP BY game_id]],{playerIdentifier}) or {}
    local out={}
    local totalPlays,totalTime=0,0
    for _,row in ipairs(rows) do
        local game=gameFor(row.game_id)
        if game then
            local plays=tonumber(row.play_count or 0) or 0
            local total=tonumber(row.total_play_time_ms or 0) or 0
            totalPlays=totalPlays+plays totalTime=totalTime+total
            out[#out+1]={
                gameId=game.id,
                playCount=plays,
                totalPlayTimeMs=total,
                bestScore=tonumber(game.rankingOrder=='asc' and row.min_score or row.max_score),
                bestTimeMs=tonumber(row.best_time_ms),
                clearCount=(game.id=='mines' or game.id=='nonogram') and plays or nil
            }
        end
    end
    table.sort(out,function(a,b) return a.gameId<b.gameId end)
    return {totalPlayCount=totalPlays,totalPlayTimeMs=totalTime,games=out}
end
local function achievementsFor(playerIdentifier)
    return MySQL.query.await([[SELECT achievement_id,game_id,unlocked_at,metadata_json
        FROM flecity_game_achievements WHERE player_identifier=? ORDER BY unlocked_at ASC]],{playerIdentifier}) or {}
end
local function unlockAchievement(playerIdentifier,achievementId,gameId,metadata)
    local exists=MySQL.scalar.await([[SELECT 1 FROM flecity_game_achievements
        WHERE player_identifier=? AND achievement_id=? LIMIT 1]],{playerIdentifier,achievementId})
    if exists then return false end
    local ok=pcall(function()
        MySQL.query.await([[INSERT IGNORE INTO flecity_game_achievements
            (player_identifier,achievement_id,game_id,metadata_json) VALUES (?,?,?,?)]],
            {playerIdentifier,achievementId,gameId,json.encode(metadata or {})})
    end)
    return ok==true
end
local function evaluateAchievements(playerIdentifier,game,score)
    local unlocked={}
    local total=tonumber(MySQL.scalar.await('SELECT COUNT(*) FROM flecity_game_scores WHERE player_identifier=?',{playerIdentifier}) or 0)
    if unlockAchievement(playerIdentifier,'first_play',game.id,{total=total}) then unlocked[#unlocked+1]='first_play' end
    local cfg=FlecityGamesConfig.Play.Achievements or {}
    if total>=tonumber(cfg.GamesVeteranCount or 100) and unlockAchievement(playerIdentifier,'100_games',nil,{total=total}) then unlocked[#unlocked+1]='100_games' end
    if game.id=='quick_tap' and score<=tonumber(cfg.LightningReactionMs or 200) and unlockAchievement(playerIdentifier,'lightning',game.id,{score=score}) then unlocked[#unlocked+1]='lightning' end
    if game.id=='stack' and score>=tonumber(cfg.StackMasterLayers or 25) and unlockAchievement(playerIdentifier,'stack_master',game.id,{score=score}) then unlocked[#unlocked+1]='stack_master' end
    if game.id=='block' and score>=tonumber(cfg.BlockMasterScore or 5000) and unlockAchievement(playerIdentifier,'block_master',game.id,{score=score}) then unlocked[#unlocked+1]='block_master' end
    return unlocked
end

local function dailyRankingRows(challenge,limit)
    if not challenge then return {} end
    local game=gameFor(challenge.gameId)
    if not game then return {} end
    local order=game.rankingOrder=='asc' and 'ASC' or 'DESC'
    local fetchLimit=math.max(100,math.min(1000,(limit or 20)*20))
    local sql=([[SELECT s.player_identifier,COALESCE(p.display_name,'Player') AS display_name,s.score,s.metadata_json
        FROM flecity_game_scores s LEFT JOIN flecity_game_profiles p ON p.player_identifier=s.player_identifier
        WHERE s.game_id=? AND s.created_at>=? AND s.created_at<DATE_ADD(?,INTERVAL 1 DAY)
        AND s.metadata_json LIKE ?
        ORDER BY s.score %s,s.created_at ASC LIMIT %d]]):format(order,fetchLimit)
    local dailyPattern=('%%"dailyDate":"%s"%%'):format(challenge.date)
    local rows=MySQL.query.await(sql,{challenge.gameId,challenge.date,challenge.date,dailyPattern}) or {}
    local out={} local seen={}
    for _,row in ipairs(rows) do
        local metadata=json.decode(row.metadata_json or '{}') or {}
        if tostring(metadata.dailyDate or '')==challenge.date and not seen[row.player_identifier] then
            seen[row.player_identifier]=true
            out[#out+1]={display_name=row.display_name,score=row.score}
            if #out>=limit then break end
        end
    end
    return out
end
local function publicDaily(challenge)
    if not challenge then return nil end
    local rows=dailyRankingRows(challenge,FlecityGamesConfig.Play.RankingLimit or 20)
    return {
        date=challenge.date,gameId=challenge.gameId,game=challenge.game,seed=challenge.seed,
        best=rows[1],ranking=rows
    }
end

function FlecityGamesPlay.Bootstrap(source)
    local id=identifier(source)
    if not id then return {ok=false,error='PLAYER_NOT_READY'} end
    touchProfile(source,id)

    local saves=MySQL.query.await([[SELECT game_id,state_json,score,elapsed_ms,game_version,updated_at
        FROM flecity_game_saves WHERE player_identifier=? ORDER BY updated_at DESC]],{id}) or {}
    for _,save in ipairs(saves) do save.state=json.decode(save.state_json or '{}') or {} save.state_json=nil end

    local best={}
    for _,game in ipairs(FlecityGamesRegistry.List('play',true)) do
        if game.supportsRanking then
            local order=game.rankingOrder=='asc' and 'ASC' or 'DESC'
            local row=MySQL.single.await(([[SELECT score,duration_ms,created_at FROM flecity_game_scores
                WHERE player_identifier=? AND game_id=? ORDER BY score %s,created_at ASC LIMIT 1]]):format(order),{id,game.id})
            if row then best[game.id]=row end
        end
    end

    return {
        ok=true,
        version=GetResourceMetadata(GetCurrentResourceName(),'version',0) or 'unknown',
        games=FlecityGamesRegistry.List('play',false),saves=saves,best=best,
        daily=publicDaily(dailyChallenge()),statistics=statisticsFor(id),achievements=achievementsFor(id)
    }
end

local function clearPlayerGameSessions(playerIdentifier,gameId)
    for token,session in pairs(sessions) do
        if session.playerIdentifier==playerIdentifier and session.gameId==gameId then sessions[token]=nil end
    end
end

function FlecityGamesPlay.StartSession(source,data)
    if not FlecityGamesRateLimit.Allow(source,'play_start',FlecityGamesConfig.RateLimits.PlayStartMs) then return {ok=false,error='RATE_LIMIT'} end
    if type(data)~='table' then data={} end
    local id=identifier(source)
    if not id then return {ok=false,error='PLAYER_NOT_READY'} end

    local game=gameFor(data.gameId)
    local dailyDate=nil
    local seed=nil
    if data.daily==true then
        local daily=dailyChallenge()
        if not daily then return {ok=false,error='DAILY_UNAVAILABLE'} end
        if game and game.id~=daily.gameId then return {ok=false,error='DAILY_GAME_MISMATCH'} end
        game=gameFor(daily.gameId) seed=daily.seed dailyDate=daily.date
    end
    if not game then return {ok=false,error='GAME_UNAVAILABLE'} end

    local baseElapsedMs=0
    if not seed then
        if game.supportsResume==true and data.resume==true then
            local saved=MySQL.single.await([[SELECT seed,elapsed_ms FROM flecity_game_saves
                WHERE player_identifier=? AND game_id=? LIMIT 1]],{id,game.id})
            local resumeSeed=saved and tonumber(saved.seed) or nil
            if not resumeSeed or resumeSeed<1 or resumeSeed>2147483646 then
                return {ok=false,error='SAVE_NOT_FOUND'}
            end
            seed=math.floor(resumeSeed)
            baseElapsedMs=math.max(0,math.min(28800000,math.floor(tonumber(saved.elapsed_ms) or 0)))
        else
            seed=math.random(1,2147483646)
        end
    end
    clearPlayerGameSessions(id,game.id)
    local challenge=challengeFor(game,seed)
    local token=newToken(id,game.id)
    local startedTick=GetGameTimer()
    sessions[token]={
        playerIdentifier=id,source=tonumber(source),gameId=game.id,seed=seed,startedAt=os.time(),
        startedTick=startedTick,baseElapsedMs=baseElapsedMs,challenge=challenge,dailyDate=dailyDate
    }
    return {
        ok=true,game=game,sessionToken=token,seed=seed,challenge=challenge,
        baseElapsedMs=baseElapsedMs,serverTick=GetGameTimer(),startedTick=startedTick,
        daily=dailyDate~=nil,dailyDate=dailyDate
    }
end

function FlecityGamesPlay.CancelSession(source,data)
    if type(data)~='table' then return {ok=false,error='INVALID_REQUEST'} end
    local id=identifier(source) local token=tostring(data.sessionToken or '') local session=sessions[token]
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

    local token=tostring(data.sessionToken or '')
    local session=sessions[token]
    if not session or session.playerIdentifier~=id or session.gameId~=game.id then return {ok=false,error='INVALID_SESSION'} end
    if session.dailyDate then return {ok=false,error='DAILY_SAVE_DISABLED'} end
    local seedNumber=math.floor(tonumber(session.seed) or 0)
    if seedNumber<1 or seedNumber>2147483646 then return {ok=false,error='INVALID_SESSION_SEED'} end

    local serverElapsed=math.max(0,GetGameTimer()-(tonumber(session.startedTick) or GetGameTimer()))
    local elapsed=math.max(0,math.min(28800000,
        math.floor((tonumber(session.baseElapsedMs) or 0)+serverElapsed)))
    local saveState=data.state
    local score=tonumber(data.score) or 0

    if game.id=='block' then
        local canonical=replayBlockState(session.seed,data.state.history)
        if not canonical or canonical.score~=math.floor(score) then return {ok=false,error='INVALID_BLOCK_SAVE'} end
        saveState=canonical
        score=canonical.score
    elseif game.id=='merge' then
        local canonical=replayMergeState(session.seed,data.state.history)
        if not canonical or canonical.score~=math.floor(score) then return {ok=false,error='INVALID_MERGE_SAVE'} end
        saveState=canonical
        score=canonical.score
    elseif game.id=='mines' then
        local size=tonumber(session.challenge.size) or 8
        local mineCount=tonumber(session.challenge.mines) or 10
        local revealed,revealedSet=normalizeIndexList(data.state.revealed,size*size)
        local flags,flagSet=normalizeIndexList(data.state.flags,size*size)
        if not revealed or not flags then return {ok=false,error='INVALID_MINES_SAVE'} end
        local mines=generateMines(session.seed,size,mineCount)
        for _,index in ipairs(revealed) do
            if mines[index] or flagSet[index] then return {ok=false,error='INVALID_MINES_SAVE'} end
        end
        saveState={revealed=revealed,flags=flags,mode=data.state.mode=='flag' and 'flag' or 'reveal'}
        score=elapsed
    elseif game.id=='nonogram' then
        local size=tonumber(session.challenge.size) or 5
        local filled,filledSet=normalizeIndexList(data.state.filled,size*size)
        local crossed,crossedSet=normalizeIndexList(data.state.crossed,size*size)
        if not filled or not crossed then return {ok=false,error='INVALID_NONOGRAM_SAVE'} end
        for _,index in ipairs(filled) do
            if crossedSet[index] then return {ok=false,error='INVALID_NONOGRAM_SAVE'} end
        end
        saveState={filled=filled,crossed=crossed}
        score=elapsed
    end

    local encoded=json.encode(saveState)
    if not encoded or #encoded>FlecityGamesConfig.Play.SaveStateMaxBytes then return {ok=false,error='STATE_TOO_LARGE'} end
    local seed=tostring(seedNumber):sub(1,64)
    MySQL.query.await([[INSERT INTO flecity_game_saves
        (player_identifier,game_id,state_json,score,elapsed_ms,seed,game_version)
        VALUES (?,?,?,?,?,?,?)
        ON DUPLICATE KEY UPDATE state_json=VALUES(state_json),score=VALUES(score),elapsed_ms=VALUES(elapsed_ms),
        seed=VALUES(seed),game_version=VALUES(game_version),updated_at=CURRENT_TIMESTAMP]],
        {id,game.id,encoded,score,elapsed,seed,game.version or 1})
    return {ok=true,updatedAt=os.time(),elapsedMs=elapsed,score=score,state=saveState}
end

local function validateScore(game,score)
    if not score or score~=score or score==math.huge or score==-math.huge then return nil end
    if game.id=='quick_tap' then
        if score<70 or score>3000 then return nil end
        return math.floor(score*1000+0.5)/1000
    elseif game.id=='stop' then
        if score<0 or score>1000 then return nil end
        return math.floor(score+0.5)
    elseif game.id=='block' or game.id=='merge' then
        if score<0 or score>50000000 then return nil end
        return math.floor(score)
    elseif game.id=='mines' or game.id=='nonogram' then
        if score<1000 or score>28800000 then return nil end
        return math.floor(score)
    elseif game.id=='stack' then
        if score<0 or score>500 then return nil end
        return math.floor(score)
    end
    if score<-100000000 or score>100000000 then return nil end
    return score
end

function FlecityGamesPlay.SubmitScore(source,data)
    if not FlecityGamesRateLimit.Allow(source,'score_submit',FlecityGamesConfig.RateLimits.ScoreSubmitMs) then return {ok=false,error='RATE_LIMIT'} end
    if type(data)~='table' then return {ok=false,error='INVALID_REQUEST'} end
    local id=identifier(source) local token=tostring(data.sessionToken or '') local session=sessions[token]
    if not id then return {ok=false,error='PLAYER_NOT_READY'} end
    if not session or session.playerIdentifier~=id then return {ok=false,error='INVALID_SESSION'} end
    local game=gameFor(session.gameId)
    if not game then sessions[token]=nil return {ok=false,error='GAME_UNAVAILABLE'} end
    if os.time()-session.startedAt>FlecityGamesConfig.Play.SessionMaxAgeSeconds then sessions[token]=nil return {ok=false,error='EXPIRED_SESSION'} end

    local clientDurationMs=math.max(0,math.min(28800000,math.floor(tonumber(data.durationMs) or 0)))
    local serverElapsed=math.max(0,GetGameTimer()-(tonumber(session.startedTick) or GetGameTimer()))
    local totalServerElapsed=math.max(0,math.min(28800000,
        math.floor((tonumber(session.baseElapsedMs) or 0)+serverElapsed)))
    local durationMs=clientDurationMs
    if game.supportsResume==true or game.id=='stack' then durationMs=totalServerElapsed end
    local rawScore=tonumber(data.score)
    local metadata={serverElapsedMs=serverElapsed}
    if session.dailyDate then metadata.dailyDate=session.dailyDate end

    if game.id=='quick_tap' then
        local quickScore=tonumber(data.score)
        if not quickScore then return {ok=false,error='INVALID_SCORE'} end
        local delayMs=tonumber(session.challenge.delayMs) or 0
        local serverSinceReveal=serverElapsed-delayMs
        if clientDurationMs<quickScore or serverSinceReveal<0 then return {ok=false,error='IMPOSSIBLE_TIMING'} end
        if quickScore>serverSinceReveal+350 or serverSinceReveal-quickScore>1200 then
            return {ok=false,error='IMPOSSIBLE_TIMING'}
        end
        durationMs=math.min(serverElapsed,28800000)
        metadata.serverSinceRevealMs=serverSinceReveal
    elseif game.id=='stop' then
        local actionMs=math.floor(tonumber(data.actionMs) or -1)
        if actionMs<100 or actionMs>60000 then return {ok=false,error='INVALID_TIMING'} end
        if actionMs>serverElapsed+250 or serverElapsed-actionMs>2500 then return {ok=false,error='IMPOSSIBLE_TIMING'} end
        local marker=trianglePosition(actionMs,session.challenge.periodMs,session.challenge.phaseMs)
        local target=tonumber(session.challenge.targetPct) or 50
        local distance=math.abs(marker-target)
        rawScore=math.max(0,1000-(distance*10)) durationMs=math.min(serverElapsed,28800000)
        metadata.markerPct=math.floor(marker*100+0.5)/100
        metadata.targetPct=target metadata.distancePct=math.floor(distance*100+0.5)/100 metadata.actionMs=actionMs
    elseif game.id=='block' then
        if type(data.history)~='table' then return {ok=false,error='INVALID_BLOCK_REPLAY'} end
        local replayed=replayBlock(session.seed,data.history)
        if replayed==nil or replayed~=math.floor(tonumber(data.score) or -1) then return {ok=false,error='INVALID_BLOCK_REPLAY'} end
        rawScore=replayed metadata.moves=#data.history metadata.replayValidated=true
    elseif game.id=='merge' then
        if type(data.history)~='table' then return {ok=false,error='INVALID_MERGE_REPLAY'} end
        local replayed=replayMerge(session.seed,data.history)
        if replayed==nil or replayed~=math.floor(tonumber(data.score) or -1) then return {ok=false,error='INVALID_MERGE_REPLAY'} end
        rawScore=replayed metadata.moves=#data.history metadata.replayValidated=true
    elseif game.id=='stack' then
        local layers=math.floor(tonumber(data.score) or -1)
        if layers<0 or layers>500 then return {ok=false,error='INVALID_SCORE'} end
        if serverElapsed+300<layers*120 then return {ok=false,error='IMPOSSIBLE_TIMING'} end
        rawScore=layers metadata.layers=layers
    elseif game.id=='mines' then
        if type(data.revealed)~='table' then return {ok=false,error='INVALID_CLEAR_STATE'} end
        local size=tonumber(session.challenge.size) or 8 local mineCount=tonumber(session.challenge.mines) or 10
        local mines=generateMines(session.seed,size,mineCount)
        local seen={} local revealedCount=0
        for _,value in ipairs(data.revealed) do
            local index=tonumber(value)
            if not index or index~=math.floor(index) or index<0 or index>=size*size then return {ok=false,error='INVALID_CLEAR_STATE'} end
            if mines[index] then return {ok=false,error='MINE_REVEALED'} end
            if not seen[index] then seen[index]=true revealedCount=revealedCount+1 end
        end
        if revealedCount~=(size*size-mineCount) then return {ok=false,error='INCOMPLETE_CLEAR'} end
        rawScore=durationMs metadata.revealedCount=revealedCount metadata.boardSize=size metadata.mineCount=mineCount
    elseif game.id=='nonogram' then
        if type(data.filled)~='table' then return {ok=false,error='INVALID_CLEAR_STATE'} end
        local size=tonumber(session.challenge.size) or 5
        local solution,solutionCount=generateNonogram(session.seed,size)
        local submitted={} local count=0
        for _,value in ipairs(data.filled) do
            local index=tonumber(value)
            if not index or index~=math.floor(index) or index<0 or index>=size*size then return {ok=false,error='INVALID_CLEAR_STATE'} end
            if not submitted[index] then submitted[index]=true count=count+1 end
        end
        if count~=solutionCount then return {ok=false,error='INCORRECT_SOLUTION'} end
        for index in pairs(solution) do if not submitted[index] then return {ok=false,error='INCORRECT_SOLUTION'} end end
        for index in pairs(submitted) do if not solution[index] then return {ok=false,error='INCORRECT_SOLUTION'} end end
        rawScore=durationMs metadata.boardSize=size metadata.filledCount=count
    end

    local score=validateScore(game,rawScore)
    if score==nil then return {ok=false,error='INVALID_SCORE'} end
    if MySQL.scalar.await('SELECT 1 FROM flecity_game_scores WHERE session_token=? LIMIT 1',{token}) then
        sessions[token]=nil return {ok=false,error='DUPLICATE_SUBMIT'}
    end

    local ok,insertId=pcall(function()
        return MySQL.insert.await([[INSERT INTO flecity_game_scores
            (player_identifier,game_id,score,duration_ms,session_token,metadata_json)
            VALUES (?,?,?,?,?,?)]],{id,game.id,score,durationMs,token,json.encode(metadata)})
    end)
    if not ok or not insertId then return {ok=false,error='SCORE_SAVE_FAILED'} end

    sessions[token]=nil
    if game.supportsResume and not session.dailyDate then MySQL.query.await('DELETE FROM flecity_game_saves WHERE player_identifier=? AND game_id=?',{id,game.id}) end
    local unlocked=evaluateAchievements(id,game,score)
    return {ok=true,score=score,details=metadata,unlocked=unlocked,daily=session.dailyDate~=nil}
end

function FlecityGamesPlay.Ranking(source,data)
    if not FlecityGamesRateLimit.Allow(source,'ranking',FlecityGamesConfig.RateLimits.RankingMs) then return {ok=false,error='RATE_LIMIT'} end
    local id=identifier(source)
    if not id then return {ok=false,error='PLAYER_NOT_READY'} end
    if type(data)~='table' then return {ok=false,error='INVALID_REQUEST'} end
    local game=gameFor(data.gameId)
    if not game or game.supportsRanking~=true then return {ok=false,error='RANKING_UNAVAILABLE'} end
    local period=tostring(data.period or 'today')
    local limit=math.max(1,math.min(50,FlecityGamesConfig.Play.RankingLimit or 20))

    if period=='daily' then
        local daily=dailyChallenge()
        if not daily or daily.gameId~=game.id then return {ok=false,error='DAILY_GAME_MISMATCH'} end
        return {ok=true,gameId=game.id,period=period,rows=dailyRankingRows(daily,limit),date=daily.date}
    end

    local wherePeriod=''
    if period=='today' then wherePeriod=' AND s.created_at >= CURDATE()'
    elseif period=='week' then wherePeriod=' AND s.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)'
    elseif period~='all' then return {ok=false,error='INVALID_PERIOD'} end
    local order=game.rankingOrder=='asc' and 'ASC' or 'DESC'
    local aggregate=game.rankingOrder=='asc' and 'MIN' or 'MAX'
    local sql=([[SELECT COALESCE(p.display_name,'Player') AS display_name,%s(s.score) AS score
        FROM flecity_game_scores s LEFT JOIN flecity_game_profiles p ON p.player_identifier=s.player_identifier
        WHERE s.game_id=? %s
        GROUP BY s.player_identifier,p.display_name
        ORDER BY score %s,display_name ASC LIMIT %d]]):format(aggregate,wherePeriod,order,limit)
    return {ok=true,gameId=game.id,period=period,rows=MySQL.query.await(sql,{game.id}) or {}}
end

function FlecityGamesPlay.Statistics(source)
    local id=identifier(source)
    if not id then return {ok=false,error='PLAYER_NOT_READY'} end
    return {ok=true,statistics=statisticsFor(id),achievements=achievementsFor(id),daily=publicDaily(dailyChallenge())}
end

function FlecityGamesPlay.DebugSelftest()
    local quick=gameFor('quick_tap') local stop=gameFor('stop') local block=gameFor('block')
    local merge=gameFor('merge') local minesGame=gameFor('mines') local stack=gameFor('stack') local nonogram=gameFor('nonogram')
    local testMines=generateMines(12345,8,10) local testMineCount=0 for _ in pairs(testMines) do testMineCount=testMineCount+1 end
    local testNonogram,testNonogramCount=generateNonogram(12345,5)
    local testNonogramActual=0 for _ in pairs(testNonogram) do testNonogramActual=testNonogramActual+1 end
    local quickChallenge=challengeFor(quick,12345) local quickChallenge2=challengeFor(quick,12345)
    local blockChallenge=challengeFor(block,12345) local mergeChallenge=challengeFor(merge,12345)
    local opaqueToken=newToken('SECRET_CITIZEN_ID','quick_tap')

    local _,initialBlockPieces=refillBlockPieces(12345)
    local firstBlockShape=initialBlockPieces[1]
    local blockSingle=replayBlockState(12345,{{0,0,0}})
    local blockSingleExpected=firstBlockShape and (#BLOCK_SHAPES[firstBlockShape]*10) or -1

    local mergeBoard=emptyMergeBoard()
    local mergeState=12345
    mergeState=select(1,spawnMergeTile(mergeBoard,mergeState))
    mergeState=select(1,spawnMergeTile(mergeBoard,mergeState))
    local mergeDirection,mergeExpectedGain=nil,nil
    for _,direction in ipairs({'left','right','up','down'}) do
        local candidate=cloneMergeBoard(mergeBoard)
        local moved,gained=applyMergeMove(candidate,direction)
        if moved then mergeDirection=direction mergeExpectedGain=gained break end
    end
    local mergeSingle=mergeDirection and replayMergeState(12345,{mergeDirection}) or nil
    local normalizedIndexes=normalizeIndexList({2,1,2},5)

    local sample={board={{0,1},{1,0}},pieces={{shape=1}},score=120,combo=2}
    local encoded=json.encode(sample) local decoded=encoded and json.decode(encoded) or nil
    return {
        quickRejectLow=quick and validateScore(quick,69)==nil or false,
        quickAcceptNormal=quick and validateScore(quick,180)~=nil or false,
        deterministicChallenge=quickChallenge.delayMs==quickChallenge2.delayMs,
        opaqueSessionToken=not string.find(opaqueToken,'SECRET_CITIZEN_ID',1,true),
        stopRejectHigh=stop and validateScore(stop,1001)==nil or false,
        stopMidpoint=math.abs(trianglePosition(450,1800,0)-50)<0.001,
        blockRejectNegative=block and validateScore(block,-1)==nil or false,
        blockAcceptInteger=block and validateScore(block,120)==120 or false,
        mergeAcceptInteger=merge and validateScore(merge,2048)==2048 or false,
        blockChallengeClean=type(blockChallenge)=='table' and next(blockChallenge)==nil,
        mergeChallengeClean=type(mergeChallenge)=='table' and next(mergeChallenge)==nil,
        blockReplayEmpty=replayBlock(12345,{})==0,
        blockReplayMove=blockSingle and blockSingle.score==blockSingleExpected and #blockSingle.history==1 or false,
        mergeReplayEmpty=replayMerge(12345,{})==0,
        mergeReplayMove=mergeSingle and mergeSingle.score==mergeExpectedGain and #mergeSingle.history==1 or false,
        normalizedIndexes=normalizedIndexes and #normalizedIndexes==2 and normalizedIndexes[1]==1 and normalizedIndexes[2]==2 or false,
        minesValidateTime=minesGame and validateScore(minesGame,60000)==60000 or false,
        minesSeedCount=testMineCount==10,
        stackValidateLayers=stack and validateScore(stack,25)==25 or false,
        nonogramSeedCount=testNonogramCount==testNonogramActual and testNonogramCount>0,
        nonogramValidateTime=nonogram and validateScore(nonogram,45000)==45000 or false,
        dailyCandidates=#dailyCandidates()>=3,
        saveRoundTrip=decoded and decoded.score==120 and decoded.combo==2 or false,
        saveWithinLimit=encoded and #encoded<=FlecityGamesConfig.Play.SaveStateMaxBytes or false
    }
end

function FlecityGamesPlay.DropSource(source)
    local src=tonumber(source)
    for token,session in pairs(sessions) do
        if session.source==src then sessions[token]=nil end
    end
end

function FlecityGamesPlay.Cleanup()
    local now=os.time()
    for token,session in pairs(sessions) do
        if now-session.startedAt>FlecityGamesConfig.Play.SessionMaxAgeSeconds then sessions[token]=nil end
    end
end
