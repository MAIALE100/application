fx_version '0.2.0-dev'
game 'gta5'
lua54 'yes'

author 'Flecity'
description 'BASE - shared workspace app for LB Phone'
version '0.1.1-dev'

shared_script 'config.lua'

client_script 'client/main.lua'

server_scripts {
    '@oxmysql/lib/MySQL.lua',
    'server/framework.lua',
    'server/database.lua',
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
