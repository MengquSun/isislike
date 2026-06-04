#!/usr/bin/env bash
# Quick local smoke test (backend must be on :8000)
set -e
BASE="${VITE_CHEMINFORMATICS_API_URL:-http://localhost:8000}"

echo "==> Health"
curl -sf "$BASE/health" | python3 -m json.tool

echo "==> List molecules (needs migration 002 + Supabase .env)"
curl -sf "$BASE/api/molecules?limit=3" | python3 -m json.tool | head -40

echo "OK"
