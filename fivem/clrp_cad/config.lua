Config = {}

-- Set this to your Cloudflare Worker URL.
Config.ApiUrl = 'https://clrp-player-portal-api.blakealley2.workers.dev'

-- Keep the secret in server.cfg. Never put it in a client file.
Config.ServerSecretConvar = 'CLRP_SERVER_SECRET'

Config.Command = 'mdt'
Config.Keybind = 'F6'
Config.RequireOnDuty = true

-- Add or remove job names to match your QBCore server.
Config.LawEnforcementJobs = {
  police = true,
  sheriff = true,
  state = true,
  bcso = true,
  lspd = true,
  sasp = true
}

Config.DispatchJobs = {
  dispatch = true
}

Config.UnitStatuses = {
  'Available',
  'En Route',
  'On Scene',
  'Busy',
  'Out of Service'
}
