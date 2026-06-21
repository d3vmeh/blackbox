"""P4 — FastAPI app for the dashboard.

  GET  /health
  GET  /api/scenarios        -> [{name, label}] for the dropdown
  POST /api/run {scenario, live=True}
        -> {trace, attribution, replay, meta, monitor}

Serves TWO families of scenarios:
  • the four deterministic demo DOMAINS (claims / prior-auth / procurement / SOC) via
    `agent.domains` — the redesign's headline;
  • the live real-LLM CODING pipeline (`agent.code`) — parse_duration / merge_intervals /
    round_half_natural etc., which run the 4 agents on real Claude (Haiku) and localize +
    replay-confirm (incl. the natural-failure + LLM-repair).

The frontend reaches this via the Vite dev proxy (/api -> :8000), so no CORS is needed in dev.
"""
from __future__ import annotations

from dotenv import load_dotenv

load_dotenv(override=True)

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from agent.code.export_run import build_artifacts as code_build
from agent.code.scenarios import SCENARIOS as CODE_SCENARIOS
from agent.domains.export_run import build_artifacts as domain_build
from agent.team.export_run import build_artifacts as team_build
from agent.team.scenarios import SCENARIOS as TEAM_SCENARIOS
from shared.scenarios.manifest import BY_ID, DOMAINS

app = FastAPI(title="Blackbox API")

# The deployed frontend calls this API from a different origin (Vercel -> Railway), so it
# needs CORS. The API is a read-only demo with no auth, so a permissive policy is fine here;
# tighten allow_origins to the frontend URL in production if you want.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

_CODE_BY_NAME = {s.name: s for s in CODE_SCENARIOS}
_TEAM_BY_NAME = {s.name: s for s in TEAM_SCENARIOS}
# Agent → short display label for the multi-agent inspector / band graph.
_CODE_AGENT_LABELS = {"spec_interpreter": "SPEC", "implementer": "IMPL",
                      "test_writer": "TESTS", "reviewer": "REVIEW"}


def _coding_meta_and_monitor(scn, art: dict, live: bool) -> tuple[dict, dict]:
    """Presentation metadata (RunMeta + MonitorDecision) for a coding run — same shape the
    domains emit, so the redesigned dashboard renders coding runs identically. Causal artifacts
    (trace/attribution/replay) come from `agent.code.export_run.build_artifacts`."""
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
        "engine": f"4-agent pipeline · {'Claude Haiku 4.5' if live else 'deterministic'}",
        "pipeline": ["record", "localize", "confirm"],
        "agent_labels": _CODE_AGENT_LABELS,
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
    domains = [{"name": d.id, "label": d.label} for d in DOMAINS]
    team_label = {"billing_tax_rounding_natural": "software team · billing",
                  "billing_op_order": "software team · billing (scripted)"}
    team = [{"name": s.name, "label": team_label.get(s.name, f"software team · {s.name}")}
            for s in TEAM_SCENARIOS]
    coding = [{"name": s.name, "label": f"coding · {s.name.replace('_', ' ')}"} for s in CODE_SCENARIOS]
    return domains + team + coding


class RunRequest(BaseModel):
    scenario: str
    live: bool = True  # coding runs honor this (real Claude when True); domains are deterministic


@app.post("/api/run")
def run(req: RunRequest) -> dict:
    # --- live coding pipeline ---
    scn = _CODE_BY_NAME.get(req.scenario)
    if scn is not None:
        think = None
        if req.live:
            from agent.code.graph import CODE_MODEL
            from agent.llm import make_think
            think = make_think(use_real_llm=True, model=CODE_MODEL, max_tokens=1500)
        try:
            art = code_build(scn, think=think)
        except Exception as exc:
            raise HTTPException(status_code=502,
                                detail=f"coding run failed: {type(exc).__name__}: {exc}")
        meta, monitor = _coding_meta_and_monitor(scn, art, req.live)
        return {"trace": art["trace"], "attribution": art["attribution"],
                "replay": art["replays"], "meta": meta, "monitor": monitor}

    # --- software-team (billing) pipeline ---
    tscn = _TEAM_BY_NAME.get(req.scenario)
    if tscn is not None:
        think = None
        if req.live:
            from agent.llm import make_think
            from agent.team.graph import TEAM_MODEL
            think = make_think(use_real_llm=True, model=TEAM_MODEL, max_tokens=600)
        try:
            art = team_build(tscn, think=think)
        except Exception as exc:
            raise HTTPException(status_code=502,
                                detail=f"team run failed: {type(exc).__name__}: {exc}")
        return {"trace": art["trace"], "attribution": art["attribution"],
                "replay": art["replays"], "meta": art["meta"], "monitor": art["monitor"]}

    # --- demo domains (deterministic by default; procurement_gpu's browser runs LIVE when live=True) ---
    if req.scenario not in BY_ID:
        raise HTTPException(status_code=404, detail=f"unknown scenario {req.scenario!r}")
    dthink = None
    if req.live:
        from agent.code.graph import CODE_MODEL
        from agent.llm import make_think
        dthink = make_think(use_real_llm=True, model=CODE_MODEL, max_tokens=80)
    try:
        art = domain_build(req.scenario, think=dthink)
    except Exception as exc:
        raise HTTPException(status_code=502,
                            detail=f"domain run failed: {type(exc).__name__}: {exc}")
    return {
        "trace": art["trace"],
        "attribution": art["attribution"],
        "replay": art["replays"],
        "meta": art["meta"],
        "monitor": art["monitor"],
    }
