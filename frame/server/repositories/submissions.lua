FrameSubmissionsRepository={}
function FrameSubmissionsRepository.Join(eventId,identifier)
 return MySQL.insert.await([[INSERT INTO frame_event_participants(event_id,player_identifier,status) VALUES(?,?,'active') ON DUPLICATE KEY UPDATE status='active']],{eventId,identifier}) ~= nil
end
function FrameSubmissionsRepository.ListMine(eventId,identifier)
 return MySQL.query.await([[SELECT s.public_id,s.caption,s.status,s.submitted_at,m.media_ref FROM frame_submissions s LEFT JOIN frame_submission_media m ON m.submission_id=s.id WHERE s.event_id=? AND s.player_identifier=? ORDER BY s.submitted_at DESC]],{eventId,identifier}) or {}
end
function FrameSubmissionsRepository.InsertAtSlot(eventId,identifier,slot,publicId,caption,mediaRef)
 local id=MySQL.insert.await([[INSERT IGNORE INTO frame_submissions(public_id,event_id,player_identifier,submission_slot,caption,status) VALUES(?,?,?,?,?,'submitted')]],{publicId,eventId,identifier,slot,caption})
 if not id or id==0 then return false end
 local media=MySQL.insert.await([[INSERT INTO frame_submission_media(submission_id,provider,media_ref,media_type) VALUES(?,'lbphone',?,'image')]],{id,mediaRef})
 if not media then MySQL.query.await('DELETE FROM frame_submissions WHERE id=?',{id}); return false end
 return true
end
