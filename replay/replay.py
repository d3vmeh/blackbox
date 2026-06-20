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
"""

from __future__ import annotations

from typing import Any

from shared.schema import ReplayResult, Trace


def replay(trace: Trace, step_id: str, injected_value: Any, n: int = 5) -> ReplayResult:
    raise NotImplementedError("P1: fork/inject/resume via LangGraph checkpoint")
