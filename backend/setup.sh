#!/usr/bin/env bash
# Recreate backend venv and install dependencies (macOS / python.org 3.12)
set -euo pipefail

cd "$(dirname "$0")"

PYTHON="${PYTHON:-python3.12}"
if ! command -v "$PYTHON" &>/dev/null; then
  PYTHON=python3
fi

echo "Using: $($PYTHON --version)"

if [ -d .venv ]; then
  echo "Removing old .venv..."
  rm -rf .venv
fi

echo "Creating virtual environment..."
"$PYTHON" -m venv .venv

echo "Upgrading pip..."
.venv/bin/python -m pip install --upgrade pip

echo "Installing requirements..."
.venv/bin/pip install -r requirements.txt

echo ""
echo "Done. Activate and start the server:"
echo "  source .venv/bin/activate"
echo "  uvicorn app.main:app --reload --port 8000"
