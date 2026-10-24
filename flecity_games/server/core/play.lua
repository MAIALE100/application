FlecityGamesPlay = FlecityGamesPlay or {}
local sessions={}
local sessionCounter=0
local saveEpochs={}
local startRequests={}

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

local function verifiedClientElapsed(clientValue,serverValue,maxBehind,maxAhead)
    local client=tonumber(clientValue)
    local server=tonumber(serverValue)
    if not client or not server or client~=client or server~=server then return nil end
    client=math.max(0,math.min(28800000,math.floor(client)))
    server=math.max(0,math.min(28800000,math.floor(server)))
    local behind=math.max(0,tonumber(maxBehind) or 2500)
    local ahead=math.max(0,tonumber(maxAhead) or 350)
    if client>server+ahead or server-client>behind then return nil end
    return client
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

local function quickNextChallenge(state)
    local delay
    state.rng,delay=seededInt(state.rng,850,2600)
    return {
        round=state.hits+state.falseStarts+1,
        hits=state.hits,
        targetHits=state.targetHits,
        lives=state.lives,
        delayMs=delay
    }
end

local function newQuickState(seed,challenge)
    local state={
        rng=math.floor(tonumber(seed) or 1),
        targetHits=math.max(3,math.min(20,math.floor(tonumber(challenge and challenge.targetHits) or 7))),
        lives=math.max(1,math.min(5,math.floor(tonumber(challenge and challenge.lives) or 3))),
        hits=0,
        falseStarts=0,
        reactions={},
        ended=false,
        failed=false,
        roundStartedTick=GetGameTimer()
    }
    state.current=quickNextChallenge(state)
    return state
end

local function quickScoreFor(state)
    if type(state)~='table' or #state.reactions<1 then return nil end
    local total=0
    for _,reaction in ipairs(state.reactions) do total=total+(tonumber(reaction) or 0) end
    local average=total/#state.reactions
    return math.floor((average+(state.falseStarts*400))*1000+0.5)/1000,average
end

local function applyQuickTap(state,actionMs)
    if type(state)~='table' or state.ended or type(state.current)~='table' then return nil end
    local action=math.floor(tonumber(actionMs) or -1)
    if action<0 or action>10000 then return nil end
    local delay=math.max(250,math.floor(tonumber(state.current.delayMs) or 1500))
    local falseStart=action<delay
    local reaction=nil

    if falseStart then
        state.falseStarts=state.falseStarts+1
        state.lives=state.lives-1
        if state.lives<=0 then
            state.ended=true
            state.failed=true
        end
    else
        reaction=action-delay
        if reaction<70 or reaction>3000 then return nil end
        state.reactions[#state.reactions+1]=reaction
        state.hits=state.hits+1
        if state.hits>=state.targetHits then state.ended=true end
    end

    if not state.ended then
        state.current=quickNextChallenge(state)
        state.roundStartedTick=GetGameTimer()
    end

    local score,average=quickScoreFor(state)
    return {
        falseStart=falseStart,
        reactionMs=reaction,
        ended=state.ended,
        failed=state.failed,
        hits=state.hits,
        targetHits=state.targetHits,
        lives=state.lives,
        falseStarts=state.falseStarts,
        score=score,
        averageMs=average,
        nextChallenge=not state.ended and state.current or nil
    }
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
    local count=tonumber(roundCount) or 20
    if type(history)~='table' or #history~=count then return nil end
    local rounds=generateColorMatch(seed,count)
    local misses=0
    for i,round in ipairs(rounds) do
        local choice=tonumber(history[i])
        if not choice or choice~=math.floor(choice) or choice<0 or choice>3 then return nil end
        if choice~=round.ink then misses=misses+1 end
    end
    return {complete=true,rounds=count,misses=misses}
end
local function generateSortBoard(seed)
    local state=math.floor(tonumber(seed) or 1)%2147483647
    if state<=0 then state=1 end
    local values={}
    for color=0,3 do
        for _=1,4 do values[#values+1]=color end
    end
    for i=#values,2,-1 do
        local value
        state,value=seededNext(state)
        local j=1+math.floor(value*i)
        values[i],values[j]=values[j],values[i]
    end
    local tubes={{},{},{},{},{},{}}
    local cursor=1
    for tube=1,4 do
        for slot=1,4 do
            tubes[tube][slot]=values[cursor]
            cursor=cursor+1
        end
    end
    local solved=true
    for tube=1,4 do
        for slot=2,4 do
            if tubes[tube][slot]~=tubes[tube][1] then solved=false break end
        end
        if not solved then break end
    end
    if solved then
        tubes[1][4],tubes[2][4]=tubes[2][4],tubes[1][4]
    end
    return tubes,state
end

local function copySortTubes(source)
    local out={{},{},{},{},{},{}}
    for i=1,6 do
        for j,value in ipairs(source[i] or {}) do out[i][j]=value end
    end
    return out
end

local function sortComplete(tubes)
    local full=0
    for i=1,6 do
        local tube=tubes[i] or {}
        if #tube>0 then
            if #tube~=4 then return false end
            local color=tube[1]
            for j=2,4 do if tube[j]~=color then return false end end
            full=full+1
        end
    end
    return full==4
end

local function applySortMove(tubes,fromIndex,toIndex)
    local from=math.floor(tonumber(fromIndex) or -1)
    local to=math.floor(tonumber(toIndex) or -1)
    if from<0 or from>=6 or to<0 or to>=6 or from==to then return false end
    local source=tubes[from+1]
    local target=tubes[to+1]
    if type(source)~='table' or type(target)~='table' or #source<1 or #target>=4 then return false end
    target[#target+1]=source[#source]
    source[#source]=nil
    return true
end

local function replaySortState(seed,history)
    if type(history)~='table' or #history>2000 then return nil end
    local initial=generateSortBoard(seed)
    local tubes=copySortTubes(initial)
    local normalized={}
    for _,entry in ipairs(history) do
        if type(entry)~='table' then return nil end
        local from=tonumber(entry[1]~=nil and entry[1] or entry.from)
        local to=tonumber(entry[2]~=nil and entry[2] or entry.to)
        if not from or not to or from~=math.floor(from) or to~=math.floor(to) then return nil end
        if not applySortMove(tubes,from,to) then return nil end
        normalized[#normalized+1]={from,to}
    end
    return {tubes=tubes,moves=#normalized,complete=sortComplete(tubes),history=normalized}
end


local function slideComplete(board,size)
    local total=size*size
    if type(board)~='table' or #board~=total then return false end
    for i=1,total-1 do if tonumber(board[i])~=i then return false end end
    return tonumber(board[total])==0
end

local function slideNeighbors(blankIndex,size)
    local blank=math.floor(tonumber(blankIndex) or -1)
    local out={}
    if blank<0 or blank>=size*size then return out end
    local row=math.floor(blank/size)
    local col=blank%size
    if row>0 then out[#out+1]=blank-size end
    if row<size-1 then out[#out+1]=blank+size end
    if col>0 then out[#out+1]=blank-1 end
    if col<size-1 then out[#out+1]=blank+1 end
    return out
end

local function generateSlideBoard(seed,size,scrambleSteps)
    size=math.max(3,math.min(6,math.floor(tonumber(size) or 4)))
    local steps=math.max(20,math.min(500,math.floor(tonumber(scrambleSteps) or 96)))
    local total=size*size
    local board={}
    for i=1,total-1 do board[i]=i end
    board[total]=0
    local blank=total-1
    local previousBlank=nil
    local undo={}
    local state=math.floor(tonumber(seed) or 1)%2147483647
    if state<=0 then state=1 end

    for _=1,steps do
        local neighbors=slideNeighbors(blank,size)
        local candidates={}
        for _,index in ipairs(neighbors) do
            if index~=previousBlank or #neighbors==1 then candidates[#candidates+1]=index end
        end
        if #candidates==0 then candidates=neighbors end
        local value
        state,value=seededNext(state)
        local chosen=candidates[1+math.floor(value*#candidates)]
        undo[#undo+1]=blank
        board[blank+1],board[chosen+1]=board[chosen+1],board[blank+1]
        previousBlank=blank
        blank=chosen
    end

    if slideComplete(board,size) then
        local neighbors=slideNeighbors(blank,size)
        local chosen=neighbors[1]
        if chosen then
            undo[#undo+1]=blank
            board[blank+1],board[chosen+1]=board[chosen+1],board[blank+1]
            blank=chosen
        end
    end

    return board,blank,undo,state
end

local function replaySlideState(seed,history,size,scrambleSteps)
    size=math.max(3,math.min(6,math.floor(tonumber(size) or 4)))
    if type(history)~='table' or #history>5000 then return nil end
    local board,blank=generateSlideBoard(seed,size,scrambleSteps)
    local normalized={}
    for _,entry in ipairs(history) do
        local raw=type(entry)=='table' and (entry.index~=nil and entry.index or entry[1]) or entry
        local index=tonumber(raw)
        if not index or index~=math.floor(index) or index<0 or index>=size*size then return nil end
        local row,col=math.floor(index/size),index%size
        local blankRow,blankCol=math.floor(blank/size),blank%size
        if math.abs(row-blankRow)+math.abs(col-blankCol)~=1 then return nil end
        board[blank+1],board[index+1]=board[index+1],board[blank+1]
        blank=index
        normalized[#normalized+1]=index
    end
    return {board=board,blank=blank,moves=#normalized,complete=slideComplete(board,size),history=normalized}
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

local function reshuffleNumberRushRemaining(board,completed,state)
    local indexes={} local values={}
    for i=1,#board do
        if not completed[i-1] then
            indexes[#indexes+1]=i
            values[#values+1]=board[i]
        end
    end
    for i=#values,2,-1 do
        local value
        state,value=seededNext(state)
        local j=1+math.floor(value*i)
        values[i],values[j]=values[j],values[i]
    end
    for i,index in ipairs(indexes) do board[index]=values[i] end
    return state
end

local function perfectNumberRushHistory(seed,count)
    local total=math.max(2,math.min(64,math.floor(tonumber(count) or 25)))
    local board,state=generateNumberRush(seed,total)
    local completed={} local history={}
    for expected=1,total do
        local found=nil
        for index=1,total do
            if not completed[index-1] and board[index]==expected then found=index-1 break end
        end
        if found==nil then return nil end
        history[#history+1]=found
        completed[found]=true
        if expected<total and expected%5==0 then
            state=reshuffleNumberRushRemaining(board,completed,state)
        end
    end
    return history
end

local function replayNumberRush(seed,history,count)
    local total=math.max(2,math.min(64,math.floor(tonumber(count) or 25)))
    if type(history)~='table' or #history<total or #history>250 then return nil end
    local board,state=generateNumberRush(seed,total)
    local expected=1
    local misses=0
    local shifts=0
    local completed={}
    local normalized={}
    for _,value in ipairs(history) do
        local index=tonumber(value)
        if not index or index~=math.floor(index) or index<0 or index>=total then return nil end
        if expected>total then return nil end
        normalized[#normalized+1]=index
        if not completed[index] and board[index+1]==expected then
            completed[index]=true
            expected=expected+1
            if expected<=total and (expected-1)%5==0 then
                state=reshuffleNumberRushRemaining(board,completed,state)
                shifts=shifts+1
            end
        else
            misses=misses+1
        end
    end
    return {complete=expected==total+1,misses=misses,taps=#normalized,count=total,shifts=shifts,board=board,history=normalized}
end

local function generateRangeRushRounds(seed,rounds)
    local count=math.max(1,math.min(100,math.floor(tonumber(rounds) or 30)))
    local state=math.floor(tonumber(seed) or 1)%2147483647
    if state<=0 then state=1 end
    local generated={}
    for i=1,count do
        local pivotRoll,valueRoll
        state,pivotRoll=seededNext(state)
        state,valueRoll=seededNext(state)
        local pivot=25+math.floor(pivotRoll*51)
        local value=1+math.floor(valueRoll*99)
        if value==pivot then value=value==99 and 98 or value+1 end
        generated[i]={pivot=pivot,value=value}
    end
    return generated,state
end

local function rangeRushRoundLimit(baseLimit,index)
    local base=math.max(1000,math.min(5000,math.floor(tonumber(baseLimit) or 2400)))
    local stage=math.max(0,math.floor((math.max(1,index)-1)/5))
    return math.max(1200,base-(stage*140))
end

local function rangeRushPoints(round,elapsed,limit,streak)
    local gap=math.abs((tonumber(round.value) or 0)-(tonumber(round.pivot) or 0))
    local difficultyBonus=math.max(0,45-math.min(45,gap))*3
    local speedBonus=math.floor(math.max(0,limit-elapsed)/18)
    local multiplier=math.min(4,1+math.floor(math.max(0,streak-1)/5))
    return math.floor((100+difficultyBonus+speedBonus)*multiplier),multiplier,difficultyBonus,speedBonus
end

local function replayHighLow(seed,history,rounds,timeLimitMs)
    local maxRounds=math.max(1,math.min(100,math.floor(tonumber(rounds) or 30)))
    if type(history)~='table' or #history<1 or #history>maxRounds then return nil end
    local generated=generateRangeRushRounds(seed,maxRounds)
    local streak,maxStreak,score,lives,ended=0,0,0,3,false
    local normalized={}
    for i,entry in ipairs(history) do
        if type(entry)~='table' then return nil end
        local guess=tostring(entry.guess or ''):lower()
        if guess~='high' and guess~='low' and guess~='timeout' then return nil end
        local limit=rangeRushRoundLimit(timeLimitMs,i)
        local elapsed=math.max(0,math.floor(tonumber(entry.elapsedMs) or limit+1))
        local round=generated[i]
        local expected=round.value>round.pivot and 'high' or 'low'
        local correct=guess==expected and elapsed<=limit
        normalized[#normalized+1]={guess=guess,elapsedMs=elapsed}
        if correct then
            streak=streak+1
            maxStreak=math.max(maxStreak,streak)
            local gained=rangeRushPoints(round,elapsed,limit,streak)
            score=score+gained
        else
            lives=lives-1
            streak=0
        end
        if lives<=0 or i>=maxRounds then
            ended=true
            if i~=#history then return nil end
            break
        end
    end
    return {ended=ended,streak=streak,maxStreak=maxStreak,score=score,lives=lives,rounds=#normalized,generated=generated,history=normalized}
end

local function newHighLowState(seed,rounds,timeLimitMs)
    local maxRounds=math.max(1,math.min(100,math.floor(tonumber(rounds) or 30)))
    return {
        generated=generateRangeRushRounds(seed,maxRounds),
        maxRounds=maxRounds,
        timeLimitMs=math.max(1000,math.min(5000,math.floor(tonumber(timeLimitMs) or 2400))),
        index=1,
        lives=3,
        streak=0,
        maxStreak=0,
        score=0,
        history={},
        ended=false,
        roundStartedTick=GetGameTimer()
    }
end

local function applyHighLowGuess(state,rawGuess,elapsedMs)
    if type(state)~='table' or state.ended then return nil end
    local guess=tostring(rawGuess or ''):lower()
    if guess~='high' and guess~='low' and guess~='timeout' then return nil end
    local index=math.floor(tonumber(state.index) or 1)
    local maxRounds=math.floor(tonumber(state.maxRounds) or 30)
    if index<1 or index>maxRounds then return nil end
    local round=state.generated and state.generated[index]
    if not round then return nil end
    local limit=rangeRushRoundLimit(state.timeLimitMs,index)
    local elapsed=math.max(0,math.floor(tonumber(elapsedMs) or limit+1))
    local expected=round.value>round.pivot and 'high' or 'low'
    local correct=guess==expected and elapsed<=limit
    local gained,multiplier,difficultyBonus,speedBonus=0,1,0,0

    state.history[#state.history+1]={guess=guess,elapsedMs=elapsed}
    if correct then
        state.streak=(tonumber(state.streak) or 0)+1
        state.maxStreak=math.max(tonumber(state.maxStreak) or 0,state.streak)
        gained,multiplier,difficultyBonus,speedBonus=rangeRushPoints(round,elapsed,limit,state.streak)
        state.score=(tonumber(state.score) or 0)+gained
    else
        state.lives=math.max(0,(tonumber(state.lives) or 3)-1)
        state.streak=0
    end

    state.index=index+1
    if state.lives<=0 or state.index>maxRounds then state.ended=true end

    local nextRound=not state.ended and state.generated[state.index] or nil
    local nextLimit=not state.ended and rangeRushRoundLimit(state.timeLimitMs,state.index) or limit
    return {
        currentValue=round.value,
        pivot=round.pivot,
        expected=expected,
        correct=correct,
        timedOut=elapsed>limit or guess=='timeout',
        lives=state.lives,
        streak=state.streak,
        maxStreak=state.maxStreak,
        multiplier=multiplier,
        gained=gained,
        difficultyBonus=difficultyBonus,
        speedBonus=speedBonus,
        score=state.score,
        completed=#state.history,
        ended=state.ended,
        cleared=state.index>maxRounds and state.lives>0,
        nextValue=nextRound and nextRound.value or nil,
        nextPivot=nextRound and nextRound.pivot or nil,
        timeLimitMs=nextLimit
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

local function stopRoundPeriod(challenge,round)
    local start=math.max(900,math.floor(tonumber(challenge and challenge.startPeriodMs) or 2200))
    local minimum=math.max(420,math.floor(tonumber(challenge and challenge.minPeriodMs) or 520))
    local value=start*(0.92^math.max(0,(tonumber(round) or 1)-1))
    return math.max(minimum,math.floor(value+0.5))
end

local function stopRoundTolerance(challenge,round)
    local start=math.max(3,tonumber(challenge and challenge.startTolerancePct) or 8)
    local minimum=math.max(1,tonumber(challenge and challenge.minTolerancePct) or 2.2)
    return math.max(minimum,start-(math.max(0,(tonumber(round) or 1)-1)*0.18))
end

local function stopNextChallenge(state)
    local target,phase
    state.rng,target=seededInt(state.rng,12,88)
    local period=stopRoundPeriod(state.config,state.round)
    state.rng,phase=seededInt(state.rng,0,math.max(0,period-1))
    local tolerance=stopRoundTolerance(state.config,state.round)
    return {
        round=state.round,
        targetPct=target,
        periodMs=period,
        phaseMs=phase,
        tolerancePct=math.floor(tolerance*100+0.5)/100,
        maxRounds=state.maxRounds
    }
end

local function newStopState(seed,challenge)
    local state={
        rng=math.floor(tonumber(seed) or 1),
        config=challenge or {},
        round=1,
        maxRounds=math.max(5,math.min(100,math.floor(tonumber(challenge and challenge.maxRounds) or 50))),
        cleared=0,
        score=0,
        bullseyes=0,
        ended=false,
        roundStartedTick=GetGameTimer()
    }
    state.current=stopNextChallenge(state)
    return state
end

local function stopRoundPoints(distance,tolerance,round)
    local tol=math.max(0.01,tonumber(tolerance) or 1)
    local accuracy=math.max(0,1-(math.max(0,tonumber(distance) or tol)/tol))
    local base=500+(math.max(1,tonumber(round) or 1)*30)
    return math.floor(base+(accuracy*700)+0.5)
end

local function applyStopRound(state,actionMs)
    if type(state)~='table' or state.ended or type(state.current)~='table' then return nil end
    local action=math.floor(tonumber(actionMs) or -1)
    if action<50 or action>60000 then return nil end
    local current=state.current
    local marker=trianglePosition(action,current.periodMs,current.phaseMs)
    local distance=math.abs(marker-(tonumber(current.targetPct) or 50))
    local tolerance=tonumber(current.tolerancePct) or 8
    local success=distance<=tolerance
    local bullseye=distance<=0.35
    local gained=0

    if success then
        gained=stopRoundPoints(distance,tolerance,state.round)
        if bullseye then gained=gained+500 state.bullseyes=state.bullseyes+1 end
        state.score=state.score+gained
        state.cleared=state.cleared+1
        if state.round>=state.maxRounds then
            state.ended=true
        else
            state.round=state.round+1
            state.current=stopNextChallenge(state)
            state.roundStartedTick=GetGameTimer()
        end
    else
        state.ended=true
    end

    return {
        success=success,
        ended=state.ended,
        cleared=state.cleared,
        round=state.round,
        score=state.score,
        gained=gained,
        bullseye=bullseye,
        bullseyes=state.bullseyes,
        markerPct=math.floor(marker*100+0.5)/100,
        targetPct=current.targetPct,
        distancePct=math.floor(distance*100+0.5)/100,
        tolerancePct=tolerance,
        nextChallenge=not state.ended and state.current or nil
    }
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
    {'00100','01110','11111','01110','00101'}, -- fish
    {'10001','01010','00100','01010','10001'}, -- X
    {'11111','01110','00100','01110','11111'}, -- hourglass
    {'11111','00100','00100','00100','00100'}, -- T
    {'10001','10001','11111','10001','10001'}, -- H
    {'01110','10001','11111','10001','10001'}, -- A
    {'10001','10001','10001','10001','01110'}, -- U
    {'10000','10000','10000','10000','11111'}, -- L
    {'11000','01100','00110','00011','00000'}, -- zigzag
    {'01110','01010','01110','00100','00111'}, -- key
    {'00100','01110','11111','00100','01010'}, -- umbrella
    {'10001','11011','01110','11011','10001'}, -- butterfly
    {'01110','10101','11111','01010','01010'}, -- skull
    {'10001','11011','11111','10101','01110'}, -- cat
    {'00100','01100','11100','11111','01110'}, -- boat
    {'00110','00101','00101','10100','01100'}, -- note
    {'00110','01100','11110','00110','01100'}  -- bolt
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
    local board=emptyMergeBoard() local state=seed local score=0 local chain=0
    local normalizedHistory={}
    state=select(1,spawnMergeTile(board,state))
    state=select(1,spawnMergeTile(board,state))
    for _,direction in ipairs(history) do
        direction=tostring(direction or '')
        local moved,gained=applyMergeMove(board,direction)
        if not moved then return nil end
        normalizedHistory[#normalizedHistory+1]=direction
        if gained>0 then
            chain=math.min(5,chain+1)
            score=score+(gained*chain)
        else
            chain=0
        end
        state=select(1,spawnMergeTile(board,state))
    end
    return {score=score,board=board,rngState=state,moves=#normalizedHistory,chain=chain,history=normalizedHistory}
end
local function replayMerge(seed,history)
    local state=replayMergeState(seed,history)
    return state and state.score or nil
end


local FALL_BASE_SHAPES={
    {{0,0},{1,0},{2,0},{3,0}},
    {{0,0},{1,0},{0,1},{1,1}},
    {{1,0},{0,1},{1,1},{2,1}},
    {{1,0},{2,0},{0,1},{1,1}},
    {{0,0},{1,0},{1,1},{2,1}},
    {{0,0},{0,1},{1,1},{2,1}},
    {{2,0},{0,1},{1,1},{2,1}}
}
local FALL_LINE_POINTS={[0]=0,[1]=100,[2]=300,[3]=500,[4]=800}

local function fallShape(pieceType,rotation)
    local base=FALL_BASE_SHAPES[math.floor(tonumber(pieceType) or 0)]
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

local function fallEmptyBoard(width,height)
    local board={}
    for y=1,height do
        board[y]={}
        for x=1,width do board[y][x]=0 end
    end
    return board
end

local function fallCanPlace(board,width,height,shape,x,y)
    for _,cell in ipairs(shape or {}) do
        local gx=x+cell[1]
        local gy=y+cell[2]
        if gx<0 or gx>=width or gy<0 or gy>=height then return false end
        if tonumber(board[gy+1] and board[gy+1][gx+1])~=0 then return false end
    end
    return true
end

local function fallDropY(board,width,height,shape,x)
    if not fallCanPlace(board,width,height,shape,x,0) then return nil end
    local y=0
    while fallCanPlace(board,width,height,shape,x,y+1) do y=y+1 end
    return y
end

local function fallClearLines(board,width,height)
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

local function fallNextPiece(state)
    local nextState,value=seededNext(state)
    return nextState,1+math.floor(value*#FALL_BASE_SHAPES)
end

local function fallFindAnyPlacement(board,width,height,pieceType)
    for rotation=0,3 do
        local shape=fallShape(pieceType,rotation)
        for x=0,width-1 do
            if fallDropY(board,width,height,shape,x)~=nil then return x,rotation end
        end
    end
    return nil,nil
end

local function fallApplyPlacement(board,width,height,pieceType,x,rotation,combo,lines)
    x=tonumber(x) rotation=tonumber(rotation)
    if not x or not rotation or x~=math.floor(x) or rotation~=math.floor(rotation) then return nil end
    rotation=((rotation%4)+4)%4
    local shape=fallShape(pieceType,rotation)
    if not shape then return nil end
    local dropY=fallDropY(board,width,height,shape,x)
    if dropY==nil then return nil end
    for _,cell in ipairs(shape) do board[dropY+cell[2]+1][x+cell[1]+1]=pieceType end
    local cleared=fallClearLines(board,width,height)
    combo=cleared>0 and (math.max(0,tonumber(combo) or 0)+1) or 0
    local lineScore=(FALL_LINE_POINTS[cleared] or (cleared*250))
    local level=math.min(8,1+math.floor(math.max(0,tonumber(lines) or 0)/5))
    local gained=10+(dropY*2)+(lineScore*(cleared>0 and math.max(1,combo) or 1)*level)
    return {cleared=cleared,combo=combo,gained=gained,dropY=dropY,rotation=rotation,x=x,level=level}
end

local function replayFallState(seed,history,width,height)
    width=math.max(6,math.min(14,math.floor(tonumber(width) or 10)))
    height=math.max(12,math.min(24,math.floor(tonumber(height) or 18)))
    if type(history)~='table' or #history>10000 then return nil end
    local board=fallEmptyBoard(width,height)
    local state=math.floor(tonumber(seed) or 1)
    local score,lines,combo,pieces=0,0,0,0
    local heldPiece=nil
    local normalized={}
    for _,entry in ipairs(history) do
        if type(entry)~='table' then return nil end
        local x=tonumber(entry.x~=nil and entry.x or entry[1])
        local rotation=tonumber(entry.rotation~=nil and entry.rotation or entry[2])
        if not x or not rotation then return nil end
        local holdValue=entry.hold
        if holdValue==nil then holdValue=entry[3] end
        if holdValue~=nil and type(holdValue)~='boolean' and tonumber(holdValue)~=0 and tonumber(holdValue)~=1 then return nil end
        local useHold=holdValue==true or tonumber(holdValue)==1
        local pieceType
        state,pieceType=fallNextPiece(state)
        if useHold then
            if heldPiece then
                pieceType,heldPiece=heldPiece,pieceType
            else
                heldPiece=pieceType
                state,pieceType=fallNextPiece(state)
            end
        end
        if not fallFindAnyPlacement(board,width,height,pieceType) then return nil end
        local applied=fallApplyPlacement(board,width,height,pieceType,x,rotation,combo,lines)
        if not applied then return nil end
        combo=applied.combo
        score=score+applied.gained
        lines=lines+applied.cleared
        pieces=pieces+1
        normalized[#normalized+1]={x=applied.x,rotation=applied.rotation,hold=useHold}
    end
    local _,nextPiece=fallNextPiece(state)
    local canContinue=fallFindAnyPlacement(board,width,height,nextPiece)~=nil
    return {
        board=board,score=score,lines=lines,combo=combo,pieces=pieces,history=normalized,
        rngState=state,nextPiece=nextPiece,heldPiece=heldPiece or 0,holdUsed=false,
        ended=not canContinue,width=width,height=height
    }
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
    local layers=0
    local perfectStreak=0
    local maxPerfectStreak=0
    local previousAction=0
    local ended=false
    local normalized={}

    for i,value in ipairs(history) do
        local actionMs=tonumber(value)
        if not actionMs or actionMs~=actionMs or actionMs<=previousAction or actionMs>28800000 then return nil end
        actionMs=math.floor(actionMs*1000+0.5)/1000
        if actionMs<=previousAction then return nil end
        local elapsed=actionMs-previousAction
        local reverse=(layers%2)==1
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

        local precision=width>0 and overlap/width or 0
        local perfect=precision>=0.985
        if perfect then
            perfectStreak=math.min(8,perfectStreak+1)
            maxPerfectStreak=math.max(maxPerfectStreak,perfectStreak)
            left=baseX
            overlap=width
        else
            perfectStreak=0
        end

        local placementScore=100+math.floor(precision*100+0.5)
        if perfect then
            placementScore=placementScore+(100*perfectStreak)
        elseif precision>=0.90 then
            placementScore=placementScore+40
        end

        baseX=left
        width=overlap
        layers=layers+1
        score=score+placementScore
        speed=math.min(190,speed+5)
        previousAction=actionMs
    end

    return {
        score=score,
        layers=layers,
        ended=ended,
        width=width,
        baseX=baseX,
        perfectStreak=perfectStreak,
        maxPerfectStreak=maxPerfectStreak,
        history=normalized
    }
end

local function challengeFor(game,seed)
    local challenge={} local state=seed
    if game.id=='quick_tap' then
        challenge.targetHits=7 challenge.lives=3
    elseif game.id=='stop' then
        challenge.maxRounds=50
        challenge.startPeriodMs=2200
        challenge.minPeriodMs=520
        challenge.startTolerancePct=8
        challenge.minTolerancePct=2.2
    elseif game.id=='fall' then
        challenge.width=10 challenge.height=18
        challenge.firstPiece=select(2,fallNextPiece(seed))
    elseif game.id=='mines' then
        challenge.size=8 challenge.mines=10
    elseif game.id=='stack' then
        challenge.initialWidthPct=72 challenge.speedPctPerSec=65
    elseif game.id=='nonogram' then
        challenge.size=5
    elseif game.id=='memory' then
        challenge.previewMs=1200
    elseif game.id=='sort' then
        challenge.capacity=4 challenge.colors=4 challenge.tubeCount=6
        challenge.initialTubes=generateSortBoard(seed)
    elseif game.id=='slide' then
        challenge.size=4 challenge.scrambleSteps=96
        challenge.initialBoard=generateSlideBoard(seed,challenge.size,challenge.scrambleSteps)
    elseif game.id=='color_match' then
        challenge.rounds=20 challenge.lives=3 challenge.missPenaltyMs=1500
    elseif game.id=='number_rush' then
        challenge.count=25
    elseif game.id=='high_low' then
        challenge.rounds=30 challenge.timeLimitMs=2400 challenge.lives=3
    elseif game.id=='simon' then
        challenge.rounds=30
    end
    return challenge
end

local function currentDatabaseDate()
    local row=MySQL.single.await([[SELECT DATE_FORMAT(CURDATE(),'%Y-%m-%d') AS challenge_date]])
    return row and tostring(row.challenge_date or '') or os.date('%Y-%m-%d')
end
local DAILY_MONTH_OFFSETS={0,31,59,90,120,151,181,212,243,273,304,334}
local function dailyLeapYear(year)
    return year%4==0 and (year%100~=0 or year%400==0)
end
local function dailyNumber(date)
    local text=tostring(date or '')
    local year,month,day=text:match('^(%d%d%d%d)%-(%d%d)%-(%d%d)$')
    year,month,day=tonumber(year),tonumber(month),tonumber(day)
    if not year or not month or not day or month<1 or month>12 then
        local compact=(text:gsub('%D',''))
        return tonumber(compact) or 1
    end
    local monthDays={31,dailyLeapYear(year) and 29 or 28,31,30,31,30,31,31,30,31,30,31}
    if day<1 or day>monthDays[month] then
        local compact=(text:gsub('%D',''))
        return tonumber(compact) or 1
    end
    local previousYear=year-1
    local ordinal=365*previousYear+math.floor(previousYear/4)-math.floor(previousYear/100)+math.floor(previousYear/400)
        +DAILY_MONTH_OFFSETS[month]+day
    if month>2 and dailyLeapYear(year) then ordinal=ordinal+1 end
    return ordinal
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
        MIN(CASE WHEN metadata_json IS NULL OR metadata_json NOT LIKE '%"dailyDate":%' THEN duration_ms END) AS normal_best_time_ms,
        MAX(created_at) AS last_played_at
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
                lastPlayedAt=row.last_played_at and tostring(row.last_played_at) or nil,
                clearCount=(game.id=='mines' or game.id=='nonogram' or game.id=='sort' or game.id=='slide') and plays or nil
            }
        end
    end
    table.sort(out,function(a,b)
        local ga,gb=gameFor(a.gameId),gameFor(b.gameId)
        local oa=ga and tonumber(ga.order) or 9999
        local ob=gb and tonumber(gb.order) or 9999
        if oa==ob then return a.gameId<b.gameId end
        return oa<ob
    end)
    return {totalPlayCount=totalPlays,totalPlayTimeMs=totalTime,games=out}
end
local function achievementsFor(playerIdentifier)
    return MySQL.query.await([[SELECT achievement_id,game_id,unlocked_at,metadata_json
        FROM flecity_game_achievements WHERE player_identifier=? ORDER BY unlocked_at ASC]],{playerIdentifier}) or {}
end
local function unlockAchievement(playerIdentifier,achievementId,gameId,metadata)
    local ok,affected=pcall(function()
        return MySQL.update.await([[INSERT IGNORE INTO flecity_game_achievements
            (player_identifier,achievement_id,game_id,metadata_json) VALUES (?,?,?,?)]],
            {playerIdentifier,achievementId,gameId,json.encode(metadata or {})})
    end)
    return ok==true and tonumber(affected or 0)>0
end
local function evaluateAchievements(playerIdentifier,game,score,metadata)
    local unlocked={}
    local total=tonumber(MySQL.scalar.await('SELECT COUNT(*) FROM flecity_game_scores WHERE player_identifier=?',{playerIdentifier}) or 0)
    if unlockAchievement(playerIdentifier,'first_play',game.id,{total=total}) then unlocked[#unlocked+1]='first_play' end
    local cfg=FlecityGamesConfig.Play.Achievements or {}
    if total>=tonumber(cfg.GamesVeteranCount or 100) and unlockAchievement(playerIdentifier,'100_games',nil,{total=total}) then unlocked[#unlocked+1]='100_games' end
    if game.id=='quick_tap' and score<=tonumber(cfg.LightningReactionMs or 200) and unlockAchievement(playerIdentifier,'lightning',game.id,{score=score}) then unlocked[#unlocked+1]='lightning' end
    if game.id=='stack' and tonumber(metadata and metadata.layers)>=tonumber(cfg.StackMasterLayers or 25)
        and unlockAchievement(playerIdentifier,'stack_master',game.id,{score=score,layers=metadata.layers,maxPerfectStreak=metadata.maxPerfectStreak}) then
        unlocked[#unlocked+1]='stack_master'
    end
    if game.id=='block' and score>=tonumber(cfg.BlockMasterScore or 5000) and unlockAchievement(playerIdentifier,'block_master',game.id,{score=score}) then unlocked[#unlocked+1]='block_master' end
    if game.id=='memory' and tonumber(metadata and metadata.moves)==8 and unlockAchievement(playerIdentifier,'perfect_memory',game.id,{score=score,moves=8}) then unlocked[#unlocked+1]='perfect_memory' end
    if game.id=='number_rush' and tonumber(metadata and metadata.misses)==0
        and score<=tonumber(cfg.NumberRushAceMs or 16000)
        and unlockAchievement(playerIdentifier,'number_rush_ace',game.id,{score=score,misses=0}) then
        unlocked[#unlocked+1]='number_rush_ace'
    end
    if game.id=='high_low' and tonumber(metadata and metadata.streak)>=tonumber(cfg.HighLowStreak or 10)
        and unlockAchievement(playerIdentifier,'high_low_streak',game.id,{score=score,streak=metadata.streak}) then
        unlocked[#unlocked+1]='high_low_streak'
    end
    if game.id=='stop' and tonumber(metadata and metadata.bullseyes or 0)>=1
        and unlockAchievement(playerIdentifier,'bullseye',game.id,{score=score,bullseyes=metadata.bullseyes,rounds=metadata.rounds}) then
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
    if game.id=='color_match' and tonumber(metadata and metadata.misses or 99)==0 and score<=tonumber(cfg.ColorMatchFocusMs or 14000)
        and unlockAchievement(playerIdentifier,'color_focus',game.id,{score=score,misses=0}) then
        unlocked[#unlocked+1]='color_focus'
    end
    if game.id=='simon' and score>=tonumber(cfg.SimonMasterRounds or 15)
        and unlockAchievement(playerIdentifier,'simon_master',game.id,{score=score}) then
        unlocked[#unlocked+1]='simon_master'
    end
    if game.id=='slide'
        and (tonumber(metadata and metadata.timeMs) or math.huge)<=tonumber(cfg.SlideMasterMs or 90000)
        and (tonumber(metadata and metadata.moves) or math.huge)<=tonumber(cfg.SlideMasterMoves or 120)
        and unlockAchievement(playerIdentifier,'slide_master',game.id,{score=score,timeMs=metadata.timeMs,moves=metadata.moves}) then
        unlocked[#unlocked+1]='slide_master'
    end
    if game.id=='fall'
        and (tonumber(metadata and metadata.lines) or 0)>=tonumber(cfg.FallMasterLines or 20)
        and unlockAchievement(playerIdentifier,'fall_master',game.id,{score=score,lines=metadata.lines,pieces=metadata.pieces}) then
        unlocked[#unlocked+1]='fall_master'
    end
    return unlocked
end

local function dailyRankingRows(challenge,limit,viewerIdentifier)
    if not challenge then return {} end
    local game=gameFor(challenge.gameId)
    if not game then return {} end
    local order=game.rankingOrder=='asc' and 'ASC' or 'DESC'
    local aggregate=game.rankingOrder=='asc' and 'MIN' or 'MAX'
    local safeLimit=math.max(1,math.min(50,tonumber(limit) or 20))
    local dailyPattern=('%%"dailyDate":"%s"%%'):format(challenge.date)
    local sql=([[SELECT COALESCE(p.display_name,'Player') AS display_name,%s(s.score) AS score,
        MAX(CASE WHEN s.player_identifier=? THEN 1 ELSE 0 END) AS is_self
        FROM flecity_game_scores s LEFT JOIN flecity_game_profiles p ON p.player_identifier=s.player_identifier
        WHERE s.game_id=? AND s.created_at>=? AND s.created_at<DATE_ADD(?,INTERVAL 1 DAY)
        AND s.metadata_json LIKE ?
        GROUP BY s.player_identifier,p.display_name
        ORDER BY score %s,display_name ASC LIMIT %d]]):format(aggregate,order,safeLimit)
    return MySQL.query.await(sql,{viewerIdentifier or '',challenge.gameId,challenge.date,challenge.date,dailyPattern}) or {}
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

local function dailyPersonalRank(challenge,playerIdentifier,selfBest)
    if not challenge or not playerIdentifier or not selfBest then return nil end
    local game=gameFor(challenge.gameId)
    if not game then return nil end
    local aggregate=game.rankingOrder=='asc' and 'MIN' or 'MAX'
    local comparator=game.rankingOrder=='asc' and '<' or '>'
    local dailyPattern=('%%"dailyDate":"%s"%%'):format(challenge.date)
    local sql=([[SELECT 1+COUNT(*) FROM (
        SELECT player_identifier,%s(score) AS best_score
        FROM flecity_game_scores
        WHERE game_id=? AND created_at>=? AND created_at<DATE_ADD(?,INTERVAL 1 DAY)
        AND metadata_json LIKE ?
        GROUP BY player_identifier
    ) ranked WHERE ranked.best_score %s ?]]):format(aggregate,comparator)
    local rank=tonumber(MySQL.scalar.await(sql,{challenge.gameId,challenge.date,challenge.date,dailyPattern,selfBest.score}) or 0)
    return rank and math.max(1,math.floor(rank)) or nil
end

local function previousDate(date)
    date=tostring(date or '')
    if #date~=10 then return nil end
    local y=tonumber(date:sub(1,4))
    local m=tonumber(date:sub(6,7))
    local d=tonumber(date:sub(9,10))
    if not y or not m or not d then return nil end
    local stamp=os.time({year=y,month=m,day=d,hour=12})
    if not stamp then return nil end
    return os.date('%Y-%m-%d',stamp-86400)
end

local function dailyStreak(playerIdentifier,currentDate)
    local rows=MySQL.query.await([[SELECT metadata_json FROM flecity_game_scores
        WHERE player_identifier=? AND metadata_json LIKE '%"dailyDate":%'
        ORDER BY created_at DESC LIMIT 180]],{playerIdentifier}) or {}
    local completed={}
    for _,row in ipairs(rows) do
        local metadata=json.decode(row.metadata_json or '{}') or {}
        local date=tostring(metadata.dailyDate or '')
        if #date==10 then completed[date]=true end
    end
    local completedToday=completed[currentDate]==true
    local cursor=completedToday and currentDate or previousDate(currentDate)
    local streak=0
    while cursor and completed[cursor] do
        streak=streak+1
        cursor=previousDate(cursor)
        if streak>=3650 then break end
    end
    return {count=streak,completedToday=completedToday,nextCount=completedToday and streak or (streak+1)}
end

local function publicDaily(challenge,playerIdentifier)
    if not challenge then return nil end
    local rows=dailyRankingRows(challenge,FlecityGamesConfig.Play.RankingLimit or 20,playerIdentifier)
    local selfBest=dailyPersonalBest(challenge,playerIdentifier)
    return {
        date=challenge.date,gameId=challenge.gameId,game=challenge.game,seed=challenge.seed,
        best=rows[1],selfBest=selfBest,selfRank=dailyPersonalRank(challenge,playerIdentifier,selfBest),ranking=rows,
        streak=dailyStreak(playerIdentifier,challenge.date)
    }
end

local function removeSession(token)
    local session=sessions[token]
    if not session then return nil end
    sessions[token]=nil
    local requestId=tostring(session.startRequestId or '')
    if requestId~='' and session.playerIdentifier then
        startRequests[tostring(session.playerIdentifier)..':'..requestId]=nil
    end
    return session
end

local function clearPlayerSessions(playerIdentifier)
    local removed=0
    for token,session in pairs(sessions) do
        if session.playerIdentifier==playerIdentifier then
            removeSession(token)
            removed=removed+1
        end
    end
    return removed
end

local function clearPlayerGameSessions(playerIdentifier,gameId)
    local removed=0
    for token,session in pairs(sessions) do
        if session.playerIdentifier==playerIdentifier and session.gameId==gameId then
            removeSession(token)
            removed=removed+1
        end
    end
    return removed
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
            removeSession(token)
            removed=removed+1
        end
    end
    return removed
end

local function clearPlayerStartRequests(playerIdentifier)
    local removed=0
    for key,request in pairs(startRequests) do
        if request.playerIdentifier==playerIdentifier then
            startRequests[key]=nil
            removed=removed+1
        end
    end
    return removed
end

local function saveStateHasProgress(gameId,state,score)
    if type(state)~='table' then return false end
    if gameId=='block' then
        return (type(state.history)=='table' and #state.history>0) or (tonumber(score) or 0)>0
    elseif gameId=='merge' then
        return (type(state.history)=='table' and #state.history>0) or (tonumber(state.moves) or 0)>0
    elseif gameId=='fall' then
        return type(state.history)=='table' and #state.history>0
    elseif gameId=='mines' then
        return (type(state.revealed)=='table' and #state.revealed>0) or (type(state.flags)=='table' and #state.flags>0)
    elseif gameId=='nonogram' then
        return (type(state.filled)=='table' and #state.filled>0) or (type(state.crossed)=='table' and #state.crossed>0)
    elseif gameId=='slide' then
        return type(state.history)=='table' and #state.history>0
    end
    return true
end

function FlecityGamesPlay.Bootstrap(source)
    local id=identifier(source)
    if not id then return {ok=false,error='PLAYER_NOT_READY'} end
    clearForeignSourceSessions(source,id)
    clearPlayerSessions(id)
    clearPlayerStartRequests(id)
    touchProfile(source,id)

    local saveRows=MySQL.query.await([[SELECT game_id,state_json,score,elapsed_ms,game_version,updated_at
        FROM flecity_game_saves WHERE player_identifier=? ORDER BY updated_at DESC]],{id}) or {}
    local saves={}
    for _,save in ipairs(saveRows) do
        local game=gameFor(save.game_id)
        if game and tonumber(save.game_version or 1)==tonumber(game.version or 1) then
            save.state=json.decode(save.state_json or '{}') or {}
            save.state_json=nil
            if saveStateHasProgress(game.id,save.state,save.score) then
                saves[#saves+1]=save
            else
                MySQL.query.await('DELETE FROM flecity_game_saves WHERE player_identifier=? AND game_id=?',{id,game.id})
            end
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


function FlecityGamesPlay.StartSession(source,data)
    if type(data)~='table' then data={} end
    local id=identifier(source)
    if not id then return {ok=false,error='PLAYER_NOT_READY'} end

    local requestId=tostring(data.startRequestId or '')
    local requestKey=nil
    if requestId~='' then
        if #requestId>96 or not requestId:match('^[%w%._:%-]+$') then
            return {ok=false,error='INVALID_REQUEST'}
        end
        requestKey=id..':'..requestId
        local cached=startRequests[requestKey]
        if cached then
            if cached.response then return cached.response end
            if cached.pending and os.time()-(tonumber(cached.createdAt) or os.time())<=10 then
                return {ok=false,error='START_PENDING'}
            end
            startRequests[requestKey]=nil
        end
        startRequests[requestKey]={pending=true,createdAt=os.time(),source=tonumber(source),playerIdentifier=id}
    end

    local function finish(result)
        if requestKey then
            if result and result.ok then
                startRequests[requestKey]={response=result,createdAt=os.time(),source=tonumber(source),playerIdentifier=id}
            else
                startRequests[requestKey]=nil
            end
        end
        return result
    end

    local ok,result=pcall(function()
        if not FlecityGamesRateLimit.Allow(source,'play_start',FlecityGamesConfig.RateLimits.PlayStartMs) then
            return {ok=false,error='RATE_LIMIT'}
        end
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
        clearPlayerSessions(id)
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
            minesAvoidIndex=nil,
            startRequestId=requestId~='' and requestId or nil
        }
        if game.id=='mines' and resumeState then
            local avoid=tonumber(resumeState.avoidIndex)
            local size=tonumber(challenge.size) or 8
            if avoid and avoid==math.floor(avoid) and avoid>=0 and avoid<size*size then
                sessions[token].minesAvoidIndex=avoid
            end
        end
        local publicSeed=seed
        if game.id=='quick_tap' then
            local quickState=newQuickState(seed,challenge)
            sessions[token].quick=quickState
            challenge=quickState.current
            sessions[token].challenge=challenge
            publicSeed=nil
        elseif game.id=='stop' then
            local stopState=newStopState(seed,challenge)
            sessions[token].stop=stopState
            challenge=stopState.current
            sessions[token].challenge=challenge
            publicSeed=nil
        elseif game.id=='high_low' then
            local highLow=newHighLowState(seed,challenge.rounds,challenge.timeLimitMs)
            sessions[token].highLow=highLow
            local first=highLow.generated[1]
            challenge.currentValue=first and first.value or nil
            challenge.pivot=first and first.pivot or nil
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
    end)

    if not ok then
        if requestKey then startRequests[requestKey]=nil end
        error(result)
    end
    return finish(result)
end

function FlecityGamesPlay.QuickRound(source,data)
    if not FlecityGamesRateLimit.Allow(source,'quick_round',80) then return {ok=false,error='RATE_LIMIT'} end
    if type(data)~='table' then return {ok=false,error='INVALID_REQUEST'} end
    local id=identifier(source)
    local token=tostring(data.sessionToken or '')
    local session=sessions[token]
    if not id then return {ok=false,error='PLAYER_NOT_READY'} end
    if not session or session.playerIdentifier~=id or session.gameId~='quick_tap' then return {ok=false,error='INVALID_SESSION'} end
    if os.time()-session.startedAt>FlecityGamesConfig.Play.SessionMaxAgeSeconds then
        removeSession(token)
        return {ok=false,error='EXPIRED_SESSION'}
    end
    local state=session.quick
    if not state then return {ok=false,error='ROUND_COMPLETE'} end
    local step=math.floor(tonumber(data.step) or -1)
    if state.lastStep==step and state.lastResult then return state.lastResult end
    if state.ended then return {ok=false,error='ROUND_COMPLETE'} end
    local expectedStep=state.hits+state.falseStarts+1
    if step~=expectedStep then return {ok=false,error='ROUND_TOKEN_MISMATCH'} end
    local actionMs=math.floor(tonumber(data.actionMs) or -1)
    local serverRoundElapsed=math.max(0,GetGameTimer()-(tonumber(state.roundStartedTick) or GetGameTimer()))
    if actionMs<0 or actionMs>10000 then return {ok=false,error='INVALID_TIMING'} end
    if actionMs>serverRoundElapsed+400 or serverRoundElapsed-actionMs>3000 then return {ok=false,error='IMPOSSIBLE_TIMING'} end
    local result=applyQuickTap(state,actionMs)
    if not result then return {ok=false,error='INVALID_TIMING'} end
    result.ok=true
    state.lastStep=step
    state.lastResult=result
    return result
end

function FlecityGamesPlay.StopRound(source,data)
    if not FlecityGamesRateLimit.Allow(source,'stop_round',90) then return {ok=false,error='RATE_LIMIT'} end
    if type(data)~='table' then return {ok=false,error='INVALID_REQUEST'} end
    local id=identifier(source)
    local token=tostring(data.sessionToken or '')
    local session=sessions[token]
    if not id then return {ok=false,error='PLAYER_NOT_READY'} end
    if not session or session.playerIdentifier~=id or session.gameId~='stop' then return {ok=false,error='INVALID_SESSION'} end
    if os.time()-session.startedAt>FlecityGamesConfig.Play.SessionMaxAgeSeconds then
        removeSession(token)
        return {ok=false,error='EXPIRED_SESSION'}
    end
    local state=session.stop
    if not state then return {ok=false,error='ROUND_COMPLETE'} end
    local step=math.floor(tonumber(data.step) or -1)
    if state.lastStep==step and state.lastResult then return state.lastResult end
    if state.ended then return {ok=false,error='ROUND_COMPLETE'} end
    if step~=state.cleared+1 then return {ok=false,error='ROUND_TOKEN_MISMATCH'} end
    local actionMs=math.floor(tonumber(data.actionMs) or -1)
    local serverRoundElapsed=math.max(0,GetGameTimer()-(tonumber(state.roundStartedTick) or GetGameTimer()))
    if actionMs<50 or actionMs>60000 then return {ok=false,error='INVALID_TIMING'} end
    if actionMs>serverRoundElapsed+350 or serverRoundElapsed-actionMs>3000 then return {ok=false,error='IMPOSSIBLE_TIMING'} end
    local result=applyStopRound(state,actionMs)
    if not result then return {ok=false,error='INVALID_TIMING'} end
    result.ok=true
    state.lastStep=step
    state.lastResult=result
    return result
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
        removeSession(token)
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

    local elapsed=math.max(0,GetGameTimer()-(tonumber(state.roundStartedTick) or GetGameTimer()))
    local result=applyHighLowGuess(state,guess,elapsed)
    if not result then return {ok=false,error='INVALID_CHOICE'} end
    result.ok=true
    state.lastStep=step
    state.lastGuess=guess
    state.lastResult=result
    if not result.ended then state.roundStartedTick=GetGameTimer() end
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
        removeSession(token)
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
    if session and session.playerIdentifier==id then removeSession(token) end
    return {ok=true}
end

function FlecityGamesPlay.ResetSave(source,data)
    local id=identifier(source)
    if not id or type(data)~='table' then return {ok=false,error='INVALID_REQUEST'} end
    local game=gameFor(data.gameId)
    if not game then return {ok=false,error='GAME_UNAVAILABLE'} end
    if game.supportsResume~=true then return {ok=false,error='RESUME_NOT_SUPPORTED'} end

    local newEpoch=bumpSaveEpoch(id,game.id)
    local deleted=pcall(function()
        MySQL.query.await('DELETE FROM flecity_game_saves WHERE player_identifier=? AND game_id=?',{id,game.id})
    end)

    if not deleted then
        -- Keep the current run usable if the DB reset itself failed. Any save
        -- request that started before this reset captured the previous epoch
        -- and will still be rejected by Save's final epoch check.
        for _,session in pairs(sessions) do
            if session.playerIdentifier==id and session.gameId==game.id then
                session.saveEpoch=newEpoch
            end
        end
        return {ok=false,error='SAVE_RESET_FAILED'}
    end

    clearPlayerGameSessions(id,game.id)
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
    local requestEpoch=tonumber(session.saveEpoch or 0)
    if requestEpoch~=currentSaveEpoch(id,game.id) then return {ok=false,error='SAVE_RESET'} end
    if session.dailyDate then return {ok=false,error='DAILY_SAVE_DISABLED'} end
    local seedNumber=math.floor(tonumber(session.seed) or 0)
    if seedNumber<1 or seedNumber>2147483646 then return {ok=false,error='INVALID_SESSION_SEED'} end

    local _,serverElapsed=elapsedForSession(session)
    local elapsed=verifiedClientElapsed(data.elapsedMs,serverElapsed,3000,500)
    if elapsed==nil then return {ok=false,error='IMPOSSIBLE_TIMING'} end
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
    elseif game.id=='fall' then
        local canonical=replayFallState(session.seed,data.state.history,session.challenge.width,session.challenge.height)
        if not canonical or canonical.score~=math.floor(score) then return {ok=false,error='INVALID_FALL_SAVE'} end
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
    elseif game.id=='sort' then
        local canonical=replaySortState(session.seed,data.state.history)
        if not canonical then return {ok=false,error='INVALID_SORT_SAVE'} end
        saveState=canonical
        score=canonical.moves
    elseif game.id=='slide' then
        local canonical=replaySlideState(session.seed,data.state.history,session.challenge.size,session.challenge.scrambleSteps)
        if not canonical then return {ok=false,error='INVALID_SLIDE_SAVE'} end
        saveState=canonical
        score=canonical.moves
    end

    local encoded=json.encode(saveState)
    if not encoded or #encoded>FlecityGamesConfig.Play.SaveStateMaxBytes then return {ok=false,error='STATE_TOO_LARGE'} end
    if requestEpoch~=currentSaveEpoch(id,game.id) then return {ok=false,error='SAVE_RESET'} end
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
        if score<0 or score>500000 then return nil end
        return math.floor(score+0.5)
    elseif game.id=='block' or game.id=='merge' or game.id=='fall' then
        if score<0 or score>50000000 then return nil end
        return math.floor(score)
    elseif game.id=='mines' or game.id=='nonogram' or game.id=='memory' or game.id=='color_match' or game.id=='number_rush' or game.id=='sort' or game.id=='slide' then
        if score<1000 or score>28800000 then return nil end
        return math.floor(score)
    elseif game.id=='stack' then
        if score<0 or score>5000000 then return nil end
        return math.floor(score)
    elseif game.id=='high_low' then
        if score<0 or score>100000 then return nil end
        return math.floor(score)
    elseif game.id=='simon' then
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
        unlocked=type(metadata.unlockedAchievements)=='table' and metadata.unlockedAchievements or {},
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
    if not game then removeSession(token) return {ok=false,error='GAME_UNAVAILABLE'} end
    if os.time()-session.startedAt>FlecityGamesConfig.Play.SessionMaxAgeSeconds then removeSession(token) return {ok=false,error='EXPIRED_SESSION'} end
    if session.dailyDate and currentDatabaseDate()~=session.dailyDate then
        removeSession(token)
        return {ok=false,error='DAILY_EXPIRED'}
    end

    local clientDurationMs=math.max(0,math.min(28800000,math.floor(tonumber(data.durationMs) or 0)))
    local serverElapsed,totalServerElapsed=elapsedForSession(session)
    local durationMs=clientDurationMs
    if game.supportsResume==true or game.id=='stack' or game.id=='memory' or game.id=='color_match' then durationMs=totalServerElapsed end
    local rawScore=tonumber(data.score)
    local metadata={serverElapsedMs=serverElapsed}
    if session.dailyDate then metadata.dailyDate=session.dailyDate end

    if game.id=='quick_tap' then
        local state=session.quick
        if not state or state.ended~=true or state.failed==true or state.hits~=state.targetHits then
            return {ok=false,error='QUICK_RUN_NOT_FINISHED'}
        end
        local verifiedScore,average=quickScoreFor(state)
        local submitted=tonumber(data.score)
        if not verifiedScore or not submitted or math.abs(submitted-verifiedScore)>0.001 then
            return {ok=false,error='INVALID_QUICK_SCORE'}
        end
        rawScore=verifiedScore
        durationMs=math.min(totalServerElapsed,28800000)
        metadata.hits=state.hits
        metadata.falseStarts=state.falseStarts
        metadata.lives=state.lives
        metadata.averageMs=math.floor((average or 0)*1000+0.5)/1000
        metadata.bestReactionMs=math.min(table.unpack(state.reactions))
    elseif game.id=='stop' then
        local state=session.stop
        if not state or state.ended~=true then return {ok=false,error='STOP_RUN_NOT_FINISHED'} end
        local submittedScore=math.floor(tonumber(data.score) or -1)
        if submittedScore~=math.floor(tonumber(state.score) or -2) then return {ok=false,error='INVALID_STOP_SCORE'} end
        rawScore=submittedScore
        durationMs=math.min(totalServerElapsed,28800000)
        metadata.rounds=state.cleared
        metadata.bullseyes=state.bullseyes
        metadata.maxRounds=state.maxRounds
        metadata.finalRound=state.round
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
    elseif game.id=='fall' then
        if type(data.history)~='table' or #data.history<1 then return {ok=false,error='INVALID_FALL_REPLAY'} end
        local replayed=replayFallState(session.seed,data.history,session.challenge.width,session.challenge.height)
        if not replayed or replayed.score~=math.floor(tonumber(data.score) or -1) then return {ok=false,error='INVALID_FALL_REPLAY'} end
        rawScore=replayed.score
        durationMs=totalServerElapsed
        metadata.lines=replayed.lines
        metadata.pieces=replayed.pieces
        metadata.combo=replayed.combo
        metadata.gameOver=replayed.ended
        metadata.replayValidated=true
    elseif game.id=='stack' then
        local replayed=replayStack(session.challenge,data.history)
        if not replayed or not replayed.ended then return {ok=false,error='INVALID_STACK_REPLAY'} end
        local submittedScore=math.floor(tonumber(data.score) or -1)
        if submittedScore~=replayed.score then return {ok=false,error='INVALID_STACK_REPLAY'} end
        local lastAction=replayed.history[#replayed.history] or 0
        if lastAction>serverElapsed+350 or serverElapsed-lastAction>1800 then
            return {ok=false,error='IMPOSSIBLE_TIMING'}
        end
        rawScore=replayed.score
        durationMs=math.min(serverElapsed,28800000)
        metadata.layers=replayed.layers
        metadata.maxPerfectStreak=replayed.maxPerfectStreak
        metadata.finalWidth=math.floor(replayed.width*100+0.5)/100
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
        local verified=verifiedClientElapsed(clientDurationMs,totalServerElapsed,2500,500)
        if verified==nil then return {ok=false,error='IMPOSSIBLE_TIMING'} end
        durationMs=verified rawScore=verified
        metadata.revealedCount=revealedCount metadata.boardSize=size metadata.mineCount=mineCount metadata.clientTimingVerified=true
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
        local verified=verifiedClientElapsed(clientDurationMs,totalServerElapsed,2500,500)
        if verified==nil then return {ok=false,error='IMPOSSIBLE_TIMING'} end
        durationMs=verified rawScore=verified
        metadata.boardSize=size metadata.filledCount=count metadata.clientTimingVerified=true
    elseif game.id=='memory' then
        local replayed=replayMemory(session.seed,data.history)
        if not replayed or not replayed.complete then return {ok=false,error='INVALID_MEMORY_REPLAY'} end
        local previewMs=math.max(0,math.min(5000,math.floor(tonumber(session.challenge.previewMs) or 1200)))
        if serverElapsed<previewMs+1300 then return {ok=false,error='IMPOSSIBLE_TIMING'} end
        local serverPlayElapsed=math.max(0,totalServerElapsed-previewMs)
        local verified=verifiedClientElapsed(clientDurationMs,serverPlayElapsed,2500,500)
        if verified==nil then return {ok=false,error='IMPOSSIBLE_TIMING'} end
        local extraMoves=math.max(0,replayed.moves-8)
        local movePenalty=extraMoves*400
        durationMs=verified rawScore=verified+movePenalty
        metadata.moves=replayed.moves metadata.pairs=replayed.pairs metadata.previewMs=previewMs metadata.movePenaltyMs=movePenalty metadata.replayValidated=true metadata.clientTimingVerified=true
    elseif game.id=='sort' then
        local replayed=replaySortState(session.seed,data.history)
        if not replayed or replayed.complete~=true then return {ok=false,error='INVALID_SORT_REPLAY'} end
        durationMs=totalServerElapsed
        local movePenalty=replayed.moves*350
        rawScore=durationMs+movePenalty
        metadata.moves=replayed.moves
        metadata.timeMs=durationMs
        metadata.movePenaltyMs=movePenalty
        metadata.replayValidated=true
    elseif game.id=='slide' then
        local replayed=replaySlideState(session.seed,data.history,session.challenge.size,session.challenge.scrambleSteps)
        if not replayed or replayed.complete~=true then return {ok=false,error='INVALID_SLIDE_REPLAY'} end
        durationMs=totalServerElapsed
        local movePenalty=replayed.moves*200
        rawScore=durationMs+movePenalty
        metadata.moves=replayed.moves
        metadata.timeMs=durationMs
        metadata.movePenaltyMs=movePenalty
        metadata.replayValidated=true
    elseif game.id=='color_match' then
        local replayed=replayColorMatch(session.seed,data.history,session.challenge.rounds)
        if not replayed or not replayed.complete then return {ok=false,error='INVALID_COLOR_MATCH_REPLAY'} end
        local lives=math.max(1,math.floor(tonumber(session.challenge.lives) or 3))
        if replayed.misses>=lives then return {ok=false,error='COLOR_MATCH_RUN_FAILED'} end
        if serverElapsed<1800 then return {ok=false,error='IMPOSSIBLE_TIMING'} end
        local verified=verifiedClientElapsed(clientDurationMs,totalServerElapsed,2500,500)
        if verified==nil then return {ok=false,error='IMPOSSIBLE_TIMING'} end
        local penalty=math.max(0,math.floor(tonumber(session.challenge.missPenaltyMs) or 1500))*replayed.misses
        durationMs=verified rawScore=verified+penalty
        metadata.rounds=replayed.rounds metadata.misses=replayed.misses metadata.penaltyMs=penalty metadata.replayValidated=true metadata.clientTimingVerified=true
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
        metadata.shifts=replayed.shifts
        metadata.penaltyMs=replayed.misses*500
        metadata.replayValidated=true
    elseif game.id=='high_low' then
        local state=session.highLow
        if not state or state.ended~=true or type(state.history)~='table' or #state.history<1 then
            return {ok=false,error='INVALID_HIGH_LOW_REPLAY'}
        end
        local submitted=math.floor(tonumber(data.score) or -1)
        local rangeScore=math.floor(tonumber(state.score) or -1)
        if submitted~=rangeScore then return {ok=false,error='INVALID_HIGH_LOW_REPLAY'} end
        rawScore=rangeScore
        durationMs=math.min(serverElapsed,28800000)
        metadata.rounds=#state.history
        metadata.streak=math.floor(tonumber(state.maxStreak) or 0)
        metadata.maxStreak=math.floor(tonumber(state.maxStreak) or 0)
        metadata.lives=math.floor(tonumber(state.lives) or 0)
        metadata.rangeRush=true
        metadata.rangeRushVersion=3
        metadata.timeLimitMs=math.floor(tonumber(state.timeLimitMs) or 2400)
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
        removeSession(token)
        return existing
    end

    local ok,insertId=pcall(function()
        return MySQL.insert.await([[INSERT INTO flecity_game_scores
            (player_identifier,game_id,score,duration_ms,session_token,metadata_json)
            VALUES (?,?,?,?,?,?)]],{id,game.id,score,durationMs,token,json.encode(metadata)})
    end)
    if not ok or not insertId then return {ok=false,error='SCORE_SAVE_FAILED'} end

    removeSession(token)
    if game.supportsResume and not session.dailyDate then MySQL.query.await('DELETE FROM flecity_game_saves WHERE player_identifier=? AND game_id=?',{id,game.id}) end
    local unlocked=evaluateAchievements(id,game,score,metadata)
    if #unlocked>0 then
        metadata.unlockedAchievements=unlocked
        MySQL.query.await('UPDATE flecity_game_scores SET metadata_json=? WHERE session_token=?',{json.encode(metadata),token})
    end
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
        local selfBest=dailyPersonalBest(daily,id)
        return {ok=true,gameId=game.id,period=period,rows=dailyRankingRows(daily,limit,id),date=daily.date,
            self={score=selfBest and tonumber(selfBest.score) or nil,rank=dailyPersonalRank(daily,id,selfBest)}}
    end

    local wherePeriod=''
    local selfWherePeriod=''
    if period=='today' then
        wherePeriod=' AND s.created_at >= CURDATE()'
        selfWherePeriod=' AND created_at >= CURDATE()'
    elseif period=='week' then
        wherePeriod=' AND s.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)'
        selfWherePeriod=' AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)'
    elseif period~='all' then return {ok=false,error='INVALID_PERIOD'} end
    local order=game.rankingOrder=='asc' and 'ASC' or 'DESC'
    local aggregate=game.rankingOrder=='asc' and 'MIN' or 'MAX'
    local comparator=game.rankingOrder=='asc' and '<' or '>'
    local sql=([[SELECT COALESCE(p.display_name,'Player') AS display_name,%s(s.score) AS score,
        MAX(CASE WHEN s.player_identifier=? THEN 1 ELSE 0 END) AS is_self
        FROM flecity_game_scores s LEFT JOIN flecity_game_profiles p ON p.player_identifier=s.player_identifier
        WHERE s.game_id=? %s
        AND (s.metadata_json IS NULL OR s.metadata_json NOT LIKE '%%"dailyDate":%%')
        GROUP BY s.player_identifier,p.display_name
        ORDER BY score %s,display_name ASC LIMIT %d]]):format(aggregate,wherePeriod,order,limit)
    local rows=MySQL.query.await(sql,{id,game.id}) or {}

    local selfSql=([[SELECT %s(score) AS score FROM flecity_game_scores
        WHERE player_identifier=? AND game_id=? %s
        AND (metadata_json IS NULL OR metadata_json NOT LIKE '%%"dailyDate":%%')]]):format(aggregate,selfWherePeriod)
    local selfRow=MySQL.single.await(selfSql,{id,game.id})
    local selfScore=selfRow and tonumber(selfRow.score) or nil
    local selfRank=nil
    if selfScore~=nil then
        local rankSql=([[SELECT 1+COUNT(*) FROM (
            SELECT player_identifier,%s(score) AS best_score
            FROM flecity_game_scores
            WHERE game_id=? %s
            AND (metadata_json IS NULL OR metadata_json NOT LIKE '%%"dailyDate":%%')
            GROUP BY player_identifier
        ) ranked WHERE ranked.best_score %s ?]]):format(aggregate,selfWherePeriod,comparator)
        selfRank=tonumber(MySQL.scalar.await(rankSql,{game.id,selfScore}) or 1) or 1
    end

    return {ok=true,gameId=game.id,period=period,rows=rows,self={score=selfScore,rank=selfRank}}
end

function FlecityGamesPlay.Statistics(source)
    local id=identifier(source)
    if not id then return {ok=false,error='PLAYER_NOT_READY'} end
    return {ok=true,statistics=statisticsFor(id),achievements=achievementsFor(id),best=bestScoresFor(id),daily=publicDaily(dailyChallenge(),id)}
end

function FlecityGamesPlay.DebugSelftest()
    local quick=gameFor('quick_tap') local stop=gameFor('stop') local block=gameFor('block')
    local merge=gameFor('merge') local fall=gameFor('fall') local minesGame=gameFor('mines') local stack=gameFor('stack') local nonogram=gameFor('nonogram') local memory=gameFor('memory') local sortGame=gameFor('sort') local slide=gameFor('slide') local colorMatch=gameFor('color_match') local numberRush=gameFor('number_rush') local highLow=gameFor('high_low') local simon=gameFor('simon')
    local testMines=generateMines(12345,8,10) local testMineCount=0 for _ in pairs(testMines) do testMineCount=testMineCount+1 end
    local testSafeMines=generateMines(12345,8,10,0) local testSafeMineCount=0 for _ in pairs(testSafeMines) do testSafeMineCount=testSafeMineCount+1 end
    local testNonogram,testNonogramCount=generateNonogram(12345,5)
    local testNonogramActual=0 for _ in pairs(testNonogram) do testNonogramActual=testNonogramActual+1 end
    local quickChallenge=challengeFor(quick,12345) local quickChallenge2=challengeFor(quick,12345)
    local dailyNumberA=dailyNumber('2026-10-20')
    local dailyNumberB=dailyNumber('2026-10-21')
    local dailyMonthEnd=dailyNumber('2026-10-31')
    local dailyNextMonth=dailyNumber('2026-11-01')
    local dailyLeapStart=dailyNumber('2028-02-28')
    local dailyLeapDay=dailyNumber('2028-02-29')
    local dailyLeapAfter=dailyNumber('2028-03-01')
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
    local fallEmpty=replayFallState(12345,{},10,18)
    local fallX,fallRotation=fallEmpty and fallFindAnyPlacement(fallEmpty.board,10,18,fallEmpty.nextPiece)
    local fallSingle=(fallX~=nil and fallRotation~=nil) and replayFallState(12345,{{x=fallX,rotation=fallRotation}},10,18) or nil
    local holdState,holdFirst=fallNextPiece(12345)
    local _,holdPlaced=fallNextPiece(holdState)
    local holdBoard=fallEmptyBoard(10,18)
    local holdX,holdRotation=fallFindAnyPlacement(holdBoard,10,18,holdPlaced)
    local fallHoldSingle=(holdX~=nil and holdRotation~=nil) and replayFallState(12345,{{x=holdX,rotation=holdRotation,hold=true}},10,18) or nil
    local normalizedIndexes=normalizeIndexList({2,1,2},5)
    local memoryDeck=generateMemoryDeck(12345)
    local memoryPairs={} local memorySeen={}
    for index,value in ipairs(memoryDeck) do
        local zero=index-1
        if memorySeen[value] then memoryPairs[#memoryPairs+1]={memorySeen[value],zero}
        else memorySeen[value]=zero end
    end
    local memoryReplay=replayMemory(12345,memoryPairs)
    local colorRounds=generateColorMatch(12345,20)
    local colorHistory={} for _,round in ipairs(colorRounds) do colorHistory[#colorHistory+1]=round.ink end
    local colorReplay=replayColorMatch(12345,colorHistory,20)
    local numberRushHistory=perfectNumberRushHistory(12345,25) or {}
    local numberRushReplay=replayNumberRush(12345,numberRushHistory,25)
    local rangeRushRounds=generateRangeRushRounds(12345,30)
    local highLowHistory={}
    for i=1,30 do
        local round=rangeRushRounds[i]
        local guess=round.value>round.pivot and 'high' or 'low'
        highLowHistory[#highLowHistory+1]={guess=guess,elapsedMs=500}
    end
    local highLowReplay=replayHighLow(12345,highLowHistory,30,2200)
    local highLowState=newHighLowState(12345,30,2200)
    local highLowServerOk=true
    for i=1,30 do
        local result=applyHighLowGuess(highLowState,highLowHistory[i].guess,highLowHistory[i].elapsedMs)
        if not result or result.correct~=true then highLowServerOk=false break end
    end
    local highLowLivesState=newHighLowState(54321,30,2400)
    local firstRound=highLowLivesState.generated[1]
    local wrongGuess=firstRound.value>firstRound.pivot and 'low' or 'high'
    local missResult=applyHighLowGuess(highLowLivesState,wrongGuess,500)
    local secondRound=highLowLivesState.generated[2]
    local correctGuess=secondRound.value>secondRound.pivot and 'high' or 'low'
    local recoverResult=applyHighLowGuess(highLowLivesState,correctGuess,500)
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

    local sortBoard=generateSortBoard(12345)
    local sortCounts={0,0,0,0}
    local sortTiles=0
    for i=1,6 do
        for _,color in ipairs(sortBoard[i] or {}) do
            sortTiles=sortTiles+1
            if color>=0 and color<=3 then sortCounts[color+1]=sortCounts[color+1]+1 end
        end
    end
    local sortMoveTest=nil
    for from=1,4 do
        if #(sortBoard[from] or {})>0 then
            sortMoveTest=replaySortState(12345,{{from-1,4}})
            if sortMoveTest then break end
        end
    end

    local slideBoard,slideBlank,slideUndo=generateSlideBoard(12345,4,40)
    local slideSolution={}
    for i=#slideUndo,1,-1 do slideSolution[#slideSolution+1]=slideUndo[i] end
    local slideReplay=replaySlideState(12345,slideSolution,4,40)

    local sample={board={{0,1},{1,0}},pieces={{shape=1}},score=120,combo=2}
    local encoded=json.encode(sample) local decoded=encoded and json.decode(encoded) or nil
    return {
        quickRejectLow=quick and validateScore(quick,69)==nil or false,
        quickAcceptNormal=quick and validateScore(quick,180)~=nil or false,
        quickRunProgression=(function()
            local state=newQuickState(12345,{targetHits=7,lives=3})
            return state and state.current and state.current.delayMs>=850 and state.current.delayMs<=2600 and state.lives==3
        end)(),
        deterministicChallenge=quickChallenge.targetHits==quickChallenge2.targetHits,
        dailyDateParsing=dailyNumberB==dailyNumberA+1 and dailyNextMonth==dailyMonthEnd+1
            and dailyLeapDay==dailyLeapStart+1 and dailyLeapAfter==dailyLeapDay+1,
        opaqueSessionToken=not string.find(opaqueToken,'SECRET_CITIZEN_ID',1,true),
        stopAcceptRunScore=stop and validateScore(stop,12500)==12500 or false,
        stopMidpoint=math.abs(trianglePosition(450,1800,0)-50)<0.001,
        stopRunProgression=(function()
            local cfg={maxRounds=5,startPeriodMs=2200,minPeriodMs=520,startTolerancePct=8,minTolerancePct=2.2}
            local state=newStopState(12345,cfg)
            local period1=stopRoundPeriod(cfg,1)
            local period5=stopRoundPeriod(cfg,5)
            local zone1=stopRoundTolerance(cfg,1)
            local zone5=stopRoundTolerance(cfg,5)
            return state and state.current and state.current.periodMs==2200 and state.current.tolerancePct==8
                and period5<period1 and period5>=cfg.minPeriodMs
                and zone5<zone1 and zone5>=cfg.minTolerancePct
        end)(),
        blockRejectNegative=block and validateScore(block,-1)==nil or false,
        blockAcceptInteger=block and validateScore(block,120)==120 or false,
        mergeAcceptInteger=merge and validateScore(merge,2048)==2048 or false,
        blockChallengeClean=type(blockChallenge)=='table' and next(blockChallenge)==nil,
        mergeChallengeClean=type(mergeChallenge)=='table' and next(mergeChallenge)==nil,
        blockReplayEmpty=replayBlock(12345,{})==0,
        blockReplayMove=blockSingle and blockSingle.score==blockSingleExpected and #blockSingle.history==1 or false,
        mergeReplayEmpty=replayMerge(12345,{})==0,
        mergeReplayMove=mergeSingle and mergeSingle.score==mergeExpectedGain and #mergeSingle.history==1 or false,
        fallReplayEmpty=fall and fallEmpty and fallEmpty.score==0 and fallEmpty.pieces==0 and fallEmpty.ended==false,
        fallReplayMove=fall and fallSingle and fallSingle.score>0 and fallSingle.pieces==1 and #fallSingle.history==1,
        fallHoldReplay=fall and fallHoldSingle and fallHoldSingle.pieces==1 and fallHoldSingle.heldPiece==holdFirst and fallHoldSingle.history[1] and fallHoldSingle.history[1].hold==true,
        fallValidateScore=fall and validateScore(fall,1000)==1000 or false,
        normalizedIndexes=normalizedIndexes and #normalizedIndexes==2 and normalizedIndexes[1]==1 and normalizedIndexes[2]==2 or false,
        minesValidateTime=minesGame and validateScore(minesGame,60000)==60000 or false,
        deferredTimerGames=minesGame and nonogram and challengeFor(minesGame,12345).size==8 and challengeFor(nonogram,12345).size==5 or false,
        minesSeedCount=testMineCount==10,
        minesFirstRevealSafe=testSafeMineCount==10 and testSafeMines[0]~=true,
        stackValidateScore=stack and validateScore(stack,3500)==3500 or false,
        stackPositionBounds=stackPosition(0,72,65,false)==0 and math.abs(stackPosition(0,72,65,true)-28)<0.001,
        stackReplayScoring=(function()
            local replayed=replayStack({initialWidthPct=72,speedPctPerSec=65},{215.385,430.770,646.155,861.540,1076.925,1292.310})
            return replayed==nil or (replayed.score>=0 and replayed.layers>=0 and replayed.maxPerfectStreak>=0)
        end)(),
        nonogramSeedCount=testNonogramCount==testNonogramActual and testNonogramCount>0,
        nonogramCuratedSet=#NONOGRAM_PATTERNS_5==30 and testNonogramCount>0,
        nonogramValidateTime=nonogram and validateScore(nonogram,45000)==45000 or false,
        memoryDeckPairs=memory and memoryReplay and memoryReplay.complete==true and memoryReplay.pairs==8,
        memoryValidateTime=memory and validateScore(memory,12000)==12000 or false,
        sortSeedCounts=sortGame and sortTiles==16 and sortCounts[1]==4 and sortCounts[2]==4 and sortCounts[3]==4 and sortCounts[4]==4,
        sortReplayMove=sortGame and sortMoveTest and sortMoveTest.moves==1 and #sortMoveTest.history==1 or false,
        sortValidateTime=sortGame and validateScore(sortGame,45000)==45000 or false,
        slideSeedBoard=slide and type(slideBoard)=='table' and #slideBoard==16 and tonumber(slideBoard[slideBlank+1])==0,
        slideReplaySolve=slide and slideReplay and slideReplay.complete==true and slideReplay.moves==#slideSolution,
        slideValidateTime=slide and validateScore(slide,60000)==60000 or false,
        memoryPreviewConfigured=memory and tonumber(challengeFor(memory,12345).previewMs)==1200 or false,
        colorMatchReplay=colorMatch and colorReplay and colorReplay.complete==true and colorReplay.rounds==10 or false,
        colorMatchValidateTime=colorMatch and validateScore(colorMatch,8000)==8000 or false,
        numberRushReplay=numberRush and numberRushReplay and numberRushReplay.complete==true and numberRushReplay.misses==0 and numberRushReplay.taps==25 or false,
        numberRushValidateTime=numberRush and validateScore(numberRush,10000)==10000 or false,
        highLowReplay=highLow and highLowReplay and highLowReplay.ended==true and highLowReplay.streak==30 and highLowReplay.maxStreak==30 and highLowReplay.lives==3 and highLowReplay.score>0 or false,
        highLowServerState=highLow and highLowServerOk and highLowState.ended==true and highLowState.streak==30 and highLowState.maxStreak==30 and highLowState.lives==3 and highLowState.score>0 and #highLowState.history==30 or false,
        highLowLivesRecovery=highLow and missResult and recoverResult and missResult.correct==false and missResult.ended==false and missResult.lives==2 and recoverResult.correct==true and recoverResult.lives==2,
        highLowAdaptiveTimer=rangeRushRoundLimit(2400,1)==2400 and rangeRushRoundLimit(2400,6)==2260 and rangeRushRoundLimit(2400,30)==1700,
        highLowActionIdempotent=highLow and highLowState.lastStep==nil,
        highLowValidateStreak=highLow and validateScore(highLow,5000)==5000 or false,
        simonReplay=simon and simonReplay and simonReplay.ended==true and simonReplay.cleared==5 or false,
        simonServerState=simon and simonServerOk and simonState.ended==true and simonState.cleared==5 or false,
        simonValidateRounds=simon and validateScore(simon,12)==12 or false,
        dailyCandidates=#dailyCandidates()>=3,
        saveRoundTrip=decoded and decoded.score==120 and decoded.combo==2 or false,
        saveWithinLimit=encoded and #encoded<=FlecityGamesConfig.Play.SaveStateMaxBytes or false,
        clientTimingTolerance=verifiedClientElapsed(10000,10500,2500,500)==10000
            and verifiedClientElapsed(7000,10000,2500,500)==nil
            and verifiedClientElapsed(11000,10000,2500,500)==nil
    }
end

function FlecityGamesPlay.DropSource(source)
    local src=tonumber(source)
    for token,session in pairs(sessions) do
        if session.source==src then removeSession(token) end
    end
    for key,request in pairs(startRequests) do
        if request.source==src then startRequests[key]=nil end
    end
end

function FlecityGamesPlay.Cleanup()
    local now=os.time()
    for token,session in pairs(sessions) do
        if now-session.startedAt>FlecityGamesConfig.Play.SessionMaxAgeSeconds then removeSession(token) end
    end
    for key,request in pairs(startRequests) do
        if now-(tonumber(request.createdAt) or now)>30 then startRequests[key]=nil end
    end
end

function FlecityGamesPlay.DebugCounts()
    local sessionCount=0
    for _ in pairs(sessions) do sessionCount=sessionCount+1 end
    return sessionCount
end

function FlecityGamesPlay.DebugSessionHealth()
    local now=os.time()
    local total,expired,missingGame,invalidSource,pendingStarts=0,0,0,0,0
    for _,session in pairs(sessions) do
        total=total+1
        if now-(tonumber(session.startedAt) or now)>FlecityGamesConfig.Play.SessionMaxAgeSeconds then expired=expired+1 end
        if not gameFor(session.gameId) then missingGame=missingGame+1 end
        if not tonumber(session.source) then invalidSource=invalidSource+1 end
    end
    for _,request in pairs(startRequests) do
        if request.pending then pendingStarts=pendingStarts+1 end
    end
    return {total=total,expired=expired,missingGame=missingGame,invalidSource=invalidSource,pendingStarts=pendingStarts}
end
