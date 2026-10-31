FlecityAutotestPolicy={}
local P=FlecityAutotestPolicy
P.operations={
    observe_status={readonly=true},
    base_selftest={resource='flecity_base',command='base_selftest'},
    link_selftest={resource='flecity_games',command='game_selftest'}
}
function P.Check(request,config,context)
    if type(request)~='table' or type(config)~='table' then return nil,'INVALID_REQUEST' end
    if type(config.token)~='string' or #config.token<48 or request.token~=config.token then return nil,'UNAUTHORIZED' end
    if type(request.id)~='string' or #request.id>64 or not request.id:match('^[%w%-]+$') then return nil,'INVALID_ID' end
    local operation=P.operations[request.operation]
    if not operation or not config.allowed or config.allowed[request.operation]~=true then return nil,'OPERATION_DENIED' end
    if type(request.expiresAt)~='number' or request.expiresAt~=request.expiresAt or request.expiresAt<context.now or request.expiresAt>context.now+10 then return nil,'EXPIRED' end
    if context.replayed then return nil,'REPLAYED' end
    if operation.readonly then
        if type(context.players)~='number' or context.players<0 or context.players%1~=0 then return nil,'COUNT_UNKNOWN' end
        return operation
    end
    if type(context.players)~='number' or context.players~=0 then return nil,'TESTER_CONNECTED' end
    if context.resourceState~='started' then return nil,'RESOURCE_NOT_STARTED' end
    return operation
end
