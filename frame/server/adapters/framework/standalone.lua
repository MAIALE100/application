if not (FrameConfig.Framework == 'standalone' or (FrameConfig.Framework == 'auto' and GetResourceState('qbx_core') ~= 'started')) then return end
FrameFramework = FrameFramework or {}
function FrameFramework.IsReady() return true end
function FrameFramework.GetIdentifier(source)
  for _, id in ipairs(GetPlayerIdentifiers(source)) do if id:sub(1,8)=='license:' then return id end end
  return GetPlayerIdentifiers(source)[1]
end
function FrameFramework.GetCharacterName(source) return GetPlayerName(source) or ('Player %s'):format(source) end
function FrameFramework.GetJob(_) return nil end
function FrameFramework.GetMoney(_,_) return nil end
function FrameFramework.RemoveMoney(_,_,_,_) return false end
function FrameFramework.AddMoney(_,_,_,_) return false end
