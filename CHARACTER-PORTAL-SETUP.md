# County Line Roleplay — Character Portal Setup

This repository contains the first integration build for linking QBCore characters to the Discord-authenticated website portal.

## 1. D1 schema

Open Cloudflare → Workers & Pages → D1 SQL Database → clrp-player-portal → Console.

Run the contents of cloudflare-character-schema.sql. Keep the existing portal and applications tables.

## 2. Deploy the complete Worker

Open cloudflare-worker.js in this repository. It contains the complete Worker code, preserving the existing Discord OAuth and application submission routes while adding the character-linking and sync routes.

Replace the code in the clrp-player-portal-api Worker editor with the complete contents of cloudflare-worker.js.

In Worker Settings → Variables and Secrets, add a SECRET:
- Name: CLRP_SERVER_SECRET
- Value: a long random secret (at least 32 random characters)

Keep all existing Worker variables and secrets, including DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET, FRONTEND_ORIGIN, FRONTEND_PORTAL_URL, and DISCORD_REDIRECT_URI. The D1 binding must remain named DB.

Deploy the Worker after replacing the code.

## 3. Upload the FiveM resource

Upload fivem-resource/clrp_portal to your GPORTAL server under a resources folder, e.g. resources/[local]/clrp_portal.

Add these lines to server.cfg after qb-core and oxmysql are ensured:

    set clrp_portal_api_url "https://clrp-player-portal-api.blakealley2.workers.dev"
    set clrp_portal_api_secret "USE_THE_EXACT_SAME_SECRET_AS_CLOUDFLARE"
    ensure clrp_portal

The secret value must exactly match the CLRP_SERVER_SECRET value in Cloudflare. Do not put it in website JavaScript, HTML, or any client-side file.

## 4. Character linking

- Sign in at the website and open Player Portal → My Character.
- Select Generate linking code.
- Enter the desired character in FiveM, then run /linkportal 12345678 with the displayed code.
- Repeat with a newly generated code for every additional character.

Codes expire after 10 minutes and can be used once. A citizen ID already claimed by another Discord account cannot be linked again through this flow.

## 5. Data sync

The resource syncs linked characters every 30 seconds. It reads:
- QBCore PlayerData: identity, cash, bank, job, and gang.
- player_vehicles: vehicle model, plate, garage, and state.
- player_houses joined to houselocations: owned properties.
- ps-mdt v3: arrest history, recorded charges, and fine amounts.

The resource never queries active warrants, inventory, or weapons.

Fine status limitation: Standard ps-mdt v3 stores the recorded fine amount on mdt_reports_charges, but that table does not provide a paid/unpaid flag. The portal can show fine amounts and charge history, but cannot accurately label a fine as outstanding or paid without a separate payment-status source.

Garage compatibility: jg-advancedgarages versions can customize vehicle storage columns. This build reads the common QBCore player_vehicles columns vehicle, plate, garage, and state. If your table differs, adjust the query to your exact schema before enabling sync.

ps-mdt compatibility: The criminal-history adapter targets the current official ps-mdt v3 schema. If your installed release uses an older schema, the optional query will log a warning and the character profile will still sync without those records. Active warrants are excluded in every case.

Privacy: Only the authenticated Discord account that linked a citizen ID can retrieve that character's data.
