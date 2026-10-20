fx_version 'cerulean'
game 'gta5'
lua54 'yes'

author 'Flecity'
description 'Flecity Games - PLAY and PARTY LB Phone game platform'
version '0.1.0-core'

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
    'server/core/play.lua',
    'server/core/party.lua',
    'server/main.lua'
}

ui_page 'web/play/index.html'

files {
    'web/**/*',
    'sql/*.sql'
}

dependencies {
    'lb-phone',
    'oxmysql'
}
