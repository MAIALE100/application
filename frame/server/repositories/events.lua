FrameEventsRepository = {}
local LIST_SQL = [[
SELECT e.public_id,e.title,e.description,e.event_type,e.category,e.cover_media_ref,e.organizer_name,e.status,e.starts_at,e.ends_at,e.submissions_close_at,
COALESCE((SELECT COUNT(*) FROM frame_event_participants p WHERE p.event_id=e.id AND p.status='active'),0) participant_count
FROM frame_events e WHERE LOWER(TRIM(COALESCE(e.visibility,'public')))='public' AND e.status IN ('scheduled','active','judging','results','ended')
ORDER BY CASE e.status WHEN 'active' THEN 0 WHEN 'scheduled' THEN 1 WHEN 'results' THEN 2 WHEN 'judging' THEN 3 ELSE 4 END,COALESCE(e.starts_at,e.created_at) DESC LIMIT ?]]
function FrameEventsRepository.ListPublic(limit) return MySQL.query.await(LIST_SQL,{limit}) or {} end
function FrameEventsRepository.GetByPublicId(publicId)
  return MySQL.single.await([[SELECT e.*,r.participation_required,r.submission_enabled,r.judging_enabled,r.ranking_enabled,r.voting_enabled,r.awards_enabled,r.max_submissions,r.allow_submission_edit,r.allow_submission_delete,r.comment_mode,r.approval_mode,r.extra_rules, CASE WHEN (e.submissions_open_at IS NULL OR e.submissions_open_at<=UTC_TIMESTAMP()) AND (e.submissions_close_at IS NULL OR e.submissions_close_at>=UTC_TIMESTAMP()) THEN 1 ELSE 0 END AS submission_window_open FROM frame_events e LEFT JOIN frame_event_rules r ON r.event_id=e.id WHERE e.public_id=? LIMIT 1]],{publicId})
end
function FrameEventsRepository.ListOwned(identifier)
  return MySQL.query.await([[SELECT public_id,title,event_type,status,visibility,starts_at,submissions_close_at,ends_at,created_at FROM frame_events WHERE owner_identifier=? ORDER BY created_at DESC LIMIT 100]],{identifier}) or {}
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
