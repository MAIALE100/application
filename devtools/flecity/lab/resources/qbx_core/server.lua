-- Deterministic identity boundary; never load original QBox, inventory or bank.
local actors={}
exports('SetActors',function(prefix)
    actors={}
    for source=1001,1004 do
        actors[source]={PlayerData={source=source,citizenid=prefix..'_'..source,
            charinfo={firstname='Fixture',lastname=tostring(source)},job={name='unemployed',isboss=false,grade={level=0}}}}
    end
end)
exports('GetPlayer',function(source)return actors[tonumber(source)] end)
exports('GetPlayersData',function()
    local result={} for id,player in pairs(actors) do result[id]=player.PlayerData end return result
end)
exports('GetCoreVersion',function()return 'validation-double' end)
