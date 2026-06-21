"""P1 — The software-team pipeline (the subject Blackbox monitors). Eight agents pass
structured hand-offs; the 3 leaf modules run in parallel:

    ARCHITECT -> {PRICING, DISCOUNT, TAX} -> INTEGRATOR -> TEST -> REVIEW -> CI

When a `think` (real Claude) is wired, the 3 leaf modules are real model calls; the
architect/integrator/test/review/ci stay deterministic reference fns so the injected
contract bug propagates reliably. Without `think`, every agent is its reference output.
Mirrors agent/code/graph.py; same fork/inject/replay shape, plus parallel fan-out."""
from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, field
from typing import Optional

from agent.team.oracle import evaluate_package
from shared.schema import Trace

from ..capture import Recorder
from ..llm import Think
from .scenarios import DEFAULT, KIND, PARENTS, RUN_ORDER, TeamScenario

TEAM_MODEL = "claude-haiku-4-5"   # fast/cheap; scoped to this subject


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


def _llm_module(think: Think, signature: str, summary: str) -> Optional[dict]:
    """Real Claude writes one leaf module; None on an unusable reply (caller falls back)."""
    name = signature.split("(")[0].strip()
    code = think("You are a Python implementer. Return ONLY a runnable function definition "
                 "(no markdown, no prose).", f"Write def {signature}:\n{summary}")
    code = _strip_code(code)
    return {"code": code} if f"def {name}" in code else None


# Only the 3 leaf modules are live; everything else is deterministic reference.
_LLM = {
    "pricing": lambda think: _llm_module(
        think, "subtotal_cents(items, catalog)",
        "catalog maps each item's 'sku' to an integer unit price in cents. Return the sum of "
        "catalog[item['sku']] * item['qty'] over items."),
    "discount": lambda think: _llm_module(
        think, "discount_cents(subtotal, tier_rate_pct)",
        "Return round-half-up of subtotal * tier_rate_pct / 100 as an int "
        "(use math.floor(x + 0.5))."),
    "tax": lambda think: _llm_module(
        think, "tax_cents(taxable, region_bp)",
        "region_bp is a tax rate in basis points. Return round-half-up of "
        "taxable * region_bp / 10000 as an int (use math.floor(x + 0.5))."),
}


@dataclass
class TeamContext:
    rec: Recorder
    scn: TeamScenario
    think: Optional[Think] = None
    up: dict = field(default_factory=dict)
    last: dict = field(default_factory=dict)
    fork_agent: Optional[str] = None
    override: Optional[dict] = None


def _agent_output(ctx: TeamContext, agent: str) -> tuple[dict, bool, dict]:
    """Reference output (answer key + fallback), replaced by a real-LLM output for the live
    leaf modules, then the scenario fault (if any) overrides one field."""
    correct = ctx.scn.reference[agent](ctx.scn, ctx.up)
    out = dict(correct)
    if ctx.think is not None and agent in _LLM:
        llm = _LLM[agent](ctx.think)
        if llm is not None:
            out = llm
    fault = ctx.scn.fault
    is_fault = bool(fault and fault.agent == agent)
    if is_fault:
        out[fault.field] = fault.bad_value
    return out, is_fault, correct


def _emit(ctx: TeamContext, agent: str, out: dict, is_fault: bool, correct: dict) -> None:
    inputs = ({"task": "build compute_receipt(order)"} if agent == "architect"
              else {"from": PARENTS[agent]})
    sid = ctx.rec.record(node=agent, agent=agent, kind=KIND[agent], inputs=inputs,
                         output=out, state={"up": dict(ctx.up)},
                         parents=[ctx.last[p] for p in PARENTS[agent]],
                         correct_output=correct, is_injected_fault=is_fault)
    ctx.last[agent] = sid
    ctx.up[agent] = out
    if ctx.fork_agent == agent and ctx.override:               # inject the replay correction
        ctx.up[agent] = {**ctx.up[agent], **ctx.override}


def _assemble(up: dict) -> dict:
    return {"contract.py": up["architect"]["contract_code"],
            "pricing.py": up["pricing"]["code"],
            "discount.py": up["discount"]["code"],
            "tax.py": up["tax"]["code"],
            "receipt.py": up["integrator"]["code"]}


def _run(ctx: TeamContext) -> Trace:
    for step in RUN_ORDER:
        if isinstance(step, tuple):                            # parallel fan-out
            with ThreadPoolExecutor(max_workers=len(step)) as pool:
                futures = {a: pool.submit(_agent_output, ctx, a) for a in step}
                for a in step:
                    _emit(ctx, a, *futures[a].result())
        else:
            _emit(ctx, step, *_agent_output(ctx, step))
    modules = _assemble(ctx.up)
    final = {"modules": modules, "approved": ctx.up["reviewer"]["approved"]}
    return ctx.rec.finish(final_output=final,
                          success=evaluate_package(modules, ctx.scn.acceptance_tests))


def run_team(scenario: TeamScenario = DEFAULT, *, think: Optional[Think] = None,
             trace_id: str = "team_live") -> Trace:
    return _run(TeamContext(rec=Recorder(trace_id, scenario.name), scn=scenario, think=think))


def replay_team(scenario: TeamScenario, fork_agent: Optional[str] = None,
                override: Optional[dict] = None, *, think: Optional[Think] = None,
                trace_id: str = "team_replay") -> Trace:
    """Counterfactual: re-run with the scenario fault present, optionally injecting a
    correction right after `fork_agent`. override=None -> baseline (still broken)."""
    return _run(TeamContext(rec=Recorder(trace_id, scenario.name), scn=scenario, think=think,
                            fork_agent=fork_agent, override=override))
