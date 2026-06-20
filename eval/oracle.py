"""P4 — Ground-truth success check. evaluate() decides Trace.success and scores
each replay re-run. For the flight demo this is deterministic: did the agent book
the correct date (07-12) for the correct trip? Keep it simple and total."""

from __future__ import annotations

from typing import Any


def evaluate(final_output: Any, task: str) -> bool:
    raise NotImplementedError("P4: deterministic oracle for the flight task")
