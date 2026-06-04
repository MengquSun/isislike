-- Phase 2A+: records keyed by canonical SMILES (via molecules)

ALTER TABLE records ADD COLUMN IF NOT EXISTS canonical_smiles TEXT;

UPDATE records r
SET canonical_smiles = m.canonical_smiles
FROM molecules m
WHERE r.molecule_id = m.id AND r.canonical_smiles IS NULL;

DELETE FROM records WHERE molecule_id IS NULL OR canonical_smiles IS NULL;

ALTER TABLE records
  ALTER COLUMN molecule_id SET NOT NULL,
  ALTER COLUMN canonical_smiles SET NOT NULL;

CREATE INDEX IF NOT EXISTS records_canonical_smiles_idx ON records(canonical_smiles);
CREATE INDEX IF NOT EXISTS records_database_canonical_smiles_idx
  ON records(database_id, canonical_smiles);
