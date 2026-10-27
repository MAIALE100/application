-- WAVE rate-limiter regression: texlua wave-rate-limit-test.lua path/to/wave
local root = arg[1] or 'wave-check/wave'
local file = assert(io.open(root .. '/server/main.lua', 'rb'))
local source = file:read('*a')
file:close()
local marker = 'local function limited(source, key, ms)'
local start = assert(source:find(marker, 1, true), 'Missing rate limiter')
local stop = assert(source:find('\nend', start, true), 'Missing rate limiter end')
local snippet = source:sub(start, stop + 3) .. '\nreturn limited'
local now = 0
local env = setmetatable({rate = {}, GetGameTimer = function() return now end}, {__index = _G})
local chunk = assert(load(snippet, 'wave-limiter', 't', env))
local limited = chunk()
local function check(label, clock, player, action, cooldown, expected)
    now = clock
    local actual = limited(player, action, cooldown)
    assert(actual == expected, label .. ': expected ' .. tostring(expected) .. ', got ' .. tostring(actual))
    print('PASS: ' .. label)
end
check('first request at timer zero', 0, 1, 'save', 400, false)
check('immediate repeat blocked', 0, 1, 'save', 400, true)
check('within cooldown blocked', 399, 1, 'save', 400, true)
check('boundary accepted', 400, 1, 'save', 400, false)
check('different action independent', 400, 1, 'publish', 900, false)
check('different player independent', 400, 2, 'save', 400, false)
check('pre-wrap accepted', 2147483647, 1, 'save', 400, false)
check('post-wrap accepted', -2147483648, 1, 'save', 400, false)
check('post-wrap repeat blocked', -2147483647, 1, 'save', 400, true)
check('post-wrap boundary accepted', -2147483248, 1, 'save', 400, false)
print('WAVE rate-limit regression: PASS')
