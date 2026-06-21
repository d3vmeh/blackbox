"""Canonical data contracts for Blackbox — the seams between all four workstreams.

BUILD FIRST. Everyone codes against these models; do not rename fields without
updating this file and notifying the other workstreams. The frontend mirrors
these types in `web/src/types.ts`.

The five types below map 1:1 to the pipeline:
    Trace      -> what the agent did (recorded)
    Candidate  -> a ranked suspect step (localized)
    Attribution-> root cause + blast radius (localized + sliced)
    ReplayResult-> intervention outcome (confirmed or rejected)
"""

from __future__ import annotations

from typing import Any, Optional

from pydantic import BaseModel, Field


class Step(BaseModel):
    """One node in the agent run. `parents` are TRUE data-flow edges (this step's
    inputs were produced by those steps' outputs), NOT merely "the previous step".
    The provenance graph and both program slices depend on this being real."""

    id: str                          # stable step id, e.g. "s4"
    index: int                       # 0-based order in the run
    kind: str                        # reason | tool_call | tool_result | decision | final
    inputs: dict[str, Any]           # named values this step consumed
    output: Any                      # what this step produced
    state: dict[str, Any]            # agent-state snapshot AFTER this step (for fork/replay)
    parents: list[str]               # ids of steps whose outputs fed this step's inputs
    tool_name: Optional[str] = None
    raw: dict[str, Any] = Field(default_factory=dict)  # original span/checkpoint payload

    # --- ground-truth labels (P1/eval): present only in fixtures / fault-injected runs ---
    is_injected_fault: bool = False
    correct_output: Optional[Any] = None   # what this step SHOULD have produced


class Trace(BaseModel):
    """A full recorded run. `success` is None until the oracle evaluates it."""

    id: str
    task: str                        # the task the agent was given
    steps: list[Step]
    final_output: Any
    success: Optional[bool] = None   # set by eval/oracle.evaluate()

    # --- ground-truth label (P1/eval): the true root-cause step id, fixtures only ---
    gold_root_step_id: Optional[str] = None


class Candidate(BaseModel):
    """A ranked suspect. `suspicion` blends the node-judge verdict with a
    graph-depth (earliest-wins) prior. See ARCHITECTURE.md §Localization for why
    Ochiai is NOT load-bearing on a single trace."""

    step_id: str
    suspicion: float                 # ranked score in [0, 1]
    reason: str                      # short human-readable rationale


class Attribution(BaseModel):
    """Output of localization: the earliest-wrong step plus the forward slice of
    everything that inherited its output. `candidates` is ranked so the UI can
    show alternates and replay can fall back when a candidate fails to flip."""

    trace_id: str
    root_step_id: str                # localized earliest-wrong step
    blast_radius: list[str]          # step ids in the forward slice from root
    candidates: list[Candidate]      # ranked; index 0 is the leading suspect
    rationale: str                   # plain-English explanation of the root cause
    suggested_fix: Optional[Any] = None   # corrected output for root_step_id, usable as replay injected_value
    confidence: float = 0.0          # 0.0–1.0; high = safe to auto-fix, low = escalate to human


class ReplayResult(BaseModel):
    """Output of an intervention. A NON-FLIP is a valid, expected result — it
    disproves a candidate and tells replay to fall back to the next one. Never
    treat flipped=False as an error."""

    trace_id: str
    step_id: str                     # the step we forked at
    injected_value: Any              # the corrected value we injected
    n: int                           # number of re-runs (web target is non-deterministic)
    flipped: bool                    # did the outcome flip fail->pass at all
    confirmation_rate: float         # fraction of n re-runs that passed, in [0, 1]
    outcomes: list[bool]             # per-run pass/fail
