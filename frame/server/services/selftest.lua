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
      MySQL.insert.await([[INSERT INTO frame_event_invites(event_id,player_identifier,invited_by) VALUES(?,?,?)]],{eventId,voter,owner})
      MySQL.insert.await([[INSERT INTO frame_judges(event_id,player_identifier,assigned_by) VALUES(?,?,?)]],{eventId,voter,owner})

      local subId=MySQL.insert.await([[INSERT INTO frame_submissions(public_id,event_id,player_identifier,submission_slot,caption,status)
        VALUES(?,?,?,1,'selftest','submitted')]],{subPublic,eventId,owner})
      assert(subId,'submission insert failed')
      MySQL.insert.await([[INSERT INTO frame_submission_media(submission_id,provider,media_ref,media_type) VALUES(?,'lbphone','https://example.invalid/frame-selftest.jpg','image')]],{subId})

      local sponsorId=MySQL.insert.await([[INSERT INTO frame_sponsors(event_id,name,sort_order) VALUES(?,'FRAME Selftest Sponsor',0)]],{eventId})
      local awardId=MySQL.insert.await([[INSERT INTO frame_awards(event_id,name,description,sort_order,sponsor_id) VALUES(?,'Selftest Award','temporary',0,?)]],{eventId,sponsorId})
      MySQL.insert.await([[INSERT INTO frame_results(event_id,award_id,submission_id,placement,comment) VALUES(?,?,?,1,'selftest')]],{eventId,awardId,subId})
      MySQL.insert.await([[INSERT INTO frame_votes(event_id,submission_id,voter_identifier,score) VALUES(?,?,?,1)]],{eventId,subId,voter})
      MySQL.insert.await([[INSERT INTO frame_promotions(event_id,promotion_type,starts_at,ends_at,status,price_paid) VALUES(?,'selftest',UTC_TIMESTAMP(),UTC_TIMESTAMP()+INTERVAL 1 HOUR,'active',0)]],{eventId})
      MySQL.insert.await([[INSERT INTO frame_notification_deliveries(event_id,player_identifier,notification_type,status) VALUES(?,?,'selftest','sent')]],{eventId,owner})

      transactionId=MySQL.insert.await([[INSERT INTO frame_transactions(public_id,player_identifier,event_id,transaction_type,amount,status,idempotency_key)
        VALUES(?,?,?,'selftest',0,'completed',?)]],{('TSTTX'..stamp..string.rep('Z',26)):sub(1,26),owner,eventId,'frame-selftest-'..stamp})

      local productId=MySQL.scalar.await([[SELECT id FROM frame_ad_products ORDER BY id LIMIT 1]])
      if productId then
        adId=MySQL.insert.await([[INSERT INTO frame_ads(public_id,creator_identifier,event_id,product_id,advertiser_name,title,media_ref,link_type,link_value,starts_at,ends_at,status,price_snapshot)
          VALUES(?,?,?,?,?,'Selftest','https://example.invalid/frame-selftest.jpg','event',?,UTC_TIMESTAMP(),UTC_TIMESTAMP()+INTERVAL 1 HOUR,'active',0)]],
          {('TSTAD'..stamp..string.rep('A',26)):sub(1,26),owner,eventId,productId,'FRAME Selftest',eventPublic})
      end

      local e=FrameEventsRepository.GetByPublicId(eventPublic)
      assert(e and tonumber(e.id)==tonumber(eventId),'event fetch failed')
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
      out('PASS: create -> dependencies -> production delete -> orphan checks')
      out('PASS: transaction/ad history detached safely')
      out('No selftest event data remains.')
    else
      out('FAIL: '..tostring(err))
      if eventId then out('Temporary event id='..tostring(eventId)..' may need inspection.') end
    end
  end)
end,false)
