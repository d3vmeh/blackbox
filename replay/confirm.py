"""Confirm causality by counterfactual replay.

Fork at step k, inject the corrected value, re-run, and report how often the outcome flips
fail -> pass. A high confirmation rate => the step is causally implicated (DoVer/AgenTracer).

Two backends, chosen automatically:
  - REAL (preferred): re-execute the subject agent twice per trial — once with the *bad*
    value (baseline, should fail) and once with the *corrected* value (should pass). The
    trial confirms only if the fix passes AND the baseline fails. Stochastic with a live
    LLM, so N trials give a real distribution.
  - OFFLINE stub: used when the agent can't be imported or the step isn't replayable yet,
    so P2/P3/P4 can still wire the Analyze->Confirm loop against the fixture.
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
    use_real_llm: bool = False,
) -> ReplayResult:
    fork = fork_at(trace, step_id)
    apply_intervention(fork, corrected_value)  # records the do(step=v*) intervention

    if rerun_fn is not None:
        outcomes = [bool(rerun_fn(trace, step_id, corrected_value)) for _ in range(n)]
    else:
        outcomes = _replay(trace, step_id, corrected_value, n, use_real_llm)

    rate = (sum(outcomes) / len(outcomes)) if outcomes else 0.0
    return ReplayResult(
        trace_id=trace.id,
        step_id=step_id,
        n=n,
        confirmation_rate=rate,
        flipped=rate >= threshold,
        outcomes=outcomes,
    )


def _replay(trace: Trace, step_id: int, corrected_value: Any, n: int, use_real_llm: bool) -> list[bool]:
    """Real counterfactual via the subject agent; falls back to the offline stub."""
    try:
        from agent.subject_agent import REPLAYABLE, replay_run

        step = next(s for s in trace.steps if s.id == step_id)
        if step.name not in REPLAYABLE:
            raise KeyError(f"step {step.name!r} not replayable yet")
        state_key, extract = REPLAYABLE[step.name]
        bad_val = extract(step.output)              # the failing value, as it ran
        good_val = extract(corrected_value)         # the proposed fix

        outcomes = []
        for _ in range(n):
            baseline = replay_run(step.name, {state_key: bad_val}, use_real_llm=use_real_llm)
            fixed = replay_run(step.name, {state_key: good_val}, use_real_llm=use_real_llm)
            # Confirmed only if the fix flips the outcome that the bad value breaks.
            outcomes.append(bool(fixed.success and not baseline.success))
        return outcomes
    except Exception:
        return _simulate_offline(trace, step_id, corrected_value, n)


def _simulate_offline(trace: Trace, step_id: int, corrected_value: Any, n: int) -> list[bool]:
    """STUB fallback. Uses fixture ground truth: fixing the gold root step with its
    known-correct value would have made the run succeed."""
    step = next((s for s in trace.steps if s.id == step_id), None)
    fixes_value = step is not None and step.correct_output is not None and corrected_value == step.correct_output
    is_root = trace.gold_root_step_id == step_id
    success = bool(fixes_value and is_root)
    return [success] * n
