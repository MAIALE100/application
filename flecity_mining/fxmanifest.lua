fx_version '0.3.7-dev'
game 'gta5'
lua54 'yes'

author 'Flecity'
description 'Flecity public solo mining job - beginner-friendly no-level money loop'
version '0.3.0-dev'

shared_scripts {
    'config/gameplay.lua',
    'config/economy.lua',
    'config/locations.lua'
}

client_script 'client/main.lua'

server_scripts {
    'server/selftest.lua',
    'server/main.lua'
}

dependency 'qbx_core'
