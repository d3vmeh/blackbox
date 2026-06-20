"""Confirm causality by counterfactual replay.

Fork at step k, inject the corrected value, re-run N times, and report how often the
outcome flips fail -> pass. A high confirmation rate => the step is causally implicated.

The OFFLINE stub lets P3/P4 wire the full Analyze->Confirm loop against the fixture today;
swap `_simulate_offline` for the real LangGraph re-run when the live agent lands.
"""
from __future__ import annotations

from typing import Any, Callable, Optional

from shared.schema import ReplayResult, Trace

from .fork import fork_at
from .intervene import apply_intervention

# A live rerun function: (trace, step_id, corrected_value) -> did the final outcome succeed?
RerunFn = Callable[[Trace, int, Any], bool]


def confirm(
    trace: Trace,
    step_id: int,
    corrected_value: Any,
    *,
    n: int = 5,
    threshold: float = 0.5,
    rerun_fn: Optional[RerunFn] = None,
) -> ReplayResult:
    fork = fork_at(trace, step_id)
    apply_intervention(fork, corrected_value)  # records the do(step=v*) intervention

    if rerun_fn is not None:
        outcomes = [bool(rerun_fn(trace, step_id, corrected_value)) for _ in range(n)]
    else:
        outcomes = _simulate_offline(trace, step_id, corrected_value, n)

    rate = (sum(outcomes) / len(outcomes)) if outcomes else 0.0
    return ReplayResult(
        trace_id=trace.id,
        step_id=step_id,
        n=n,
        confirmation_rate=rate,
        flipped=rate >= threshold,
        outcomes=outcomes,
    )


def _simulate_offline(trace: Trace, step_id: int, corrected_value: Any, n: int) -> list[bool]:
    """STUB until real replay. Uses fixture ground truth: fixing the gold root step with
    its known-correct value would have made the run succeed."""
    step = next((s for s in trace.steps if s.id == step_id), None)
    fixes_value = step is not None and step.correct_output is not None and corrected_value == step.correct_output
    is_root = trace.gold_root_step_id == step_id
    success = bool(fixes_value and is_root)
    return [success] * n
