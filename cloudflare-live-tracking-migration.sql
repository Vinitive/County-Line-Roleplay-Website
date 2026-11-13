-- Live server status and playtime tracking additions.
-- Run once in Cloudflare D1: clrp-player-portal.

ALTER TABLE portal_characters ADD COLUMN playtime_seconds INTEGER NOT NULL DEFAULT 0;
ALTER TABLE portal_characters ADD COLUMN sessions_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE portal_characters ADD COLUMN first_joined INTEGER;

CREATE TABLE IF NOT EXISTS portal_server_status (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  server_name TEXT NOT NULL DEFAULT 'County Line Roleplay',
  player_count INTEGER NOT NULL DEFAULT 0,
  max_players INTEGER NOT NULL DEFAULT 32,
  last_heartbeat INTEGER NOT NULL
);
