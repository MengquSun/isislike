-- Allow multiple records per structure in the same database

ALTER TABLE records
  DROP CONSTRAINT IF EXISTS records_database_canonical_smiles_unique;

CREATE INDEX IF NOT EXISTS records_database_canonical_smiles_idx
  ON records(database_id, canonical_smiles);
