FrameAds={}
local function pid() local t,c={},'0123456789ABCDEFGHJKMNPQRSTVWXYZ'; for i=1,26 do local n=math.random(1,#c);t[i]=c:sub(n,n) end return table.concat(t) end
local function id(src) return FrameFramework.GetIdentifier(src) end
function FrameAds.Products(src)
 if not id(src) then return {ok=false,error='PLAYER_NOT_READY'} end
 return {ok=true,products=MySQL.query.await([[SELECT code,name,placement,base_price,duration_hours,requires_review FROM frame_ad_products WHERE active=1 ORDER BY id]]) or {}}
end
function FrameAds.Create(src,d)
 local who=id(src); d=type(d)=='table' and d or {}; if not who then return {ok=false,error='PLAYER_NOT_READY'} end; if not FramePermissions.IsOrganizer(who) and not FramePermissions.IsStaff(who) then return {ok=false,error='ORGANIZER_REQUIRED'} end
 local p=MySQL.single.await([[SELECT * FROM frame_ad_products WHERE code=? AND active=1 LIMIT 1]],{d.product_code}); if not p then return {ok=false,error='INVALID_PRODUCT'} end
 local media=type(d.media_ref)=='string' and d.media_ref or ''; if #media<8 or #media>1024 or not media:match('^https://') then return {ok=false,error='INVALID_MEDIA'} end
 local eventId=nil; if d.event_public_id and d.event_public_id~='' then local e=FrameEventsRepository.GetByPublicId(d.event_public_id); if not e or not FramePermissions.CanManageEvent(who,e) then return {ok=false,error='INVALID_EVENT'} end; eventId=e.id end
 local start=type(d.starts_at)=='string' and d.starts_at:gsub('T',' '):sub(1,19) or nil; local finish=type(d.ends_at)=='string' and d.ends_at:gsub('T',' '):sub(1,19) or nil; if not start or not finish or start>=finish then return {ok=false,error='INVALID_WINDOW'} end
 local advertiser=(type(d.advertiser_name)=='string' and d.advertiser_name:sub(1,120) or FrameFramework.GetCharacterName(src)); local status=(FramePermissions.IsStaff(who) and p.requires_review==0) and 'approved' or 'pending_review'
 local pub=pid(); local n=MySQL.insert.await([[INSERT INTO frame_ads(public_id,creator_identifier,event_id,product_id,advertiser_name,title,media_ref,link_type,link_value,starts_at,ends_at,status,price_snapshot) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)]],{pub,who,eventId,p.id,advertiser,type(d.title)=='string' and d.title:sub(1,160) or nil,media,d.link_type=='none' and 'none' or 'event',d.link_value,start,finish,status,p.base_price})
 if not n then return {ok=false,error='DATABASE_ERROR'} end
 MySQL.insert.await([[INSERT INTO frame_audit_logs(actor_identifier,action,entity_type,entity_id) VALUES(?,'AD_CREATE','ad',?)]],{who,pub}); return {ok=true,public_id=pub,status=status,price=p.base_price}
end
function FrameAds.Review(src,d)
 local who=id(src); if not FramePermissions.IsStaff(who) then return {ok=false,error='FORBIDDEN'} end
 d=type(d)=='table' and d or {}; local decision=d.decision=='approve' and 'approve' or (d.decision=='reject' and 'reject' or nil); if not decision then return {ok=false,error='INVALID_DECISION'} end
 local ad=MySQL.single.await([[SELECT * FROM frame_ads WHERE public_id=? AND status='pending_review' LIMIT 1]],{d.public_id}); if not ad then return {ok=false,error='NOT_PENDING'} end
 if decision=='reject' then
   local n=MySQL.update.await([[UPDATE frame_ads SET status='rejected',reviewed_by=?,reviewed_at=UTC_TIMESTAMP(),review_reason=? WHERE id=? AND status='pending_review']],{who,type(d.reason)=='string' and d.reason:sub(1,500) or nil,ad.id})
   return n==1 and {ok=true,status='rejected'} or {ok=false,error='REVIEW_RACE'}
 end
 local token=('%s:%s:%d'):format(who,ad.public_id,os.time())
 local claimed=MySQL.update.await([[UPDATE frame_ads SET status='processing',review_token=?,reviewed_by=?,reviewed_at=UTC_TIMESTAMP() WHERE id=? AND status='pending_review']],{token,who,ad.id})
 if claimed~=1 then return {ok=false,error='REVIEW_RACE'} end
 local sourcePlayer=nil; for _,s in ipairs(GetPlayers()) do if FrameFramework.GetIdentifier(tonumber(s))==ad.creator_identifier then sourcePlayer=tonumber(s);break end end
 if ad.price_snapshot>0 then
   if not sourcePlayer then MySQL.update.await([[UPDATE frame_ads SET status='pending_review',review_token=NULL,reviewed_by=NULL,reviewed_at=NULL WHERE id=? AND review_token=?]],{ad.id,token}); return {ok=false,error='CREATOR_OFFLINE'} end
   if not FrameFramework.RemoveMoney(sourcePlayer,'bank',ad.price_snapshot,'FRAME advertisement') then MySQL.update.await([[UPDATE frame_ads SET status='pending_review',review_token=NULL,reviewed_by=NULL,reviewed_at=NULL WHERE id=? AND review_token=?]],{ad.id,token}); return {ok=false,error='INSUFFICIENT_FUNDS'} end
 end
 local txid=nil
 if ad.price_snapshot>0 then
   txid=MySQL.insert.await([[INSERT INTO frame_transactions(public_id,player_identifier,event_id,transaction_type,amount,status,idempotency_key,metadata) VALUES(?,?,?,'ad_purchase',?,'completed',?,?)]],{pid(),ad.creator_identifier,ad.event_id,ad.price_snapshot,'ad:'..ad.public_id,json.encode({ad_id=ad.id})})
   if not txid then
     if sourcePlayer and FrameFramework.AddMoney then FrameFramework.AddMoney(sourcePlayer,'bank',ad.price_snapshot,'FRAME advertisement rollback') end
     MySQL.update.await([[UPDATE frame_ads SET status='payment_error',review_reason='LEDGER_WRITE_FAILED' WHERE id=? AND review_token=?]],{ad.id,token})
     return {ok=false,error='PAYMENT_LEDGER_ERROR'}
   end
 end
 local n=MySQL.update.await([[UPDATE frame_ads SET status=CASE WHEN starts_at<=UTC_TIMESTAMP() THEN 'active' ELSE 'scheduled' END,transaction_id=?,review_token=NULL WHERE id=? AND status='processing' AND review_token=?]],{txid,ad.id,token})
 return n==1 and {ok=true,status='approved'} or {ok=false,error='FINALIZE_FAILED'}
end
function FrameAds.Active(src)
 if not id(src) then return {ok=false,error='PLAYER_NOT_READY'} end
 return {ok=true,ads=MySQL.query.await([[SELECT a.public_id,a.title,a.media_ref,a.link_type,a.link_value,p.placement FROM frame_ads a JOIN frame_ad_products p ON p.id=a.product_id WHERE a.status='active' AND a.starts_at<=UTC_TIMESTAMP() AND a.ends_at>UTC_TIMESTAMP() ORDER BY a.id DESC LIMIT 20]]) or {}}
end
function FrameAds.Stat(src,d,kind)
 if not id(src) then return {ok=false,error='PLAYER_NOT_READY'} end; local ad=MySQL.single.await([[SELECT id FROM frame_ads WHERE public_id=? AND status='active' AND starts_at<=UTC_TIMESTAMP() AND ends_at>UTC_TIMESTAMP()]],{type(d)=='table' and d.public_id or ''}); if not ad then return {ok=false,error='NOT_ACTIVE'} end
 local col=kind=='click' and 'clicks' or 'impressions'; MySQL.query.await(('INSERT INTO frame_ad_daily_stats(ad_id,stat_date,%s) VALUES(?,UTC_DATE(),1) ON DUPLICATE KEY UPDATE %s=%s+1'):format(col,col,col),{ad.id}); return {ok=true}
end
function FrameAds.Advance()
 MySQL.update.await([[UPDATE frame_ads SET status='active' WHERE status='scheduled' AND starts_at<=UTC_TIMESTAMP() AND ends_at>UTC_TIMESTAMP()]])
 MySQL.update.await([[UPDATE frame_ads SET status='ended' WHERE status IN ('active','scheduled') AND ends_at<=UTC_TIMESTAMP()]])
end
