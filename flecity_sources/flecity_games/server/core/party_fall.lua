FlecityGamesPartyFall = FlecityGamesPartyFall or {}

local SHAPES={
    {{0,0},{1,0},{2,0},{3,0}},
    {{0,0},{1,0},{0,1},{1,1}},
    {{1,0},{0,1},{1,1},{2,1}},
    {{1,0},{2,0},{0,1},{1,1}},
    {{0,0},{1,0},{1,1},{2,1}},
    {{0,0},{0,1},{1,1},{2,1}},
    {{2,0},{0,1},{1,1},{2,1}}
}
local LINE_POINTS={[0]=0,[1]=100,[2]=300,[3]=500,[4]=800}

local function seededNext(state)
    local x=math.floor(tonumber(state) or 1)%2147483647
    if x<=0 then x=1 end
    x=(x*16807)%2147483647
    return x,(x-1)/2147483646
end

local function nextPiece(state)
    local value
    state,value=seededNext(state)
    return state,1+math.floor(value*#SHAPES)
end

local function shapeFor(pieceType,rotation)
    local base=SHAPES[math.floor(tonumber(pieceType) or 0)]
    if not base then return nil end
    local shape={}
    for i,cell in ipairs(base) do shape[i]={cell[1],cell[2]} end
    local turns=((math.floor(tonumber(rotation) or 0)%4)+4)%4
    for _=1,turns do
        for _,cell in ipairs(shape) do
            local x,y=cell[1],cell[2]
            cell[1],cell[2]=-y,x
        end
    end
    local minX,minY=math.huge,math.huge
    for _,cell in ipairs(shape) do minX=math.min(minX,cell[1]) minY=math.min(minY,cell[2]) end
    for _,cell in ipairs(shape) do cell[1]=cell[1]-minX cell[2]=cell[2]-minY end
    return shape
end

local function emptyBoard(width,height)
    local board={}
    for y=1,height do
        board[y]={}
        for x=1,width do board[y][x]=0 end
    end
    return board
end

local function canPlace(board,width,height,shape,x,y)
    for _,cell in ipairs(shape or {}) do
        local gx=x+cell[1]
        local gy=y+cell[2]
        if gx<0 or gx>=width or gy<0 or gy>=height then return false end
        if tonumber(board[gy+1] and board[gy+1][gx+1])~=0 then return false end
    end
    return true
end

local function dropY(board,width,height,shape,x)
    if not canPlace(board,width,height,shape,x,0) then return nil end
    local y=0
    while canPlace(board,width,height,shape,x,y+1) do y=y+1 end
    return y
end

local function clearLines(board,width,height)
    local cleared=0
    local y=height
    while y>=1 do
        local full=true
        for x=1,width do if tonumber(board[y][x])==0 then full=false break end end
        if full then
            table.remove(board,y)
            local row={} for x=1,width do row[x]=0 end
            table.insert(board,1,row)
            cleared=cleared+1
        else
            y=y-1
        end
    end
    return cleared
end

local function findAnyPlacement(board,width,height,pieceType)
    for rotation=0,3 do
        local shape=shapeFor(pieceType,rotation)
        for x=0,width-1 do
            if dropY(board,width,height,shape,x)~=nil then return true end
        end
    end
    return false
end

local function applyPlacement(board,width,height,pieceType,x,rotation,combo,lines)
    x=tonumber(x) rotation=tonumber(rotation)
    if not x or not rotation or x~=math.floor(x) or rotation~=math.floor(rotation) then return nil end
    rotation=((rotation%4)+4)%4
    local shape=shapeFor(pieceType,rotation)
    if not shape then return nil end
    local landing=dropY(board,width,height,shape,x)
    if landing==nil then return nil end
    for _,cell in ipairs(shape) do board[landing+cell[2]+1][x+cell[1]+1]=pieceType end
    local cleared=clearLines(board,width,height)
    combo=cleared>0 and (math.max(0,tonumber(combo) or 0)+1) or 0
    local level=math.min(8,1+math.floor(math.max(0,tonumber(lines) or 0)/5))
    local gained=10+(landing*2)+((LINE_POINTS[cleared] or (cleared*250))*(cleared>0 and math.max(1,combo) or 1)*level)
    return {x=x,rotation=rotation,cleared=cleared,combo=combo,gained=gained}
end

function FlecityGamesPartyFall.Validate(seed,history,width,height,maxElapsedMs)
    width=math.max(6,math.min(14,math.floor(tonumber(width) or 10)))
    height=math.max(12,math.min(24,math.floor(tonumber(height) or 18)))
    if type(history)~='table' or #history<1 or #history>1200 then return nil,'INVALID_FALL_BATTLE_REPLAY' end

    local board=emptyBoard(width,height)
    local state=math.floor(tonumber(seed) or 1)
    local score,lines,combo,pieces=0,0,0,0
    local heldPiece=nil
    local previousActionMs=-1
    local allowedElapsed=math.max(0,math.floor(tonumber(maxElapsedMs) or 0))
    local normalized={}

    for _,entry in ipairs(history) do
        if type(entry)~='table' then return nil,'INVALID_FALL_BATTLE_REPLAY' end
        local x=tonumber(entry.x~=nil and entry.x or entry[1])
        local rotation=tonumber(entry.rotation~=nil and entry.rotation or entry[2])
        local holdValue=entry.hold
        if holdValue==nil then holdValue=entry[3] end
        local actionMs=tonumber(entry.t~=nil and entry.t or entry[4])
        if not x or not rotation or not actionMs or actionMs~=actionMs then return nil,'INVALID_FALL_BATTLE_REPLAY' end
        actionMs=math.floor(actionMs)
        if actionMs<0 or actionMs>allowedElapsed+500 then return nil,'IMPOSSIBLE_TIMING' end
        if previousActionMs>=0 and actionMs-previousActionMs<60 then return nil,'IMPOSSIBLE_TIMING' end
        previousActionMs=actionMs

        if holdValue~=nil and type(holdValue)~='boolean' and tonumber(holdValue)~=0 and tonumber(holdValue)~=1 then
            return nil,'INVALID_FALL_BATTLE_REPLAY'
        end
        local useHold=holdValue==true or tonumber(holdValue)==1
        local pieceType
        state,pieceType=nextPiece(state)
        if useHold then
            if heldPiece then
                pieceType,heldPiece=heldPiece,pieceType
            else
                heldPiece=pieceType
                state,pieceType=nextPiece(state)
            end
        end

        if not findAnyPlacement(board,width,height,pieceType) then return nil,'INVALID_FALL_BATTLE_REPLAY' end
        local applied=applyPlacement(board,width,height,pieceType,x,rotation,combo,lines)
        if not applied then return nil,'INVALID_FALL_BATTLE_REPLAY' end
        combo=applied.combo
        score=score+applied.gained
        lines=lines+applied.cleared
        pieces=pieces+1
        normalized[#normalized+1]={x=applied.x,rotation=applied.rotation,hold=useHold,t=actionMs}
    end

    local _,upcoming=nextPiece(state)
    return {
        score=score,
        lines=lines,
        pieces=pieces,
        combo=combo,
        ended=not findAnyPlacement(board,width,height,upcoming),
        history=normalized
    },nil
end

-- Incremental, server-owned opponent. It only locks pieces whose scheduled
-- action time has actually passed. The bot and humans use the identical seed,
-- shape transformations, line clearing and authoritative replay validator.
local PRACTICE_PACE={easy=1900,normal=1200,hard=800}

function FlecityGamesPartyFall.NewPractice(seed,difficulty,width,height)
    local level=tostring(difficulty or 'normal')
    if not PRACTICE_PACE[level] then level='normal' end
    width=math.max(6,math.min(14,math.floor(tonumber(width) or 10)))
    height=math.max(12,math.min(24,math.floor(tonumber(height) or 18)))
    return {
        seed=seed,width=width,height=height,level=level,
        pace=PRACTICE_PACE[level],nextActionMs=PRACTICE_PACE[level],
        board=emptyBoard(width,height),rng=math.floor(tonumber(seed) or 1),
        history={},ended=false,elapsedMs=0
    }
end

local function practiceChoice(bot,pieceType)
    local choices={}
    for rotation=0,3 do
        local shape=shapeFor(pieceType,rotation)
        for x=0,bot.width-1 do
            local landing=dropY(bot.board,bot.width,bot.height,shape,x)
            if landing~=nil then
                local candidate={}
                for y,row in ipairs(bot.board) do
                    candidate[y]={}
                    for col,value in ipairs(row) do candidate[y][col]=value end
                end
                local applied=applyPlacement(candidate,bot.width,bot.height,pieceType,x,rotation,0,0)
                if applied then
                    local holes,stack=0,0
                    for col=1,bot.width do
                        local occupied=false
                        for y=1,bot.height do
                            if candidate[y][col]~=0 then
                                if not occupied then stack=stack+(bot.height-y+1) occupied=true end
                            elseif occupied then holes=holes+1 end
                        end
                    end
                    choices[#choices+1]={
                        x=x,rotation=rotation,board=candidate,
                        value=applied.cleared*1000-holes*38-stack*3+landing
                    }
                end
            end
        end
    end
    table.sort(choices,function(a,b)
        if a.value~=b.value then return a.value>b.value end
        if a.rotation~=b.rotation then return a.rotation<b.rotation end
        return a.x<b.x
    end)
    if #choices==0 then return nil end
    local index=1
    if bot.level=='normal' then index=math.min(#choices,math.max(1,math.floor(#choices/12))) end
    if bot.level=='easy' then index=math.min(#choices,math.max(1,math.floor(#choices*3/5))) end
    return choices[index]
end

-- Reconciliation is called periodically by the existing room cleanup timer.
-- Per-tick work is bounded; at settlement, finish all moves already due.
-- elapsedMs is server-authoritative and capped to the existing 90-second round.
function FlecityGamesPartyFall.AdvancePractice(bot,elapsedMs,finalize)
    if type(bot)~='table' then return nil end
    local elapsed=math.max(0,math.min(90000,math.floor(tonumber(elapsedMs) or 0)))
    bot.elapsedMs=math.max(bot.elapsedMs or 0,elapsed)
    local limit=finalize and 120 or 3
    local moves=0
    while not bot.ended and bot.nextActionMs<=bot.elapsedMs and moves<limit do
        local pieceType
        bot.rng,pieceType=nextPiece(bot.rng)
        local picked=practiceChoice(bot,pieceType)
        if not picked then bot.ended=true break end
        bot.board=picked.board
        bot.history[#bot.history+1]={x=picked.x,rotation=picked.rotation,hold=false,t=bot.nextActionMs}
        bot.nextActionMs=bot.nextActionMs+bot.pace
        moves=moves+1
        -- Next seeded piece must fit in at least one orientation, as on client.
        local _,upcoming=nextPiece(bot.rng)
        if not findAnyPlacement(bot.board,bot.width,bot.height,upcoming) then bot.ended=true end
    end
    return moves
end

function FlecityGamesPartyFall.PracticeResult(bot)
    if not bot or #bot.history==0 then return {score=0,lines=0,pieces=0,ended=bot and bot.ended or false,history={}} end
    return FlecityGamesPartyFall.Validate(bot.seed,bot.history,bot.width,bot.height,bot.elapsedMs)
end

-- Public compatibility for existing local checks: no future moves and no
-- fabricated score. Pass elapsedMs explicitly; default is zero, not 90s.
function FlecityGamesPartyFall.Practice(seed,difficulty,width,height,elapsedMs)
    local bot=FlecityGamesPartyFall.NewPractice(seed,difficulty,width,height)
    FlecityGamesPartyFall.AdvancePractice(bot,elapsedMs or 0,true)
    return FlecityGamesPartyFall.PracticeResult(bot)
end

function FlecityGamesPartyFall.DebugSelftest()
    local valid=FlecityGamesPartyFall.Validate(12345,{{x=3,rotation=0,hold=false,t=100}},10,18,1000)
    local tooFast=FlecityGamesPartyFall.Validate(12345,{{x=3,rotation=0,hold=false,t=100},{x=3,rotation=0,hold=false,t=120}},10,18,1000)
    return {
        basic_valid=valid~=nil,
        timing_guard=tooFast==nil,
        ai_no_future_moves=(FlecityGamesPartyFall.Practice(12345,'hard',10,18,1000).pieces==1),
        ai_no_early_moves=(FlecityGamesPartyFall.Practice(12345,'hard',10,18,500).pieces==0)
    }
end
