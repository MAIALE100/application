dofile(assert(arg[1]))
local token=string.rep('a',64)
local config={token=token,allowed={base_selftest=true,link_selftest=true}}
local function req()return {id='fixture-01',token=token,operation='base_selftest',expiresAt=1005} end
local function ctx()return {now=1000,players=0,resourceState='started',replayed=false}end
local P=FlecityAutotestPolicy
assert(P.Check(req(),config,ctx()).command=='base_selftest')
local r=req()r.operation='link_selftest'assert(P.Check(r,config,ctx()).command=='game_selftest')
for _,operation in ipairs({'quit','restart','restart_base','game_preflight','sv_licenseKey','link_selftest;quit'}) do
    local r=req()r.operation=operation assert(P.Check(r,config,ctx())==nil)
end
local c=ctx()c.players=1 assert(P.Check(req(),config,c)==nil)
c=ctx()c.players=nil assert(P.Check(req(),config,c)==nil)
c=ctx()c.replayed=true assert(P.Check(req(),config,c)==nil)
c=ctx()c.resourceState='stopped' assert(P.Check(req(),config,c)==nil)
r=req()r.expiresAt=999 assert(P.Check(r,config,ctx())==nil)
r=req()r.expiresAt=1011 assert(P.Check(r,config,ctx())==nil)
r=req()r.token='wrong' assert(P.Check(r,config,ctx())==nil)
r=req()r.id='id\nquit' assert(P.Check(r,config,ctx())==nil)
print('Bridge policy regressions: PASS (no native commands executed)')
