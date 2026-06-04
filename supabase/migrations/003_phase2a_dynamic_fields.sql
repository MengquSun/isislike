-- Phase 2A: Dynamic fields MVP (text, number, date, select)
-- Run after 001 and 002 in Supabase SQL Editor.

CREATE TABLE databases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE field_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  database_id UUID NOT NULL REFERENCES databases(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  field_type TEXT NOT NULL,
  options JSONB,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(database_id, name),
  CONSTRAINT field_definitions_type_check CHECK (
    field_type IN ('text', 'number', 'date', 'select')
  )
);

CREATE INDEX field_definitions_database_id_idx ON field_definitions(database_id);

CREATE TABLE records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  database_id UUID NOT NULL REFERENCES databases(id) ON DELETE CASCADE,
  molecule_id UUID REFERENCES molecules(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX records_database_id_idx ON records(database_id);
CREATE INDEX records_molecule_id_idx ON records(molecule_id);

CREATE TABLE record_values (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  record_id UUID NOT NULL REFERENCES records(id) ON DELETE CASCADE,
  field_id UUID NOT NULL REFERENCES field_definitions(id) ON DELETE CASCADE,
  text_value TEXT,
  number_value DOUBLE PRECISION,
  date_value DATE,
  structure_molecule_id UUID REFERENCES molecules(id) ON DELETE SET NULL,
  UNIQUE(record_id, field_id)
);

CREATE INDEX record_values_record_id_idx ON record_values(record_id);

CREATE OR REPLACE FUNCTION records_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER records_updated_at_trigger
  BEFORE UPDATE ON records
  FOR EACH ROW
  EXECUTE FUNCTION records_set_updated_at();
