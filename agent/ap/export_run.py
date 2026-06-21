"""Generate insurance-claims dashboard artifacts from the AP multi-agent pipeline.

Skins the AP graph as claims adjudication (INTAKE → COVERAGE ∥ FRAUD → ADJUDICATOR → PAYOUT)
and runs the full blackbox pipeline: record → localize → confirm (decoy + root) → supervise.

Writes shared/fixtures/claim_run/{trace,attribution,replay,monitor,meta}.json

Run:
    python -m agent.ap.export_run
"""
from __future__ import annotations

import json
from pathlib import Path

from attribution.provenance import blast_radius, build_provenance_graph
from eval.ap_oracle import evaluate_ap
from shared.schema import Attribution, Candidate, MonitorDecision, ReplayResult

from . import graph
from .monitor import investigate
from .scenarios import DEFAULT, Scenario

_OUT = Path("shared/fixtures/claim_run")
_TRACE_ID = "claim_run"
_N = 5
_TRUST_THRESHOLD = 0.5

AGENT_LABELS = {
    "extractor": "INTAKE",
    "matcher": "COVERAGE",
    "fraud": "FRAUD",
    "approver": "ADJUDICATOR",
    "payment": "PAYOUT",
}


def _step_for_agent(trace, agent: str):
    return next(s for s in trace.steps if s.raw.get("agent") == agent)


def _tag_claims(trace):
    steps = [
        s.model_copy(update={
            "raw": {
                **s.raw,
                "runtime": "multi-agent",
                "domain": "insurance-claims",
                "display": AGENT_LABELS.get(s.raw.get("agent", ""), s.raw.get("agent")),
            },
        })
        for s in trace.steps
    ]
    return trace.model_copy(update={
        "id": _TRACE_ID,
        "task": "claims-adjudication",
        "steps": steps,
    })


def _replay_result(scn: Scenario, step_id: str, agent: str, override: dict) -> ReplayResult:
    baseline = graph.replay_ap(scn, None, None)
    base_fail = not evaluate_ap(baseline.final_output, scn)
    outcomes = [
        evaluate_ap(graph.replay_ap(scn, agent, override).final_output, scn) and base_fail
        for _ in range(_N)
    ]
    rate = sum(outcomes) / len(outcomes) if outcomes else 0.0
    return ReplayResult(
        trace_id=_TRACE_ID, step_id=step_id, injected_value=override,
        n=_N, flipped=any(outcomes), confirmation_rate=rate, outcomes=outcomes,
    )


def _monitor(root_replay: ReplayResult) -> MonitorDecision:
    trusted = root_replay.flipped and root_replay.confirmation_rate >= _TRUST_THRESHOLD
    return MonitorDecision(
        trace_id=_TRACE_ID,
        root_step_id=root_replay.step_id,
        replay=root_replay,
        trusted=trusted,
        decision="auto_apply" if trusted else "escalate",
    )


def _meta(scn: Scenario, v, monitor: MonitorDecision) -> dict:
    return {
        "runtime": "multi-agent",
        "domain": "insurance-claims",
        "engine": "5-agent pipeline · COVERAGE ∥ FRAUD concurrent",
        "pipeline": ["record", "localize", "confirm", "supervise"],
        "agent_labels": AGENT_LABELS,
        "scenario": scn.name,
        "invoice_text": scn.invoice_text(),
        "parallel_agents": ["matcher", "fraud"],
        "fork_agent": v.root_agent if v.root_agent else "extractor",
        "observability": {
            "otel": "agent/otel.emit_trace",
            "arize": "python -m eval.arize_pipeline --demo-only",
            "sentry": "api/sentry_issue.file_issue (on escalate)",
            "redis": "commit only replay-confirmed hand-offs",
        },
        "monitor_decision": monitor.decision,
    }


def build_artifacts(scn: Scenario = DEFAULT) -> dict:
    trace = _tag_claims(graph.run_ap(scn, trace_id=_TRACE_ID))
    v = investigate(trace, scn, n=_N)
    if not v.failed or not v.root_agent:
        raise ValueError("expected a failing claim run with a localized root")

    root = _step_for_agent(trace, v.root_agent)
    G = build_provenance_graph(trace)
    blast = blast_radius(G, root.id)

    # Decoy: fix APPROVER when root is upstream — does not flip the payout.
    decoy_agent = "approver" if v.root_agent != "approver" else "payment"
    decoy = _step_for_agent(trace, decoy_agent)
    decoy_override = {"approved": True} if decoy_agent == "approver" else {"amount_paid": 1.0}

    candidates = [
        Candidate(
            step_id=root.id, suspicion=0.92,
            reason=(f"{AGENT_LABELS.get(v.root_agent, v.root_agent)} set {v.field}="
                    f"{v.wrong_value!r}; should be {v.correct_value!r}"),
        ),
        Candidate(
            step_id=decoy.id, suspicion=0.45,
            reason=f"{AGENT_LABELS.get(decoy_agent, decoy_agent)} looks suspicious but replay does not flip",
        ),
    ]
    candidates += [
        Candidate(step_id=sid, suspicion=0.30, reason="inherited the corrupted hand-off")
        for sid in blast[:1]
    ]
    rationale = (
        f"{AGENT_LABELS.get(v.root_agent, v.root_agent)} misread {v.field} "
        f"({v.wrong_value!r} vs {v.correct_value!r}); "
        f"every downstream agent trusted the hand-off and the payout oracle failed."
    )
    attribution = Attribution(
        trace_id=_TRACE_ID,
        root_step_id=root.id,
        blast_radius=blast,
        candidates=candidates,
        rationale=rationale,
        suggested_fix={v.field: v.correct_value},
    )

    root_replay = _replay_result(scn, root.id, v.root_agent, {v.field: v.correct_value})
    monitor = _monitor(root_replay)
    decoy_replay = _replay_result(scn, decoy.id, decoy_agent, decoy_override)

    trace = trace.model_copy(update={"gold_root_step_id": root.id})
    replays = {root.id: root_replay, decoy.id: decoy_replay}

    return {
        "trace": trace.model_dump(),
        "attribution": attribution.model_dump(),
        "replays": {k: v.model_dump() for k, v in replays.items()},
        "monitor": monitor.model_dump(),
        "meta": _meta(scn, v, monitor),
    }


def main() -> None:
    art = build_artifacts(DEFAULT)
    _OUT.mkdir(parents=True, exist_ok=True)
    for name in ("trace", "attribution", "replay", "monitor", "meta"):
        key = "replays" if name == "replay" else name
        (_OUT / f"{name}.json").write_text(json.dumps(art[key], indent=2))
    print(f"wrote {_OUT}/ : trace, attribution, replay, monitor, meta")


if __name__ == "__main__":
    main()
