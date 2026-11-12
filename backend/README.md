# County Line Roleplay Portal API

Discord OAuth backend for the GitHub Pages player portal. This Worker keeps the Discord client secret and session records server-side.

## 1. Create the Discord OAuth application
1. In the Discord Developer Portal, create an application for County Line Roleplay.
2. Open **OAuth2** and add the exact redirect URL: `https://YOUR-WORKER-HOST/auth/callback`.
3. Copy the Application ID and generate a Client Secret. Keep the secret private.

## 2. Create the Cloudflare backend
1. Install Node.js and Wrangler, then run `npm install -g wrangler`.
2. From this folder, run `wrangler login`.
3. Create the D1 database: `wrangler d1 create county-line-roleplay-portal`.
4. Put the returned database ID in `wrangler.toml` in place of `REPLACE_WITH_D1_DATABASE_ID`.
5. Initialize tables: `wrangler d1 execute county-line-roleplay-portal --remote --file=schema.sql`.
6. Set secrets:
   - `wrangler secret put DISCORD_CLIENT_ID`
   - `wrangler secret put DISCORD_CLIENT_SECRET`
7. Set `FRONTEND_ORIGIN` to the exact deployed website origin (for this repo: `https://vinitive.github.io`), `FRONTEND_PORTAL_URL` to the full portal page URL (including `/County-Line-Roleplay-Website/portal.html`), and `DISCORD_REDIRECT_URI` to the exact callback URL. Update the Discord OAuth redirect URL to match.
8. Deploy: `wrangler deploy`.
9. Test `https://YOUR-WORKER-HOST/health` and `https://YOUR-WORKER-HOST/auth/discord`.

## 3. Connect the website
Set `portalApiUrl` in the root `config.js` to the deployed Worker base URL, commit, and allow GitHub Pages to redeploy.

**Cookie note:** the Worker uses secure, HttpOnly cookies with cross-origin credentials. For the most reliable browser behavior, use a custom API hostname on the same site as the website (for example, `api.yourdomain.com`) and configure CORS to the exact website origin. Some browsers restrict third-party cookies when the site remains on `github.io`.

## Current scope and security
- Discord OAuth authorization-code flow with a one-time state value.
- Discord identity lookup and seven-day server-side sessions.
- Session tokens are stored only as SHA-256 hashes in D1; cookies are HttpOnly and Secure.
- CORS is restricted to the configured frontend origin.
- No Discord client secret or database credential belongs in GitHub Pages files.

This first backend milestone authenticates Discord accounts only. It deliberately does not expose QBCore player records yet. Character linking requires a separate QBCore server resource that issues and verifies one-time in-game codes; do not ask players to enter license identifiers into the website. Staff permissions and character data must be enforced server-side before those features are enabled.
