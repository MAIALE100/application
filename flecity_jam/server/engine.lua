-- No FiveM globals here: the same state machine runs in native Lua regression tests.
JamEngine = {}
JamEngine.__index = JamEngine

local function integer(n, lo, hi)
    return type(n) == 'number' and n == n and n % 1 == 0 and n >= lo and n <= hi
end
local function number(n, lo, hi)
    return type(n) == 'number' and n == n and n >= lo and n <= hi
end
local function count(t) local n = 0; for _ in pairs(t) do n = n + 1 end; return n end
local function array(t, limit)
    if type(t) ~= 'table' then return false end
    local n = #t
    if n > limit or count(t) ~= n then return false end
    for k in pairs(t) do if not integer(k, 1, n) then return false end end
    return true
end
local function position(p)
    return type(p) == 'table' and number(p.x, -100000, 100000) and number(p.y, -100000, 100000)
        and number(p.z, -100000, 100000) and integer(p.bucket, 0, 2147483647) and p.alive == true
end

function JamEngine.new(config, catalog, env)
    return setmetatable({ c = config, catalog = catalog, env = env, sessions = {}, guards = {}, serial = 0, wire = 0 }, JamEngine)
end

function JamEngine:send(target, data)
    self.wire = self.wire + 1
    local packet = {}
    for k,v in pairs(data) do packet[k] = v end
    packet.wire = self.wire
    self.env.send(target, 'remote', packet)
end

function JamEngine:allow(src, cost)
    local now = self.env.now()
    local g = self.guards[src] or { tokens = self.c.EventBurst, time = now, start = -10000 }
    self.guards[src] = g
    g.tokens = math.min(self.c.EventBurst, g.tokens + math.max(0, now - g.time) * self.c.EventsPerSecond / 1000)
    g.time = now
    if g.tokens < cost then return false end
    g.tokens = g.tokens - cost
    return true
end

function JamEngine:visible(src, target, origin)
    if src == target then return false end
    local a, b = origin or self.env.position(src), self.env.position(target)
    if not position(a) or not position(b) or a.bucket ~= b.bucket then return false end
    return (a.x-b.x)^2 + (a.y-b.y)^2 + (a.z-b.z)^2 < self.c.Range^2
end

function JamEngine:snapshot(s)
    local notes, now = {}, self.env.now()
    for _, n in pairs(s.notes) do
        notes[#notes+1] = { id = n.id, pitch = n.pitch, velocity = n.velocity, held = n.held, age = math.max(0, now-n.at) }
    end
    table.sort(notes, function(a,b) return a.id < b.id end)
    return { kind = 'snapshot', player = s.src, session = s.id, rev = s.rev, instrument = s.instrument,
        volume = s.volume, sustain = s.sustain, notes = notes, range = self.c.Range }
end

function JamEngine:route(s, delta, force)
    local nextPeers = {}
    local candidates, origin = {}, self.env.position(s.src)
    if delta and not force then for id in pairs(s.peers) do candidates[#candidates+1] = id end
    else candidates = self.env.players() end
    for _, id in ipairs(candidates) do
        if self:visible(s.src, id, origin) then
            nextPeers[id] = true
            if not s.peers[id] or force then self:send(id, self:snapshot(s))
            elseif delta then self:send(id, delta) end
        end
    end
    for id in pairs(s.peers) do
        if not nextPeers[id] then
            self:send(id, { kind = 'stop', player = s.src, session = s.id, rev = s.rev })
        end
    end
    s.peers = nextPeers
end

function JamEngine:start(src, instrument, request)
    if not self:allow(src, 12) then return false, 'rate' end
    local now, g = self.env.now(), self.guards[src]
    if now-g.start < 750 then return false, 'cooldown' end
    g.start = now
    if not integer(request, 1, 2147483647) or type(instrument) ~= 'string' or not self.catalog[instrument] then return false, 'instrument' end
    if not position(self.env.position(src)) then return false, 'unavailable' end
    if not self.env.access(src, instrument) then return false, 'permission' end
    if not self.sessions[src] and count(self.sessions) >= self.c.MaxPerformers then return false, 'capacity' end
    self:stop(src, 'replaced')
    self.serial = self.serial + 1
    local s = { src=src, id=self.env.epoch..':'..self.serial, instrument=instrument, notes={}, peers={},
        sustain=false, volume=0.75, seq=0, rev=0, last=now, lastSnapshot=now, highId=0 }
    self.sessions[src] = s
    self.env.send(src, 'control', { kind='started', session=s.id, request=request, instrument=instrument, range=self.c.Range,
        maxNotes=self.c.MaxNotes, maxNoteMs=self.c.MaxNoteMs })
    self:route(s, nil, true)
    return true
end

function JamEngine:stop(src, reason)
    local s = self.sessions[src]
    if not s then return end
    self.sessions[src] = nil
    for id in pairs(s.peers) do self:send(id, {kind='stop', player=src, session=s.id, rev=s.rev+1}) end
    self.env.send(src, 'control', {kind='stopped', session=s.id, reason=reason})
end

function JamEngine:validNote(n, instrument)
    local spec = self.catalog[instrument]
    return type(n) == 'table' and integer(n.id, 1, 2147483647) and integer(n.pitch, spec.min, spec.max)
        and integer(n.velocity, 1, 127) and (not spec.drumNotes or spec.drumNotes[n.pitch] == true)
end

function JamEngine:receive(src, packet)
    if not self:allow(src, 1) then self:stop(src, 'rate'); return false, 'rate' end
    local s = self.sessions[src]
    if not s or type(packet) ~= 'table' or packet.session ~= s.id then return false, 'session' end
    if not integer(packet.seq, 1, 2147483647) or packet.seq <= s.seq then return false, 'stale' end
    if not position(self.env.position(src)) or not self.env.access(src, s.instrument) then self:stop(src, 'unavailable'); return false, 'unavailable' end
    local now = self.env.now()
    local cleanOps = {}
    local function invalid(reason) self:stop(src, reason); return false, reason end
    if packet.kind == 'sync' then
        if not array(packet.notes, self.c.MaxNotes) or type(packet.sustain) ~= 'boolean' or not number(packet.volume, 0, 1) then return invalid('invalid') end
        if not self:allow(src, #packet.notes) then return invalid('rate') end
        local notes, high = {}, s.highId
        for _, n in ipairs(packet.notes) do
            if not self:validNote(n, s.instrument) or type(n.held) ~= 'boolean' or notes[n.id] or (not n.held and not packet.sustain) then return invalid('invalid') end
            local old = s.notes[n.id]
            if old and (old.pitch ~= n.pitch or old.velocity ~= n.velocity) then return invalid('invalid') end
            -- A retired identity may not be resurrected by a delayed heartbeat.
            if not old and n.id <= s.highId then return invalid('retired') end
            notes[n.id] = {id=n.id,pitch=n.pitch,velocity=n.velocity,held=n.held,at=old and old.at or now}
            high = math.max(high, n.id)
        end
        s.notes, s.highId, s.sustain, s.volume = notes, high, packet.sustain, packet.volume
    elseif packet.kind == 'ops' then
        if packet.seq ~= s.seq + 1 then
            -- A complete input snapshot heals a missing batch; don't apply a partial chord.
            self.env.send(src, 'control', {kind='resync',session=s.id})
            return false, 'gap'
        end
        if not array(packet.ops, self.c.MaxOps) or #packet.ops == 0 then return invalid('invalid') end
        if not self:allow(src, #packet.ops) then return invalid('rate') end
        for _, op in ipairs(packet.ops) do
            if type(op) ~= 'table' then return invalid('invalid') end
            if op.kind == 'on' then
                if not self:validNote(op,s.instrument) or op.id <= s.highId or count(s.notes) >= self.c.MaxNotes then return invalid('invalid') end
                s.highId = op.id
                s.notes[op.id] = {id=op.id,pitch=op.pitch,velocity=op.velocity,held=true,at=now}
                cleanOps[#cleanOps+1] = {kind='on',id=op.id,pitch=op.pitch,velocity=op.velocity}
            elseif op.kind == 'off' then
                if not integer(op.id,1,2147483647) then return invalid('invalid') end
                local n = s.notes[op.id]
                if n then n.held = false; if not s.sustain then s.notes[op.id] = nil end end
                cleanOps[#cleanOps+1] = {kind='off',id=op.id}
            elseif op.kind == 'kill' then
                if not integer(op.id,1,2147483647) then return invalid('invalid') end
                s.notes[op.id] = nil
                cleanOps[#cleanOps+1] = {kind='kill',id=op.id}
            elseif op.kind == 'pedal' then
                if type(op.down) ~= 'boolean' then return invalid('invalid') end
                s.sustain = op.down
                if not op.down then for id,n in pairs(s.notes) do if not n.held then s.notes[id]=nil end end end
                cleanOps[#cleanOps+1] = {kind='pedal',down=op.down}
            elseif op.kind == 'volume' then
                if not number(op.value,0,1) then return invalid('invalid') end
                s.volume = op.value
                cleanOps[#cleanOps+1] = {kind='volume',value=op.value}
            elseif op.kind == 'panic' then s.notes = {}; s.sustain = false; cleanOps[#cleanOps+1] = {kind='panic'}
            else return invalid('invalid') end
        end
    else return invalid('invalid') end
    s.seq, s.last, s.rev = packet.seq, now, s.rev+1
    if packet.kind == 'sync' then
        s.lastSnapshot = now
        self:route(s,nil,true)
    else
        self:route(s,{kind='delta', player=src, session=s.id, rev=s.rev, ops=cleanOps},false)
    end
    return true
end

function JamEngine:tick()
    local now = self.env.now()
    for src,s in pairs(self.sessions) do
        local expired = now-s.last > self.c.SessionTimeoutMs
        for _,n in pairs(s.notes) do if now-n.at > self.c.MaxNoteMs then expired = true end end
        if expired or not position(self.env.position(src)) or not self.env.access(src,s.instrument) then self:stop(src,'expired')
        else
            local force = now-s.lastSnapshot >= self.c.SnapshotMs
            if force then s.lastSnapshot = now end
            self:route(s,nil,force)
        end
    end
    for src,g in pairs(self.guards) do if not self.sessions[src] and now-g.time > 60000 then self.guards[src] = nil end end
end

function JamEngine:drop(src)
    self:stop(src, 'disconnect')
    self.guards[src] = nil
    for _,s in pairs(self.sessions) do s.peers[src] = nil end
end
