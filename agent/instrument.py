"""Capture an agent run into the canonical `Trace` contract.

Use TraceRecorder while the agent executes (from LangGraph stream events / callbacks),
then `finish()` to get a `Trace` that P2/P3/P4 consume.
"""
from __future__ import annotations

from typing import Any, Optional

from shared.schema import Step, StepKind, Trace


class TraceRecorder:
    def __init__(self, trace_id: str, task: str) -> None:
        self.trace_id = trace_id
        self.task = task
        self._steps: list[Step] = []
        self._t = 0.0

    def record(
        self,
        kind: StepKind | str,
        name: str,
        *,
        inputs: Optional[dict[str, Any]] = None,
        output: Any = None,
        state_after: Optional[dict[str, Any]] = None,
        parent_ids: Optional[list[int]] = None,
        is_injected_fault: bool = False,
        correct_output: Any = None,
    ) -> int:
        """Record one step; returns its id (1-based)."""
        sid = len(self._steps) + 1
        self._steps.append(
            Step(
                id=sid,
                kind=StepKind(kind) if isinstance(kind, str) else kind,
                name=name,
                inputs=inputs or {},
                output=output,
                state_after=state_after or {},
                parent_ids=parent_ids or [],
                ts=self._t,
                is_injected_fault=is_injected_fault,
                correct_output=correct_output,
            )
        )
        self._t += 1.0
        return sid

    def finish(self, *, final_output: Any, success: bool,
               gold_root_step_id: Optional[int] = None) -> Trace:
        return Trace(
            id=self.trace_id,
            task=self.task,
            final_output=final_output,
            success=success,
            steps=self._steps,
            gold_root_step_id=gold_root_step_id,
        )


# TODO(P1): a LangGraph callback / stream-event adapter that calls recorder.record(...)
# for each node + tool. Also emit OpenInference/OTel spans here for the Arize track.
