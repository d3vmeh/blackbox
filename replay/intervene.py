"""Apply the intervention: set step k's output to a corrected value (the do-operator)."""
from __future__ import annotations

from typing import Any

from pydantic import BaseModel

from .fork import ForkPoint


class Intervention(BaseModel):
    trace_id: str
    step_id: int
    corrected_value: Any


def apply_intervention(fork: ForkPoint, corrected_value: Any) -> Intervention:
    return Intervention(
        trace_id=fork.trace_id,
        step_id=fork.before_step,
        corrected_value=corrected_value,
    )


# TODO(P1): in the live path this writes corrected_value into the forked LangGraph state
# before re-invoking. Define the replayability taxonomy here too:
#   faithful (re-run) | stub (serve cached tool output) | non-replayable (mock side effects).
