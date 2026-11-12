CREATE TABLE IF NOT EXISTS applications (
  id TEXT PRIMARY KEY,
  department TEXT NOT NULL CHECK (department IN ('leo', 'ems', 'civilian')),
  position TEXT NOT NULL,
  applicant_name TEXT NOT NULL,
  email TEXT NOT NULL,
  discord TEXT NOT NULL,
  age INTEGER NOT NULL,
  availability TEXT NOT NULL,
  experience TEXT NOT NULL,
  motivation TEXT NOT NULL,
  additional TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  submitted_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_applications_submitted_at ON applications(submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_applications_status ON applications(status);