FrameEventsRepository = {}
local LIST_SQL = [[
SELECT e.public_id,e.title,e.description,e.event_type,e.category,e.cover_media_ref,e.organizer_name,e.status,e.starts_at,e.ends_at,e.submissions_close_at,
COALESCE((SELECT COUNT(*) FROM frame_event_participants p WHERE p.event_id=e.id AND p.status='active'),0) participant_count
FROM frame_events e WHERE LOWER(TRIM(COALESCE(e.visibility,'public')))='public' AND e.status IN ('scheduled','active','judging','results','ended')
ORDER BY CASE e.status WHEN 'active' THEN 0 WHEN 'scheduled' THEN 1 WHEN 'results' THEN 2 WHEN 'judging' THEN 3 ELSE 4 END,COALESCE(e.starts_at,e.created_at) DESC LIMIT ?]]
function FrameEventsRepository.ListPublic(limit) return MySQL.query.await(LIST_SQL,{limit}) or {} end
function FrameEventsRepository.ListRestrictedForJob(jobName,limit)
 if not jobName or jobName=='' then return {} end
 return MySQL.query.await([[SELECT DISTINCT e.public_id,e.title,e.description,e.event_type,e.category,e.cover_media_ref,e.organizer_name,e.status,e.starts_at,e.ends_at,e.submissions_close_at,
 COALESCE((SELECT COUNT(*) FROM frame_event_participants p WHERE p.event_id=e.id AND p.status='active'),0) participant_count
 FROM frame_events e JOIN frame_event_access_rules ar ON ar.event_id=e.id AND ar.rule_type='job'
 WHERE e.visibility='restricted' AND LOWER(ar.rule_value)=LOWER(?) AND e.status IN ('scheduled','active','judging','results','ended')
 ORDER BY CASE e.status WHEN 'active' THEN 0 WHEN 'scheduled' THEN 1 WHEN 'results' THEN 2 WHEN 'judging' THEN 3 ELSE 4 END,COALESCE(e.starts_at,e.created_at) DESC LIMIT ?]],{jobName,limit}) or {}
end
function FrameEventsRepository.ListInvited(identifier,limit)
 return MySQL.query.await([[SELECT e.public_id,e.title,e.description,e.event_type,e.category,e.cover_media_ref,e.organizer_name,e.status,e.starts_at,e.ends_at,e.submissions_close_at FROM frame_event_invites i JOIN frame_events e ON e.id=i.event_id WHERE i.player_identifier=? AND e.status IN ('scheduled','active','judging','results','ended') ORDER BY COALESCE(e.starts_at,e.created_at) DESC LIMIT ?]],{identifier,limit}) or {}
end
function FrameEventsRepository.GetByPublicId(publicId)
  return MySQL.single.await([[SELECT e.*,r.participation_required,r.submission_enabled,r.judging_enabled,r.ranking_enabled,r.voting_enabled,r.awards_enabled,r.max_submissions,r.allow_submission_edit,r.allow_submission_delete,r.comment_mode,r.approval_mode,r.extra_rules, CASE WHEN (e.submissions_open_at IS NULL OR e.submissions_open_at<=UTC_TIMESTAMP()) AND (e.submissions_close_at IS NULL OR e.submissions_close_at>=UTC_TIMESTAMP()) THEN 1 ELSE 0 END AS submission_window_open FROM frame_events e LEFT JOIN frame_event_rules r ON r.event_id=e.id WHERE e.public_id=? LIMIT 1]],{publicId})
end
function FrameEventsRepository.ListOwned(identifier)
  local months=math.max(1,math.min(24,tonumber(FrameConfig.RetentionMonths) or 2))
  local sql=([[SELECT e.public_id,e.title,e.description,e.event_type,e.category,e.cover_media_ref,e.status,e.visibility,e.starts_at,e.submissions_close_at,e.ends_at,e.created_at,
  DATE_ADD(e.created_at,INTERVAL %d MONTH) retention_delete_at,
  CASE WHEN e.owner_identifier=? THEN 1 ELSE 0 END is_owner,
  CASE WHEN e.owner_identifier<>? AND EXISTS(SELECT 1 FROM frame_event_collaborators c WHERE c.event_id=e.id AND c.player_identifier=?) THEN 1 ELSE 0 END is_collaborator,
  COALESCE((SELECT COUNT(*) FROM frame_event_participants p WHERE p.event_id=e.id AND p.status='active'),0) participant_count,
  COALESCE((SELECT COUNT(*) FROM frame_submissions s WHERE s.event_id=e.id AND s.status='submitted'),0) submission_count,
  COALESCE((SELECT COUNT(DISTINCT s2.player_identifier) FROM frame_submissions s2 WHERE s2.event_id=e.id AND s2.status='submitted'),0) submitter_count,
  COALESCE((SELECT COUNT(*) FROM frame_event_favorites f WHERE f.event_id=e.id),0) favorite_count
  FROM frame_events e
  WHERE e.owner_identifier=? OR EXISTS(SELECT 1 FROM frame_event_collaborators c2 WHERE c2.event_id=e.id AND c2.player_identifier=?)
  ORDER BY e.created_at DESC LIMIT 100]]):format(months)
  return MySQL.query.await(sql,{identifier,identifier,identifier,identifier,identifier}) or {}
end

function FrameEventsRepository.Create(identifier,name,input,publicId)
  return MySQL.transaction.await({
    {query=[[INSERT INTO frame_events(public_id,owner_identifier,organizer_name,organizer_type,title,description,event_type,category,cover_media_ref,visibility,status,publish_at,starts_at,submissions_open_at,submissions_close_at,judging_starts_at,results_at,ends_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)]],values={publicId,identifier,name,'individual',input.title,input.description,input.event_type,input.category,input.cover_media_ref,input.visibility,'draft',input.publish_at,input.starts_at,input.submissions_open_at,input.submissions_close_at,input.judging_starts_at,input.results_at,input.ends_at}},
    {query=[[INSERT INTO frame_event_rules(event_id,participation_required,submission_enabled,judging_enabled,ranking_enabled,voting_enabled,awards_enabled,max_submissions,allow_submission_edit,allow_submission_delete,comment_mode,approval_mode,extra_rules) VALUES(LAST_INSERT_ID(),?,?,?,?,?,?,?,?,?,?,?,?)]],values={input.participation_required and 1 or 0,input.submission_enabled and 1 or 0,input.judging_enabled and 1 or 0,input.ranking_enabled and 1 or 0,input.voting_enabled and 1 or 0,input.awards_enabled and 1 or 0,input.max_submissions,input.allow_submission_edit and 1 or 0,input.allow_submission_delete and 1 or 0,input.comment_mode,input.approval_mode,input.extra_rules}}
  })
end
function FrameEventsRepository.PublishOwned(publicId,identifier)
 return MySQL.update.await([[UPDATE frame_events SET status=CASE WHEN starts_at IS NULL OR starts_at<=UTC_TIMESTAMP() THEN 'active' ELSE 'scheduled' END,publish_at=COALESCE(publish_at,UTC_TIMESTAMP()) WHERE public_id=? AND owner_identifier=? AND status='draft']],{publicId,identifier}) or 0
end
function FrameEventsRepository.AdvanceLifecycle()
 MySQL.update.await([[UPDATE frame_events SET status='active' WHERE status='scheduled' AND starts_at IS NOT NULL AND starts_at<=UTC_TIMESTAMP()]])
 MySQL.update.await([[UPDATE frame_events e LEFT JOIN frame_event_rules r ON r.event_id=e.id SET e.status='judging' WHERE e.status='active' AND e.submissions_close_at IS NOT NULL AND e.submissions_close_at<=UTC_TIMESTAMP() AND COALESCE(r.judging_enabled,0)=1]])
 MySQL.update.await([[UPDATE frame_events e LEFT JOIN frame_event_rules r ON r.event_id=e.id SET e.status='results' WHERE e.status='active' AND e.submissions_close_at IS NOT NULL AND e.submissions_close_at<=UTC_TIMESTAMP() AND COALESCE(r.judging_enabled,0)=0 AND e.results_at IS NOT NULL AND e.results_at<=UTC_TIMESTAMP()]])
 MySQL.update.await([[UPDATE frame_events SET status='results' WHERE status='judging' AND results_at IS NOT NULL AND results_at<=UTC_TIMESTAMP()]])
 MySQL.update.await([[UPDATE frame_events SET status='ended' WHERE status IN ('active','judging','results','scheduled') AND ends_at IS NOT NULL AND ends_at<=UTC_TIMESTAMP()]])
end
