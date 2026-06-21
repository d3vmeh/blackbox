"""P1 — Capture: OTel/OpenInference spans + LangGraph checkpoints -> canonical Trace.

For the demo the deterministic pipeline in graph.py records directly via `Recorder`
(str step ids "s1".."sN", true `parents` edges, a JSON-serializable `state` snapshot per
step). `to_trace()` adapts LangGraph checkpoint history into the same Trace shape.
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
               is_injected_fault: bool = False, correct_output: Any = None,
               agent: Optional[str] = None) -> str:
        idx = len(self._steps)
        sid = f"s{idx + 1}"
        raw: dict[str, Any] = {"node": node}
        if agent is not None:          # multi-agent runs tag which agent owns the step
            raw["agent"] = agent
        self._steps.append(Step(
            id=sid, index=idx, kind=kind, inputs=inputs, output=output,
            state=copy.deepcopy(state), parents=parents, tool_name=tool_name,
            raw=raw, is_injected_fault=is_injected_fault, correct_output=correct_output,
        ))
        return sid

    def finish(self, *, final_output: Any, success: Optional[bool] = None,
               gold_root_step_id: Optional[str] = None) -> Trace:
        return Trace(id=self.trace_id, task=self.task, steps=self._steps,
                     final_output=final_output, success=success,
                     gold_root_step_id=gold_root_step_id)


def to_trace(app: Any, config: dict, *, task: str, trace_id: str) -> Trace:
    """Convert LangGraph checkpoint history to a canonical Trace.

    Works on ANY LangGraph agent — no Recorder needed inside the agent.
    Each checkpoint is a state snapshot after one node ran; Steps are
    reconstructed from consecutive state diffs.
    """
    history = list(app.get_state_history(config))
    if not history:
        raise ValueError(f"No checkpoints found for thread {config}")

    # LangGraph returns newest-first; reverse for chronological order.
    # Each snapshot's state reflects what has run so far; snapshot.next tells
    # which node runs next. So the node that produced snapshot[i] is snapshot[i-1].next[0].
    history = list(reversed(history))

    def _kind(node_name: str) -> str:
        n = node_name.lower()
        if any(x in n for x in ("result", "output", "response")):
            return "tool_result"
        if any(x in n for x in ("call", "search", "fetch", "send", "book", "pay")):
            return "tool_call"
        if any(x in n for x in ("final", "finish", "done", "complete")):
            return "final"
        if any(x in n for x in ("decide", "select", "choose", "pick")):
            return "decision"
        return "reason"

    steps: list[Step] = []

    for i, snapshot in enumerate(history):
        if i == 0:
            continue  # initial state — no node ran yet
        prev_snap = history[i - 1]
        node_name = (prev_snap.next or (None,))[0]
        if not node_name or node_name.startswith("__"):
            continue

        prev_vals = {k: v for k, v in (prev_snap.values or {}).items() if not k.startswith("__")}
        curr_vals = {k: v for k, v in (snapshot.values or {}).items() if not k.startswith("__")}

        inputs = dict(prev_vals)
        output = {k: curr_vals[k] for k in curr_vals if curr_vals.get(k) != prev_vals.get(k)}
        if not output:
            output = dict(curr_vals)

        sid = f"s{len(steps) + 1}"
        parents = [steps[-1].id] if steps else []
        steps.append(Step(
            id=sid, index=len(steps), kind=_kind(node_name),
            inputs=inputs, output=output, state=dict(curr_vals),
            parents=parents, raw={"node": node_name},
        ))

    if not steps:
        raise ValueError("Checkpoint history had no node executions")

    steps[-1] = steps[-1].model_copy(update={"kind": "final"})
    return Trace(id=trace_id, task=task, steps=steps, final_output=steps[-1].output)
