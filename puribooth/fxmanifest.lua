fx_version "cerulean"
game "gta5"

name "puribooth"
author "Flecity"
description "Street purikura booth integration for PuriPhoto"
version "0.1.0"

shared_script "config.lua"

client_script "client/main.lua"
server_script "server/main.lua"

ui_page "ui/index.html"

files {
    "ui/index.html",
    "ui/style.css",
    "ui/app.js"
}

dependencies {
    "qbx_core",
    "lb-phone"
}
