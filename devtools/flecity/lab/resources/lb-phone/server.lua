-- Only callback transport is substituted. BASE/LINK handlers run unchanged.
local callbacks,owners={},{}
exports('RegisterCallback',function(name,callback)callbacks[name]=callback owners[name]=GetInvokingResource() end)
AddEventHandler('onResourceStop',function(resource)
    for name,owner in pairs(owners) do if owner==resource then callbacks[name]=nil owners[name]=nil end end
end)
exports('ValidationCall',function(name,source,data)
    if not callbacks[name] then return {ok=false,error='LAB_CALLBACK_NOT_REGISTERED'} end
    return callbacks[name](source,data or {})
end)
exports('ValidationReady',function(name)return callbacks[name]~=nil end)
exports('SendCustomAppMessage',function()return true end)
