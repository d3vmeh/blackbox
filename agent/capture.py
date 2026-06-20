"""P1 — Capture: OTel/OpenInference spans + LangGraph checkpoints -> canonical Trace.

to_trace() builds the Trace (and the step_id <-> LangGraph checkpoint_id mapping
that replay() needs). Keep checkpointed Step.state JSON-serializable; reconstruct
live resources (browser sessions, tool clients) fresh on resume rather than
hydrating them from the snapshot.
"""

from __future__ import annotations

from typing import Any

from shared.schema import Trace


def to_trace(spans: list[Any], checkpoints: list[Any]) -> Trace:
    raise NotImplementedError("P1: build canonical Trace from spans + checkpoints")
