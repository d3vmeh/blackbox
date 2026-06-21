"""P1 — Real-LLM coding pipeline (the subject Blackbox monitors). Four agents pass
structured hand-offs:

    SPEC-INTERPRETER -> IMPLEMENTER -> REVIEWER
                     -> TEST-WRITER -/

Each agent's output is a deterministic REFERENCE function of its upstream (mock
fallback + answer key). When a `think` (real Claude) is supplied and returns text,
that overrides the reference. A scenario fault corrupts one field of one agent's
output; the wrong value propagates and the acceptance oracle FAILs. Mirrors
agent/ap_graph.py; same fork/replay shape."""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Optional

from eval.code_oracle import evaluate_code
from shared.schema import Trace

from .capture import Recorder
from .code_scenarios import AGENTS, DEFAULT, CodeScenario
from .llm import Think

PARENTS: dict[str, list[str]] = {
    "spec_interpreter": [],
    "implementer": ["spec_interpreter"],
    "test_writer": ["spec_interpreter"],
    "reviewer": ["implementer", "test_writer", "spec_interpreter"],
}
KIND = {"spec_interpreter": "decision", "implementer": "decision",
        "test_writer": "decision", "reviewer": "final"}


@dataclass
class CodeContext:
    rec: Recorder
    scn: CodeScenario
    think: Optional[Think] = None
    up: dict = field(default_factory=dict)        # agent -> recorded output
    last: dict = field(default_factory=dict)      # agent -> step id
    fork_agent: Optional[str] = None
    override: Optional[dict] = None


def _agent_output(ctx: CodeContext, agent: str) -> tuple[dict, bool, dict]:
    """Reference output (correct), then real-LLM override if available, then fault."""
    correct = ctx.scn.reference[agent](ctx.scn, ctx.up)
    out = dict(correct)
    # (real-LLM override is wired in Task 6; mock mode uses the reference as-is)
    fault = ctx.scn.fault
    is_fault = bool(fault and fault.agent == agent)
    if is_fault:
        out[fault.field] = fault.bad_value
    return out, is_fault, correct


def _emit(ctx: CodeContext, agent: str, out: dict, is_fault: bool, correct: dict) -> None:
    inputs = ({"requirement": ctx.scn.requirement} if agent == "spec_interpreter"
              else {"from": PARENTS[agent]})
    sid = ctx.rec.record(node=agent, agent=agent, kind=KIND[agent], inputs=inputs,
                         output=out, state={"up": dict(ctx.up)},
                         parents=[ctx.last[p] for p in PARENTS[agent]],
                         correct_output=correct, is_injected_fault=is_fault)
    ctx.last[agent] = sid
    ctx.up[agent] = out
    if ctx.fork_agent == agent and ctx.override:               # inject the replay correction
        ctx.up[agent] = {**ctx.up[agent], **ctx.override}


def _run(ctx: CodeContext) -> Trace:
    for agent in AGENTS:
        _emit(ctx, agent, *_agent_output(ctx, agent))
    final_code = ctx.up["implementer"]["code"]
    final = {"code": final_code, "approved": ctx.up["reviewer"]["approved"]}
    return ctx.rec.finish(final_output=final,
                          success=evaluate_code(final_code, ctx.scn))


def run_code(scenario: CodeScenario = DEFAULT, *, think: Optional[Think] = None,
             trace_id: str = "code_live") -> Trace:
    return _run(CodeContext(rec=Recorder(trace_id, scenario.name), scn=scenario, think=think))
