"""P1 — Capture: OTel/OpenInference spans + LangGraph checkpoints -> canonical Trace.

For the demo the deterministic pipeline in graph.py records directly via `Recorder`
(str step ids "s1".."sN", true `parents` edges, a JSON-serializable `state` snapshot per
step). `to_trace()` is the live-path adapter (spans + checkpoints) and is future work.
"""

from __future__ import annotations

import copy
from typing import Any, Optional

from shared.schema import Step, Trace


class Recorder:
    """Accumulates Steps as the agent runs; `finish()` emits the canonical Trace."""

    def __init__(self, trace_id: str, task: str) -> None:
        self.trace_id = trace_id
        self.task = task
        self._steps: list[Step] = []

    def record(self, *, node: str, kind: str, inputs: dict[str, Any], output: Any,
               state: dict[str, Any], parents: list[str], tool_name: Optional[str] = None,
               is_injected_fault: bool = False, correct_output: Any = None) -> str:
        idx = len(self._steps)
        sid = f"s{idx + 1}"
        self._steps.append(Step(
            id=sid, index=idx, kind=kind, inputs=inputs, output=output,
            state=copy.deepcopy(state), parents=parents, tool_name=tool_name,
            raw={"node": node}, is_injected_fault=is_injected_fault, correct_output=correct_output,
        ))
        return sid

    def finish(self, *, final_output: Any, success: Optional[bool] = None,
               gold_root_step_id: Optional[str] = None) -> Trace:
        return Trace(id=self.trace_id, task=self.task, steps=self._steps,
                     final_output=final_output, success=success,
                     gold_root_step_id=gold_root_step_id)


def to_trace(spans: list[Any], checkpoints: list[Any]) -> Trace:
    raise NotImplementedError("P1 (live path): build Trace from OTel spans + LangGraph checkpoints")
