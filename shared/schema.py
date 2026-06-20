"""Canonical data contracts for Blackbox — the seams between the four workstreams.

Locked at Hour 0; change ONLY by team agreement (everyone imports these).

    Trace        : P1 -> P2, P3, P4   (the recorded agent run)
    Attribution  : P2 -> P3, P4        (root cause + blast radius)
    ReplayResult : P1 -> P3, P4        (counterfactual confirmation)
"""
from __future__ import annotations

from enum import Enum
from typing import Any, Optional

from pydantic import BaseModel, Field


class StepKind(str, Enum):
    llm = "llm"
    tool_call = "tool_call"
    tool_result = "tool_result"
    router = "router"
    output = "output"


class Step(BaseModel):
    id: int                                   # 1-based, in execution order
    kind: StepKind
    name: str                                 # e.g. "search_flights", "parse_date"
    inputs: dict[str, Any] = Field(default_factory=dict)
    output: Any = None
    state_after: dict[str, Any] = Field(default_factory=dict)  # LangGraph checkpoint snapshot/diff
    parent_ids: list[int] = Field(default_factory=list)        # data/control ancestry
    ts: float = 0.0

    # ground-truth annotations — present only in fixtures / fault-injected runs
    is_injected_fault: bool = False
    correct_output: Optional[Any] = None      # what this step SHOULD have produced


class Trace(BaseModel):
    id: str
    task: str
    final_output: Any = None
    success: bool = False
    steps: list[Step] = Field(default_factory=list)
    gold_root_step_id: Optional[int] = None   # ground truth for eval (fixtures only)


class Candidate(BaseModel):
    step_id: int
    score: float
    reason: str = ""


class Attribution(BaseModel):
    trace_id: str
    root_step_id: Optional[int] = None
    blast_radius: list[int] = Field(default_factory=list)     # downstream contaminated step ids
    candidates: list[Candidate] = Field(default_factory=list)  # ranked suspects
    rationale: str = ""


class ReplayRequest(BaseModel):
    trace_id: str
    step_id: int
    corrected_value: Any


class ReplayResult(BaseModel):
    trace_id: str
    step_id: int
    n: int                          # number of replays run
    confirmation_rate: float        # fraction that flipped fail -> pass
    flipped: bool                   # rate >= threshold
    outcomes: list[bool] = Field(default_factory=list)
