FlecityGamesRegistry = FlecityGamesRegistry or {}

local games = {}

local function register(def)
    assert(type(def) == 'table', 'game definition must be a table')
    assert(type(def.id) == 'string' and def.id ~= '', 'game id is required')
    assert(not games[def.id], ('duplicate game id: %s'):format(def.id))
    games[def.id] = def
end

local defs = {
    {id='quick_tap',name='QUICK TAP',app='play',category='quick',description='合図が出たら、できるだけ速くタップ。',minPlayers=1,maxPlayers=1,supportsResume=false,supportsRanking=true,supportsDaily=true,rankingOrder='asc',enabled=true,version=1},
    {id='stop',name='STOP!',app='play',category='quick',description='動くマーカーをターゲットの近くで止める。',minPlayers=1,maxPlayers=1,supportsResume=false,supportsRanking=true,supportsDaily=true,rankingOrder='desc',enabled=true,version=1},
    {id='stack',name='STACK',app='play',category='arcade',description='動くブロックを重ねて、できるだけ高く積む。',minPlayers=1,maxPlayers=1,supportsResume=false,supportsRanking=true,supportsDaily=false,rankingOrder='desc',enabled=true,version=1},
    {id='block',name='BLOCK',app='play',category='endless',description='ピースを置いて行や列を消し、盤面を広く保つ。',minPlayers=1,maxPlayers=1,supportsResume=true,supportsRanking=true,supportsDaily=true,rankingOrder='desc',enabled=true,version=1},
    {id='merge',name='MERGE',app='play',category='endless',description='同じ数字を重ねて、より大きな数字を目指す。',minPlayers=1,maxPlayers=1,supportsResume=true,supportsRanking=true,supportsDaily=false,rankingOrder='desc',enabled=true,version=1},
    {id='mines',name='MINES',app='play',category='puzzle',description='地雷を避けながら安全なマスをすべて開く。',minPlayers=1,maxPlayers=1,supportsResume=true,supportsRanking=true,supportsDaily=true,rankingOrder='asc',enabled=true,version=1},
    {id='nonogram',name='NONOGRAM',app='play',category='puzzle',description='行と列のヒントからマスを埋めるロジックパズル。',minPlayers=1,maxPlayers=1,supportsResume=true,supportsRanking=true,supportsDaily=true,rankingOrder='asc',enabled=true,version=1},
    {id='reaction',name='REACTION',app='party',category='quick',description='全員同じ合図を待ち、最速のタップを競う。',minPlayers=2,maxPlayers=8,supportsResume=false,supportsRanking=false,supportsDaily=false,rankingOrder='desc',enabled=true,version=1},
    {id='stop_battle',name='STOP! BATTLE',app='party',category='quick',description='全員共通のターゲットに一番近く止めた人が勝ち。',minPlayers=2,maxPlayers=8,supportsResume=false,supportsRanking=false,supportsDaily=false,rankingOrder='desc',enabled=true,version=1},
    {id='vote',name='VOTE',app='party',category='social',description='お題に一番当てはまる人へ投票する。',minPlayers=3,maxPlayers=10,supportsResume=false,supportsRanking=false,supportsDaily=false,rankingOrder='desc',enabled=true,version=1},
    {id='majority',name='MAJORITY',app='party',category='social',description='多数派になりそうな選択肢を予想して選ぶ。',minPlayers=3,maxPlayers=10,supportsResume=false,supportsRanking=false,supportsDaily=false,rankingOrder='desc',enabled=true,version=1},
    {id='word_wolf',name='WORD WOLF',app='party',category='voice',description='似た秘密のお題について話し、少数派を見つける。',minPlayers=3,maxPlayers=10,supportsResume=false,supportsRanking=false,supportsDaily=false,rankingOrder='desc',enabled=true,version=1},
    {id='liar',name='LIAR',app='party',category='voice',description='嘘で答える役を会話から見つける。',minPlayers=3,maxPlayers=10,supportsResume=false,supportsRanking=false,supportsDaily=false,rankingOrder='desc',enabled=true,version=1},
    {id='draw',name='DRAW',app='party',category='creative',description='お題を絵で伝えて、みんなに当ててもらう。',minPlayers=2,maxPlayers=10,supportsResume=false,supportsRanking=false,supportsDaily=false,rankingOrder='desc',enabled=true,version=1},
    {id='telephone',name='TELEPHONE',app='party',category='creative',description='文章と絵を交互につないで、最後に伝言の変化を見る。',minPlayers=3,maxPlayers=10,supportsResume=false,supportsRanking=false,supportsDaily=false,rankingOrder='desc',enabled=true,version=1}
}

for _, def in ipairs(defs) do register(def) end

function FlecityGamesRegistry.Get(id)
    return games[tostring(id or '')]
end

function FlecityGamesRegistry.List(app, enabledOnly)
    local out = {}
    for _, game in pairs(games) do
        if (not app or game.app == app) and (not enabledOnly or game.enabled == true) then
            out[#out + 1] = game
        end
    end
    table.sort(out, function(a,b)
        if a.category == b.category then return a.name < b.name end
        return a.category < b.category
    end)
    return out
end
