"""P1 — Enterprise Accounts-Payable multi-agent system. The subject Blackbox monitors.

Four agents pass an invoice down the line as structured hand-offs:

    EXTRACTOR ──▶ MATCHER ─┐
                  FRAUD  ──┴▶ APPROVER ──▶ PAYMENT
                  (run concurrently)

A controlled fault makes EXTRACTOR misread the invoice amount (a decimal slip:
$4,200.00 → $42,000.00). The wrong number is trusted by every downstream agent and
the company pays the wrong bill (oracle FAIL). The monitoring agent (agent/monitor.py)
localizes the earliest corrupted hand-off and PROVES the fix by counterfactual replay.

Deterministic by design — no LLM/network — so the on-stage FAIL→PASS flip is reliable.
MATCHER and FRAUD genuinely run in parallel (threads); the trace is still recorded in a
fixed order so step ids stay stable for replay.
"""

from __future__ import annotations

import time
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, field
from typing import Any, Optional

from eval.ap_oracle import evaluate_ap
from shared.schema import Trace

from .capture import Recorder

# --- ground truth: the real invoice + purchase order ------------------------
INVOICE_TEXT = (
    "INVOICE — Acme Corp\n"
    "PO: PO-7781\n"
    "Amount due: $4,200.00\n"
    "Due date: 2026-07-15\n"
)
TRUE = {"vendor": "Acme Corp", "amount": 4200.00, "due_date": "2026-07-15", "po": "PO-7781"}
PO_BOOK = {"PO-7781": {"vendor": "Acme Corp", "amount": 4200.00}}
APPROVAL_LIMIT = 50000.0            # auto-approve under this; the bad $42,000 slips under it
VENDOR_ALLOWLIST = {"Acme Corp", "Globex", "Initech"}
BUG_AMOUNT = 42000.00              # the misread amount
WORK_DELAY = 0.25                  # simulated agent work (live runs only) — makes parallelism visible

TASK = "Pay invoice PO-7781 (Acme Corp) the correct amount by the due date."

# agent that controls a value → the extraction key replay forks/injects on.
REPLAYABLE_AP = {"extractor": "amount"}


@dataclass
class APContext:
    rec: Recorder
    state: dict = field(default_factory=dict)
    last: dict = field(default_factory=dict)        # agent -> recorded step id
    inject_bug: bool = True
    replay_mode: bool = False                       # True → stub side effects + skip work delays


def _rec(ctx: APContext, agent: str, kind: str, output: Any, parents: list[str],
         inputs: Optional[dict] = None, correct_output: Any = None, fault: bool = False) -> str:
    sid = ctx.rec.record(node=agent, agent=agent, kind=kind, inputs=inputs or {},
                         output=output, state=ctx.state, parents=parents,
                         correct_output=correct_output, is_injected_fault=fault)
    ctx.last[agent] = sid
    return sid


def _work(ctx: APContext) -> None:
    if not ctx.replay_mode:
        time.sleep(WORK_DELAY)


# --- the agents -------------------------------------------------------------
def extractor(ctx: APContext) -> None:
    """Reads the raw invoice → structured fields. FAULT SITE: the `amount`."""
    _work(ctx)
    amount = BUG_AMOUNT if ctx.inject_bug else TRUE["amount"]
    out = {"vendor": TRUE["vendor"], "amount": amount,
           "due_date": TRUE["due_date"], "po": TRUE["po"]}
    ctx.state["extraction"] = out
    _rec(ctx, "extractor", "tool_result", out, parents=[],
         inputs={"invoice_text": INVOICE_TEXT},
         correct_output={**out, "amount": TRUE["amount"]},
         fault=ctx.inject_bug)


def _matcher_compute(ctx: APContext) -> dict:
    """Matches the invoice to a PO by number + vendor (not amount). Pure → thread-safe."""
    _work(ctx)
    ex = ctx.state["extraction"]
    po = PO_BOOK.get(ex["po"])
    return {"po": ex["po"], "vendor_ok": bool(po and po["vendor"] == ex["vendor"]),
            "amount": ex["amount"]}


def _fraud_compute(ctx: APContext) -> dict:
    """Flags vendors not on the allowlist. Pure → thread-safe."""
    _work(ctx)
    ex = ctx.state["extraction"]
    return {"vendor": ex["vendor"], "risk": "low" if ex["vendor"] in VENDOR_ALLOWLIST else "high"}


def _matcher_fraud_parallel(ctx: APContext) -> float:
    """Run MATCHER ∥ FRAUD concurrently (real threads), then record in fixed order.
    Returns wall-clock seconds the concurrent pair took."""
    t0 = time.perf_counter()
    with ThreadPoolExecutor(max_workers=2) as pool:
        fm = pool.submit(_matcher_compute, ctx)
        ff = pool.submit(_fraud_compute, ctx)
        m_out, f_out = fm.result(), ff.result()
    elapsed = time.perf_counter() - t0
    ctx.state["match"] = m_out
    _rec(ctx, "matcher", "decision", m_out, parents=[ctx.last["extractor"]],
         inputs={"po": m_out["po"]})
    ctx.state["fraud"] = f_out
    _rec(ctx, "fraud", "decision", f_out, parents=[ctx.last["extractor"]],
         inputs={"vendor": f_out["vendor"]})
    return elapsed


def approver(ctx: APContext) -> None:
    """Approves when the amount is under the auto-approval limit and checks pass."""
    _work(ctx)
    m, f = ctx.state["match"], ctx.state["fraud"]
    amount = m["amount"]
    approved = amount < APPROVAL_LIMIT and m["vendor_ok"] and f["risk"] == "low"
    out = {"approved": approved, "amount": amount}
    ctx.state["approval"] = out
    _rec(ctx, "approver", "decision", out,
         parents=[ctx.last["matcher"], ctx.last["fraud"]],
         inputs={"amount": amount, "limit": APPROVAL_LIMIT})


def payment(ctx: APContext) -> None:
    """Pays the approved amount + writes the record. Real side effect → stubbed in replay."""
    ex, appr = ctx.state["extraction"], ctx.state["approval"]
    paid = appr["approved"]
    out = {"vendor": ex["vendor"], "amount_paid": appr["amount"] if paid else 0.0,
           "due_date": ex["due_date"], "po": ex["po"],
           "ref": "PMT-STUB" if ctx.replay_mode else "PMT-4471",
           "status": "paid" if paid else "blocked"}
    ctx.state["final_output"] = out
    _rec(ctx, "payment", "final", out, parents=[ctx.last["approver"]],
         inputs={"amount": appr["amount"]})


def _run(ctx: APContext, trace_id: str, *, fork_agent: Optional[str] = None,
         override: Optional[dict] = None) -> Trace:
    extractor(ctx)
    # inject a correction right after the forked agent records its (bad) step, so downstream
    # agents read the fix — do(extraction = v*) at the fork point.
    if fork_agent == "extractor" and override:
        ctx.state["extraction"].update(override)
    ctx.state["parallel_s"] = _matcher_fraud_parallel(ctx)   # MATCHER ∥ FRAUD
    approver(ctx)
    payment(ctx)
    final = ctx.state["final_output"]
    return ctx.rec.finish(final_output=final, success=evaluate_ap(final))


# --- entry points -----------------------------------------------------------
def run_ap(*, inject_bug: bool = True, trace_id: str = "ap_live") -> Trace:
    """One full run of the AP system. inject_bug=True → the misread amount → FAIL."""
    return _run(APContext(rec=Recorder(trace_id, TASK), inject_bug=inject_bug), trace_id)


def replay_ap(fork_agent: str, override: Optional[dict] = None, *,
              trace_id: str = "ap_replay") -> Trace:
    """Counterfactual: re-run with the bug present, optionally injecting a correction right
    after `fork_agent`. override=None → baseline (still broken); override={'amount': v} → the
    fix. Side effects stubbed + work delays skipped (replay runs N times)."""
    ctx = APContext(rec=Recorder(trace_id, TASK), inject_bug=True, replay_mode=True)
    return _run(ctx, trace_id, fork_agent=fork_agent, override=override)


def heal_ap(fork_agent: str, override: dict, *, trace_id: str = "ap_healed") -> Trace:
    """A REAL corrected run (side effects live) — used by self-heal and human-in-the-loop
    once the fix is replay-confirmed."""
    ctx = APContext(rec=Recorder(trace_id, TASK), inject_bug=True, replay_mode=False)
    return _run(ctx, trace_id, fork_agent=fork_agent, override=override)


if __name__ == "__main__":
    t = run_ap()
    print(f"AP run: {len(t.steps)} steps, success={t.success}, paid={t.final_output}")
