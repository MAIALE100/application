if not (FrameConfig.Framework == 'qbox' or (FrameConfig.Framework == 'auto' and GetResourceState('qbx_core') == 'started')) then return end
FrameFramework = FrameFramework or {}

local function player(source)
  if GetResourceState('qbx_core') ~= 'started' then return nil end
  return exports.qbx_core:GetPlayer(source)
end

function FrameFramework.IsReady() return GetResourceState('qbx_core') == 'started' end
function FrameFramework.GetIdentifier(source)
  local p = player(source); return p and p.PlayerData and p.PlayerData.citizenid or nil
end
function FrameFramework.GetCharacterName(source)
  local p = player(source); local c = p and p.PlayerData and p.PlayerData.charinfo
  if not c then return ('Player %s'):format(source) end
  local name = ((c.firstname or '') .. ' ' .. (c.lastname or '')):gsub('^%s+', ''):gsub('%s+$', '')
  return name ~= '' and name or ('Player %s'):format(source)
end
function FrameFramework.GetJob(source)
  local p = player(source); local job = p and p.PlayerData and p.PlayerData.job
  if not job then return nil end
  return { name=job.name, grade=job.grade and (job.grade.level or job.grade) or 0, onduty=job.onduty == true }
end
function FrameFramework.GetMoney(source, account)
  local p=player(source); if not p then return nil end
  return p.Functions.GetMoney(account or 'bank')
end
function FrameFramework.RemoveMoney(source, account, amount, reason)
  local p=player(source); if not p then return false end
  return p.Functions.RemoveMoney(account or 'bank', amount, reason or 'FRAME') == true
end
function FrameFramework.AddMoney(source, account, amount, reason)
  local p=player(source); if not p then return false end
  return p.Functions.AddMoney(account or 'bank', amount, reason or 'FRAME') == true
end
