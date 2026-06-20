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


def classify(step_name: str) -> str:
    """Replayability of a step: 'faithful' | 'stub' | 'side_effect'.

    The taxonomy lives with the agent (agent.subject_agent.REPLAYABILITY); side_effect nodes
    are stubbed during replay via RunContext.replay_mode so re-running never books/sends for
    real. Defaults to 'faithful' if the agent isn't importable (e.g. replaying a foreign trace).
    """
    try:
        from agent.subject_agent import REPLAYABILITY
        return REPLAYABILITY.get(step_name, "faithful")
    except Exception:
        return "faithful"
