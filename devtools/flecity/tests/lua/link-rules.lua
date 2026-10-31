-- Pure production rules only. No FiveM/DB/bank callbacks are loaded.
local root=assert(arg[1], 'resource root required')
dofile(root..'/server/core/party_fall.lua')
local checks=0
local function check(name,condition)
    assert(condition,name)
    checks=checks+1
    print('PASS '..name)
end
for name,ok in pairs(FlecityGamesPartyFall.DebugSelftest()) do check('production '..name,ok==true) end
local validate=FlecityGamesPartyFall.Validate
local good={{x=3,rotation=0,hold=false,t=100}}
local one=assert(validate(12345,good,10,18,1000))
local two=assert(validate(12345,good,10,18,1000))
check('deterministic replay',one.score==two.score and one.pieces==two.pieces and one.lines==two.lines)
check('empty replay rejected',validate(12345,{},10,18,1000)==nil)
check('malformed replay rejected',validate(12345,{'bad'},10,18,1000)==nil)
check('negative time rejected',validate(12345,{{x=3,rotation=0,t=-1}},10,18,1000)==nil)
check('future time rejected',validate(12345,{{x=3,rotation=0,t=2000}},10,18,1000)==nil)
check('off-board move rejected',validate(12345,{{x=999,rotation=0,t=100}},10,18,1000)==nil)
check('invalid hold rejected',validate(12345,{{x=3,rotation=0,t=100,hold='invalid'}},10,18,1000)==nil)
local clock=1000
GetGameTimer=function()return clock end
dofile(root..'/server/core/rate_limit.lua')
check('rate first allowed',FlecityGamesRateLimit.Allow(1,'fixture',100))
check('rate duplicate denied',not FlecityGamesRateLimit.Allow(1,'fixture',100))
check('rate other source isolated',FlecityGamesRateLimit.Allow(2,'fixture',100))
clock=1100
check('rate boundary allowed',FlecityGamesRateLimit.Allow(1,'fixture',100))
FlecityGamesRateLimit.Clear(1)
check('rate cleanup',FlecityGamesRateLimit.Allow(1,'fixture',100))
print('LINK Lua pure-rule regressions: '..checks..' PASS (clock mocked; no FiveM integration)')
