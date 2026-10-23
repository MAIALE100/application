FlecityGamesPartyPlus = FlecityGamesPartyPlus or {}

local cache={}
local renewing={}

local function config()
    return FlecityGamesConfig.PartyPlus or {}
end

local function identifier(source)
    return FlecityGamesFramework.GetIdentifier(source)
end

local function planEnabled()
    return config().Enabled~=false
end

local function durationSeconds()
    return math.max(3600,math.floor(tonumber(config().DurationSeconds) or (7*24*60*60)))
end

local function price()
    return math.max(0,math.floor(tonumber(config().Price) or 50000))
end

local function moneyType()
    return tostring(config().MoneyType or 'bank')
end

local function readRow(id)
    if not id then return nil end
    local row=MySQL.single.await([[
        SELECT plan_id, UNIX_TIMESTAMP(active_until) AS expires_at, auto_renew
        FROM flecity_game_subscriptions
        WHERE player_identifier=? AND plan_id='party_plus'
        LIMIT 1
    ]],{id})
    if not row then return nil end
    return {
        planId='party_plus',
        expiresAt=tonumber(row.expires_at) or 0,
        autoRenew=tonumber(row.auto_renew)==1
    }
end

local function remember(id,row)
    if not id then return end
    cache[id]={
        expiresAt=tonumber(row and row.expiresAt) or 0,
        autoRenew=row and row.autoRenew==true or false,
        checkedAt=os.time()
    }
end

local function publicStatus(row,renewError)
    local expiresAt=tonumber(row and row.expiresAt) or 0
    return {
        active=planEnabled() and expiresAt>os.time(),
        expiresAt=expiresAt,
        autoRenew=row and row.autoRenew==true or false,
        renewError=renewError
    }
end

local function writeSubscription(id,expiresAt,autoRenew)
    local changed=MySQL.update.await([[
        INSERT INTO flecity_game_subscriptions
            (player_identifier,plan_id,active_until,auto_renew)
        VALUES (?,'party_plus',FROM_UNIXTIME(?),?)
        ON DUPLICATE KEY UPDATE
            plan_id=VALUES(plan_id),
            active_until=VALUES(active_until),
            auto_renew=VALUES(auto_renew),
            updated_at=CURRENT_TIMESTAMP
    ]],{id,expiresAt,autoRenew and 1 or 0})
    return changed~=nil
end

local function charge(source)
    local amount=price()
    if amount<=0 then return true end
    local balance=FlecityGamesFramework.GetMoney(source,moneyType())
    if not balance or balance<amount then return false,'INSUFFICIENT_FUNDS' end
    if not FlecityGamesFramework.RemoveMoney(source,moneyType(),amount,'PARTY+ 7-day subscription') then
        return false,'PAYMENT_FAILED'
    end
    return true
end

local function refund(source)
    local amount=price()
    if amount<=0 then return true end
    return FlecityGamesFramework.AddMoney(source,moneyType(),amount,'PARTY+ subscription refund')
end

local function purchasePeriod(source,id,row,isRenewal)
    if renewing[id] then return row,'SUBSCRIPTION_BUSY' end
    renewing[id]=true

    local ok,result,errorCode=pcall(function()
        local fresh=readRow(id)
        local now=os.time()
        if fresh and fresh.expiresAt>now then
            fresh.autoRenew=true
            MySQL.update.await([[UPDATE flecity_game_subscriptions SET auto_renew=1,updated_at=CURRENT_TIMESTAMP WHERE player_identifier=?]],{id})
            remember(id,fresh)
            return fresh,nil
        end

        local charged,chargeError=charge(source)
        if not charged then
            if isRenewal and fresh then
                fresh.autoRenew=false
                MySQL.update.await([[UPDATE flecity_game_subscriptions SET auto_renew=0,updated_at=CURRENT_TIMESTAMP WHERE player_identifier=?]],{id})
                remember(id,fresh)
            end
            return fresh,chargeError
        end

        local base=math.max(now,tonumber(fresh and fresh.expiresAt) or 0)
        local expiresAt=base+durationSeconds()
        if not writeSubscription(id,expiresAt,true) then
            refund(source)
            return fresh,'SUBSCRIPTION_SAVE_FAILED'
        end

        local updated={planId='party_plus',expiresAt=expiresAt,autoRenew=true}
        remember(id,updated)
        TriggerEvent('flecity_games:server:partyPlusCharged',tonumber(source),id,price(),expiresAt,isRenewal==true)
        return updated,nil
    end)

    renewing[id]=nil
    if not ok then
        print(('[FlecityGames] PARTY+ purchase error for %s: %s'):format(tostring(id),tostring(result)))
        return row,'SERVER_ERROR'
    end
    return result,errorCode
end

local function resolve(source,id,allowRenew)
    if not planEnabled() then return {planId='party_plus',expiresAt=0,autoRenew=false},nil end
    local row=readRow(id)
    if row and row.expiresAt<=os.time() and row.autoRenew and allowRenew then
        return purchasePeriod(source,id,row,true)
    end
    remember(id,row)
    return row,nil
end

function FlecityGamesPartyPlus.GetStatus(source,allowRenew)
    local id=identifier(source)
    if not id then return {ok=false,error='PLAYER_NOT_READY'} end
    local row,renewError=resolve(source,id,allowRenew==true)
    return {ok=true,status=publicStatus(row,renewError)}
end

function FlecityGamesPartyPlus.GetConfigFor(source,allowRenew)
    local statusResult=FlecityGamesPartyPlus.GetStatus(source,allowRenew)
    local status=statusResult.ok and statusResult.status or {active=false,expiresAt=0,autoRenew=false}
    return {
        enabled=planEnabled(),
        price=price(),
        durationSeconds=durationSeconds(),
        durationDays=math.floor(durationSeconds()/86400),
        moneyType=moneyType(),
        active=status.active==true,
        expiresAt=tonumber(status.expiresAt) or 0,
        autoRenew=status.autoRenew==true,
        renewError=status.renewError
    }
end

function FlecityGamesPartyPlus.CachedActive(id)
    local entry=id and cache[id] or nil
    return planEnabled() and entry~=nil and tonumber(entry.expiresAt)>os.time()
end

function FlecityGamesPartyPlus.HasAccess(source,id,allowRenew)
    id=id or identifier(source)
    if not id or not planEnabled() then return false,'PARTY_PLUS_DISABLED' end
    local row,renewError=resolve(source,id,allowRenew==true)
    return row~=nil and tonumber(row.expiresAt)>os.time(),renewError
end

function FlecityGamesPartyPlus.Subscribe(source)
    if not planEnabled() then return {ok=false,error='PARTY_PLUS_DISABLED'} end
    local id=identifier(source)
    if not id then return {ok=false,error='PLAYER_NOT_READY'} end
    local row=readRow(id)
    if row and row.expiresAt>os.time() then
        row.autoRenew=true
        MySQL.update.await([[UPDATE flecity_game_subscriptions SET auto_renew=1,updated_at=CURRENT_TIMESTAMP WHERE player_identifier=?]],{id})
        remember(id,row)
        return {ok=true,status=publicStatus(row)}
    end
    local updated,errorCode=purchasePeriod(source,id,row,false)
    if errorCode then return {ok=false,error=errorCode,status=publicStatus(updated,errorCode)} end
    return {ok=true,status=publicStatus(updated)}
end

function FlecityGamesPartyPlus.Cancel(source)
    local id=identifier(source)
    if not id then return {ok=false,error='PLAYER_NOT_READY'} end
    local row=readRow(id)
    if not row then return {ok=true,status=publicStatus(nil)} end
    row.autoRenew=false
    MySQL.update.await([[UPDATE flecity_game_subscriptions SET auto_renew=0,updated_at=CURRENT_TIMESTAMP WHERE player_identifier=?]],{id})
    remember(id,row)
    return {ok=true,status=publicStatus(row)}
end

function FlecityGamesPartyPlus.ClearCache(id)
    if id then cache[id]=nil end
end
