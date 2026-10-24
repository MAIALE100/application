FlecityGamesRegistry = FlecityGamesRegistry or {}

local games = {}

local function register(def)
    assert(type(def) == 'table', 'game definition must be a table')
    assert(type(def.id) == 'string' and def.id ~= '', 'game id is required')
    assert(not games[def.id], ('duplicate game id: %s'):format(def.id))
    games[def.id] = def
end

local defs = {
    {order=10,id='quick_tap',name='QUICK TAP FOCUS',app='play',category='quick',description='7回の合図へ安定して反応。3ライフとフライング罰つきの集中RUN。',minPlayers=1,maxPlayers=1,supportsResume=false,supportsRanking=true,supportsDaily=true,rankingOrder='asc',enabled=true,version=2},
    {order=20,id='stop',name='STOP! RUSH',app='play',category='quick',description='止めるたびに加速。1ミスまで連続クリアを伸ばすタイミングRUN。',minPlayers=1,maxPlayers=1,supportsResume=false,supportsRanking=true,supportsDaily=true,rankingOrder='desc',enabled=true,version=2},
    {order=30,id='stack',name='TOWER',app='play',category='arcade',description='精密にブロックを積み、PERFECT連続で倍率を伸ばすスキルアーケード。',minPlayers=1,maxPlayers=1,supportsResume=false,supportsRanking=true,supportsDaily=false,rankingOrder='desc',enabled=true,version=2},
    {order=40,id='block',name='BLOCK',app='play',category='endless',description='盤面を広く保ち、ライン連鎖でFEVER。DANGERからのCLUTCH消しで大逆転を狙う。',minPlayers=1,maxPlayers=1,supportsResume=true,supportsRanking=true,supportsDaily=true,rankingOrder='desc',enabled=true,version=1},
    {order=50,id='merge',name='MERGE',app='play',category='endless',description='連続合成でCHAIN倍率をつなぎ、NEW TILE到達の瞬間を積み重ねるエンドレスRUN。',minPlayers=1,maxPlayers=1,supportsResume=true,supportsRanking=true,supportsDaily=false,rankingOrder='desc',enabled=true,version=2},
    {order=55,id='fall',name='FALL',app='play',category='endless',description='自動落下・HOLD・SOFT/HARD DROPを使い、ライン連続消しとLEVEL UPを狙う。',minPlayers=1,maxPlayers=1,supportsResume=true,supportsRanking=true,supportsDaily=false,rankingOrder='desc',enabled=true,version=2},
    {order=60,id='mines',name='MINES',app='play',category='puzzle',description='地雷を避けて安全地帯を広げる。連続オープンとCHORDで盤面を一気に崩すロジックRUN。',minPlayers=1,maxPlayers=1,supportsResume=true,supportsRanking=true,supportsDaily=true,rankingOrder='asc',enabled=true,version=2},
    {order=70,id='nonogram',name='NONOGRAM',app='play',category='puzzle',description='ヒントから絵を復元。ライン連続完成でFLOWをつなぎ、少ない迷いで解き切る。',minPlayers=1,maxPlayers=1,supportsResume=true,supportsRanking=true,supportsDaily=true,rankingOrder='asc',enabled=true,version=2},
    {order=80,id='memory',name='MEMORY FOCUS',app='play',category='puzzle',description='16枚のカードをめくって、8組のペアをすべて見つける。',minPlayers=1,maxPlayers=1,supportsResume=false,supportsRanking=true,supportsDaily=true,rankingOrder='asc',enabled=true,version=2},
    {order=85,id='sort',name='SORT',app='play',category='puzzle',description='4色を揃える整理パズル。完成チューブを連続で作り、最短手数のCLEAN RUNを狙う。',minPlayers=1,maxPlayers=1,supportsResume=true,supportsRanking=true,supportsDaily=true,rankingOrder='asc',enabled=true,version=1},
    {order=87,id='slide',name='SLIDE',app='play',category='puzzle',description='15パズルを揃える。正位置タイルを増やしてALIGN FLOWを伸ばし、PAR以内の高評価を狙う。',minPlayers=1,maxPlayers=1,supportsResume=true,supportsRanking=true,supportsDaily=true,rankingOrder='asc',enabled=true,version=1},
    {order=90,id='color_match',name='COLOR MATCH RUSH',app='play',category='quick',description='20問・3ライフ。色を見抜き、ミスのタイム罰を抑えて完走する集中RUN。',minPlayers=1,maxPlayers=1,supportsResume=false,supportsRanking=true,supportsDaily=true,rankingOrder='asc',enabled=true,version=2},
    {order=100,id='number_rush',name='NUMBER RUSH SHIFT',app='play',category='quick',description='1から25を追う途中で盤面が4回SHIFT。視線を切り替えながら最速完走を狙う。',minPlayers=1,maxPlayers=1,supportsResume=false,supportsRanking=true,supportsDaily=true,rankingOrder='asc',enabled=true,version=2},
    {order=110,id='high_low',name='RANGE RUSH',app='play',category='arcade',description='3ライフの高速判断戦。際どいTIGHT問題ほどBOUNTYが高い。',minPlayers=1,maxPlayers=1,supportsResume=false,supportsRanking=true,supportsDaily=false,rankingOrder='desc',enabled=true,version=3},
    {order=120,id='simon',name='SIMON',app='play',category='arcade',description='光った順番を覚えて、同じ順番で押し続ける記憶ゲーム。',minPlayers=1,maxPlayers=1,supportsResume=false,supportsRanking=true,supportsDaily=true,rankingOrder='desc',enabled=true,version=2},
    {order=10,id='code_break',name='CODE BREAK',app='party',category='logic',description='4つの記号コードをHIT/BLOWの手掛かりから推理。最大8手で解読を競う。',minPlayers=2,maxPlayers=10,supportsResume=false,supportsRanking=false,supportsDaily=false,rankingOrder='asc',enabled=true,version=1},
    {order=20,id='reversi',name='REVERSI',app='party',category='board',description='8×8盤で石を挟んで返す定番戦略ゲーム。合法手・パス・石数判定まで対応。',minPlayers=2,maxPlayers=2,supportsResume=false,supportsRanking=false,supportsDaily=false,rankingOrder='desc',enabled=true,version=1},
    {order=30,id='vote',name='VOTE',app='party',category='social',description='お題に一番当てはまる人へ投票する。',minPlayers=3,maxPlayers=10,supportsResume=false,supportsRanking=false,supportsDaily=false,rankingOrder='desc',enabled=true,version=1},
    {order=40,id='gomoku',name='GOMOKU',app='party',category='board',description='11×11盤で先に5つ並べた方が勝ち。短時間でも読み合いが深い五目並べ。',minPlayers=2,maxPlayers=2,supportsResume=false,supportsRanking=false,supportsDaily=false,rankingOrder='desc',enabled=true,version=1},
    {order=45,id='connect4',name='CONNECT 4',app='party',category='board',description='7列へ交互に駒を落とし、縦・横・斜めに4つ並べる戦略ゲーム。',minPlayers=2,maxPlayers=2,supportsResume=false,supportsRanking=false,supportsDaily=false,rankingOrder='desc',enabled=true,version=1},
    {order=47,id='tic_tac',name='TIC-TAC',app='party',category='quick',description='2人で交互にマスを取り、縦・横・斜めの3つ揃いを狙う。',minPlayers=2,maxPlayers=2,supportsResume=false,supportsRanking=false,supportsDaily=false,rankingOrder='desc',enabled=true,version=1},
    {order=50,id='word_wolf',name='WORD WOLF',app='party',category='voice',description='似た秘密のお題について話し、少数派を見つける。',minPlayers=3,maxPlayers=10,supportsResume=false,supportsRanking=false,supportsDaily=false,rankingOrder='desc',enabled=true,version=1},
    {order=60,id='liar',name='LIAR',app='party',category='voice',description='嘘で答える役を会話から見つける。',minPlayers=3,maxPlayers=10,supportsResume=false,supportsRanking=false,supportsDaily=false,rankingOrder='desc',enabled=true,version=1},
    {order=70,id='draw',name='DRAW',app='party',category='creative',description='お題を絵で伝えて、みんなに当ててもらう。',minPlayers=2,maxPlayers=10,supportsResume=false,supportsRanking=false,supportsDaily=false,rankingOrder='desc',enabled=true,version=1},
    {order=80,id='telephone',name='TELEPHONE',app='party',category='creative',description='文章と絵を交互につないで、最後に伝言の変化を見る。',minPlayers=3,maxPlayers=10,supportsResume=false,supportsRanking=false,supportsDaily=false,rankingOrder='desc',enabled=true,version=1},
    {order=90,id='ng_word',name='NG WORD',app='party',category='voice',description='NGワードを避けてお題を説明し、みんなで最速正解を狙う。',minPlayers=3,maxPlayers=10,supportsResume=false,supportsRanking=false,supportsDaily=false,rankingOrder='desc',enabled=true,version=1,premium=true},
    {order=100,id='fake_answer',name='FAKE ANSWER',app='party',category='social',description='本物っぽい偽回答を作り、正解を見抜きながら他の人を騙す。',minPlayers=3,maxPlayers=10,supportsResume=false,supportsRanking=false,supportsDaily=false,rankingOrder='desc',enabled=true,version=1,premium=true},
    {order=110,id='bomb',name='BOMB',app='party',category='voice',description='お題に答えたら次へ。誰の手元で爆発するか分からないVCリレー。',minPlayers=3,maxPlayers=10,supportsResume=false,supportsRanking=false,supportsDaily=false,rankingOrder='desc',enabled=true,version=1,premium=true},
    {order=120,id='memory_chain',name='MEMORY CHAIN',app='party',category='quick',description='伸びていく記号列を覚えて入力。間違い・未入力で脱落する記憶勝負。',minPlayers=2,maxPlayers=10,supportsResume=false,supportsRanking=false,supportsDaily=false,rankingOrder='desc',enabled=true,version=1,premium=true},
    {order=130,id='fall_battle',name='FALL BATTLE',app='party',category='arcade',description='全員同じピース列で90秒勝負。FALLの操作感でスコアとライン数を競う。',minPlayers=2,maxPlayers=10,supportsResume=false,supportsRanking=false,supportsDaily=false,rankingOrder='desc',enabled=true,version=1,premium=true}
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
        local ao=tonumber(a.order) or 9999
        local bo=tonumber(b.order) or 9999
        if ao==bo then return a.name<b.name end
        return ao<bo
    end)
    return out
end
