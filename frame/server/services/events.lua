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
function FrameEventsService.NormalizeCreate(raw)
  raw=type(raw)=='table' and raw or {}; local title=cleanText(raw.title,160,true); local description=cleanText(raw.description,8000,true)
  if not title then return nil,'TITLE_REQUIRED' end; if not description then return nil,'DESCRIPTION_REQUIRED' end
  local typ=allowedTypes[raw.event_type] and raw.event_type or 'collection'; local vis=allowedVisibility[raw.visibility] and raw.visibility or 'public'
  local i={title=title,description=description,event_type=typ,visibility=vis,category=cleanText(raw.category,64,false),cover_media_ref=cleanText(raw.cover_media_ref,512,false)}
  for _,k in ipairs({'publish_at','starts_at','submissions_open_at','submissions_close_at','judging_starts_at','results_at','ends_at'}) do i[k]=dt(raw[k]) end
  i.participation_required=bool(raw.participation_required,true); i.submission_enabled=bool(raw.submission_enabled,true); i.judging_enabled=bool(raw.judging_enabled,typ=='contest'); i.ranking_enabled=bool(raw.ranking_enabled,typ=='contest'); i.voting_enabled=bool(raw.voting_enabled,false); i.awards_enabled=bool(raw.awards_enabled,typ=='contest'); i.max_submissions=number(raw.max_submissions,1,50,1); i.allow_submission_edit=bool(raw.allow_submission_edit,false); i.allow_submission_delete=bool(raw.allow_submission_delete,true); i.comment_mode=({none=true,optional=true,required=true})[raw.comment_mode] and raw.comment_mode or 'optional'; i.approval_mode='auto'
  if i.starts_at and i.ends_at and i.starts_at>=i.ends_at then return nil,'INVALID_EVENT_WINDOW' end
  if i.submissions_open_at and i.submissions_close_at and i.submissions_open_at>=i.submissions_close_at then return nil,'INVALID_SUBMISSION_WINDOW' end
  return i
end
function FrameEventsService.Create(source,raw)
  local identifier=FrameFramework.GetIdentifier(source); if not identifier then return {ok=false,error='PLAYER_NOT_READY'} end
  local input,err=FrameEventsService.NormalizeCreate(raw); if not input then return {ok=false,error=err} end
  local id=publicId(); local ok=FrameEventsRepository.Create(identifier,FrameFramework.GetCharacterName(source),input,id)
  if not ok then return {ok=false,error='DATABASE_ERROR'} end
  MySQL.insert.await([[INSERT INTO frame_audit_logs(actor_identifier,action,entity_type,entity_id,metadata) VALUES(?,'EVENT_CREATE','event',?,?)]],{identifier,id,json.encode({type=input.event_type})})
  return {ok=true,public_id=id}
end
