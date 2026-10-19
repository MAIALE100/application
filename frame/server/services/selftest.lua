local SELFTEST_ACTOR='__frame_selftest__'

local function out(msg)
  print('[FRAME SELFTEST] '..tostring(msg))
end

local function scalar(sql,values)
  return tonumber(MySQL.scalar.await(sql,values or {}) or 0)
end

RegisterCommand('frame_selftest',function(source)
  if source~=0 then
    out('DENIED: run frame_selftest from the txAdmin/server console.')
    return
  end

  CreateThread(function()
    out('Starting destructive-isolated integration test...')
    local stamp=tostring(os.time())
    local eventPublic=('SELFTEST'..string.rep('0',18)..stamp):sub(-26)
    eventPublic=('SELFTEST'..stamp..string.rep('X',26)):sub(1,26)
    local subPublic=('SELFTESTSUB'..stamp..string.rep('Y',26)):sub(1,26)
    local owner=SELFTEST_ACTOR..':'..stamp
    local voter=SELFTEST_ACTOR..':voter:'..stamp

    local eventId=nil
    local transactionId=nil
    local adId=nil
    local ok,err=pcall(function()
      eventId=MySQL.insert.await([[INSERT INTO frame_events(public_id,owner_identifier,organizer_name,title,description,event_type,category,visibility,status)
        VALUES(?,?,?,?,?,'contest','selftest','public','active')]],{eventPublic,owner,'FRAME Selftest','FRAME Selftest','temporary integration test'})
      assert(eventId,'event insert failed')

      MySQL.insert.await([[INSERT INTO frame_event_rules(event_id,participation_required,submission_enabled,judging_enabled,voting_enabled,awards_enabled,max_submissions,allow_submission_delete)
        VALUES(?,1,1,1,1,1,2,1)]],{eventId})
      MySQL.insert.await([[INSERT INTO frame_event_participants(event_id,player_identifier,status) VALUES(?,?,'active')]],{eventId,owner})
      MySQL.insert.await([[INSERT INTO frame_event_access_rules(event_id,rule_type,rule_value) VALUES(?,'job','selftest')]],{eventId})
      MySQL.insert.await([[INSERT INTO frame_event_favorites(event_id,player_identifier) VALUES(?,?)]],{eventId,owner})
      MySQL.insert.await([[INSERT INTO frame_event_collaborators(event_id,player_identifier,display_name,phone_number,added_by)
        VALUES(?,?,?,'0000000000',?)]],{eventId,voter,'FRAME Selftest Co-Organizer',owner})
      assert(scalar([[SELECT COUNT(*) FROM frame_event_collaborators WHERE event_id=?]],{eventId})==1,'collaborator insert failed')
      local duplicateCollaboratorAccepted=pcall(function()
        MySQL.insert.await([[INSERT INTO frame_event_collaborators(event_id,player_identifier,display_name,phone_number,added_by)
          VALUES(?,?,?,'0000000000',?)]],{eventId,voter,'FRAME Selftest Duplicate',owner})
      end)
      assert(not duplicateCollaboratorAccepted,'duplicate collaborator constraint missing')
      MySQL.insert.await([[INSERT INTO frame_event_invites(event_id,player_identifier,invited_by) VALUES(?,?,?)]],{eventId,voter,owner})
      MySQL.insert.await([[INSERT INTO frame_judges(event_id,player_identifier,assigned_by) VALUES(?,?,?)]],{eventId,voter,owner})

      local subId=MySQL.insert.await([[INSERT INTO frame_submissions(public_id,event_id,player_identifier,submission_slot,caption,status)
        VALUES(?,?,?,1,'selftest','submitted')]],{subPublic,eventId,owner})
      assert(subId,'submission insert failed')
      assert(scalar([[SELECT COUNT(*) FROM frame_event_participants WHERE event_id=? AND status='active']],{eventId})==1,'participant aggregate failed')
      assert(scalar([[SELECT COUNT(*) FROM frame_event_favorites WHERE event_id=?]],{eventId})==1,'favorite aggregate failed')
      assert(scalar([[SELECT COUNT(*) FROM frame_submissions WHERE event_id=? AND status='submitted']],{eventId})==1,'submission aggregate failed')
      MySQL.insert.await([[INSERT INTO frame_submission_media(submission_id,provider,media_ref,media_type) VALUES(?,'lbphone','https://example.invalid/frame-selftest.jpg','image')]],{subId})

      local sponsorId=MySQL.insert.await([[INSERT INTO frame_sponsors(event_id,name,sort_order) VALUES(?,'FRAME Selftest Sponsor',0)]],{eventId})
      local awardId=MySQL.insert.await([[INSERT INTO frame_awards(event_id,name,description,sort_order,sponsor_id) VALUES(?,'Selftest Award','temporary',0,?)]],{eventId,sponsorId})
      MySQL.insert.await([[INSERT INTO frame_results(event_id,award_id,submission_id,placement,comment) VALUES(?,?,?,1,'selftest')]],{eventId,awardId,subId})
      MySQL.insert.await([[INSERT INTO frame_votes(event_id,submission_id,voter_identifier,score) VALUES(?,?,?,1)]],{eventId,subId,voter})
      assert(scalar([[SELECT COUNT(*) FROM frame_votes WHERE event_id=?]],{eventId})==1,'vote aggregate failed')
      local duplicateVoteAccepted=pcall(function()
        MySQL.insert.await([[INSERT INTO frame_votes(event_id,submission_id,voter_identifier,score) VALUES(?,?,?,1)]],{eventId,subId,voter})
      end)
      assert(not duplicateVoteAccepted,'duplicate vote constraint missing')
      MySQL.insert.await([[INSERT INTO frame_promotions(event_id,promotion_type,starts_at,ends_at,status,price_paid) VALUES(?,'selftest',UTC_TIMESTAMP(),UTC_TIMESTAMP()+INTERVAL 1 HOUR,'active',0)]],{eventId})
      MySQL.insert.await([[INSERT INTO frame_notification_deliveries(event_id,player_identifier,notification_type,status) VALUES(?,?,'selftest','sent')]],{eventId,owner})

      transactionId=MySQL.insert.await([[INSERT INTO frame_transactions(public_id,player_identifier,event_id,transaction_type,amount,status,idempotency_key)
        VALUES(?,?,?,'selftest',0,'completed',?)]],{('TSTTX'..stamp..string.rep('Z',26)):sub(1,26),owner,eventId,'frame-selftest-'..stamp})

      local productId=MySQL.scalar.await([[SELECT id FROM frame_ad_products ORDER BY id LIMIT 1]])
      if productId then
        adId=MySQL.insert.await([[INSERT INTO frame_ads(public_id,creator_identifier,event_id,product_id,advertiser_name,title,media_ref,link_type,link_value,starts_at,ends_at,status,price_snapshot)
          VALUES(?,?,?,?,?,'Selftest','https://example.invalid/frame-selftest.jpg','event',?,UTC_TIMESTAMP()+INTERVAL 10 MINUTE,UTC_TIMESTAMP()+INTERVAL 1 HOUR,'scheduled',0)]],
          {('TSTAD'..stamp..string.rep('A',26)):sub(1,26),owner,eventId,productId,'FRAME Selftest',eventPublic})
        assert(adId,'ad insert failed')

        MySQL.update.await([[UPDATE frame_ads SET starts_at=UTC_TIMESTAMP()-INTERVAL 1 MINUTE,ends_at=UTC_TIMESTAMP()+INTERVAL 1 HOUR,status='scheduled' WHERE id=?]],{adId})
        FrameAds.Advance()
        assert(MySQL.scalar.await([[SELECT status FROM frame_ads WHERE id=?]],{adId})=='active','ad scheduled -> active transition failed')

        MySQL.update.await([[UPDATE frame_ads SET ends_at=UTC_TIMESTAMP()-INTERVAL 1 MINUTE,status='active' WHERE id=?]],{adId})
        FrameAds.Advance()
        assert(MySQL.scalar.await([[SELECT status FROM frame_ads WHERE id=?]],{adId})=='ended','ad active -> ended transition failed')
      end

      local e=FrameEventsRepository.GetByPublicId(eventPublic)
      assert(e and tonumber(e.id)==tonumber(eventId),'event fetch failed')
      assert(FramePermissions.CanManageEvent(owner,e,nil)==true,'owner manage permission failed')
      assert(FramePermissions.CanShareEvent(owner,e,nil)==true,'owner share permission failed')
      assert(FramePermissions.IsCollaborator(voter,e)==true,'collaborator recognition failed')
      assert(FramePermissions.CanManageEvent(voter,e,nil)==true,'collaborator manage permission failed')
      assert(FramePermissions.CanShareEvent(voter,e,nil)==false,'collaborator must not grant collaborators')
      local deleted=FrameEventsService.DeleteInternal(e,SELFTEST_ACTOR,true)
      assert(deleted and deleted.ok,'DeleteInternal failed: '..tostring(deleted and deleted.error))

      assert(scalar([[SELECT COUNT(*) FROM frame_events WHERE id=?]],{eventId})==0,'event remains')
      assert(scalar([[SELECT COUNT(*) FROM frame_event_rules WHERE event_id=?]],{eventId})==0,'rules remain')
      assert(scalar([[SELECT COUNT(*) FROM frame_event_participants WHERE event_id=?]],{eventId})==0,'participants remain')
      assert(scalar([[SELECT COUNT(*) FROM frame_submissions WHERE event_id=?]],{eventId})==0,'submissions remain')
      assert(scalar([[SELECT COUNT(*) FROM frame_results WHERE event_id=?]],{eventId})==0,'results remain')
      assert(scalar([[SELECT COUNT(*) FROM frame_votes WHERE event_id=?]],{eventId})==0,'votes remain')
      assert(scalar([[SELECT COUNT(*) FROM frame_awards WHERE event_id=?]],{eventId})==0,'awards remain')
      assert(scalar([[SELECT COUNT(*) FROM frame_sponsors WHERE event_id=?]],{eventId})==0,'sponsors remain')
      assert(scalar([[SELECT COUNT(*) FROM frame_event_favorites WHERE event_id=?]],{eventId})==0,'favorites remain')
      assert(scalar([[SELECT COUNT(*) FROM frame_event_collaborators WHERE event_id=?]],{eventId})==0,'collaborator cleanup failed')
      assert(scalar([[SELECT COUNT(*) FROM frame_notification_deliveries WHERE event_id=?]],{eventId})==0,'notifications remain')

      if transactionId then
        assert(scalar([[SELECT COUNT(*) FROM frame_transactions WHERE id=? AND event_id IS NULL]],{transactionId})==1,'transaction event link remains')
      end
      if adId then
        assert(scalar([[SELECT COUNT(*) FROM frame_ads WHERE id=? AND event_id IS NULL]],{adId})==1,'ad event link remains')
      end
    end)

    if transactionId then MySQL.update.await([[DELETE FROM frame_transactions WHERE id=?]],{transactionId}) end
    if adId then MySQL.update.await([[DELETE FROM frame_ads WHERE id=?]],{adId}) end
    MySQL.update.await([[DELETE FROM frame_audit_logs WHERE actor_identifier LIKE ?]],{SELFTEST_ACTOR..'%'})

    if ok then
      out('PASS: owner/collaborator permission boundaries and unique membership')
      out('PASS: participant/favorite/submission/vote/collaborator aggregates')
      out('PASS: one-vote-per-event database constraint')
      out('PASS: create -> dependencies -> production delete -> orphan checks')
      out('PASS: advertisement scheduled -> active -> ended lifecycle')
      out('PASS: transaction/ad history detached safely')
      out('No selftest event data remains.')
    else
      out('FAIL: '..tostring(err))
      if eventId then out('Temporary event id='..tostring(eventId)..' may need inspection.') end
    end
  end)
end,false)


local DEV_CATEGORY='__frame_dev__'

local function devOut(msg)
  print('[FRAME DEV] '..tostring(msg))
end

local function resolveDevPlayer(arg)
  local sid=tonumber(arg)
  if sid and sid>0 and GetPlayerName(sid) then return sid end
  local players=GetPlayers()
  if #players==1 then return tonumber(players[1]) end
  if #players==0 then return nil,'NO_PLAYERS' end
  return nil,'MULTIPLE_PLAYERS'
end

local function makePublic(prefix,stamp,n)
  local raw=tostring(prefix)..tostring(stamp)..tostring(n)
  if #raw<26 then raw=raw..string.rep('X',26-#raw) end
  return raw:sub(1,26)
end

local function latestMedia()
  local row=MySQL.single.await([[SELECT media_ref FROM frame_submission_media ORDER BY id DESC LIMIT 1]])
  return row and row.media_ref or nil
end

local function insertDevEvent(owner,name,title,status,stamp,n,mediaRef)
  local publicId=makePublic('DEV',stamp,n)
  local eventId=MySQL.insert.await([[INSERT INTO frame_events(
    public_id,owner_identifier,organizer_name,organizer_type,title,description,event_type,category,cover_media_ref,visibility,status,
    starts_at,submissions_open_at,submissions_close_at,judging_starts_at,results_at,ends_at
  ) VALUES(?,?,?,'individual',?,?, 'contest',?,?, 'public',?,
    UTC_TIMESTAMP()-INTERVAL 1 HOUR,
    UTC_TIMESTAMP()-INTERVAL 1 HOUR,
    UTC_TIMESTAMP()+INTERVAL 2 HOUR,
    UTC_TIMESTAMP()+INTERVAL 2 HOUR,
    CASE WHEN ?='results' THEN UTC_TIMESTAMP() ELSE NULL END,
    UTC_TIMESTAMP()+INTERVAL 4 HOUR)]],
    {publicId,owner,name,title,'FRAME開発用の自動生成イベントです。',DEV_CATEGORY,mediaRef,status,status})
  assert(eventId,'dev event insert failed')

  MySQL.insert.await([[INSERT INTO frame_event_rules(
    event_id,participation_required,submission_enabled,judging_enabled,ranking_enabled,voting_enabled,awards_enabled,max_submissions,
    allow_submission_edit,allow_submission_delete,comment_mode,approval_mode
  ) VALUES(?,1,1,1,1,1,1,3,0,1,'optional','auto')]],{eventId})

  local fake1='frame_dev:citizen:a:'..stamp..':'..n
  local fake2='frame_dev:citizen:b:'..stamp..':'..n
  MySQL.insert.await([[INSERT INTO frame_event_participants(event_id,player_identifier,status) VALUES(?,?,'active'),(?,?,'active'),(?,?,'active')]],
    {eventId,owner,eventId,fake1,eventId,fake2})
  MySQL.insert.await([[INSERT INTO frame_event_favorites(event_id,player_identifier) VALUES(?,?)]],{eventId,owner})

  local subIds={}
  local subPublics={}
  if mediaRef then
    for i,who in ipairs({fake1,fake2}) do
      local sp=makePublic('DEVSUB',stamp,n*10+i)
      local sid=MySQL.insert.await([[INSERT INTO frame_submissions(public_id,event_id,player_identifier,submission_slot,caption,status)
        VALUES(?,?,?,1,?,'submitted')]],{sp,eventId,who,'DEV応募作品 '..i})
      MySQL.insert.await([[INSERT INTO frame_submission_media(submission_id,provider,media_ref,media_type) VALUES(?,'lbphone',?,'image')]],{sid,mediaRef})
      subIds[#subIds+1]=sid
      subPublics[#subPublics+1]=sp
    end
  end

  local sponsorId=MySQL.insert.await([[INSERT INTO frame_sponsors(event_id,name,sort_order) VALUES(?,'Weazel News DEV',0)]],{eventId})
  local awardId=MySQL.insert.await([[INSERT INTO frame_awards(event_id,name,description,prize_text,sort_order,sponsor_id)
    VALUES(?,'DEVグランプリ','開発確認用の賞です。','テスト賞品',1,?)]],{eventId,sponsorId})

  if #subIds>0 then
    MySQL.insert.await([[INSERT INTO frame_votes(event_id,submission_id,voter_identifier,score) VALUES(?,?,?,1)]],{eventId,subIds[1],owner})
    MySQL.insert.await([[INSERT INTO frame_votes(event_id,submission_id,voter_identifier,score) VALUES(?,?,?,1)]],{eventId,subIds[1],'frame_dev:voter:'..stamp..':'..n})
    if status=='judging' or status=='results' then
      MySQL.insert.await([[INSERT INTO frame_results(event_id,award_id,submission_id,placement,comment)
        VALUES(?,?,?,1,'DEV自動選出')]],{eventId,awardId,subIds[1]})
    end
  end

  return {id=eventId,public_id=publicId,status=status}
end

RegisterCommand('frame_dev_seed',function(source,args)
  if source~=0 then
    devOut('DENIED: run frame_dev_seed from the txAdmin/server console.')
    return
  end
  CreateThread(function()
    local target,why=resolveDevPlayer(args and args[1])
    if not target then
      if why=='MULTIPLE_PLAYERS' then devOut('Multiple players online. Use: frame_dev_seed <serverId>') else devOut('No online player found.') end
      return
    end
    local owner=FrameFramework.GetIdentifier(target)
    if not owner then devOut('Could not resolve player identifier for server id '..tostring(target)); return end
    local name=FrameFramework.GetCharacterName(target) or GetPlayerName(target) or ('Player '..target)
    local stamp=os.time()
    local mediaRef=latestMedia()

    local ok,res=pcall(function()
      local made={}
      made[#made+1]=insertDevEvent(owner,name,'[DEV] 開催中フォトコンテスト','active',stamp,1,mediaRef)
      made[#made+1]=insertDevEvent(owner,name,'[DEV] 審査中フォトコンテスト','judging',stamp,2,mediaRef)
      made[#made+1]=insertDevEvent(owner,name,'[DEV] 結果発表フォトコンテスト','results',stamp,3,mediaRef)
      return made
    end)
    if not ok then devOut('SEED FAILED: '..tostring(res)); return end
    devOut(('Seeded %d events for %s (server id %s).'):format(#res,name,target))
    if mediaRef then
      devOut('Reused the latest existing LB Phone image for submission cards.')
    else
      devOut('No existing submission image was found; events were created without sample submissions.')
    end
    devOut('Open FRAME -> 主催 / イベント to test the UI. Cleanup: frame_dev_clean '..tostring(target))
  end)
end,false)

RegisterCommand('frame_dev_clean',function(source,args)
  if source~=0 then
    devOut('DENIED: run frame_dev_clean from the txAdmin/server console.')
    return
  end
  CreateThread(function()
    local target,why=resolveDevPlayer(args and args[1])
    if not target then
      if why=='MULTIPLE_PLAYERS' then devOut('Multiple players online. Use: frame_dev_clean <serverId>') else devOut('No online player found.') end
      return
    end
    local owner=FrameFramework.GetIdentifier(target)
    if not owner then devOut('Could not resolve player identifier for server id '..tostring(target)); return end
    local rows=MySQL.query.await([[SELECT public_id FROM frame_events WHERE owner_identifier=? AND category=? ORDER BY id]],{owner,DEV_CATEGORY}) or {}
    if #rows==0 then devOut('No FRAME DEV events found for this player.'); return end

    local deleted,failed=0,0
    for _,row in ipairs(rows) do
      local e=FrameEventsRepository.GetByPublicId(row.public_id)
      if e then
        local r=FrameEventsService.DeleteInternal(e,'__frame_dev_clean__',true)
        if r and r.ok then deleted=deleted+1 else failed=failed+1 end
      end
    end
    MySQL.update.await([[DELETE FROM frame_audit_logs WHERE actor_identifier='__frame_dev_clean__']])
    devOut(('Cleanup complete. deleted=%d failed=%d'):format(deleted,failed))
  end)
end,false)


RegisterCommand('frame_dev_clean_all',function(source)
  if source~=0 then
    devOut('DENIED: run frame_dev_clean_all from the txAdmin/server console.')
    return
  end
  CreateThread(function()
    local rows=MySQL.query.await([[SELECT public_id FROM frame_events WHERE category=? ORDER BY id]],{DEV_CATEGORY}) or {}
    if #rows==0 then devOut('No FRAME DEV events exist.'); return end
    local deleted,failed=0,0
    for _,row in ipairs(rows) do
      local e=FrameEventsRepository.GetByPublicId(row.public_id)
      if e then
        local r=FrameEventsService.DeleteInternal(e,'__frame_dev_clean_all__',true)
        if r and r.ok then deleted=deleted+1 else failed=failed+1 end
      end
    end
    MySQL.update.await([[DELETE FROM frame_audit_logs WHERE actor_identifier='__frame_dev_clean_all__']])
    devOut(('Global DEV cleanup complete. deleted=%d failed=%d'):format(deleted,failed))
  end)
end,false)


RegisterCommand('frame_retention_status',function(source)
  if source~=0 then
    devOut('DENIED: run frame_retention_status from the txAdmin/server console.')
    return
  end
  CreateThread(function()
    local months=math.max(1,math.min(24,tonumber(FrameConfig.RetentionMonths) or 2))
    local sql=([[SELECT public_id,title,status,created_at,
      DATE_ADD(created_at,INTERVAL %d MONTH) AS delete_at,
      TIMESTAMPDIFF(DAY,UTC_TIMESTAMP(),DATE_ADD(created_at,INTERVAL %d MONTH)) AS days_left
      FROM frame_events
      ORDER BY delete_at ASC
      LIMIT 50]]):format(months,months)
    local rows=MySQL.query.await(sql) or {}
    devOut(('Retention policy: %d month(s). Showing %d event(s).'):format(months,#rows))
    if #rows==0 then
      devOut('No FRAME events exist.')
      return
    end
    for _,row in ipairs(rows) do
      local days=tonumber(row.days_left)
      local state=(days and days<0) and 'DELETE_PENDING' or ((days and days<=7) and 'EXPIRING' or 'OK')
      devOut(('[%s] %s | %s | days_left=%s | delete_at=%s | %s'):format(
        tostring(row.public_id),tostring(row.title),tostring(row.status),tostring(days),tostring(row.delete_at),state))
    end
  end)
end,false)


RegisterCommand('frame_healthcheck',function(source)
  if source~=0 then
    devOut('DENIED: run frame_healthcheck from the txAdmin/server console.')
    return
  end
  CreateThread(function()
    local checks={
      {'events_without_rules',[[SELECT COUNT(*) FROM frame_events e LEFT JOIN frame_event_rules r ON r.event_id=e.id WHERE r.event_id IS NULL]]},
      {'submissions_without_event',[[SELECT COUNT(*) FROM frame_submissions s LEFT JOIN frame_events e ON e.id=s.event_id WHERE e.id IS NULL]]},
      {'media_without_submission',[[SELECT COUNT(*) FROM frame_submission_media m LEFT JOIN frame_submissions s ON s.id=m.submission_id WHERE s.id IS NULL]]},
      {'collaborators_without_event',[[SELECT COUNT(*) FROM frame_event_collaborators c LEFT JOIN frame_events e ON e.id=c.event_id WHERE e.id IS NULL]]},
      {'collaborator_is_owner',[[SELECT COUNT(*) FROM frame_event_collaborators c JOIN frame_events e ON e.id=c.event_id WHERE c.player_identifier=e.owner_identifier]]},
      {'votes_without_event',[[SELECT COUNT(*) FROM frame_votes v LEFT JOIN frame_events e ON e.id=v.event_id WHERE e.id IS NULL]]},
      {'results_without_event',[[SELECT COUNT(*) FROM frame_results r LEFT JOIN frame_events e ON e.id=r.event_id WHERE e.id IS NULL]]},
      {'result_award_event_mismatch',[[SELECT COUNT(*) FROM frame_results r JOIN frame_awards a ON a.id=r.award_id WHERE r.award_id IS NOT NULL AND r.event_id<>a.event_id]]},
      {'result_submission_event_mismatch',[[SELECT COUNT(*) FROM frame_results r JOIN frame_submissions s ON s.id=r.submission_id WHERE r.event_id<>s.event_id]]},
      {'award_sponsor_event_mismatch',[[SELECT COUNT(*) FROM frame_awards a JOIN frame_sponsors s ON s.id=a.sponsor_id WHERE a.sponsor_id IS NOT NULL AND a.event_id<>s.event_id]]},
      {'notifications_without_event',[[SELECT COUNT(*) FROM frame_notification_deliveries n LEFT JOIN frame_events e ON e.id=n.event_id WHERE e.id IS NULL]]},
      {'stale_notification_claims',[[SELECT COUNT(*) FROM frame_notification_deliveries WHERE status='pending' AND attempted_at<UTC_TIMESTAMP()-INTERVAL 15 MINUTE]]},
      {'ad_invalid_window',[[SELECT COUNT(*) FROM frame_ads WHERE starts_at>=ends_at]]},
      {'ad_active_expired',[[SELECT COUNT(*) FROM frame_ads WHERE status='active' AND ends_at<=UTC_TIMESTAMP()-INTERVAL 2 MINUTE]]},
      {'ad_scheduled_past_start',[[SELECT COUNT(*) FROM frame_ads WHERE status='scheduled' AND starts_at<=UTC_TIMESTAMP()-INTERVAL 2 MINUTE AND ends_at>UTC_TIMESTAMP()]]},
      {'ad_processing_stale',[[SELECT COUNT(*) FROM frame_ads WHERE status='processing' AND updated_at<UTC_TIMESTAMP()-INTERVAL 15 MINUTE]]},
      {'ad_stats_without_ad',[[SELECT COUNT(*) FROM frame_ad_daily_stats s LEFT JOIN frame_ads a ON a.id=s.ad_id WHERE a.id IS NULL]]},
      {'ad_missing_product',[[SELECT COUNT(*) FROM frame_ads a LEFT JOIN frame_ad_products p ON p.id=a.product_id WHERE p.id IS NULL]]},
      {'ad_event_link_mismatch',[[SELECT COUNT(*) FROM frame_ads a JOIN frame_events e ON e.id=a.event_id WHERE a.link_type='event' AND COALESCE(a.link_value,'')<>e.public_id]]},
      {'ad_promoted_event_invalid',[[SELECT COUNT(*) FROM frame_ads a JOIN frame_ad_products p ON p.id=a.product_id LEFT JOIN frame_events e ON e.id=a.event_id WHERE a.status IN ('active','scheduled') AND p.placement IN ('featured','top_placement','category_banner') AND (e.id IS NULL OR e.visibility<>'public' OR e.status IN ('draft','cancelled','ended'))]]},
      {'stuck_event_lifecycle',[[SELECT COUNT(*) FROM frame_events e LEFT JOIN frame_event_rules r ON r.event_id=e.id WHERE e.status='active' AND e.submissions_close_at IS NOT NULL AND e.submissions_close_at<UTC_TIMESTAMP()-INTERVAL 5 MINUTE AND (COALESCE(r.judging_enabled,0)=1 OR (COALESCE(r.judging_enabled,0)=0 AND e.results_at IS NOT NULL AND e.results_at<=UTC_TIMESTAMP()))]]}
    }
    local warnings=0
    devOut('Healthcheck starting...')
    for _,check in ipairs(checks) do
      local count=scalar(check[2])
      if count>0 then
        warnings=warnings+1
        devOut(('WARN: %s = %d'):format(check[1],count))
      else
        devOut(('PASS: %s = 0'):format(check[1]))
      end
    end

    local collaboratorMax=math.max(1,math.min(50,tonumber(FrameConfig.CollaboratorMax) or 10))
    local overLimitSql=('SELECT COUNT(*) FROM (SELECT event_id FROM frame_event_collaborators GROUP BY event_id HAVING COUNT(*)>%d) x'):format(collaboratorMax)
    local overLimit=scalar(overLimitSql)
    if overLimit>0 then
      warnings=warnings+1
      devOut(('WARN: collaborator_limit_exceeded = %d event(s)'):format(overLimit))
    else
      devOut('PASS: collaborator_limit_exceeded = 0')
    end

    local months=math.max(1,math.min(24,tonumber(FrameConfig.RetentionMonths) or 2))
    local expiredSql=('SELECT COUNT(*) FROM frame_events WHERE created_at<=DATE_SUB(UTC_TIMESTAMP(),INTERVAL %d MONTH)'):format(months)
    local expired=scalar(expiredSql)
    if expired>0 then
      warnings=warnings+1
      devOut(('WARN: retention_delete_pending = %d'):format(expired))
    else
      devOut('PASS: retention_delete_pending = 0')
    end

    if warnings==0 then
      devOut('HEALTHCHECK PASS: no integrity warnings.')
    else
      devOut(('HEALTHCHECK WARN: %d check(s) need attention.'):format(warnings))
    end
  end)
end,false)
