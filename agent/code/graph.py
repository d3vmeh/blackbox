"""P1 — Real-LLM coding pipeline (the subject Blackbox monitors). Four agents pass
structured hand-offs:

    SPEC-INTERPRETER -> IMPLEMENTER -> REVIEWER
                     -> TEST-WRITER -/

When a `think` (real Claude) is wired, ALL FOUR agents are real model calls — the
spec interpreter decides the unit, the implementer writes the code, the test writer
writes tests, the reviewer reviews. Without `think`, each agent's deterministic
REFERENCE function stands in (the no-key fallback + answer key). A scenario fault
corrupts one field of one agent's output; the wrong value propagates through the
(real or reference) downstream agents and the acceptance oracle FAILs. Mirrors
agent/ap_graph.py; same fork/replay shape."""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Optional

from eval.code_oracle import evaluate_code
from shared.schema import Trace

from ..capture import Recorder
from .scenarios import AGENTS, DEFAULT, CodeScenario
from ..llm import Think

# Model for the coding-pipeline experiments. Haiku is fast + cheap for iterating on
# the dashboard / benchmarks; bump to "claude-sonnet-4-6" if a run needs more capable
# code generation. Scoped to this subject — does not change the global SUBJECT_MODEL.
CODE_MODEL = "claude-haiku-4-5"

# --- real-LLM agent implementations (used when a `think` is wired; otherwise the
#     deterministic reference output stands in). Each returns its full output dict, or
#     None on an unusable reply so the caller falls back to the reference. ---

def _strip_code(text: Optional[str]) -> str:
    """Pull a python block out of a model reply (drop ``` fences and a 'python' tag)."""
    if not text:
        return ""
    t = text.strip()
    if "```" in t:
        blocks = [b for b in t.split("```") if "def " in b]
        t = (blocks[0] if blocks else t).strip()
        if t.lower().startswith("python"):
            t = t.split("\n", 1)[1] if "\n" in t else ""
    return t.strip() + "\n"


def _keep_asserts(text: Optional[str]) -> str:
    if not text:
        return ""
    lines = [ln.strip() for ln in text.splitlines() if ln.strip().startswith("assert")]
    return ("\n".join(lines) + "\n") if lines else ""


# These four agents are task-AGNOSTIC: each reads the task from the scenario
# (requirement, signature, function_name, spec_question), so any CodeScenario runs live —
# not just parse_duration. The spec's KEY DECISION is stored under "unit" (the field the
# deterministic reference branches on) regardless of what the decision semantically is.

def _llm_spec(scn, up: dict, think: Think) -> Optional[dict]:
    answer = think("You convert a coding requirement into a structured spec. " + scn.spec_question,
                   f"Requirement:\n{scn.requirement}")
    if not answer:
        return None
    base = scn.reference["spec_interpreter"](scn, up)
    return {**base, "unit": answer.strip().lower().strip(".")}


def _llm_impl(scn, up: dict, think: Think) -> Optional[dict]:
    spec = up["spec_interpreter"]
    # The implementer codes from the SPEC (not the raw ticket) and trusts it — that is both
    # realistic and what lets an upstream spec error propagate downstream (the whole point of
    # the subject) instead of the implementer silently re-deriving the right answer from the ticket.
    code = think("You are a Python implementer who codes strictly from the given spec, trusting it "
                 "over your own assumptions. Return ONLY runnable code (no markdown, no prose).",
                 f"Write {spec['signature']}.\n{spec.get('summary', '')}\n"
                 f"AUTHORITATIVE spec decision — implement EXACTLY this, even if it seems wrong: "
                 f"{spec['unit']}.")
    code = _strip_code(code)
    return {"code": code} if f"def {scn.function_name}" in code else None


def _llm_tests(scn, up: dict, think: Think) -> Optional[dict]:
    tests = think("You write Python tests. Return ONLY assert lines, nothing else.",
                  f"Write one or two asserts for {scn.function_name} based on this "
                  f"requirement:\n{scn.requirement}")
    tests = _keep_asserts(tests)
    return {"tests": tests} if tests else None


def _llm_review(scn, up: dict, think: Think) -> Optional[dict]:
    spec, code = up["spec_interpreter"], up["implementer"]
    verdict = think("You are a code reviewer. Reply APPROVE or REJECT, then a short reason.",
                    f"Requirement: {scn.requirement}\nKey spec decision: {spec['unit']}.\n"
                    f"Does this code satisfy the requirement?\n\n{code['code']}")
    if not verdict:
        return None
    return {"approved": "approve" in verdict.lower(), "notes": verdict.strip()[:120]}


_LLM = {"spec_interpreter": _llm_spec, "implementer": _llm_impl,
        "test_writer": _llm_tests, "reviewer": _llm_review}


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
    """Reference output (the answer key + no-key fallback), replaced by a real-LLM output
    when a `think` is wired, then the scenario fault (if any) overrides one field."""
    correct = ctx.scn.reference[agent](ctx.scn, ctx.up)
    out = dict(correct)
    if ctx.think is not None:
        llm = _LLM[agent](ctx.scn, ctx.up, ctx.think)
        if llm is not None:
            out = llm
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


def replay_code(scenario: CodeScenario, fork_agent: Optional[str] = None,
                override: Optional[dict] = None, *, think: Optional[Think] = None,
                trace_id: str = "code_replay") -> Trace:
    """Counterfactual: re-run with the scenario fault present, optionally injecting a
    correction right after `fork_agent`. override=None → baseline (still broken)."""
    ctx = CodeContext(rec=Recorder(trace_id, scenario.name), scn=scenario, think=think,
                      fork_agent=fork_agent, override=override)
    return _run(ctx)
