fx_version "cerulean"
game "gta5"

title "LB Phone - App Template | React TS"
description "A template for creating apps for the LB Phone."
author "Breze & Loaf"

shared_script "config.lua"
client_script "client/**.lua"

files {
    "ui/dist/**/*",
    "editor/**/*"
}

ui_page "ui/dist/index.html"
-- ui_page "http://localhost:3000/"
