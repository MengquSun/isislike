#!/usr/bin/env bash
# Recreate .venv with python.org 3.12 (not conda). Use if Python hangs or "Failed to import the site module".
set -euo pipefail
cd "$(dirname "$0")"

PY="${PYTHON_FOR_VENV:-/Library/Frameworks/Python.framework/Versions/3.12/bin/python3.12}"
if [[ ! -x "$PY" ]]; then
  PY="$(command -v python3.12 || true)"
fi
if [[ ! -x "$PY" ]]; then
  echo "Need Python 3.12. Install from https://www.python.org/downloads/ or set PYTHON_FOR_VENV."
  exit 1
fi

echo "Using: $("$PY" --version) at $PY"
rm -rf .venv
"$PY" -m venv .venv
.venv/bin/pip install -U pip
.venv/bin/pip install -r requirements.txt
.venv/bin/python -c "print('venv ok')"
echo "Done. Start API: ./run-dev.sh"
