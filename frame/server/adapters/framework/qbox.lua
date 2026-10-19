if not (FrameConfig.Framework == 'qbox' or (FrameConfig.Framework == 'auto' and GetResourceState('qbx_core') == 'started')) then return end
FrameFramework = FrameFramework or {}

local warned = {}

local function getPlayerData(source)
  if GetResourceState('qbx_core') ~= 'started' then return nil end
  local src = tonumber(source) or source

  local ok, player = pcall(function()
    return exports.qbx_core:GetPlayer(src)
  end)

  if ok and player and player.PlayerData and player.PlayerData.citizenid then
    return player.PlayerData
  end

  local okList, list = pcall(function()
    return exports.qbx_core:GetPlayersData()
  end)

  if okList and type(list) == 'table' then
    for _, pd in pairs(list) do
      if type(pd) == 'table' and tonumber(pd.source) == tonumber(src) and pd.citizenid then
        return pd
      end
    end
  end

  if not warned[tostring(src)] then
    warned[tostring(src)] = true
    print(('[FRAME] Qbox player not ready for source=%s (GetPlayer=%s, GetPlayersData=%s)'):format(
      tostring(src),
      tostring(ok and player ~= nil),
      tostring(okList and type(list) == 'table')
    ))
  end

  return nil
end

function FrameFramework.IsReady() return GetResourceState('qbx_core') == 'started' end

function FrameFramework.GetIdentifier(source)
  local pd = getPlayerData(source)
  return pd and pd.citizenid and tostring(pd.citizenid) or nil
end

function FrameFramework.GetCharacterName(source)
  local pd = getPlayerData(source)
  local c = pd and pd.charinfo
  if not c then return ('Player %s'):format(source) end
  local name = ((c.firstname or '') .. ' ' .. (c.lastname or '')):gsub('^%s+', ''):gsub('%s+$', '')
  return name ~= '' and name or ('Player %s'):format(source)
end

function FrameFramework.GetJob(source)
  local pd = getPlayerData(source)
  local job = pd and pd.job
  if not job then return nil end
  return {
    name = job.name,
    grade = job.grade and (job.grade.level or job.grade) or 0,
    onduty = job.onduty == true
  }
end

function FrameFramework.GetMoney(source, account)
  local identifier = FrameFramework.GetIdentifier(source)
  if not identifier then return nil end
  local ok, amount = pcall(function()
    return exports.qbx_core:GetMoney(identifier, account or 'bank')
  end)
  return ok and amount or nil
end

function FrameFramework.RemoveMoney(source, account, amount, reason)
  local identifier = FrameFramework.GetIdentifier(source)
  if not identifier then return false end
  local ok, result = pcall(function()
    return exports.qbx_core:RemoveMoney(identifier, account or 'bank', amount, reason or 'FRAME')
  end)
  return ok and result ~= false
end

function FrameFramework.AddMoney(source, account, amount, reason)
  local identifier = FrameFramework.GetIdentifier(source)
  if not identifier then return false end
  local ok, result = pcall(function()
    return exports.qbx_core:AddMoney(identifier, account or 'bank', amount, reason or 'FRAME')
  end)
  return ok and result ~= false
end
