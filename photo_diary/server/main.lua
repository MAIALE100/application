local function ident(src) return PhotoDiaryFramework.GetIdentifier(src) end
local function notify(src,msg) TriggerClientEvent('photo_diary:notify',src,msg) end
local function changed(src) TriggerClientEvent('photo_diary:changed',src) end
local function clean(s,max) s=tostring(s or ''):gsub('[%z\1-\8\11\12\14-\31]',''); return s:sub(1,max) end
local busy={}
local function lock(src,key,ms)
  local now=GetGameTimer(); busy[src]=busy[src] or {}; local untilAt=busy[src][key] or 0
  if now < untilAt then return false end
  busy[src][key]=now+(ms or 750); return true
end
AddEventHandler('playerDropped',function() busy[source]=nil end)
local function validDate(d)
  local y,m,day=d:match('^(%d%d%d%d)%-(%d%d)%-(%d%d)$'); y,m,day=tonumber(y),tonumber(m),tonumber(day)
  if not y or m<1 or m>12 or day<1 or day>31 then return false end
  local t=os.time({year=y,month=m,day=day,hour=12}); if not t then return false end
  local rt=os.date('*t',t); if rt.year~=y or rt.month~=m or rt.day~=day then return false end
  return t <= (os.time()+86400) -- timezone-safe one-day tolerance; UI blocks future dates exactly
end

local function phoneFor(owner)
  if not owner then return nil end
  local ok,row=pcall(function()
    return MySQL.single.await('SELECT phone_number FROM phone_phones WHERE owner_id=? ORDER BY id DESC LIMIT 1',{owner})
  end)
  return ok and row and row.phone_number or nil
end
local function decodeRows(rows)
  for _,e in ipairs(rows or {}) do e.photos=json.decode(e.photos or '[]') or {} end
  return rows or {}
end
local function bootstrap(src)
  local owner=ident(src); if not owner then notify(src,'キャラクター情報を取得できませんでした。'); return end
  local phone=phoneFor(owner)
  local entries=decodeRows(MySQL.query.await('SELECT id, entry_date, title, body, mood, photos, created_at, updated_at FROM weazel_photo_diary_entries WHERE owner_identifier=? ORDER BY entry_date DESC,id DESC LIMIT 365',{owner}) or {})
  local shares=decodeRows(MySQL.query.await('SELECT s.id,s.entry_id,s.recipient_phone,s.created_at,e.title,e.entry_date,e.photos FROM weazel_photo_diary_shares s JOIN weazel_photo_diary_entries e ON e.id=s.entry_id WHERE s.owner_identifier=? ORDER BY s.created_at DESC',{owner}) or {})
  local received={}
  if phone then received=decodeRows(MySQL.query.await('SELECT s.id AS share_id,e.id,e.entry_date,e.title,e.body,e.mood,e.photos,s.owner_identifier,(SELECT p.phone_number FROM phone_phones p WHERE p.owner_id=s.owner_identifier ORDER BY p.id DESC LIMIT 1) AS sender_phone,s.created_at AS shared_at FROM weazel_photo_diary_shares s JOIN weazel_photo_diary_entries e ON e.id=s.entry_id WHERE s.recipient_phone=? ORDER BY s.created_at DESC',{phone}) or {}) end
  local slots=Config.FreeShareSlots
  local entitlement=MySQL.scalar.await('SELECT MAX(slots) FROM weazel_photo_diary_entitlements WHERE owner_identifier=? AND active=1',{owner})
  if entitlement and tonumber(entitlement)>slots then slots=tonumber(entitlement) end
  TriggerClientEvent('photo_diary:bootstrapResult',src,{entries=entries,shares=shares,received=received,phoneNumber=phone,limits={maxPhotos=Config.MaxPhotosPerEntry,freeShareSlots=Config.FreeShareSlots,currentShareSlots=slots,maxShareSlots=Config.MaxShareSlots or 50,shareSlotStep=Config.ShareSlotStep or 5},paidEnabled=Config.EnablePaidFeatures,products=Config.ShareSlotProducts})
end
RegisterNetEvent('photo_diary:bootstrap',function() local src=source; local ok,err=pcall(bootstrap,src); if not ok then print(('[PhotoDiary] bootstrap failed for %s: %s'):format(src,err)); notify(src,'日記データの読み込みに失敗しました。') end end)

RegisterNetEvent('photo_diary:saveEntry',function(data)
  local src=source; if not lock(src,'save',1000) then return notify(src,'処理中です。少し待ってからお試しください。') end; local owner=ident(src); if not owner or type(data)~='table' then return end
  local title=clean(data.title,Config.MaxTitleLength); local body=clean(data.body,Config.MaxBodyLength); local mood=clean(data.mood,20); local date=clean(data.entryDate,10)
  if not validDate(date) then return notify(src,'日付が正しくないか、未来の日付です。') end
  local photos={}; if type(data.photos)=='table' then for i=1,math.min(#data.photos,Config.MaxPhotosPerEntry) do local u=tostring(data.photos[i] or ''); if #u <= (Config.MaxPhotoUrlLength or 2048) and u:match('^https?://') then photos[#photos+1]=u end end end
  if title=='' and body=='' and #photos==0 then return notify(src,'タイトル・本文・写真のいずれかを入力してください。') end
  if tonumber(data.id) then MySQL.update.await('UPDATE weazel_photo_diary_entries SET entry_date=?,title=?,body=?,mood=?,photos=? WHERE id=? AND owner_identifier=?',{date,title,body,mood,json.encode(photos),tonumber(data.id),owner})
  else MySQL.insert.await('INSERT INTO weazel_photo_diary_entries (owner_identifier,entry_date,title,body,mood,photos) VALUES (?,?,?,?,?,?)',{owner,date,title,body,mood,json.encode(photos)}) end
  notify(src,tonumber(data.id) and '日記を更新しました。' or '日記を保存しました。'); changed(src)
end)
RegisterNetEvent('photo_diary:deleteEntry',function(id)
  local src=source; local owner=ident(src); if not owner or not id then return end
  MySQL.transaction.await({{query='DELETE FROM weazel_photo_diary_shares WHERE entry_id=? AND owner_identifier=?',values={id,owner}},{query='DELETE FROM weazel_photo_diary_entries WHERE id=? AND owner_identifier=?',values={id,owner}}})
  notify(src,'日記を削除しました。'); changed(src)
end)
RegisterNetEvent('photo_diary:shareEntry',function(id,phone)
  local src=source; if not lock(src,'share',800) then return notify(src,'共有処理中です。') end; local owner=ident(src); phone=clean(phone,32):gsub('%s+','')
  if not owner or not id or #phone<3 then return notify(src,'共有先の電話番号を確認してください。') end
  local owns=MySQL.scalar.await('SELECT 1 FROM weazel_photo_diary_entries WHERE id=? AND owner_identifier=?',{id,owner}); if not owns then return end
  local exists=MySQL.scalar.await('SELECT 1 FROM phone_phones WHERE phone_number=? LIMIT 1',{phone}); if not exists then return notify(src,'その電話番号は見つかりません。') end
  local ownPhone=phoneFor(owner); if ownPhone and tostring(ownPhone)==phone then return notify(src,'自分自身には共有できません。') end
  local duplicate=MySQL.scalar.await('SELECT 1 FROM weazel_photo_diary_shares WHERE entry_id=? AND owner_identifier=? AND recipient_phone=? LIMIT 1',{id,owner,phone}); if duplicate then return notify(src,'この相手には既に共有しています。') end
  local count=tonumber(MySQL.scalar.await('SELECT COUNT(*) FROM weazel_photo_diary_shares WHERE entry_id=? AND owner_identifier=?',{id,owner}) or 0)
  local slots=Config.FreeShareSlots; local ent=MySQL.scalar.await('SELECT MAX(slots) FROM weazel_photo_diary_entitlements WHERE owner_identifier=? AND active=1',{owner}); if ent and tonumber(ent)>slots then slots=tonumber(ent) end
  if count>=slots then return notify(src,('共有枠の上限（%d人）です。'):format(slots)) end
  local ok=pcall(function() MySQL.insert.await('INSERT INTO weazel_photo_diary_shares (entry_id,owner_identifier,recipient_phone) VALUES (?,?,?)',{id,owner,phone}) end)
  if not ok then return notify(src,'この相手には既に共有しています。') end
  notify(src,'日記を共有しました。'); changed(src)
  for _,p in ipairs(GetPlayers()) do local ps=tonumber(p); if ps and phoneFor(ident(ps))==phone then notify(ps,'Photo Diaryが共有されました。'); changed(ps) end end
end)

RegisterNetEvent('photo_diary:revokeShare',function(shareId)
  local src=source; local owner=ident(src); shareId=tonumber(shareId)
  if not owner or not shareId then return end
  local changedRows=MySQL.update.await('DELETE FROM weazel_photo_diary_shares WHERE id=? AND owner_identifier=?',{shareId,owner})
  if changedRows and changedRows>0 then notify(src,'共有を解除しました。'); changed(src) end
end)


RegisterNetEvent('photo_diary:leaveShared',function(shareId)
  local src=source; local owner=ident(src); shareId=tonumber(shareId)
  if not owner or not shareId then return end
  local phone=phoneFor(owner); if not phone then return notify(src,'電話番号を取得できませんでした。') end
  local rows=MySQL.update.await('DELETE FROM weazel_photo_diary_shares WHERE id=? AND recipient_phone=?',{shareId,phone})
  if rows and rows>0 then notify(src,'Sharedから削除しました。'); changed(src) end
end)

RegisterNetEvent('photo_diary:purchaseShareSlots',function(productId)
  local src=source
  if not lock(src,'purchase',1500) then return notify(src,'購入処理中です。') end
  local owner=ident(src)
  local product=Config.ShareSlotProducts[tostring(productId or '')]
  if not owner or not product then return notify(src,'商品が見つかりません。') end
  if not Config.EnablePaidFeatures then return notify(src,'共有枠の追加購入は現在準備中です。') end
  if not PhotoDiaryFramework.IsPaymentConfigured() then return notify(src,'決済機能は現在準備中です。') end

  local current=tonumber(MySQL.scalar.await('SELECT MAX(slots) FROM weazel_photo_diary_entitlements WHERE owner_identifier=? AND active=1',{owner}) or Config.FreeShareSlots)
  local maxSlots=tonumber(Config.MaxShareSlots or 50)
  local step=tonumber(Config.ShareSlotStep or 5)
  if current>=maxSlots then return notify(src,('共有枠は最大%d人です。'):format(maxSlots)) end

  local expected=math.min(current+step,maxSlots)
  if tonumber(product.slots)~=expected then return notify(src,('共有枠は%d人ずつ順番に解放してください。'):format(step)) end

  local price=tonumber(product.price)
  if not price or price<=0 then return notify(src,'この共有枠の価格はまだ設定されていません。') end

  -- Re-check the entitlement immediately before payment. This blocks stale/double
  -- purchase requests from charging for the same tier twice.
  local latest=tonumber(MySQL.scalar.await('SELECT MAX(slots) FROM weazel_photo_diary_entitlements WHERE owner_identifier=? AND active=1',{owner}) or Config.FreeShareSlots)
  if latest~=current then return notify(src,'共有枠の状態が更新されました。画面を開き直してください。') end

  local paid,reason=PhotoDiaryFramework.ProcessShareSlotPurchase(src,price,Config.CompanyAccount,{owner=owner,productId=tostring(productId),fromSlots=current,toSlots=expected})
  if not paid then return notify(src,('購入できませんでした: %s'):format(tostring(reason or 'PAYMENT_FAILED'))) end

  MySQL.insert.await('INSERT INTO weazel_photo_diary_entitlements (owner_identifier,product_id,slots,active) VALUES (?,?,?,1)',{owner,tostring(productId),expected})
  notify(src,('共有枠を%d人へ拡張しました。'):format(expected))
  changed(src)
end)
