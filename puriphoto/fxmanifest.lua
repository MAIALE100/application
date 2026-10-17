fx_version "cerulean"
game "gta5"

title "LB Phone - App Template | React TS"
description "A template for creating apps for the LB Phone."
author "Breze & Loaf"

shared_script "config.lua"
client_script "client/**.lua"

-- PuriPhoto full-screen editor NUI uses the same React build. The phone app
-- remains the controller; the editor layer is enabled by client/editor.lua.

file "ui/dist/**/*"

ui_page "ui/dist/index.html"
-- ui_page "http://localhost:3000/"
