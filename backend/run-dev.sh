#!/usr/bin/env bash
# Use project venv directly — avoids conda (base) overriding PATH after `source .venv/bin/activate`.
set -euo pipefail
cd "$(dirname "$0")"
if [[ ! -x .venv/bin/python ]]; then
  echo "Missing .venv — run: python3 -m venv .venv && .venv/bin/pip install -r requirements.txt"
  exit 1
fi
exec .venv/bin/python -m uvicorn app.main:app --reload --port 8000
