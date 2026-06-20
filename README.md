# Blackbox

**A causal debugger for AI agents.** When a long-running agent fails, one early
mistake silently poisons every later step and the final answer is confidently
wrong. Blackbox records the run, **localizes the earliest wrong step** (not where
the symptom surfaced), shows the forward **blast radius** of poisoned steps, and
**proves the root cause by replay** — fork the run at that step, inject the
corrected value, re-run, and watch the outcome flip fail→pass.

> We don't *guess* the cause — we localize it on a graph and *confirm* it by replay.

## Docs

- [ARCHITECTURE.md](./ARCHITECTURE.md) — system design, tech stack, contracts,
  build order, the demo.
- [DESIGN.md](./DESIGN.md) — the visual design system (forensic-instrument UI).
- [AGENTS.md](./AGENTS.md) — repo conventions and the frontend/backend boundary.

## Layout (monorepo)

```
shared/      contracts (schema.py) + fixtures        api/ eval/   FastAPI/SSE + oracle
agent/       LangGraph subject + trace capture       web/         Vite + React SPA
attribution/ provenance graph + localization         replay/      fork + inject + confirm
```

## Quickstart

```bash
# Frontend
cd web && npm install && npm run dev      # http://localhost:5173

# Backend (from repo root, in a venv)
pip install -e ".[dev]"
uvicorn api.main:app --reload             # http://localhost:8000
```

Status: scaffold + contracts in place. Next: the `flight_fail.json` fixture, then
the four workstreams build against it in parallel (see ARCHITECTURE.md §9).
