-- County Line custom CAD/MDT schema
CREATE TABLE IF NOT EXISTS cad_units (
  citizenid TEXT PRIMARY KEY,
  callsign TEXT NOT NULL DEFAULT '',
  officer_name TEXT NOT NULL,
  job TEXT NOT NULL DEFAULT 'Law Enforcement',
  access TEXT NOT NULL CHECK (access IN ('leo','dispatch')),
  status TEXT NOT NULL DEFAULT 'Available',
  current_call_id TEXT,
  last_seen INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS cad_calls (
  id TEXT PRIMARY KEY,
  call_number TEXT NOT NULL UNIQUE,
  call_type TEXT NOT NULL,
  location TEXT NOT NULL,
  postal TEXT NOT NULL DEFAULT '',
  priority TEXT NOT NULL DEFAULT '3 - Routine',
  description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'Pending',
  created_by TEXT NOT NULL,
  created_by_name TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  closed_at INTEGER
);
CREATE TABLE IF NOT EXISTS cad_call_units (
  call_id TEXT NOT NULL,
  citizenid TEXT NOT NULL,
  callsign TEXT NOT NULL DEFAULT '',
  officer_name TEXT NOT NULL,
  assigned_at INTEGER NOT NULL,
  PRIMARY KEY (call_id, citizenid)
);
CREATE TABLE IF NOT EXISTS cad_records (
  id TEXT PRIMARY KEY,
  record_type TEXT NOT NULL,
  subject TEXT NOT NULL,
  title TEXT NOT NULL,
  details TEXT NOT NULL,
  officer_citizenid TEXT NOT NULL,
  officer_name TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS cad_bolos (
  id TEXT PRIMARY KEY,
  bolo_type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_by_name TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  active INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS cad_audit (
  id TEXT PRIMARY KEY,
  actor_id TEXT NOT NULL,
  actor_name TEXT NOT NULL,
  action TEXT NOT NULL,
  target_id TEXT,
  details TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_cad_calls_status ON cad_calls(status, created_at);
CREATE INDEX IF NOT EXISTS idx_cad_records_subject ON cad_records(subject);
CREATE INDEX IF NOT EXISTS idx_cad_bolos_active ON cad_bolos(active, created_at);
CREATE INDEX IF NOT EXISTS idx_cad_audit_created ON cad_audit(created_at);
