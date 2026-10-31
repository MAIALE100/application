local root=assert(arg[1],'WAVE source path required')
dofile(root..'/config/shared.lua')
local events={}
local added,removed=0,0
local collision=true
GetCurrentResourceName=function()return 'wave' end
GetGameTimer=function()return 1 end
GetResourceState=function()return 'started' end
Wait=function()end
CreateThread=function(fn)fn()end
AddEventHandler=function(name,fn)events[name]=fn end
RegisterNUICallback=function()end
exports={['lb-phone']={
 AddCustomApp=function(_,data)
  assert(data.identifier=='flecity_wave')
  added=added+1
  if collision then return false,'APP_ALREADY_EXISTS' end
  return true
 end,
 RemoveCustomApp=function(_,id)
  assert(id=='flecity_wave')
  removed=removed+1
  return true
 end
}}
assert(loadfile(root..'/client/main.lua'))()
assert(added==6 and removed==0,'collision must not delete an unknown app')
events.onResourceStop('wave')
assert(removed==0,'resource stop must not delete an app it does not own')
collision=false
assert(loadfile(root..'/client/main.lua'))()
assert(added==7 and removed==0)
events.onResourceStop('wave')
assert(removed==1,'owned registration should be removed once')
print('PASS WAVE LB Phone identifier collision and owned registration cleanup')
