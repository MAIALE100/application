fx_version 'cerulean'
game 'gta5'
lua54 'yes'
author 'FRAME Project'
description 'FRAME - Flecity Photo Event Platform'
version '0.23.0-integration'
dependency 'oxmysql'
dependency 'lb-phone'
shared_scripts {'config/shared.lua'}
client_scripts {'client/main.lua'}
ui_page 'web/index.html'
server_scripts {'@oxmysql/lib/MySQL.lua','server/adapters/framework/qbox.lua','server/adapters/framework/standalone.lua','server/adapters/framework/loader.lua','server/repositories/events.lua','server/repositories/submissions.lua','server/services/permissions.lua','server/services/events.lua','server/services/submissions.lua','server/services/management.lua','server/services/ads.lua','server/main.lua'}
files {'web/index.html','web/app.css','web/app.js','web/icon.svg'}
