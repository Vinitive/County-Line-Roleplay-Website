-- County Line Roleplay character portal tables.
-- Run this in the existing Cloudflare D1 database: clrp-player-portal.

CREATE TABLE IF NOT EXISTS portal_link_codes (
  code_hash TEXT PRIMARY KEY,
  discord_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  used_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_portal_link_codes_expiry
ON portal_link_codes(expires_at);

CREATE TABLE IF NOT EXISTS portal_characters (
  citizenid TEXT PRIMARY KEY,
  discord_id TEXT NOT NULL,
  character_name TEXT NOT NULL DEFAULT 'Unknown Character',
  payload TEXT NOT NULL DEFAULT '{}',
  is_online INTEGER NOT NULL DEFAULT 0,
  last_seen INTEGER,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_portal_characters_discord
ON portal_characters(discord_id);
