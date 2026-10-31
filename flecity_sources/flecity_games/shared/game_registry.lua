FlecityGamesRegistry = FlecityGamesRegistry or {}

local games = {}

local function register(def)
    assert(type(def) == 'table', 'game definition must be a table')
    assert(type(def.id) == 'string' and def.id ~= '', 'game id is required')
    assert(not games[def.id], ('duplicate game id: %s'):format(def.id))
    games[def.id] = def
end

local defs = {
    {order=10,id='quick_tap',name='反射神経チャレンジ',app='play',category='quick',description='合図に合わせてすばやくタップ。7回の反応時間を競います。',minPlayers=1,maxPlayers=1,supportsResume=false,supportsRanking=true,supportsDaily=true,rankingOrder='asc',enabled=true,version=2},
    {order=20,id='stop',name='タイミングストップ',app='play',category='quick',description='動く目印を狙ったゾーンで止めるゲーム。成功するほど速くなります。',minPlayers=1,maxPlayers=1,supportsResume=false,supportsRanking=true,supportsDaily=true,rankingOrder='desc',enabled=true,version=2},
    {order=30,id='stack',name='タワー積み',app='play',category='arcade',description='動くブロックを重ねて高いタワーを作ろう。ずれを抑えるほど高得点。',minPlayers=1,maxPlayers=1,supportsResume=false,supportsRanking=true,supportsDaily=false,rankingOrder='desc',enabled=true,version=2},
    {order=40,id='block',name='ブロックパズル',app='play',category='endless',description='ブロックで縦横の列をそろえて消そう。続けて消すと高得点。',minPlayers=1,maxPlayers=1,supportsResume=true,supportsRanking=true,supportsDaily=true,rankingOrder='desc',enabled=true,version=1},
    {order=50,id='merge',name='数字マージ',app='play',category='endless',description='同じ数字を合体して大きくしよう。連続合体が高得点のコツ。',minPlayers=1,maxPlayers=1,supportsResume=true,supportsRanking=true,supportsDaily=false,rankingOrder='desc',enabled=true,version=2},
    {order=55,id='fall',name='テトリス',app='play',category='endless',description='落ちてくるブロックを左右・回転で操作し、横一列をそろえて消そう。',minPlayers=1,maxPlayers=1,supportsResume=true,supportsRanking=true,supportsDaily=false,rankingOrder='desc',enabled=true,version=2},
    {order=60,id='mines',name='マインスイーパー',app='play',category='puzzle',description='数字をヒントに地雷のないマスを開こう。長押しで旗を立てられます。',minPlayers=1,maxPlayers=1,supportsResume=true,supportsRanking=true,supportsDaily=true,rankingOrder='asc',enabled=true,version=2},
    {order=70,id='nonogram',name='お絵かきロジック',app='play',category='puzzle',description='縦と横の数字をヒントにマスを塗って絵を完成させよう。',minPlayers=1,maxPlayers=1,supportsResume=true,supportsRanking=true,supportsDaily=true,rankingOrder='asc',enabled=true,version=2},
    {order=80,id='memory',name='神経衰弱',app='play',category='puzzle',description='裏返しのカードから同じ絵柄を2枚見つけよう。',minPlayers=1,maxPlayers=1,supportsResume=false,supportsRanking=true,supportsDaily=true,rankingOrder='asc',enabled=true,version=2},
    {order=85,id='sort',name='カラーソート',app='play',category='puzzle',description='色を移して、1つの容器を同じ色だけにそろえよう。',minPlayers=1,maxPlayers=1,supportsResume=true,supportsRanking=true,supportsDaily=true,rankingOrder='asc',enabled=true,version=1},
    {order=87,id='slide',name='15パズル',app='play',category='puzzle',description='空きマスへ数字を動かして、1から15まで順番に並べよう。',minPlayers=1,maxPlayers=1,supportsResume=true,supportsRanking=true,supportsDaily=true,rankingOrder='asc',enabled=true,version=1},
    {order=90,id='color_match',name='色あてラッシュ',app='play',category='quick',description='色のひっかけ問題にすばやく答えよう。全20問・ライフは3つ。',minPlayers=1,maxPlayers=1,supportsResume=false,supportsRanking=true,supportsDaily=true,rankingOrder='asc',enabled=true,version=2},
    {order=100,id='number_rush',name='数字タッチ',app='play',category='quick',description='1から25を順番にタップ。途中で数字の配置が変わります。',minPlayers=1,maxPlayers=1,supportsResume=false,supportsRanking=true,supportsDaily=true,rankingOrder='asc',enabled=true,version=2},
    {order=110,id='high_low',name='ハイ＆ロー',app='play',category='arcade',description='次の数字が高いか低いかを予想。ライフがなくなるまで挑戦。',minPlayers=1,maxPlayers=1,supportsResume=false,supportsRanking=true,supportsDaily=false,rankingOrder='desc',enabled=true,version=3},
    {order=120,id='simon',name='ひかりの記憶',app='play',category='arcade',description='光った順番を覚えて同じ順にタップ。どこまで続けられる？',minPlayers=1,maxPlayers=1,supportsResume=false,supportsRanking=true,supportsDaily=true,rankingOrder='desc',enabled=true,version=2},
    {order=10,id='code_break',name='ヒット＆ブロー',app='party',category='logic',description='ヒットとブローの手掛かりから4つのコードを推理。1人はAI対戦、2人は対人戦。',minPlayers=1,maxPlayers=2,supportsResume=false,supportsRanking=false,supportsDaily=false,rankingOrder='asc',enabled=true,version=3},
    {order=20,id='reversi',name='リバーシ',app='party',category='board', description='8×8盤の戦略ゲーム。1人はAI対戦、2人は対人戦。合法手・パス・石数判定対応。',minPlayers=1,maxPlayers=2,supportsResume=false,supportsRanking=false,supportsDaily=false,rankingOrder='desc',enabled=true,version=1},
    {order=30,id='vote',name='みんなで投票',app='party',category='social',description='お題に一番当てはまる人へ投票する。',minPlayers=3,maxPlayers=10,supportsResume=false,supportsRanking=false,supportsDaily=false,rankingOrder='desc',enabled=true,version=1},
    {order=40,id='gomoku',name='五目並べ',app='party',category='board',description='11×11盤の五目並べ。1人はAI対戦、2人は対人戦。先に5つ並べれば勝ち。',minPlayers=1,maxPlayers=2,supportsResume=false,supportsRanking=false,supportsDaily=false,rankingOrder='desc',enabled=true,version=1},
    {order=45,id='connect4',name='コネクトフォー',app='party',category='board',description='7列へ駒を落として縦・横・斜めに4つつなげる対戦ゲーム。1人はAI対戦、2人は対人戦。',minPlayers=1,maxPlayers=2,supportsResume=false,supportsRanking=false,supportsDaily=false,rankingOrder='desc',enabled=true,version=1},
    {order=47,id='mini_shogi',name='将棋',app='party',category='board',description='9×9の本将棋。1人はAI対戦、2人は対人戦。持ち駒・駒打ち・成り・王手判定に対応。',minPlayers=1,maxPlayers=2,supportsResume=false,supportsRanking=false,supportsDaily=false,rankingOrder='desc',enabled=true,version=1},
    {order=50,id='word_wolf',name='ワードウルフ',app='party',category='voice',description='似た秘密のお題について話し、少数派を見つける。',minPlayers=3,maxPlayers=10,supportsResume=false,supportsRanking=false,supportsDaily=false,rankingOrder='desc',enabled=true,version=1},
    {order=60,id='liar',name='ウソつき探し',app='party',category='voice',description='嘘で答える役を会話から見つける。',minPlayers=3,maxPlayers=10,supportsResume=false,supportsRanking=false,supportsDaily=false,rankingOrder='desc',enabled=true,version=1},
    {order=70,id='draw',name='お絵かきゲーム',app='party',category='creative',description='お絵かき当て / お絵かき伝言から遊び方を選べます。',minPlayers=2,maxPlayers=10,supportsResume=false,supportsRanking=false,supportsDaily=false,rankingOrder='desc',enabled=true,version=1},
    {order=80,id='telephone',name='お絵かき伝言',app='party',category='creative',description='文章と絵を交互につないで、最後に伝言の変化を見る。',minPlayers=3,maxPlayers=10,supportsResume=false,supportsRanking=false,supportsDaily=false,rankingOrder='desc',enabled=true,version=1},
    {order=90,id='ng_word',name='NGワード',app='party',category='voice',description='NGワードを避けてお題を説明し、みんなで最速正解を狙う。',minPlayers=3,maxPlayers=10,supportsResume=false,supportsRanking=false,supportsDaily=false,rankingOrder='desc',enabled=true,version=1},
    {order=100,id='fake_answer',name='ニセ回答',app='party',category='social',description='本物っぽい偽回答を作り、正解を見抜きながら他の人を騙す。',minPlayers=3,maxPlayers=10,supportsResume=false,supportsRanking=false,supportsDaily=false,rankingOrder='desc',enabled=true,version=1},
    {order=110,id='bomb',name='爆弾リレー',app='party',category='voice',description='お題に答えたら次へ。誰の手元で爆発するか分からないVCリレー。',minPlayers=3,maxPlayers=10,supportsResume=false,supportsRanking=false,supportsDaily=false,rankingOrder='desc',enabled=true,version=1},
    {order=120,id='memory_chain',name='記憶チェイン',app='party',category='quick',description='伸びていく記号列を覚えて入力。間違い・未入力で脱落する記憶勝負。',minPlayers=2,maxPlayers=10,supportsResume=false,supportsRanking=false,supportsDaily=false,rankingOrder='desc',enabled=true,version=1},
    {order=130,id='fall_battle',name='テトリス',app='party',category='arcade',description='全員同じピース列でスコアとライン数を競うテトリス対戦。',minPlayers=2,maxPlayers=10,supportsResume=false,supportsRanking=false,supportsDaily=false,rankingOrder='desc',enabled=true,version=1}
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
