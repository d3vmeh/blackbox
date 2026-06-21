"""Programmed fault injection (the AgenTracer technique).

Perturb a *successful* trace at a chosen step to manufacture a failure with known ground
truth — the labels for the eval benchmark. `propagate=(old, new)` string-replaces old->new
in every downstream step's output so the failing trace looks like the error flowed forward.
"""
from __future__ import annotations

import copy
from typing import Any, Optional

from shared.schema import Trace


def _replace_in(value: Any, old: str, new: str) -> Any:
    if isinstance(value, str):
        return value.replace(old, new)
    if isinstance(value, dict):
        return {k: (v.replace(old, new) if isinstance(v, str) else v) for k, v in value.items()}
    return value


def inject_fault(trace: Trace, step_id: str, bad_output: Any,
                 final_output: Any = None,
                 propagate: Optional[tuple[str, str]] = None) -> Trace:
    t = trace.model_copy(deep=True)
    target = next((s for s in t.steps if s.id == step_id), None)
    if target is None:
        raise ValueError(f"step {step_id} not found in trace {trace.id}")
    target.correct_output = copy.deepcopy(target.output)
    target.output = bad_output
    target.is_injected_fault = True

    if propagate is not None:
        old, new = propagate
        for s in t.steps:
            if s.index > target.index:
                s.output = _replace_in(s.output, old, new)

    t.success = False
    t.gold_root_step_id = step_id
    if final_output is not None:
        t.final_output = final_output
    return t
