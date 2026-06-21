#!/usr/bin/env bash
# dev.sh — run the Blackbox dashboard locally: FastAPI backend (:8000) + Vite frontend (:5173).
# Usage:  ./dev.sh        (Ctrl+C stops both servers)
#
# Live runs (the Run button with real Claude) use ANTHROPIC_API_KEY from ./.env — uvicorn is
# launched from the repo root so make_think's load_dotenv() finds it.

cd "$(dirname "$0")" || exit 1

[ -x .venv/bin/uvicorn ] || { echo "✗ no .venv — run:  python -m venv .venv && .venv/bin/pip install -e '.[dev]'"; exit 1; }
[ -d web/node_modules ]  || { echo "✗ web deps missing — run:  (cd web && npm install)"; exit 1; }

echo "▶ backend  → http://localhost:8000"
echo "▶ frontend → http://localhost:5173   (open this; Start free → dashboard)"
echo "  Ctrl+C stops both."
echo

.venv/bin/uvicorn api.main:app --port 8000 &
back=$!
( cd web && npm run dev ) &
front=$!

# stop both on Ctrl+C / terminal close
trap 'kill "$back" "$front" 2>/dev/null' INT TERM EXIT
wait
