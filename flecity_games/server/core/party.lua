FlecityGamesParty = FlecityGamesParty or {}

local rooms,roomsByCode,sourceToRoom={},{},{}
local nextJoinOrder=0

local votePrompts={
    '無人島で一番長く生き残りそうなのは？',
    'Flecityで一番有名になりそうなのは？',
    '逃走用ドライバーに一番向いていそうなのは？',
    '何をしに来たか忘れそうなのは？',
    '一番探偵に向いていそうなのは？',
    '突然旅行に誘っても来てくれそうなのは？',
    '一番朝に強そうなのは？',
    '一番夜更かししていそうなのは？',
    '宝くじが当たっても普段通りに過ごしそうなのは？',
    '一番料理が上手そうなのは？',
    '道に迷っても何とか帰ってきそうなのは？',
    '一番写真を撮るのが上手そうなのは？',
    '一番秘密を守ってくれそうなのは？',
    '急なトラブルでも落ち着いていそうなのは？',
    '一番面白いあだ名を付けそうなのは？',
    '一番買い物に時間をかけそうなのは？',
    '一番先に新しい流行を見つけそうなのは？',
    '一番長距離ドライブを楽しみそうなのは？'
}
local majorityPrompts={
    {question='休日に選ぶなら？',options={'街で遊ぶ','家でのんびり'}},
    {question='ドライブするなら？',options={'昼','夜'}},
    {question='もらえるならどっち？',options={'高級車','豪邸'}},
    {question='得意なのは？',options={'計画して動く','その場で決める'}},
    {question='遊びに行くなら？',options={'海','山'}},
    {question='選ぶなら？',options={'スピード','安定感'}},
    {question='朝食にするなら？',options={'パン','ごはん'}},
    {question='旅行するなら？',options={'大都市','自然の多い場所'}},
    {question='写真を残すなら？',options={'人物','景色'}},
    {question='欲しい能力は？',options={'瞬間移動','時間を止める'}},
    {question='乗るなら？',options={'スポーツカー','バイク'}},
    {question='食べるなら？',options={'甘いもの','辛いもの'}},
    {question='見るなら？',options={'映画','ドラマ'}},
    {question='待ち合わせは？',options={'早めに到着','時間ぴったり'}},
    {question='部屋に置くなら？',options={'大きなテレビ','高性能PC'}},
    {question='天気を選べるなら？',options={'晴れ','雨'}},
    {question='一緒に暮らすなら？',options={'猫','犬'}},
    {question='買い物するなら？',options={'店舗','オンライン'}}
}
local wordWolfPairs={
    {'コーヒー','紅茶'},{'海','プール'},{'猫','犬'},{'警察','救急隊'},{'スポーツカー','バイク'},
    {'寿司','焼肉'},{'映画館','ライブ会場'},{'朝','夜'},{'雨','雪'},{'写真','動画'},
    {'ハンバーガー','ピザ'},{'電車','バス'},{'山','森'},{'夏','冬'},{'電話','メッセージ'},
    {'カメラ','双眼鏡'},{'ホテル','キャンプ'},{'サッカー','バスケットボール'},{'ケーキ','アイス'},
    {'本屋','図書館'},{'飛行機','ヘリコプター'},{'花火','イルミネーション'},{'川','湖'},
    {'朝ごはん','夜食'},{'ゲーム','映画'}
}
local liarPrompts={
    '最近一番よく行く場所は？',
    '車を1台だけ選ぶなら何を選ぶ？',
    '休みの日は何をして過ごす？',
    'Flecityで一番好きな景色は？',
    '急に大金が入ったら最初に何をする？',
    '得意なことを1つ挙げるなら？',
    '最近食べておいしかったものは？',
    '旅行するならどこへ行きたい？',
    '朝起きて最初にすることは？',
    '1日だけ別の仕事をするなら何をしたい？',
    '自分の部屋で一番気に入っている物は？',
    '最近一番笑ったことは？',
    '今ほしい物を1つ挙げるなら？',
    '長距離ドライブで流したい音楽は？',
    '得意料理を1つ挙げるなら？',
    '子どもの頃に好きだった遊びは？',
    '新しい趣味を始めるなら何にする？',
    'Flecityで友達を案内するなら最初にどこへ行く？'
}
local drawPrompts={
    '猫','車','ピザ','飛行機','魚','スマホ','家','木','カメラ','時計','サメ','ハンバーガー',
    '犬','バイク','船','太陽','月','傘','帽子','ケーキ','コーヒー','花','ギター','ヘリコプター',
    '信号機','橋','山','テレビ','鍵','メガネ','靴','雪だるま','風船','救急車','パトカー','ドーナツ'
}
local telephonePrompts={
    '赤い車で海へ行く',
    '猫がピザを食べている',
    '警察官が魚を釣っている',
    '雨の中をバイクで走る',
    '大きな家の前にスポーツカー',
    'カメラを持って山に登る',
    'サメがスマホを使っている',
    '夜の街で花火を見る',
    '犬がサングラスをかけて車を運転する',
    'ヘリコプターからプレゼントが落ちてくる',
    '雪だるまがコーヒーを飲んでいる',
    '海辺でギターを弾いている猫',
    '大きなケーキをバイクで運ぶ',
    '山の上で写真を撮る警察官',
    '傘をさした魚が道路を歩いている',
    '飛行機の窓から虹が見える',
    'パトカーの上に巨大なピザが乗っている',
    '夜の橋をスポーツカーで渡る',
    '犬がカメラで猫を撮影している',
    '救急車が海辺でアイスを売っている'
}

local function identifier(source) return FlecityGamesFramework.GetIdentifier(source) end
local function characterName(source)
    local value=FlecityGamesText.Normalize(FlecityGamesFramework.GetCharacterName(source))
    if value=='' then value=('Player %s'):format(tostring(source)) end
    return FlecityGamesText.Truncate(value,64)
end
local function partyGame(id)
    local game=FlecityGamesRegistry.Get(id)
    if not game or game.app~='party' or game.enabled~=true then return nil end
    return game
end

local function makeInternalId() return ('room:%d:%06d:%06d'):format(os.time(),GetGameTimer()%1000000,math.random(0,999999)) end
local function makeMemberId(room)
    for _=1,50 do
        local candidate=('%06d%06d'):format(math.random(0,999999),math.random(0,999999))
        local used=false
        for _,member in pairs(room and room.members or {}) do
            if member.memberId==candidate then used=true break end
        end
        if not used then return candidate end
    end
    return ('%06d%06d'):format(GetGameTimer()%1000000,nextJoinOrder%1000000)
end
local function roomCodeLength()
    return math.max(3,math.min(6,math.floor(tonumber(FlecityGamesConfig.Party.RoomCodeLength) or 4)))
end
local function makeCode()
    local length=roomCodeLength()
    local maximum=(10^length)-1
    local formatString='%0'..length..'d'
    for _=1,100 do
        local code=formatString:format(math.random(0,maximum))
        if not roomsByCode[code] then return code end
    end
end
local function memberCount(room) local n=0 for _ in pairs(room.members) do n=n+1 end return n end
local function connectedCount(room) local n=0 for _,m in pairs(room.members) do if not m.disconnected then n=n+1 end end return n end
local function connectedIdentifiers(room)
    local list={}
    for id,m in pairs(room.members) do if not m.disconnected then list[#list+1]={id=id,joinOrder=m.joinOrder} end end
    table.sort(list,function(a,b) return a.joinOrder<b.joinOrder end)
    local out={} for _,entry in ipairs(list) do out[#out+1]=entry.id end
    return out
end
local function trianglePosition(elapsedMs,periodMs,phaseMs)
    local period=math.max(400,tonumber(periodMs) or 1800)
    local phase=tonumber(phaseMs) or 0
    local cycle=(math.max(0,tonumber(elapsedMs) or 0)+phase)%period
    local half=period/2
    if cycle<=half then return (cycle/half)*100 end
    return ((period-cycle)/half)*100
end

local function migrateHost(room)
    if room.hostIdentifier and room.members[room.hostIdentifier] and not room.members[room.hostIdentifier].disconnected then return end
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

local function roomForSource(source)
    local roomId=sourceToRoom[tonumber(source)]
    return roomId and rooms[roomId] or nil
end
local function roomForIdentifier(id)
    if not id then return nil end
    for _,room in pairs(rooms) do if room.members[id] then return room end end
    return nil
end
local function reconnectMember(room,id,source)
    local member=room and room.members[id] or nil
    if not member then return false end
    local src=tonumber(source)
    local previousSource=member.source and tonumber(member.source) or nil
    if previousSource and previousSource~=src then sourceToRoom[previousSource]=nil end
    member.source=src
    member.disconnected=false
    member.disconnectedAt=nil
    member.name=characterName(source)
    sourceToRoom[src]=room.id
    migrateHost(room)
    return true
end
local function memberIdToIdentifier(room,memberId)
    for id,m in pairs(room.members) do if m.memberId==memberId then return id end end
end
local function memberPublicId(room,id)
    local m=room.members[id]
    return m and m.memberId or nil
end
local function memberName(room,id)
    local m=room.members[id]
    return m and m.name or 'Player'
end

local function sanitizedStrokes(strokes,maxStrokes)
    if type(strokes)~='table' or #strokes<1 or #strokes>(maxStrokes or 80) then return nil end
    local clean={}
    for _,stroke in ipairs(strokes) do
        if type(stroke)~='table' or #stroke<2 or #stroke>48 then return nil end
        local points={}
        for _,point in ipairs(stroke) do
            if type(point)~='table' then return nil end
            local x=tonumber(point.x) local y=tonumber(point.y)
            if not x or not y or x<0 or x>1 or y<0 or y>1 then return nil end
            points[#points+1]={x=math.floor(x*10000+0.5)/10000,y=math.floor(y*10000+0.5)/10000}
        end
        clean[#clean+1]=points
    end
    return clean
end

local function telephonePublicChain(room,rs)
    local out={}
    for _,entry in ipairs(rs.chain or {}) do
        local item={kind=entry.kind,name=entry.byIdentifier and memberName(room,entry.byIdentifier) or 'START'}
        if entry.kind=='text' then item.text=entry.text else item.strokes=entry.strokes end
        out[#out+1]=item
    end
    return out
end

local function publicRoundState(room,viewerId)
    local rs=room.roundState
    if not rs then return nil end
    local out={
        token=rs.token,gameId=rs.gameId,startedAt=rs.startedAt,startedTick=rs.startedTick,
        complete=rs.complete==true,selfSubmitted=rs.submissions and rs.submissions[viewerId]~=nil or false
    }
    if rs.gameId=='reaction' then out.revealAfterMs=rs.revealAfterMs end
    if rs.gameId=='vote' then out.prompt=rs.prompt end
    if rs.gameId=='stop_battle' then
        out.targetPct=rs.targetPct out.periodMs=rs.periodMs out.phaseMs=rs.phaseMs out.motionStartTick=rs.motionStartTick
    end
    if rs.gameId=='majority' then out.prompt=rs.prompt out.options=rs.options end
    if rs.gameId=='word_wolf' then out.secretTopic=rs.topics and rs.topics[viewerId] or nil end
    if rs.gameId=='liar' then out.prompt=rs.prompt out.role=rs.roles and rs.roles[viewerId] or nil end
    if rs.gameId=='draw' then
        out.isDrawer=viewerId==rs.drawerIdentifier
        out.drawerMemberId=memberPublicId(room,rs.drawerIdentifier)
        out.prompt=viewerId==rs.drawerIdentifier and rs.prompt or nil
        out.strokes=rs.strokes or {}
        out.selfGuessed=rs.guessed and rs.guessed[viewerId]==true or false
        local guessedCount=0 for _ in pairs(rs.guessed or {}) do guessedCount=guessedCount+1 end
        out.guessedCount=guessedCount
    end
    if rs.gameId=='telephone' then
        out.step=rs.step out.totalSteps=#(rs.turnOrder or {}) out.mode=rs.mode
        out.currentMemberId=memberPublicId(room,rs.currentIdentifier)
        out.isCurrent=viewerId==rs.currentIdentifier
        if out.isCurrent and not rs.complete then
            local previous=rs.chain and rs.chain[#rs.chain] or nil
            if rs.mode=='draw' and previous and previous.kind=='text' then out.promptText=previous.text end
            if rs.mode=='text' and previous and previous.kind=='draw' then out.promptStrokes=previous.strokes end
        end
    end
    if rs.complete then
        if rs.gameId=='telephone' then out.results={chain=telephonePublicChain(room,rs)} else out.results=rs.results end
    end
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
        code=room.code,revision=tonumber(room.revision) or 0,state=room.state,round=room.round,selectedGame=room.selectedGame,players=players,
        playerCount=#players,connectedCount=connectedCount(room),maxPlayers=FlecityGamesConfig.Party.MaxPlayers,
        isHost=viewerId==room.hostIdentifier,selfReady=selfMember and selfMember.ready==true or false,
        selfMemberId=selfMember and selfMember.memberId or nil,createdAt=room.createdAt,serverTick=GetGameTimer(),
        roundState=publicRoundState(room,viewerId)
    }
end

local function bumpRoom(room)
    if not room then return 0 end
    room.revision=(tonumber(room.revision) or 0)+1
    return room.revision
end

local function notifyRoom(room,excludeSource)
    if not room or not rooms[room.id] then return end
    bumpRoom(room)
    local excluded=excludeSource and tonumber(excludeSource) or nil
    for viewerId,member in pairs(room.members) do
        local src=member.source and tonumber(member.source) or nil
        if src and not member.disconnected and src~=excluded then
            TriggerClientEvent('flecity_games:client:partyUpdate',src,snapshot(room,viewerId))
        end
    end
end

local function notifyRoomEvent(room,excludeSource,eventName,payload)
    if not room or not rooms[room.id] then return end
    local revision=bumpRoom(room)
    if type(payload)=='table' then payload.revision=revision end
    local excluded=excludeSource and tonumber(excludeSource) or nil
    for _,member in pairs(room.members) do
        local src=member.source and tonumber(member.source) or nil
        if src and not member.disconnected and src~=excluded then
            TriggerClientEvent(eventName,src,payload)
        end
    end
end

function FlecityGamesParty.GetConfig()
    local games={}
    for _,game in ipairs(FlecityGamesRegistry.List('party',true)) do
        games[#games+1]={
            id=game.id,
            name=game.name,
            description=game.description,
            minPlayers=game.minPlayers,
            maxPlayers=game.maxPlayers
        }
    end
    return {
        ok=true,
        config={
            roomCodeLength=roomCodeLength(),
            minPlayers=FlecityGamesConfig.Party.MinPlayers,
            maxPlayers=FlecityGamesConfig.Party.MaxPlayers,
            version=GetResourceMetadata(GetCurrentResourceName(),'version',0) or 'unknown',
            games=games
        }
    }
end

function FlecityGamesParty.CreateRoom(source)
    if not FlecityGamesRateLimit.Allow(source,'room_create',FlecityGamesConfig.RateLimits.RoomCreateMs) then return {ok=false,error='RATE_LIMIT'} end
    local id=identifier(source)
    if not id then return {ok=false,error='PLAYER_NOT_READY'} end
    local existingRoom=roomForSource(source) or roomForIdentifier(id)
    if existingRoom then
        reconnectMember(existingRoom,id,source)
        notifyRoom(existingRoom,source)
        return {ok=true,reconnected=true,room=snapshot(existingRoom,id)}
    end
    local code=makeCode()
    if not code then return {ok=false,error='ROOM_CODE_EXHAUSTED'} end
    local roomId=makeInternalId()
    nextJoinOrder=nextJoinOrder+1
    local room={id=roomId,code=code,revision=0,hostIdentifier=id,members={},selectedGame='reaction',state='lobby',round=0,roundState=nil,createdAt=os.time()}
    room.members[id]={source=tonumber(source),memberId=makeMemberId(room),name=characterName(source),ready=false,disconnected=false,joinOrder=nextJoinOrder,joinedAt=os.time()}
    rooms[roomId]=room roomsByCode[code]=roomId sourceToRoom[tonumber(source)]=roomId
    notifyRoom(room,source)
    return {ok=true,room=snapshot(room,id)}
end

function FlecityGamesParty.JoinRoom(source,data)
    if not FlecityGamesRateLimit.Allow(source,'room_join',FlecityGamesConfig.RateLimits.RoomJoinMs) then return {ok=false,error='RATE_LIMIT'} end
    local id=identifier(source)
    if not id then return {ok=false,error='PLAYER_NOT_READY'} end
    if type(data)~='table' then return {ok=false,error='INVALID_REQUEST'} end

    local current=roomForSource(source)
    if current then return {ok=true,room=snapshot(current,id)} end

    local existingRoom=roomForIdentifier(id)
    if existingRoom then
        reconnectMember(existingRoom,id,source)
        notifyRoom(existingRoom,source)
        return {ok=true,reconnected=true,room=snapshot(existingRoom,id)}
    end

    local code=tostring(data.code or ''):gsub('%s+','')
    local length=roomCodeLength()
    if #code~=length or not code:match('^%d+$') then return {ok=false,error='INVALID_ROOM_CODE'} end

    local roomId=roomsByCode[code]
    local room=roomId and rooms[roomId] or nil
    if not room then return {ok=false,error='ROOM_NOT_FOUND'} end

    local existing=room.members[id]
    if existing then
        reconnectMember(room,id,source)
        notifyRoom(room,source)
        return {ok=true,reconnected=true,room=snapshot(room,id)}
    end

    if memberCount(room)>=FlecityGamesConfig.Party.MaxPlayers then return {ok=false,error='ROOM_FULL'} end
    if room.state~='lobby' then return {ok=false,error='ROUND_IN_PROGRESS'} end

    nextJoinOrder=nextJoinOrder+1
    room.members[id]={
        source=tonumber(source),memberId=makeMemberId(room),name=characterName(source),
        ready=false,disconnected=false,joinOrder=nextJoinOrder,joinedAt=os.time()
    }
    sourceToRoom[tonumber(source)]=room.id
    notifyRoom(room,source)
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
    if reconnected then notifyRoom(room,source) end
    return {ok=true,reconnected=reconnected,room=snapshot(room,id)}
end

function FlecityGamesParty.SetReady(source,data)
    if not FlecityGamesRateLimit.Allow(source,'ready',FlecityGamesConfig.RateLimits.ReadyMs) then return {ok=false,error='RATE_LIMIT'} end
    local id=identifier(source) local room=roomForSource(source)
    if not id or not room or not room.members[id] then return {ok=false,error='NOT_IN_ROOM'} end
    if room.state~='lobby' then return {ok=false,error='ROUND_IN_PROGRESS'} end
    room.members[id].ready=type(data)=='table' and data.ready==true
    notifyRoom(room,source)
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
    room.selectedGame=game.id
    for _,m in pairs(room.members) do m.ready=false end
    notifyRoom(room,source)
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
    local count=connectedCount(room)
    if count<(game.minPlayers or FlecityGamesConfig.Party.MinPlayers) or count>(game.maxPlayers or FlecityGamesConfig.Party.MaxPlayers) then
        return {ok=false,error='PLAYER_COUNT_UNSUPPORTED'}
    end
    if not allReady(room,game) then return {ok=false,error='NOT_ALL_READY'} end

    room.round=room.round+1 room.state='round'
    local startedTick=GetGameTimer()
    local rs={token=('round:%d:%06d:%06d'):format(room.round,GetGameTimer()%1000000,math.random(0,999999)),gameId=game.id,startedAt=os.time(),startedTick=startedTick,submissions={},complete=false}
    room.roundState=rs

    if game.id=='reaction' then rs.revealAfterMs=math.random(1500,4000) end
    if game.id=='vote' then rs.prompt=votePrompts[math.random(1,#votePrompts)] end
    if game.id=='stop_battle' then
        rs.targetPct=math.random(15,85) rs.periodMs=math.random(1500,2400) rs.phaseMs=math.random(0,rs.periodMs-1) rs.motionStartTick=startedTick+1500
    end
    if game.id=='majority' then
        local prompt=majorityPrompts[math.random(1,#majorityPrompts)]
        rs.prompt=prompt.question rs.options={prompt.options[1],prompt.options[2]}
    end
    if game.id=='word_wolf' then
        local pair=wordWolfPairs[math.random(1,#wordWolfPairs)]
        local ids=connectedIdentifiers(room) local wolfId=ids[math.random(1,#ids)]
        rs.wolfIdentifier=wolfId rs.majorityTopic=pair[1] rs.wolfTopic=pair[2] rs.topics={}
        for _,memberId in ipairs(ids) do rs.topics[memberId]=memberId==wolfId and pair[2] or pair[1] end
    end
    if game.id=='liar' then
        local ids=connectedIdentifiers(room) local liarId=ids[math.random(1,#ids)]
        rs.liarIdentifier=liarId rs.prompt=liarPrompts[math.random(1,#liarPrompts)] rs.roles={}
        for _,memberId in ipairs(ids) do rs.roles[memberId]=memberId==liarId and 'LIAR' or 'TRUTH' end
    end
    if game.id=='draw' then
        local ids=connectedIdentifiers(room)
        rs.drawerIdentifier=ids[((room.round-1)%#ids)+1]
        rs.prompt=drawPrompts[math.random(1,#drawPrompts)]
        rs.strokes={} rs.guessed={} rs.guessedAt={}
    end
    if game.id=='telephone' then
        rs.turnOrder=connectedIdentifiers(room)
        rs.step=1 rs.mode='draw' rs.currentIdentifier=rs.turnOrder[1]
        rs.chain={{kind='text',text=telephonePrompts[math.random(1,#telephonePrompts)]}}
    end

    for _,m in pairs(room.members) do m.ready=false end
    notifyRoom(room,source)
    return {ok=true,room=snapshot(room,id)}
end

local function completedSubmissionCount(room)
    local rs=room.roundState local n=0
    for id,m in pairs(room.members) do if not m.disconnected and rs.submissions[id]~=nil then n=n+1 end end
    return n
end

local function maybeFinishReaction(room)
    local rs=room.roundState
    if not rs or rs.gameId~='reaction' or rs.complete or completedSubmissionCount(room)<connectedCount(room) then return end
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
    rs.complete=true rs.results={entries=entries,winnerMemberId=entries[1] and not entries[1].flying and entries[1].memberId or nil}
end

function FlecityGamesParty.SubmitReaction(source,data)
    if not FlecityGamesRateLimit.Allow(source,'reaction_submit',300) then return {ok=false,error='RATE_LIMIT'} end
    local id=identifier(source) local room=roomForSource(source)
    if not id or not room or not room.members[id] then return {ok=false,error='NOT_IN_ROOM'} end
    local rs=room.roundState
    if type(data)~='table' or room.state~='round' or not rs or rs.gameId~='reaction' then return {ok=false,error='INVALID_ROUND'} end
    if tostring(data.token or '')~=rs.token then return {ok=false,error='ROUND_TOKEN_MISMATCH'} end
    if rs.complete then return {ok=false,error='ROUND_COMPLETE'} end
    if rs.submissions[id] then return {ok=false,error='ALREADY_SUBMITTED'} end
    local flying=data.flying==true local reaction=nil
    local revealTick=(tonumber(rs.startedTick) or GetGameTimer())+(tonumber(rs.revealAfterMs) or 0)
    local serverSinceReveal=GetGameTimer()-revealTick
    if not flying then
        reaction=tonumber(data.reactionMs)
        if not reaction or reaction<70 or reaction>3000 then return {ok=false,error='INVALID_REACTION'} end
        if serverSinceReveal<0 or reaction>serverSinceReveal+350 or serverSinceReveal-reaction>1800 then return {ok=false,error='IMPOSSIBLE_TIMING'} end
        reaction=math.floor(reaction*1000+0.5)/1000
    elseif serverSinceReveal>250 then return {ok=false,error='FLYING_WINDOW_PASSED'} end
    rs.submissions[id]={flying=flying,reactionMs=reaction}
    maybeFinishReaction(room)
    notifyRoom(room,source)
    return {ok=true,room=snapshot(room,id)}
end

local function maybeFinishStopBattle(room)
    local rs=room.roundState
    if not rs or rs.gameId~='stop_battle' or rs.complete or completedSubmissionCount(room)<connectedCount(room) then return end
    local entries={}
    for id,m in pairs(room.members) do
        if not m.disconnected then
            local s=rs.submissions[id]
            entries[#entries+1]={memberId=m.memberId,name=m.name,score=s and s.score or 0,distancePct=s and s.distancePct or 100,markerPct=s and s.markerPct or nil}
        end
    end
    table.sort(entries,function(a,b) if a.score==b.score then return a.name<b.name end return a.score>b.score end)
    for i,e in ipairs(entries) do e.place=i end
    rs.complete=true rs.results={entries=entries,winnerMemberId=entries[1] and entries[1].memberId or nil,targetPct=rs.targetPct}
end

function FlecityGamesParty.SubmitStopBattle(source,data)
    if not FlecityGamesRateLimit.Allow(source,'stop_battle_submit',300) then return {ok=false,error='RATE_LIMIT'} end
    local id=identifier(source) local room=roomForSource(source)
    if not id or not room or not room.members[id] then return {ok=false,error='NOT_IN_ROOM'} end
    local rs=room.roundState
    if type(data)~='table' or room.state~='round' or not rs or rs.gameId~='stop_battle' then return {ok=false,error='INVALID_ROUND'} end
    if tostring(data.token or '')~=rs.token then return {ok=false,error='ROUND_TOKEN_MISMATCH'} end
    if rs.complete then return {ok=false,error='ROUND_COMPLETE'} end
    if rs.submissions[id] then return {ok=false,error='ALREADY_SUBMITTED'} end
    local actionMs=math.floor(tonumber(data.actionMs) or -1)
    if actionMs<0 or actionMs>60000 then return {ok=false,error='INVALID_TIMING'} end
    local serverElapsed=math.max(0,GetGameTimer()-(tonumber(rs.motionStartTick) or GetGameTimer()))
    if actionMs>serverElapsed+350 or serverElapsed-actionMs>1800 then return {ok=false,error='IMPOSSIBLE_TIMING'} end
    local marker=trianglePosition(actionMs,rs.periodMs,rs.phaseMs)
    local distance=math.abs(marker-(tonumber(rs.targetPct) or 50))
    local score=math.floor(math.max(0,1000-(distance*10))+0.5)
    rs.submissions[id]={actionMs=actionMs,score=score,markerPct=math.floor(marker*100+0.5)/100,distancePct=math.floor(distance*100+0.5)/100}
    maybeFinishStopBattle(room)
    notifyRoom(room,source)
    return {ok=true,room=snapshot(room,id)}
end

local function maybeFinishMajority(room)
    local rs=room.roundState
    if not rs or rs.gameId~='majority' or rs.complete or completedSubmissionCount(room)<connectedCount(room) then return end
    local counts={A=0,B=0} local entries={}
    for id,m in pairs(room.members) do
        if not m.disconnected then
            local choice=rs.submissions[id]
            if choice=='A' or choice=='B' then counts[choice]=counts[choice]+1 end
            entries[#entries+1]={memberId=m.memberId,name=m.name,choice=choice}
        end
    end
    table.sort(entries,function(a,b) return a.name<b.name end)
    local winningChoice=nil if counts.A>counts.B then winningChoice='A' elseif counts.B>counts.A then winningChoice='B' end
    rs.complete=true rs.results={counts=counts,entries=entries,winningChoice=winningChoice,options=rs.options}
end

function FlecityGamesParty.SubmitMajority(source,data)
    if not FlecityGamesRateLimit.Allow(source,'majority_submit',300) then return {ok=false,error='RATE_LIMIT'} end
    local id=identifier(source) local room=roomForSource(source)
    if not id or not room or not room.members[id] then return {ok=false,error='NOT_IN_ROOM'} end
    local rs=room.roundState
    if type(data)~='table' or room.state~='round' or not rs or rs.gameId~='majority' then return {ok=false,error='INVALID_ROUND'} end
    if tostring(data.token or '')~=rs.token then return {ok=false,error='ROUND_TOKEN_MISMATCH'} end
    if rs.complete then return {ok=false,error='ROUND_COMPLETE'} end
    if rs.submissions[id] then return {ok=false,error='ALREADY_SUBMITTED'} end
    local choice=tostring(data.choice or '')
    if choice~='A' and choice~='B' then return {ok=false,error='INVALID_CHOICE'} end
    rs.submissions[id]=choice maybeFinishMajority(room)
    notifyRoom(room,source)
    return {ok=true,room=snapshot(room,id)}
end

local function maybeFinishVote(room)
    local rs=room.roundState
    if not rs or rs.gameId~='vote' or rs.complete or completedSubmissionCount(room)<connectedCount(room) then return end
    local counts={}
    for voterId,targetId in pairs(rs.submissions) do
        local voter=room.members[voterId]
        if voter and not voter.disconnected then counts[targetId]=(counts[targetId] or 0)+1 end
    end
    local entries={} local maxVotes=-1
    for id,m in pairs(room.members) do
        if not m.disconnected then
            local votes=counts[id] or 0 if votes>maxVotes then maxVotes=votes end
            entries[#entries+1]={memberId=m.memberId,name=m.name,votes=votes}
        end
    end
    table.sort(entries,function(a,b) if a.votes==b.votes then return a.name<b.name end return a.votes>b.votes end)
    local winners={} for _,e in ipairs(entries) do if e.votes==maxVotes then winners[#winners+1]=e.memberId end end
    rs.complete=true rs.results={entries=entries,winnerMemberIds=winners}
end

function FlecityGamesParty.SubmitVote(source,data)
    if not FlecityGamesRateLimit.Allow(source,'vote_submit',300) then return {ok=false,error='RATE_LIMIT'} end
    local id=identifier(source) local room=roomForSource(source)
    if not id or not room or not room.members[id] then return {ok=false,error='NOT_IN_ROOM'} end
    local rs=room.roundState
    if type(data)~='table' or room.state~='round' or not rs or rs.gameId~='vote' then return {ok=false,error='INVALID_ROUND'} end
    if tostring(data.token or '')~=rs.token then return {ok=false,error='ROUND_TOKEN_MISMATCH'} end
    if rs.complete then return {ok=false,error='ROUND_COMPLETE'} end
    if rs.submissions[id] then return {ok=false,error='ALREADY_SUBMITTED'} end
    local targetId=memberIdToIdentifier(room,tostring(data.targetMemberId or ''))
    if not targetId or not room.members[targetId] or room.members[targetId].disconnected then return {ok=false,error='INVALID_TARGET'} end
    if targetId==id then return {ok=false,error='SELF_VOTE_NOT_ALLOWED'} end
    rs.submissions[id]=targetId maybeFinishVote(room)
    notifyRoom(room,source)
    return {ok=true,room=snapshot(room,id)}
end

local function maybeFinishWordWolf(room)
    local rs=room.roundState
    if not rs or rs.gameId~='word_wolf' or rs.complete or completedSubmissionCount(room)<connectedCount(room) then return end
    local counts={}
    for voterId,targetId in pairs(rs.submissions) do
        local voter=room.members[voterId]
        if voter and not voter.disconnected then counts[targetId]=(counts[targetId] or 0)+1 end
    end
    local entries={}
    for id,m in pairs(room.members) do if not m.disconnected then entries[#entries+1]={memberId=m.memberId,name=m.name,votes=counts[id] or 0} end end
    table.sort(entries,function(a,b) if a.votes==b.votes then return a.name<b.name end return a.votes>b.votes end)
    rs.complete=true
    rs.results={entries=entries,wolfMemberId=memberPublicId(room,rs.wolfIdentifier),majorityTopic=rs.majorityTopic,wolfTopic=rs.wolfTopic}
end

function FlecityGamesParty.SubmitWordWolfVote(source,data)
    if not FlecityGamesRateLimit.Allow(source,'word_wolf_vote',300) then return {ok=false,error='RATE_LIMIT'} end
    local id=identifier(source) local room=roomForSource(source)
    if not id or not room or not room.members[id] then return {ok=false,error='NOT_IN_ROOM'} end
    local rs=room.roundState
    if type(data)~='table' or room.state~='round' or not rs or rs.gameId~='word_wolf' then return {ok=false,error='INVALID_ROUND'} end
    if tostring(data.token or '')~=rs.token then return {ok=false,error='ROUND_TOKEN_MISMATCH'} end
    if rs.complete or rs.submissions[id] then return {ok=false,error=rs.complete and 'ROUND_COMPLETE' or 'ALREADY_SUBMITTED'} end
    local targetId=memberIdToIdentifier(room,tostring(data.targetMemberId or ''))
    if not targetId or targetId==id or not room.members[targetId] or room.members[targetId].disconnected then return {ok=false,error='INVALID_TARGET'} end
    rs.submissions[id]=targetId maybeFinishWordWolf(room)
    notifyRoom(room,source)
    return {ok=true,room=snapshot(room,id)}
end

local function maybeFinishLiar(room)
    local rs=room.roundState
    if not rs or rs.gameId~='liar' or rs.complete or completedSubmissionCount(room)<connectedCount(room) then return end
    local counts={}
    for voterId,targetId in pairs(rs.submissions) do
        local voter=room.members[voterId]
        if voter and not voter.disconnected then counts[targetId]=(counts[targetId] or 0)+1 end
    end
    local entries={}
    for id,m in pairs(room.members) do if not m.disconnected then entries[#entries+1]={memberId=m.memberId,name=m.name,votes=counts[id] or 0} end end
    table.sort(entries,function(a,b) if a.votes==b.votes then return a.name<b.name end return a.votes>b.votes end)
    rs.complete=true rs.results={entries=entries,liarMemberId=memberPublicId(room,rs.liarIdentifier),prompt=rs.prompt}
end

function FlecityGamesParty.SubmitLiarVote(source,data)
    if not FlecityGamesRateLimit.Allow(source,'liar_vote',300) then return {ok=false,error='RATE_LIMIT'} end
    local id=identifier(source) local room=roomForSource(source)
    if not id or not room or not room.members[id] then return {ok=false,error='NOT_IN_ROOM'} end
    local rs=room.roundState
    if type(data)~='table' or room.state~='round' or not rs or rs.gameId~='liar' then return {ok=false,error='INVALID_ROUND'} end
    if tostring(data.token or '')~=rs.token then return {ok=false,error='ROUND_TOKEN_MISMATCH'} end
    if rs.complete or rs.submissions[id] then return {ok=false,error=rs.complete and 'ROUND_COMPLETE' or 'ALREADY_SUBMITTED'} end
    local targetId=memberIdToIdentifier(room,tostring(data.targetMemberId or ''))
    if not targetId or targetId==id or not room.members[targetId] or room.members[targetId].disconnected then return {ok=false,error='INVALID_TARGET'} end
    rs.submissions[id]=targetId maybeFinishLiar(room)
    notifyRoom(room,source)
    return {ok=true,room=snapshot(room,id)}
end

local function maybeFinishDraw(room)
    local rs=room.roundState
    if not rs or rs.gameId~='draw' or rs.complete then return end
    local drawer=room.members[rs.drawerIdentifier]
    if not drawer or drawer.disconnected then
        rs.complete=true
        rs.results={aborted=true,reason='DRAWER_LEFT',prompt=rs.prompt,entries={}}
        return
    end
    local needed=0 local guessed=0
    for id,m in pairs(room.members) do
        if not m.disconnected and id~=rs.drawerIdentifier then needed=needed+1 if rs.guessed[id] then guessed=guessed+1 end end
    end
    if guessed<needed then return end
    local entries={}
    for id,m in pairs(room.members) do
        if not m.disconnected and id~=rs.drawerIdentifier and rs.guessed[id] then
            entries[#entries+1]={memberId=m.memberId,name=m.name,guessedAt=rs.guessedAt[id] or 0}
        end
    end
    table.sort(entries,function(a,b) return a.guessedAt<b.guessedAt end)
    for i,e in ipairs(entries) do e.place=i e.guessedAt=nil end
    rs.complete=true rs.results={aborted=false,prompt=rs.prompt,entries=entries,drawerMemberId=drawer.memberId}
end

function FlecityGamesParty.AddDrawStroke(source,data)
    if not FlecityGamesRateLimit.Allow(source,'draw_stroke',80) then return {ok=false,error='RATE_LIMIT'} end
    local id=identifier(source) local room=roomForSource(source)
    if not id or not room or not room.members[id] then return {ok=false,error='NOT_IN_ROOM'} end
    local rs=room.roundState
    if type(data)~='table' or room.state~='round' or not rs or rs.gameId~='draw' then return {ok=false,error='INVALID_ROUND'} end
    if tostring(data.token or '')~=rs.token then return {ok=false,error='ROUND_TOKEN_MISMATCH'} end
    if rs.complete then return {ok=false,error='ROUND_COMPLETE'} end
    if rs.drawerIdentifier~=id then return {ok=false,error='DRAWER_ONLY'} end
    if #(rs.strokes or {})>=160 then return {ok=false,error='DRAW_LIMIT'} end
    local clean=sanitizedStrokes({data.points},1)
    if not clean then return {ok=false,error='INVALID_STROKE'} end
    rs.strokes[#rs.strokes+1]=clean[1]
    notifyRoomEvent(room,source,'flecity_games:client:partyDrawStroke',{
        token=rs.token,
        points=clean[1]
    })
    return {ok=true,room=snapshot(room,id)}
end

function FlecityGamesParty.ClearDrawing(source,data)
    if not FlecityGamesRateLimit.Allow(source,'draw_clear',500) then return {ok=false,error='RATE_LIMIT'} end
    local id=identifier(source) local room=roomForSource(source)
    if not id or not room then return {ok=false,error='NOT_IN_ROOM'} end
    local rs=room.roundState
    if type(data)~='table' or room.state~='round' or not rs or rs.gameId~='draw' then return {ok=false,error='INVALID_ROUND'} end
    if tostring(data.token or '')~=rs.token then return {ok=false,error='ROUND_TOKEN_MISMATCH'} end
    if rs.complete then return {ok=false,error='ROUND_COMPLETE'} end
    if rs.drawerIdentifier~=id then return {ok=false,error='DRAWER_ONLY'} end
    rs.strokes={}
    notifyRoomEvent(room,source,'flecity_games:client:partyDrawClear',{token=rs.token})
    return {ok=true,room=snapshot(room,id)}
end

function FlecityGamesParty.SubmitDrawGuess(source,data)
    if not FlecityGamesRateLimit.Allow(source,'draw_guess',300) then return {ok=false,error='RATE_LIMIT'} end
    local id=identifier(source) local room=roomForSource(source)
    if not id or not room or not room.members[id] then return {ok=false,error='NOT_IN_ROOM'} end
    local rs=room.roundState
    if type(data)~='table' or room.state~='round' or not rs or rs.gameId~='draw' then return {ok=false,error='INVALID_ROUND'} end
    if tostring(data.token or '')~=rs.token then return {ok=false,error='ROUND_TOKEN_MISMATCH'} end
    if rs.complete then return {ok=false,error='ROUND_COMPLETE'} end
    if rs.drawerIdentifier==id then return {ok=false,error='DRAWER_CANNOT_GUESS'} end
    if rs.guessed[id] then return {ok=false,error='ALREADY_GUESSED'} end
    local guess=FlecityGamesText.Normalize(data.guess)
    local guessLength=FlecityGamesText.Length(guess)
    if guessLength<1 or guessLength>40 then return {ok=false,error='INVALID_GUESS'} end
    local correct=string.lower(guess)==string.lower(rs.prompt)
    if correct then
        rs.guessed[id]=true rs.guessedAt[id]=GetGameTimer() rs.submissions[id]=true maybeFinishDraw(room)
        notifyRoom(room,source)
    end
    return {ok=true,correct=correct,room=snapshot(room,id)}
end

local function advanceTelephone(room,toggleMode)
    local rs=room.roundState
    if not rs or rs.gameId~='telephone' or rs.complete then return end
    if toggleMode then rs.mode=rs.mode=='draw' and 'text' or 'draw' end
    while true do
        rs.step=(rs.step or 1)+1
        if rs.step>#(rs.turnOrder or {}) then rs.complete=true rs.currentIdentifier=nil return end
        local candidate=rs.turnOrder[rs.step]
        local member=room.members[candidate]
        if member and not member.disconnected then rs.currentIdentifier=candidate return end
    end
end

local function ensureTelephoneTurn(room)
    local rs=room.roundState
    if not rs or rs.gameId~='telephone' or rs.complete then return end
    local current=rs.currentIdentifier and room.members[rs.currentIdentifier] or nil
    if current and not current.disconnected then return end
    advanceTelephone(room,false)
end

function FlecityGamesParty.SubmitTelephoneDrawing(source,data)
    if not FlecityGamesRateLimit.Allow(source,'telephone_draw',500) then return {ok=false,error='RATE_LIMIT'} end
    local id=identifier(source) local room=roomForSource(source)
    if not id or not room or not room.members[id] then return {ok=false,error='NOT_IN_ROOM'} end
    local rs=room.roundState
    if type(data)~='table' or room.state~='round' or not rs or rs.gameId~='telephone' then return {ok=false,error='INVALID_ROUND'} end
    if tostring(data.token or '')~=rs.token then return {ok=false,error='ROUND_TOKEN_MISMATCH'} end
    ensureTelephoneTurn(room)
    if rs.complete then return {ok=false,error='ROUND_COMPLETE'} end
    if rs.currentIdentifier~=id or rs.mode~='draw' then return {ok=false,error='NOT_YOUR_TURN'} end
    local clean=sanitizedStrokes(data.strokes,80)
    if not clean then return {ok=false,error='INVALID_DRAWING'} end
    rs.chain[#rs.chain+1]={kind='draw',byIdentifier=id,strokes=clean}
    rs.submissions[id]=(rs.submissions[id] or 0)+1
    advanceTelephone(room,true)
    notifyRoom(room,source)
    return {ok=true,room=snapshot(room,id)}
end

function FlecityGamesParty.SubmitTelephoneText(source,data)
    if not FlecityGamesRateLimit.Allow(source,'telephone_text',500) then return {ok=false,error='RATE_LIMIT'} end
    local id=identifier(source) local room=roomForSource(source)
    if not id or not room or not room.members[id] then return {ok=false,error='NOT_IN_ROOM'} end
    local rs=room.roundState
    if type(data)~='table' or room.state~='round' or not rs or rs.gameId~='telephone' then return {ok=false,error='INVALID_ROUND'} end
    if tostring(data.token or '')~=rs.token then return {ok=false,error='ROUND_TOKEN_MISMATCH'} end
    ensureTelephoneTurn(room)
    if rs.complete then return {ok=false,error='ROUND_COMPLETE'} end
    if rs.currentIdentifier~=id or rs.mode~='text' then return {ok=false,error='NOT_YOUR_TURN'} end
    local value=FlecityGamesText.Normalize(data.text)
    local textLength=FlecityGamesText.Length(value)
    if textLength<1 or textLength>80 then return {ok=false,error='INVALID_TEXT'} end
    rs.chain[#rs.chain+1]={kind='text',byIdentifier=id,text=value}
    rs.submissions[id]=(rs.submissions[id] or 0)+1
    advanceTelephone(room,true)
    notifyRoom(room,source)
    return {ok=true,room=snapshot(room,id)}
end

function FlecityGamesParty.ReturnLobby(source)
    if not FlecityGamesRateLimit.Allow(source,'room_action',FlecityGamesConfig.RateLimits.RoomActionMs) then return {ok=false,error='RATE_LIMIT'} end
    local id=identifier(source) local room=roomForSource(source)
    if not id or not room then return {ok=false,error='NOT_IN_ROOM'} end
    if room.hostIdentifier~=id then return {ok=false,error='HOST_ONLY'} end
    room.state='lobby' room.roundState=nil
    for _,m in pairs(room.members) do m.ready=false end
    notifyRoom(room,source)
    return {ok=true,room=snapshot(room,id)}
end

local function abortRound(room,reason)
    local rs=room and room.roundState or nil
    if not rs or rs.complete then return false end
    rs.complete=true
    rs.results={aborted=true,reason=reason or 'ROUND_ABORTED'}
    return true
end

local function reconcileRound(room)
    local rs=room.roundState
    if not rs or rs.complete then return end

    local game=partyGame(rs.gameId)
    local minimum=game and tonumber(game.minPlayers) or FlecityGamesConfig.Party.MinPlayers
    local continuationMinimum=rs.gameId=='telephone' and 2 or minimum
    if connectedCount(room)<math.max(1,continuationMinimum or 1) then
        abortRound(room,'NOT_ENOUGH_PLAYERS')
        return
    end

    if rs.gameId=='word_wolf' then
        local wolf=rs.wolfIdentifier and room.members[rs.wolfIdentifier] or nil
        if not wolf or wolf.disconnected then abortRound(room,'SECRET_PLAYER_LEFT') return end
    elseif rs.gameId=='liar' then
        local liar=rs.liarIdentifier and room.members[rs.liarIdentifier] or nil
        if not liar or liar.disconnected then abortRound(room,'SECRET_PLAYER_LEFT') return end
    end

    if rs.gameId=='reaction' then maybeFinishReaction(room)
    elseif rs.gameId=='stop_battle' then maybeFinishStopBattle(room)
    elseif rs.gameId=='vote' then maybeFinishVote(room)
    elseif rs.gameId=='majority' then maybeFinishMajority(room)
    elseif rs.gameId=='word_wolf' then maybeFinishWordWolf(room)
    elseif rs.gameId=='liar' then maybeFinishLiar(room)
    elseif rs.gameId=='draw' then maybeFinishDraw(room)
    elseif rs.gameId=='telephone' then ensureTelephoneTurn(room)
    end
end

function FlecityGamesParty.LeaveRoom(source)
    local id=identifier(source) local room=roomForSource(source)
    if not id or not room then return {ok=true} end
    removeMember(room,id)
    if rooms[room.id] then
        reconcileRound(room)
        notifyRoom(room)
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
    migrateHost(room) reconcileRound(room) notifyRoom(room)
end

function FlecityGamesParty.Cleanup()
    local now=os.time()
    local roomIds={} for roomId in pairs(rooms) do roomIds[#roomIds+1]=roomId end
    for _,roomId in ipairs(roomIds) do
        local room=rooms[roomId]
        if room then
            local expired=now-room.createdAt>FlecityGamesConfig.Party.RoomMaxAgeSeconds
            local removals={}
            for id,m in pairs(room.members) do
                if expired or (m.disconnected and m.disconnectedAt and now-m.disconnectedAt>FlecityGamesConfig.Party.DisconnectGraceSeconds) then removals[#removals+1]=id end
            end
            local changed=#removals>0
            for _,id in ipairs(removals) do if rooms[roomId] then removeMember(room,id) end end
            if rooms[roomId] then
                migrateHost(room) reconcileRound(room)
                if changed then notifyRoom(room) end
            end
        end
    end
end

function FlecityGamesParty.DebugSelftest()
    local revisionRoom={revision=3}
    local revisionValue=bumpRoom(revisionRoom)

    local hostRoom={
        hostIdentifier='host',
        members={
            host={disconnected=true,joinOrder=1},
            second={disconnected=false,joinOrder=2},
            third={disconnected=false,joinOrder=3}
        }
    }
    migrateHost(hostRoom)

    local members={
        a={memberId='A',name='Alpha',disconnected=false,joinOrder=1},
        b={memberId='B',name='Bravo',disconnected=false,joinOrder=2},
        c={memberId='C',name='Charlie',disconnected=false,joinOrder=3}
    }

    local wolfRoom={members=members,roundState={
        token='wolf',gameId='word_wolf',startedAt=0,startedTick=0,complete=false,submissions={},
        topics={a='猫',b='猫',c='犬'},wolfIdentifier='c',majorityTopic='猫',wolfTopic='犬'
    }}
    local wolfA=publicRoundState(wolfRoom,'a')
    local wolfC=publicRoundState(wolfRoom,'c')

    local liarRoom={members=members,roundState={
        token='liar',gameId='liar',startedAt=0,startedTick=0,complete=false,submissions={},
        prompt='質問',roles={a='TRUTH',b='LIAR',c='TRUTH'},liarIdentifier='b'
    }}
    local liarA=publicRoundState(liarRoom,'a')
    local liarB=publicRoundState(liarRoom,'b')

    local drawRoom={members=members,roundState={
        token='draw',gameId='draw',startedAt=0,startedTick=0,complete=false,submissions={},
        drawerIdentifier='a',prompt='猫',strokes={},guessed={}
    }}
    local drawA=publicRoundState(drawRoom,'a')
    local drawB=publicRoundState(drawRoom,'b')

    local telephoneRoom={members=members,roundState={
        token='tel',gameId='telephone',startedAt=0,startedTick=0,complete=false,submissions={},
        turnOrder={'a','b','c'},step=1,mode='draw',currentIdentifier='a',
        chain={{kind='text',text='秘密のお題'}}
    }}
    local telephoneA=publicRoundState(telephoneRoom,'a')
    local telephoneB=publicRoundState(telephoneRoom,'b')

    local majorityRoom={members=members,roundState={
        token='majority',gameId='majority',startedAt=0,startedTick=0,complete=false,
        submissions={a='A',b='A',c='B'},prompt='test',options={'one','two'}
    }}
    maybeFinishMajority(majorityRoom)

    local reactionRoom={members=members,roundState={
        token='reaction',gameId='reaction',startedAt=0,startedTick=0,complete=false,
        submissions={
            a={flying=false,reactionMs=220},
            b={flying=true,reactionMs=nil},
            c={flying=false,reactionMs=180}
        }
    }}
    maybeFinishReaction(reactionRoom)

    local stopRoom={members=members,roundState={
        token='stop',gameId='stop_battle',startedAt=0,startedTick=0,complete=false,
        submissions={
            a={score=800,distancePct=20,markerPct=30},
            b={score=900,distancePct=10,markerPct=40},
            c={score=700,distancePct=30,markerPct=20}
        },
        targetPct=50
    }}
    maybeFinishStopBattle(stopRoom)

    local voteRoom={members=members,roundState={
        token='vote',gameId='vote',startedAt=0,startedTick=0,complete=false,
        submissions={a='b',b='c',c='b'}
    }}
    maybeFinishVote(voteRoom)

    local disconnectedVoteMembers={
        a={memberId='A',name='Alpha',disconnected=false,joinOrder=1},
        b={memberId='B',name='Bravo',disconnected=true,joinOrder=2},
        c={memberId='C',name='Charlie',disconnected=false,joinOrder=3}
    }
    local disconnectedVoteRoom={members=disconnectedVoteMembers,roundState={
        token='vote-disconnect',gameId='vote',startedAt=0,startedTick=0,complete=false,
        submissions={a='c',b='a',c='a'}
    }}
    maybeFinishVote(disconnectedVoteRoom)

    drawRoom.roundState.guessed={b=true,c=true}
    drawRoom.roundState.guessedAt={b=100,c=200}
    drawRoom.roundState.submissions={b=true,c=true}
    maybeFinishDraw(drawRoom)

    local lowPlayerRoom={members={
        a={memberId='A',name='Alpha',disconnected=false,joinOrder=1},
        b={memberId='B',name='Bravo',disconnected=true,joinOrder=2}
    },roundState={
        token='low-player',gameId='reaction',startedAt=0,startedTick=0,complete=false,submissions={}
    }}
    reconcileRound(lowPlayerRoom)

    local secretLeftRoom={members={
        a={memberId='A',name='Alpha',disconnected=false,joinOrder=1},
        b={memberId='B',name='Bravo',disconnected=false,joinOrder=2},
        c={memberId='C',name='Charlie',disconnected=true,joinOrder=3},
        d={memberId='D',name='Delta',disconnected=false,joinOrder=4}
    },roundState={
        token='secret-left',gameId='word_wolf',startedAt=0,startedTick=0,complete=false,submissions={},
        topics={a='猫',b='猫',c='犬',d='猫'},wolfIdentifier='c',majorityTopic='猫',wolfTopic='犬'
    }}
    reconcileRound(secretLeftRoom)

    local telephoneSkipMembers={
        a={memberId='A',name='Alpha',disconnected=false,joinOrder=1},
        b={memberId='B',name='Bravo',disconnected=true,joinOrder=2},
        c={memberId='C',name='Charlie',disconnected=false,joinOrder=3}
    }
    local telephoneSkipRoom={members=telephoneSkipMembers,roundState={
        token='tel-skip',gameId='telephone',startedAt=0,startedTick=0,complete=false,submissions={},
        turnOrder={'a','b','c'},step=1,mode='draw',currentIdentifier='a',
        chain={{kind='text',text='秘密のお題'}}
    }}
    advanceTelephone(telephoneSkipRoom,true)
    reconcileRound(telephoneSkipRoom)

    return {
        roomRevision=revisionValue==4 and revisionRoom.revision==4,
        hostMigration=hostRoom.hostIdentifier=='second',
        connectedCount=connectedCount(hostRoom)==2,
        memberCount=memberCount(hostRoom)==3,
        stopMidpoint=math.abs(trianglePosition(450,1800,0)-50)<0.001,
        majorityPrompts=#majorityPrompts>=4,
        majorityAggregation=majorityRoom.roundState.complete==true and majorityRoom.roundState.results.counts.A==2 and majorityRoom.roundState.results.counts.B==1,
        reactionRanking=reactionRoom.roundState.complete==true
            and reactionRoom.roundState.results.entries[1].memberId=='C'
            and reactionRoom.roundState.results.entries[2].memberId=='A'
            and reactionRoom.roundState.results.entries[3].memberId=='B',
        stopBattleRanking=stopRoom.roundState.complete==true and stopRoom.roundState.results.entries[1].memberId=='B',
        voteAggregation=voteRoom.roundState.complete==true
            and voteRoom.roundState.results.entries[1].memberId=='B'
            and voteRoom.roundState.results.entries[1].votes==2,
        disconnectedVoteIgnored=disconnectedVoteRoom.roundState.complete==true
            and disconnectedVoteRoom.roundState.results.entries[1].memberId=='A'
            and disconnectedVoteRoom.roundState.results.entries[1].votes==1
            and disconnectedVoteRoom.roundState.results.entries[2].memberId=='C'
            and disconnectedVoteRoom.roundState.results.entries[2].votes==1,
        wordWolfPrompts=#wordWolfPairs>=6,
        wordWolfPrivacy=wolfA.secretTopic=='猫' and wolfC.secretTopic=='犬' and wolfA.topics==nil and wolfC.topics==nil,
        liarPrompts=#liarPrompts>=4,
        liarPrivacy=liarA.role=='TRUTH' and liarB.role=='LIAR' and liarA.roles==nil and liarB.roles==nil,
        drawPrompts=#drawPrompts>=8,
        drawPrivacy=drawA.prompt=='猫' and drawB.prompt==nil and drawA.isDrawer==true and drawB.isDrawer==false,
        drawCompletion=drawRoom.roundState.complete==true
            and #drawRoom.roundState.results.entries==2
            and drawRoom.roundState.results.entries[1].memberId=='B',
        roundAbortLowPlayers=lowPlayerRoom.roundState.complete==true
            and lowPlayerRoom.roundState.results.reason=='NOT_ENOUGH_PLAYERS',
        secretRoleDisconnectAbort=secretLeftRoom.roundState.complete==true
            and secretLeftRoom.roundState.results.reason=='SECRET_PLAYER_LEFT',
        telephonePrompts=#telephonePrompts>=6,
        telephonePrivacy=telephoneA.promptText=='秘密のお題' and telephoneB.promptText==nil and telephoneA.isCurrent==true and telephoneB.isCurrent==false,
        telephoneDisconnectSkip=telephoneSkipRoom.roundState.step==3
            and telephoneSkipRoom.roundState.currentIdentifier=='c'
            and telephoneSkipRoom.roundState.mode=='text',
        telephoneContinuesWithTwo=telephoneSkipRoom.roundState.complete~=true
    }
end

function FlecityGamesParty.DebugCounts()
    local roomCount,memberTotal=0,0
    for _,room in pairs(rooms) do roomCount=roomCount+1 memberTotal=memberTotal+memberCount(room) end
    return roomCount,memberTotal
end
