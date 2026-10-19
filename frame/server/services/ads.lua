FrameAds={}

local function pid()
 local t,c={},'0123456789ABCDEFGHJKMNPQRSTVWXYZ'
 for i=1,26 do local n=math.random(1,#c);t[i]=c:sub(n,n) end
 return table.concat(t)
end

local function id(src) return FrameFramework.GetIdentifier(src) end

local function notifyIdentifier(identifier,title,content)
 if not identifier then return end
 pcall(function()
  local phone=exports['lb-phone']:GetEquippedPhoneNumber(identifier)
  if phone then exports['lb-phone']:SendNotification(phone,{app='frame',title=title,content=content}) end
 end)
end

local function getProduct(code)
 return MySQL.single.await([[SELECT id,code,name,placement,base_price,duration_hours,requires_review
   FROM frame_ad_products WHERE code=? AND active=1 LIMIT 1]],{code})
end

function FrameAds.Products(src)
 if not id(src) then return {ok=false,error='PLAYER_NOT_READY'} end
 return {ok=true,products=MySQL.query.await([[SELECT code,name,placement,base_price,duration_hours,requires_review
   FROM frame_ad_products WHERE active=1 ORDER BY id]]) or {}}
end

function FrameAds.Mine(src)
 local who=id(src); if not who then return {ok=false,error='PLAYER_NOT_READY'} end
 local rows=MySQL.query.await([[SELECT
   a.public_id,a.advertiser_name,a.title,a.media_ref,a.link_type,a.link_value,
   a.starts_at,a.ends_at,a.status,a.review_reason,a.reviewed_at,a.price_snapshot,a.created_at,
   p.code product_code,p.name product_name,p.placement,p.duration_hours,
   e.public_id event_public_id,e.title event_title,e.category event_category,
   COALESCE((SELECT SUM(s.impressions) FROM frame_ad_daily_stats s WHERE s.ad_id=a.id),0) impressions,
   COALESCE((SELECT SUM(s.clicks) FROM frame_ad_daily_stats s WHERE s.ad_id=a.id),0) clicks
   FROM frame_ads a
   JOIN frame_ad_products p ON p.id=a.product_id
   LEFT JOIN frame_events e ON e.id=a.event_id
   WHERE a.creator_identifier=?
   ORDER BY a.created_at DESC
   LIMIT 100]],{who}) or {}
 return {ok=true,ads=rows}
end

function FrameAds.Create(src,d)
 local who=id(src); d=type(d)=='table' and d or {}
 if not who then return {ok=false,error='PLAYER_NOT_READY'} end
 if not FramePermissions.IsOrganizer(who) and not FramePermissions.IsStaff(who,src) then return {ok=false,error='ORGANIZER_REQUIRED'} end

 local p=getProduct(d.product_code); if not p then return {ok=false,error='INVALID_PRODUCT'} end
 local media=type(d.media_ref)=='string' and d.media_ref or ''
 if #media<8 or #media>1024 or not media:match('^https://') then return {ok=false,error='INVALID_MEDIA'} end

 local advertiser=type(d.advertiser_name)=='string' and d.advertiser_name:sub(1,120) or ''
 advertiser=advertiser:gsub('^%s+',''):gsub('%s+$','')
 if advertiser=='' then return {ok=false,error='ADVERTISER_REQUIRED'} end

 local title=type(d.title)=='string' and d.title:sub(1,160) or ''
 title=title:gsub('^%s+',''):gsub('%s+$','')
 if title=='' then return {ok=false,error='AD_TITLE_REQUIRED'} end

 local eventId,eventPublic=nil,nil
 if d.event_public_id and tostring(d.event_public_id)~='' then
  local e=FrameEventsRepository.GetByPublicId(tostring(d.event_public_id))
  if not e or not FramePermissions.CanManageEvent(who,e,src) then return {ok=false,error='INVALID_EVENT'} end
  if e.visibility~='public' or not ({scheduled=true,active=true,judging=true,results=true})[e.status] then
   return {ok=false,error='AD_EVENT_NOT_PROMOTABLE'}
  end
  eventId=e.id
  eventPublic=e.public_id
 end

 if (p.placement=='featured' or p.placement=='top_placement' or p.placement=='category_banner') and not eventId then
  return {ok=false,error='AD_EVENT_REQUIRED'}
 end

 local start=type(d.starts_at)=='string' and d.starts_at:gsub('T',' '):sub(1,19) or nil
 if not start or #start<16 then return {ok=false,error='INVALID_WINDOW'} end

 local finish=nil
 if tonumber(p.duration_hours) and tonumber(p.duration_hours)>0 then
  finish=MySQL.scalar.await([[SELECT DATE_ADD(?,INTERVAL ? HOUR)]],{start,tonumber(p.duration_hours)})
 else
  finish=type(d.ends_at)=='string' and d.ends_at:gsub('T',' '):sub(1,19) or nil
 end
 if not finish or start>=tostring(finish) then return {ok=false,error='INVALID_WINDOW'} end

 local validWindow=tonumber(MySQL.scalar.await([[SELECT CASE WHEN ?>UTC_TIMESTAMP()-INTERVAL 5 MINUTE AND ?>UTC_TIMESTAMP() THEN 1 ELSE 0 END]],{finish,finish}) or 0)
 if validWindow~=1 then return {ok=false,error='INVALID_WINDOW'} end

 local requiresReview=tonumber(p.requires_review or 1)==1 or tonumber(p.base_price or 0)>0
 local status='pending_review'
 if not requiresReview then
  status=MySQL.scalar.await([[SELECT CASE WHEN ?>UTC_TIMESTAMP() THEN 'scheduled' ELSE 'active' END]],{start}) or 'scheduled'
 end
 local linkType=eventId and 'event' or 'none'
 local linkValue=eventId and eventPublic or nil
 local pub=pid()

 local n=MySQL.insert.await([[INSERT INTO frame_ads(
   public_id,creator_identifier,event_id,product_id,advertiser_name,title,media_ref,link_type,link_value,
   starts_at,ends_at,status,price_snapshot)
   VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)]],
   {pub,who,eventId,p.id,advertiser,title,media,linkType,linkValue,start,finish,status,p.base_price})
 if not n then return {ok=false,error='DATABASE_ERROR'} end

 MySQL.insert.await([[INSERT INTO frame_audit_logs(actor_identifier,action,entity_type,entity_id,event_id)
   VALUES(?,'AD_CREATE','ad',?,?)]],{who,pub,eventId})
 return {ok=true,public_id=pub,status=status,price=p.base_price,ends_at=finish}
end

function FrameAds.Withdraw(src,d)
 local who=id(src); if not who then return {ok=false,error='PLAYER_NOT_READY'} end
 local publicId=type(d)=='table' and tostring(d.public_id or '') or ''
 local ad=MySQL.single.await([[SELECT id,event_id,status FROM frame_ads
   WHERE public_id=? AND creator_identifier=? LIMIT 1]],{publicId,who})
 if not ad then return {ok=false,error='NOT_FOUND'} end
 if ad.status~='pending_review' then return {ok=false,error='AD_WITHDRAW_NOT_ALLOWED'} end
 local n=MySQL.update.await([[UPDATE frame_ads SET status='cancelled',review_reason='申請者により取消'
   WHERE id=? AND creator_identifier=? AND status='pending_review']],{ad.id,who}) or 0
 if n<1 then return {ok=false,error='STATE_CHANGED'} end
 MySQL.insert.await([[INSERT INTO frame_audit_logs(actor_identifier,action,entity_type,entity_id,event_id)
   VALUES(?,'AD_WITHDRAW','ad',?,?)]],{who,publicId,ad.event_id})
 return {ok=true,status='cancelled'}
end

function FrameAds.Review(src,d)
 local who=id(src); if not FramePermissions.IsStaff(who,src) then return {ok=false,error='FORBIDDEN'} end
 d=type(d)=='table' and d or {}
 local decision=d.decision=='approve' and 'approve' or (d.decision=='reject' and 'reject' or nil)
 if not decision then return {ok=false,error='INVALID_DECISION'} end

 local ad=MySQL.single.await([[SELECT a.*,p.name product_name FROM frame_ads a
   JOIN frame_ad_products p ON p.id=a.product_id
   WHERE a.public_id=? AND a.status='pending_review' LIMIT 1]],{d.public_id})
 if not ad then return {ok=false,error='NOT_PENDING'} end

 local expired=tonumber(MySQL.scalar.await([[SELECT CASE WHEN ends_at<=UTC_TIMESTAMP() THEN 1 ELSE 0 END FROM frame_ads WHERE id=?]],{ad.id}) or 0)==1
 if expired then
  local reason='審査中に掲載期間が終了しました。'
  MySQL.update.await([[UPDATE frame_ads SET status='rejected',reviewed_by=?,reviewed_at=UTC_TIMESTAMP(),review_reason=? WHERE id=? AND status='pending_review']],{who,reason,ad.id})
  MySQL.insert.await([[INSERT INTO frame_audit_logs(actor_identifier,action,entity_type,entity_id,event_id)
    VALUES(?,'AD_REJECT','ad',?,?)]],{who,ad.public_id,ad.event_id})
  notifyIdentifier(ad.creator_identifier,'FRAME 広告審査','広告「'..tostring(ad.title or ad.product_name)..'」は掲載期間終了のため却下されました。')
  return {ok=true,status='rejected',expired=true}
 end

 if decision=='reject' then
  local reason=type(d.reason)=='string' and d.reason:sub(1,500) or ''
  reason=reason:gsub('^%s+',''):gsub('%s+$','')
  if reason=='' then return {ok=false,error='REVIEW_REASON_REQUIRED'} end
  local n=MySQL.update.await([[UPDATE frame_ads SET status='rejected',reviewed_by=?,reviewed_at=UTC_TIMESTAMP(),review_reason=?
    WHERE id=? AND status='pending_review']],{who,reason,ad.id}) or 0
  if n~=1 then return {ok=false,error='REVIEW_RACE'} end
  MySQL.insert.await([[INSERT INTO frame_audit_logs(actor_identifier,action,entity_type,entity_id,event_id)
    VALUES(?,'AD_REJECT','ad',?,?)]],{who,ad.public_id,ad.event_id})
  notifyIdentifier(ad.creator_identifier,'FRAME 広告審査','広告「'..tostring(ad.title or ad.product_name)..'」は却下されました。理由: '..reason)
  return {ok=true,status='rejected'}
 end

 local token=('%s:%s:%d'):format(who,ad.public_id,os.time())
 local claimed=MySQL.update.await([[UPDATE frame_ads SET status='processing',review_token=?,reviewed_by=?,reviewed_at=UTC_TIMESTAMP(),review_reason=NULL
   WHERE id=? AND status='pending_review']],{token,who,ad.id}) or 0
 if claimed~=1 then return {ok=false,error='REVIEW_RACE'} end

 local sourcePlayer=nil
 for _,s in ipairs(GetPlayers()) do
  if FrameFramework.GetIdentifier(tonumber(s))==ad.creator_identifier then sourcePlayer=tonumber(s);break end
 end

 if tonumber(ad.price_snapshot or 0)>0 then
  if not sourcePlayer then
   MySQL.update.await([[UPDATE frame_ads SET status='pending_review',review_token=NULL,reviewed_by=NULL,reviewed_at=NULL
     WHERE id=? AND review_token=?]],{ad.id,token})
   return {ok=false,error='CREATOR_OFFLINE'}
  end
  if not FrameFramework.RemoveMoney(sourcePlayer,'bank',ad.price_snapshot,'FRAME advertisement') then
   MySQL.update.await([[UPDATE frame_ads SET status='pending_review',review_token=NULL,reviewed_by=NULL,reviewed_at=NULL
     WHERE id=? AND review_token=?]],{ad.id,token})
   return {ok=false,error='INSUFFICIENT_FUNDS'}
  end
 end

 local txid=nil
 if tonumber(ad.price_snapshot or 0)>0 then
  txid=MySQL.insert.await([[INSERT INTO frame_transactions(
    public_id,player_identifier,event_id,transaction_type,amount,status,idempotency_key,metadata)
    VALUES(?,?,?,'ad_purchase',?,'completed',?,?)]],
    {pid(),ad.creator_identifier,ad.event_id,ad.price_snapshot,'ad:'..ad.public_id,json.encode({ad_id=ad.id})})
  if not txid then
   if sourcePlayer and FrameFramework.AddMoney then
    FrameFramework.AddMoney(sourcePlayer,'bank',ad.price_snapshot,'FRAME advertisement rollback')
   end
   MySQL.update.await([[UPDATE frame_ads SET status='payment_error',review_reason='LEDGER_WRITE_FAILED'
     WHERE id=? AND review_token=?]],{ad.id,token})
   return {ok=false,error='PAYMENT_LEDGER_ERROR'}
  end
 end

 local n=MySQL.update.await([[UPDATE frame_ads
   SET status=CASE
     WHEN ends_at<=UTC_TIMESTAMP() THEN 'ended'
     WHEN starts_at<=UTC_TIMESTAMP() THEN 'active'
     ELSE 'scheduled'
   END,transaction_id=?,review_token=NULL
   WHERE id=? AND status='processing' AND review_token=?]],{txid,ad.id,token}) or 0
 if n~=1 then return {ok=false,error='FINALIZE_FAILED'} end

 local finalStatus=MySQL.scalar.await([[SELECT status FROM frame_ads WHERE id=?]],{ad.id}) or 'scheduled'
 MySQL.insert.await([[INSERT INTO frame_audit_logs(actor_identifier,action,entity_type,entity_id,event_id)
   VALUES(?,'AD_APPROVE','ad',?,?)]],{who,ad.public_id,ad.event_id})
 notifyIdentifier(ad.creator_identifier,'FRAME 広告審査','広告「'..tostring(ad.title or ad.product_name)..'」が承認されました。')
 return {ok=true,status=finalStatus}
end

function FrameAds.Stop(src,d)
 local who=id(src); if not FramePermissions.IsStaff(who,src) then return {ok=false,error='FORBIDDEN'} end
 local publicId=type(d)=='table' and tostring(d.public_id or '') or ''
 local ad=MySQL.single.await([[SELECT id,event_id,creator_identifier,title,status FROM frame_ads
   WHERE public_id=? LIMIT 1]],{publicId})
 if not ad then return {ok=false,error='NOT_FOUND'} end
 if ad.status~='scheduled' and ad.status~='active' then return {ok=false,error='AD_STOP_NOT_ALLOWED'} end
 local reason=type(d.reason)=='string' and d.reason:sub(1,500) or ''
 local n=MySQL.update.await([[UPDATE frame_ads SET status='cancelled',review_reason=?,reviewed_by=?,reviewed_at=UTC_TIMESTAMP()
   WHERE id=? AND status IN ('scheduled','active')]],{reason~='' and reason or '運営により掲載停止',who,ad.id}) or 0
 if n<1 then return {ok=false,error='STATE_CHANGED'} end
 MySQL.insert.await([[INSERT INTO frame_audit_logs(actor_identifier,action,entity_type,entity_id,event_id)
   VALUES(?,'AD_STOP','ad',?,?)]],{who,publicId,ad.event_id})
 notifyIdentifier(ad.creator_identifier,'FRAME 広告掲載','広告「'..tostring(ad.title or publicId)..'」の掲載が停止されました。')
 return {ok=true,status='cancelled'}
end

function FrameAds.Active(src)
 if not id(src) then return {ok=false,error='PLAYER_NOT_READY'} end
 return {ok=true,ads=MySQL.query.await([[SELECT
   a.public_id,a.title,a.advertiser_name,a.media_ref,a.link_type,a.link_value,a.starts_at,a.ends_at,
   p.placement,e.public_id event_public_id,e.title event_title,e.category event_category
   FROM frame_ads a
   JOIN frame_ad_products p ON p.id=a.product_id
   LEFT JOIN frame_events e ON e.id=a.event_id
   WHERE a.status='active' AND a.starts_at<=UTC_TIMESTAMP() AND a.ends_at>UTC_TIMESTAMP()
   ORDER BY a.id DESC LIMIT 50]]) or {}}
end

function FrameAds.Stat(src,d,kind)
 if not id(src) then return {ok=false,error='PLAYER_NOT_READY'} end
 local ad=MySQL.single.await([[SELECT id FROM frame_ads
   WHERE public_id=? AND status='active' AND starts_at<=UTC_TIMESTAMP() AND ends_at>UTC_TIMESTAMP()]],
   {type(d)=='table' and d.public_id or ''})
 if not ad then return {ok=false,error='NOT_ACTIVE'} end
 local col=kind=='click' and 'clicks' or 'impressions'
 MySQL.query.await(('INSERT INTO frame_ad_daily_stats(ad_id,stat_date,%s) VALUES(?,UTC_DATE(),1) ON DUPLICATE KEY UPDATE %s=%s+1'):format(col,col,col),{ad.id})
 return {ok=true}
end

function FrameAds.Advance()
 MySQL.update.await([[UPDATE frame_ads SET status=CASE
   WHEN ends_at<=UTC_TIMESTAMP() THEN 'ended'
   WHEN starts_at<=UTC_TIMESTAMP() THEN 'active'
   ELSE 'scheduled' END
   WHERE status='approved']])
 MySQL.update.await([[UPDATE frame_ads SET status='active'
   WHERE status='scheduled' AND starts_at<=UTC_TIMESTAMP() AND ends_at>UTC_TIMESTAMP()]])
 MySQL.update.await([[UPDATE frame_ads SET status='ended'
   WHERE status IN ('active','scheduled') AND ends_at<=UTC_TIMESTAMP()]])
 MySQL.update.await([[UPDATE frame_ads a
   JOIN frame_ad_products p ON p.id=a.product_id
   LEFT JOIN frame_events e ON e.id=a.event_id
   SET a.status='ended',a.review_reason=COALESCE(a.review_reason,'紐付けイベントが終了または非公開になりました。')
   WHERE a.status IN ('active','scheduled')
     AND p.placement IN ('featured','top_placement','category_banner')
     AND (e.id IS NULL OR e.visibility<>'public' OR e.status IN ('draft','cancelled','ended'))]])
end
