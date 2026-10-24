FlecityGamesParty = FlecityGamesParty or {}

local rooms,roomsByCode,sourceToRoom={},{},{}
local nextJoinOrder=0
local reconcileRound

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
    '一番長距離ドライブを楽しみそうなのは？',
    '急にイベントを主催しても成功させそうなのは？',
    '一番寝坊しそうなのは？',
    '一番サプライズが上手そうなのは？',
    '知らない人ともすぐ仲良くなれそうなのは？',
    '一番財布を忘れて出かけそうなのは？',
    'ゾンビ映画で最後まで生き残りそうなのは？',
    '一番部屋がきれいそうなのは？',
    '一番勢いで高い買い物をしそうなのは？',
    '困った時に最初に相談したいのは？',
    '一番ゲームで負けず嫌いそうなのは？',
    '一番SNSでバズりそうなのは？',
    '一番早く新しい仕事を覚えそうなのは？'
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
    {question='買い物するなら？',options={'店舗','オンライン'}},
    {question='遊ぶなら？',options={'大人数','少人数'}},
    {question='予定を決めるなら？',options={'前もって決める','当日に決める'}},
    {question='プレゼントなら？',options={'実用品','サプライズ品'}},
    {question='住むなら？',options={'都会','郊外'}},
    {question='移動するなら？',options={'自分で運転','誰かに乗せてもらう'}},
    {question='飲むなら？',options={'コーヒー','お茶'}},
    {question='休日の起床は？',options={'早起き','昼まで寝る'}},
    {question='挑戦するなら？',options={'安全に確実','リスクを取る'}},
    {question='記念に残すなら？',options={'写真','動画'}},
    {question='食事するなら？',options={'新しい店','いつもの店'}},
    {question='パーティーなら？',options={'主催する','参加する'}},
    {question='作業するなら？',options={'一気に終わらせる','少しずつ進める'}}
}
local wordWolfPairs={
    {'コーヒー','紅茶'},{'海','プール'},{'猫','犬'},{'警察','救急隊'},{'スポーツカー','バイク'},
    {'寿司','焼肉'},{'映画館','ライブ会場'},{'朝','夜'},{'雨','雪'},{'写真','動画'},
    {'ハンバーガー','ピザ'},{'電車','バス'},{'山','森'},{'夏','冬'},{'電話','メッセージ'},
    {'カメラ','双眼鏡'},{'ホテル','キャンプ'},{'サッカー','バスケットボール'},{'ケーキ','アイス'},
    {'本屋','図書館'},{'飛行機','ヘリコプター'},{'花火','イルミネーション'},{'川','湖'},
    {'朝ごはん','夜食'},{'ゲーム','映画'},{'コンビニ','スーパー'},{'ラーメン','うどん'},
    {'財布','スマホ'},{'エレベーター','エスカレーター'},{'温泉','プール'},{'公園','遊園地'},
    {'タクシー','バス'},{'コーラ','エナジードリンク'},{'パスタ','カレー'},{'春','秋'},
    {'デスクトップPC','ノートPC'},{'イヤホン','ヘッドホン'},{'野球','テニス'},{'時計','スマートウォッチ'},
    {'パンケーキ','ワッフル'}
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
    'Flecityで友達を案内するなら最初にどこへ行く？',
    '今までで一番高かった買い物は？',
    '1週間休みがあったら何をする？',
    '得意なゲームジャンルは？',
    '誰にも負けないと思う小さな特技は？',
    '夜中にお腹が空いたら何を食べる？',
    '雨の日にしたいことは？',
    '車の色を自由に選ぶなら何色？',
    '無人島に1つ持っていくなら何？',
    '最近ほしいと思った服や小物は？',
    '1日だけ透明人間になれたら何をする？',
    '友達と集まった時に一番やりたいことは？',
    '自分を動物に例えるなら何？'
}
local drawPrompts={
    '猫','車','ピザ','飛行機','魚','スマホ','家','木','カメラ','時計','サメ','ハンバーガー',
    '犬','バイク','船','太陽','月','傘','帽子','ケーキ','コーヒー','花','ギター','ヘリコプター',
    '信号機','橋','山','テレビ','鍵','メガネ','靴','雪だるま','風船','救急車','パトカー','ドーナツ',
    'りんご','バナナ','ラーメン','電車','バス','タクシー','ロケット','宇宙人','ロボット','王冠',
    '指輪','プレゼント','本','パソコン','イヤホン','冷蔵庫','ベッド','ソファ','自転車','スケートボード',
    '富士山','虹','雲','星'
}
local drawPromptAliases={
    ['猫']={'ねこ','ネコ'},['車']={'くるま','自動車'},['飛行機']={'ひこうき'},['魚']={'さかな'},
    ['スマホ']={'スマートフォン','携帯','携帯電話'},['家']={'いえ'},['木']={'き'},['時計']={'とけい'},
    ['ハンバーガー']={'バーガー'},['犬']={'いぬ','イヌ'},['バイク']={'オートバイ','二輪車'},['船']={'ふね'},
    ['太陽']={'たいよう'},['月']={'つき'},['傘']={'かさ'},['帽子']={'ぼうし'},['花']={'はな'},
    ['ヘリコプター']={'ヘリ'},['信号機']={'信号'},['橋']={'はし'},['山']={'やま'},['テレビ']={'TV','tv'},
    ['鍵']={'かぎ','キー'},['メガネ']={'めがね','眼鏡'},['靴']={'くつ'},['雪だるま']={'ゆきだるま','雪ダルマ'},
    ['風船']={'ふうせん'},['救急車']={'きゅうきゅうしゃ'},['パトカー']={'警察車両'},['ドーナツ']={'ドーナッツ'},
    ['りんご']={'リンゴ','林檎'},['バナナ']={'banana'},['電車']={'でんしゃ'},['バス']={'bus'},['タクシー']={'taxi'},
    ['ロケット']={'rocket'},['宇宙人']={'うちゅうじん'},['ロボット']={'robot'},['王冠']={'クラウン'},
    ['指輪']={'リング'},['本']={'ほん'},['パソコン']={'PC','pc'},['イヤホン']={'earphone'},['自転車']={'チャリ','じてんしゃ'},
    ['虹']={'にじ'},['雲']={'くも'},['星']={'ほし'}
}

local function normalizedDrawAnswer(value)
    return string.lower(FlecityGamesText.Normalize(value)):gsub('%s+','')
end

local function drawGuessMatches(prompt,guess)
    local target=normalizedDrawAnswer(prompt)
    local answer=normalizedDrawAnswer(guess)
    if target=='' or answer=='' then return false end
    if answer==target then return true end
    for _,alias in ipairs(drawPromptAliases[prompt] or {}) do
        if answer==normalizedDrawAnswer(alias) then return true end
    end
    return false
end

local function normalizedPartyAnswer(value)
    return string.lower(FlecityGamesText.Normalize(value)):gsub('%s+','')
end

local function containsPartyTerm(text,term)
    local haystack=normalizedPartyAnswer(text)
    local needle=normalizedPartyAnswer(term)
    return needle~='' and haystack:find(needle,1,true)~=nil
end

local function shuffledCopy(values)
    local out={}
    for i,value in ipairs(values or {}) do out[i]=value end
    for i=#out,2,-1 do
        local j=math.random(1,i)
        out[i],out[j]=out[j],out[i]
    end
    return out
end

local memoryChainSymbols={'A','B','C','D'}
local function newMemorySequence(stage)
    local length=math.min(10,2+math.max(1,tonumber(stage) or 1))
    local sequence={}
    for i=1,length do sequence[i]=memoryChainSymbols[math.random(1,#memoryChainSymbols)] end
    return sequence
end

local function memoryRevealSeconds(sequence)
    return math.max(3,math.min(6,2+(#(sequence or {})*0.4)))
end

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
    '救急車が海辺でアイスを売っている',
    '宇宙人がコンビニで買い物をしている',
    '猫がバイクの後ろに乗っている',
    'ロボットがラーメンを作っている',
    '犬が大きなプレゼントを開けている',
    '電車の屋根に雪だるまが乗っている',
    '魚が空を飛ぶ飛行機を見上げている',
    '王冠をかぶった猫がソファで寝ている',
    '雨の中でロボットが傘をさしている',
    '宇宙人がタクシーを運転している',
    '自転車で巨大なドーナツを運んでいる',
    '虹の下で犬と猫が写真を撮っている',
    '冷蔵庫の中から風船が飛び出している',
    '星空の下でパトカーがキャンプしている',
    'ロケットにピザを届けるバイク便'
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
    for value=0,maximum do
        local code=formatString:format(value)
        if not roomsByCode[code] then return code end
    end
end
local function memberCount(room) local n=0 for _ in pairs(room.members) do n=n+1 end return n end
local function connectedCount(room) local n=0 for _,m in pairs(room.members) do if not m.disconnected then n=n+1 end end return n end
local function activeCount(room) local n=0 for _,m in pairs(room.members) do if not m.disconnected and m.appOpen~=false then n=n+1 end end return n end
local function connectedIdentifiers(room)
    local list={}
    for id,m in pairs(room.members) do if not m.disconnected then list[#list+1]={id=id,joinOrder=m.joinOrder} end end
    table.sort(list,function(a,b) return a.joinOrder<b.joinOrder end)
    local out={} for _,entry in ipairs(list) do out[#out+1]=entry.id end
    return out
end

local function rotatedIdentifiers(ids,startIndex)
    if type(ids)~='table' or #ids<1 then return {} end
    local start=math.max(1,math.min(#ids,math.floor(tonumber(startIndex) or 1)))
    local out={}
    for offset=0,#ids-1 do out[#out+1]=ids[((start-1+offset)%#ids)+1] end
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

local function roundTimeoutSeconds(gameId)
    local limits={
        reaction=12,stop_battle=25,vote=60,majority=45,minority=45,
        tic_tac=45,word_wolf=150,liar=150,draw=90,telephone=45,ng_word=45,fake_answer=60,bomb=10,memory_chain=15
    }
    return limits[tostring(gameId or '')] or 90
end

local function telephoneTurnTimeoutSeconds(mode)
    return mode=='text' and 30 or 45
end

local function setRoundDeadline(rs,seconds)
    if not rs then return end
    local duration=math.max(5,math.floor(tonumber(seconds) or roundTimeoutSeconds(rs.gameId)))
    rs.deadlineDurationSec=duration
    rs.deadlineTick=GetGameTimer()+(duration*1000)
end

local function ticTacWinner(board)
    local lines={{1,2,3},{4,5,6},{7,8,9},{1,4,7},{2,5,8},{3,6,9},{1,5,9},{3,5,7}}
    for _,line in ipairs(lines) do
        local a,b,c=line[1],line[2],line[3]
        local mark=board and board[a] or nil
        if mark and mark~='' and board[b]==mark and board[c]==mark then return mark end
    end
    return nil
end

local function ticTacFull(board)
    for i=1,9 do if not board[i] or board[i]=='' then return false end end
    return true
end

local function pickRoomPrompt(room,key,pool)
    if type(pool)~='table' or #pool<1 then return nil end
    room.promptIndexes=room.promptIndexes or {}
    local previous=tonumber(room.promptIndexes[key])
    local index
    if previous and previous>=1 and previous<=#pool and #pool>1 then
        local roll=math.random(1,#pool-1)
        index=roll>=previous and (roll+1) or roll
    else
        index=math.random(1,#pool)
    end
    room.promptIndexes[key]=index
    return pool[index]
end

local function bestHostCandidate(room,excludeId,requireAppOpen)
    local selected
    for id,m in pairs(room and room.members or {}) do
        local appEligible=not requireAppOpen or m.appOpen~=false
        if id~=excludeId and not m.disconnected and appEligible
            and (not selected or m.joinOrder<selected.member.joinOrder) then
            selected={id=id,member=m}
        end
    end
    return selected
end

local function migrateHost(room)
    if room.hostIdentifier and room.members[room.hostIdentifier] and not room.members[room.hostIdentifier].disconnected then return end
    local selected=bestHostCandidate(room,nil,true) or bestHostCandidate(room,nil,false)
    room.hostIdentifier=selected and selected.id or nil
end

local function handoffHostFrom(room,fromId)
    if not room or room.hostIdentifier~=fromId then return false end
    local selected=bestHostCandidate(room,fromId,true)
    if not selected then return false end
    room.hostIdentifier=selected.id
    return true
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
    member.appOpen=true
    if room.state=='lobby' then member.ready=false end
    sourceToRoom[src]=room.id
    local hostId=room.hostIdentifier
    local host=hostId and room.members[hostId] or nil
    if hostId~=id and host and host.appOpen==false then
        handoffHostFrom(room,hostId)
    end
    migrateHost(room)
    return true
end
local function reclaimDisconnectedCapacity(room,maxPlayers)
    local limit=math.max(1,math.floor(tonumber(maxPlayers) or FlecityGamesConfig.Party.MaxPlayers))
    if memberCount(room)<limit then return 0 end
    local now=os.time()
    local grace=math.max(0,math.floor(tonumber(FlecityGamesConfig.Party.DisconnectGraceSeconds) or 60))
    local candidates={}
    for id,m in pairs(room.members) do
        local disconnectedAt=tonumber(m.disconnectedAt)
        if m.disconnected and disconnectedAt and now-disconnectedAt>grace then
            candidates[#candidates+1]={id=id,disconnectedAt=disconnectedAt,joinOrder=tonumber(m.joinOrder) or 0}
        end
    end
    table.sort(candidates,function(a,b)
        if a.disconnectedAt==b.disconnectedAt then return a.joinOrder<b.joinOrder end
        return a.disconnectedAt<b.disconnectedAt
    end)
    local removed=0
    for _,entry in ipairs(candidates) do
        if memberCount(room)<limit then break end
        removeMember(room,entry.id)
        removed=removed+1
    end
    return removed
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

local function sanitizedStrokes(strokes,maxStrokes,maxPoints)
    if type(strokes)~='table' or #strokes<1 or #strokes>(maxStrokes or 80) then return nil end
    local clean={} local totalPoints=0
    for _,stroke in ipairs(strokes) do
        if type(stroke)~='table' or #stroke<2 or #stroke>48 then return nil end
        totalPoints=totalPoints+#stroke
        if maxPoints and totalPoints>maxPoints then return nil end
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

local function strokePointCount(strokes)
    local total=0
    for _,stroke in ipairs(strokes or {}) do total=total+(type(stroke)=='table' and #stroke or 0) end
    return total
end

local function telephonePublicChain(room,rs)
    local out={}
    for _,entry in ipairs(rs.chain or {}) do
        local contributor=entry.byName or (entry.byIdentifier and memberName(room,entry.byIdentifier)) or 'START'
        local item={kind=entry.kind,name=contributor}
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
        deadlineTick=rs.deadlineTick,deadlineDurationSec=rs.deadlineDurationSec,
        complete=rs.complete==true,selfSubmitted=rs.submissions and rs.submissions[viewerId]~=nil or false
    }
    if rs.gameId=='reaction' or rs.gameId=='stop_battle' or rs.gameId=='vote'
        or rs.gameId=='majority' or rs.gameId=='minority'
        or rs.gameId=='word_wolf' or rs.gameId=='liar' then
        local submitted=0
        for id,m in pairs(room.members or {}) do
            if not m.disconnected and m.appOpen~=false and rs.submissions and rs.submissions[id]~=nil then submitted=submitted+1 end
        end
        out.submittedCount=submitted
        out.expectedSubmissions=activeCount(room)
    end
    if rs.gameId=='reaction' then out.revealAfterMs=rs.revealAfterMs end
    if rs.gameId=='vote' then out.prompt=rs.prompt end
    if rs.gameId=='stop_battle' then
        out.targetPct=rs.targetPct out.periodMs=rs.periodMs out.phaseMs=rs.phaseMs out.motionStartTick=rs.motionStartTick
    end
    if rs.gameId=='majority' or rs.gameId=='minority' then out.prompt=rs.prompt out.options=rs.options end
    if rs.gameId=='tic_tac' then
        out.board=rs.board or {}
        out.currentMemberId=memberPublicId(room,rs.currentIdentifier)
        out.isCurrent=viewerId==rs.currentIdentifier
        out.symbol=rs.symbols and rs.symbols[viewerId] or nil
    end
    if rs.gameId=='word_wolf' then
        out.secretTopic=rs.topics and rs.topics[viewerId] or nil
        out.voteUnlockTick=rs.voteUnlockTick
    end
    if rs.gameId=='liar' then
        out.prompt=rs.prompt out.role=rs.roles and rs.roles[viewerId] or nil
        out.voteUnlockTick=rs.voteUnlockTick
    end
    if rs.gameId=='draw' then
        out.isDrawer=viewerId==rs.drawerIdentifier
        out.drawerMemberId=memberPublicId(room,rs.drawerIdentifier)
        out.prompt=viewerId==rs.drawerIdentifier and rs.prompt or nil
        out.strokes=rs.strokes or {}
        out.selfGuessed=rs.guessed and rs.guessed[viewerId]==true or false
        local guessedCount=0
        for guessedId in pairs(rs.guessed or {}) do
            local guessedMember=room.members[guessedId]
            if guessedMember and not guessedMember.disconnected and guessedMember.appOpen~=false and guessedId~=rs.drawerIdentifier then guessedCount=guessedCount+1 end
        end
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
    if rs.gameId=='ng_word' then
        out.phase=rs.phase
        out.explainerMemberId=memberPublicId(room,rs.explainerIdentifier)
        out.isExplainer=viewerId==rs.explainerIdentifier
        if out.isExplainer then
            out.targetWord=rs.targetWord
            out.forbiddenWords=rs.forbiddenWords
        end
        if rs.phase=='guess' then
            out.clue=rs.clue
            out.selfSubmitted=rs.guesses and rs.guesses[viewerId]~=nil or false
            local submitted,expected=0,0
            for playerId,m in pairs(room.members or {}) do
                if not m.disconnected and m.appOpen~=false and playerId~=rs.explainerIdentifier then
                    expected=expected+1
                    if rs.guesses and rs.guesses[playerId]~=nil then submitted=submitted+1 end
                end
            end
            out.submittedCount=submitted
            out.expectedSubmissions=expected
        end
    end
    if rs.gameId=='bomb' then
        out.prompt=rs.prompt
        out.currentMemberId=memberPublicId(room,rs.currentIdentifier)
        out.isCurrent=viewerId==rs.currentIdentifier
        out.passes=tonumber(rs.passes) or 0
    end
    if rs.gameId=='memory_chain' then
        out.phase=rs.phase
        out.stage=tonumber(rs.stage) or 1
        out.maxStages=tonumber(rs.maxStages) or 8
        out.sequenceLength=#(rs.sequence or {})
        out.selfEliminated=rs.eliminated and rs.eliminated[viewerId]~=nil or false
        if rs.phase=='memorize' then out.sequence=rs.sequence end
        if rs.phase=='input' then
            out.selfSubmitted=rs.stageSubmissions and rs.stageSubmissions[viewerId]~=nil or false
            local submitted,expected=0,0
            for playerId,m in pairs(room.members or {}) do
                if not m.disconnected and not (rs.eliminated and rs.eliminated[playerId]) then
                    expected=expected+1
                    if rs.stageSubmissions and rs.stageSubmissions[playerId]~=nil then submitted=submitted+1 end
                end
            end
            out.submittedCount=submitted
            out.expectedSubmissions=expected
        end
        local alive=0
        for playerId,m in pairs(room.members or {}) do
            if not m.disconnected and not (rs.eliminated and rs.eliminated[playerId]) then alive=alive+1 end
        end
        out.aliveCount=alive
    end
    if rs.gameId=='fall_battle' then
        out.seed=rs.seed
        out.width=rs.width
        out.height=rs.height
        out.selfSubmitted=rs.submissions and rs.submissions[viewerId]~=nil or false
        local submitted=0
        for playerId,m in pairs(room.members or {}) do
            if not m.disconnected and m.appOpen~=false and rs.submissions and rs.submissions[playerId]~=nil then submitted=submitted+1 end
        end
        out.submittedCount=submitted
        out.expectedSubmissions=activeCount(room)
    end
    if rs.gameId=='fake_answer' then
        out.phase=rs.phase
        out.question=rs.question
        if rs.phase=='submit' then
            out.selfSubmitted=rs.fakeAnswers and rs.fakeAnswers[viewerId]~=nil or false
            local submitted=0
            for playerId,m in pairs(room.members or {}) do
                if not m.disconnected and m.appOpen~=false and rs.fakeAnswers and rs.fakeAnswers[playerId]~=nil then submitted=submitted+1 end
            end
            out.submittedCount=submitted
            out.expectedSubmissions=activeCount(room)
        elseif rs.phase=='vote' then
            out.selfSubmitted=rs.votes and rs.votes[viewerId]~=nil or false
            out.options={}
            for _,option in ipairs(rs.options or {}) do
                out.options[#out.options+1]={
                    id=option.id,
                    text=option.text,
                    own=option.creatorIdentifier==viewerId
                }
            end
            local submitted=0
            for playerId,m in pairs(room.members or {}) do
                if not m.disconnected and m.appOpen~=false and rs.votes and rs.votes[playerId]~=nil then submitted=submitted+1 end
            end
            out.submittedCount=submitted
            out.expectedSubmissions=activeCount(room)
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
        players[#players+1]={memberId=m.memberId,name=m.name,ready=m.ready==true,disconnected=m.disconnected==true,appOpen=m.appOpen~=false,isHost=id==room.hostIdentifier,joinOrder=m.joinOrder}
    end
    table.sort(players,function(a,b) return a.joinOrder<b.joinOrder end)
    local selfMember=room.members[viewerId]
    return {
        code=room.code,revision=tonumber(room.revision) or 0,state=room.state,round=room.round,selectedGame=room.selectedGame,players=players,
        playerCount=#players,connectedCount=connectedCount(room),maxPlayers=FlecityGamesConfig.Party.MaxPlayers,
        isHost=viewerId==room.hostIdentifier,selfReady=selfMember and selfMember.ready==true or false,
        selfMemberId=selfMember and selfMember.memberId or nil,createdAt=room.createdAt,serverTick=GetGameTimer(),
        hostPlusActive=FlecityGamesPartyPlus.CachedActive(room.hostIdentifier),
        roundState=publicRoundState(room,viewerId)
    }
end

local function bumpRoom(room)
    if not room then return 0 end
    room.revision=(tonumber(room.revision) or 0)+1
    room.lastActivityAt=os.time()
    return room.revision
end

local function notifyRoom(room,excludeSource)
    if not room or not rooms[room.id] then return end
    bumpRoom(room)
    local excluded=excludeSource and tonumber(excludeSource) or nil
    for viewerId,member in pairs(room.members) do
        local src=member.source and tonumber(member.source) or nil
        if src and not member.disconnected and member.appOpen~=false and src~=excluded then
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
        if src and not member.disconnected and member.appOpen~=false and src~=excluded then
            TriggerClientEvent(eventName,src,payload)
        end
    end
end

local function roomForPlayer(source,id,allowClosed)
    local src=tonumber(source)
    local room=roomForSource(src)
    if not room then return nil end

    local member=id and room.members[id] or nil
    if member and tonumber(member.source)==src and not member.disconnected then
        -- Membership lookup must not imply that the PARTY UI is open.
        -- A callback already in flight can arrive after AppClosed. Normal callbacks are
        -- rejected while closed so delayed Ready/Start/submit traffic cannot mutate state.
        -- GetRoom is the only callback allowed to observe a closed membership and reopen it.
        if member.appOpen==false and allowClosed~=true then return nil end
        return room
    end

    local staleId=nil
    for memberId,m in pairs(room.members) do
        if tonumber(m.source)==src then staleId=memberId break end
    end

    sourceToRoom[src]=nil
    if staleId then removeMember(room,staleId) end

    if rooms[room.id] then
        migrateHost(room)
        if reconcileRound then reconcileRound(room) end
        notifyRoom(room)
    end
    return nil
end

function FlecityGamesParty.GetConfig(source)
    local games={}
    for _,game in ipairs(FlecityGamesRegistry.List('party',true)) do
        games[#games+1]={
            id=game.id,
            name=game.name,
            description=game.description,
            minPlayers=game.minPlayers,
            maxPlayers=game.maxPlayers,
            premium=game.premium==true
        }
    end
    return {
        ok=true,
        config={
            roomCodeLength=roomCodeLength(),
            minPlayers=FlecityGamesConfig.Party.MinPlayers,
            maxPlayers=FlecityGamesConfig.Party.MaxPlayers,
            version=GetResourceMetadata(GetCurrentResourceName(),'version',0) or 'unknown',
            games=games,
            plus=source and FlecityGamesPartyPlus.GetConfigFor(source,true) or nil
        }
    }
end

function FlecityGamesParty.CreateRoom(source)
    if not FlecityGamesRateLimit.Allow(source,'room_create',FlecityGamesConfig.RateLimits.RoomCreateMs) then return {ok=false,error='RATE_LIMIT'} end
    local id=identifier(source)
    if not id then return {ok=false,error='PLAYER_NOT_READY'} end
    local existingRoom=roomForPlayer(source,id) or roomForIdentifier(id)
    if existingRoom then
        reconnectMember(existingRoom,id,source)
        notifyRoom(existingRoom,source)
        return {ok=true,reconnected=true,room=snapshot(existingRoom,id)}
    end
    local code=makeCode()
    if not code then return {ok=false,error='ROOM_CODE_EXHAUSTED'} end
    local roomId=makeInternalId()
    nextJoinOrder=nextJoinOrder+1
    local now=os.time()
    local room={id=roomId,code=code,revision=0,hostIdentifier=id,members={},selectedGame='reaction',state='lobby',round=0,roundState=nil,promptIndexes={},rotation={draw=0,telephone=0},createdAt=now,lastActivityAt=now}
    room.members[id]={source=tonumber(source),memberId=makeMemberId(room),name=characterName(source),ready=false,disconnected=false,appOpen=true,joinOrder=nextJoinOrder,joinedAt=os.time()}
    rooms[roomId]=room roomsByCode[code]=roomId sourceToRoom[tonumber(source)]=roomId
    notifyRoom(room,source)
    return {ok=true,room=snapshot(room,id)}
end

function FlecityGamesParty.JoinRoom(source,data)
    if not FlecityGamesRateLimit.Allow(source,'room_join',FlecityGamesConfig.RateLimits.RoomJoinMs) then return {ok=false,error='RATE_LIMIT'} end
    local id=identifier(source)
    if not id then return {ok=false,error='PLAYER_NOT_READY'} end
    if type(data)~='table' then return {ok=false,error='INVALID_REQUEST'} end

    local current=roomForPlayer(source,id)
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

    if room.state~='lobby' then return {ok=false,error='ROUND_IN_PROGRESS'} end
    if memberCount(room)>=FlecityGamesConfig.Party.MaxPlayers and connectedCount(room)<FlecityGamesConfig.Party.MaxPlayers then
        reclaimDisconnectedCapacity(room,FlecityGamesConfig.Party.MaxPlayers)
    end
    if memberCount(room)>=FlecityGamesConfig.Party.MaxPlayers then return {ok=false,error='ROOM_FULL'} end

    nextJoinOrder=nextJoinOrder+1
    room.members[id]={
        source=tonumber(source),memberId=makeMemberId(room),name=characterName(source),
        ready=false,disconnected=false,appOpen=true,joinOrder=nextJoinOrder,joinedAt=os.time()
    }
    sourceToRoom[tonumber(source)]=room.id
    -- If the previous host closed PARTY while nobody else had the app open,
    -- a later join must be able to recover host control immediately.
    local host=room.hostIdentifier and room.members[room.hostIdentifier] or nil
    if room.hostIdentifier~=id and host and host.appOpen==false then
        handoffHostFrom(room,room.hostIdentifier)
    end
    migrateHost(room)
    notifyRoom(room,source)
    return {ok=true,room=snapshot(room,id)}
end

function FlecityGamesParty.GetRoom(source)
    local id=identifier(source)
    if not id then return {ok=false,error='PLAYER_NOT_READY'} end
    local room=roomForPlayer(source,id,true)
    local reconnected=false
    if not room then
        room=roomForIdentifier(id)
        if room then reconnected=reconnectMember(room,id,source) end
    end
    if not room then return {ok=false,error='NOT_IN_ROOM'} end
    local reopened=false
    local member=room.members[id]
    if member and not member.disconnected and member.appOpen~=true then
        member.appOpen=true
        reopened=true
        local host=room.hostIdentifier and room.members[room.hostIdentifier] or nil
        if room.hostIdentifier~=id and host and host.appOpen==false then
            handoffHostFrom(room,room.hostIdentifier)
        end
        migrateHost(room)
    end
    if reconnected or reopened then notifyRoom(room,source) end
    return {ok=true,reconnected=reconnected,room=snapshot(room,id)}
end

function FlecityGamesParty.SetReady(source,data)
    if not FlecityGamesRateLimit.Allow(source,'ready',FlecityGamesConfig.RateLimits.ReadyMs) then return {ok=false,error='RATE_LIMIT'} end
    local id=identifier(source) local room=roomForPlayer(source,id)
    if not id or not room or not room.members[id] then return {ok=false,error='NOT_IN_ROOM'} end
    if room.state~='lobby' then return {ok=false,error='ROUND_IN_PROGRESS'} end
    room.members[id].ready=type(data)=='table' and data.ready==true
    notifyRoom(room,source)
    return {ok=true,room=snapshot(room,id)}
end

function FlecityGamesParty.SelectGame(source,data)
    if not FlecityGamesRateLimit.Allow(source,'room_action',FlecityGamesConfig.RateLimits.RoomActionMs) then return {ok=false,error='RATE_LIMIT'} end
    local id=identifier(source) local room=roomForPlayer(source,id)
    if not id or not room then return {ok=false,error='NOT_IN_ROOM'} end
    if room.hostIdentifier~=id then return {ok=false,error='HOST_ONLY'} end
    if room.state~='lobby' then return {ok=false,error='ROUND_IN_PROGRESS'} end
    local game=partyGame(type(data)=='table' and data.gameId or nil)
    if not game then return {ok=false,error='GAME_UNAVAILABLE'} end
    if game.premium==true then
        local allowed=FlecityGamesPartyPlus.HasAccess(source,id,true)
        if not allowed then return {ok=false,error='PARTY_PLUS_REQUIRED'} end
    end
    room.selectedGame=game.id
    for _,m in pairs(room.members) do m.ready=false end
    notifyRoom(room,source)
    return {ok=true,room=snapshot(room,id)}
end

local function allReady(room,game)
    local count=0
    for _,m in pairs(room.members) do
        if not m.disconnected then
            count=count+1
            if m.appOpen==false or m.ready~=true then return false end
        end
    end
    return count>=math.max(FlecityGamesConfig.Party.MinPlayers,game.minPlayers or 2) and count<=(game.maxPlayers or FlecityGamesConfig.Party.MaxPlayers)
end

function FlecityGamesParty.StartRound(source)
    if not FlecityGamesRateLimit.Allow(source,'room_action',FlecityGamesConfig.RateLimits.RoomActionMs) then return {ok=false,error='RATE_LIMIT'} end
    local id=identifier(source) local room=roomForPlayer(source,id)
    if not id or not room then return {ok=false,error='NOT_IN_ROOM'} end
    if room.hostIdentifier~=id then return {ok=false,error='HOST_ONLY'} end
    if room.state~='lobby' then return {ok=false,error='ROUND_IN_PROGRESS'} end
    local game=partyGame(room.selectedGame)
    if not game then return {ok=false,error='GAME_UNAVAILABLE'} end
    if game.premium==true then
        local allowed=FlecityGamesPartyPlus.HasAccess(source,id,true)
        if not allowed then return {ok=false,error='PARTY_PLUS_REQUIRED'} end
    end
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
    if game.id=='vote' then rs.prompt=pickRoomPrompt(room,'vote',votePrompts) end
    if game.id=='stop_battle' then
        rs.targetPct=math.random(15,85) rs.periodMs=math.random(1500,2400) rs.phaseMs=math.random(0,rs.periodMs-1) rs.motionStartTick=startedTick+1500
    end
    if game.id=='majority' or game.id=='minority' then
        local prompt=pickRoomPrompt(room,game.id,majorityPrompts)
        rs.prompt=prompt.question rs.options={prompt.options[1],prompt.options[2]}
    end
    if game.id=='tic_tac' then
        local ids=connectedIdentifiers(room)
        room.rotation=room.rotation or {draw=0,telephone=0,ticTac=0}
        room.rotation.ticTac=((tonumber(room.rotation.ticTac) or 0)%#ids)+1
        local order=rotatedIdentifiers(ids,room.rotation.ticTac)
        rs.board={'','','','','','','','',''}
        rs.turnOrder={order[1],order[2]}
        rs.currentIdentifier=order[1]
        rs.symbols={[order[1]]='X',[order[2]]='O'}
    end
    if game.id=='word_wolf' then
        local pair=pickRoomPrompt(room,'word_wolf',wordWolfPairs)
        local majorityTopic,wolfTopic=pair[1],pair[2]
        if math.random(0,1)==1 then majorityTopic,wolfTopic=wolfTopic,majorityTopic end
        local ids=connectedIdentifiers(room) local wolfId=ids[math.random(1,#ids)]
        rs.wolfIdentifier=wolfId rs.majorityTopic=majorityTopic rs.wolfTopic=wolfTopic rs.topics={}
        for _,memberId in ipairs(ids) do rs.topics[memberId]=memberId==wolfId and wolfTopic or majorityTopic end
        rs.voteUnlockTick=startedTick+(math.min(75,30+(#ids*5))*1000)
    end
    if game.id=='liar' then
        local ids=connectedIdentifiers(room) local liarId=ids[math.random(1,#ids)]
        rs.liarIdentifier=liarId rs.prompt=pickRoomPrompt(room,'liar',liarPrompts) rs.roles={}
        for _,memberId in ipairs(ids) do rs.roles[memberId]=memberId==liarId and 'LIAR' or 'TRUTH' end
        rs.voteUnlockTick=startedTick+(math.min(75,30+(#ids*5))*1000)
    end
    if game.id=='draw' then
        local ids=connectedIdentifiers(room)
        room.rotation=room.rotation or {draw=0,telephone=0}
        room.rotation.draw=((tonumber(room.rotation.draw) or 0)%#ids)+1
        rs.drawerIdentifier=ids[room.rotation.draw]
        rs.prompt=pickRoomPrompt(room,'draw',drawPrompts)
        rs.strokes={} rs.guessed={} rs.guessedAt={}
    end
    if game.id=='telephone' then
        local ids=connectedIdentifiers(room)
        room.rotation=room.rotation or {draw=0,telephone=0}
        room.rotation.telephone=((tonumber(room.rotation.telephone) or 0)%#ids)+1
        rs.turnOrder=rotatedIdentifiers(ids,room.rotation.telephone)
        rs.step=1 rs.mode='draw' rs.currentIdentifier=rs.turnOrder[1]
        rs.chain={{kind='text',text=pickRoomPrompt(room,'telephone',telephonePrompts)}}
    end
    if game.id=='ng_word' then
        local ids=connectedIdentifiers(room)
        room.rotation=room.rotation or {}
        room.rotation.ngWord=((tonumber(room.rotation.ngWord) or 0)%#ids)+1
        rs.explainerIdentifier=ids[room.rotation.ngWord]
        local prompt=pickRoomPrompt(room,'ng_word',FlecityGamesPartyPlusPrompts.Taboo)
        rs.targetWord=prompt.word
        rs.forbiddenWords=prompt.forbidden
        rs.phase='clue'
        rs.clue=nil
        rs.guesses={}
        rs.guessOrder={}
    end
    if game.id=='fake_answer' then
        local prompt=pickRoomPrompt(room,'fake_answer',FlecityGamesPartyPlusPrompts.FakeAnswer)
        rs.question=prompt.question
        rs.correctAnswer=prompt.answer
        rs.decoys=prompt.decoys
        rs.phase='submit'
        rs.fakeAnswers={}
        rs.votes={}
        rs.options={}
    end
    if game.id=='bomb' then
        local ids=connectedIdentifiers(room)
        room.rotation=room.rotation or {}
        room.rotation.bomb=((tonumber(room.rotation.bomb) or 0)%#ids)+1
        rs.turnOrder=rotatedIdentifiers(ids,room.rotation.bomb)
        rs.currentIndex=1
        rs.currentIdentifier=rs.turnOrder[1]
        rs.prompt=pickRoomPrompt(room,'bomb',FlecityGamesPartyPlusPrompts.Bomb)
        rs.passes=0
        rs.bombFuseTick=startedTick+math.random(25000,50000)
    end
    if game.id=='memory_chain' then
        rs.stage=1
        rs.maxStages=8
        rs.phase='memorize'
        rs.sequence=newMemorySequence(rs.stage)
        rs.eliminated={}
        rs.stageSubmissions={}
    end
    if game.id=='fall_battle' then
        rs.seed=math.random(1,2147483646)
        rs.width=10
        rs.height=18
    end

    if game.id=='telephone' then
        setRoundDeadline(rs,telephoneTurnTimeoutSeconds(rs.mode))
    elseif game.id=='ng_word' then
        setRoundDeadline(rs,45)
    elseif game.id=='fake_answer' then
        setRoundDeadline(rs,60)
    elseif game.id=='bomb' then
        setRoundDeadline(rs,10)
    elseif game.id=='memory_chain' then
        setRoundDeadline(rs,memoryRevealSeconds(rs.sequence))
    elseif game.id=='fall_battle' then
        setRoundDeadline(rs,90)
    else
        setRoundDeadline(rs,roundTimeoutSeconds(game.id))
    end
    for _,m in pairs(room.members) do m.ready=false end
    notifyRoom(room,source)
    return {ok=true,room=snapshot(room,id)}
end

local function completedSubmissionCount(room)
    local rs=room.roundState local n=0
    for id,m in pairs(room.members) do if not m.disconnected and m.appOpen~=false and rs.submissions[id]~=nil then n=n+1 end end
    return n
end

local function maybeFinishReaction(room,force)
    local rs=room.roundState
    if not rs or rs.gameId~='reaction' or rs.complete or (not force and completedSubmissionCount(room)<activeCount(room)) then return end
    local entries={}
    for id,m in pairs(room.members) do
        if not m.disconnected then
            local s=rs.submissions[id]
            entries[#entries+1]={memberId=m.memberId,name=m.name,reactionMs=s and s.reactionMs or nil,flying=s and s.flying==true or false,timedOut=s==nil}
        end
    end
    table.sort(entries,function(a,b)
        if a.timedOut~=b.timedOut then return not a.timedOut end
        if a.flying~=b.flying then return not a.flying end
        if a.timedOut or a.flying then return a.name<b.name end
        if a.reactionMs==b.reactionMs then return a.name<b.name end
        return a.reactionMs<b.reactionMs
    end)
    for i,e in ipairs(entries) do e.place=i end
    local winner=entries[1]
    rs.complete=true rs.results={entries=entries,winnerMemberId=winner and not winner.timedOut and not winner.flying and winner.memberId or nil,timedOut=force==true}
end

function FlecityGamesParty.SubmitReaction(source,data)
    if not FlecityGamesRateLimit.Allow(source,'reaction_submit',300) then return {ok=false,error='RATE_LIMIT'} end
    local id=identifier(source) local room=roomForPlayer(source,id)
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

local function maybeFinishStopBattle(room,force)
    local rs=room.roundState
    if not rs or rs.gameId~='stop_battle' or rs.complete or (not force and completedSubmissionCount(room)<activeCount(room)) then return end
    local entries={}
    for id,m in pairs(room.members) do
        if not m.disconnected then
            local s=rs.submissions[id]
            entries[#entries+1]={memberId=m.memberId,name=m.name,score=s and s.score or 0,distancePct=s and s.distancePct or 100,markerPct=s and s.markerPct or nil,timedOut=s==nil}
        end
    end
    table.sort(entries,function(a,b)
        if a.timedOut~=b.timedOut then return not a.timedOut end
        if a.score==b.score then return a.name<b.name end
        return a.score>b.score
    end)
    for i,e in ipairs(entries) do e.place=i end
    local winner=entries[1]
    rs.complete=true rs.results={entries=entries,winnerMemberId=winner and not winner.timedOut and winner.memberId or nil,targetPct=rs.targetPct,timedOut=force==true}
end

function FlecityGamesParty.SubmitStopBattle(source,data)
    if not FlecityGamesRateLimit.Allow(source,'stop_battle_submit',300) then return {ok=false,error='RATE_LIMIT'} end
    local id=identifier(source) local room=roomForPlayer(source,id)
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

local function maybeFinishMajority(room,force)
    local rs=room.roundState
    if not rs or rs.gameId~='majority' or rs.complete or (not force and completedSubmissionCount(room)<activeCount(room)) then return end
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
    local id=identifier(source) local room=roomForPlayer(source,id)
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

local function maybeFinishMinority(room,force)
    local rs=room.roundState
    if not rs or rs.gameId~='minority' or rs.complete or (not force and completedSubmissionCount(room)<activeCount(room)) then return end
    local counts={A=0,B=0} local entries={}
    for id,m in pairs(room.members) do
        if not m.disconnected then
            local choice=rs.submissions[id]
            if choice=='A' or choice=='B' then counts[choice]=counts[choice]+1 end
            entries[#entries+1]={memberId=m.memberId,name=m.name,choice=choice}
        end
    end
    table.sort(entries,function(a,b) return a.name<b.name end)
    local noMinority=counts.A==0 or counts.B==0
    local winningChoice=nil
    if not noMinority then
        if counts.A<counts.B then winningChoice='A' elseif counts.B<counts.A then winningChoice='B' end
    end
    rs.complete=true
    rs.results={counts=counts,entries=entries,winningChoice=winningChoice,noMinority=noMinority,options=rs.options,mode='minority'}
end

function FlecityGamesParty.SubmitMinority(source,data)
    if not FlecityGamesRateLimit.Allow(source,'minority_submit',300) then return {ok=false,error='RATE_LIMIT'} end
    local id=identifier(source) local room=roomForPlayer(source,id)
    if not id or not room or not room.members[id] then return {ok=false,error='NOT_IN_ROOM'} end
    local rs=room.roundState
    if type(data)~='table' or room.state~='round' or not rs or rs.gameId~='minority' then return {ok=false,error='INVALID_ROUND'} end
    if tostring(data.token or '')~=rs.token then return {ok=false,error='ROUND_TOKEN_MISMATCH'} end
    if rs.complete then return {ok=false,error='ROUND_COMPLETE'} end
    if rs.submissions[id] then return {ok=false,error='ALREADY_SUBMITTED'} end
    local choice=tostring(data.choice or '')
    if choice~='A' and choice~='B' then return {ok=false,error='INVALID_CHOICE'} end
    rs.submissions[id]=choice
    maybeFinishMinority(room)
    notifyRoom(room,source)
    return {ok=true,room=snapshot(room,id)}
end

function FlecityGamesParty.SubmitTicTac(source,data)
    if not FlecityGamesRateLimit.Allow(source,'tic_tac_move',180) then return {ok=false,error='RATE_LIMIT'} end
    local id=identifier(source) local room=roomForPlayer(source,id)
    if not id or not room or not room.members[id] then return {ok=false,error='NOT_IN_ROOM'} end
    local rs=room.roundState
    if type(data)~='table' or room.state~='round' or not rs or rs.gameId~='tic_tac' then return {ok=false,error='INVALID_ROUND'} end
    if tostring(data.token or '')~=rs.token then return {ok=false,error='ROUND_TOKEN_MISMATCH'} end
    if rs.complete then return {ok=false,error='ROUND_COMPLETE'} end
    if rs.currentIdentifier~=id then return {ok=false,error='NOT_YOUR_TURN'} end

    local cell=math.floor(tonumber(data.cell) or 0)
    if cell<1 or cell>9 then return {ok=false,error='INVALID_CHOICE'} end
    rs.board=rs.board or {'','','','','','','','',''}
    if rs.board[cell] and rs.board[cell]~='' then return {ok=false,error='CELL_OCCUPIED'} end

    local symbol=rs.symbols and rs.symbols[id] or nil
    if symbol~='X' and symbol~='O' then return {ok=false,error='INVALID_ROUND'} end
    rs.board[cell]=symbol
    rs.submissions[id]=(rs.submissions[id] or 0)+1

    local winner=ticTacWinner(rs.board)
    if winner then
        rs.complete=true
        local winnerIdentifier=nil
        for playerId,mark in pairs(rs.symbols or {}) do if mark==winner then winnerIdentifier=playerId break end end
        rs.results={
            board=rs.board,
            winnerMemberId=memberPublicId(room,winnerIdentifier),
            winnerName=winnerIdentifier and memberName(room,winnerIdentifier) or 'Player',
            winnerSymbol=winner,
            draw=false
        }
    elseif ticTacFull(rs.board) then
        rs.complete=true
        rs.results={board=rs.board,draw=true}
    else
        local first,second=rs.turnOrder[1],rs.turnOrder[2]
        rs.currentIdentifier=id==first and second or first
        setRoundDeadline(rs,roundTimeoutSeconds('tic_tac'))
    end

    notifyRoom(room,source)
    return {ok=true,room=snapshot(room,id)}
end

local function maybeFinishVote(room,force)
    local rs=room.roundState
    if not rs or rs.gameId~='vote' or rs.complete or (not force and completedSubmissionCount(room)<activeCount(room)) then return end
    local counts={} local totalVotes=0
    for voterId,targetId in pairs(rs.submissions) do
        local voter=room.members[voterId]
        local target=room.members[targetId]
        if voter and not voter.disconnected and target and not target.disconnected then
            counts[targetId]=(counts[targetId] or 0)+1
            totalVotes=totalVotes+1
        end
    end
    local entries={} local maxVotes=-1
    for id,m in pairs(room.members) do
        if not m.disconnected then
            local votes=counts[id] or 0 if votes>maxVotes then maxVotes=votes end
            entries[#entries+1]={memberId=m.memberId,name=m.name,votes=votes}
        end
    end
    table.sort(entries,function(a,b) if a.votes==b.votes then return a.name<b.name end return a.votes>b.votes end)
    local winners={}
    if totalVotes>0 then for _,e in ipairs(entries) do if e.votes==maxVotes then winners[#winners+1]=e.memberId end end end
    rs.complete=true rs.results={entries=entries,winnerMemberIds=winners,totalVotes=totalVotes,timedOut=force==true}
end

function FlecityGamesParty.SubmitVote(source,data)
    if not FlecityGamesRateLimit.Allow(source,'vote_submit',300) then return {ok=false,error='RATE_LIMIT'} end
    local id=identifier(source) local room=roomForPlayer(source,id)
    if not id or not room or not room.members[id] then return {ok=false,error='NOT_IN_ROOM'} end
    local rs=room.roundState
    if type(data)~='table' or room.state~='round' or not rs or rs.gameId~='vote' then return {ok=false,error='INVALID_ROUND'} end
    if tostring(data.token or '')~=rs.token then return {ok=false,error='ROUND_TOKEN_MISMATCH'} end
    if rs.complete then return {ok=false,error='ROUND_COMPLETE'} end
    if rs.submissions[id] then return {ok=false,error='ALREADY_SUBMITTED'} end
    local targetId=memberIdToIdentifier(room,tostring(data.targetMemberId or ''))
    if not targetId or not room.members[targetId] or room.members[targetId].disconnected or room.members[targetId].appOpen==false then return {ok=false,error='INVALID_TARGET'} end
    if targetId==id then return {ok=false,error='SELF_VOTE_NOT_ALLOWED'} end
    rs.submissions[id]=targetId maybeFinishVote(room)
    notifyRoom(room,source)
    return {ok=true,room=snapshot(room,id)}
end

local function maybeFinishWordWolf(room,force)
    local rs=room.roundState
    if not rs or rs.gameId~='word_wolf' or rs.complete or (not force and completedSubmissionCount(room)<activeCount(room)) then return end
    local counts={} local totalVotes=0
    for voterId,targetId in pairs(rs.submissions) do
        local voter=room.members[voterId]
        local target=room.members[targetId]
        if voter and not voter.disconnected and target and not target.disconnected then counts[targetId]=(counts[targetId] or 0)+1 totalVotes=totalVotes+1 end
    end
    local entries={}
    for id,m in pairs(room.members) do if not m.disconnected then entries[#entries+1]={memberId=m.memberId,name=m.name,votes=counts[id] or 0} end end
    table.sort(entries,function(a,b) if a.votes==b.votes then return a.name<b.name end return a.votes>b.votes end)
    local wolfMemberId=memberPublicId(room,rs.wolfIdentifier)
    local topVotes=entries[1] and entries[1].votes or 0
    local topCount=0 local topMemberId=nil
    for _,entry in ipairs(entries) do
        if entry.votes==topVotes then topCount=topCount+1 topMemberId=entry.memberId end
    end
    rs.complete=true
    rs.results={
        entries=entries,wolfMemberId=wolfMemberId,majorityTopic=rs.majorityTopic,wolfTopic=rs.wolfTopic,
        caught=totalVotes>0 and topCount==1 and topMemberId==wolfMemberId,totalVotes=totalVotes,timedOut=force==true
    }
end

function FlecityGamesParty.SubmitWordWolfVote(source,data)
    if not FlecityGamesRateLimit.Allow(source,'word_wolf_vote',300) then return {ok=false,error='RATE_LIMIT'} end
    local id=identifier(source) local room=roomForPlayer(source,id)
    if not id or not room or not room.members[id] then return {ok=false,error='NOT_IN_ROOM'} end
    local rs=room.roundState
    if type(data)~='table' or room.state~='round' or not rs or rs.gameId~='word_wolf' then return {ok=false,error='INVALID_ROUND'} end
    if tostring(data.token or '')~=rs.token then return {ok=false,error='ROUND_TOKEN_MISMATCH'} end
    if rs.complete or rs.submissions[id] then return {ok=false,error=rs.complete and 'ROUND_COMPLETE' or 'ALREADY_SUBMITTED'} end
    if tonumber(rs.voteUnlockTick) and GetGameTimer()<tonumber(rs.voteUnlockTick) then return {ok=false,error='VOTING_LOCKED'} end
    local targetId=memberIdToIdentifier(room,tostring(data.targetMemberId or ''))
    if not targetId or targetId==id or not room.members[targetId] or room.members[targetId].disconnected or room.members[targetId].appOpen==false then return {ok=false,error='INVALID_TARGET'} end
    rs.submissions[id]=targetId maybeFinishWordWolf(room)
    notifyRoom(room,source)
    return {ok=true,room=snapshot(room,id)}
end

local function maybeFinishLiar(room,force)
    local rs=room.roundState
    if not rs or rs.gameId~='liar' or rs.complete or (not force and completedSubmissionCount(room)<activeCount(room)) then return end
    local counts={} local totalVotes=0
    for voterId,targetId in pairs(rs.submissions) do
        local voter=room.members[voterId]
        local target=room.members[targetId]
        if voter and not voter.disconnected and target and not target.disconnected then counts[targetId]=(counts[targetId] or 0)+1 totalVotes=totalVotes+1 end
    end
    local entries={}
    for id,m in pairs(room.members) do if not m.disconnected then entries[#entries+1]={memberId=m.memberId,name=m.name,votes=counts[id] or 0} end end
    table.sort(entries,function(a,b) if a.votes==b.votes then return a.name<b.name end return a.votes>b.votes end)
    local liarMemberId=memberPublicId(room,rs.liarIdentifier)
    local topVotes=entries[1] and entries[1].votes or 0
    local topCount=0 local topMemberId=nil
    for _,entry in ipairs(entries) do
        if entry.votes==topVotes then topCount=topCount+1 topMemberId=entry.memberId end
    end
    rs.complete=true
    rs.results={entries=entries,liarMemberId=liarMemberId,prompt=rs.prompt,caught=totalVotes>0 and topCount==1 and topMemberId==liarMemberId,totalVotes=totalVotes,timedOut=force==true}
end

function FlecityGamesParty.SubmitLiarVote(source,data)
    if not FlecityGamesRateLimit.Allow(source,'liar_vote',300) then return {ok=false,error='RATE_LIMIT'} end
    local id=identifier(source) local room=roomForPlayer(source,id)
    if not id or not room or not room.members[id] then return {ok=false,error='NOT_IN_ROOM'} end
    local rs=room.roundState
    if type(data)~='table' or room.state~='round' or not rs or rs.gameId~='liar' then return {ok=false,error='INVALID_ROUND'} end
    if tostring(data.token or '')~=rs.token then return {ok=false,error='ROUND_TOKEN_MISMATCH'} end
    if rs.complete or rs.submissions[id] then return {ok=false,error=rs.complete and 'ROUND_COMPLETE' or 'ALREADY_SUBMITTED'} end
    if tonumber(rs.voteUnlockTick) and GetGameTimer()<tonumber(rs.voteUnlockTick) then return {ok=false,error='VOTING_LOCKED'} end
    local targetId=memberIdToIdentifier(room,tostring(data.targetMemberId or ''))
    if not targetId or targetId==id or not room.members[targetId] or room.members[targetId].disconnected or room.members[targetId].appOpen==false then return {ok=false,error='INVALID_TARGET'} end
    rs.submissions[id]=targetId maybeFinishLiar(room)
    notifyRoom(room,source)
    return {ok=true,room=snapshot(room,id)}
end

local function maybeFinishDraw(room,force)
    local rs=room.roundState
    if not rs or rs.gameId~='draw' or rs.complete then return end
    local drawer=room.members[rs.drawerIdentifier]
    if not drawer or drawer.disconnected or drawer.appOpen==false then
        rs.complete=true
        rs.results={aborted=true,reason='DRAWER_LEFT',prompt=rs.prompt,entries={}}
        return
    end
    local needed=0 local guessed=0
    for id,m in pairs(room.members) do
        if not m.disconnected and m.appOpen~=false and id~=rs.drawerIdentifier then needed=needed+1 if rs.guessed[id] then guessed=guessed+1 end end
    end
    if guessed<needed and not force then return end
    local entries={}
    for id,m in pairs(room.members) do
        if not m.disconnected and id~=rs.drawerIdentifier and rs.guessed[id] then
            entries[#entries+1]={memberId=m.memberId,name=m.name,guessedAt=rs.guessedAt[id] or 0}
        end
    end
    table.sort(entries,function(a,b) return a.guessedAt<b.guessedAt end)
    for i,e in ipairs(entries) do e.place=i e.guessedAt=nil end
    rs.complete=true rs.results={aborted=false,prompt=rs.prompt,entries=entries,drawerMemberId=drawer.memberId,timedOut=force==true and guessed<needed}
end

function FlecityGamesParty.AddDrawStroke(source,data)
    if not FlecityGamesRateLimit.Allow(source,'draw_stroke',80) then return {ok=false,error='RATE_LIMIT'} end
    local id=identifier(source) local room=roomForPlayer(source,id)
    if not id or not room or not room.members[id] then return {ok=false,error='NOT_IN_ROOM'} end
    local rs=room.roundState
    if type(data)~='table' or room.state~='round' or not rs or rs.gameId~='draw' then return {ok=false,error='INVALID_ROUND'} end
    if tostring(data.token or '')~=rs.token then return {ok=false,error='ROUND_TOKEN_MISMATCH'} end
    if rs.complete then return {ok=false,error='ROUND_COMPLETE'} end
    if rs.drawerIdentifier~=id then return {ok=false,error='DRAWER_ONLY'} end
    if #(rs.strokes or {})>=160 then return {ok=false,error='DRAW_LIMIT'} end
    local clean=sanitizedStrokes({data.points},1,48)
    if not clean then return {ok=false,error='INVALID_STROKE'} end
    if strokePointCount(rs.strokes)+#clean[1]>3200 then return {ok=false,error='DRAW_LIMIT'} end
    rs.strokes[#rs.strokes+1]=clean[1]
    notifyRoomEvent(room,source,'flecity_games:client:partyDrawStroke',{
        token=rs.token,
        points=clean[1]
    })
    return {ok=true,room=snapshot(room,id)}
end

function FlecityGamesParty.ClearDrawing(source,data)
    if not FlecityGamesRateLimit.Allow(source,'draw_clear',500) then return {ok=false,error='RATE_LIMIT'} end
    local id=identifier(source) local room=roomForPlayer(source,id)
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
    local id=identifier(source) local room=roomForPlayer(source,id)
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
    local correct=drawGuessMatches(rs.prompt,guess)
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
        if member and not member.disconnected and member.appOpen~=false then rs.currentIdentifier=candidate return end
    end
end

local function ensureTelephoneTurn(room)
    local rs=room.roundState
    if not rs or rs.gameId~='telephone' or rs.complete then return false end
    local current=rs.currentIdentifier and room.members[rs.currentIdentifier] or nil
    if current and not current.disconnected and current.appOpen~=false then return false end
    advanceTelephone(room,false)
    if not rs.complete then setRoundDeadline(rs,telephoneTurnTimeoutSeconds(rs.mode)) end
    return true
end

function FlecityGamesParty.SubmitTelephoneDrawing(source,data)
    if not FlecityGamesRateLimit.Allow(source,'telephone_draw',500) then return {ok=false,error='RATE_LIMIT'} end
    local id=identifier(source) local room=roomForPlayer(source,id)
    if not id or not room or not room.members[id] then return {ok=false,error='NOT_IN_ROOM'} end
    local rs=room.roundState
    if type(data)~='table' or room.state~='round' or not rs or rs.gameId~='telephone' then return {ok=false,error='INVALID_ROUND'} end
    if tostring(data.token or '')~=rs.token then return {ok=false,error='ROUND_TOKEN_MISMATCH'} end
    ensureTelephoneTurn(room)
    if rs.complete then return {ok=false,error='ROUND_COMPLETE'} end
    if rs.currentIdentifier~=id or rs.mode~='draw' then return {ok=false,error='NOT_YOUR_TURN'} end
    local clean=sanitizedStrokes(data.strokes,80,2400)
    if not clean then return {ok=false,error='INVALID_DRAWING'} end
    rs.chain[#rs.chain+1]={kind='draw',byIdentifier=id,byName=memberName(room,id),strokes=clean}
    rs.submissions[id]=(rs.submissions[id] or 0)+1
    advanceTelephone(room,true)
    if not rs.complete then setRoundDeadline(rs,telephoneTurnTimeoutSeconds(rs.mode)) end
    notifyRoom(room,source)
    return {ok=true,room=snapshot(room,id)}
end

function FlecityGamesParty.SubmitTelephoneText(source,data)
    if not FlecityGamesRateLimit.Allow(source,'telephone_text',500) then return {ok=false,error='RATE_LIMIT'} end
    local id=identifier(source) local room=roomForPlayer(source,id)
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
    rs.chain[#rs.chain+1]={kind='text',byIdentifier=id,byName=memberName(room,id),text=value}
    rs.submissions[id]=(rs.submissions[id] or 0)+1
    advanceTelephone(room,true)
    if not rs.complete then setRoundDeadline(rs,telephoneTurnTimeoutSeconds(rs.mode)) end
    notifyRoom(room,source)
    return {ok=true,room=snapshot(room,id)}
end


local function ngWordAllRemainingGuessed(room)
    local rs=room.roundState
    if not rs or rs.gameId~='ng_word' or rs.phase~='guess' then return false end
    local expected,submitted=0,0
    for id,m in pairs(room.members or {}) do
        if not m.disconnected and m.appOpen~=false and id~=rs.explainerIdentifier then
            expected=expected+1
            if rs.guesses and rs.guesses[id]~=nil then submitted=submitted+1 end
        end
    end
    return expected>0 and submitted>=expected
end

local function finishNgWord(room,timedOut,noClue)
    local rs=room.roundState
    if not rs or rs.gameId~='ng_word' or rs.complete then return end
    local entries={}
    for id,m in pairs(room.members) do
        if not m.disconnected and id~=rs.explainerIdentifier then
            local guess=rs.guesses and rs.guesses[id] or nil
            entries[#entries+1]={
                memberId=m.memberId,
                name=m.name,
                guess=guess and guess.text or nil,
                correct=guess and guess.correct==true or false
            }
        end
    end
    table.sort(entries,function(a,b) return a.name<b.name end)
    rs.complete=true
    rs.results={
        targetWord=rs.targetWord,
        forbiddenWords=rs.forbiddenWords,
        clue=rs.clue,
        explainerMemberId=memberPublicId(room,rs.explainerIdentifier),
        winnerMemberId=rs.winnerIdentifier and memberPublicId(room,rs.winnerIdentifier) or nil,
        winnerName=rs.winnerIdentifier and memberName(room,rs.winnerIdentifier) or nil,
        entries=entries,
        timedOut=timedOut==true,
        noClue=noClue==true
    }
end

function FlecityGamesParty.SubmitNgWordClue(source,data)
    if not FlecityGamesRateLimit.Allow(source,'ng_word_clue',500) then return {ok=false,error='RATE_LIMIT'} end
    local id=identifier(source) local room=roomForPlayer(source,id)
    if not id or not room or not room.members[id] then return {ok=false,error='NOT_IN_ROOM'} end
    local rs=room.roundState
    if type(data)~='table' or room.state~='round' or not rs or rs.gameId~='ng_word' then return {ok=false,error='INVALID_ROUND'} end
    if tostring(data.token or '')~=rs.token then return {ok=false,error='ROUND_TOKEN_MISMATCH'} end
    if rs.complete then return {ok=false,error='ROUND_COMPLETE'} end
    if rs.explainerIdentifier~=id then return {ok=false,error='EXPLAINER_ONLY'} end
    if rs.phase~='clue' then return {ok=false,error='ALREADY_SUBMITTED'} end
    local clue=FlecityGamesText.Normalize(data.clue)
    local clueLength=FlecityGamesText.Length(clue)
    if clueLength<3 or clueLength>100 then return {ok=false,error='INVALID_TEXT'} end
    if containsPartyTerm(clue,rs.targetWord) then return {ok=false,error='TABOO_FORBIDDEN_WORD'} end
    for _,term in ipairs(rs.forbiddenWords or {}) do
        if containsPartyTerm(clue,term) then return {ok=false,error='TABOO_FORBIDDEN_WORD'} end
    end
    rs.clue=clue
    rs.phase='guess'
    setRoundDeadline(rs,45)
    notifyRoom(room,source)
    return {ok=true,room=snapshot(room,id)}
end

function FlecityGamesParty.SubmitNgWordGuess(source,data)
    if not FlecityGamesRateLimit.Allow(source,'ng_word_guess',300) then return {ok=false,error='RATE_LIMIT'} end
    local id=identifier(source) local room=roomForPlayer(source,id)
    if not id or not room or not room.members[id] then return {ok=false,error='NOT_IN_ROOM'} end
    local rs=room.roundState
    if type(data)~='table' or room.state~='round' or not rs or rs.gameId~='ng_word' then return {ok=false,error='INVALID_ROUND'} end
    if tostring(data.token or '')~=rs.token then return {ok=false,error='ROUND_TOKEN_MISMATCH'} end
    if rs.complete then return {ok=false,error='ROUND_COMPLETE'} end
    if rs.phase~='guess' then return {ok=false,error='CLUE_NOT_READY'} end
    if rs.explainerIdentifier==id then return {ok=false,error='EXPLAINER_CANNOT_GUESS'} end
    if rs.guesses[id] then return {ok=false,error='ALREADY_SUBMITTED'} end
    local guess=FlecityGamesText.Normalize(data.guess)
    local guessLength=FlecityGamesText.Length(guess)
    if guessLength<1 or guessLength>40 then return {ok=false,error='INVALID_GUESS'} end
    local correct=normalizedPartyAnswer(guess)==normalizedPartyAnswer(rs.targetWord)
    rs.guesses[id]={text=guess,correct=correct}
    rs.guessOrder[#rs.guessOrder+1]=id
    if correct then
        rs.winnerIdentifier=id
        finishNgWord(room,false,false)
    else
        local expected,submitted=0,0
        for playerId,m in pairs(room.members) do
            if not m.disconnected and m.appOpen~=false and playerId~=rs.explainerIdentifier then
                expected=expected+1
                if rs.guesses[playerId] then submitted=submitted+1 end
            end
        end
        if expected>0 and submitted>=expected then finishNgWord(room,false,false) end
    end
    notifyRoom(room,source)
    return {ok=true,correct=correct,room=snapshot(room,id)}
end


local function buildFakeAnswerOptions(room)
    local rs=room.roundState
    if not rs or rs.gameId~='fake_answer' or rs.complete or rs.phase~='submit' then return false end

    local raw={{text=rs.correctAnswer,kind='correct'}}
    local used={[normalizedPartyAnswer(rs.correctAnswer)]=true}
    for id,m in pairs(room.members) do
        local answer=rs.fakeAnswers and rs.fakeAnswers[id] or nil
        local normalized=answer and normalizedPartyAnswer(answer) or ''
        if not m.disconnected and normalized~='' and not used[normalized] then
            used[normalized]=true
            raw[#raw+1]={text=answer,kind='fake',creatorIdentifier=id,creatorName=m.name}
        end
    end
    for _,decoy in ipairs(rs.decoys or {}) do
        local normalized=normalizedPartyAnswer(decoy)
        if normalized~='' and not used[normalized] then
            used[normalized]=true
            raw[#raw+1]={text=decoy,kind='decoy'}
        end
    end

    raw=shuffledCopy(raw)
    rs.options={}
    for index,entry in ipairs(raw) do
        entry.id=('choice_%02d'):format(index)
        rs.options[#rs.options+1]=entry
    end
    rs.phase='vote'
    rs.votes={}
    setRoundDeadline(rs,45)
    return true
end

local function fakeAnswerPhaseReady(room)
    local rs=room.roundState
    if not rs or rs.gameId~='fake_answer' or rs.complete then return false end
    local expected,submitted=0,0
    for id,m in pairs(room.members or {}) do
        if not m.disconnected and m.appOpen~=false then
            expected=expected+1
            if rs.phase=='submit' and rs.fakeAnswers and rs.fakeAnswers[id]~=nil then submitted=submitted+1 end
            if rs.phase=='vote' and rs.votes and rs.votes[id]~=nil then submitted=submitted+1 end
        end
    end
    return expected>0 and submitted>=expected
end

local function finishFakeAnswer(room,timedOut)
    local rs=room.roundState
    if not rs or rs.gameId~='fake_answer' or rs.complete then return end
    if rs.phase=='submit' then buildFakeAnswerOptions(room) return end

    local choices={} local correctOptionId=nil
    for _,option in ipairs(rs.options or {}) do
        if option.kind=='correct' then correctOptionId=option.id end
        choices[option.id]={id=option.id,text=option.text,kind=option.kind,creatorIdentifier=option.creatorIdentifier,creatorName=option.creatorName,votes=0}
    end

    local scoreById={}
    for id,m in pairs(room.members) do
        if not m.disconnected then scoreById[id]={memberId=m.memberId,name=m.name,score=0,correct=false,foolVotes=0} end
    end
    for voterId,optionId in pairs(rs.votes or {}) do
        local voter=room.members[voterId]
        local choice=choices[optionId]
        if voter and not voter.disconnected and choice then
            choice.votes=choice.votes+1
            local playerScore=scoreById[voterId]
            if playerScore and optionId==correctOptionId then
                playerScore.correct=true
                playerScore.score=playerScore.score+2
            end
            local creatorId=choice.creatorIdentifier
            if creatorId and creatorId~=voterId and scoreById[creatorId] then
                scoreById[creatorId].foolVotes=scoreById[creatorId].foolVotes+1
                scoreById[creatorId].score=scoreById[creatorId].score+1
            end
        end
    end

    local entries={}
    for _,entry in pairs(scoreById) do entries[#entries+1]=entry end
    table.sort(entries,function(a,b)
        if a.score==b.score then return a.name<b.name end
        return a.score>b.score
    end)
    local best=entries[1] and entries[1].score or 0
    local winners={}
    for _,entry in ipairs(entries) do
        if entry.score==best then winners[#winners+1]=entry.memberId end
    end

    local resultChoices={}
    for _,option in ipairs(rs.options or {}) do
        local choice=choices[option.id]
        resultChoices[#resultChoices+1]={
            text=choice.text,
            votes=choice.votes,
            correct=choice.kind=='correct',
            creatorName=choice.creatorName
        }
    end

    rs.complete=true
    rs.results={
        question=rs.question,
        correctAnswer=rs.correctAnswer,
        choices=resultChoices,
        entries=entries,
        winnerMemberIds=winners,
        timedOut=timedOut==true
    }
end

function FlecityGamesParty.SubmitFakeAnswer(source,data)
    if not FlecityGamesRateLimit.Allow(source,'fake_answer_submit',350) then return {ok=false,error='RATE_LIMIT'} end
    local id=identifier(source) local room=roomForPlayer(source,id)
    if not id or not room or not room.members[id] then return {ok=false,error='NOT_IN_ROOM'} end
    local rs=room.roundState
    if type(data)~='table' or room.state~='round' or not rs or rs.gameId~='fake_answer' then return {ok=false,error='INVALID_ROUND'} end
    if tostring(data.token or '')~=rs.token then return {ok=false,error='ROUND_TOKEN_MISMATCH'} end
    if rs.complete then return {ok=false,error='ROUND_COMPLETE'} end
    if rs.phase~='submit' then return {ok=false,error='VOTING_STARTED'} end
    if rs.fakeAnswers[id] then return {ok=false,error='ALREADY_SUBMITTED'} end

    local answer=FlecityGamesText.Normalize(data.answer)
    local length=FlecityGamesText.Length(answer)
    if length<1 or length>50 then return {ok=false,error='INVALID_TEXT'} end
    local normalized=normalizedPartyAnswer(answer)
    if normalized==normalizedPartyAnswer(rs.correctAnswer) then return {ok=false,error='FAKE_ANSWER_UNAVAILABLE'} end
    for _,existing in pairs(rs.fakeAnswers or {}) do
        if normalized==normalizedPartyAnswer(existing) then return {ok=false,error='FAKE_ANSWER_UNAVAILABLE'} end
    end

    rs.fakeAnswers[id]=answer
    local submitted,expected=0,0
    for playerId,m in pairs(room.members) do
        if not m.disconnected and m.appOpen~=false then
            expected=expected+1
            if rs.fakeAnswers[playerId] then submitted=submitted+1 end
        end
    end
    if expected>0 and submitted>=expected then buildFakeAnswerOptions(room) end
    notifyRoom(room,source)
    return {ok=true,room=snapshot(room,id)}
end

function FlecityGamesParty.SubmitFakeVote(source,data)
    if not FlecityGamesRateLimit.Allow(source,'fake_answer_vote',300) then return {ok=false,error='RATE_LIMIT'} end
    local id=identifier(source) local room=roomForPlayer(source,id)
    if not id or not room or not room.members[id] then return {ok=false,error='NOT_IN_ROOM'} end
    local rs=room.roundState
    if type(data)~='table' or room.state~='round' or not rs or rs.gameId~='fake_answer' then return {ok=false,error='INVALID_ROUND'} end
    if tostring(data.token or '')~=rs.token then return {ok=false,error='ROUND_TOKEN_MISMATCH'} end
    if rs.complete then return {ok=false,error='ROUND_COMPLETE'} end
    if rs.phase~='vote' then return {ok=false,error='VOTING_LOCKED'} end
    if rs.votes[id] then return {ok=false,error='ALREADY_SUBMITTED'} end

    local optionId=tostring(data.optionId or '')
    local selected=nil
    for _,option in ipairs(rs.options or {}) do if option.id==optionId then selected=option break end end
    if not selected then return {ok=false,error='INVALID_CHOICE'} end
    if selected.creatorIdentifier==id then return {ok=false,error='SELF_VOTE_NOT_ALLOWED'} end

    rs.votes[id]=optionId
    local submitted,expected=0,0
    for playerId,m in pairs(room.members) do
        if not m.disconnected and m.appOpen~=false then
            expected=expected+1
            if rs.votes[playerId] then submitted=submitted+1 end
        end
    end
    if expected>0 and submitted>=expected then finishFakeAnswer(room,false) end
    notifyRoom(room,source)
    return {ok=true,room=snapshot(room,id)}
end


local function finishBomb(room,reason)
    local rs=room.roundState
    if not rs or rs.gameId~='bomb' or rs.complete then return end
    local loserId=rs.currentIdentifier
    rs.complete=true
    rs.results={
        prompt=rs.prompt,
        loserMemberId=memberPublicId(room,loserId),
        loserName=loserId and memberName(room,loserId) or 'Player',
        reason=reason or 'BOMB',
        passes=tonumber(rs.passes) or 0
    }
end

local function advanceBomb(room)
    local rs=room.roundState
    if not rs or rs.gameId~='bomb' or rs.complete then return false end
    local order=rs.turnOrder or {}
    if #order<1 then return false end
    for offset=1,#order do
        local index=((tonumber(rs.currentIndex) or 1)-1+offset)%#order+1
        local id=order[index]
        local member=room.members[id]
        if member and not member.disconnected and member.appOpen~=false then
            rs.currentIndex=index
            rs.currentIdentifier=id
            setRoundDeadline(rs,10)
            return true
        end
    end
    return false
end

function FlecityGamesParty.SubmitBombPass(source,data)
    if not FlecityGamesRateLimit.Allow(source,'bomb_pass',300) then return {ok=false,error='RATE_LIMIT'} end
    local id=identifier(source) local room=roomForPlayer(source,id)
    if not id or not room or not room.members[id] then return {ok=false,error='NOT_IN_ROOM'} end
    local rs=room.roundState
    if type(data)~='table' or room.state~='round' or not rs or rs.gameId~='bomb' then return {ok=false,error='INVALID_ROUND'} end
    if tostring(data.token or '')~=rs.token then return {ok=false,error='ROUND_TOKEN_MISMATCH'} end
    if rs.complete then return {ok=false,error='ROUND_COMPLETE'} end
    if rs.currentIdentifier~=id then return {ok=false,error='NOT_YOUR_TURN'} end
    if GetGameTimer()>=tonumber(rs.bombFuseTick or 0) then
        finishBomb(room,'BOMB')
        notifyRoom(room,source)
        return {ok=true,room=snapshot(room,id)}
    end
    rs.passes=(tonumber(rs.passes) or 0)+1
    if not advanceBomb(room) then finishBomb(room,'NO_NEXT_PLAYER') end
    notifyRoom(room,source)
    return {ok=true,room=snapshot(room,id)}
end


local function memoryAliveIdentifiers(room)
    local rs=room.roundState
    local alive={}
    for id,m in pairs(room.members or {}) do
        if not m.disconnected and m.appOpen~=false and not (rs.eliminated and rs.eliminated[id]) then alive[#alive+1]=id end
    end
    table.sort(alive,function(a,b)
        return (room.members[a].joinOrder or 0)<(room.members[b].joinOrder or 0)
    end)
    return alive
end

local function finishMemoryChain(room,reason)
    local rs=room.roundState
    if not rs or rs.gameId~='memory_chain' or rs.complete then return end
    local alive=memoryAliveIdentifiers(room)
    local winnerIds={}
    for _,id in ipairs(alive) do winnerIds[#winnerIds+1]=memberPublicId(room,id) end
    local entries={}
    for id,m in pairs(room.members) do
        if not m.disconnected then
            local eliminatedStage=rs.eliminated and tonumber(rs.eliminated[id]) or nil
            entries[#entries+1]={
                memberId=m.memberId,
                name=m.name,
                survived=eliminatedStage==nil,
                stageReached=eliminatedStage and math.max(0,eliminatedStage-1) or tonumber(rs.stage) or 1
            }
        end
    end
    table.sort(entries,function(a,b)
        if a.survived~=b.survived then return a.survived end
        if a.stageReached==b.stageReached then return a.name<b.name end
        return a.stageReached>b.stageReached
    end)
    rs.complete=true
    rs.results={
        entries=entries,
        winnerMemberIds=winnerIds,
        finalStage=tonumber(rs.stage) or 1,
        reason=reason or 'LAST_ALIVE'
    }
end

local function openMemoryInput(room)
    local rs=room.roundState
    if not rs or rs.gameId~='memory_chain' or rs.complete or rs.phase~='memorize' then return false end
    rs.phase='input'
    rs.stageSubmissions={}
    setRoundDeadline(rs,15)
    return true
end

local function startNextMemoryStage(room)
    local rs=room.roundState
    if not rs or rs.gameId~='memory_chain' or rs.complete then return false end
    rs.stage=(tonumber(rs.stage) or 1)+1
    rs.phase='memorize'
    rs.sequence=newMemorySequence(rs.stage)
    rs.stageSubmissions={}
    setRoundDeadline(rs,memoryRevealSeconds(rs.sequence))
    return true
end

local function resolveMemoryStage(room,timedOut)
    local rs=room.roundState
    if not rs or rs.gameId~='memory_chain' or rs.complete or rs.phase~='input' then return false end
    for _,id in ipairs(memoryAliveIdentifiers(room)) do
        local correct=rs.stageSubmissions and rs.stageSubmissions[id]
        if correct~=true then rs.eliminated[id]=tonumber(rs.stage) or 1 end
    end
    local alive=memoryAliveIdentifiers(room)
    if #alive<=1 then
        finishMemoryChain(room,timedOut and 'INPUT_TIMEOUT' or 'LAST_ALIVE')
    elseif (tonumber(rs.stage) or 1)>=(tonumber(rs.maxStages) or 8) then
        finishMemoryChain(room,'MAX_STAGE')
    else
        startNextMemoryStage(room)
    end
    return true
end

local function maybeResolveMemoryStage(room)
    local rs=room.roundState
    if not rs or rs.gameId~='memory_chain' or rs.complete then return false end
    local alive=memoryAliveIdentifiers(room)
    if #alive<=1 then finishMemoryChain(room,'LAST_ALIVE') return true end
    if rs.phase~='input' then return false end
    local submitted=0
    for _,id in ipairs(alive) do
        if rs.stageSubmissions and rs.stageSubmissions[id]~=nil then submitted=submitted+1 end
    end
    if #alive>0 and submitted>=#alive then return resolveMemoryStage(room,false) end
    return false
end

function FlecityGamesParty.SubmitMemoryChain(source,data)
    if not FlecityGamesRateLimit.Allow(source,'memory_chain_submit',300) then return {ok=false,error='RATE_LIMIT'} end
    local id=identifier(source) local room=roomForPlayer(source,id)
    if not id or not room or not room.members[id] then return {ok=false,error='NOT_IN_ROOM'} end
    local rs=room.roundState
    if type(data)~='table' or room.state~='round' or not rs or rs.gameId~='memory_chain' then return {ok=false,error='INVALID_ROUND'} end
    if tostring(data.token or '')~=rs.token then return {ok=false,error='ROUND_TOKEN_MISMATCH'} end
    if rs.complete then return {ok=false,error='ROUND_COMPLETE'} end
    if rs.phase~='input' then return {ok=false,error='MEMORY_NOT_INPUT_PHASE'} end
    if rs.eliminated and rs.eliminated[id] then return {ok=false,error='PLAYER_ELIMINATED'} end
    if rs.stageSubmissions and rs.stageSubmissions[id]~=nil then return {ok=false,error='ALREADY_SUBMITTED'} end

    local answer=tostring(data.answer or '')
    if #answer~=#(rs.sequence or {}) or not answer:match('^[ABCD]+$') then return {ok=false,error='INVALID_CHOICE'} end
    local expected=table.concat(rs.sequence or {})
    rs.stageSubmissions[id]=answer==expected
    maybeResolveMemoryStage(room)
    notifyRoom(room,source)
    return {ok=true,room=snapshot(room,id)}
end

local function maybeFinishFallBattle(room,force)
    local rs=room.roundState
    if not rs or rs.gameId~='fall_battle' or rs.complete or (not force and completedSubmissionCount(room)<activeCount(room)) then return end

    local entries={}
    local bestScore=nil
    local bestLines=nil
    for id,m in pairs(room.members) do
        local s=rs.submissions[id]
        local entry={
            memberId=m.memberId,
            name=m.name,
            score=s and tonumber(s.score) or 0,
            lines=s and tonumber(s.lines) or 0,
            pieces=s and tonumber(s.pieces) or 0,
            timedOut=s==nil,
            forfeited=s and s.forfeited==true or false,
            disconnected=m.disconnected==true
        }
        entries[#entries+1]=entry
        if not entry.timedOut and not entry.forfeited then
            if bestScore==nil or entry.score>bestScore or (entry.score==bestScore and entry.lines>(bestLines or -1)) then
                bestScore=entry.score
                bestLines=entry.lines
            end
        end
    end

    table.sort(entries,function(a,b)
        if a.timedOut~=b.timedOut then return not a.timedOut end
        if a.score~=b.score then return a.score>b.score end
        if a.lines~=b.lines then return a.lines>b.lines end
        if a.pieces~=b.pieces then return a.pieces>b.pieces end
        return a.name<b.name
    end)

    local winners={}
    if bestScore~=nil then
        for _,entry in ipairs(entries) do
            if not entry.timedOut and not entry.forfeited and entry.score==bestScore and entry.lines==bestLines then
                winners[#winners+1]=entry.memberId
            end
        end
    end

    rs.complete=true
    rs.results={entries=entries,winnerMemberIds=winners,timedOut=force==true}
end

function FlecityGamesParty.SubmitFallBattle(source,data)
    if not FlecityGamesRateLimit.Allow(source,'fall_battle_submit',750) then return {ok=false,error='RATE_LIMIT'} end
    local id=identifier(source) local room=roomForPlayer(source,id)
    if not id or not room or not room.members[id] then return {ok=false,error='NOT_IN_ROOM'} end
    local rs=room.roundState
    if type(data)~='table' or room.state~='round' or not rs or rs.gameId~='fall_battle' then return {ok=false,error='INVALID_ROUND'} end
    if tostring(data.token or '')~=rs.token then return {ok=false,error='ROUND_TOKEN_MISMATCH'} end
    if rs.complete then return {ok=false,error='ROUND_COMPLETE'} end
    if rs.submissions[id] then return {ok=false,error='ALREADY_SUBMITTED'} end

    local serverElapsed=math.max(0,GetGameTimer()-(tonumber(rs.startedTick) or GetGameTimer()))
    local allowedElapsed=math.min(90000,serverElapsed)
    local validated,errorCode=FlecityGamesPartyFall.Validate(rs.seed,data.history,rs.width,rs.height,allowedElapsed)
    if not validated then return {ok=false,error=errorCode or 'INVALID_FALL_BATTLE_REPLAY'} end

    rs.submissions[id]={
        score=validated.score,
        lines=validated.lines,
        pieces=validated.pieces,
        ended=validated.ended==true
    }
    maybeFinishFallBattle(room)
    notifyRoom(room,source)
    return {ok=true,room=snapshot(room,id)}
end

function FlecityGamesParty.ReturnLobby(source)
    if not FlecityGamesRateLimit.Allow(source,'room_action',FlecityGamesConfig.RateLimits.RoomActionMs) then return {ok=false,error='RATE_LIMIT'} end
    local id=identifier(source) local room=roomForPlayer(source,id)
    if not id or not room then return {ok=false,error='NOT_IN_ROOM'} end
    if room.hostIdentifier~=id then return {ok=false,error='HOST_ONLY'} end
    if room.state=='lobby' then return {ok=true,room=snapshot(room,id)} end
    local rs=room.roundState
    if room.state~='round' or not rs or rs.complete~=true then return {ok=false,error='ROUND_IN_PROGRESS'} end
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

local function finishTicTacForfeit(room,loserIdentifier,reason)
    local rs=room and room.roundState or nil
    if not rs or rs.gameId~='tic_tac' or rs.complete then return false end
    local winnerIdentifier=nil
    for _,playerId in ipairs(rs.turnOrder or {}) do
        if playerId~=loserIdentifier then winnerIdentifier=playerId break end
    end
    local winnerSymbol=winnerIdentifier and rs.symbols and rs.symbols[winnerIdentifier] or nil
    rs.complete=true
    rs.results={
        board=rs.board or {},
        winnerMemberId=memberPublicId(room,winnerIdentifier),
        winnerName=winnerIdentifier and memberName(room,winnerIdentifier) or 'Player',
        winnerSymbol=winnerSymbol,
        draw=false,
        forfeit=true,
        reason=reason or 'FORFEIT'
    }
    return true
end

local function purgeDisconnectedTargets(room)
    local rs=room and room.roundState or nil
    if not rs or rs.complete then return 0 end
    if rs.gameId~='vote' and rs.gameId~='word_wolf' and rs.gameId~='liar' then return 0 end
    local removed=0
    for voterId,targetId in pairs(rs.submissions or {}) do
        local target=room.members[targetId]
        if not target or target.disconnected or target.appOpen==false then
            rs.submissions[voterId]=nil
            removed=removed+1
        end
    end
    return removed
end

reconcileRound=function(room)
    local rs=room.roundState
    if not rs or rs.complete then return false end

    local beforeComplete=rs.complete==true
    local beforeCurrent=rs.currentIdentifier
    local beforeStep=rs.step
    local purged=purgeDisconnectedTargets(room)

    if rs.gameId=='bomb' and tonumber(rs.bombFuseTick) and GetGameTimer()>=tonumber(rs.bombFuseTick) then
        finishBomb(room,'BOMB')
        return true
    end

    if tonumber(rs.deadlineTick) and GetGameTimer()>=tonumber(rs.deadlineTick) then
        if rs.gameId=='telephone' then
            advanceTelephone(room,false)
            if not rs.complete then setRoundDeadline(rs,telephoneTurnTimeoutSeconds(rs.mode)) end
        elseif rs.gameId=='tic_tac' then
            finishTicTacForfeit(room,rs.currentIdentifier,'TURN_TIMEOUT')
        elseif rs.gameId=='reaction' then maybeFinishReaction(room,true)
        elseif rs.gameId=='stop_battle' then maybeFinishStopBattle(room,true)
        elseif rs.gameId=='vote' then maybeFinishVote(room,true)
        elseif rs.gameId=='majority' then maybeFinishMajority(room,true)
        elseif rs.gameId=='minority' then maybeFinishMinority(room,true)
        elseif rs.gameId=='word_wolf' then maybeFinishWordWolf(room,true)
        elseif rs.gameId=='liar' then maybeFinishLiar(room,true)
        elseif rs.gameId=='draw' then maybeFinishDraw(room,true)
        elseif rs.gameId=='ng_word' then finishNgWord(room,true,rs.phase=='clue')
        elseif rs.gameId=='fake_answer' then
            if rs.phase=='submit' then buildFakeAnswerOptions(room) else finishFakeAnswer(room,true) end
        elseif rs.gameId=='bomb' then finishBomb(room,'TURN_TIMEOUT')
        elseif rs.gameId=='fall_battle' then maybeFinishFallBattle(room,true)
        else abortRound(room,'ROUND_TIMEOUT') end
        if not rs.complete and rs.gameId~='telephone' and not (rs.gameId=='fake_answer' and rs.phase=='vote') then abortRound(room,'ROUND_TIMEOUT') end
        return true
    end

    local game=partyGame(rs.gameId)
    local minimum=game and tonumber(game.minPlayers) or FlecityGamesConfig.Party.MinPlayers
    local continuationMinimumByGame={
        telephone=2,
        ng_word=2,
        fake_answer=2,
        bomb=2,
        memory_chain=1,
        fall_battle=1
    }
    local continuationMinimum=continuationMinimumByGame[rs.gameId] or minimum
    if connectedCount(room)<math.max(1,continuationMinimum or 1) then
        abortRound(room,'NOT_ENOUGH_PLAYERS')
        return true
    end

    if rs.gameId=='word_wolf' then
        local wolf=rs.wolfIdentifier and room.members[rs.wolfIdentifier] or nil
        if not wolf or wolf.disconnected or wolf.appOpen==false then abortRound(room,'SECRET_PLAYER_LEFT') return true end
    elseif rs.gameId=='liar' then
        local liar=rs.liarIdentifier and room.members[rs.liarIdentifier] or nil
        if not liar or liar.disconnected or liar.appOpen==false then abortRound(room,'SECRET_PLAYER_LEFT') return true end
    elseif rs.gameId=='ng_word' then
        local explainer=rs.explainerIdentifier and room.members[rs.explainerIdentifier] or nil
        if not explainer or explainer.disconnected or explainer.appOpen==false then abortRound(room,'EXPLAINER_LEFT') return true end
    end

    if rs.gameId=='reaction' then maybeFinishReaction(room)
    elseif rs.gameId=='stop_battle' then maybeFinishStopBattle(room)
    elseif rs.gameId=='vote' then maybeFinishVote(room)
    elseif rs.gameId=='majority' then maybeFinishMajority(room)
    elseif rs.gameId=='minority' then maybeFinishMinority(room)
    elseif rs.gameId=='tic_tac' then
        local current=rs.currentIdentifier and room.members[rs.currentIdentifier] or nil
        if not current or current.disconnected then abortRound(room,'PLAYER_LEFT') end
    elseif rs.gameId=='word_wolf' then maybeFinishWordWolf(room)
    elseif rs.gameId=='liar' then maybeFinishLiar(room)
    elseif rs.gameId=='draw' then maybeFinishDraw(room)
    elseif rs.gameId=='telephone' then ensureTelephoneTurn(room)
    elseif rs.gameId=='fake_answer' then
        if fakeAnswerPhaseReady(room) then
            if rs.phase=='submit' then buildFakeAnswerOptions(room) else finishFakeAnswer(room,false) end
        end
    elseif rs.gameId=='memory_chain' then
        maybeResolveMemoryStage(room)
    elseif rs.gameId=='bomb' then
        local current=rs.currentIdentifier and room.members[rs.currentIdentifier] or nil
        if not current or current.disconnected then
            if not advanceBomb(room) then abortRound(room,'NOT_ENOUGH_PLAYERS') end
        end
    elseif rs.gameId=='fall_battle' then
        maybeFinishFallBattle(room)
    end

    return purged>0
        or (rs.complete==true)~=beforeComplete
        or rs.currentIdentifier~=beforeCurrent
        or rs.step~=beforeStep
end

function FlecityGamesParty.AppClosed(source)
    local id=identifier(source)
    local room=roomForSource(source)
    local member=id and room and room.members[id] or nil
    if not id or not room or not member or tonumber(member.source)~=tonumber(source) or member.disconnected then return end
    local changed=false
    if room.members[id].appOpen~=false then
        room.members[id].appOpen=false
        changed=true
    end
    if room.state=='lobby' and room.members[id].ready==true then
        room.members[id].ready=false
        changed=true
    end
    local rs=room.roundState
    if room.state=='round' and rs and not rs.complete then
        if rs.gameId=='fall_battle' and rs.submissions and rs.submissions[id]==nil then
            rs.submissions[id]={score=0,lines=0,pieces=0,ended=true,forfeited=true}
            maybeFinishFallBattle(room)
            changed=true
        elseif rs.gameId=='telephone' and rs.currentIdentifier==id then
            advanceTelephone(room,false)
            if not rs.complete then setRoundDeadline(rs,telephoneTurnTimeoutSeconds(rs.mode)) end
            changed=true
        elseif rs.gameId=='bomb' and rs.currentIdentifier==id then
            if not advanceBomb(room) then abortRound(room,'NOT_ENOUGH_PLAYERS') end
            changed=true
        elseif rs.gameId=='tic_tac' then
            for _,playerId in ipairs(rs.turnOrder or {}) do
                if playerId==id then
                    finishTicTacForfeit(room,id,'APP_CLOSED')
                    changed=true
                    break
                end
            end
        elseif rs.gameId=='ng_word' then
            if rs.explainerIdentifier==id then
                abortRound(room,'EXPLAINER_LEFT')
            elseif rs.phase=='guess' then
                local expected,submitted=0,0
                for playerId,m in pairs(room.members) do
                    if not m.disconnected and m.appOpen~=false and playerId~=rs.explainerIdentifier then
                        expected=expected+1
                        if rs.guesses and rs.guesses[playerId] then submitted=submitted+1 end
                    end
                end
                if expected==0 or submitted>=expected then finishNgWord(room,false,false) end
            end
            changed=true
        elseif rs.gameId=='fake_answer' then
            if fakeAnswerPhaseReady(room) then
                if rs.phase=='submit' then buildFakeAnswerOptions(room) else finishFakeAnswer(room,false) end
            end
            changed=true
        elseif rs.gameId=='memory_chain' then
            rs.eliminated=rs.eliminated or {}
            if not rs.eliminated[id] then rs.eliminated[id]=tonumber(rs.stage) or 1 end
            maybeResolveMemoryStage(room)
            changed=true
        end
    end
    -- appOpen changed above can reduce the set of participants a simultaneous-input
    -- round is waiting for. Reconcile immediately so a closed, unsubmitted client
    -- cannot leave everyone else waiting until the deadline.
    if room.state=='round' and reconcileRound(room) then changed=true end
    if handoffHostFrom(room,id) then changed=true end
    if changed then notifyRoom(room,source) end
end

function FlecityGamesParty.LeaveRoom(source)
    local id=identifier(source) local room=roomForPlayer(source,id)
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
    local m=room.members[id]
    local rs=room.roundState
    if room.state=='round' and rs and rs.gameId=='fall_battle' and not rs.complete
        and rs.submissions and rs.submissions[id]==nil then
        rs.submissions[id]={score=0,lines=0,pieces=0,ended=true,forfeited=true}
    end
    m.source=nil m.disconnected=true m.disconnectedAt=os.time()
    if room.state=='lobby' then m.ready=false end
    migrateHost(room) reconcileRound(room) notifyRoom(room)
end

function FlecityGamesParty.Cleanup()
    local now=os.time()
    local roomIds={} for roomId in pairs(rooms) do roomIds[#roomIds+1]=roomId end
    for _,roomId in ipairs(roomIds) do
        local room=rooms[roomId]
        if room then
            local lastActivity=tonumber(room.lastActivityAt) or tonumber(room.createdAt) or now
            local expired=now-lastActivity>FlecityGamesConfig.Party.RoomMaxAgeSeconds
            local removals={}
            for id,m in pairs(room.members) do
                if expired or (m.disconnected and m.disconnectedAt and now-m.disconnectedAt>FlecityGamesConfig.Party.DisconnectGraceSeconds) then removals[#removals+1]=id end
            end
            local changed=#removals>0
            for _,id in ipairs(removals) do if rooms[roomId] then removeMember(room,id) end end
            if rooms[roomId] then
                migrateHost(room)
                local roundChanged=reconcileRound(room)
                if changed or roundChanged then notifyRoom(room) end
            end
        end
    end
end

function FlecityGamesParty.DebugSelftest()
    local promptRoom={promptIndexes={test=1}}
    local noRepeatPrompt=pickRoomPrompt(promptRoom,'test',{'A','B'})
    local rotated=rotatedIdentifiers({'a','b','c'},2)

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
        topics={a='猫',b='猫',c='犬'},wolfIdentifier='c',majorityTopic='猫',wolfTopic='犬',voteUnlockTick=12345
    }}
    local wolfA=publicRoundState(wolfRoom,'a')
    local wolfC=publicRoundState(wolfRoom,'c')

    local liarRoom={members=members,roundState={
        token='liar',gameId='liar',startedAt=0,startedTick=0,complete=false,submissions={},
        prompt='質問',roles={a='TRUTH',b='LIAR',c='TRUTH'},liarIdentifier='b',voteUnlockTick=12345
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

    local telephoneNameRoom={members={
        a={memberId='A',name='Alpha',disconnected=false,joinOrder=1},
        b={memberId='B',name='Bravo',disconnected=false,joinOrder=2}
    },roundState={
        token='tel-name',gameId='telephone',startedAt=0,startedTick=0,complete=true,submissions={},
        chain={{kind='text',text='START'},{kind='draw',byIdentifier='a',byName='Alpha',strokes={{{x=0,y=0},{x=1,y=1}}}}}
    }}
    telephoneNameRoom.members.a=nil
    local telephoneNameChain=telephonePublicChain(telephoneNameRoom,telephoneNameRoom.roundState)

    local majorityRoom={members=members,roundState={
        token='majority',gameId='majority',startedAt=0,startedTick=0,complete=false,
        submissions={a='A',b='A',c='B'},prompt='test',options={'one','two'}
    }}
    maybeFinishMajority(majorityRoom)

    local minorityRoom={members=members,roundState={
        token='minority',gameId='minority',startedAt=0,startedTick=0,complete=false,
        submissions={a='A',b='A',c='B'},prompt='test',options={'one','two'}
    }}
    maybeFinishMinority(minorityRoom)
    local minorityUnanimousRoom={members=members,roundState={
        token='minority-unanimous',gameId='minority',startedAt=0,startedTick=0,complete=false,
        submissions={a='A',b='A',c='A'},prompt='test',options={'one','two'}
    }}
    maybeFinishMinority(minorityUnanimousRoom)

    local ticTacRoom={members={
        a={memberId='A',name='Alpha',disconnected=false,joinOrder=1},
        b={memberId='B',name='Bravo',disconnected=false,joinOrder=2}
    },roundState={
        token='tic',gameId='tic_tac',startedAt=0,startedTick=0,complete=false,submissions={},
        board={'X','X','','O','O','','','',''},turnOrder={'a','b'},currentIdentifier='a',
        symbols={a='X',b='O'}
    }}
    ticTacRoom.roundState.board[3]='X'
    local ticWinner=ticTacWinner(ticTacRoom.roundState.board)

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
    local drawProgressBeforeDisconnect=publicRoundState(drawRoom,'a').guessedCount
    members.c.disconnected=true
    local drawProgressAfterDisconnect=publicRoundState(drawRoom,'a').guessedCount
    members.c.disconnected=false
    maybeFinishDraw(drawRoom)

    local targetDisconnectRoom={members={
        a={memberId='A',name='Alpha',disconnected=false,joinOrder=1},
        b={memberId='B',name='Bravo',disconnected=true,joinOrder=2},
        c={memberId='C',name='Charlie',disconnected=false,joinOrder=3},
        d={memberId='D',name='Delta',disconnected=false,joinOrder=4}
    },roundState={
        token='target-disconnect',gameId='vote',startedAt=0,startedTick=0,complete=false,
        submissions={a='b',c='a'}
    }}
    reconcileRound(targetDisconnectRoom)

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
        turnOrder={'a','b','c'},step=2,mode='text',currentIdentifier='b',
        chain={{kind='text',text='秘密のお題'},{kind='draw',byIdentifier='a',byName='Alpha',strokes={{{x=0,y=0},{x=1,y=1}}}}},
        deadlineTick=GetGameTimer()+10000,deadlineDurationSec=45
    }}
    reconcileRound(telephoneSkipRoom)

    local appCloseHostRoom={
        hostIdentifier='a',
        members={
            a={memberId='A',name='Alpha',disconnected=false,appOpen=false,joinOrder=1},
            b={memberId='B',name='Bravo',disconnected=false,appOpen=false,joinOrder=2},
            c={memberId='C',name='Charlie',disconnected=false,appOpen=true,joinOrder=3}
        }
    }
    local appCloseHandoff=handoffHostFrom(appCloseHostRoom,'a')

    local recentDisconnectRoom={members={
        a={memberId='A',name='Alpha',disconnected=false,joinOrder=1},
        b={memberId='B',name='Bravo',disconnected=true,disconnectedAt=os.time(),joinOrder=2}
    }}
    local recentReclaimed=reclaimDisconnectedCapacity(recentDisconnectRoom,2)

    local expiredDisconnectRoom={members={
        a={memberId='A',name='Alpha',disconnected=false,joinOrder=1},
        b={memberId='B',name='Bravo',disconnected=true,disconnectedAt=os.time()-(FlecityGamesConfig.Party.DisconnectGraceSeconds+5),joinOrder=2}
    }}
    local fallBattleRoom={members={
        a={memberId='A',name='Alpha',disconnected=false,joinOrder=1},
        b={memberId='B',name='Bravo',disconnected=false,joinOrder=2},
        c={memberId='C',name='Charlie',disconnected=false,joinOrder=3}
    },roundState={
        token='fall-battle-test',gameId='fall_battle',startedAt=0,startedTick=0,complete=false,
        submissions={
            a={score=1200,lines=4,pieces=20},
            b={score=1200,lines=3,pieces=21},
            c={score=0,lines=0,pieces=0,forfeited=true}
        }
    }}
    maybeFinishFallBattle(fallBattleRoom)

    local fallBattleDisconnectForfeit=fallBattleRoom.roundState.complete==true
        and #fallBattleRoom.roundState.results.winnerMemberIds==1
        and fallBattleRoom.roundState.results.winnerMemberIds[1]=='A'
        and fallBattleRoom.roundState.results.entries[3].forfeited==true

    local appClosedTelephoneRoom={members={
        a={memberId='A',name='Alpha',disconnected=false,appOpen=false,joinOrder=1},
        b={memberId='B',name='Bravo',disconnected=false,appOpen=true,joinOrder=2},
        c={memberId='C',name='Charlie',disconnected=false,appOpen=true,joinOrder=3}
    },roundState={
        token='tel-app-closed',gameId='telephone',startedAt=0,startedTick=0,complete=false,submissions={},
        turnOrder={'a','b','c'},step=1,mode='draw',currentIdentifier='a',
        chain={{kind='text',text='START'}}
    }}
    ensureTelephoneTurn(appClosedTelephoneRoom)

    local appClosedBombRoom={members={
        a={memberId='A',name='Alpha',disconnected=false,appOpen=false,joinOrder=1},
        b={memberId='B',name='Bravo',disconnected=false,appOpen=true,joinOrder=2},
        c={memberId='C',name='Charlie',disconnected=false,appOpen=true,joinOrder=3}
    },roundState={
        token='bomb-app-closed',gameId='bomb',startedAt=0,startedTick=0,complete=false,submissions={},
        turnOrder={'a','b','c'},currentIndex=3,currentIdentifier='c',passes=0
    }}
    advanceBomb(appClosedBombRoom)

    local appClosedTicRoom={members={
        a={memberId='A',name='Alpha',disconnected=false,appOpen=false,joinOrder=1},
        b={memberId='B',name='Bravo',disconnected=false,appOpen=true,joinOrder=2}
    },roundState={
        token='tic-app-closed',gameId='tic_tac',startedAt=0,startedTick=0,complete=false,submissions={},
        board={'','','','','','','','',''},turnOrder={'a','b'},currentIdentifier='a',symbols={a='X',b='O'}
    }}
    finishTicTacForfeit(appClosedTicRoom,'a','APP_CLOSED')

    local memoryDisconnectRoom={members={
        a={memberId='A',name='Alpha',disconnected=false,appOpen=true,joinOrder=1},
        b={memberId='B',name='Bravo',disconnected=true,appOpen=false,joinOrder=2}
    },roundState={
        token='memory-disconnect',gameId='memory_chain',startedAt=0,startedTick=0,complete=false,submissions={},
        stage=3,phase='input',sequence={'A','B','C'},stageSubmissions={},eliminated={b=3},maxStages=8
    }}
    reconcileRound(memoryDisconnectRoom)

    local memoryAppClosedRoom={members={
        a={memberId='A',name='Alpha',disconnected=false,appOpen=true,joinOrder=1},
        b={memberId='B',name='Bravo',disconnected=false,appOpen=false,joinOrder=2}
    },roundState={
        token='memory-app-closed',gameId='memory_chain',startedAt=0,startedTick=0,complete=false,submissions={},
        stage=3,phase='input',sequence={'A','B','C'},stageSubmissions={},eliminated={},maxStages=8
    }}
    reconcileRound(memoryAppClosedRoom)

    local fallDisconnectRoom={members={
        a={memberId='A',name='Alpha',disconnected=false,appOpen=true,joinOrder=1},
        b={memberId='B',name='Bravo',disconnected=true,appOpen=false,joinOrder=2}
    },roundState={
        token='fall-disconnect',gameId='fall_battle',startedAt=0,startedTick=0,complete=false,
        submissions={
            a={score=900,lines=2,pieces=16},
            b={score=0,lines=0,pieces=0,ended=true,forfeited=true}
        }
    }}
    reconcileRound(fallDisconnectRoom)

    return {
        promptNoImmediateRepeat=noRepeatPrompt=='B' and promptRoom.promptIndexes.test==2,
        turnRotation=rotated[1]=='b' and rotated[2]=='c' and rotated[3]=='a',
        roomRevision=revisionValue==4 and revisionRoom.revision==4,
        hostMigration=hostRoom.hostIdentifier=='second',
        appCloseHostHandoff=appCloseHandoff==true and appCloseHostRoom.hostIdentifier=='c',
        reconnectGracePreserved=recentReclaimed==0 and memberCount(recentDisconnectRoom)==2,
        expiredCapacityReclaimed=expiredReclaimed==1 and memberCount(expiredDisconnectRoom)==1,
        fallBattleDisconnectForfeit=fallBattleDisconnectForfeit,
        telephoneAppCloseSkip=appClosedTelephoneRoom.roundState.currentIdentifier=='b'
            and appClosedTelephoneRoom.roundState.step==2
            and appClosedTelephoneRoom.roundState.deadlineDurationSec==45,
        bombAppCloseSkip=appClosedBombRoom.roundState.currentIdentifier=='b'
            and appClosedBombRoom.roundState.currentIndex==2,
        ticTacAppCloseForfeit=appClosedTicRoom.roundState.complete==true
            and appClosedTicRoom.roundState.results.winnerMemberId=='B'
            and appClosedTicRoom.roundState.results.reason=='APP_CLOSED',
        memoryChainDisconnectContinues=memoryDisconnectRoom.roundState.complete==true
            and memoryDisconnectRoom.roundState.results.winnerMemberIds[1]=='A'
            and memoryDisconnectRoom.roundState.results.reason=='LAST_ALIVE',
        memoryChainAppCloseContinues=memoryAppClosedRoom.roundState.complete==true
            and memoryAppClosedRoom.roundState.results.winnerMemberIds[1]=='A'
            and memoryAppClosedRoom.roundState.results.reason=='LAST_ALIVE',
        fallBattleDisconnectContinues=fallDisconnectRoom.roundState.complete==true
            and fallDisconnectRoom.roundState.results.winnerMemberIds[1]=='A'
            and #fallDisconnectRoom.roundState.results.entries==2
            and fallDisconnectRoom.roundState.results.entries[2].forfeited==true,
        connectedCount=connectedCount(hostRoom)==2,
        memberCount=memberCount(hostRoom)==3,
        stopMidpoint=math.abs(trianglePosition(450,1800,0)-50)<0.001,
        majorityPrompts=#majorityPrompts>=4,
        majorityAggregation=majorityRoom.roundState.complete==true and majorityRoom.roundState.results.counts.A==2 and majorityRoom.roundState.results.counts.B==1,
        minorityAggregation=minorityRoom.roundState.complete==true
            and minorityRoom.roundState.results.winningChoice=='B'
            and minorityRoom.roundState.results.counts.A==2
            and minorityRoom.roundState.results.counts.B==1,
        minorityUnanimousNoWinner=minorityUnanimousRoom.roundState.complete==true
            and minorityUnanimousRoom.roundState.results.winningChoice==nil
            and minorityUnanimousRoom.roundState.results.noMinority==true,
        ticTacWinner=ticWinner=='X' and ticTacFull({'X','O','X','X','O','O','O','X','X'})==true,
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
        drawPrompts=#drawPrompts>=50,
        drawAliasMatch=drawGuessMatches('車','自動車') and drawGuessMatches('スマホ','携帯電話') and not drawGuessMatches('猫','犬'),
        drawPrivacy=drawA.prompt=='猫' and drawB.prompt==nil and drawA.isDrawer==true and drawB.isDrawer==false,
        drawConnectedProgress=drawProgressBeforeDisconnect==2 and drawProgressAfterDisconnect==1,
        drawCompletion=drawRoom.roundState.complete==true
            and #drawRoom.roundState.results.entries==2
            and drawRoom.roundState.results.entries[1].memberId=='B',
        disconnectedTargetVoteReset=targetDisconnectRoom.roundState.complete~=true
            and targetDisconnectRoom.roundState.submissions.a==nil
            and targetDisconnectRoom.roundState.submissions.c=='a',
        roundAbortLowPlayers=lowPlayerRoom.roundState.complete==true
            and lowPlayerRoom.roundState.results.reason=='NOT_ENOUGH_PLAYERS',
        secretRoleDisconnectAbort=secretLeftRoom.roundState.complete==true
            and secretLeftRoom.roundState.results.reason=='SECRET_PLAYER_LEFT',
        telephonePrompts=#telephonePrompts>=6,
        telephonePrivacy=telephoneA.promptText=='秘密のお題' and telephoneB.promptText==nil and telephoneA.isCurrent==true and telephoneB.isCurrent==false,
        telephoneContributorNamePreserved=telephoneNameChain[2] and telephoneNameChain[2].name=='Alpha',
        telephoneDisconnectSkip=telephoneSkipRoom.roundState.step==3
            and telephoneSkipRoom.roundState.currentIdentifier=='c'
            and telephoneSkipRoom.roundState.mode=='text',
        telephoneDisconnectFreshDeadline=telephoneSkipRoom.roundState.deadlineDurationSec==30
            and tonumber(telephoneSkipRoom.roundState.deadlineTick)>GetGameTimer(),
        telephoneContinuesWithTwo=telephoneSkipRoom.roundState.complete~=true
    }
end

function FlecityGamesParty.DebugCounts()
    local roomCount,memberTotal=0,0
    for _,room in pairs(rooms) do roomCount=roomCount+1 memberTotal=memberTotal+memberCount(room) end
    return roomCount,memberTotal
end

function FlecityGamesParty.DebugRoomSummaries()
    local out={}
    local nowTick=GetGameTimer()
    for _,room in pairs(rooms) do
        local readyCount,disconnectedCount,appOpenCount=0,0,0
        for _,m in pairs(room.members or {}) do
            if m.ready==true and not m.disconnected then readyCount=readyCount+1 end
            if m.disconnected then disconnectedCount=disconnectedCount+1 end
            if not m.disconnected and m.appOpen~=false then appOpenCount=appOpenCount+1 end
        end
        local rs=room.roundState
        local remainingMs=nil
        if rs and not rs.complete and tonumber(rs.deadlineTick) then
            remainingMs=math.max(0,tonumber(rs.deadlineTick)-nowTick)
        end
        local host=room.hostIdentifier and room.members[room.hostIdentifier] or nil
        out[#out+1]={
            code=room.code,
            state=room.state,
            game=rs and rs.gameId or room.selectedGame,
            round=room.round,
            complete=rs and rs.complete==true or false,
            members=memberCount(room),
            connected=connectedCount(room),
            ready=readyCount,
            disconnected=disconnectedCount,
            appOpen=appOpenCount,
            host=host and host.name or 'none',
            deadlineMs=remainingMs
        }
    end
    table.sort(out,function(a,b) return tostring(a.code)<tostring(b.code) end)
    return out
end
