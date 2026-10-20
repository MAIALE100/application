FlecityGamesParty = FlecityGamesParty or {}

local rooms,roomsByCode,sourceToRoom={},{},{}
local nextJoinOrder=0
local votePrompts={
    '無人島で一番長く生き残りそうなのは？',
    'Flecityで一番有名になりそうなのは？',
    '逃走用ドライバーに一番向いていそうなのは？',
    '何をしに来たか忘れそうなのは？',
    '一番探偵に向いていそうなのは？'
}

local function identifier(source) return FlecityGamesFramework.GetIdentifier(source) end
local function partyGame(id)
    local game=FlecityGamesRegistry.Get(id)
    if not game or game.app~='party' or game.enabled~=true then return nil end
    return game
end
local function makeInternalId() return ('room:%d:%06d:%06d'):format(os.time(),GetGameTimer()%1000000,math.random(0,999999)) end
local function makeMemberId() return ('%06d%06d'):format(math.random(0,999999),math.random(0,999999)) end
local function makeCode()
    for _=1,100 do
        local code=('%04d'):format(math.random(0,9999))
        if not roomsByCode[code] then return code end
    end
end
local function memberCount(room) local n=0 for _ in pairs(room.members) do n=n+1 end return n end
local function connectedCount(room) local n=0 for _,m in pairs(room.members) do if not m.disconnected then n=n+1 end end return n end

local function migrateHost(room)
    if room.members[room.hostIdentifier] and not room.members[room.hostIdentifier].disconnected then return end
    local selected
    for id,m in pairs(room.members) do
        if not m.disconnected and (not selected or m.joinOrder<selected.member.joinOrder) then selected={id=id,member=m} end
    end
    room.hostIdentifier=selected and selected.id or nil
end

local function removeMember(room,id)
    local m=room.members[id]
    if not m then return end
    if m.source then sourceToRoom[m.source]=nil end
    room.members[id]=nil
    if room.hostIdentifier==id then migrateHost(room) end
    if memberCount(room)==0 then rooms[room.id]=nil roomsByCode[room.code]=nil end
end

local function publicRoundState(room,viewerId)
    local rs=room.roundState
    if not rs then return nil end
    local out={token=rs.token,gameId=rs.gameId,startedAt=rs.startedAt,complete=rs.complete==true,selfSubmitted=rs.submissions and rs.submissions[viewerId]~=nil or false}
    if rs.gameId=='reaction' then out.revealAfterMs=rs.revealAfterMs end
    if rs.gameId=='vote' then out.prompt=rs.prompt end
    if rs.complete then out.results=rs.results end
    return out
end

local function snapshot(room,viewerId)
    local players={}
    for id,m in pairs(room.members) do
        players[#players+1]={memberId=m.memberId,name=m.name,ready=m.ready==true,disconnected=m.disconnected==true,isHost=id==room.hostIdentifier,joinOrder=m.joinOrder}
    end
    table.sort(players,function(a,b) return a.joinOrder<b.joinOrder end)
    local selfMember=room.members[viewerId]
    return {
        id=room.id,code=room.code,state=room.state,round=room.round,selectedGame=room.selectedGame,players=players,
        playerCount=#players,connectedCount=connectedCount(room),maxPlayers=FlecityGamesConfig.Party.MaxPlayers,
        isHost=viewerId==room.hostIdentifier,selfReady=selfMember and selfMember.ready==true or false,
        selfMemberId=selfMember and selfMember.memberId or nil,createdAt=room.createdAt,roundState=publicRoundState(room,viewerId)
    }
end

local function roomForSource(source)
    local roomId=sourceToRoom[tonumber(source)]
    return roomId and rooms[roomId] or nil
end
local function roomForIdentifier(id)
    if not id then return nil end
    for _,room in pairs(rooms) do
        if room.members[id] then return room end
    end
    return nil
end
local function reconnectMember(room,id,source)
    local member=room and room.members[id] or nil
    if not member then return false end
    member.source=tonumber(source)
    member.disconnected=false
    member.disconnectedAt=nil
    member.name=FlecityGamesFramework.GetCharacterName(source)
    sourceToRoom[tonumber(source)]=room.id
    migrateHost(room)
    return true
end
local function memberIdToIdentifier(room,memberId)
    for id,m in pairs(room.members) do if m.memberId==memberId then return id end end
end

function FlecityGamesParty.CreateRoom(source)
    if not FlecityGamesRateLimit.Allow(source,'room_create',FlecityGamesConfig.RateLimits.RoomCreateMs) then return {ok=false,error='RATE_LIMIT'} end
    local id=identifier(source)
    if not id then return {ok=false,error='PLAYER_NOT_READY'} end
    local existingRoom=roomForSource(source) or roomForIdentifier(id)
    if existingRoom then
        reconnectMember(existingRoom,id,source)
        return {ok=true,reconnected=true,room=snapshot(existingRoom,id)}
    end
    local code=makeCode()
    if not code then return {ok=false,error='ROOM_CODE_EXHAUSTED'} end

    local roomId=makeInternalId()
    nextJoinOrder=nextJoinOrder+1
    local room={id=roomId,code=code,hostIdentifier=id,members={},selectedGame='reaction',state='lobby',round=0,roundState=nil,createdAt=os.time()}
    room.members[id]={source=tonumber(source),memberId=makeMemberId(),name=FlecityGamesFramework.GetCharacterName(source),ready=false,disconnected=false,joinOrder=nextJoinOrder,joinedAt=os.time()}
    rooms[roomId]=room roomsByCode[code]=roomId sourceToRoom[tonumber(source)]=roomId
    return {ok=true,room=snapshot(room,id)}
end

function FlecityGamesParty.JoinRoom(source,data)
    if not FlecityGamesRateLimit.Allow(source,'room_join',FlecityGamesConfig.RateLimits.RoomJoinMs) then return {ok=false,error='RATE_LIMIT'} end
    local id=identifier(source)
    if not id then return {ok=false,error='PLAYER_NOT_READY'} end
    if type(data)~='table' then return {ok=false,error='INVALID_REQUEST'} end
    local current=roomForSource(source)
    if current then return {ok=true,room=snapshot(current,id)} end

    local code=tostring(data.code or ''):gsub('%s+','')
    if not code:match('^%d%d%d%d$') then return {ok=false,error='INVALID_ROOM_CODE'} end
    local roomId=roomsByCode[code]
    local room=roomId and rooms[roomId] or nil
    if not room then return {ok=false,error='ROOM_NOT_FOUND'} end

    local existing=room.members[id]
    if existing then
        reconnectMember(room,id,source)
        return {ok=true,reconnected=true,room=snapshot(room,id)}
    end
    if memberCount(room)>=FlecityGamesConfig.Party.MaxPlayers then return {ok=false,error='ROOM_FULL'} end
    if room.state~='lobby' then return {ok=false,error='ROUND_IN_PROGRESS'} end

    nextJoinOrder=nextJoinOrder+1
    room.members[id]={source=tonumber(source),memberId=makeMemberId(),name=FlecityGamesFramework.GetCharacterName(source),ready=false,disconnected=false,joinOrder=nextJoinOrder,joinedAt=os.time()}
    sourceToRoom[tonumber(source)]=room.id
    return {ok=true,room=snapshot(room,id)}
end

function FlecityGamesParty.GetRoom(source)
    local id=identifier(source)
    if not id then return {ok=false,error='PLAYER_NOT_READY'} end
    local room=roomForSource(source)
    local reconnected=false
    if not room then
        room=roomForIdentifier(id)
        if room then reconnected=reconnectMember(room,id,source) end
    end
    if not room then return {ok=false,error='NOT_IN_ROOM'} end
    return {ok=true,reconnected=reconnected,room=snapshot(room,id)}
end

function FlecityGamesParty.SetReady(source,data)
    if not FlecityGamesRateLimit.Allow(source,'ready',FlecityGamesConfig.RateLimits.ReadyMs) then return {ok=false,error='RATE_LIMIT'} end
    local id=identifier(source) local room=roomForSource(source)
    if not id or not room or not room.members[id] then return {ok=false,error='NOT_IN_ROOM'} end
    if room.state~='lobby' then return {ok=false,error='ROUND_IN_PROGRESS'} end
    room.members[id].ready=type(data)=='table' and data.ready==true
    return {ok=true,room=snapshot(room,id)}
end

function FlecityGamesParty.SelectGame(source,data)
    if not FlecityGamesRateLimit.Allow(source,'room_action',FlecityGamesConfig.RateLimits.RoomActionMs) then return {ok=false,error='RATE_LIMIT'} end
    local id=identifier(source) local room=roomForSource(source)
    if not id or not room then return {ok=false,error='NOT_IN_ROOM'} end
    if room.hostIdentifier~=id then return {ok=false,error='HOST_ONLY'} end
    if room.state~='lobby' then return {ok=false,error='ROUND_IN_PROGRESS'} end
    local game=partyGame(type(data)=='table' and data.gameId or nil)
    if not game then return {ok=false,error='GAME_UNAVAILABLE'} end
    local count=memberCount(room)
    if count<game.minPlayers or count>game.maxPlayers then return {ok=false,error='PLAYER_COUNT_UNSUPPORTED'} end
    room.selectedGame=game.id
    for _,m in pairs(room.members) do m.ready=false end
    return {ok=true,room=snapshot(room,id)}
end

local function allReady(room,game)
    local count=0
    for _,m in pairs(room.members) do
        if not m.disconnected then count=count+1 if m.ready~=true then return false end end
    end
    return count>=math.max(FlecityGamesConfig.Party.MinPlayers,game.minPlayers or 2) and count<=(game.maxPlayers or FlecityGamesConfig.Party.MaxPlayers)
end

function FlecityGamesParty.StartRound(source)
    if not FlecityGamesRateLimit.Allow(source,'room_action',FlecityGamesConfig.RateLimits.RoomActionMs) then return {ok=false,error='RATE_LIMIT'} end
    local id=identifier(source) local room=roomForSource(source)
    if not id or not room then return {ok=false,error='NOT_IN_ROOM'} end
    if room.hostIdentifier~=id then return {ok=false,error='HOST_ONLY'} end
    if room.state~='lobby' then return {ok=false,error='ROUND_IN_PROGRESS'} end
    local game=partyGame(room.selectedGame)
    if not game then return {ok=false,error='GAME_UNAVAILABLE'} end
    if not allReady(room,game) then return {ok=false,error='NOT_ALL_READY'} end

    room.round=room.round+1 room.state='round'
    room.roundState={token=('%s:%d:%06d'):format(room.id,room.round,math.random(0,999999)),gameId=game.id,startedAt=os.time(),submissions={},complete=false}
    if game.id=='reaction' then room.roundState.revealAfterMs=math.random(1500,4000) end
    if game.id=='vote' then room.roundState.prompt=votePrompts[math.random(1,#votePrompts)] end
    for _,m in pairs(room.members) do m.ready=false end
    return {ok=true,room=snapshot(room,id)}
end

local function completedSubmissionCount(room)
    local rs=room.roundState
    local n=0
    for id,m in pairs(room.members) do if not m.disconnected and rs.submissions[id]~=nil then n=n+1 end end
    return n
end

local function maybeFinishReaction(room)
    local rs=room.roundState
    if not rs or rs.gameId~='reaction' or rs.complete then return end
    if completedSubmissionCount(room)<connectedCount(room) then return end

    local entries={}
    for id,m in pairs(room.members) do
        if not m.disconnected then
            local s=rs.submissions[id]
            entries[#entries+1]={memberId=m.memberId,name=m.name,reactionMs=s and s.reactionMs or nil,flying=(not s) or s.flying==true}
        end
    end
    table.sort(entries,function(a,b)
        if a.flying~=b.flying then return not a.flying end
        if a.flying then return a.name<b.name end
        if a.reactionMs==b.reactionMs then return a.name<b.name end
        return a.reactionMs<b.reactionMs
    end)
    for i,e in ipairs(entries) do e.place=i end
    rs.complete=true
    rs.results={entries=entries,winnerMemberId=entries[1] and not entries[1].flying and entries[1].memberId or nil}
end

function FlecityGamesParty.SubmitReaction(source,data)
    if not FlecityGamesRateLimit.Allow(source,'reaction_submit',300) then return {ok=false,error='RATE_LIMIT'} end
    local id=identifier(source) local room=roomForSource(source)
    if not id or not room or not room.members[id] then return {ok=false,error='NOT_IN_ROOM'} end
    if type(data)~='table' or room.state~='round' or not room.roundState or room.roundState.gameId~='reaction' then return {ok=false,error='INVALID_ROUND'} end
    local rs=room.roundState
    if tostring(data.token or '')~=rs.token then return {ok=false,error='ROUND_TOKEN_MISMATCH'} end
    if rs.complete then return {ok=false,error='ROUND_COMPLETE'} end
    if rs.submissions[id] then return {ok=false,error='ALREADY_SUBMITTED'} end

    local flying=data.flying==true
    local reaction=nil
    if not flying then
        reaction=tonumber(data.reactionMs)
        if not reaction or reaction<70 or reaction>3000 then return {ok=false,error='INVALID_REACTION'} end
        reaction=math.floor(reaction*1000+0.5)/1000
    end

    rs.submissions[id]={flying=flying,reactionMs=reaction}
    maybeFinishReaction(room)
    return {ok=true,room=snapshot(room,id)}
end

local function maybeFinishVote(room)
    local rs=room.roundState
    if not rs or rs.gameId~='vote' or rs.complete then return end
    if completedSubmissionCount(room)<connectedCount(room) then return end

    local counts={}
    for _,targetId in pairs(rs.submissions) do counts[targetId]=(counts[targetId] or 0)+1 end
    local entries={}
    local maxVotes=-1
    for id,m in pairs(room.members) do
        if not m.disconnected then
            local votes=counts[id] or 0
            if votes>maxVotes then maxVotes=votes end
            entries[#entries+1]={memberId=m.memberId,name=m.name,votes=votes}
        end
    end
    table.sort(entries,function(a,b) if a.votes==b.votes then return a.name<b.name end return a.votes>b.votes end)
    local winners={}
    for _,e in ipairs(entries) do if e.votes==maxVotes then winners[#winners+1]=e.memberId end end
    rs.complete=true
    rs.results={entries=entries,winnerMemberIds=winners}
end

function FlecityGamesParty.SubmitVote(source,data)
    if not FlecityGamesRateLimit.Allow(source,'vote_submit',300) then return {ok=false,error='RATE_LIMIT'} end
    local id=identifier(source) local room=roomForSource(source)
    if not id or not room or not room.members[id] then return {ok=false,error='NOT_IN_ROOM'} end
    if type(data)~='table' or room.state~='round' or not room.roundState or room.roundState.gameId~='vote' then return {ok=false,error='INVALID_ROUND'} end
    local rs=room.roundState
    if tostring(data.token or '')~=rs.token then return {ok=false,error='ROUND_TOKEN_MISMATCH'} end
    if rs.complete then return {ok=false,error='ROUND_COMPLETE'} end
    if rs.submissions[id] then return {ok=false,error='ALREADY_SUBMITTED'} end

    local targetId=memberIdToIdentifier(room,tostring(data.targetMemberId or ''))
    if not targetId or not room.members[targetId] or room.members[targetId].disconnected then return {ok=false,error='INVALID_TARGET'} end
    if targetId==id then return {ok=false,error='SELF_VOTE_NOT_ALLOWED'} end

    rs.submissions[id]=targetId
    maybeFinishVote(room)
    return {ok=true,room=snapshot(room,id)}
end

function FlecityGamesParty.ReturnLobby(source)
    if not FlecityGamesRateLimit.Allow(source,'room_action',FlecityGamesConfig.RateLimits.RoomActionMs) then return {ok=false,error='RATE_LIMIT'} end
    local id=identifier(source) local room=roomForSource(source)
    if not id or not room then return {ok=false,error='NOT_IN_ROOM'} end
    if room.hostIdentifier~=id then return {ok=false,error='HOST_ONLY'} end
    room.state='lobby' room.roundState=nil
    for _,m in pairs(room.members) do m.ready=false end
    return {ok=true,room=snapshot(room,id)}
end

function FlecityGamesParty.LeaveRoom(source)
    local id=identifier(source) local room=roomForSource(source)
    if not id or not room then return {ok=true} end
    removeMember(room,id)
    if rooms[room.id] and room.state=='round' and room.roundState and not room.roundState.complete then
        if room.roundState.gameId=='reaction' then maybeFinishReaction(room) end
        if room.roundState.gameId=='vote' then maybeFinishVote(room) end
    end
    return {ok=true}
end

function FlecityGamesParty.DropSource(source)
    local src=tonumber(source) local room=roomForSource(src)
    sourceToRoom[src]=nil
    if not room then return end
    local id
    for memberId,m in pairs(room.members) do if m.source==src then id=memberId break end end
    if not id then return end
    local m=room.members[id] m.source=nil m.disconnected=true m.disconnectedAt=os.time()
    migrateHost(room)
    if room.state=='round' and room.roundState and not room.roundState.complete then
        if room.roundState.gameId=='reaction' then maybeFinishReaction(room) end
        if room.roundState.gameId=='vote' then maybeFinishVote(room) end
    end
end

function FlecityGamesParty.Cleanup()
    local now=os.time()
    for _,room in pairs(rooms) do
        local expired=now-room.createdAt>FlecityGamesConfig.Party.RoomMaxAgeSeconds
        local removals={}
        for id,m in pairs(room.members) do
            if expired or (m.disconnected and m.disconnectedAt and now-m.disconnectedAt>FlecityGamesConfig.Party.DisconnectGraceSeconds) then removals[#removals+1]=id end
        end
        for _,id in ipairs(removals) do if rooms[room.id] then removeMember(room,id) end end
        if rooms[room.id] then
            migrateHost(room)
            if room.state=='round' and room.roundState and not room.roundState.complete then
                if room.roundState.gameId=='reaction' then maybeFinishReaction(room) end
                if room.roundState.gameId=='vote' then maybeFinishVote(room) end
            end
        end
    end
end

function FlecityGamesParty.DebugSelftest()
    local room={
        hostIdentifier='host',
        members={
            host={disconnected=true,joinOrder=1},
            second={disconnected=false,joinOrder=2},
            third={disconnected=false,joinOrder=3}
        }
    }
    migrateHost(room)
    return {
        hostMigration=room.hostIdentifier=='second',
        connectedCount=connectedCount(room)==2,
        memberCount=memberCount(room)==3
    }
end

function FlecityGamesParty.DebugCounts()
    local roomCount,memberTotal=0,0
    for _,room in pairs(rooms) do roomCount=roomCount+1 memberTotal=memberTotal+memberCount(room) end
    return roomCount,memberTotal
end
