"""P4 — FastAPI app for the dashboard.

  GET  /health
  GET  /api/scenarios        -> [{name, label}] for the dropdown
  POST /api/run {scenario, live=True}
        -> {trace, attribution, replay}  (live=True runs the agents on real Claude;
           live=False is the deterministic mock — fast, no key, used by tests/the UI toggle)

The frontend reaches this via the Vite dev proxy (/api -> :8000), so no CORS is needed in dev.
"""
from __future__ import annotations

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

from agent.code.export_run import build_artifacts
from agent.code.scenarios import SCENARIOS

app = FastAPI(title="Blackbox API")
_BY_NAME = {s.name: s for s in SCENARIOS}


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/scenarios")
def scenarios() -> list[dict[str, str]]:
    return [{"name": s.name, "label": s.name.replace("_", " ")} for s in SCENARIOS]


class RunRequest(BaseModel):
    scenario: str
    live: bool = True


@app.post("/api/run")
def run(req: RunRequest) -> dict:
    scn = _BY_NAME.get(req.scenario)
    if scn is None:
        raise HTTPException(status_code=404, detail=f"unknown scenario {req.scenario!r}")
    think = None
    if req.live:
        from agent.code.graph import CODE_MODEL
        from agent.llm import make_think
        think = make_think(use_real_llm=True, model=CODE_MODEL, max_tokens=1500)
    try:
        art = build_artifacts(scn, think=think)
    except Exception as exc:  # surface LLM/runtime errors to the UI instead of a 500 stack
        raise HTTPException(status_code=502, detail=f"run failed: {type(exc).__name__}: {exc}")
    return {"trace": art["trace"], "attribution": art["attribution"], "replay": art["replays"]}
