fx_version 'cerulean'
game 'gta5'
lua54 'yes'

author 'County Line Roleplay'
description 'County Line Roleplay custom CAD/MDT'
version '1.0.0'

ui_page 'web/index.html'

shared_scripts {
  'config.lua'
}

client_scripts {
  'client.lua'
}

server_scripts {
  'server.lua'
}

files {
  'web/index.html',
  'web/style.css',
  'web/app.js'
}

dependency 'qb-core'
