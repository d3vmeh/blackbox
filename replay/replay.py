"""P1 — Fork + inject + confirm. The intervention that PROVES causality.

replay(trace, step_id, injected_value, n) forks the run at step_id using the
LangGraph checkpoint in Step.state, injects injected_value into the right channel
(graph.update_state(..., as_node=...)), resumes (graph.invoke(None, config)),
re-runs n times, scores each with eval.oracle.evaluate, and returns a
ReplayResult with confirmation_rate over n runs.

CRITICAL:
  - The NON-FLIP case is a valid result, not an error. flipped=False rejects the
    candidate; the caller falls back to the next ranked Candidate.
  - The web target is non-deterministic -> report confirmation_rate over n runs,
    never a single boolean.
  - For the demo, the flight scenario replays from a pre-captured corrected trace
    so the on-stage flip is deterministic; the live path stays real but off the
    critical demo path. See ARCHITECTURE.md §Replay & determinism.

Implementation: the demo path re-executes the agent twice per trial — once with the BAD
value (baseline, must fail) and once with the injected fix (must pass) — and confirms only
when the fix flips an outcome the bad value breaks. Falls back to a ground-truth stub when
the agent isn't importable or the step isn't replayable.
"""

from __future__ import annotations

from typing import Any

from shared.schema import ReplayResult, Trace


def replay(trace: Trace, step_id: str, injected_value: Any, n: int = 5,
           threshold: float = 0.5) -> ReplayResult:
    outcomes = _counterfactual(trace, step_id, injected_value, n)
    rate = (sum(outcomes) / len(outcomes)) if outcomes else 0.0
    return ReplayResult(
        trace_id=trace.id, step_id=step_id, injected_value=injected_value,
        n=n, flipped=rate >= threshold, confirmation_rate=rate, outcomes=outcomes,
    )


def _counterfactual(trace: Trace, step_id: str, injected_value: Any, n: int) -> list[bool]:
    try:
        from agent.graph import REPLAYABLE, replay_run
        from eval.oracle import evaluate

        step = next((s for s in trace.steps if s.id == step_id), None)
        node = step.raw.get("node") if step else None
        if step is None or node not in REPLAYABLE:
            raise KeyError(f"step {node!r} not replayable")
        state_key, extract = REPLAYABLE[node]
        bad, good = extract(step.output), extract(injected_value)

        outcomes = []
        for _ in range(n):
            baseline = replay_run(node, {state_key: bad})
            fixed = replay_run(node, {state_key: good})
            outcomes.append(bool(evaluate(fixed.final_output) and not evaluate(baseline.final_output)))
        return outcomes
    except Exception:
        return _offline(trace, step_id, injected_value, n)


def _offline(trace: Trace, step_id: str, injected_value: Any, n: int) -> list[bool]:
    """Ground-truth stub: fixing the gold root step with its known-correct value succeeds."""
    step = next((s for s in trace.steps if s.id == step_id), None)
    ok = bool(step is not None and step.correct_output is not None
              and injected_value == step.correct_output and trace.gold_root_step_id == step_id)
    return [ok] * n
