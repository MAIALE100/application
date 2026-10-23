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
    if type(history)~='table' or #history<1 or #history>1200 then return nil,'INVALID_HISTORY' end

    local board=emptyBoard(width,height)
    local state=math.floor(tonumber(seed) or 1)
    local score,lines,combo,pieces=0,0,0,0
    local heldPiece=nil
    local previousActionMs=-1
    local allowedElapsed=math.max(0,math.floor(tonumber(maxElapsedMs) or 0))
    local normalized={}

    for _,entry in ipairs(history) do
        if type(entry)~='table' then return nil,'INVALID_HISTORY' end
        local x=tonumber(entry.x~=nil and entry.x or entry[1])
        local rotation=tonumber(entry.rotation~=nil and entry.rotation or entry[2])
        local holdValue=entry.hold
        if holdValue==nil then holdValue=entry[3] end
        local actionMs=tonumber(entry.t~=nil and entry.t or entry[4])
        if not x or not rotation or not actionMs or actionMs~=actionMs then return nil,'INVALID_HISTORY' end
        actionMs=math.floor(actionMs)
        if actionMs<0 or actionMs>allowedElapsed+500 then return nil,'IMPOSSIBLE_TIMING' end
        if previousActionMs>=0 and actionMs-previousActionMs<60 then return nil,'IMPOSSIBLE_TIMING' end
        previousActionMs=actionMs

        if holdValue~=nil and type(holdValue)~='boolean' and tonumber(holdValue)~=0 and tonumber(holdValue)~=1 then
            return nil,'INVALID_HISTORY'
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

        if not findAnyPlacement(board,width,height,pieceType) then return nil,'INVALID_HISTORY' end
        local applied=applyPlacement(board,width,height,pieceType,x,rotation,combo,lines)
        if not applied then return nil,'INVALID_HISTORY' end
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

function FlecityGamesPartyFall.DebugSelftest()
    local valid=FlecityGamesPartyFall.Validate(12345,{{x=3,rotation=0,hold=false,t=100}},10,18,1000)
    local tooFast=FlecityGamesPartyFall.Validate(12345,{{x=3,rotation=0,hold=false,t=100},{x=3,rotation=0,hold=false,t=120}},10,18,1000)
    return {
        basic_valid=valid~=nil,
        timing_guard=tooFast==nil
    }
end
