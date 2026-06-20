"""P1 — Enterprise Accounts-Payable multi-agent system. The subject Blackbox monitors.

    EXTRACTOR ──▶ MATCHER ─┐
                  FRAUD  ──┴▶ APPROVER ──▶ PAYMENT
                  (run concurrently)

Each agent's correct output is a PURE function of the scenario + its upstream agents'
outputs (`COMPUTE`). A scenario may inject a fault at ANY agent/field; the wrong value
then propagates and the company pays the wrong bill (oracle FAIL). The same `COMPUTE`
functions are reused by the monitor (agent/monitor.py) as a deterministic node-judge, so
localization needs no duplicated logic. Deterministic → the FAIL→PASS flip is reliable.
"""

from __future__ import annotations

import time
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, field
from typing import Any, Callable, Optional

from eval.ap_oracle import evaluate_ap
from shared.schema import Trace

from .ap_scenarios import DEFAULT, VENDOR_ALLOWLIST, Scenario
from .capture import Recorder

WORK_DELAY = 0.25                  # simulated work (only when ctx.timed) — makes parallelism visible

PARENTS: dict[str, list[str]] = {
    "extractor": [], "matcher": ["extractor"], "fraud": ["extractor"],
    "approver": ["matcher", "fraud"], "payment": ["approver"],
}
KIND = {"extractor": "tool_result", "matcher": "decision", "fraud": "decision",
        "approver": "decision", "payment": "final"}


# --- pure per-agent compute: the CORRECT output given scenario + upstream outputs ---
def _c_extractor(scn: Scenario, up: dict) -> dict:
    return {"vendor": scn.vendor, "amount": scn.amount, "due_date": scn.due_date, "po": scn.po}


def _c_matcher(scn: Scenario, up: dict) -> dict:
    ex = up["extractor"]
    po = scn.po_book().get(ex["po"])
    return {"po": ex["po"], "vendor_ok": bool(po and po["vendor"] == ex["vendor"]),
            "amount": ex["amount"]}


def _c_fraud(scn: Scenario, up: dict) -> dict:
    ex = up["extractor"]
    return {"vendor": ex["vendor"], "risk": "low" if ex["vendor"] in VENDOR_ALLOWLIST else "high"}


def _c_approver(scn: Scenario, up: dict) -> dict:
    m, f = up["matcher"], up["fraud"]
    approved = (m["amount"] < scn.approval_limit) and m["vendor_ok"] and (f["risk"] == "low")
    return {"approved": approved, "amount": m["amount"]}


def _c_payment(scn: Scenario, up: dict) -> dict:
    ex, ap = up["extractor"], up["approver"]
    paid = ap["approved"]
    return {"vendor": ex["vendor"], "amount_paid": ap["amount"] if paid else 0.0,
            "due_date": ex["due_date"], "po": ex["po"],
            "status": "paid" if paid else "blocked"}


COMPUTE: dict[str, Callable[[Scenario, dict], dict]] = {
    "extractor": _c_extractor, "matcher": _c_matcher, "fraud": _c_fraud,
    "approver": _c_approver, "payment": _c_payment,
}


@dataclass
class APContext:
    rec: Recorder
    scn: Scenario
    up: dict = field(default_factory=dict)          # agent -> recorded output
    last: dict = field(default_factory=dict)        # agent -> step id
    fork_agent: Optional[str] = None
    override: Optional[dict] = None
    timed: bool = False                             # True → simulate work (live demo only)
    parallel_s: float = 0.0


def _compute(ctx: APContext, agent: str) -> tuple[dict, bool, dict]:
    """Compute an agent's output (thread-safe: only reads ctx.up). Applies the scenario fault."""
    if ctx.timed:
        time.sleep(WORK_DELAY)
    correct = COMPUTE[agent](ctx.scn, ctx.up)
    out = dict(correct)
    fault = ctx.scn.fault
    is_fault = bool(fault and fault.agent == agent)
    if is_fault:
        out[fault.field] = fault.bad_value
    return out, is_fault, correct


def _emit(ctx: APContext, agent: str, out: dict, is_fault: bool, correct: dict) -> None:
    inputs = ({"invoice_text": ctx.scn.invoice_text()} if agent == "extractor"
              else {"from": PARENTS[agent]})
    sid = ctx.rec.record(node=agent, agent=agent, kind=KIND[agent], inputs=inputs,
                         output=out, state={"up": dict(ctx.up)},
                         parents=[ctx.last[p] for p in PARENTS[agent]],
                         correct_output=correct, is_injected_fault=is_fault)
    ctx.last[agent] = sid
    ctx.up[agent] = out
    # inject a replay/heal correction right after the forked agent records its (bad) step
    if ctx.fork_agent == agent and ctx.override:
        ctx.up[agent] = {**ctx.up[agent], **ctx.override}


def _produce(ctx: APContext, agent: str) -> None:
    _emit(ctx, agent, *_compute(ctx, agent))


def _run(ctx: APContext) -> Trace:
    _produce(ctx, "extractor")
    # MATCHER ∥ FRAUD — independent; compute concurrently, then record in fixed order.
    t0 = time.perf_counter()
    with ThreadPoolExecutor(max_workers=2) as pool:
        rm, rf = pool.submit(_compute, ctx, "matcher"), pool.submit(_compute, ctx, "fraud")
        m, f = rm.result(), rf.result()
    ctx.parallel_s = time.perf_counter() - t0
    _emit(ctx, "matcher", *m)
    _emit(ctx, "fraud", *f)
    _produce(ctx, "approver")
    _produce(ctx, "payment")
    final = ctx.up["payment"]
    return ctx.rec.finish(final_output=final, success=evaluate_ap(final, ctx.scn))


# --- entry points -----------------------------------------------------------
def run_ap(scenario: Scenario = DEFAULT, *, timed: bool = False, trace_id: str = "ap_live") -> Trace:
    """One full run of the AP system on `scenario` (its fault, if any, is injected)."""
    return _run(APContext(rec=Recorder(trace_id, scenario.name), scn=scenario, timed=timed))


def replay_ap(scenario: Scenario, fork_agent: Optional[str] = None,
              override: Optional[dict] = None, *, trace_id: str = "ap_replay") -> Trace:
    """Counterfactual: re-run with the scenario's fault present, optionally injecting a
    correction right after `fork_agent`. override=None → baseline (still broken)."""
    ctx = APContext(rec=Recorder(trace_id, scenario.name), scn=scenario,
                    fork_agent=fork_agent, override=override, timed=False)
    return _run(ctx)


if __name__ == "__main__":
    t = run_ap()
    print(f"AP run [{t.task}]: {len(t.steps)} steps, success={t.success}, paid={t.final_output}")
