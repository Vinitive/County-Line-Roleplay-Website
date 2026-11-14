-- Founder-only record removal. Removed records remain recoverable and audit history is retained.
ALTER TABLE cad_arrests ADD COLUMN deleted_at INTEGER;
ALTER TABLE cad_arrests ADD COLUMN deleted_by TEXT;
ALTER TABLE cad_records ADD COLUMN deleted_at INTEGER;
ALTER TABLE cad_records ADD COLUMN deleted_by TEXT;
CREATE INDEX IF NOT EXISTS idx_cad_arrests_active_citizen ON cad_arrests(citizenid, deleted_at, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cad_records_active_subject ON cad_records(subject, deleted_at, created_at DESC);
