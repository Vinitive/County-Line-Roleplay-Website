# clrp_portal — County Line Roleplay

A QBCore server resource that securely links individual characters to a player's Discord-authenticated County Line website account and syncs approved character data to the portal.

## Included in this first integration build

- One-time 8-digit website-generated link codes.
- In-game command: `/linkportal 12345678`.
- Multiple characters can be linked to the same website account by generating a new code for each character.
- Automatic online sync every 30 seconds.
- QBCore profile, cash, bank, job, gang, vehicles, and qb-houses property ownership.
- ps-mdt v3 arrest history, recorded charges, and fine amounts.
- Active warrants are never queried or returned.
- Inventory and weapons are never queried or returned.
- A character already linked to another Discord account cannot be claimed by a second account.

## Requirements

- QBCore
- oxmysql
- player_vehicles table (used by jg-advancedgarages / QBCore)
- qb-houses tables: player_houses and houselocations (optional; can be disabled in config)
- ps-mdt v3 tables (optional; can be disabled in config)
- Cloudflare Worker character API routes and D1 tables from the website repository

## Installation

1. Upload the entire `clrp_portal` folder to your server resources, for example:
   `resources/[local]/clrp_portal`
2. Add the following lines to `server.cfg` after qb-core and oxmysql are ensured:

```cfg
set clrp_portal_api_url "https://clrp-player-portal-api.blakealley2.workers.dev"
set clrp_portal_api_secret "PASTE_THE_SAME_RANDOM_SECRET_CONFIGURED_IN_CLOUDFLARE"
ensure clrp_portal
```

3. In Cloudflare Worker settings, create a secret named `CLRP_SERVER_SECRET` with the exact same random secret.
4. Add the D1 schema from `cloudflare-character-schema.sql` to the existing `clrp-player-portal` database.
5. Add the routes from `cloudflare-character-api-addition.js` to the existing Worker. Do not replace the Discord OAuth routes.
6. Deploy the Worker.
7. Restart the FiveM resource or server.

## Linking characters

1. Sign in to the website and open Player Portal → My Character.
2. Click **Generate linking code**.
3. While logged into the desired character on the FiveM server, enter:
   `/linkportal 12345678`
4. Repeat for each additional character. Generate a fresh code for every character.

Codes expire after 10 minutes and can only be used once.

## Data notes

- Cash and bank come from the active QBCore PlayerData money fields.
- Vehicles are read from `player_vehicles`; model, plate, garage, and raw garage state are synced. jg-advancedgarages installations can customize that table, so verify its fields before enabling if your schema differs.
- qb-houses uses the standard `player_houses.house` → `houselocations.name` join.
- ps-mdt v3 charges and arrests are read from `mdt_reports_charges`, `mdt_arrests`, and `mdt_reports`. Fine amounts are recorded fine amounts; ps-mdt v3's charge table does not itself indicate whether a fine has been paid. This build therefore does not label them as outstanding/paid.
- Active warrants are intentionally excluded from all queries and API payloads.
- The website displays the last stored snapshot while a character is offline. Online status and data refresh every 30 seconds.

## Security

- Keep the API secret only in the GPORTAL server.cfg convar and Cloudflare Worker secret. Never put it in website files or send it to clients.
- Only character IDs claimed through a valid one-time code can be synced.
- The website API only returns characters linked to the authenticated Discord session.
- The resource never reads player inventory or weapon data.
