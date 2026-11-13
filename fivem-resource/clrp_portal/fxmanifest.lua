fx_version 'cerulean'
game 'gta5'
lua54 'yes'

name 'clrp_portal'
author 'County Line Roleplay'
description 'Secure QBCore character linking and player portal synchronization'
version '1.0.0'

shared_script 'config.lua'
server_script 'server.lua'

dependencies {
    'qb-core',
    'oxmysql'
}
