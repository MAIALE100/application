FlecityGamesRegistry = FlecityGamesRegistry or {}

local games = {}

local function register(def)
    assert(type(def) == 'table', 'game definition must be a table')
    assert(type(def.id) == 'string' and def.id ~= '', 'game id is required')
    assert(not games[def.id], ('duplicate game id: %s'):format(def.id))
    games[def.id] = def
end

local defs = {
    {id='quick_tap',name='QUICK TAP',app='play',category='quick',description='Wait for the signal and tap as fast as possible.',minPlayers=1,maxPlayers=1,supportsResume=false,supportsRanking=true,supportsDaily=true,rankingOrder='asc',enabled=true,version=1},
    {id='stop',name='STOP!',app='play',category='quick',description='Stop the moving marker as close to the target as possible.',minPlayers=1,maxPlayers=1,supportsResume=false,supportsRanking=true,supportsDaily=true,rankingOrder='desc',enabled=true,version=1},
    {id='stack',name='STACK',app='play',category='arcade',description='Stack moving blocks and keep the tower alive.',minPlayers=1,maxPlayers=1,supportsResume=false,supportsRanking=true,supportsDaily=false,rankingOrder='desc',enabled=true,version=1},
    {id='block',name='BLOCK',app='play',category='endless',description='Place pieces, clear lines, and keep the board open.',minPlayers=1,maxPlayers=1,supportsResume=true,supportsRanking=true,supportsDaily=true,rankingOrder='desc',enabled=true,version=1},
    {id='merge',name='MERGE',app='play',category='endless',description='Merge matching pieces into higher tiers.',minPlayers=1,maxPlayers=1,supportsResume=true,supportsRanking=true,supportsDaily=false,rankingOrder='desc',enabled=true,version=1},
    {id='mines',name='MINES',app='play',category='puzzle',description='Clear the field without touching a mine.',minPlayers=1,maxPlayers=1,supportsResume=true,supportsRanking=true,supportsDaily=true,rankingOrder='asc',enabled=true,version=1},
    {id='nonogram',name='NONOGRAM',app='play',category='puzzle',description='Solve picture logic grids from row and column clues.',minPlayers=1,maxPlayers=1,supportsResume=true,supportsRanking=true,supportsDaily=true,rankingOrder='asc',enabled=true,version=1},
    {id='reaction',name='REACTION',app='party',category='quick',description='Everyone waits for the same signal. Fastest valid tap wins.',minPlayers=2,maxPlayers=8,supportsResume=false,supportsRanking=false,supportsDaily=false,rankingOrder='desc',enabled=true,version=1},
    {id='stop_battle',name='STOP! BATTLE',app='party',category='quick',description='Stop closest to the shared target.',minPlayers=2,maxPlayers=8,supportsResume=false,supportsRanking=false,supportsDaily=false,rankingOrder='desc',enabled=true,version=1},
    {id='vote',name='VOTE',app='party',category='social',description='Vote for the player who best fits the prompt.',minPlayers=3,maxPlayers=10,supportsResume=false,supportsRanking=false,supportsDaily=false,rankingOrder='desc',enabled=true,version=1},
    {id='majority',name='MAJORITY',app='party',category='social',description='Pick the answer you think most players will choose.',minPlayers=3,maxPlayers=10,supportsResume=false,supportsRanking=false,supportsDaily=false,rankingOrder='desc',enabled=true,version=1},
    {id='word_wolf',name='WORD WOLF',app='party',category='voice',description='Discuss similar secret topics and find the minority.',minPlayers=3,maxPlayers=10,supportsResume=false,supportsRanking=false,supportsDaily=false,rankingOrder='desc',enabled=true,version=1},
    {id='liar',name='LIAR',app='party',category='voice',description='Find the player assigned to answer with a lie.',minPlayers=3,maxPlayers=10,supportsResume=false,supportsRanking=false,supportsDaily=false,rankingOrder='desc',enabled=true,version=1},
    {id='draw',name='DRAW',app='party',category='creative',description='Draw the prompt and let the room guess.',minPlayers=2,maxPlayers=10,supportsResume=false,supportsRanking=false,supportsDaily=false,rankingOrder='desc',enabled=true,version=1},
    {id='telephone',name='TELEPHONE',app='party',category='creative',description='Alternate text and drawings, then reveal the full chain.',minPlayers=3,maxPlayers=10,supportsResume=false,supportsRanking=false,supportsDaily=false,rankingOrder='desc',enabled=true,version=1}
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
