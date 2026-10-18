local function viewer(source)
 local id=FrameFramework.GetIdentifier(source)
 return {name=FrameFramework.GetCharacterName(source),staff=FramePermissions.IsStaff(id),admin=FramePermissions.IsAdmin(id)}
end
local callbacks={
 ['frame:getEvents']=function(source) local id=FrameFramework.GetIdentifier(source); if not id then return {ok=false,error='PLAYER_NOT_READY',events={}} end; local ok,rows=pcall(FrameEventsRepository.ListPublic,FrameConfig.EventPageSize); return ok and {ok=true,viewer=viewer(source),events=rows} or {ok=false,error='DATABASE_ERROR',events={}} end,
 ['frame:getEvent']=function(source,data) local id=FrameFramework.GetIdentifier(source); if not id then return {ok=false,error='PLAYER_NOT_READY'} end; local e=FrameEventsRepository.GetByPublicId(type(data)=='table' and data.public_id or nil); return e and {ok=true,event=e,is_owner=e.owner_identifier==id,can_manage=FramePermissions.CanManageEvent(id,e)} or {ok=false,error='NOT_FOUND'} end,
 ['frame:getMyEvents']=function(source) local id=FrameFramework.GetIdentifier(source); return id and {ok=true,events=FrameEventsRepository.ListOwned(id)} or {ok=false,error='PLAYER_NOT_READY',events={}} end,
 ['frame:createEvent']=function(source,data) return FrameEventsService.Create(source,data) end,
 ['frame:publishEvent']=function(source,data) local id=FrameFramework.GetIdentifier(source); if not id then return {ok=false,error='PLAYER_NOT_READY'} end; local n=FrameEventsRepository.PublishOwned(type(data)=='table' and data.public_id or '',id); if n>0 then MySQL.insert.await([[INSERT INTO frame_audit_logs(actor_identifier,action,entity_type,entity_id) VALUES(?,'EVENT_PUBLISH','event',?)]],{id,data.public_id}); return {ok=true} end; return {ok=false,error='NOT_OWNER_OR_NOT_DRAFT'} end,
 ['frame:joinEvent']=function(source,data) return FrameSubmissionsService.Join(source,data) end,
 ['frame:submitPhoto']=function(source,data) return FrameSubmissionsService.Submit(source,data) end,
 ['frame:getMySubmissions']=function(source,data) return FrameSubmissionsService.ListMine(source,data) end,
 ['frame:getEventSubmissions']=function(source,data) return FrameManagement.ListSubmissions(source,data) end,
 ['frame:authorizeSave']=function(source,data) return FrameManagement.AuthorizeSave(source,data) end,
 ['frame:addAward']=function(source,data) return FrameManagement.AddAward(source,data) end,
 ['frame:setWinner']=function(source,data) return FrameManagement.SetWinner(source,data) end,
 ['frame:getResults']=function(source,data) return FrameManagement.Results(source,data) end,
 ['frame:getAdProducts']=function(source) return FrameAds.Products(source) end,
 ['frame:createAd']=function(source,data) return FrameAds.Create(source,data) end,
 ['frame:getActiveAds']=function(source) return FrameAds.Active(source) end,
 ['frame:adImpression']=function(source,data) return FrameAds.Stat(source,data,'impression') end,
 ['frame:adClick']=function(source,data) return FrameAds.Stat(source,data,'click') end,
 ['frame:getStaffDashboard']=function(source) return FrameManagement.StaffDashboard(source) end,
 ['frame:reviewAd']=function(source,data) return FrameAds.Review(source,data) end
}
CreateThread(function()
 while GetResourceState('lb-phone')~='started' do Wait(500) end; Wait(500)
 for name,fn in pairs(callbacks) do exports['lb-phone']:RegisterCallback(name,fn,{preventSpam=true,rateLimit=(name=='frame:createEvent' or name=='frame:createAd') and 5 or 30,defaultReturn={ok=false,error='CALLBACK_FAILED'}}) end
 print('[FRAME] server callbacks registered')
end)
CreateThread(function() while true do pcall(FrameEventsRepository.AdvanceLifecycle); pcall(FrameAds.Advance); Wait(60000) end end)
