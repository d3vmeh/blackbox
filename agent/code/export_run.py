"""P1 — Generate real coding-pipeline JSON artifacts for the dashboard (P1 → P3).

Writes shared/fixtures/code_run/{trace,attribution,replay}.json from one deterministic
run (no API key). The Attribution is MONITOR-derived (code/monitor.py is 7/7 correct),
not attribute() (which mislocalizes this scenario). Run: python -m agent.code.export_run
"""
from __future__ import annotations

import json
from pathlib import Path

from attribution.provenance import blast_radius, build_provenance_graph
from shared.schema import Attribution, Candidate, ReplayResult

from . import monitor
from .graph import replay_code, run_code
from .scenarios import DEFAULT, CodeScenario

_OUT = Path("shared/fixtures/code_run")
_N = 5


def _step_for_agent(trace, agent: str):
    return next(s for s in trace.steps if s.raw.get("agent") == agent)


def _replay_result(scn: CodeScenario, step_id: str, agent: str, override: dict) -> ReplayResult:
    outcomes = []
    for _ in range(_N):
        fixed = replay_code(scn, agent, override)
        base = replay_code(scn, None, None)
        outcomes.append(bool(fixed.success and not base.success))
    return ReplayResult(trace_id="code_run", step_id=step_id, injected_value=override,
                        n=_N, flipped=any(outcomes),
                        confirmation_rate=sum(outcomes) / len(outcomes), outcomes=outcomes)


def build_artifacts(scn: CodeScenario = DEFAULT) -> dict:
    """Run the pipeline once and return {trace, attribution, replays} as plain dicts."""
    trace = run_code(scn, trace_id="code_run")
    verdict = monitor.investigate(trace, scn)
    root = _step_for_agent(trace, verdict.root_agent)

    # blast = forward slice from the root over real parents edges
    G = build_provenance_graph(trace)
    blast = blast_radius(G, root.id)

    # candidates + rationale from the root's ground-truth wrong->correct diff
    correct = root.correct_output or {}
    field, bad, good = next((k, root.output.get(k), correct.get(k))
                            for k in correct if root.output.get(k) != correct.get(k))
    candidates = [Candidate(step_id=root.id, suspicion=0.92,
                            reason=f"{verdict.root_agent} set {field}={bad!r}; should be {good!r}")]
    candidates += [Candidate(step_id=sid, suspicion=0.30, reason="inherited the wrong value")
                   for sid in blast[:2]]
    rationale = (f"The {verdict.root_agent} set {field}={bad!r} (should be {good!r}); every "
                 f"downstream step inherited it and the acceptance test failed.")
    attribution = Attribution(trace_id="code_run", root_step_id=root.id, blast_radius=blast,
                              candidates=candidates, rationale=rationale)

    # root flip + decoy non-flip (test_writer's output never reaches the oracle)
    decoy = _step_for_agent(trace, "test_writer")
    replays = {
        root.id: _replay_result(scn, root.id, verdict.root_agent, {field: good}),
        decoy.id: _replay_result(scn, decoy.id, "test_writer",
                                 monitor._reference_output(scn, "test_writer")),
    }
    return {"trace": trace.model_dump(),
            "attribution": attribution.model_dump(),
            "replays": {k: v.model_dump() for k, v in replays.items()}}


def main() -> None:
    art = build_artifacts(DEFAULT)
    _OUT.mkdir(parents=True, exist_ok=True)
    (_OUT / "trace.json").write_text(json.dumps(art["trace"], indent=2))
    (_OUT / "attribution.json").write_text(json.dumps(art["attribution"], indent=2))
    (_OUT / "replay.json").write_text(json.dumps(art["replays"], indent=2))
    print(f"wrote {_OUT}/ : trace.json, attribution.json, replay.json")


if __name__ == "__main__":
    main()
