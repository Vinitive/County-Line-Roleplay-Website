# County Line Roleplay — Character Portal Setup

This is the first integration build for linking QBCore characters to the Discord-authenticated website portal.

## 1. D1 schema

Open Cloudflare → Workers & Pages → D1 SQL Database → clrp-player-portal → Console.

Run the contents of cloudflare-character-schema.sql.

## 2. Add the Worker routes

Open the clrp-player-portal-api Worker code.

Open cloudflare-character-api-addition.js in this repository and follow its two placement notes:
- Section A goes inside the existing try block, before the generic /api/ block.
- Section B goes inside that generic API block, after the existing portal session lookup and before the /api/me route.

Do not duplicate existing helpers. The current Worker already defines json, sha256, and the session lookup. The D1 binding is named DB.

In Worker Settings → Variables and Secrets, add a SECRET:
- Name: CLRP_SERVER_SECRET
- Value: a long random secret (at least 32 random characters)

Deploy the Worker after adding the routes.

## 3. Upload the FiveM resource

Upload fivem-resource/clrp_portal to your GPORTAL server under a resources folder, e.g. resources/[local]/clrp_portal.

Add these lines to server.cfg after qb-core and oxmysql are ensured:

    set clrp_portal_api_url "https://clrp-player-portal-api.blakealley2.workers.dev"
    set clrp_portal_api_secret "USE_THE_EXACT_SAME_SECRET_AS_CLOUDFLARE"
    ensure clrp_portal

Do not put the secret in website JavaScript, HTML, or any client-side file.

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

Privacy: Only the authenticated Discord account that linked a citizen ID can retrieve that character's data.
