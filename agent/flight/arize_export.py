"""Emit LangGraph flight traces to Arize AX (FAIL + healed pair).

Batch both traces then flush once — same pattern as eval/arize_pipeline.py.
"""
from __future__ import annotations

import os

from shared.schema import MonitorDecision, Trace

from .. import tracing
from ..otel import emit_trace

_FORK_NODE = "parse_date"


def _monitor_meta(monitor: MonitorDecision, *, healed: bool = False) -> dict:
    return {
        "root_step_id": monitor.root_step_id,
        "root_node": _FORK_NODE,
        "replay_confirmed": monitor.replay.flipped,
        "confirmation_rate": monitor.replay.confirmation_rate,
        "monitor_decision": monitor.decision,
        "runtime": "langgraph",
        "domain": "flight",
        "healed": healed,
    }


def emit_flight_pair(fail: Trace, monitor: MonitorDecision, healed: Trace | None = None) -> bool:
    """Export flight_run (+ flight_healed when trusted) to Arize. Returns True on successful flush."""
    meta_fail = _monitor_meta(monitor, healed=False)
    emit_trace(fail, backend="arize", monitor=meta_fail, flush=False)
    if healed is not None:
        emit_trace(healed, backend="arize", monitor=_monitor_meta(monitor, healed=True), flush=False)
    ok = tracing.flush_tracing()
    tracing.shutdown_tracing()
    project = os.environ.get("ARIZE_PROJECT_NAME", "blackbox-ap")
    ids = [fail.id] + ([healed.id] if healed else [])
    print(f"[arize] project={project!r} traces={ids} -> https://app.arize.com")
    return ok
