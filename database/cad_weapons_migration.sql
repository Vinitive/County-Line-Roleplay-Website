-- County Line CAD registered weapon registry
CREATE TABLE IF NOT EXISTS cad_registered_weapons (
  id TEXT PRIMARY KEY,
  citizenid TEXT NOT NULL,
  weapon_name TEXT NOT NULL,
  serial TEXT NOT NULL,
  notes TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'Registered' CHECK (status IN ('Registered','Revoked')),
  registered_by TEXT NOT NULL,
  registered_by_name TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_cad_registered_weapons_active_serial
ON cad_registered_weapons(serial) WHERE status = 'Registered';
CREATE INDEX IF NOT EXISTS idx_cad_registered_weapons_citizen
ON cad_registered_weapons(citizenid, created_at DESC);
