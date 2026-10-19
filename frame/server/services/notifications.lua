FrameNotifications={}

local function claim(eventId,identifier,kind)
  local n=MySQL.update.await([[INSERT INTO frame_notification_deliveries(event_id,player_identifier,notification_type,status,attempted_at)
    VALUES(?,?,?,'pending',UTC_TIMESTAMP())
    ON DUPLICATE KEY UPDATE
      status=IF(status='failed' OR (status='pending' AND attempted_at<UTC_TIMESTAMP()-INTERVAL 10 MINUTE),'pending',status),
      attempted_at=IF(status='failed' OR (status='pending' AND attempted_at<UTC_TIMESTAMP()-INTERVAL 10 MINUTE),UTC_TIMESTAMP(),attempted_at)]],
    {eventId,identifier,kind}) or 0
  if n<1 then return false end
  local row=MySQL.single.await([[SELECT status,attempted_at FROM frame_notification_deliveries WHERE event_id=? AND player_identifier=? AND notification_type=? LIMIT 1]],{eventId,identifier,kind})
  return row and row.status=='pending'
end

local function mark(eventId,identifier,kind,status,phone,notificationId)
  MySQL.update.await([[UPDATE frame_notification_deliveries
    SET status=?,phone_number=?,notification_id=?,delivered_at=IF(?='sent',UTC_TIMESTAMP(),delivered_at)
    WHERE event_id=? AND player_identifier=? AND notification_type=?]],
    {status,phone,notificationId,status,eventId,identifier,kind})
end

local function sendOne(e,identifier,kind,title,content)
  if not identifier or identifier=='' then return false end
  if not claim(e.id,identifier,kind) then return false end
  local number=nil
  local okNumber,res=pcall(function() return exports['lb-phone']:GetEquippedPhoneNumber(identifier) end)
  if okNumber then number=res end
  if not number or number=='' then mark(e.id,identifier,kind,'failed',nil,nil); return false end
  local okSend,notificationId=pcall(function()
    return exports['lb-phone']:SendNotification(tostring(number),{
      app='frame',
      title=title,
      content=tostring(content or ''):sub(1,500)
    })
  end)
  if not okSend or not notificationId then mark(e.id,identifier,kind,'failed',tostring(number),nil); return false end
  mark(e.id,identifier,kind,'sent',tostring(number),tonumber(notificationId))
  return true
end

local function uniqueRecipients(rows)
  local seen,out={},{}
  for _,r in ipairs(rows or {}) do
    local id=r.player_identifier
    if id and id~='' and not seen[id] then seen[id]=true;out[#out+1]=id end
  end
  return out
end

function FrameNotifications.NotifyStart(e)
  if not e or not e.id then return 0 end
  local rows=MySQL.query.await([[SELECT player_identifier FROM frame_event_favorites WHERE event_id=?]],{e.id}) or {}
  local sent=0
  for _,identifier in ipairs(uniqueRecipients(rows)) do
    if sendOne(e,identifier,'event_started','イベント開始',(e.title or 'FRAMEイベント')..' が始まりました。') then sent=sent+1 end
  end
  return sent
end

function FrameNotifications.NotifyDeadline(e)
  if not e or not e.id then return 0 end
  local rows=MySQL.query.await([[SELECT player_identifier FROM frame_event_participants WHERE event_id=? AND status='active']],{e.id}) or {}
  local sent=0
  for _,identifier in ipairs(uniqueRecipients(rows)) do
    if sendOne(e,identifier,'submission_deadline_30m','投稿締切が近づいています',(e.title or 'FRAMEイベント')..' の投稿締切まで約30分です。') then sent=sent+1 end
  end
  return sent
end

function FrameNotifications.NotifyResults(e)
  if not e or not e.id then return 0 end
  local rows=MySQL.query.await([[SELECT player_identifier FROM frame_event_participants WHERE event_id=? AND status='active'
    UNION
    SELECT player_identifier FROM frame_event_favorites WHERE event_id=?]],{e.id,e.id}) or {}
  local sent=0
  for _,identifier in ipairs(uniqueRecipients(rows)) do
    if sendOne(e,identifier,'results_published','結果発表',(e.title or 'FRAMEイベント')..' の結果が発表されました。') then sent=sent+1 end
  end
  return sent
end

function FrameNotifications.Scan()
  local starts=MySQL.query.await([[SELECT id,public_id,title FROM frame_events
    WHERE status='active' AND starts_at IS NOT NULL
      AND starts_at<=UTC_TIMESTAMP() AND starts_at>=UTC_TIMESTAMP()-INTERVAL 10 MINUTE]]) or {}
  for _,e in ipairs(starts) do FrameNotifications.NotifyStart(e) end

  local deadlines=MySQL.query.await([[SELECT id,public_id,title FROM frame_events
    WHERE status='active' AND submissions_close_at IS NOT NULL
      AND submissions_close_at>UTC_TIMESTAMP()
      AND submissions_close_at<=UTC_TIMESTAMP()+INTERVAL 30 MINUTE]]) or {}
  for _,e in ipairs(deadlines) do FrameNotifications.NotifyDeadline(e) end

  local results=MySQL.query.await([[SELECT id,public_id,title FROM frame_events
    WHERE status='results' AND results_at IS NOT NULL
      AND results_at<=UTC_TIMESTAMP() AND results_at>=UTC_TIMESTAMP()-INTERVAL 10 MINUTE]]) or {}
  for _,e in ipairs(results) do FrameNotifications.NotifyResults(e) end
end
