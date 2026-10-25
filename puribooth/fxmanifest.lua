fx_version "cerulean"
game "gta5"

name "puribooth"
author "Flecity"
description "Street purikura booth integration for PuriPhoto"
version "0.3.0"

shared_script "config.lua"

server_scripts {
    "@oxmysql/lib/MySQL.lua",
    "server/main.lua"
}

client_script "client/main.lua"

ui_page "ui/index.html"

files {
    "ui/index.html",
    "ui/style.css",
    "ui/app.js",
    "ui/surface.html"
}

dependencies {
    "qbx_core",
    "oxmysql",
    "lb-phone",
    "screenshot-basic"
}
