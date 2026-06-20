"""Programmed fault injection (the AgenTracer technique).

Perturb a *successful* trace at a chosen step to manufacture a failure with known
ground truth — used to generate fixtures and the eval set.
"""
from __future__ import annotations

import copy
from typing import Any

from shared.schema import Trace


def inject_fault(trace: Trace, step_id: int, bad_output: Any,
                 final_output: Any = None) -> Trace:
    """Return a copy of `trace` where `step_id`'s output is corrupted.

    The original (correct) value is preserved on the step as `correct_output`, and
    `gold_root_step_id` is set — so attribution + replay have ground truth to score against.
    """
    t = trace.model_copy(deep=True)
    for s in t.steps:
        if s.id == step_id:
            s.correct_output = copy.deepcopy(s.output)
            s.output = bad_output
            s.is_injected_fault = True
            break
    else:
        raise ValueError(f"step {step_id} not found in trace {trace.id}")
    t.success = False
    t.gold_root_step_id = step_id
    if final_output is not None:
        t.final_output = final_output
    return t


# TODO(P1): once the live agent runs, capture a SUCCESSFUL trace, then call inject_fault()
# at several steps to build a small labeled benchmark for P4's eval harness.
