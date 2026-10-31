-- Executes staged bridge Lua with mocked natives; never executes engine commands.
local policy,server=assert(arg[1]),assert(arg[2])
for _,count in ipairs({0,1,4}) do
 dofile(policy)
 local token=string.rep('a',64)
 local config={token=token,allowed={observe_status=true},observedResources={flecity_base=true,oxmysql=true}}
 local request={id='fixture-status-'..count,operation='observe_status',token=token,expiresAt=1005}
 local response,thread,waits=nil,nil,0
 os.time=function()return 1000 end
 GetCurrentResourceName=function()return 'flecity_validation_bridge' end
 GetGameTimer=function()return 123 end
 GetNumPlayerIndices=function()return count end
 GetResourceState=function(name)assert(name=='flecity_base' or name=='oxmysql');return 'started' end
 ExecuteCommand=function()error('Engine command forbidden')end
 LoadResourceFile=function(_,file)return file=='private.json' and 'config' or 'request' end
 json={decode=function(raw)return raw=='config' and config or request end,encode=function(value)return value end}
 SaveResourceFile=function(_,file,value)assert(file=='response.json');response=value end
 CreateThread=function(fn)thread=fn end
 Wait=function()waits=waits+1;if waits>1 then error('FIXTURE_STOP')end end
 dofile(server)
 local ok,err=pcall(thread)assert(not ok and tostring(err):find('FIXTURE_STOP'))
 assert(response.status=='OBSERVED' and response.players==count and response.requestId==request.id)
 assert(response.resources.flecity_base=='started' and response.kind=='flecity-native-observation-v1')
 assert(response.token==nil and response.identifiers==nil)
 config.allowed.observe_status=false
 local operation=FlecityAutotestPolicy.Check(request,config,{now=1000,players=count})assert(operation==nil)
end
print('PASS: native counts 0/1/4; fixed resource states; no player identities, DB calls, commands, or lifecycle operations')
