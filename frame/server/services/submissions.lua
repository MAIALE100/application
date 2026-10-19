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
 local rules={}
 if type(e.extra_rules)=='table' then rules=e.extra_rules elseif type(e.extra_rules)=='string' and e.extra_rules~='' then local ok,r=pcall(json.decode,e.extra_rules); if ok and type(r)=='table' then rules=r end end
 if rules.direct_upload_allowed==false then return {ok=false,error='DIRECT_UPLOAD_DISABLED'} end
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


function FrameSubmissionsService.DeleteMine(source,data)
 local identifier=FrameFramework.GetIdentifier(source); if not identifier then return {ok=false,error='PLAYER_NOT_READY'} end
 data=type(data)=='table' and data or {}; local e=eventFor(data.public_id); if not e then return {ok=false,error='NOT_FOUND'} end
 if not enabled(e.allow_submission_delete) then return {ok=false,error='DELETE_DISABLED'} end
 if e.status~='active' then return {ok=false,error='DELETE_CLOSED'} end
 local sid=type(data.submission_id)=='string' and data.submission_id or ''
 local row=MySQL.single.await([[SELECT id FROM frame_submissions WHERE event_id=? AND player_identifier=? AND public_id=? AND status='submitted' LIMIT 1]],{e.id,identifier,sid})
 if not row then return {ok=false,error='NOT_FOUND'} end
 local n=MySQL.update.await([[DELETE FROM frame_submissions WHERE id=?]],{row.id}) or 0
 if n<1 then return {ok=false,error='STATE_CHANGED'} end
 MySQL.insert.await([[INSERT INTO frame_audit_logs(actor_identifier,action,entity_type,entity_id,event_id) VALUES(?,'SUBMISSION_DELETE','submission',?,?)]],{identifier,sid,e.id})
 return {ok=true}
end


local function decodedRules(e)
 local rules={}
 if type(e.extra_rules)=='table' then return e.extra_rules end
 if type(e.extra_rules)=='string' and e.extra_rules~='' then local ok,r=pcall(json.decode,e.extra_rules); if ok and type(r)=='table' then rules=r end end
 return rules
end

local function platformAllowed(rules,platform)
 for _,p in ipairs(type(rules.social_platforms)=='table' and rules.social_platforms or {}) do if p==platform then return true end end
 return false
end

local function socialUsername(source,platform)
 local player=Player(source); local phone=player and player.state and player.state.phoneNumber
 if not phone or phone=='' then return nil,'PHONE_NUMBER_UNAVAILABLE' end
 local ok,user=pcall(function() return exports['lb-phone']:GetSocialMediaUsername(tostring(phone),platform) end)
 if not ok or not user or user==false or user=='' then return nil,'SOCIAL_ACCOUNT_REQUIRED' end
 return user
end

function FrameSubmissionsService.SubmitSocial(source,data)
 local identifier=FrameFramework.GetIdentifier(source); if not identifier then return {ok=false,error='PLAYER_NOT_READY'} end
 data=type(data)=='table' and data or {}; local e=eventFor(data.public_id); local ok,err=openForSubmission(e); if not ok then return {ok=false,error=err} end
 local rules=decodedRules(e); local mode=rules.entry_mode or 'frame'; if mode=='frame' then return {ok=false,error='SOCIAL_ENTRY_DISABLED'} end
 local platform=data.platform=='birdy' and 'birdy' or (data.platform=='instapic' and 'instapic' or nil); if not platform or not platformAllowed(rules,platform) then return {ok=false,error='SOCIAL_PLATFORM_NOT_ALLOWED'} end
 local media=type(data.media_ref)=='string' and data.media_ref or ''; if #media<8 or #media>1024 or not media:match('^https://') then return {ok=false,error='INVALID_MEDIA'} end
 if enabled(e.participation_required) then local p=MySQL.scalar.await([[SELECT 1 FROM frame_event_participants WHERE event_id=? AND player_identifier=? AND status='active' LIMIT 1]],{e.id,identifier}); if not p then return {ok=false,error='JOIN_REQUIRED'} end end
 local username,uerr=socialUsername(source,platform); if not username then return {ok=false,error=uerr} end
 local hashtag=type(rules.required_hashtag)=='string' and rules.required_hashtag:gsub('^#+','') or ''
 local caption=type(data.caption)=='string' and data.caption:sub(1,1200) or ''
 local postOk,postId=false,nil
 if platform=='birdy' then
   local content=caption
   if hashtag~='' then content=(content~='' and (content..' ') or '')..'#'..hashtag end
   local callOk,a,b=pcall(function() return exports['lb-phone']:PostBirdy(username,content,{media},nil,hashtag~='' and {hashtag} or {},source) end)
   postOk=callOk and a==true; postId=b
 else
   local content=caption
   if hashtag~='' then content=(content~='' and (content..' ') or '')..'#'..hashtag end
   local callOk,a,b=pcall(function() return exports['lb-phone']:PostInstaPic(username,{media},content,nil) end)
   postOk=callOk and a==true; postId=b
 end
 if not postOk then return {ok=false,error='SOCIAL_POST_FAILED'} end
 local max=math.min(tonumber(e.max_submissions) or 1,50)
 for slot=1,max do
   local submissionId=pid()
   if FrameSubmissionsRepository.InsertAtSlot(e.id,identifier,slot,submissionId,caption,media) then
     MySQL.insert.await([[INSERT INTO frame_audit_logs(actor_identifier,action,entity_type,entity_id,event_id,metadata) VALUES(?,'SOCIAL_SUBMISSION_CREATE','submission',?,?,?)]],{identifier,submissionId,e.id,json.encode({slot=slot,platform=platform,post_id=postId,username=username,hashtag=hashtag})})
     return {ok=true,slot=slot,platform=platform,post_id=postId}
   end
 end
 return {ok=false,error='SUBMISSION_LIMIT_REACHED'}
end
