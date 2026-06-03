-- Phase 1: Core chemical identity with vector similarity support
-- Run via Supabase SQL editor or: supabase db push

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE molecules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  canonical_smiles TEXT NOT NULL,
  molecular_weight DOUBLE PRECISION,
  molecular_formula TEXT,
  -- 1024-bit Morgan fingerprint stored as pgvector (1024 dimensions, 0/1)
  morgan_fingerprint vector(1024),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT molecules_canonical_smiles_unique UNIQUE (canonical_smiles)
);

CREATE INDEX molecules_fingerprint_ivfflat_idx
  ON molecules
  USING ivfflat (morgan_fingerprint vector_cosine_ops)
  WITH (lists = 100);

COMMENT ON TABLE molecules IS 'Canonical chemical structures; SMILES only via RDKit microservice';

-- Similarity search: Tanimoto via cosine distance on bit vectors
-- similarity = 1 - (fingerprint <=> query_vector) for normalized 0/1 vectors
CREATE OR REPLACE FUNCTION search_molecules_by_similarity(
  query_fingerprint vector(1024),
  match_threshold FLOAT DEFAULT 0.7,
  match_count INT DEFAULT 50
)
RETURNS TABLE (
  id UUID,
  canonical_smiles TEXT,
  molecular_weight DOUBLE PRECISION,
  molecular_formula TEXT,
  similarity FLOAT
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    m.id,
    m.canonical_smiles,
    m.molecular_weight,
    m.molecular_formula,
    (1 - (m.morgan_fingerprint <=> query_fingerprint))::FLOAT AS similarity
  FROM molecules m
  WHERE m.morgan_fingerprint IS NOT NULL
    AND (1 - (m.morgan_fingerprint <=> query_fingerprint)) >= match_threshold
  ORDER BY m.morgan_fingerprint <=> query_fingerprint
  LIMIT match_count;
$$;
