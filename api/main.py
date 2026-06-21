"""P4 — FastAPI app for the dashboard.

  GET  /health
  GET  /api/scenarios        -> [{name, label}] for the dropdown (four demo domains)
  POST /api/run {scenario, live=True}
        -> {trace, attribution, replay, meta, monitor}

The frontend reaches this via the Vite dev proxy (/api -> :8000), so no CORS is needed in dev.
"""
from __future__ import annotations

from dotenv import load_dotenv

load_dotenv(override=True)

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

from agent.domains.export_run import build_artifacts as domain_build
from shared.scenarios.manifest import BY_ID, DOMAINS

app = FastAPI(title="Blackbox API")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/scenarios")
def scenarios() -> list[dict[str, str]]:
    return [{"name": d.id, "label": d.label} for d in DOMAINS]


class RunRequest(BaseModel):
    scenario: str
    live: bool = True  # domains are deterministic; flag kept for API compatibility


@app.post("/api/run")
def run(req: RunRequest) -> dict:
    if req.scenario not in BY_ID:
        raise HTTPException(status_code=404, detail=f"unknown scenario {req.scenario!r}")
    try:
        art = domain_build(req.scenario)
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail=f"domain run failed: {type(exc).__name__}: {exc}",
        )
    return {
        "trace": art["trace"],
        "attribution": art["attribution"],
        "replay": art["replays"],
        "meta": art["meta"],
        "monitor": art["monitor"],
    }
