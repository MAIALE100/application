local resource = GetCurrentResourceName()
local version = GetResourceMetadata(resource, 'version', 0) or 'unknown'
local catalog = json.decode(LoadResourceFile(resource, 'web/catalog.json'))
assert(type(catalog) == 'table' and type(catalog.instruments) == 'table', 'JAM catalog missing')
local instruments = {}
for _,spec in ipairs(catalog.instruments) do
    if spec.kind == 'drums' then
        spec.drumNotes = {}
        for _,n in ipairs(spec.samples) do spec.drumNotes[n.midi] = true end
    end
    instruments[spec.id] = spec
end
local function location(src)
    local ped = GetPlayerPed(src)
    if ped == 0 or not DoesEntityExist(ped) then return nil end
    local p = GetEntityCoords(ped)
    local state = Player(src).state
    return {x=p.x,y=p.y,z=p.z,bucket=GetPlayerRoutingBucket(src),
        alive=GetEntityHealth(ped)>0 and not state.isDead and not state.inLaststand}
end
local engine = JamEngine.new(JamConfig, instruments, {
    epoch = tostring(os.time())..'-'..tostring(GetGameTimer()), now = GetGameTimer, position = location,
    access = JamHasAccess,
    players = function() local out={}; for _,p in ipairs(GetPlayers()) do out[#out+1]=tonumber(p) end; return out end,
    send = function(target, event, data) TriggerClientEvent('flecity_jam:'..event,target,data) end
})
RegisterNetEvent('flecity_jam:start',function(instrument,request,range)
    local src = source
    local ok,reason = engine:start(src,instrument,request,range)
    if not ok and reason ~= 'rate' then TriggerClientEvent('flecity_jam:control',src,{kind='denied',reason=reason,request=request}) end
end)
RegisterNetEvent('flecity_jam:input',function(packet) engine:receive(source,packet) end)
RegisterNetEvent('flecity_jam:stop',function(session)
    local src = source
    local s = engine.sessions[src]
    if s and s.id == session then engine:stop(src,'ended') end
end)
AddEventHandler('playerDropped',function() engine:drop(source) end)
-- Newer artifacts report bucket changes immediately; the timer remains the compatibility fallback.
AddEventHandler('onPlayerBucketChange',function() engine:tick() end)
CreateThread(function() while true do Wait(JamConfig.TickMs); engine:tick() end end)
AddEventHandler('onResourceStop',function(name)
    if name ~= GetCurrentResourceName() then return end
    for src in pairs(engine.sessions) do engine:stop(src,'resource_stop') end
end)
RegisterCommand('jam_status',function(src)
    if src ~= 0 then return end
    local n=0; for _ in pairs(engine.sessions) do n=n+1 end
    print(('[JAM] v%s sessions=%d range=%.1fm access=%s'):format(version,n,JamConfig.Range,JamConfig.Access))
end,true)
print(('[JAM] v%s ready; live multiplayer acceptance NOT_RUN'):format(version))
