-- CLRP CAD Georgia-based charge catalog and structured arrest history.
-- Apply this migration once to the clrp-player-portal D1 database.
CREATE TABLE IF NOT EXISTS cad_charge_catalog (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  offense_class TEXT NOT NULL,
  statute TEXT NOT NULL,
  description TEXT NOT NULL,
  statutory_penalty TEXT NOT NULL,
  roleplay_fine INTEGER NOT NULL DEFAULT 0,
  roleplay_jail_minutes INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS cad_arrests (
  id TEXT PRIMARY KEY,
  citizenid TEXT NOT NULL,
  character_name TEXT NOT NULL,
  narrative TEXT NOT NULL,
  officer_citizenid TEXT NOT NULL,
  officer_name TEXT NOT NULL,
  total_roleplay_fine INTEGER NOT NULL DEFAULT 0,
  total_roleplay_jail_minutes INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_cad_arrests_citizenid ON cad_arrests(citizenid,created_at);
CREATE TABLE IF NOT EXISTS cad_arrest_charges (
  id TEXT PRIMARY KEY,
  arrest_id TEXT NOT NULL,
  charge_id TEXT NOT NULL,
  charge_code TEXT NOT NULL,
  charge_title TEXT NOT NULL,
  offense_class TEXT NOT NULL,
  statute TEXT NOT NULL,
  statutory_penalty TEXT NOT NULL,
  roleplay_fine INTEGER NOT NULL DEFAULT 0,
  roleplay_jail_minutes INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY(arrest_id) REFERENCES cad_arrests(id)
);
CREATE INDEX IF NOT EXISTS idx_cad_arrest_charges_arrest ON cad_arrest_charges(arrest_id);

-- Statutory penalties are summaries for CAD reference, not sentencing advice.
-- Roleplay fine/jail columns are server gameplay defaults and are NOT Georgia statutory penalties.
INSERT OR IGNORE INTO cad_charge_catalog
(id,code,title,category,offense_class,statute,description,statutory_penalty,roleplay_fine,roleplay_jail_minutes)
VALUES
('ga-16-5-20','GA-16-5-20','Simple Assault','Person Crimes','Misdemeanor','O.C.G.A. § 16-5-20','Attempting to commit a violent injury or placing another in reasonable apprehension of immediately receiving a violent injury.','Generally misdemeanor; up to 12 months and/or $1,000 under O.C.G.A. § 17-10-3, subject to applicable exceptions.',250,10),
('ga-16-5-23','GA-16-5-23','Simple Battery','Person Crimes','Misdemeanor','O.C.G.A. § 16-5-23','Intentionally making physical contact of an insulting or provoking nature, or intentionally causing physical harm.','Generally misdemeanor; up to 12 months and/or $1,000 under O.C.G.A. § 17-10-3, subject to applicable exceptions.',350,15),
('ga-16-5-23-1','GA-16-5-23.1','Battery','Person Crimes','Misdemeanor','O.C.G.A. § 16-5-23.1','Intentionally causing substantial physical harm or visible bodily harm.','Generally misdemeanor; enhanced provisions may apply based on victim or circumstances.',500,20),
('ga-16-5-21','GA-16-5-21','Aggravated Assault','Person Crimes','Felony','O.C.G.A. § 16-5-21','Assault with specified intent, a deadly weapon, or an instrument likely to cause serious bodily injury or strangulation.','Generally 1 to 20 years; special victim/circumstance provisions may impose different penalties.',1500,60),
('ga-16-5-24','GA-16-5-24','Aggravated Battery','Person Crimes','Felony','O.C.G.A. § 16-5-24','Maliciously causing bodily harm by depriving a person of a body member, rendering it useless, or seriously disfiguring it.','Generally 1 to 20 years; special provisions may apply.',2000,75),
('ga-16-5-1','GA-16-5-1','Murder','Person Crimes','Felony','O.C.G.A. § 16-5-1','Unlawfully causing the death of another with malice aforethought, or felony murder as defined by statute.','Punishment may include death, life imprisonment, or life without parole depending on statutory requirements and case.',5000,180),
('ga-16-7-21','GA-16-7-21','Criminal Trespass','Property Crimes','Misdemeanor','O.C.G.A. § 16-7-21','Entering or remaining on property without authority, or damaging another’s property as defined by statute.','Generally misdemeanor; up to 12 months and/or $1,000 under O.C.G.A. § 17-10-3, subject to exceptions.',200,10),
('ga-16-7-23','GA-16-7-23','Criminal Damage to Property in the Second Degree','Property Crimes','Felony','O.C.G.A. § 16-7-23','Knowingly and maliciously causing qualifying damage to another’s property.','Felony; generally 1 to 5 years imprisonment.',1000,45),
('ga-16-7-1a','GA-16-7-1(a)','Burglary in the First Degree','Property Crimes','Felony','O.C.G.A. § 16-7-1','Entering or remaining in a dwelling or other covered structure with intent to commit a felony or theft therein.','Generally 1 to 20 years; statutory details and prior convictions affect punishment.',2500,90),
('ga-16-7-1b','GA-16-7-1(b)','Burglary in the Second Degree','Property Crimes','Felony','O.C.G.A. § 16-7-1','Burglary involving a building, structure, railroad car, watercraft, or aircraft not covered by first-degree burglary.','Generally 1 to 5 years imprisonment.',1500,60),
('ga-16-8-40','GA-16-8-40','Robbery','Property Crimes','Felony','O.C.G.A. § 16-8-40','Taking property from another’s person or immediate presence by force, intimidation, or specified sudden snatching.','Generally 1 to 20 years imprisonment.',2000,75),
('ga-16-8-41','GA-16-8-41','Armed Robbery','Property Crimes','Felony','O.C.G.A. § 16-8-41','Robbery committed with an offensive weapon or device as defined by statute.','Life imprisonment or a term of 10 to 20 years; mandatory statutory restrictions apply.',5000,150),
('ga-16-8-2','GA-16-8-2','Theft by Taking','Property Crimes','Misdemeanor / Felony','O.C.G.A. § 16-8-2; § 16-8-12','Unlawfully taking or appropriating another’s property with intent to deprive the owner.','Classification and punishment depend on value, property type, prior convictions, and statutory circumstances; misdemeanor baseline or felony ranges may apply.',500,25),
('ga-16-9-1','GA-16-9-1','Forgery','Fraud & Administration','Felony','O.C.G.A. § 16-9-1','Making, altering, possessing, or uttering a writing with intent to defraud as defined by statute.','Degree and punishment depend on the type of writing and circumstances; felony imprisonment ranges apply.',1000,45),
('ga-16-10-24','GA-16-10-24','Obstruction of a Law Enforcement Officer','Fraud & Administration','Misdemeanor / Felony','O.C.G.A. § 16-10-24','Knowingly and willfully obstructing or hindering a law enforcement officer in lawful discharge of official duties.','Misdemeanor under subsection (a); felony under subsection (b) when violence or offered violence is involved. Penalties differ by subsection.',400,20),
('ga-16-13-30a','GA-16-13-30(a)','Possession of a Controlled Substance','Drug Offenses','Felony','O.C.G.A. § 16-13-30','Unlawful possession of a controlled substance; schedule, amount, and circumstances determine applicable subsection and penalty.','Penalty varies substantially by substance schedule and subsection; consult current statute before charging.',1000,45),
('ga-16-13-30j','GA-16-13-30(j)','Possession of Marijuana (One Ounce or Less)','Drug Offenses','Misdemeanor','O.C.G.A. § 16-13-30(j)','Possession of one ounce or less of marijuana.','Misdemeanor; up to 12 months and/or $1,000 under applicable statute.',500,20),
('ga-16-13-31','GA-16-13-31','Drug Trafficking','Drug Offenses','Felony','O.C.G.A. § 16-13-31','Trafficking in controlled substances; thresholds and penalties depend on the substance and weight.','Mandatory minimum terms and fines vary by substance and quantity; consult current statute and amendments.',5000,120),
('ga-40-6-391','GA-40-6-391','Driving Under the Influence (DUI)','Traffic Offenses','Misdemeanor / Felony','O.C.G.A. § 40-6-391','Driving or being in actual physical control of a moving vehicle while under the influence as defined by statute.','Penalties depend on prior convictions and circumstances; statutory minimum fines, jail, probation, and license consequences vary.',750,30),
('ga-40-6-20','GA-40-6-20','Disobedience of Traffic-Control Device','Traffic Offenses','Misdemeanor','O.C.G.A. § 40-6-20','Failure to obey an applicable traffic-control device.','Penalty depends on applicable traffic provisions and court schedule; not assigned a universal statutory fine here.',150,0);
