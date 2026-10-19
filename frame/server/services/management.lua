FrameManagement={}
local function ident(src) return FrameFramework.GetIdentifier(src) end
local function event(data) return FrameEventsRepository.GetByPublicId(type(data)=='table' and data.public_id or '') end
function FrameManagement.ListSubmissions(src,data)
 local id=ident(src); local e=event(data); if not id or not FramePermissions.CanManageEvent(id,e) then return {ok=false,error='FORBIDDEN'} end
 local rows=MySQL.query.await([[SELECT s.public_id,s.player_identifier,s.caption,s.status,s.submitted_at,m.media_ref FROM frame_submissions s JOIN frame_submission_media m ON m.submission_id=s.id WHERE s.event_id=? ORDER BY s.submitted_at DESC]],{e.id}) or {}
 return {ok=true,submissions=rows}
end
function FrameManagement.AuthorizeSave(src,data)
 local id=ident(src); local e=event(data); if not id or not FramePermissions.CanManageEvent(id,e) then return {ok=false,error='FORBIDDEN'} end
 local row=MySQL.single.await([[SELECT s.public_id,m.media_ref FROM frame_submissions s JOIN frame_submission_media m ON m.submission_id=s.id WHERE s.event_id=? AND s.public_id=? LIMIT 1]],{e.id,type(data)=='table' and data.submission_id or ''})
 if not row then return {ok=false,error='NOT_FOUND'} end
 MySQL.insert.await([[INSERT INTO frame_audit_logs(actor_identifier,action,entity_type,entity_id,event_id) VALUES(?,'SUBMISSION_DOWNLOAD','submission',?,?)]],{id,row.public_id,e.id})
 return {ok=true,media_ref=row.media_ref}
end
function FrameManagement.AddAward(src,data)
 local id=ident(src); local e=event(data); if not id or not FramePermissions.CanManageEvent(id,e) then return {ok=false,error='FORBIDDEN'} end
 if e.status=='results' or e.status=='ended' or e.status=='cancelled' then return {ok=false,error='RESULTS_LOCKED'} end
 local name=type(data.name)=='string' and data.name:sub(1,100) or ''; if name=='' then return {ok=false,error='NAME_REQUIRED'} end
 local sponsorId=tonumber(data.sponsor_id)
 if sponsorId then
   local sponsor=MySQL.scalar.await([[SELECT 1 FROM frame_sponsors WHERE id=? AND event_id=? LIMIT 1]],{sponsorId,e.id})
   if not sponsor then return {ok=false,error='INVALID_SPONSOR'} end
 end
 local aid=MySQL.insert.await([[INSERT INTO frame_awards(event_id,name,description,prize_text,sort_order,sponsor_id) VALUES(?,?,?,?,?,?)]],{e.id,name,type(data.description)=='string' and data.description:sub(1,2000) or nil,type(data.prize_text)=='string' and data.prize_text:sub(1,2000) or nil,tonumber(data.sort_order) or 0,sponsorId})
 return {ok=aid~=nil,award_id=aid}
end
function FrameManagement.SetWinner(src,data)
 local id=ident(src); local e=event(data); if not id or not FramePermissions.CanManageEvent(id,e) then return {ok=false,error='FORBIDDEN'} end
 if e.status~='judging' then return {ok=false,error='NOT_JUDGING'} end
 local award=MySQL.single.await('SELECT id FROM frame_awards WHERE id=? AND event_id=?',{tonumber(data.award_id),e.id}); if not award then return {ok=false,error='INVALID_AWARD'} end
 local sub=MySQL.single.await('SELECT id FROM frame_submissions WHERE public_id=? AND event_id=?',{data.submission_id,e.id}); if not sub then return {ok=false,error='INVALID_SUBMISSION'} end
 MySQL.query.await([[INSERT INTO frame_results(event_id,award_id,submission_id,placement,comment) VALUES(?,?,?,?,?) ON DUPLICATE KEY UPDATE submission_id=VALUES(submission_id),placement=VALUES(placement),comment=VALUES(comment)]],{e.id,award.id,sub.id,tonumber(data.placement),type(data.comment)=='string' and data.comment:sub(1,2000) or nil})
 MySQL.insert.await([[INSERT INTO frame_audit_logs(actor_identifier,action,entity_type,entity_id,event_id) VALUES(?,'RESULT_SET','award',?,?)]],{id,tostring(award.id),e.id})
 return {ok=true}
end
function FrameManagement.Results(src,data)
 local e=event(data); if not e then return {ok=false,error='NOT_FOUND'} end
 local id=ident(src); local can=FramePermissions.CanManageEvent(id,e); if not FramePermissions.CanViewEvent(id,e,src) then return {ok=false,error='FORBIDDEN'} end; if e.status~='results' and e.status~='ended' and not can then return {ok=false,error='NOT_PUBLISHED'} end
 local rows=MySQL.query.await([[SELECT a.name award_name,a.description award_description,a.prize_text,a.sponsor_id,sp.name sponsor_name,sp.logo_media_ref sponsor_logo,r.placement,r.comment,s.public_id submission_id,m.media_ref FROM frame_results r JOIN frame_awards a ON a.id=r.award_id LEFT JOIN frame_sponsors sp ON sp.id=a.sponsor_id AND sp.event_id=a.event_id JOIN frame_submissions s ON s.id=r.submission_id JOIN frame_submission_media m ON m.submission_id=s.id WHERE r.event_id=? ORDER BY COALESCE(r.placement,9999),a.sort_order,a.id]],{e.id}) or {}
 return {ok=true,results=rows}
end
function FrameManagement.StaffDashboard(src)
 local id=ident(src); if not FramePermissions.IsStaff(id) then return {ok=false,error='FORBIDDEN'} end
 local ads=MySQL.query.await([[SELECT a.public_id,a.advertiser_name,a.title,a.status,a.starts_at,a.ends_at,p.name product_name,a.price_snapshot FROM frame_ads a JOIN frame_ad_products p ON p.id=a.product_id ORDER BY a.created_at DESC LIMIT 100]]) or {}
 local events=MySQL.query.await([[SELECT e.public_id,e.title,e.organizer_name,e.event_type,e.status,e.created_at,(SELECT COUNT(*) FROM frame_event_participants p WHERE p.event_id=e.id AND p.status='active') participant_count,(SELECT COUNT(*) FROM frame_submissions s WHERE s.event_id=e.id AND s.status='submitted') submission_count FROM frame_events e ORDER BY e.created_at DESC LIMIT 100]]) or {}
 local stats={events=tonumber(MySQL.scalar.await([[SELECT COUNT(*) FROM frame_events]]) or 0),active=tonumber(MySQL.scalar.await([[SELECT COUNT(*) FROM frame_events WHERE status='active']]) or 0),submissions=tonumber(MySQL.scalar.await([[SELECT COUNT(*) FROM frame_submissions WHERE status='submitted']]) or 0),pending_ads=tonumber(MySQL.scalar.await([[SELECT COUNT(*) FROM frame_ads WHERE status='pending_review']]) or 0)}
 local audit=MySQL.query.await([[SELECT action,entity_type,entity_id,created_at FROM frame_audit_logs ORDER BY id DESC LIMIT 40]]) or {}
 return {ok=true,ads=ads,events=events,stats=stats,audit=audit}
end


function FrameManagement.ListAwards(src,data)
 local id=ident(src); local e=event(data); if not id or not e then return {ok=false,error='NOT_FOUND'} end
 if not FramePermissions.CanManageEvent(id,e) and e.status~='results' and e.status~='ended' then return {ok=false,error='FORBIDDEN'} end
 local rows=MySQL.query.await([[SELECT a.id,a.name,a.description,a.prize_text,a.sort_order,a.sponsor_id,sp.name sponsor_name,sp.logo_media_ref sponsor_logo,s.public_id AS submission_id,m.media_ref FROM frame_awards a LEFT JOIN frame_sponsors sp ON sp.id=a.sponsor_id AND sp.event_id=a.event_id LEFT JOIN frame_results r ON r.award_id=a.id AND r.event_id=a.event_id LEFT JOIN frame_submissions s ON s.id=r.submission_id LEFT JOIN frame_submission_media m ON m.submission_id=s.id WHERE a.event_id=? ORDER BY a.sort_order,a.id]],{e.id}) or {}
 return {ok=true,awards=rows}
end

function FrameManagement.BeginJudging(src,data)
 local id=ident(src); local e=event(data); if not id or not FramePermissions.CanManageEvent(id,e) then return {ok=false,error='FORBIDDEN'} end
 if e.event_type~='contest' then return {ok=false,error='NOT_CONTEST'} end
 if e.status~='active' then return {ok=false,error='EVENT_NOT_ACTIVE'} end
 local count=tonumber(MySQL.scalar.await([[SELECT COUNT(*) FROM frame_submissions WHERE event_id=? AND status='submitted']],{e.id}) or 0)
 if count<1 then return {ok=false,error='NO_SUBMISSIONS'} end
 local n=MySQL.update.await([[UPDATE frame_events SET status='judging',judging_starts_at=COALESCE(judging_starts_at,UTC_TIMESTAMP()),submissions_close_at=COALESCE(submissions_close_at,UTC_TIMESTAMP()) WHERE id=? AND status='active']],{e.id}) or 0
 if n<1 then return {ok=false,error='STATE_CHANGED'} end
 MySQL.insert.await([[INSERT INTO frame_audit_logs(actor_identifier,action,entity_type,entity_id,event_id) VALUES(?,'JUDGING_START','event',?,?)]],{id,e.public_id,e.id})
 return {ok=true}
end

function FrameManagement.PublishResults(src,data)
 local id=ident(src); local e=event(data); if not id or not FramePermissions.CanManageEvent(id,e) then return {ok=false,error='FORBIDDEN'} end
 if e.status~='judging' then return {ok=false,error='NOT_JUDGING'} end
 if e.event_type=='contest' then
   local awardCount=tonumber(MySQL.scalar.await([[SELECT COUNT(*) FROM frame_awards WHERE event_id=?]],{e.id}) or 0)
   if awardCount<1 then return {ok=false,error='NO_AWARDS'} end
   local resultCount=tonumber(MySQL.scalar.await([[SELECT COUNT(DISTINCT award_id) FROM frame_results WHERE event_id=?]],{e.id}) or 0)
   if resultCount<awardCount then return {ok=false,error='UNASSIGNED_AWARDS'} end
 end
 local n=MySQL.update.await([[UPDATE frame_events SET status='results',results_at=UTC_TIMESTAMP() WHERE id=? AND status='judging']],{e.id}) or 0
 if n<1 then return {ok=false,error='STATE_CHANGED'} end
 local participants=MySQL.query.await([[SELECT DISTINCT player_identifier FROM frame_event_participants WHERE event_id=? AND status='active']],{e.id}) or {}
 for _,p in ipairs(participants) do
   pcall(function()
     local number=exports['lb-phone']:GetEquippedPhoneNumber(p.player_identifier)
     if number then exports['lb-phone']:SendNotification(number,{app='frame',title='結果発表',content=(e.title or 'FRAMEイベント')..' の結果が発表されました。'}) end
   end)
 end
 MySQL.insert.await([[INSERT INTO frame_audit_logs(actor_identifier,action,entity_type,entity_id,event_id) VALUES(?,'RESULT_PUBLISH','event',?,?)]],{id,e.public_id,e.id})
 return {ok=true}
end


function FrameManagement.DeleteSubmission(src,data)
 local id=ident(src); local e=event(data); if not id or not FramePermissions.CanManageEvent(id,e) then return {ok=false,error='FORBIDDEN'} end
 if e.status=='results' or e.status=='ended' or e.status=='cancelled' then return {ok=false,error='RESULTS_LOCKED'} end
 local sid=type(data)=='table' and data.submission_id or ''
 local row=MySQL.single.await([[SELECT s.id FROM frame_submissions s LEFT JOIN frame_results r ON r.submission_id=s.id WHERE s.event_id=? AND s.public_id=? AND r.id IS NULL LIMIT 1]],{e.id,sid})
 if not row then return {ok=false,error='SUBMISSION_LOCKED_OR_NOT_FOUND'} end
 local n=MySQL.update.await([[DELETE FROM frame_submissions WHERE id=?]],{row.id}) or 0
 if n<1 then return {ok=false,error='STATE_CHANGED'} end
 MySQL.insert.await([[INSERT INTO frame_audit_logs(actor_identifier,action,entity_type,entity_id,event_id) VALUES(?,'SUBMISSION_MOD_DELETE','submission',?,?)]],{id,sid,e.id})
 return {ok=true}
end


function FrameManagement.InviteByPhone(src,data)
 local id=ident(src); local e=event(data); if not id or not FramePermissions.CanManageEvent(id,e) then return {ok=false,error='FORBIDDEN'} end
 if e.visibility~='private' then return {ok=false,error='NOT_PRIVATE_EVENT'} end
 if e.status=='ended' or e.status=='cancelled' or e.status=='results' then return {ok=false,error='EVENT_ALREADY_CLOSED'} end
 local phone=type(data)=='table' and tostring(data.phone_number or ''):gsub('%s+','') or ''
 if phone=='' then return {ok=false,error='PHONE_REQUIRED'} end
 local ok,target=pcall(function() return exports['lb-phone']:GetSourceFromNumber(phone) end)
 if not ok or not target or target==false then return {ok=false,error='INVITEE_OFFLINE'} end
 target=tonumber(target); local targetId=target and FrameFramework.GetIdentifier(target) or nil
 if not targetId then return {ok=false,error='PLAYER_NOT_READY'} end
 MySQL.query.await([[INSERT INTO frame_event_invites(event_id,player_identifier,invited_by) VALUES(?,?,?) ON DUPLICATE KEY UPDATE invited_by=VALUES(invited_by)]],{e.id,targetId,id})
 pcall(function() exports['lb-phone']:SendNotification(target,{app='frame',title='FRAME 招待',content=(e.title or 'イベント')..' に招待されました。'}) end)
 MySQL.insert.await([[INSERT INTO frame_audit_logs(actor_identifier,action,entity_type,entity_id,event_id,metadata) VALUES(?,'EVENT_INVITE','event',?,?,?)]],{id,e.public_id,e.id,json.encode({target=targetId})})
 return {ok=true}
end


function FrameManagement.ListSponsors(src,data)
 local id=ident(src); local e=event(data); if not id or not e then return {ok=false,error='NOT_FOUND'} end
 if not FramePermissions.CanViewEvent(id,e,src) then return {ok=false,error='FORBIDDEN'} end
 local rows=MySQL.query.await([[SELECT id,name,logo_media_ref,link_value,sort_order FROM frame_sponsors WHERE event_id=? ORDER BY sort_order,id]],{e.id}) or {}
 return {ok=true,sponsors=rows}
end

function FrameManagement.AddSponsor(src,data)
 local id=ident(src); local e=event(data); if not id or not FramePermissions.CanManageEvent(id,e) then return {ok=false,error='FORBIDDEN'} end
 if e.status=='results' or e.status=='ended' or e.status=='cancelled' then return {ok=false,error='RESULTS_LOCKED'} end
 local name=type(data.name)=='string' and data.name:gsub('^%s+',''):gsub('%s+$',''):sub(1,120) or ''
 if name=='' then return {ok=false,error='SPONSOR_NAME_REQUIRED'} end
 local logo=type(data.logo_media_ref)=='string' and data.logo_media_ref:sub(1,512) or nil
 if logo=='' then logo=nil end
 local link=type(data.link_value)=='string' and data.link_value:sub(1,255) or nil
 if link=='' then link=nil end
 local sponsorId=MySQL.insert.await([[INSERT INTO frame_sponsors(event_id,name,logo_media_ref,link_value,sort_order) VALUES(?,?,?,?,?)]],{e.id,name,logo,link,tonumber(data.sort_order) or 0})
 if not sponsorId then return {ok=false,error='DATABASE_ERROR'} end
 MySQL.insert.await([[INSERT INTO frame_audit_logs(actor_identifier,action,entity_type,entity_id,event_id) VALUES(?,'SPONSOR_ADD','sponsor',?,?)]],{id,tostring(sponsorId),e.id})
 return {ok=true,id=sponsorId}
end

function FrameManagement.DeleteSponsor(src,data)
 local id=ident(src); local e=event(data); if not id or not FramePermissions.CanManageEvent(id,e) then return {ok=false,error='FORBIDDEN'} end
 if e.status=='results' or e.status=='ended' or e.status=='cancelled' then return {ok=false,error='RESULTS_LOCKED'} end
 local sponsorId=tonumber(type(data)=='table' and data.sponsor_id or nil); if not sponsorId then return {ok=false,error='NOT_FOUND'} end
 MySQL.update.await([[UPDATE frame_awards SET sponsor_id=NULL WHERE sponsor_id=? AND event_id=?]],{sponsorId,e.id})
 local n=MySQL.update.await([[DELETE FROM frame_sponsors WHERE id=? AND event_id=?]],{sponsorId,e.id}) or 0
 if n<1 then return {ok=false,error='NOT_FOUND'} end
 MySQL.insert.await([[INSERT INTO frame_audit_logs(actor_identifier,action,entity_type,entity_id,event_id) VALUES(?,'SPONSOR_DELETE','sponsor',?,?)]],{id,tostring(sponsorId),e.id})
 return {ok=true}
end


function FrameManagement.ToggleFavorite(src,data)
 local id=ident(src); local e=event(data)
 if not id then return {ok=false,error='PLAYER_NOT_READY'} end
 if not e then return {ok=false,error='NOT_FOUND'} end
 if not FramePermissions.CanViewEvent(id,e,src) then return {ok=false,error='FORBIDDEN'} end
 local exists=MySQL.scalar.await([[SELECT 1 FROM frame_event_favorites WHERE event_id=? AND player_identifier=? LIMIT 1]],{e.id,id}) ~= nil
 if exists then
   MySQL.update.await([[DELETE FROM frame_event_favorites WHERE event_id=? AND player_identifier=?]],{e.id,id})
   return {ok=true,favorited=false}
 end
 MySQL.query.await([[INSERT IGNORE INTO frame_event_favorites(event_id,player_identifier) VALUES(?,?)]],{e.id,id})
 return {ok=true,favorited=true}
end
