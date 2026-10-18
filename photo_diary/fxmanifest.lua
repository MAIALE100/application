fx_version 'cerulean'
game 'gta5'
lua54 'yes'

author 'Weazel News'
description 'Photo Diary - LB Phone private memory diary'
version '1.0.0-payment-pending'

shared_scripts { 'shared/config.lua' }
client_scripts { 'client/main.lua' }
server_scripts { '@oxmysql/lib/MySQL.lua', 'server/framework.lua', 'server/main.lua' }

files { 'ui/index.html', 'ui/app.js', 'ui/style.css', 'ui/icon.png' }

dependency 'lb-phone'
dependency 'oxmysql'
