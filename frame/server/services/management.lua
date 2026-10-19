FrameManagement={}
local function ident(src) return FrameFramework.GetIdentifier(src) end
local function event(data) return FrameEventsRepository.GetByPublicId(type(data)=='table' and data.public_id or '') end
function FrameManagement.ListSubmissions(src,data)
 local id=ident(src); local e=event(data); if not id or not FramePermissions.CanManageEvent(id,e,src) then return {ok=false,error='FORBIDDEN'} end
 local rows=MySQL.query.await([[SELECT s.public_id,s.player_identifier,s.caption,s.status,s.submitted_at,m.media_ref FROM frame_submissions s JOIN frame_submission_media m ON m.submission_id=s.id WHERE s.event_id=? ORDER BY s.submitted_at DESC]],{e.id}) or {}
 return {ok=true,submissions=rows}
end
function FrameManagement.AuthorizeSave(src,data)
 local id=ident(src); local e=event(data); if not id or not FramePermissions.CanManageEvent(id,e,src) then return {ok=false,error='FORBIDDEN'} end
 local row=MySQL.single.await([[SELECT s.public_id,m.media_ref FROM frame_submissions s JOIN frame_submission_media m ON m.submission_id=s.id WHERE s.event_id=? AND s.public_id=? LIMIT 1]],{e.id,type(data)=='table' and data.submission_id or ''})
 if not row then return {ok=false,error='NOT_FOUND'} end
 MySQL.insert.await([[INSERT INTO frame_audit_logs(actor_identifier,action,entity_type,entity_id,event_id) VALUES(?,'SUBMISSION_DOWNLOAD','submission',?,?)]],{id,row.public_id,e.id})
 return {ok=true,media_ref=row.media_ref}
end
function FrameManagement.AddAward(src,data)
 local id=ident(src); local e=event(data); if not id or not FramePermissions.CanManageEvent(id,e,src) then return {ok=false,error='FORBIDDEN'} end
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
 local id=ident(src); local e=event(data); if not id or not FramePermissions.CanManageEvent(id,e,src) then return {ok=false,error='FORBIDDEN'} end
 if e.status~='judging' then return {ok=false,error='NOT_JUDGING'} end
 local award=MySQL.single.await('SELECT id FROM frame_awards WHERE id=? AND event_id=?',{tonumber(data.award_id),e.id}); if not award then return {ok=false,error='INVALID_AWARD'} end
 local sub=MySQL.single.await('SELECT id FROM frame_submissions WHERE public_id=? AND event_id=?',{data.submission_id,e.id}); if not sub then return {ok=false,error='INVALID_SUBMISSION'} end
 MySQL.query.await([[INSERT INTO frame_results(event_id,award_id,submission_id,placement,comment) VALUES(?,?,?,?,?) ON DUPLICATE KEY UPDATE submission_id=VALUES(submission_id),placement=VALUES(placement),comment=VALUES(comment)]],{e.id,award.id,sub.id,tonumber(data.placement),type(data.comment)=='string' and data.comment:sub(1,2000) or nil})
 MySQL.insert.await([[INSERT INTO frame_audit_logs(actor_identifier,action,entity_type,entity_id,event_id) VALUES(?,'RESULT_SET','award',?,?)]],{id,tostring(award.id),e.id})
 return {ok=true}
end
function FrameManagement.Results(src,data)
 local e=event(data); if not e then return {ok=false,error='NOT_FOUND'} end
 local id=ident(src); local can=FramePermissions.CanManageEvent(id,e,src); if not FramePermissions.CanViewEvent(id,e,src) then return {ok=false,error='FORBIDDEN'} end; if e.status~='results' and e.status~='ended' and not can then return {ok=false,error='NOT_PUBLISHED'} end
 local rows=MySQL.query.await([[SELECT a.name award_name,a.description award_description,a.prize_text,a.sponsor_id,sp.name sponsor_name,sp.logo_media_ref sponsor_logo,r.placement,r.comment,s.public_id submission_id,m.media_ref FROM frame_results r JOIN frame_awards a ON a.id=r.award_id LEFT JOIN frame_sponsors sp ON sp.id=a.sponsor_id AND sp.event_id=a.event_id JOIN frame_submissions s ON s.id=r.submission_id JOIN frame_submission_media m ON m.submission_id=s.id WHERE r.event_id=? ORDER BY COALESCE(r.placement,9999),a.sort_order,a.id]],{e.id}) or {}
 return {ok=true,results=rows}
end
function FrameManagement.StaffDashboard(src)
 local id=ident(src); if not FramePermissions.IsStaff(id,src) then return {ok=false,error='FORBIDDEN'} end
 local ads=MySQL.query.await([[SELECT a.public_id,a.advertiser_name,a.title,a.status,a.starts_at,a.ends_at,p.name product_name,a.price_snapshot FROM frame_ads a JOIN frame_ad_products p ON p.id=a.product_id ORDER BY a.created_at DESC LIMIT 100]]) or {}
 local events=MySQL.query.await([[SELECT e.public_id,e.title,e.organizer_name,e.event_type,e.status,e.created_at,(SELECT COUNT(*) FROM frame_event_participants p WHERE p.event_id=e.id AND p.status='active') participant_count,(SELECT COUNT(*) FROM frame_submissions s WHERE s.event_id=e.id AND s.status='submitted') submission_count FROM frame_events e ORDER BY e.created_at DESC LIMIT 100]]) or {}
 local stats={events=tonumber(MySQL.scalar.await([[SELECT COUNT(*) FROM frame_events]]) or 0),active=tonumber(MySQL.scalar.await([[SELECT COUNT(*) FROM frame_events WHERE status='active']]) or 0),submissions=tonumber(MySQL.scalar.await([[SELECT COUNT(*) FROM frame_submissions WHERE status='submitted']]) or 0),pending_ads=tonumber(MySQL.scalar.await([[SELECT COUNT(*) FROM frame_ads WHERE status='pending_review']]) or 0)}
 local audit=MySQL.query.await([[SELECT action,entity_type,entity_id,created_at FROM frame_audit_logs ORDER BY id DESC LIMIT 40]]) or {}
 return {ok=true,ads=ads,events=events,stats=stats,audit=audit}
end


function FrameManagement.ListAwards(src,data)
 local id=ident(src); local e=event(data); if not id or not e then return {ok=false,error='NOT_FOUND'} end
 if not FramePermissions.CanManageEvent(id,e,src) and e.status~='results' and e.status~='ended' then return {ok=false,error='FORBIDDEN'} end
 local rows=MySQL.query.await([[SELECT a.id,a.name,a.description,a.prize_text,a.sort_order,a.sponsor_id,sp.name sponsor_name,sp.logo_media_ref sponsor_logo,s.public_id AS submission_id,m.media_ref FROM frame_awards a LEFT JOIN frame_sponsors sp ON sp.id=a.sponsor_id AND sp.event_id=a.event_id LEFT JOIN frame_results r ON r.award_id=a.id AND r.event_id=a.event_id LEFT JOIN frame_submissions s ON s.id=r.submission_id LEFT JOIN frame_submission_media m ON m.submission_id=s.id WHERE a.event_id=? ORDER BY a.sort_order,a.id]],{e.id}) or {}
 return {ok=true,awards=rows}
end

function FrameManagement.BeginJudging(src,data)
 local id=ident(src); local e=event(data); if not id or not FramePermissions.CanManageEvent(id,e,src) then return {ok=false,error='FORBIDDEN'} end
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
 local id=ident(src); local e=event(data); if not id or not FramePermissions.CanManageEvent(id,e,src) then return {ok=false,error='FORBIDDEN'} end
 if e.status~='judging' then return {ok=false,error='NOT_JUDGING'} end
 if e.event_type=='contest' then
   local awardCount=tonumber(MySQL.scalar.await([[SELECT COUNT(*) FROM frame_awards WHERE event_id=?]],{e.id}) or 0)
   if awardCount<1 then return {ok=false,error='NO_AWARDS'} end
   local resultCount=tonumber(MySQL.scalar.await([[SELECT COUNT(DISTINCT award_id) FROM frame_results WHERE event_id=?]],{e.id}) or 0)
   if resultCount<awardCount then return {ok=false,error='UNASSIGNED_AWARDS'} end
 end
 local n=MySQL.update.await([[UPDATE frame_events SET status='results',results_at=UTC_TIMESTAMP() WHERE id=? AND status='judging']],{e.id}) or 0
 if n<1 then return {ok=false,error='STATE_CHANGED'} end
 pcall(function() FrameNotifications.NotifyResults(e) end)
 MySQL.insert.await([[INSERT INTO frame_audit_logs(actor_identifier,action,entity_type,entity_id,event_id) VALUES(?,'RESULT_PUBLISH','event',?,?)]],{id,e.public_id,e.id})
 return {ok=true}
end


function FrameManagement.DeleteSubmission(src,data)
 local id=ident(src); local e=event(data); if not id or not FramePermissions.CanManageEvent(id,e,src) then return {ok=false,error='FORBIDDEN'} end
 if e.status=='results' or e.status=='ended' or e.status=='cancelled' then return {ok=false,error='RESULTS_LOCKED'} end
 local sid=type(data)=='table' and data.submission_id or ''
 local row=MySQL.single.await([[SELECT s.id FROM frame_submissions s LEFT JOIN frame_results r ON r.submission_id=s.id WHERE s.event_id=? AND s.public_id=? AND r.id IS NULL LIMIT 1]],{e.id,sid})
 if not row then return {ok=false,error='SUBMISSION_LOCKED_OR_NOT_FOUND'} end
 local n=MySQL.update.await([[DELETE FROM frame_submissions WHERE id=?]],{row.id}) or 0
 if n<1 then return {ok=false,error='STATE_CHANGED'} end
 MySQL.insert.await([[INSERT INTO frame_audit_logs(actor_identifier,action,entity_type,entity_id,event_id) VALUES(?,'SUBMISSION_MOD_DELETE','submission',?,?)]],{id,sid,e.id})
 return {ok=true}
end


function FrameManagement.ListCollaborators(src,data)
 local id=ident(src); local e=event(data)
 if not id or not e then return {ok=false,error='NOT_FOUND'} end
 if not FramePermissions.CanManageEvent(id,e,src) then return {ok=false,error='FORBIDDEN'} end
 local canShare=FramePermissions.CanShareEvent(id,e,src)
 local rows=MySQL.query.await([[SELECT id,player_identifier,display_name,phone_number,created_at
   FROM frame_event_collaborators WHERE event_id=? ORDER BY created_at,id]],{e.id}) or {}
 if not canShare then
  for _,row in ipairs(rows) do row.phone_number=nil end
 end
 return {ok=true,collaborators=rows,can_share=canShare}
end

function FrameManagement.AddCollaborator(src,data)
 local id=ident(src); local e=event(data)
 if not id or not e then return {ok=false,error='NOT_FOUND'} end
 if not FramePermissions.CanShareEvent(id,e,src) then return {ok=false,error='FORBIDDEN'} end
 local phone=type(data)=='table' and tostring(data.phone_number or ''):gsub('%s+','') or ''
 if phone=='' then return {ok=false,error='PHONE_REQUIRED'} end
 local ok,target=pcall(function() return exports['lb-phone']:GetSourceFromNumber(phone) end)
 if not ok or not target or target==false then return {ok=false,error='INVITEE_OFFLINE'} end
 target=tonumber(target)
 local targetId=target and FrameFramework.GetIdentifier(target) or nil
 if not targetId then return {ok=false,error='PLAYER_NOT_READY'} end
 if targetId==e.owner_identifier then return {ok=false,error='ALREADY_OWNER'} end
 local targetName=FrameFramework.GetCharacterName(target) or GetPlayerName(target) or '共同主催者'
 MySQL.query.await([[INSERT INTO frame_event_collaborators(event_id,player_identifier,display_name,phone_number,added_by)
   VALUES(?,?,?,?,?)
   ON DUPLICATE KEY UPDATE display_name=VALUES(display_name),phone_number=VALUES(phone_number),added_by=VALUES(added_by)]],
   {e.id,targetId,tostring(targetName):sub(1,100),phone:sub(1,32),id})
 pcall(function() exports['lb-phone']:SendNotification(target,{app='frame',title='FRAME 共同主催',content=(e.title or 'イベント')..' の共同主催者に追加されました。'}) end)
 MySQL.insert.await([[INSERT INTO frame_audit_logs(actor_identifier,action,entity_type,entity_id,event_id,metadata)
   VALUES(?,'COLLABORATOR_ADD','event',?,?,?)]],{id,e.public_id,e.id,json.encode({target=targetId,phone=phone})})
 return {ok=true}
end

function FrameManagement.RemoveCollaborator(src,data)
 local id=ident(src); local e=event(data)
 if not id or not e then return {ok=false,error='NOT_FOUND'} end
 if not FramePermissions.CanShareEvent(id,e,src) then return {ok=false,error='FORBIDDEN'} end
 local collaboratorId=tonumber(type(data)=='table' and data.collaborator_id or nil)
 if not collaboratorId then return {ok=false,error='NOT_FOUND'} end
 local row=MySQL.single.await([[SELECT player_identifier,display_name FROM frame_event_collaborators WHERE id=? AND event_id=? LIMIT 1]],{collaboratorId,e.id})
 if not row then return {ok=false,error='NOT_FOUND'} end
 local n=MySQL.update.await([[DELETE FROM frame_event_collaborators WHERE id=? AND event_id=?]],{collaboratorId,e.id}) or 0
 if n<1 then return {ok=false,error='STATE_CHANGED'} end
 MySQL.insert.await([[INSERT INTO frame_audit_logs(actor_identifier,action,entity_type,entity_id,event_id,metadata)
   VALUES(?,'COLLABORATOR_REMOVE','event',?,?,?)]],{id,e.public_id,e.id,json.encode({target=row.player_identifier,name=row.display_name})})
 return {ok=true}
end


function FrameManagement.InviteByPhone(src,data)
 local id=ident(src); local e=event(data); if not id or not FramePermissions.CanManageEvent(id,e,src) then return {ok=false,error='FORBIDDEN'} end
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
 local id=ident(src); local e=event(data); if not id or not FramePermissions.CanManageEvent(id,e,src) then return {ok=false,error='FORBIDDEN'} end
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
 local id=ident(src); local e=event(data); if not id or not FramePermissions.CanManageEvent(id,e,src) then return {ok=false,error='FORBIDDEN'} end
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


local function frameBool(v) return v==true or tonumber(v)==1 end

function FrameManagement.VoteCandidates(src,data)
 local id=ident(src); local e=event(data)
 if not id then return {ok=false,error='PLAYER_NOT_READY'} end
 if not e then return {ok=false,error='NOT_FOUND'} end
 if not FramePermissions.CanViewEvent(id,e,src) then return {ok=false,error='FORBIDDEN'} end
 if not frameBool(e.voting_enabled) then return {ok=false,error='VOTING_DISABLED'} end
 local canVote=(e.status=='active' or e.status=='judging')
 local canManage=FramePermissions.CanManageEvent(id,e,src)
 local chosen=MySQL.scalar.await([[SELECT s.public_id FROM frame_votes v JOIN frame_submissions s ON s.id=v.submission_id WHERE v.event_id=? AND v.voter_identifier=? LIMIT 1]],{e.id,id})
 local rows=MySQL.query.await([[SELECT s.public_id,s.caption,m.media_ref,(s.player_identifier=?) own_submission,COUNT(v.id) vote_count
   FROM frame_submissions s
   JOIN frame_submission_media m ON m.submission_id=s.id
   LEFT JOIN frame_votes v ON v.submission_id=s.id AND v.event_id=s.event_id
   WHERE s.event_id=? AND s.status='submitted'
   GROUP BY s.id,s.public_id,s.caption,m.media_ref,s.player_identifier
   ORDER BY COUNT(v.id) DESC,s.submitted_at ASC]],{id,e.id}) or {}
 local total=0
 for _,r in ipairs(rows) do
   r.vote_count=tonumber(r.vote_count) or 0
   total=total+r.vote_count
   r.own_submission=tonumber(r.own_submission)==1 or r.own_submission==true
   if canVote and not canManage then r.vote_count=nil end
 end
 return {ok=true,candidates=rows,can_vote=canVote,voted_submission_id=chosen,total_votes=total,show_counts=(not canVote) or canManage}
end

function FrameManagement.CastVote(src,data)
 local id=ident(src); local e=event(data)
 if not id then return {ok=false,error='PLAYER_NOT_READY'} end
 if not e then return {ok=false,error='NOT_FOUND'} end
 if not FramePermissions.CanViewEvent(id,e,src) then return {ok=false,error='FORBIDDEN'} end
 if not frameBool(e.voting_enabled) then return {ok=false,error='VOTING_DISABLED'} end
 if e.status~='active' and e.status~='judging' then return {ok=false,error='VOTING_CLOSED'} end
 local sid=type(data)=='table' and tostring(data.submission_id or '') or ''
 local sub=MySQL.single.await([[SELECT id,player_identifier,public_id FROM frame_submissions WHERE event_id=? AND public_id=? AND status='submitted' LIMIT 1]],{e.id,sid})
 if not sub then return {ok=false,error='INVALID_SUBMISSION'} end
 if sub.player_identifier==id then return {ok=false,error='SELF_VOTE_DISABLED'} end
 local current=MySQL.single.await([[SELECT id,submission_id FROM frame_votes WHERE event_id=? AND voter_identifier=? LIMIT 1]],{e.id,id})
 if current and tonumber(current.submission_id)==tonumber(sub.id) then
   MySQL.update.await([[DELETE FROM frame_votes WHERE event_id=? AND voter_identifier=?]],{e.id,id})
   MySQL.insert.await([[INSERT INTO frame_audit_logs(actor_identifier,action,entity_type,entity_id,event_id) VALUES(?,'VOTE_REMOVE','submission',?,?)]],{id,sid,e.id})
   return {ok=true,voted=false}
 end
 local ok=MySQL.transaction.await({
   {query=[[DELETE FROM frame_votes WHERE event_id=? AND voter_identifier=?]],values={e.id,id}},
   {query=[[INSERT INTO frame_votes(event_id,submission_id,voter_identifier,score) VALUES(?,?,?,1)]],values={e.id,sub.id,id}}
 })
 if not ok then return {ok=false,error='DATABASE_ERROR'} end
 MySQL.insert.await([[INSERT INTO frame_audit_logs(actor_identifier,action,entity_type,entity_id,event_id) VALUES(?,'VOTE_CAST','submission',?,?)]],{id,sid,e.id})
 return {ok=true,voted=true,submission_id=sid}
end

function FrameManagement.ApplyPublicVoteAward(src,data)
 local id=ident(src); local e=event(data)
 if not id or not FramePermissions.CanManageEvent(id,e,src) then return {ok=false,error='FORBIDDEN'} end
 if e.event_type~='contest' then return {ok=false,error='NOT_CONTEST'} end
 if e.status~='judging' then return {ok=false,error='NOT_JUDGING'} end
 if not frameBool(e.voting_enabled) then return {ok=false,error='VOTING_DISABLED'} end
 local top=MySQL.query.await([[SELECT s.id,s.public_id,COUNT(v.id) votes
   FROM frame_submissions s
   LEFT JOIN frame_votes v ON v.submission_id=s.id AND v.event_id=s.event_id
   WHERE s.event_id=? AND s.status='submitted'
   GROUP BY s.id,s.public_id
   HAVING COUNT(v.id)>0
   ORDER BY COUNT(v.id) DESC,s.submitted_at ASC LIMIT 2]],{e.id}) or {}
 if #top<1 then return {ok=false,error='NO_VOTES'} end
 local firstVotes=tonumber(top[1].votes) or 0
 if #top>1 and (tonumber(top[2].votes) or 0)==firstVotes then return {ok=false,error='VOTE_TIE'} end
 local award=MySQL.single.await([[SELECT id FROM frame_awards WHERE event_id=? AND name='市民投票賞' LIMIT 1]],{e.id})
 local awardId=award and tonumber(award.id) or MySQL.insert.await([[INSERT INTO frame_awards(event_id,name,description,prize_text,sort_order) VALUES(?,'市民投票賞','FRAME内の市民投票で最も多く票を集めた作品です。',NULL,900)]],{e.id})
 if not awardId then return {ok=false,error='DATABASE_ERROR'} end
 MySQL.query.await([[INSERT INTO frame_results(event_id,award_id,submission_id,placement,comment) VALUES(?,?,?,NULL,?) ON DUPLICATE KEY UPDATE submission_id=VALUES(submission_id),comment=VALUES(comment)]],{e.id,awardId,top[1].id,('市民投票 %d票'):format(firstVotes)})
 MySQL.insert.await([[INSERT INTO frame_audit_logs(actor_identifier,action,entity_type,entity_id,event_id,metadata) VALUES(?,'PUBLIC_VOTE_AWARD','award',?,?,?)]],{id,tostring(awardId),e.id,json.encode({submission_id=top[1].public_id,votes=firstVotes})})
 return {ok=true,submission_id=top[1].public_id,votes=firstVotes,award_id=awardId}
end


function FrameManagement.EventAnalytics(src,data)
 local id=ident(src); local e=event(data)
 if not id or not FramePermissions.CanManageEvent(id,e,src) then return {ok=false,error='FORBIDDEN'} end
 local participants=tonumber(MySQL.scalar.await([[SELECT COUNT(*) FROM frame_event_participants WHERE event_id=? AND status='active']],{e.id}) or 0)
 local submissions=tonumber(MySQL.scalar.await([[SELECT COUNT(*) FROM frame_submissions WHERE event_id=? AND status='submitted']],{e.id}) or 0)
 local submitters=tonumber(MySQL.scalar.await([[SELECT COUNT(DISTINCT player_identifier) FROM frame_submissions WHERE event_id=? AND status='submitted']],{e.id}) or 0)
 local favorites=tonumber(MySQL.scalar.await([[SELECT COUNT(*) FROM frame_event_favorites WHERE event_id=?]],{e.id}) or 0)
 local votes=tonumber(MySQL.scalar.await([[SELECT COUNT(*) FROM frame_votes WHERE event_id=?]],{e.id}) or 0)
 local frameEntries=tonumber(MySQL.scalar.await([[SELECT COUNT(*) FROM frame_audit_logs WHERE event_id=? AND action='SUBMISSION_CREATE']],{e.id}) or 0)
 local socialEntries=tonumber(MySQL.scalar.await([[SELECT COUNT(*) FROM frame_audit_logs WHERE event_id=? AND action='SOCIAL_SUBMISSION_CREATE']],{e.id}) or 0)
 local notifications=tonumber(MySQL.scalar.await([[SELECT COUNT(*) FROM frame_notification_deliveries WHERE event_id=? AND status='sent']],{e.id}) or 0)
 local conversion=participants>0 and math.floor((submitters/participants)*100+0.5) or 0
 local avg=submitters>0 and math.floor((submissions/submitters)*10+0.5)/10 or 0
 return {ok=true,analytics={
   participants=participants,submissions=submissions,submitters=submitters,favorites=favorites,
   votes=votes,frame_entries=frameEntries,social_entries=socialEntries,notifications=notifications,
   conversion=conversion,avg_submissions=avg
 }}
end
