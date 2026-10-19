local function loadFrameServerModule(path,label)
  local source=LoadResourceFile(GetCurrentResourceName(),path)
  if not source then
    print(('[FRAME] failed to load %s: file not found (%s)'):format(label,path))
    return false
  end

  local chunk,compileError=load(source,'@'..path,'t',_ENV)
  if not chunk then
    print(('[FRAME] failed to compile %s: %s'):format(label,tostring(compileError)))
    return false
  end

  local ok,runtimeError=pcall(chunk)
  if not ok then
    print(('[FRAME] failed to start %s: %s'):format(label,tostring(runtimeError)))
    return false
  end

  print(('[FRAME] loaded %s'):format(label))
  return true
end

local notificationsReady=loadFrameServerModule('server/services/notifications.lua','notifications')
local selftestReady=loadFrameServerModule('server/services/selftest.lua','selftest')

local function viewer(source)
 local id=FrameFramework.GetIdentifier(source)
 return {name=FrameFramework.GetCharacterName(source),staff=FramePermissions.IsStaff(id),admin=FramePermissions.IsAdmin(id)}
end
local callbacks={
 ['frame:getEvents']=function(source)
  local id=FrameFramework.GetIdentifier(source); if not id then return {ok=false,error='PLAYER_NOT_READY',events={},invited={}} end
  local ok,rows=pcall(FrameEventsRepository.ListPublic,FrameConfig.EventPageSize); if not ok then return {ok=false,error='DATABASE_ERROR',events={},invited={}} end
  local invited=FrameEventsRepository.ListInvited(id,FrameConfig.EventPageSize)
  local job=FrameFramework.GetJob(source)
  local restricted=FrameEventsRepository.ListRestrictedForJob(job and job.name or nil,FrameConfig.EventPageSize)
  for _,e in ipairs(restricted) do rows[#rows+1]=e end
  local favRows=MySQL.query.await([[SELECT e.public_id FROM frame_event_favorites f JOIN frame_events e ON e.id=f.event_id WHERE f.player_identifier=?]],{id}) or {}
  local favoriteIds={}
  for _,f in ipairs(favRows) do favoriteIds[#favoriteIds+1]=f.public_id end
  return {ok=true,viewer=viewer(source),events=rows,invited=invited,favorite_ids=favoriteIds}
 end,
 ['frame:getEvent']=function(source,data)
  local id=FrameFramework.GetIdentifier(source); if not id then return {ok=false,error='PLAYER_NOT_READY'} end
  local e=FrameEventsRepository.GetByPublicId(type(data)=='table' and data.public_id or nil); if not e then return {ok=false,error='NOT_FOUND'} end
  if not FramePermissions.CanViewEvent(id,e,source) then return {ok=false,error='FORBIDDEN'} end
  local accessJobs=MySQL.query.await([[SELECT rule_value FROM frame_event_access_rules WHERE event_id=? AND rule_type='job' ORDER BY rule_value]],{e.id}) or {}
  local joined=MySQL.scalar.await([[SELECT 1 FROM frame_event_participants WHERE event_id=? AND player_identifier=? AND status='active' LIMIT 1]],{e.id,id}) ~= nil
  local ownCount=tonumber(MySQL.scalar.await([[SELECT COUNT(*) FROM frame_submissions WHERE event_id=? AND player_identifier=? AND status='submitted']],{e.id,id}) or 0)
  local participantCount=tonumber(MySQL.scalar.await([[SELECT COUNT(*) FROM frame_event_participants WHERE event_id=? AND status='active']],{e.id}) or 0)
  local submissionCount=tonumber(MySQL.scalar.await([[SELECT COUNT(*) FROM frame_submissions WHERE event_id=? AND status='submitted']],{e.id}) or 0)
  local favoriteCount=tonumber(MySQL.scalar.await([[SELECT COUNT(*) FROM frame_event_favorites WHERE event_id=?]],{e.id}) or 0)
  local favorited=MySQL.scalar.await([[SELECT 1 FROM frame_event_favorites WHERE event_id=? AND player_identifier=? LIMIT 1]],{e.id,id}) ~= nil
  return {ok=true,event=e,is_owner=e.owner_identifier==id,can_manage=FramePermissions.CanManageEvent(id,e),joined=joined,own_submission_count=ownCount,participant_count=participantCount,submission_count=submissionCount,favorite_count=favoriteCount,favorited=favorited,access_jobs=accessJobs}
 end,
 ['frame:getMyEvents']=function(source) local id=FrameFramework.GetIdentifier(source); return id and {ok=true,events=FrameEventsRepository.ListOwned(id)} or {ok=false,error='PLAYER_NOT_READY',events={}} end,
 ['frame:createEvent']=function(source,data) return FrameEventsService.Create(source,data) end,
 ['frame:duplicateEvent']=function(source,data) return FrameEventsService.Duplicate(source,data) end,
 ['frame:updateEvent']=function(source,data) return FrameEventsService.Update(source,data) end,
 ['frame:cancelEvent']=function(source,data) return FrameEventsService.Cancel(source,data) end,
 ['frame:deleteEvent']=function(source,data) return FrameEventsService.Delete(source,data) end,
 ['frame:publishEvent']=function(source,data) local id=FrameFramework.GetIdentifier(source); if not id then return {ok=false,error='PLAYER_NOT_READY'} end; local n=FrameEventsRepository.PublishOwned(type(data)=='table' and data.public_id or '',id); if n>0 then MySQL.insert.await([[INSERT INTO frame_audit_logs(actor_identifier,action,entity_type,entity_id) VALUES(?,'EVENT_PUBLISH','event',?)]],{id,data.public_id}); return {ok=true} end; return {ok=false,error='NOT_OWNER_OR_NOT_DRAFT'} end,
 ['frame:joinEvent']=function(source,data) return FrameSubmissionsService.Join(source,data) end,
 ['frame:submitPhoto']=function(source,data) return FrameSubmissionsService.Submit(source,data) end,
 ['frame:submitSocialPhoto']=function(source,data) return FrameSubmissionsService.SubmitSocial(source,data) end,
 ['frame:getMySubmissions']=function(source,data) return FrameSubmissionsService.ListMine(source,data) end,
 ['frame:deleteMySubmission']=function(source,data) return FrameSubmissionsService.DeleteMine(source,data) end,
 ['frame:getEventSubmissions']=function(source,data) return FrameManagement.ListSubmissions(source,data) end,
 ['frame:deleteSubmission']=function(source,data) return FrameManagement.DeleteSubmission(source,data) end,
 ['frame:invitePhone']=function(source,data) return FrameManagement.InviteByPhone(source,data) end,
 ['frame:getEventAwards']=function(source,data) return FrameManagement.ListAwards(source,data) end,
 ['frame:getSponsors']=function(source,data) return FrameManagement.ListSponsors(source,data) end,
 ['frame:addSponsor']=function(source,data) return FrameManagement.AddSponsor(source,data) end,
 ['frame:deleteSponsor']=function(source,data) return FrameManagement.DeleteSponsor(source,data) end,
 ['frame:beginJudging']=function(source,data) return FrameManagement.BeginJudging(source,data) end,
 ['frame:publishResults']=function(source,data) return FrameManagement.PublishResults(source,data) end,
 ['frame:authorizeSave']=function(source,data) return FrameManagement.AuthorizeSave(source,data) end,
 ['frame:addAward']=function(source,data) return FrameManagement.AddAward(source,data) end,
 ['frame:setWinner']=function(source,data) return FrameManagement.SetWinner(source,data) end,
 ['frame:getResults']=function(source,data) return FrameManagement.Results(source,data) end,
 ['frame:getAdProducts']=function(source) return FrameAds.Products(source) end,
 ['frame:createAd']=function(source,data) return FrameAds.Create(source,data) end,
 ['frame:getActiveAds']=function(source) return FrameAds.Active(source) end,
 ['frame:adImpression']=function(source,data) return FrameAds.Stat(source,data,'impression') end,
 ['frame:adClick']=function(source,data) return FrameAds.Stat(source,data,'click') end,
 ['frame:toggleFavorite']=function(source,data) return FrameManagement.ToggleFavorite(source,data) end,
 ['frame:getVoteCandidates']=function(source,data) return FrameManagement.VoteCandidates(source,data) end,
 ['frame:castVote']=function(source,data) return FrameManagement.CastVote(source,data) end,
 ['frame:applyPublicVoteAward']=function(source,data) return FrameManagement.ApplyPublicVoteAward(source,data) end,
 ['frame:getEventAnalytics']=function(source,data) return FrameManagement.EventAnalytics(source,data) end,
 ['frame:getStaffDashboard']=function(source) return FrameManagement.StaffDashboard(source) end,
 ['frame:reviewAd']=function(source,data) return FrameAds.Review(source,data) end
}
CreateThread(function()
 pcall(function() MySQL.query.await([[ALTER TABLE frame_awards ADD COLUMN IF NOT EXISTS sponsor_id BIGINT UNSIGNED NULL AFTER sort_order]]) end)
 pcall(function() MySQL.query.await([[ALTER TABLE frame_votes ADD UNIQUE INDEX IF NOT EXISTS uq_vote_event_voter (event_id,voter_identifier)]]) end)
 pcall(function() MySQL.query.await([[CREATE TABLE IF NOT EXISTS frame_notification_deliveries (
   id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
   event_id BIGINT UNSIGNED NOT NULL,
   player_identifier VARCHAR(128) NOT NULL,
   notification_type VARCHAR(48) NOT NULL,
   status VARCHAR(16) NOT NULL DEFAULT 'pending',
   phone_number VARCHAR(32) NULL,
   notification_id BIGINT NULL,
   attempted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
   delivered_at DATETIME NULL,
   UNIQUE KEY uq_frame_notification (event_id,player_identifier,notification_type),
   INDEX idx_frame_notification_status (status,attempted_at),
   CONSTRAINT fk_frame_notification_event FOREIGN KEY (event_id) REFERENCES frame_events(id) ON DELETE CASCADE
 )]]) end)
 pcall(function() MySQL.query.await([[CREATE TABLE IF NOT EXISTS frame_event_favorites (
   event_id BIGINT UNSIGNED NOT NULL,
   player_identifier VARCHAR(128) NOT NULL,
   created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
   PRIMARY KEY (event_id, player_identifier),
   INDEX idx_favorite_player (player_identifier, created_at),
   CONSTRAINT fk_favorite_event FOREIGN KEY (event_id) REFERENCES frame_events(id) ON DELETE CASCADE
 )]]) end)
 while GetResourceState('lb-phone')~='started' do Wait(500) end; Wait(500)
 for name,fn in pairs(callbacks) do exports['lb-phone']:RegisterCallback(name,fn,{preventSpam=true,rateLimit=(name=='frame:createEvent' or name=='frame:createAd') and 5 or 30,defaultReturn={ok=false,error='CALLBACK_FAILED'}}) end
 print('[FRAME] server callbacks registered')
 print(('[FRAME] notifications ready: %s'):format(tostring(notificationsReady)))
 print(('[FRAME] selftest ready: %s'):format(tostring(selftestReady)))
end)
CreateThread(function()
 while true do
  pcall(FrameEventsRepository.AdvanceLifecycle)
  pcall(FrameAds.Advance)
  if notificationsReady and FrameNotifications and type(FrameNotifications.Scan)=='function' then
   local ok,err=pcall(FrameNotifications.Scan)
   if not ok then print('[FRAME] notification scan failed: '..tostring(err)) end
  end
  Wait(60000)
 end
end)
