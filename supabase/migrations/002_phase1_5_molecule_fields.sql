-- Phase 1.5: Minimal record management fields (before Phase 2 databases/fields/records)

ALTER TABLE molecules ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE molecules ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE molecules ADD COLUMN IF NOT EXISTS molfile TEXT;
ALTER TABLE molecules ADD COLUMN IF NOT EXISTS structure_svg TEXT;

-- updated_at already exists from Phase 1; ensure default and auto-touch on UPDATE
ALTER TABLE molecules
  ALTER COLUMN updated_at SET DEFAULT now();

CREATE OR REPLACE FUNCTION molecules_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS molecules_updated_at_trigger ON molecules;
CREATE TRIGGER molecules_updated_at_trigger
  BEFORE UPDATE ON molecules
  FOR EACH ROW
  EXECUTE FUNCTION molecules_set_updated_at();
