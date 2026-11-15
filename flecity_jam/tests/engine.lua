dofile('config.lua')
dofile('server/engine.lua')
local passed = 0
local function test(name, fn)
    local ok,err=pcall(fn)
    if not ok then error('FAIL '..name..': '..tostring(err)) end
    passed=passed+1; print('PASS '..name)
end
local function equal(a,b) assert(a==b,tostring(a)..' ~= '..tostring(b)) end
local function fixture()
    local clock=1000
    local people={[1]={x=0,y=0,z=0,bucket=0,alive=true},[2]={x=2,y=0,z=0,bucket=0,alive=true},
        [3]={x=50,y=0,z=0,bucket=0,alive=true},[4]={x=1,y=0,z=0,bucket=1,alive=true}}
    local messages, permitted = {}, true
    local config={};for k,v in pairs(JamConfig) do config[k]=v end
    local catalog={piano={min=36,max=96},guitar={min=45,max=88},drums={min=36,max=51,drumNotes={[36]=true,[38]=true}}}
    local e=JamEngine.new(config,catalog,{epoch='test',now=function() return clock end,
        position=function(id) return people[id] end,
        players=function() local ids={};for id in pairs(people)do ids[#ids+1]=id end;return ids end,
        access=function()return permitted end,
        send=function(target,event,data)messages[#messages+1]={target=target,event=event,data=data}end})
    local f={e=e,people=people,messages=messages}
    function f.advance(ms)clock=clock+ms end
    function f.access(value)permitted=value end
    function f.start(id,instrument) assert(e:start(id or 1,instrument or 'piano',1));return e.sessions[id or 1] end
    function f.packet(ops,id,seq)id=id or 1;local s=e.sessions[id];return e:receive(id,{session=s.id,seq=seq or s.seq+1,kind='ops',ops=ops})end
    function f.sync(notes,sustain,id,seq)id=id or 1;local s=e.sessions[id];return e:receive(id,{session=s.id,seq=seq or s.seq+1,kind='sync',notes=notes,sustain=sustain or false,volume=.5})end
    return f
end
local function on(id,pitch)return {kind='on',id=id,pitch=pitch or 60,velocity=100}end
test('distance and bucket exclude unauthorized listeners',function()
    local f=fixture();f.start();f.packet({on(1)})
    for _,m in ipairs(f.messages)do if m.event=='remote' then equal(m.target,2) end end
end)
test('chords, hold, sustain and release',function()
    local f=fixture();local s=f.start();assert(f.packet({on(1,60),on(2,64),on(3,67)}));equal(s.notes[3].pitch,67)
    f.packet({{kind='pedal',down=true},{kind='off',id=1}});equal(s.notes[1].held,false)
    f.packet({{kind='pedal',down=false}});equal(s.notes[1],nil);assert(s.notes[2])
end)
test('same pitch retriggers have independent identities',function()
    local f=fixture();local s=f.start();f.packet({on(1),{kind='pedal',down=true},{kind='off',id=1},on(2)})
    assert(s.notes[1] and s.notes[2]);f.packet({{kind='kill',id=1}});equal(s.notes[1],nil);assert(s.notes[2])
end)
test('replayed and out-of-order frames cannot alter notes',function()
    local f=fixture();local s=f.start();f.packet({on(1)});assert(not f.packet({{kind='off',id=1}},1,1));assert(s.notes[1])
    assert(not f.packet({{kind='off',id=1}},1,3));assert(s.notes[1]);assert(f.sync({},false,1,4));equal(next(s.notes),nil)
end)
test('input snapshot repairs a missing off',function()
    local f=fixture();local s=f.start();f.packet({on(1)});f.advance(1000);f.sync({});equal(next(s.notes),nil)
end)
test('late join receives held age without reattack',function()
    local f=fixture();f.start();f.packet({on(1)});f.advance(1200);f.people[3].x=2;f.e:tick()
    local found=false
    for _,m in ipairs(f.messages)do if m.target==3 and m.data.kind=='snapshot' then found=true;equal(m.data.notes[1].age,1200) end end
    assert(found)
end)
test('moving out and back uses ordered delivery without new note',function()
    local f=fixture();f.start();f.packet({on(1)});f.people[2].x=20;f.e:tick()
    local last=f.messages[#f.messages];equal(last.data.kind,'stop');local wire=last.data.wire
    f.people[2].x=3;f.e:tick();last=f.messages[#f.messages];equal(last.data.kind,'snapshot');assert(last.data.wire>wire);equal(last.data.notes[1].id,1)
end)
test('bucket switch removes previously authorized receiver',function()
    local f=fixture();f.start();f.packet({on(1)});f.people[2].bucket=2;f.e:tick();equal(f.messages[#f.messages].data.kind,'stop')
end)
test('multiple performers do not share notes or pedals',function()
    local f=fixture();local a=f.start();local b=f.start(2,'guitar');f.packet({on(1)});f.packet({on(1,64)},2)
    equal(a.notes[1].pitch,60);equal(b.notes[1].pitch,64);f.e:stop(1,'test');assert(f.e.sessions[2].notes[1])
end)
test('NaN infinity invalid instruments notes and velocities fail closed',function()
    local f=fixture();assert(not f.e:start(1,'fake',1))
    for _,op in ipairs({on(1,0/0),on(1,math.huge),on(1,128),{kind='on',id=1,pitch=60,velocity=0},{kind='volume',value=-1}})do
        f=fixture();f.start();assert(not f.packet({op}));equal(f.e.sessions[1],nil)
    end
end)
test('foreign session cannot emit or stop the owner',function()
    local f=fixture();local s=f.start();assert(not f.e:receive(2,{session=s.id,seq=1,kind='ops',ops={on(1)}}));equal(next(s.notes),nil)
end)
test('permission revocation and item removal stop an existing session',function()
    local f=fixture();f.start();f.access(false);f.e:tick();equal(f.e.sessions[1],nil)
end)
test('server validates note polyphony and sparse input',function()
    local f=fixture();f.start();local ops={};for i=1,17 do ops[i]=on(i)end;assert(not f.packet(ops));equal(f.e.sessions[1],nil)
    f=fixture();f.start();assert(not f.packet({[2]=on(1)}));equal(f.e.sessions[1],nil)
end)
test('unknown client fields are not forwarded',function()
    local f=fixture();f.start();local op=on(1);op.extra=string.rep('x',10000);f.packet({op})
    equal(f.messages[#f.messages].data.ops[1].extra,nil)
end)
test('rate limit cuts off spam and supports normal trills',function()
    local f=fixture();f.start();for i=1,100 do f.advance(50);assert(f.packet({on(i),{kind='off',id=i}})) end
    local stopped=false;for i=101,300 do if not f.e.sessions[1] then stopped=true;break end;f.packet({on(i),{kind='off',id=i}})end
    assert(stopped)
end)
test('timeout death disconnect and resource-style stop clean peers',function()
    for _,reason in ipairs({'timeout','death','disconnect','resource'})do
        local f=fixture();f.start();f.packet({on(1)})
        if reason=='timeout' then f.advance(4501);f.e:tick()
        elseif reason=='death' then f.people[1].alive=false;f.e:tick()
        elseif reason=='disconnect' then f.e:drop(1)
        else f.e:stop(1,'resource_stop')end
        equal(f.e.sessions[1],nil)
        local found=false;for _,m in ipairs(f.messages)do if m.target==2 and m.data.kind=='stop'then found=true end end;assert(found)
    end
end)
test('missing entities and unavailable coordinates do not leak sound',function()
    local f=fixture();f.people[1]=nil;assert(not f.e:start(1,'piano',1));f=fixture();f.people[2].x=0/0;f.start();equal(#f.messages,1)
end)
test('session replacement rejects old packets',function()
    local f=fixture();local old=f.start();f.advance(800);local new=f.start();assert(old.id~=new.id)
    assert(not f.e:receive(1,{session=old.id,seq=1,kind='ops',ops={on(1)}}));equal(next(new.notes),nil)
end)
test('drums only accept mapped GM pitches',function()
    local f=fixture();f.start(1,'drums');assert(not f.packet({on(1,37)}));equal(f.e.sessions[1],nil)
end)
test('retired identities cannot be resurrected',function()
    local f=fixture();f.start();f.packet({on(1),{kind='off',id=1}})
    assert(not f.sync({{id=1,pitch=60,velocity=100,held=true}}));equal(f.e.sessions[1],nil)
end)
test('thirty simulated minutes with eight players stays bounded',function()
    local f=fixture();for id=1,8 do f.people[id]={x=id/4,y=0,z=0,bucket=0,alive=true};f.start(id) end
    for step=1,1800 do
        f.advance(1000)
        for id=1,8 do assert(f.packet({on(step),{kind='off',id=step}},id));f.sync({},false,id)end
        f.e:tick();for _,s in pairs(f.e.sessions)do equal(next(s.notes),nil)end
        -- Test capture isn't the production server; discard consumed deliveries.
        for i=#f.messages,1,-1 do f.messages[i]=nil end
    end
    equal(f.e.serial,8)
end)
print(('RESULT %d PASS / 0 FAIL (Lua simulation; NOT live FiveM)'):format(passed))
