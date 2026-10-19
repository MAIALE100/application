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
 local aid=MySQL.insert.await([[INSERT INTO frame_awards(event_id,name,description,prize_text,sort_order) VALUES(?,?,?,?,?)]],{e.id,name,type(data.description)=='string' and data.description:sub(1,2000) or nil,type(data.prize_text)=='string' and data.prize_text:sub(1,2000) or nil,tonumber(data.sort_order) or 0})
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
 local id=ident(src); local can=FramePermissions.CanManageEvent(id,e); if e.status~='results' and e.status~='ended' and not can then return {ok=false,error='NOT_PUBLISHED'} end
 local rows=MySQL.query.await([[SELECT a.name award_name,a.prize_text,r.placement,r.comment,s.public_id submission_id,m.media_ref FROM frame_results r JOIN frame_awards a ON a.id=r.award_id JOIN frame_submissions s ON s.id=r.submission_id JOIN frame_submission_media m ON m.submission_id=s.id WHERE r.event_id=? ORDER BY COALESCE(r.placement,9999),a.sort_order,a.id]],{e.id}) or {}
 return {ok=true,results=rows}
end
function FrameManagement.StaffDashboard(src)
 local id=ident(src); if not FramePermissions.IsStaff(id) then return {ok=false,error='FORBIDDEN'} end
 return {ok=true,ads=MySQL.query.await([[SELECT a.public_id,a.advertiser_name,a.title,a.status,a.starts_at,a.ends_at,p.name product_name,a.price_snapshot FROM frame_ads a JOIN frame_ad_products p ON p.id=a.product_id ORDER BY a.created_at DESC LIMIT 100]]) or {}}
end


function FrameManagement.ListAwards(src,data)
 local id=ident(src); local e=event(data); if not id or not e then return {ok=false,error='NOT_FOUND'} end
 if not FramePermissions.CanManageEvent(id,e) and e.status~='results' and e.status~='ended' then return {ok=false,error='FORBIDDEN'} end
 local rows=MySQL.query.await([[SELECT a.id,a.name,a.description,a.prize_text,a.sort_order,s.public_id AS submission_id,m.media_ref FROM frame_awards a LEFT JOIN frame_results r ON r.award_id=a.id AND r.event_id=a.event_id LEFT JOIN frame_submissions s ON s.id=r.submission_id LEFT JOIN frame_submission_media m ON m.submission_id=s.id WHERE a.event_id=? ORDER BY a.sort_order,a.id]],{e.id}) or {}
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
 MySQL.insert.await([[INSERT INTO frame_audit_logs(actor_identifier,action,entity_type,entity_id,event_id) VALUES(?,'RESULT_PUBLISH','event',?,?)]],{id,e.public_id,e.id})
 return {ok=true}
end
