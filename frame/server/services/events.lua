FrameEventsService = {}
local allowedTypes={contest=true,mission=true,collection=true,memorial=true}
local allowedVisibility={public=true,unlisted=true,private=true,restricted=true}
local function cleanText(v,max,required)
  if type(v)~='string' then return required and nil or '' end
  v=v:gsub('^%s+',''):gsub('%s+$',''); if required and v=='' then return nil end
  if #v>max then v=v:sub(1,max) end; return v
end
local function bool(v,default) if type(v)=='boolean' then return v end return default end
local function number(v,min,max,default) v=tonumber(v); if not v then return default end; v=math.floor(v); if v<min then v=min elseif v>max then v=max end; return v end
local function dt(v) if v==nil or v=='' then return nil end if type(v)~='string' or not v:match('^%d%d%d%d%-%d%d%-%d%d[T ]%d%d:%d%d') then return nil end return v:gsub('T',' '):sub(1,19) end
local function publicId() local t={} local chars='0123456789ABCDEFGHJKMNPQRSTVWXYZ'; for i=1,26 do local n=math.random(1,#chars); t[i]=chars:sub(n,n) end return table.concat(t) end
local function accessJobs(v)
  if type(v)~='string' then return {} end
  local out,seen={},{}
  for job in v:gmatch('[^,%s]+') do
    job=job:lower():gsub('[^%w_%-]',''):sub(1,64)
    if job~='' and not seen[job] then seen[job]=true;out[#out+1]=job end
  end
  return out
end
local function saveAccessJobs(eventId,jobs)
  MySQL.update.await([[DELETE FROM frame_event_access_rules WHERE event_id=? AND rule_type='job']],{eventId})
  for _,job in ipairs(jobs or {}) do
    MySQL.insert.await([[INSERT INTO frame_event_access_rules(event_id,rule_type,rule_value) VALUES(?,'job',?)]],{eventId,job})
  end
end
function FrameEventsService.NormalizeCreate(raw)
  raw=type(raw)=='table' and raw or {}; local title=cleanText(raw.title,160,true); local description=cleanText(raw.description,8000,true)
  if not title then return nil,'TITLE_REQUIRED' end; if not description then return nil,'DESCRIPTION_REQUIRED' end
  local typ=allowedTypes[raw.event_type] and raw.event_type or 'collection'; local vis=allowedVisibility[raw.visibility] and raw.visibility or 'public'
  local i={title=title,description=description,event_type=typ,visibility=vis,category=cleanText(raw.category,64,false),cover_media_ref=cleanText(raw.cover_media_ref,512,false)}
  i.access_jobs=accessJobs(raw.allowed_jobs)
  if vis=='restricted' and #i.access_jobs<1 then return nil,'ACCESS_JOB_REQUIRED' end
  for _,k in ipairs({'publish_at','starts_at','submissions_open_at','submissions_close_at','judging_starts_at','results_at','ends_at'}) do i[k]=dt(raw[k]) end
  i.participation_required=bool(raw.participation_required,true); i.submission_enabled=bool(raw.submission_enabled,true); i.judging_enabled=bool(raw.judging_enabled,typ=='contest'); i.ranking_enabled=bool(raw.ranking_enabled,typ=='contest'); i.voting_enabled=bool(raw.voting_enabled,false); i.awards_enabled=bool(raw.awards_enabled,typ=='contest'); i.max_submissions=number(raw.max_submissions,1,50,1); i.allow_submission_edit=bool(raw.allow_submission_edit,false); i.allow_submission_delete=bool(raw.allow_submission_delete,true); i.comment_mode=({none=true,optional=true,required=true})[raw.comment_mode] and raw.comment_mode or 'optional'; i.approval_mode='auto'
  local entryMode=({frame=true,sns=true,hybrid=true})[raw.entry_mode] and raw.entry_mode or 'frame'
  local platforms={}
  if raw.social_birdy==true then platforms[#platforms+1]='birdy' end
  if raw.social_instapic==true then platforms[#platforms+1]='instapic' end
  local hashtag=cleanText(raw.required_hashtag,100,false)
  if hashtag and hashtag~='' then hashtag=hashtag:gsub('^#+','') end
  i.extra_rules=json.encode({entry_mode=entryMode,social_platforms=platforms,required_hashtag=hashtag or '',social_post_required=(entryMode~='frame'),direct_upload_allowed=(entryMode~='sns')})
  if i.starts_at and i.ends_at and i.starts_at>=i.ends_at then return nil,'INVALID_EVENT_WINDOW' end
  if i.submissions_open_at and i.submissions_close_at and i.submissions_open_at>=i.submissions_close_at then return nil,'INVALID_SUBMISSION_WINDOW' end
  return i
end
function FrameEventsService.Create(source,raw)
  local identifier=FrameFramework.GetIdentifier(source); if not identifier then return {ok=false,error='PLAYER_NOT_READY'} end
  local input,err=FrameEventsService.NormalizeCreate(raw); if not input then return {ok=false,error=err} end
  local id=publicId(); local ok=FrameEventsRepository.Create(identifier,FrameFramework.GetCharacterName(source),input,id)
  if not ok then return {ok=false,error='DATABASE_ERROR'} end
  local created=FrameEventsRepository.GetByPublicId(id); if created then saveAccessJobs(created.id,input.access_jobs) end
  MySQL.insert.await([[INSERT INTO frame_audit_logs(actor_identifier,action,entity_type,entity_id,metadata) VALUES(?,'EVENT_CREATE','event',?,?)]],{identifier,id,json.encode({type=input.event_type})})
  return {ok=true,public_id=id}
end


function FrameEventsService.Update(source,raw)
  local identifier=FrameFramework.GetIdentifier(source); if not identifier then return {ok=false,error='PLAYER_NOT_READY'} end
  raw=type(raw)=='table' and raw or {}
  local e=FrameEventsRepository.GetByPublicId(raw.public_id); if not e then return {ok=false,error='NOT_FOUND'} end
  if not FramePermissions.CanManageEvent(identifier,e) then return {ok=false,error='FORBIDDEN'} end
  if e.status~='draft' then return {ok=false,error='EDIT_DRAFT_ONLY'} end
  local input,err=FrameEventsService.NormalizeCreate(raw); if not input then return {ok=false,error=err} end
  local ok=MySQL.transaction.await({
    {query=[[UPDATE frame_events SET title=?,description=?,event_type=?,category=?,cover_media_ref=?,visibility=?,publish_at=?,starts_at=?,submissions_open_at=?,submissions_close_at=?,judging_starts_at=?,results_at=?,ends_at=? WHERE id=?]],values={input.title,input.description,input.event_type,input.category,input.cover_media_ref,input.visibility,input.publish_at,input.starts_at,input.submissions_open_at,input.submissions_close_at,input.judging_starts_at,input.results_at,input.ends_at,e.id}},
    {query=[[UPDATE frame_event_rules SET participation_required=?,submission_enabled=?,judging_enabled=?,ranking_enabled=?,voting_enabled=?,awards_enabled=?,max_submissions=?,allow_submission_edit=?,allow_submission_delete=?,comment_mode=?,approval_mode=?,extra_rules=? WHERE event_id=?]],values={input.participation_required and 1 or 0,input.submission_enabled and 1 or 0,input.judging_enabled and 1 or 0,input.ranking_enabled and 1 or 0,input.voting_enabled and 1 or 0,input.awards_enabled and 1 or 0,input.max_submissions,input.allow_submission_edit and 1 or 0,input.allow_submission_delete and 1 or 0,input.comment_mode,input.approval_mode,input.extra_rules,e.id}}
  })
  if not ok then return {ok=false,error='DATABASE_ERROR'} end
  saveAccessJobs(e.id,input.access_jobs)
  MySQL.insert.await([[INSERT INTO frame_audit_logs(actor_identifier,action,entity_type,entity_id,event_id) VALUES(?,'EVENT_EDIT','event',?,?)]],{identifier,e.public_id,e.id})
  return {ok=true}
end

function FrameEventsService.Cancel(source,raw)
  local identifier=FrameFramework.GetIdentifier(source); if not identifier then return {ok=false,error='PLAYER_NOT_READY'} end
  raw=type(raw)=='table' and raw or {}
  local e=FrameEventsRepository.GetByPublicId(raw.public_id); if not e then return {ok=false,error='NOT_FOUND'} end
  if not FramePermissions.CanManageEvent(identifier,e) then return {ok=false,error='FORBIDDEN'} end
  if e.status=='results' or e.status=='ended' or e.status=='cancelled' then return {ok=false,error='EVENT_ALREADY_CLOSED'} end
  local n=MySQL.update.await([[UPDATE frame_events SET status='cancelled',ends_at=COALESCE(ends_at,UTC_TIMESTAMP()) WHERE id=? AND status IN ('draft','scheduled','active','judging')]],{e.id}) or 0
  if n<1 then return {ok=false,error='STATE_CHANGED'} end
  MySQL.insert.await([[INSERT INTO frame_audit_logs(actor_identifier,action,entity_type,entity_id,event_id) VALUES(?,'EVENT_CANCEL','event',?,?)]],{identifier,e.public_id,e.id})
  return {ok=true}
end


function FrameEventsService.Duplicate(source,raw)
  local identifier=FrameFramework.GetIdentifier(source); if not identifier then return {ok=false,error='PLAYER_NOT_READY'} end
  raw=type(raw)=='table' and raw or {}
  local e=FrameEventsRepository.GetByPublicId(raw.public_id); if not e then return {ok=false,error='NOT_FOUND'} end
  if not FramePermissions.CanManageEvent(identifier,e) then return {ok=false,error='FORBIDDEN'} end
  local newId=publicId()
  local title=('コピー - '..tostring(e.title or 'イベント')):sub(1,160)
  local ok=MySQL.transaction.await({
    {query=[[INSERT INTO frame_events(public_id,owner_identifier,organizer_name,organizer_type,title,description,event_type,category,cover_media_ref,visibility,status) VALUES(?,?,?,?,?,?,?,?,?,?,'draft')]],values={newId,identifier,FrameFramework.GetCharacterName(source),e.organizer_type or 'individual',title,e.description or '',e.event_type,e.category,e.cover_media_ref,e.visibility or 'public'}},
    {query=[[INSERT INTO frame_event_rules(event_id,participation_required,submission_enabled,judging_enabled,ranking_enabled,voting_enabled,awards_enabled,max_submissions,allow_submission_edit,allow_submission_delete,comment_mode,approval_mode,extra_rules)
      SELECT LAST_INSERT_ID(),participation_required,submission_enabled,judging_enabled,ranking_enabled,voting_enabled,awards_enabled,max_submissions,allow_submission_edit,allow_submission_delete,comment_mode,approval_mode,extra_rules FROM frame_event_rules WHERE event_id=?]],values={e.id}}
  })
  if not ok then return {ok=false,error='DATABASE_ERROR'} end
  MySQL.insert.await([[INSERT INTO frame_audit_logs(actor_identifier,action,entity_type,entity_id,metadata) VALUES(?,'EVENT_DUPLICATE','event',?,?)]],{identifier,newId,json.encode({source=e.public_id})})
  return {ok=true,public_id=newId}
end


function FrameEventsService.Delete(source,raw)
  local identifier=FrameFramework.GetIdentifier(source); if not identifier then return {ok=false,error='PLAYER_NOT_READY'} end
  raw=type(raw)=='table' and raw or {}
  local e=FrameEventsRepository.GetByPublicId(raw.public_id); if not e then return {ok=false,error='NOT_FOUND'} end
  local isOwner=e.owner_identifier==identifier
  local isAdmin=FramePermissions.IsAdmin(identifier)
  if not isOwner and not isAdmin then return {ok=false,error='FORBIDDEN'} end
  local allowed={draft=true,cancelled=true,results=true,ended=true}
  if not allowed[e.status] then return {ok=false,error='DELETE_REQUIRES_CLOSED'} end

  local metadata=json.encode({title=e.title,status=e.status})
  MySQL.insert.await([[INSERT INTO frame_audit_logs(actor_identifier,action,entity_type,entity_id,event_id,metadata) VALUES(?,'EVENT_DELETE','event',?,?,?)]],{identifier,e.public_id,e.id,metadata})

  MySQL.update.await([[UPDATE frame_ads SET status='ended',link_type='none',link_value=NULL WHERE event_id=? AND status IN ('pending_review','scheduled','active')]],{e.id})
  local n=MySQL.update.await([[DELETE FROM frame_events WHERE id=?]],{e.id}) or 0
  if n<1 then return {ok=false,error='STATE_CHANGED'} end
  return {ok=true}
end
