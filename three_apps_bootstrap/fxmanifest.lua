fx_version 'cerulean'
game 'gta5'
lua54 'yes'

author 'Flecity App Dev'
description 'Bootstrap and schema installer for PuriPhoto, Photo Diary, and FRAME test stack'
version '1.0.0'

dependency 'oxmysql'
dependency 'lb-phone'

server_scripts {
    '@oxmysql/lib/MySQL.lua',
    'server/main.lua'
}

files {
    'sql/photo_diary.sql',
    'sql/frame.sql'
}
