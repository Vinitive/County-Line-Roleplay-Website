/*
 * County Line Roleplay public website configuration.
 * Only put public URLs here. NEVER put database passwords, API secrets,
 * server tokens, or private credentials in this file.
 */
window.CLRP_CONFIG = {
  // Example: "https://discord.gg/your-invite"
  discordInviteUrl: "https://discord.gg/REPLACE_ME",

  // Example: "https://cfx.re/join/yourcode"
  connectUrl: "",

  // Public API endpoint returning:
  // { "online": true, "players": 12, "maxPlayers": 64 }
  // This must be served by your separate backend/API, not GitHub Pages.
  statusApiUrl: "",

  // Secure player portal URL once authentication is implemented.
  portalUrl: ""
};