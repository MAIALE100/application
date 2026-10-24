fx_version "cerulean"
game "gta5"

title "PuriPhoto"
description "Purikura-style photo editor app for LB Phone."
author "PuriPhoto"

shared_script "config.lua"

client_script "client/**.lua"

server_scripts {
    "@oxmysql/lib/MySQL.lua",
    "server/**.lua"
}

files {
    "ui/dist/**/*"
}

ui_page "ui/dist/index.html"
-- ui_page "http://localhost:3000/"

dependencies {
    "lb-phone",
    "oxmysql",
    "qbx_core"
}
