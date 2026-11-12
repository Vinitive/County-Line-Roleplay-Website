# County Line Roleplay Website

A responsive GitHub Pages front end for the County Line Roleplay FiveM community.

## Current features
- Responsive home page and mobile navigation
- County Line branding and visual theme
- About, departments, community standards, applications, and player portal sections
- Configurable Discord invite and FiveM connect link
- Configurable live server status API integration

## GitHub Pages
1. Open **Settings → Pages** in this repository.
2. Under **Build and deployment**, select **Deploy from a branch**.
3. Select the `main` branch and `/(root)`, then save.
4. Wait for GitHub Pages to publish the site.

## Public configuration
Edit `config.js`:
- `discordInviteUrl`: public Discord invite
- `connectUrl`: public FiveM/Cfx connection URL
- `statusApiUrl`: public HTTPS endpoint for server status
- `portalUrl`: secure player portal URL when available

The status endpoint should return JSON in this format:

```json
{ "online": true, "players": 12, "maxPlayers": 64 }
```

The browser polls the status endpoint once per minute. Configure CORS on the API to allow your GitHub Pages origin.

## QBCore integration architecture
GitHub Pages is static hosting and cannot securely connect directly to the QBCore database. A separate backend is required for:
- Reading server and player data from QBCore/oxmysql
- Secure account authentication and session handling
- Player dashboard data
- Staff-only management actions

Do not put database credentials, server tokens, or private API keys in frontend files. The website currently provides the frontend foundation; live data and account authentication remain disabled until the backend is deployed and configured.


## Discord player portal

A dedicated `portal.html` page and Cloudflare Worker backend scaffold have been added. The portal supports Discord OAuth identity sign-in and server-side sessions after the backend is deployed.

**Backend setup is still required before sign-in works.** Follow [backend/README.md](backend/README.md) to create the Cloudflare D1 database, configure the Discord OAuth application and secrets, and deploy the Worker. Then set `portalApiUrl` in `config.js` to the Worker URL.

The current milestone authenticates Discord accounts only. QBCore character linking, character data, applications, and staff controls are not live yet; these require the separate in-game verification resource and server-side authorization checks.
