-- County Line CAD citizen license registry
CREATE TABLE IF NOT EXISTS cad_citizen_licenses (
  id TEXT PRIMARY KEY,
  citizenid TEXT NOT NULL,
  license_type TEXT NOT NULL CHECK (license_type IN (
    'Vehicle License',
    'CDL License',
    'Firearms License I (Pistols and Shotguns)',
    'Firearms License II (Rifles)',
    'Firearms License III (Manufacturing)',
    'FAA Pilots License',
    'Boating License'
  )),
  license_number TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active','Revoked')),
  notes TEXT NOT NULL DEFAULT '',
  issued_at TEXT,
  expires_at TEXT,
  issued_by TEXT NOT NULL,
  issued_by_name TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_cad_citizen_licenses_citizen
ON cad_citizen_licenses(citizenid, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_cad_citizen_licenses_active_type
ON cad_citizen_licenses(citizenid, license_type) WHERE status = 'Active';

-- Enforce unique automatically generated license numbers
CREATE UNIQUE INDEX IF NOT EXISTS idx_cad_citizen_licenses_number
ON cad_citizen_licenses(license_number) WHERE license_number <> '';
