fx_version 'cerulean'
game 'gta5'
lua54 'yes'

author 'Flecity'
description 'Flecity Games - LOOP and LINK LB Phone game platform'
version '0.75.3-test'

shared_scripts {
    'config/shared.lua',
    'shared/game_registry.lua'
}

client_scripts {
    'client/main.lua'
}

server_scripts {
    '@oxmysql/lib/MySQL.lua',
    'server/bridge/framework.lua',
    'server/core/rate_limit.lua',
    'server/core/database.lua',
    'server/core/text.lua',
    'server/core/profile.lua',
    'server/core/dev_reload.lua',
    'server/core/play.lua',
    'server/core/party_plus.lua',
    'server/core/party_fall.lua',
    'server/data/party_plus_prompts.lua',
    'server/core/party.lua',
    'server/main.lua'
}


files {
    'web/**/*',
    'sql/*.sql'
}

dependencies {
    'lb-phone',
    'oxmysql'
}
