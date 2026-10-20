FlecityGamesPlay = FlecityGamesPlay or {}
local sessions={}
local sessionCounter=0
local saveEpochs={}

local function identifier(source) return FlecityGamesFramework.GetIdentifier(source) end
local function gameFor(id)
    local game=FlecityGamesRegistry.Get(id)
    if not game or game.app~='play' or game.enabled~=true then return nil end
    return game
end
local function elapsedForSession(session)
    local nowTick=GetGameTimer()
    local activeElapsed=0
    if session and session.timingDeferred==true then
        if session.timingActivated==true then
            activeElapsed=math.max(0,nowTick-(tonumber(session.activeStartedTick) or nowTick))
        end
    else
        activeElapsed=math.max(0,nowTick-(tonumber(session and session.startedTick) or nowTick))
    end
    local total=math.max(0,math.min(28800000,
        math.floor((tonumber(session and session.baseElapsedMs) or 0)+activeElapsed)))
    return activeElapsed,total
end

local function newToken(_,gameId)
    sessionCounter=(sessionCounter+1)%1000000000
    return ('play:%s:%d:%09d:%06d:%06d'):format(
        tostring(gameId or 'game'),
        os.time(),
        sessionCounter,
        math.random(0,999999),
        math.random(0,999999)
    )
end
local function touchProfile(source,playerIdentifier)
    local displayName=FlecityGamesText.Normalize(FlecityGamesFramework.GetCharacterName(source))
    if displayName=='' then displayName=('Player %s'):format(tostring(source)) end
    displayName=FlecityGamesText.Truncate(displayName,100)
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

local function generateMemoryDeck(seed)
    local deck={}
    for value=1,8 do
        deck[#deck+1]=value
        deck[#deck+1]=value
    end
    local state=math.floor(tonumber(seed) or 1)%2147483647
    if state<=0 then state=1 end
    for i=#deck,2,-1 do
        local j
        state,j=seededInt(state,1,i)
        deck[i],deck[j]=deck[j],deck[i]
    end
    return deck,state
end

local function replayMemory(seed,history)
    if type(history)~='table' or #history<8 or #history>128 then return nil end
    local deck=generateMemoryDeck(seed)
    local matched={} local pairs=0 local moves=0
    for _,entry in ipairs(history) do
        if type(entry)~='table' then return nil end
        local a=tonumber(entry[1]) local b=tonumber(entry[2])
        if not a or not b or a~=math.floor(a) or b~=math.floor(b) then return nil end
        if a<0 or a>=16 or b<0 or b>=16 or a==b or matched[a] or matched[b] then return nil end
        moves=moves+1
        if deck[a+1]==deck[b+1] then
            matched[a]=true matched[b]=true pairs=pairs+1
        end
    end
    return {complete=pairs==8,pairs=pairs,moves=moves,deck=deck}
end

local function generateColorMatch(seed,roundCount)
    local state=math.floor(tonumber(seed) or 1)%2147483647
    if state<=0 then state=1 end
    local rounds={}
    for i=1,(tonumber(roundCount) or 10) do
        local value
        state,value=seededNext(state)
        local word=math.floor(value*4)
        state,value=seededNext(state)
        local ink=math.floor(value*3)
        if ink>=word then ink=ink+1 end
        rounds[#rounds+1]={word=word,ink=ink}
    end
    return rounds,state
end

local function replayColorMatch(seed,history,roundCount)
    local count=tonumber(roundCount) or 10
    if type(history)~='table' or #history~=count then return nil end
    local rounds=generateColorMatch(seed,count)
    for i,round in ipairs(rounds) do
        local choice=tonumber(history[i])
        if not choice or choice~=math.floor(choice) or choice<0 or choice>3 or choice~=round.ink then return nil end
    end
    return {complete=true,rounds=count}
end
local function generateNumberRush(seed,count)
    local total=math.max(2,math.min(64,math.floor(tonumber(count) or 25)))
    local state=math.floor(tonumber(seed) or 1)%2147483647
    if state<=0 then state=1 end
    local board={}
    for i=1,total do board[i]=i end
    for i=total,2,-1 do
        local value
        state,value=seededNext(state)
        local j=1+math.floor(value*i)
        board[i],board[j]=board[j],board[i]
    end
    return board,state
end

local function replayNumberRush(seed,history,count)
    local total=math.max(2,math.min(64,math.floor(tonumber(count) or 25)))
    if type(history)~='table' or #history<total or #history>250 then return nil end
    local board=generateNumberRush(seed,total)
    local expected=1
    local misses=0
    local normalized={}
    for i,value in ipairs(history) do
        local index=tonumber(value)
        if not index or index~=math.floor(index) or index<0 or index>=total then return nil end
        if expected>total then return nil end
        normalized[#normalized+1]=index
        if board[index+1]==expected then
            expected=expected+1
        else
            misses=misses+1
        end
    end
    return {complete=expected==total+1,misses=misses,taps=#normalized,count=total,board=board,history=normalized}
end

local function generateHighLowSequence(seed,rounds)
    local count=math.max(1,math.min(100,math.floor(tonumber(rounds) or 30)))
    local state=math.floor(tonumber(seed) or 1)%2147483647
    if state<=0 then state=1 end
    local sequence={}
    local value
    state,value=seededNext(state)
    sequence[1]=1+math.floor(value*13)
    for i=2,count+1 do
        local nextValue=sequence[i-1]
        local guard=0
        repeat
            state,value=seededNext(state)
            nextValue=1+math.floor(value*13)
            guard=guard+1
        until nextValue~=sequence[i-1] or guard>=20
        if nextValue==sequence[i-1] then nextValue=(nextValue%13)+1 end
        sequence[i]=nextValue
    end
    return sequence,state
end

local function replayHighLow(seed,history,rounds)
    local maxRounds=math.max(1,math.min(100,math.floor(tonumber(rounds) or 30)))
    if type(history)~='table' or #history<1 or #history>maxRounds then return nil end
    local sequence=generateHighLowSequence(seed,maxRounds)
    local streak=0
    local ended=false
    local normalized={}
    for i,rawGuess in ipairs(history) do
        local guess=tostring(rawGuess or ''):lower()
        if guess~='high' and guess~='low' then return nil end
        normalized[#normalized+1]=guess
        local current=sequence[i]
        local nextValue=sequence[i+1]
        local correct=(guess=='high' and nextValue>current) or (guess=='low' and nextValue<current)
        if correct then
            streak=streak+1
            if i==maxRounds then ended=true end
        else
            if i~=#history then return nil end
            ended=true
            break
        end
    end
    return {ended=ended,streak=streak,rounds=#normalized,sequence=sequence,history=normalized}
end

local function newHighLowState(seed,rounds)
    local maxRounds=math.max(1,math.min(100,math.floor(tonumber(rounds) or 30)))
    return {
        sequence=generateHighLowSequence(seed,maxRounds),
        maxRounds=maxRounds,
        index=1,
        streak=0,
        history={},
        ended=false
    }
end

local function applyHighLowGuess(state,rawGuess)
    if type(state)~='table' or state.ended then return nil end
    local guess=tostring(rawGuess or ''):lower()
    if guess~='high' and guess~='low' then return nil end
    local index=math.floor(tonumber(state.index) or 1)
    local maxRounds=math.floor(tonumber(state.maxRounds) or 30)
    if index<1 or index>maxRounds then return nil end
    local current=state.sequence and state.sequence[index]
    local nextValue=state.sequence and state.sequence[index+1]
    if not current or not nextValue then return nil end

    state.history[#state.history+1]=guess
    local correct=(guess=='high' and nextValue>current) or (guess=='low' and nextValue<current)
    state.index=index+1
    if correct then state.streak=(tonumber(state.streak) or 0)+1 end
    if not correct or state.index>maxRounds then state.ended=true end

    return {
        currentValue=current,
        nextValue=nextValue,
        correct=correct,
        streak=state.streak,
        completed=#state.history,
        ended=state.ended,
        cleared=correct and state.index>maxRounds
    }
end

local function generateSimonSequence(seed,rounds)
    local count=math.max(1,math.min(100,math.floor(tonumber(rounds) or 30)))
    local state=math.floor(tonumber(seed) or 1)%2147483647
    if state<=0 then state=1 end
    local sequence={}
    for i=1,count do
        local value
        state,value=seededNext(state)
        sequence[i]=math.min(3,math.floor(value*4))
    end
    return sequence,state
end

local function replaySimon(seed,history,rounds)
    local maxRounds=math.max(1,math.min(100,math.floor(tonumber(rounds) or 30)))
    local maxInputs=(maxRounds*(maxRounds+1))/2+1
    if type(history)~='table' or #history<1 or #history>maxInputs then return nil end
    local sequence=generateSimonSequence(seed,maxRounds)
    local normalized={}
    local round=1
    local inputIndex=1
    local cleared=0
    local ended=false

    for i,raw in ipairs(history) do
        local guess=tonumber(raw)
        if not guess or guess~=math.floor(guess) or guess<0 or guess>3 then return nil end
        normalized[#normalized+1]=guess
        local expected=sequence[inputIndex]

        if guess~=expected then
            if i~=#history then return nil end
            ended=true
            break
        end

        if inputIndex==round then
            cleared=round
            if round>=maxRounds then
                if i~=#history then return nil end
                ended=true
                break
            end
            round=round+1
            inputIndex=1
        else
            inputIndex=inputIndex+1
        end
    end

    return {ended=ended,cleared=cleared,round=round,history=normalized,sequence=sequence}
end

local function simonRoundSequence(state)
    if type(state)~='table' or type(state.sequence)~='table' then return nil end
    local round=math.floor(tonumber(state.round) or 1)
    if round<1 or round>math.floor(tonumber(state.maxRounds) or 30) then return nil end
    local out={}
    for i=1,round do out[i]=state.sequence[i] end
    return out
end

local function newSimonState(seed,rounds)
    local maxRounds=math.max(1,math.min(100,math.floor(tonumber(rounds) or 30)))
    local state={
        sequence=generateSimonSequence(seed,maxRounds),
        maxRounds=maxRounds,
        round=1,
        cleared=0,
        ended=false
    }
    return state
end

local function applySimonRound(state,inputs)
    if type(state)~='table' or state.ended or type(inputs)~='table' then return nil end
    local round=math.floor(tonumber(state.round) or 1)
    if #inputs<1 or #inputs>round then return nil end
    local normalized={}
    local mismatch=false
    for i,raw in ipairs(inputs) do
        local value=tonumber(raw)
        if not value or value~=math.floor(value) or value<0 or value>3 then return nil end
        normalized[i]=value
        if value~=state.sequence[i] then mismatch=true end
    end

    if mismatch or #normalized<round then
        state.ended=true
        return {correct=false,ended=true,cleared=state.cleared,round=round}
    end

    state.cleared=round
    if round>=state.maxRounds then
        state.ended=true
        return {correct=true,ended=true,cleared=state.cleared,round=round,clearedAll=true}
    end

    state.round=round+1
    return {
        correct=true,
        ended=false,
        cleared=state.cleared,
        round=state.round,
        sequence=simonRoundSequence(state)
    }
end

local function trianglePosition(elapsedMs,periodMs,phaseMs)
    local period=math.max(400,tonumber(periodMs) or 1800)
    local phase=tonumber(phaseMs) or 0
    local cycle=(math.max(0,tonumber(elapsedMs) or 0)+phase)%period
    local half=period/2
    if cycle<=half then return (cycle/half)*100 end
    return ((period-cycle)/half)*100
end
local function generateMines(seed,size,mineCount,avoidIndex)
    local total=size*size
    local avoid=tonumber(avoidIndex)
    if avoid and (avoid~=math.floor(avoid) or avoid<0 or avoid>=total) then avoid=nil end
    local maxMines=math.max(0,total-(avoid and 1 or 0))
    mineCount=math.max(0,math.min(maxMines,math.floor(tonumber(mineCount) or 0)))
    local state=math.floor(tonumber(seed) or 1)%2147483647
    if state<=0 then state=1 end
    local mines={} local count=0
    while count<mineCount do
        state=(state*16807)%2147483647
        local index=(state-1)%total
        if index~=avoid and not mines[index] then mines[index]=true count=count+1 end
    end
    return mines
end
local NONOGRAM_PATTERNS_5={
    {'01010','11111','11111','01110','00100'}, -- heart
    {'00100','00100','11111','00100','00100'}, -- cross
    {'00100','01110','11111','01110','00100'}, -- diamond
    {'00100','01110','11111','10001','11111'}, -- house
    {'00100','01100','11111','01100','00100'}, -- arrow
    {'10001','10001','00000','10001','01110'}, -- smile
    {'10001','10001','10001','01110','00100'}, -- cup
    {'00100','01110','11111','00100','00100'}, -- tree
    {'10000','11000','11100','11110','11111'}, -- stairs
    {'10101','01010','10101','01010','10101'}, -- checker
    {'11111','10001','10001','10001','11111'}, -- frame
    {'10101','11111','01110','01110','11111'}, -- crown
    {'00100','01110','11111','01110','10101'}, -- rocket
    {'00100','01110','11111','01110','00101'}  -- fish
}
local function generateNonogram(seed,size)
    if tonumber(size)==5 then
        local numeric=math.max(1,math.floor(tonumber(seed) or 1))
        local pattern=NONOGRAM_PATTERNS_5[((numeric-1)%#NONOGRAM_PATTERNS_5)+1]
        local filled={} local count=0
        for y=0,4 do
            local row=pattern[y+1]
            for x=0,4 do
                if row:sub(x+1,x+1)=='1' then
                    filled[y*5+x]=true
                    count=count+1
                end
            end
        end
        return filled,count
    end

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

local function stackPosition(elapsedMs,width,speed,reverse)
    local blockWidth=math.max(0.1,math.min(100,tonumber(width) or 72))
    local maxX=math.max(0,100-blockWidth)
    if maxX<=0 then return 0 end
    local distance=(math.max(0,tonumber(elapsedMs) or 0)/1000)*math.max(1,tonumber(speed) or 65)
    local period=maxX*2
    local cycle=distance%period
    local x=cycle<=maxX and cycle or (period-cycle)
    if reverse then x=maxX-x end
    return x
end

local function replayStack(challenge,history)
    if type(history)~='table' or #history<1 or #history>501 then return nil end
    local width=tonumber(challenge and challenge.initialWidthPct) or 72
    local speed=tonumber(challenge and challenge.speedPctPerSec) or 65
    local baseX=(100-width)/2
    local score=0
    local previousAction=0
    local ended=false
    local normalized={}

    for i,value in ipairs(history) do
        local actionMs=tonumber(value)
        if not actionMs or actionMs~=actionMs or actionMs<=previousAction or actionMs>28800000 then return nil end
        actionMs=math.floor(actionMs*1000+0.5)/1000
        if actionMs<=previousAction then return nil end
        local elapsed=actionMs-previousAction
        local reverse=(score%2)==1
        local moverX=stackPosition(elapsed,width,speed,reverse)
        local left=math.max(baseX,moverX)
        local right=math.min(baseX+width,moverX+width)
        local overlap=right-left
        normalized[#normalized+1]=actionMs

        if overlap<=0.0001 then
            if i~=#history then return nil end
            ended=true
            break
        end

        baseX=left
        width=overlap
        score=score+1
        speed=math.min(180,speed+4)
        previousAction=actionMs
    end

    return {
        score=score,
        ended=ended,
        width=width,
        baseX=baseX,
        history=normalized
    }
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
    elseif game.id=='memory' then
        challenge.previewMs=1200
    elseif game.id=='color_match' then
        challenge.rounds=10
    elseif game.id=='number_rush' then
        challenge.count=25
    elseif game.id=='high_low' then
        challenge.rounds=30
    elseif game.id=='simon' then
        challenge.rounds=30
    end
    return challenge
end

local function currentDatabaseDate()
    local row=MySQL.single.await([[SELECT DATE_FORMAT(CURDATE(),'%Y-%m-%d') AS challenge_date]])
    return row and tostring(row.challenge_date or '') or os.date('%Y-%m-%d')
end
local function dailyNumber(date)
    local compact=(tostring(date or ''):gsub('%D',''))
    return tonumber(compact) or 1
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
        local numeric=dailyNumber(date)
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
        MIN(CASE WHEN metadata_json IS NULL OR metadata_json NOT LIKE '%"dailyDate":%' THEN score END) AS normal_min_score,
        MAX(CASE WHEN metadata_json IS NULL OR metadata_json NOT LIKE '%"dailyDate":%' THEN score END) AS normal_max_score,
        MIN(CASE WHEN metadata_json IS NULL OR metadata_json NOT LIKE '%"dailyDate":%' THEN duration_ms END) AS normal_best_time_ms
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
                bestScore=tonumber(game.rankingOrder=='asc' and row.normal_min_score or row.normal_max_score),
                bestTimeMs=tonumber(row.normal_best_time_ms),
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
local function evaluateAchievements(playerIdentifier,game,score,metadata)
    local unlocked={}
    local total=tonumber(MySQL.scalar.await('SELECT COUNT(*) FROM flecity_game_scores WHERE player_identifier=?',{playerIdentifier}) or 0)
    if unlockAchievement(playerIdentifier,'first_play',game.id,{total=total}) then unlocked[#unlocked+1]='first_play' end
    local cfg=FlecityGamesConfig.Play.Achievements or {}
    if total>=tonumber(cfg.GamesVeteranCount or 100) and unlockAchievement(playerIdentifier,'100_games',nil,{total=total}) then unlocked[#unlocked+1]='100_games' end
    if game.id=='quick_tap' and score<=tonumber(cfg.LightningReactionMs or 200) and unlockAchievement(playerIdentifier,'lightning',game.id,{score=score}) then unlocked[#unlocked+1]='lightning' end
    if game.id=='stack' and score>=tonumber(cfg.StackMasterLayers or 25) and unlockAchievement(playerIdentifier,'stack_master',game.id,{score=score}) then unlocked[#unlocked+1]='stack_master' end
    if game.id=='block' and score>=tonumber(cfg.BlockMasterScore or 5000) and unlockAchievement(playerIdentifier,'block_master',game.id,{score=score}) then unlocked[#unlocked+1]='block_master' end
    if game.id=='memory' and tonumber(metadata and metadata.moves)==8 and unlockAchievement(playerIdentifier,'perfect_memory',game.id,{score=score,moves=8}) then unlocked[#unlocked+1]='perfect_memory' end
    if game.id=='number_rush' and tonumber(metadata and metadata.misses)==0
        and score<=tonumber(cfg.NumberRushAceMs or 12000)
        and unlockAchievement(playerIdentifier,'number_rush_ace',game.id,{score=score,misses=0}) then
        unlocked[#unlocked+1]='number_rush_ace'
    end
    if game.id=='high_low' and score>=tonumber(cfg.HighLowStreak or 10)
        and unlockAchievement(playerIdentifier,'high_low_streak',game.id,{score=score}) then
        unlocked[#unlocked+1]='high_low_streak'
    end
    if game.id=='stop' and score>=tonumber(cfg.StopBullseyeScore or 990)
        and unlockAchievement(playerIdentifier,'bullseye',game.id,{score=score,distancePct=metadata and metadata.distancePct}) then
        unlocked[#unlocked+1]='bullseye'
    end
    if game.id=='merge' and tonumber(metadata and metadata.maxTile)>=tonumber(cfg.MergeMasterTile or 2048)
        and unlockAchievement(playerIdentifier,'merge_master',game.id,{score=score,maxTile=metadata.maxTile}) then
        unlocked[#unlocked+1]='merge_master'
    end
    if game.id=='mines' and score<=tonumber(cfg.MinesSprinterMs or 60000)
        and unlockAchievement(playerIdentifier,'mines_sprinter',game.id,{score=score}) then
        unlocked[#unlocked+1]='mines_sprinter'
    end
    if game.id=='nonogram' and score<=tonumber(cfg.NonogramQuickMs or 60000)
        and unlockAchievement(playerIdentifier,'nonogram_solver',game.id,{score=score}) then
        unlocked[#unlocked+1]='nonogram_solver'
    end
    if game.id=='color_match' and score<=tonumber(cfg.ColorMatchFocusMs or 6000)
        and unlockAchievement(playerIdentifier,'color_focus',game.id,{score=score}) then
        unlocked[#unlocked+1]='color_focus'
    end
    if game.id=='simon' and score>=tonumber(cfg.SimonMasterRounds or 15)
        and unlockAchievement(playerIdentifier,'simon_master',game.id,{score=score}) then
        unlocked[#unlocked+1]='simon_master'
    end
    return unlocked
end

local function dailyRankingRows(challenge,limit)
    if not challenge then return {} end
    local game=gameFor(challenge.gameId)
    if not game then return {} end
    local order=game.rankingOrder=='asc' and 'ASC' or 'DESC'
    local aggregate=game.rankingOrder=='asc' and 'MIN' or 'MAX'
    local safeLimit=math.max(1,math.min(50,tonumber(limit) or 20))
    local dailyPattern=('%%"dailyDate":"%s"%%'):format(challenge.date)
    local sql=([[SELECT COALESCE(p.display_name,'Player') AS display_name,%s(s.score) AS score
        FROM flecity_game_scores s LEFT JOIN flecity_game_profiles p ON p.player_identifier=s.player_identifier
        WHERE s.game_id=? AND s.created_at>=? AND s.created_at<DATE_ADD(?,INTERVAL 1 DAY)
        AND s.metadata_json LIKE ?
        GROUP BY s.player_identifier,p.display_name
        ORDER BY score %s,display_name ASC LIMIT %d]]):format(aggregate,order,safeLimit)
    return MySQL.query.await(sql,{challenge.gameId,challenge.date,challenge.date,dailyPattern}) or {}
end
local function personalBestForGame(playerIdentifier,game)
    if not playerIdentifier or not game or game.supportsRanking~=true then return nil end
    local order=game.rankingOrder=='asc' and 'ASC' or 'DESC'
    return MySQL.single.await(([[SELECT score,duration_ms,created_at FROM flecity_game_scores
        WHERE player_identifier=? AND game_id=?
        AND (metadata_json IS NULL OR metadata_json NOT LIKE '%%"dailyDate":%%')
        ORDER BY score %s,created_at ASC LIMIT 1]]):format(order),{playerIdentifier,game.id})
end

local function bestScoresFor(playerIdentifier)
    local best={}
    for _,game in ipairs(FlecityGamesRegistry.List('play',true)) do
        local row=personalBestForGame(playerIdentifier,game)
        if row then best[game.id]=row end
    end
    return best
end

local function dailyPersonalBest(challenge,playerIdentifier)
    if not challenge or not playerIdentifier then return nil end
    local game=gameFor(challenge.gameId)
    if not game then return nil end
    local order=game.rankingOrder=='asc' and 'ASC' or 'DESC'
    local dailyPattern=('%%"dailyDate":"%s"%%'):format(challenge.date)
    return MySQL.single.await(([[SELECT score,duration_ms,created_at FROM flecity_game_scores
        WHERE player_identifier=? AND game_id=?
        AND created_at>=? AND created_at<DATE_ADD(?,INTERVAL 1 DAY)
        AND metadata_json LIKE ?
        ORDER BY score %s,created_at ASC LIMIT 1]]):format(order),
        {playerIdentifier,challenge.gameId,challenge.date,challenge.date,dailyPattern})
end

local function publicDaily(challenge,playerIdentifier)
    if not challenge then return nil end
    local rows=dailyRankingRows(challenge,FlecityGamesConfig.Play.RankingLimit or 20)
    return {
        date=challenge.date,gameId=challenge.gameId,game=challenge.game,seed=challenge.seed,
        best=rows[1],selfBest=dailyPersonalBest(challenge,playerIdentifier),ranking=rows
    }
end

function FlecityGamesPlay.Bootstrap(source)
    local id=identifier(source)
    if not id then return {ok=false,error='PLAYER_NOT_READY'} end
    clearForeignSourceSessions(source,id)
    touchProfile(source,id)

    local saveRows=MySQL.query.await([[SELECT game_id,state_json,score,elapsed_ms,game_version,updated_at
        FROM flecity_game_saves WHERE player_identifier=? ORDER BY updated_at DESC]],{id}) or {}
    local saves={}
    for _,save in ipairs(saveRows) do
        local game=gameFor(save.game_id)
        if game and tonumber(save.game_version or 1)==tonumber(game.version or 1) then
            save.state=json.decode(save.state_json or '{}') or {}
            save.state_json=nil
            saves[#saves+1]=save
        end
    end

    local best=bestScoresFor(id)

    return {
        ok=true,
        version=GetResourceMetadata(GetCurrentResourceName(),'version',0) or 'unknown',
        games=FlecityGamesRegistry.List('play',false),saves=saves,best=best,
        daily=publicDaily(dailyChallenge(),id),statistics=statisticsFor(id),achievements=achievementsFor(id)
    }
end

local function clearPlayerGameSessions(playerIdentifier,gameId)
    for token,session in pairs(sessions) do
        if session.playerIdentifier==playerIdentifier and session.gameId==gameId then sessions[token]=nil end
    end
end

local function saveEpochKey(playerIdentifier,gameId)
    return tostring(playerIdentifier or '')..':'..tostring(gameId or '')
end

local function currentSaveEpoch(playerIdentifier,gameId)
    return tonumber(saveEpochs[saveEpochKey(playerIdentifier,gameId)]) or 0
end

local function bumpSaveEpoch(playerIdentifier,gameId)
    local key=saveEpochKey(playerIdentifier,gameId)
    local value=currentSaveEpoch(playerIdentifier,gameId)+1
    saveEpochs[key]=value
    return value
end

local function clearForeignSourceSessions(source,currentIdentifier)
    local src=tonumber(source)
    if not src or not currentIdentifier then return 0 end
    local removed=0
    for token,session in pairs(sessions) do
        if tonumber(session.source)==src and session.playerIdentifier~=currentIdentifier then
            sessions[token]=nil
            removed=removed+1
        end
    end
    return removed
end

function FlecityGamesPlay.StartSession(source,data)
    if not FlecityGamesRateLimit.Allow(source,'play_start',FlecityGamesConfig.RateLimits.PlayStartMs) then return {ok=false,error='RATE_LIMIT'} end
    if type(data)~='table' then data={} end
    local id=identifier(source)
    if not id then return {ok=false,error='PLAYER_NOT_READY'} end
    clearForeignSourceSessions(source,id)

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
    local resumeState=nil
    if not seed then
        if game.supportsResume==true and data.resume==true then
            local saved=MySQL.single.await([[SELECT seed,elapsed_ms,game_version,state_json FROM flecity_game_saves
                WHERE player_identifier=? AND game_id=? LIMIT 1]],{id,game.id})
            if not saved then return {ok=false,error='SAVE_NOT_FOUND'} end
            if tonumber(saved.game_version or 1)~=tonumber(game.version or 1) then
                return {ok=false,error='SAVE_VERSION_MISMATCH'}
            end
            local resumeSeed=tonumber(saved.seed)
            if not resumeSeed or resumeSeed<1 or resumeSeed>2147483646 then
                return {ok=false,error='SAVE_NOT_FOUND'}
            end
            seed=math.floor(resumeSeed)
            baseElapsedMs=math.max(0,math.min(28800000,math.floor(tonumber(saved.elapsed_ms) or 0)))
            resumeState=json.decode(saved.state_json or '{}') or {}
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
        startedTick=startedTick,baseElapsedMs=baseElapsedMs,challenge=challenge,dailyDate=dailyDate,
        saveEpoch=currentSaveEpoch(id,game.id),
        timingDeferred=(game.id=='mines' or game.id=='nonogram'),
        timingActivated=false,
        activeStartedTick=nil,
        minesAvoidIndex=nil
    }
    if game.id=='mines' and resumeState then
        local avoid=tonumber(resumeState.avoidIndex)
        local size=tonumber(challenge.size) or 8
        if avoid and avoid==math.floor(avoid) and avoid>=0 and avoid<size*size then
            sessions[token].minesAvoidIndex=avoid
        end
    end
    local publicSeed=seed
    if game.id=='high_low' then
        local highLow=newHighLowState(seed,challenge.rounds)
        sessions[token].highLow=highLow
        challenge.currentValue=highLow.sequence[1]
        publicSeed=nil
    elseif game.id=='simon' then
        local simonState=newSimonState(seed,challenge.rounds)
        sessions[token].simon=simonState
        challenge.sequence=simonRoundSequence(simonState)
        publicSeed=nil
    end
    return {
        ok=true,game=game,sessionToken=token,seed=publicSeed,challenge=challenge,
        baseElapsedMs=baseElapsedMs,serverTick=GetGameTimer(),startedTick=startedTick,
        daily=dailyDate~=nil,dailyDate=dailyDate
    }
end

function FlecityGamesPlay.HighLowGuess(source,data)
    if not FlecityGamesRateLimit.Allow(source,'high_low_guess',120) then return {ok=false,error='RATE_LIMIT'} end
    if type(data)~='table' then return {ok=false,error='INVALID_REQUEST'} end
    local id=identifier(source)
    local token=tostring(data.sessionToken or '')
    local session=sessions[token]
    if not id then return {ok=false,error='PLAYER_NOT_READY'} end
    if not session or session.playerIdentifier~=id or session.gameId~='high_low' then return {ok=false,error='INVALID_SESSION'} end
    if os.time()-session.startedAt>FlecityGamesConfig.Play.SessionMaxAgeSeconds then
        sessions[token]=nil
        return {ok=false,error='EXPIRED_SESSION'}
    end

    local state=session.highLow
    if not state then return {ok=false,error='INVALID_SESSION'} end
    local step=math.floor(tonumber(data.step) or -1)
    local guess=tostring(data.guess or ''):lower()
    if state.lastStep==step and state.lastResult and state.lastGuess==guess then
        return state.lastResult
    end
    if state.ended then return {ok=false,error='ROUND_COMPLETE'} end
    if step~=#state.history+1 then return {ok=false,error='ROUND_TOKEN_MISMATCH'} end

    local result=applyHighLowGuess(state,guess)
    if not result then return {ok=false,error='INVALID_CHOICE'} end
    result.ok=true
    state.lastStep=step
    state.lastGuess=guess
    state.lastResult=result
    return result
end

function FlecityGamesPlay.SubmitSimonRound(source,data)
    if not FlecityGamesRateLimit.Allow(source,'simon_round',160) then return {ok=false,error='RATE_LIMIT'} end
    if type(data)~='table' then return {ok=false,error='INVALID_REQUEST'} end
    local id=identifier(source)
    local token=tostring(data.sessionToken or '')
    local session=sessions[token]
    if not id then return {ok=false,error='PLAYER_NOT_READY'} end
    if not session or session.playerIdentifier~=id or session.gameId~='simon' then return {ok=false,error='INVALID_SESSION'} end
    if os.time()-session.startedAt>FlecityGamesConfig.Play.SessionMaxAgeSeconds then
        sessions[token]=nil
        return {ok=false,error='EXPIRED_SESSION'}
    end

    local state=session.simon
    if not state then return {ok=false,error='INVALID_SESSION'} end
    local round=math.floor(tonumber(data.round) or -1)
    if state.lastRound==round and state.lastResult then
        return state.lastResult
    end
    if state.ended then return {ok=false,error='ROUND_COMPLETE'} end
    if round~=math.floor(tonumber(state.round) or -2) then return {ok=false,error='ROUND_TOKEN_MISMATCH'} end

    local result=applySimonRound(state,data.inputs)
    if not result then return {ok=false,error='INVALID_CHOICE'} end
    result.ok=true
    state.lastRound=round
    state.lastResult=result
    return result
end

function FlecityGamesPlay.ActivateSession(source,data)
    if not FlecityGamesRateLimit.Allow(source,'play_activate',120) then return {ok=false,error='RATE_LIMIT'} end
    if type(data)~='table' then return {ok=false,error='INVALID_REQUEST'} end
    local id=identifier(source)
    local token=tostring(data.sessionToken or '')
    local session=sessions[token]
    if not id then return {ok=false,error='PLAYER_NOT_READY'} end
    if not session or session.playerIdentifier~=id then return {ok=false,error='INVALID_SESSION'} end
    if session.timingDeferred~=true then return {ok=true,activated=true,elapsedMs=select(2,elapsedForSession(session))} end

    if session.gameId=='mines' and not session.dailyDate and session.minesAvoidIndex==nil and data.firstIndex~=nil then
        local size=tonumber(session.challenge and session.challenge.size) or 8
        local firstIndex=tonumber(data.firstIndex)
        if not firstIndex or firstIndex~=math.floor(firstIndex) or firstIndex<0 or firstIndex>=size*size then
            return {ok=false,error='INVALID_CHOICE'}
        end
        session.minesAvoidIndex=firstIndex
    end

    if session.timingActivated~=true then
        session.timingActivated=true
        session.activeStartedTick=GetGameTimer()
    end
    return {
        ok=true,
        activated=true,
        elapsedMs=select(2,elapsedForSession(session)),
        avoidIndex=session.minesAvoidIndex
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
    bumpSaveEpoch(id,game.id)
    clearPlayerGameSessions(id,game.id)
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
    if tonumber(session.saveEpoch or 0)~=currentSaveEpoch(id,game.id) then return {ok=false,error='SAVE_RESET'} end
    if session.dailyDate then return {ok=false,error='DAILY_SAVE_DISABLED'} end
    local seedNumber=math.floor(tonumber(session.seed) or 0)
    if seedNumber<1 or seedNumber>2147483646 then return {ok=false,error='INVALID_SESSION_SEED'} end

    local _,elapsed=elapsedForSession(session)
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
        local mines=generateMines(session.seed,size,mineCount,session.minesAvoidIndex)
        for _,index in ipairs(revealed) do
            if mines[index] or flagSet[index] then return {ok=false,error='INVALID_MINES_SAVE'} end
        end
        saveState={revealed=revealed,flags=flags,mode=data.state.mode=='flag' and 'flag' or 'reveal',avoidIndex=session.minesAvoidIndex}
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
    if tonumber(session.saveEpoch or 0)~=currentSaveEpoch(id,game.id) then return {ok=false,error='SAVE_RESET'} end
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
    elseif game.id=='mines' or game.id=='nonogram' or game.id=='memory' or game.id=='color_match' or game.id=='number_rush' then
        if score<1000 or score>28800000 then return nil end
        return math.floor(score)
    elseif game.id=='stack' then
        if score<0 or score>500 then return nil end
        return math.floor(score)
    elseif game.id=='high_low' or game.id=='simon' then
        if score<0 or score>100 then return nil end
        return math.floor(score)
    end
    if score<-100000000 or score>100000000 then return nil end
    return score
end

local function existingScoreResponse(playerIdentifier,token)
    if not playerIdentifier or token=='' then return nil end
    local row=MySQL.single.await([[SELECT score,duration_ms,metadata_json FROM flecity_game_scores
        WHERE player_identifier=? AND session_token=? LIMIT 1]],{playerIdentifier,token})
    if not row then return nil end
    local metadata=json.decode(row.metadata_json or '{}') or {}
    return {
        ok=true,
        score=tonumber(row.score) or row.score,
        details=metadata,
        unlocked={},
        daily=metadata.dailyDate~=nil,
        duplicate=true
    }
end

function FlecityGamesPlay.SubmitScore(source,data)
    if not FlecityGamesRateLimit.Allow(source,'score_submit',FlecityGamesConfig.RateLimits.ScoreSubmitMs) then return {ok=false,error='RATE_LIMIT'} end
    if type(data)~='table' then return {ok=false,error='INVALID_REQUEST'} end
    local id=identifier(source) local token=tostring(data.sessionToken or '') local session=sessions[token]
    if not id then return {ok=false,error='PLAYER_NOT_READY'} end
    if not session or session.playerIdentifier~=id then
        local existing=existingScoreResponse(id,token)
        if existing then return existing end
        return {ok=false,error='INVALID_SESSION'}
    end
    local game=gameFor(session.gameId)
    if not game then sessions[token]=nil return {ok=false,error='GAME_UNAVAILABLE'} end
    if os.time()-session.startedAt>FlecityGamesConfig.Play.SessionMaxAgeSeconds then sessions[token]=nil return {ok=false,error='EXPIRED_SESSION'} end

    local clientDurationMs=math.max(0,math.min(28800000,math.floor(tonumber(data.durationMs) or 0)))
    local serverElapsed,totalServerElapsed=elapsedForSession(session)
    local durationMs=clientDurationMs
    if game.supportsResume==true or game.id=='stack' or game.id=='memory' or game.id=='color_match' then durationMs=totalServerElapsed end
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
        local replayed=replayMergeState(session.seed,data.history)
        if not replayed or replayed.score~=math.floor(tonumber(data.score) or -1) then return {ok=false,error='INVALID_MERGE_REPLAY'} end
        local maxTile=0
        for y=1,4 do for x=1,4 do maxTile=math.max(maxTile,tonumber(replayed.board[y][x]) or 0) end end
        rawScore=replayed.score metadata.moves=#data.history metadata.maxTile=maxTile metadata.replayValidated=true
    elseif game.id=='stack' then
        local replayed=replayStack(session.challenge,data.history)
        if not replayed or not replayed.ended then return {ok=false,error='INVALID_STACK_REPLAY'} end
        local layers=math.floor(tonumber(data.score) or -1)
        if layers~=replayed.score then return {ok=false,error='INVALID_STACK_REPLAY'} end
        local lastAction=replayed.history[#replayed.history] or 0
        if lastAction>serverElapsed+350 or serverElapsed-lastAction>1800 then
            return {ok=false,error='IMPOSSIBLE_TIMING'}
        end
        rawScore=replayed.score
        durationMs=math.min(serverElapsed,28800000)
        metadata.layers=replayed.score
        metadata.replayValidated=true
    elseif game.id=='mines' then
        if session.timingActivated~=true then return {ok=false,error='TIMER_NOT_STARTED'} end
        if type(data.revealed)~='table' then return {ok=false,error='INVALID_CLEAR_STATE'} end
        local size=tonumber(session.challenge.size) or 8 local mineCount=tonumber(session.challenge.mines) or 10
        local mines=generateMines(session.seed,size,mineCount,session.minesAvoidIndex)
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
        if session.timingActivated~=true then return {ok=false,error='TIMER_NOT_STARTED'} end
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
    elseif game.id=='memory' then
        local replayed=replayMemory(session.seed,data.history)
        if not replayed or not replayed.complete then return {ok=false,error='INVALID_MEMORY_REPLAY'} end
        local previewMs=math.max(0,math.min(5000,math.floor(tonumber(session.challenge.previewMs) or 1200)))
        if serverElapsed<previewMs+1300 then return {ok=false,error='IMPOSSIBLE_TIMING'} end
        durationMs=math.max(0,totalServerElapsed-previewMs)
        rawScore=durationMs
        metadata.moves=replayed.moves metadata.pairs=replayed.pairs metadata.previewMs=previewMs metadata.replayValidated=true
    elseif game.id=='color_match' then
        local replayed=replayColorMatch(session.seed,data.history,session.challenge.rounds)
        if not replayed or not replayed.complete then return {ok=false,error='INVALID_COLOR_MATCH_REPLAY'} end
        if serverElapsed<1200 then return {ok=false,error='IMPOSSIBLE_TIMING'} end
        durationMs=totalServerElapsed
        rawScore=durationMs
        metadata.rounds=replayed.rounds metadata.replayValidated=true
    elseif game.id=='number_rush' then
        local replayed=replayNumberRush(session.seed,data.history,session.challenge.count)
        if not replayed or not replayed.complete then return {ok=false,error='INVALID_NUMBER_RUSH_REPLAY'} end
        if clientDurationMs<3000 or clientDurationMs>serverElapsed+300 or serverElapsed-clientDurationMs>2500 then
            return {ok=false,error='IMPOSSIBLE_TIMING'}
        end
        durationMs=clientDurationMs
        rawScore=durationMs+(replayed.misses*500)
        metadata.misses=replayed.misses
        metadata.taps=replayed.taps
        metadata.count=replayed.count
        metadata.penaltyMs=replayed.misses*500
        metadata.replayValidated=true
    elseif game.id=='high_low' then
        local state=session.highLow
        if not state or state.ended~=true or type(state.history)~='table' or #state.history<1 then
            return {ok=false,error='INVALID_HIGH_LOW_REPLAY'}
        end
        local submitted=math.floor(tonumber(data.score) or -1)
        local streak=math.floor(tonumber(state.streak) or -1)
        if submitted~=streak then return {ok=false,error='INVALID_HIGH_LOW_REPLAY'} end
        rawScore=streak
        durationMs=math.min(serverElapsed,28800000)
        metadata.rounds=#state.history
        metadata.streak=streak
        metadata.serverAuthoritative=true
    elseif game.id=='simon' then
        local state=session.simon
        if not state or state.ended~=true then return {ok=false,error='INVALID_SIMON_REPLAY'} end
        local submitted=math.floor(tonumber(data.score) or -1)
        local cleared=math.floor(tonumber(state.cleared) or -1)
        if submitted~=cleared then return {ok=false,error='INVALID_SIMON_REPLAY'} end
        rawScore=cleared
        durationMs=math.min(serverElapsed,28800000)
        metadata.rounds=cleared
        metadata.serverAuthoritative=true
    end

    local score=validateScore(game,rawScore)
    if score==nil then return {ok=false,error='INVALID_SCORE'} end
    local existing=existingScoreResponse(id,token)
    if existing then
        sessions[token]=nil
        return existing
    end

    local ok,insertId=pcall(function()
        return MySQL.insert.await([[INSERT INTO flecity_game_scores
            (player_identifier,game_id,score,duration_ms,session_token,metadata_json)
            VALUES (?,?,?,?,?,?)]],{id,game.id,score,durationMs,token,json.encode(metadata)})
    end)
    if not ok or not insertId then return {ok=false,error='SCORE_SAVE_FAILED'} end

    sessions[token]=nil
    if game.supportsResume and not session.dailyDate then MySQL.query.await('DELETE FROM flecity_game_saves WHERE player_identifier=? AND game_id=?',{id,game.id}) end
    local unlocked=evaluateAchievements(id,game,score,metadata)
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
        AND (s.metadata_json IS NULL OR s.metadata_json NOT LIKE '%%"dailyDate":%%')
        GROUP BY s.player_identifier,p.display_name
        ORDER BY score %s,display_name ASC LIMIT %d]]):format(aggregate,wherePeriod,order,limit)
    return {ok=true,gameId=game.id,period=period,rows=MySQL.query.await(sql,{game.id}) or {}}
end

function FlecityGamesPlay.Statistics(source)
    local id=identifier(source)
    if not id then return {ok=false,error='PLAYER_NOT_READY'} end
    return {ok=true,statistics=statisticsFor(id),achievements=achievementsFor(id),best=bestScoresFor(id),daily=publicDaily(dailyChallenge(),id)}
end

function FlecityGamesPlay.DebugSelftest()
    local quick=gameFor('quick_tap') local stop=gameFor('stop') local block=gameFor('block')
    local merge=gameFor('merge') local minesGame=gameFor('mines') local stack=gameFor('stack') local nonogram=gameFor('nonogram') local memory=gameFor('memory') local colorMatch=gameFor('color_match') local numberRush=gameFor('number_rush') local highLow=gameFor('high_low') local simon=gameFor('simon')
    local testMines=generateMines(12345,8,10) local testMineCount=0 for _ in pairs(testMines) do testMineCount=testMineCount+1 end
    local testSafeMines=generateMines(12345,8,10,0) local testSafeMineCount=0 for _ in pairs(testSafeMines) do testSafeMineCount=testSafeMineCount+1 end
    local testNonogram,testNonogramCount=generateNonogram(12345,5)
    local testNonogramActual=0 for _ in pairs(testNonogram) do testNonogramActual=testNonogramActual+1 end
    local quickChallenge=challengeFor(quick,12345) local quickChallenge2=challengeFor(quick,12345)
    local dailyNumberA=dailyNumber('2026-10-20')
    local dailyNumberB=dailyNumber('2026-10-21')
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
    local memoryDeck=generateMemoryDeck(12345)
    local memoryPairs={} local memorySeen={}
    for index,value in ipairs(memoryDeck) do
        local zero=index-1
        if memorySeen[value] then memoryPairs[#memoryPairs+1]={memorySeen[value],zero}
        else memorySeen[value]=zero end
    end
    local memoryReplay=replayMemory(12345,memoryPairs)
    local colorRounds=generateColorMatch(12345,10)
    local colorHistory={} for _,round in ipairs(colorRounds) do colorHistory[#colorHistory+1]=round.ink end
    local colorReplay=replayColorMatch(12345,colorHistory,10)
    local numberRushBoard=generateNumberRush(12345,25)
    local numberRushHistory={}
    for expected=1,25 do
        for index,value in ipairs(numberRushBoard) do
            if value==expected then numberRushHistory[#numberRushHistory+1]=index-1 break end
        end
    end
    local numberRushReplay=replayNumberRush(12345,numberRushHistory,25)
    local highLowSequence=generateHighLowSequence(12345,30)
    local highLowHistory={}
    for i=1,30 do
        highLowHistory[#highLowHistory+1]=highLowSequence[i+1]>highLowSequence[i] and 'high' or 'low'
    end
    local highLowReplay=replayHighLow(12345,highLowHistory,30)
    local highLowState=newHighLowState(12345,30)
    local highLowServerOk=true
    for i=1,30 do
        local result=applyHighLowGuess(highLowState,highLowHistory[i])
        if not result or result.correct~=true then highLowServerOk=false break end
    end
    local simonSequence=generateSimonSequence(12345,5)
    local simonHistory={}
    for round=1,5 do
        for i=1,round do simonHistory[#simonHistory+1]=simonSequence[i] end
    end
    local simonReplay=replaySimon(12345,simonHistory,5)
    local simonState=newSimonState(12345,5)
    local simonServerOk=true
    for round=1,5 do
        local inputs={}
        for i=1,round do inputs[i]=simonSequence[i] end
        local result=applySimonRound(simonState,inputs)
        if not result or result.correct~=true then simonServerOk=false break end
    end

    local sample={board={{0,1},{1,0}},pieces={{shape=1}},score=120,combo=2}
    local encoded=json.encode(sample) local decoded=encoded and json.decode(encoded) or nil
    return {
        quickRejectLow=quick and validateScore(quick,69)==nil or false,
        quickAcceptNormal=quick and validateScore(quick,180)~=nil or false,
        deterministicChallenge=quickChallenge.delayMs==quickChallenge2.delayMs,
        dailyDateParsing=dailyNumberA==20261020 and dailyNumberB==20261021 and dailyNumberA~=dailyNumberB,
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
        deferredTimerGames=minesGame and nonogram and challengeFor(minesGame,12345).size==8 and challengeFor(nonogram,12345).size==5 or false,
        minesSeedCount=testMineCount==10,
        minesFirstRevealSafe=testSafeMineCount==10 and testSafeMines[0]~=true,
        stackValidateLayers=stack and validateScore(stack,25)==25 or false,
        stackPositionBounds=stackPosition(0,72,65,false)==0 and math.abs(stackPosition(0,72,65,true)-28)<0.001,
        nonogramSeedCount=testNonogramCount==testNonogramActual and testNonogramCount>0,
        nonogramCuratedSet=#NONOGRAM_PATTERNS_5==14 and testNonogramCount>0,
        nonogramValidateTime=nonogram and validateScore(nonogram,45000)==45000 or false,
        memoryDeckPairs=memory and memoryReplay and memoryReplay.complete==true and memoryReplay.pairs==8,
        memoryValidateTime=memory and validateScore(memory,12000)==12000 or false,
        memoryPreviewConfigured=memory and tonumber(challengeFor(memory,12345).previewMs)==1200 or false,
        colorMatchReplay=colorMatch and colorReplay and colorReplay.complete==true and colorReplay.rounds==10 or false,
        colorMatchValidateTime=colorMatch and validateScore(colorMatch,8000)==8000 or false,
        numberRushReplay=numberRush and numberRushReplay and numberRushReplay.complete==true and numberRushReplay.misses==0 and numberRushReplay.taps==25 or false,
        numberRushValidateTime=numberRush and validateScore(numberRush,10000)==10000 or false,
        highLowReplay=highLow and highLowReplay and highLowReplay.ended==true and highLowReplay.streak==30 or false,
        highLowServerState=highLow and highLowServerOk and highLowState.ended==true and highLowState.streak==30 and #highLowState.history==30 or false,
        highLowActionIdempotent=highLow and highLowState.lastStep==nil,
        highLowValidateStreak=highLow and validateScore(highLow,10)==10 or false,
        simonReplay=simon and simonReplay and simonReplay.ended==true and simonReplay.cleared==5 or false,
        simonServerState=simon and simonServerOk and simonState.ended==true and simonState.cleared==5 or false,
        simonValidateRounds=simon and validateScore(simon,12)==12 or false,
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

function FlecityGamesPlay.DebugCounts()
    local sessionCount=0
    for _ in pairs(sessions) do sessionCount=sessionCount+1 end
    return sessionCount
end

function FlecityGamesPlay.DebugSessionHealth()
    local now=os.time()
    local total,expired,missingGame,invalidSource=0,0,0,0
    for _,session in pairs(sessions) do
        total=total+1
        if now-(tonumber(session.startedAt) or now)>FlecityGamesConfig.Play.SessionMaxAgeSeconds then expired=expired+1 end
        if not gameFor(session.gameId) then missingGame=missingGame+1 end
        if not tonumber(session.source) then invalidSource=invalidSource+1 end
    end
    return {total=total,expired=expired,missingGame=missingGame,invalidSource=invalidSource}
end
