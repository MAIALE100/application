PhotoDiaryFramework = {}

local function qboxCharacterId(source)
  if GetResourceState('qbx_core') ~= 'started' then return nil end
  source = tonumber(source)
  if not source then return nil end

  local ok, player = pcall(function()
    return exports['qbx_core']:GetPlayer(source)
  end)
  if ok and player and player.PlayerData and player.PlayerData.citizenid then
    return tostring(player.PlayerData.citizenid)
  end

  local okList, list = pcall(function()
    return exports['qbx_core']:GetPlayersData()
  end)
  if okList and type(list) == 'table' then
    for _, pd in pairs(list) do
      if type(pd) == 'table' and tonumber(pd.source) == source and pd.citizenid then
        return tostring(pd.citizenid)
      end
    end
  end
  return nil
end

function PhotoDiaryFramework.GetIdentifier(source)
  if GetResourceState('qbx_core') == 'started' then
    return qboxCharacterId(source)
  end

  -- Flecity adapter point:
  -- Return the stable CHARACTER identifier used by phone_phones.owner_id.
  -- Never fall back to a player/license identifier: that would mix characters.
  return nil
end

function PhotoDiaryFramework.IsPaymentConfigured()
  return false
end

function PhotoDiaryFramework.ProcessShareSlotPurchase(source, amount, companyAccount, metadata)
  return false, 'PAYMENT_ADAPTER_NOT_CONFIGURED'
end
