CREATE TABLE IF NOT EXISTS oauth_states (
  state TEXT PRIMARY KEY,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS portal_sessions (
  token_hash TEXT PRIMARY KEY,
  discord_id TEXT NOT NULL,
  username TEXT NOT NULL,
  global_name TEXT,
  avatar TEXT,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_portal_sessions_expiry ON portal_sessions(expires_at);
