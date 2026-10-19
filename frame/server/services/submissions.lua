FrameSubmissionsService={}
local function enabled(v) return v == true or tonumber(v) == 1 end
local function pid() local t={} local c='0123456789ABCDEFGHJKMNPQRSTVWXYZ'; for i=1,26 do local n=math.random(1,#c);t[i]=c:sub(n,n) end return table.concat(t) end
local function eventFor(publicId)
 if type(publicId)~='string' or #publicId~=26 then return nil end
 return FrameEventsRepository.GetByPublicId(publicId)
end
local function openForSubmission(e)
 if not e or not enabled(e.submission_enabled) then return false,'SUBMISSIONS_DISABLED' end
 if e.status~='active' then return false,'EVENT_NOT_ACTIVE' end
 if not enabled(e.submission_window_open) then return false,'SUBMISSIONS_CLOSED' end
 return true
end
function FrameSubmissionsService.Join(source,data)
 local identifier=FrameFramework.GetIdentifier(source); local e=eventFor(type(data)=='table' and data.public_id or nil); if not identifier then return {ok=false,error='PLAYER_NOT_READY'} end; if not e then return {ok=false,error='NOT_FOUND'} end
 if e.status~='active' then return {ok=false,error='EVENT_NOT_ACTIVE'} end
 if e.visibility=='private' or e.visibility=='restricted' then return {ok=false,error='ACCESS_RULE_REQUIRED'} end
 return {ok=FrameSubmissionsRepository.Join(e.id,identifier)}
end
function FrameSubmissionsService.Submit(source,data)
 local identifier=FrameFramework.GetIdentifier(source); if not identifier then return {ok=false,error='PLAYER_NOT_READY'} end; data=type(data)=='table' and data or {}; local e=eventFor(data.public_id); local ok,err=openForSubmission(e); if not ok then return {ok=false,error=err} end
 local media=type(data.media_ref)=='string' and data.media_ref or ''; if #media<8 or #media>1024 or not media:match('^https://') then return {ok=false,error='INVALID_MEDIA'} end
 local caption=type(data.caption)=='string' and data.caption:sub(1,2000) or ''
 if e.comment_mode=='required' and caption:gsub('%s+','')=='' then return {ok=false,error='CAPTION_REQUIRED'} end
 if enabled(e.participation_required) then local p=MySQL.scalar.await([[SELECT 1 FROM frame_event_participants WHERE event_id=? AND player_identifier=? AND status='active' LIMIT 1]],{e.id,identifier}); if not p then return {ok=false,error='JOIN_REQUIRED'} end end
 local max=math.min(tonumber(e.max_submissions) or 1,50)
 for slot=1,max do if FrameSubmissionsRepository.InsertAtSlot(e.id,identifier,slot,pid(),caption,media) then MySQL.insert.await([[INSERT INTO frame_audit_logs(actor_identifier,action,entity_type,event_id,metadata) VALUES(?,'SUBMISSION_CREATE','submission',?,?)]],{identifier,e.id,json.encode({slot=slot})}); return {ok=true,slot=slot} end end
 return {ok=false,error='SUBMISSION_LIMIT_REACHED'}
end
function FrameSubmissionsService.ListMine(source,data)
 local identifier=FrameFramework.GetIdentifier(source); local e=eventFor(type(data)=='table' and data.public_id or nil); if not identifier or not e then return {ok=false,error='NOT_FOUND',submissions={}} end; return {ok=true,submissions=FrameSubmissionsRepository.ListMine(e.id,identifier)}
end
