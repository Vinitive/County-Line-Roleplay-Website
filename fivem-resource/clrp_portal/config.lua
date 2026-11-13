Config = {}

Config.ApiUrl = GetConvar('clrp_portal_api_url', 'https://clrp-player-portal-api.blakealley2.workers.dev')
Config.ApiSecret = GetConvar('clrp_portal_api_secret', '')

Config.LinkCommand = 'linkportal'
Config.SyncInterval = 30000
Config.MaxVehicles = 75
Config.MaxRecords = 50

Config.Housing = {
    enabled = true,
    ownershipTable = 'player_houses',
    locationsTable = 'houselocations'
}

Config.PsMdt = {
    enabled = true
}
