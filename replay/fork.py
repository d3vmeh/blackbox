"""Fork a run just before a chosen step.

Real version: restore the LangGraph checkpoint taken before `step_id` (time-travel).
Stub version: return the prefix of the trace, which is enough for P3/P4 to wire the UI.
"""
from __future__ import annotations

from pydantic import BaseModel

from shared.schema import Step, Trace


class ForkPoint(BaseModel):
    trace_id: str
    before_step: int
    prefix_steps: list[Step]


def fork_at(trace: Trace, step_id: int) -> ForkPoint:
    prefix = [s for s in trace.steps if s.id < step_id]
    return ForkPoint(trace_id=trace.id, before_step=step_id, prefix_steps=prefix)


# TODO(P1): replace prefix-based stub with a real LangGraph checkpoint restore:
#   config = {"configurable": {"thread_id": ..., "checkpoint_id": <before step_id>}}
#   graph.update_state(config, {<field>: corrected_value}); graph.invoke(None, config)
