# County Line CAD / MDT

Custom shared CAD/MDT for County Line Roleplay. The FiveM NUI and website use the same Cloudflare Worker and D1 records.

## Included
- Active dispatch calls and priority queue
- Unit roster and unit status
- Call creation, assignment, status updates, and closure
- Citizen and vehicle record search (linked character data)
- Incident reports, arrest reports, citations, and BOLO creation
- Discord permission checks for website access
- QBCore job checks for in-game access
- Server-side API secret; no secret is exposed to NUI/browser code

## Install the database
1. Open the Cloudflare dashboard and select the D1 database named `clrp-player-portal`.
2. Open its SQL console.
3. Run the complete contents of `database/cad_schema.sql`.

## Deploy the Worker
Deploy the updated root `cloudflare-worker.js` to the existing Worker. Keep the existing environment variables and D1 binding.

## Install the FiveM resource
1. Copy the entire `fivem/clrp_cad` folder into your server's resources folder.
2. Confirm `CLRP_SERVER_SECRET` is already set in server.cfg (the same secret used by the player portal sync).
3. Add `ensure clrp_cad` after `qb-core` in server.cfg.
4. Remove/disable `ps-mdt` after confirming the new CAD works.

## Job configuration
Edit `config.lua` to match your actual QBCore job names. Defaults:
- Law Enforcement: police, sheriff, state, bcso, lspd, sasp
- Dispatch: dispatch

The resource requires the player to be on duty by default. Change `Config.RequireOnDuty` only if you want off-duty access.

## Access
- Website: sign into the Player Portal with Discord, then choose Staff Center → Open CAD / MDT. Discord roles are rechecked by the Worker on every request.
- In game: use `/mdt` or the configured F6 key. The server checks the player's QBCore job and duty status.

Dispatch can manage calls and units. Law Enforcement also has records search, reports, and BOLO creation.

## Important first-version notes
This is the initial custom CAD foundation. Citizen search uses characters already synchronized to the portal. Vehicle search currently searches the synced character payload for matching plate/vehicle data. Additional structured vehicle detail, advanced report forms, citations workflow, and audit-log viewer can be expanded after the initial install is verified.
