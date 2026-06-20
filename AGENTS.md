# blackbox

A **causal debugger for AI agents**, built as a monorepo: a Python backend that
records → localizes → confirms agent failures, and a Vite + React SPA that
visualizes them (the **blast-radius animation** and the **confirm-flip moment**).

For the full system design read [ARCHITECTURE.md](./ARCHITECTURE.md); for the
visual design system read [DESIGN.md](./DESIGN.md).

## Architecture (monorepo)

- **Backend (`shared/`, `agent/`, `attribution/`, `replay/`, `api/`, `eval/`):**
  Python. Owns all business logic — recording traces, localizing the earliest
  wrong step, and confirming the root cause by fork/inject/replay. Source of truth.
- **Frontend (`web/`):** Vite + React 19 + TypeScript SPA. Static client — no SSR,
  no API routes, no Node server tier. A **pure consumer** of the backend over SSE.
  Its job is visualization, not logic.
- **Boundary rule:** if it computes attribution/replay/eval, it is Python. If it
  renders a demo beat, it is `web/`. Keep that boundary unambiguous. The frontend
  never grows a server tier; server-side work belongs in the Python backend.

## Why Vite (not Next.js) for the frontend

One authenticated dashboard fed by a separate backend gains nothing from SSR /
RSC / file-based routing / API routes / SEO — they'd just be a second backend in
front of the real one. Vite gives faster cold boot, instant HMR for animation
tuning, and a trivial static deploy. Do not reintroduce a Next.js / Node server
layer in `web/`.

## Commands

```bash
# Frontend (run from web/)
cd web && npm run dev      # Vite dev server (http://localhost:5173)
cd web && npm run build    # tsc -b && vite build  → static bundle in web/dist/
cd web && npm run lint     # eslint

# Backend (run from repo root)
pip install -e ".[dev]"    # install backend deps (use a venv)
uvicorn api.main:app --reload   # FastAPI + SSE (http://localhost:8000)
pytest                     # backend tests
```

## Conventions

- **TypeScript** everywhere in `web/`; never use `any` — define or reuse an
  interface/type. Mirror backend contracts in `web/src/types.ts`.
- **Python**: type-hinted; Pydantic models for all data crossing a seam. Contracts
  live in `shared/schema.py` — change field names there and nowhere else first.
- `'use client'` and other Next.js concepts do not apply to `web/`.
- Keep the trace-visualization / animation code isolated so it stays easy to
  iterate on (it is the demo).
- Backend stream-contract changes touch `shared/schema.py` and `web/src/types.ts`
  together — keep the two in sync.

## Structure

```
shared/schema.py     # the 5 data contracts — build/edit first
shared/fixtures/     # flight_fail.json — the source-of-truth failing trace
agent/ replay/       # P1: subject agent, capture, fork/inject/replay
attribution/         # P2: provenance graph + localization
api/ eval/           # P4: FastAPI/SSE + oracle/metrics
web/                 # P3: the Vite + React SPA
```
