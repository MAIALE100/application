fx_version 'cerulean'
game 'gta5'
author 'Flecity'
version '0.5.1-test'
description 'Independent proximity instruments for Flecity'
dependency '/onesync'
nui_callback_strict_mode 'true'
shared_script 'config.lua'
client_scripts { 'client/presentation.lua', 'client/main.lua' }
server_scripts { 'server/engine.lua', 'server/access.lua', 'server/main.lua' }
ui_page 'web/index.html'
files { 'web/index.html', 'web/*.css', 'web/*.mjs', 'web/catalog.json', 'web/samples/**/*' }
