fx_version 'cerulean'
game 'gta5'
lua54 'yes'

author 'Flecity'
description 'WAVE - Flecity music creation, streaming and marketplace for LB Phone'
version '0.3.5-test'

shared_scripts {
    'config/shared.lua'
}

client_scripts {
    'client/main.lua'
}

server_scripts {
    '@oxmysql/lib/MySQL.lua',
    'server/main.lua'
}

files {
    'web/**/*',
    'sql/*.sql'
}

dependencies {
    'lb-phone',
    'oxmysql',
    'qbx_core'
}
