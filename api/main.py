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

# Agent → short display label for the multi-agent inspector section.
_AGENT_LABELS = {"spec_interpreter": "SPEC", "implementer": "IMPL",
                 "test_writer": "TESTS", "reviewer": "REVIEW"}


def _meta_and_monitor(scn, art: dict, live: bool) -> tuple[dict, dict]:
    """Presentation metadata the new dashboard expects (RunMeta + MonitorDecision), built from
    the coding run so a live coding/natural-failure run shows ITS OWN data, not the static
    claims fixture. The causal artifacts (trace/attribution/replay) come from build_artifacts."""
    trace, attr, replays = art["trace"], art["attribution"], art["replays"]
    root_id = attr["root_step_id"]
    root_step = next((s for s in trace["steps"] if s["id"] == root_id), None)
    root_agent = root_step["raw"].get("agent") if root_step else None
    root_replay = replays.get(root_id)
    trusted = bool(root_replay and root_replay["flipped"]) or not root_id
    decision = "auto_apply" if trusted else "escalate"
    meta = {
        "runtime": "multi-agent",
        "domain": "coding · natural failure" if scn.natural else "coding pipeline",
        "engine": f"4-agent pipeline · {'real Claude (Haiku)' if live else 'deterministic'}",
        "pipeline": ["record", "localize", "confirm"],
        "agent_labels": _AGENT_LABELS,
        "scenario": scn.name,
        "parallel_agents": ["implementer", "test_writer"],
        "fork_agent": root_agent,
        "monitor_decision": decision,
    }
    monitor = {
        "trace_id": "code_run", "root_step_id": root_id,
        "replay": root_replay or {"trace_id": "code_run", "step_id": "", "injected_value": None,
                                  "n": 0, "flipped": False, "confirmation_rate": 0.0, "outcomes": []},
        "trusted": trusted, "decision": decision,
    }
    return meta, monitor


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
    meta, monitor = _meta_and_monitor(scn, art, req.live)
    return {"trace": art["trace"], "attribution": art["attribution"], "replay": art["replays"],
            "meta": meta, "monitor": monitor}
