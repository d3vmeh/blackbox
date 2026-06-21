"""P2 — Generate LangGraph flight-run JSON artifacts for the dashboard.

Runs the flight agent through LangGraph (`run_agent_graph`), injects a known
parse_date fault, confirms replay via `graph_fork_outcome` / `update_state`,
and writes shared/fixtures/flight_run/{trace,attribution,replay,meta}.json.

Run: python -m agent.flight.export_run
"""
from __future__ import annotations

import json
from pathlib import Path

from attribution.provenance import blast_radius, build_provenance_graph
from shared.schema import Attribution, Candidate, ReplayResult, Trace

from ..capture import to_trace
from .faults import inject_fault
from .graph import (
    INTENDED_DATE,
    NODES,
    REPLAYABLE,
    graph_replay_confirm,
    run_agent_graph,
)

_OUT = Path("shared/fixtures/flight_run")
_TRACE_ID = "flight_run"
_BAD_DATE = "2026-12-07"
_N = 5
_FORK_NODE = "parse_date"


def _sid(trace: Trace, node: str) -> str:
    return next(s.id for s in trace.steps if s.raw.get("node") == node)


def _tag_langgraph(trace: Trace) -> Trace:
    """Mark every step as captured via the LangGraph-wrapped flight agent."""
    steps = [
        s.model_copy(update={"raw": {**s.raw, "runtime": "langgraph", "capture": "recorder"}})
        for s in trace.steps
    ]
    return trace.model_copy(update={"steps": steps})


def _failing_trace() -> tuple[Trace, object, dict]:
    trace, app = run_agent_graph(trace_id=_TRACE_ID)
    config = {"configurable": {"thread_id": _TRACE_ID}}
    parse_id = _sid(trace, "parse_date")
    trace = inject_fault(
        trace,
        parse_id,
        bad_output=f"departure = {_BAD_DATE}",
        propagate=(INTENDED_DATE, _BAD_DATE),
        final_output={"date": _BAD_DATE, "flight": "UA-441", "email_date": _BAD_DATE},
    )
    trace.id = _TRACE_ID
    return _tag_langgraph(trace), app, config


def _meta(app, config: dict) -> dict:
    """Surface all three langgraph-clean APIs for the frontend."""
    ckpt_trace = to_trace(app, config, task=trace_task(), trace_id=_TRACE_ID)
    return {
        "runtime": "langgraph",
        "author": "sashikumar6 / p2/langgraph-clean",
        "engine": "StateGraph + MemorySaver",
        "apis": ["build_graph", "run_agent_graph", "to_trace"],
        "graph_nodes": [fn.__name__ for fn in NODES],
        "checkpoints": len(list(app.get_state_history(config))),
        "to_trace_steps": len(ckpt_trace.steps),
        "recorder_steps": 10,
        "capture_path": "Recorder inside LangGraph nodes (dashboard trace)",
        "replay_path": "app.update_state(as_node=...) + invoke (LangGraph fork)",
        "fork_node": _FORK_NODE,
        "thread_id": _TRACE_ID,
    }


def trace_task() -> str:
    from .graph import DEFAULT_TASK
    return DEFAULT_TASK


def _lg_replay(root_id: str, good: dict) -> ReplayResult:
    state_key = REPLAYABLE[_FORK_NODE][0]
    bad = {state_key: _BAD_DATE}
    outcomes = graph_replay_confirm(_FORK_NODE, bad, good, n=_N)
    rate = sum(outcomes) / len(outcomes) if outcomes else 0.0
    return ReplayResult(
        trace_id=_TRACE_ID,
        step_id=root_id,
        injected_value=good,
        n=_N,
        flipped=rate >= 0.5,
        confirmation_rate=rate,
        outcomes=outcomes,
    )


def _decoy_replay(trace: Trace, decoy_id: str, injected: str) -> ReplayResult:
    """Decoy still uses sequential replay_run — fixing the wrong node doesn't flip."""
    from replay.replay import replay
    return replay(trace, decoy_id, injected, n=_N)


def build_artifacts() -> dict:
    trace, app, config = _failing_trace()
    root = next(s for s in trace.steps if s.id == trace.gold_root_step_id)

    G = build_provenance_graph(trace)
    blast = blast_radius(G, root.id)
    state_key = REPLAYABLE[_FORK_NODE][0]
    good = {state_key: INTENDED_DATE}

    candidates = [
        Candidate(
            step_id=root.id,
            suspicion=0.92,
            reason=f"parse_date set departure={_BAD_DATE!r}; should be {INTENDED_DATE!r}",
        ),
    ]
    candidates += [
        Candidate(step_id=sid, suspicion=0.30, reason="inherited the wrong date")
        for sid in blast[:2]
    ]
    rationale = (
        f"parse_date extracted {_BAD_DATE!r} from the search payload "
        f"(should be {INTENDED_DATE!r}); every downstream step trusted it and the oracle failed."
    )
    attribution = Attribution(
        trace_id=_TRACE_ID,
        root_step_id=root.id,
        blast_radius=blast,
        candidates=candidates,
        rationale=rationale,
        suggested_fix=good,
    )

    decoy_id = _sid(trace, "select_flight")
    replays = {
        root.id: _lg_replay(root.id, good),
        decoy_id: _decoy_replay(trace, decoy_id, f"selected AA-218 @ $999 for {INTENDED_DATE}"),
    }
    return {
        "trace": trace.model_dump(),
        "attribution": attribution.model_dump(),
        "replays": {k: v.model_dump() for k, v in replays.items()},
        "meta": _meta(app, config),
    }


def main() -> None:
    art = build_artifacts()
    _OUT.mkdir(parents=True, exist_ok=True)
    (_OUT / "trace.json").write_text(json.dumps(art["trace"], indent=2))
    (_OUT / "attribution.json").write_text(json.dumps(art["attribution"], indent=2))
    (_OUT / "replay.json").write_text(json.dumps(art["replays"], indent=2))
    (_OUT / "meta.json").write_text(json.dumps(art["meta"], indent=2))
    print(f"wrote {_OUT}/ : trace.json, attribution.json, replay.json, meta.json")


if __name__ == "__main__":
    main()
