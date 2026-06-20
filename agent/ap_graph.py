"""P1 — Enterprise Accounts-Payable multi-agent system. The subject Blackbox monitors.

Four agents pass an invoice down the line as structured hand-offs:

    EXTRACTOR ──▶ MATCHER ─┐
                  FRAUD  ──┴▶ APPROVER ──▶ PAYMENT

A controlled fault makes EXTRACTOR misread the invoice amount (a decimal slip:
$4,200.00 → $42,000.00). The wrong number is trusted by every downstream agent and
the company pays the wrong bill (oracle FAIL). The monitoring agent (agent/monitor.py)
localizes the earliest corrupted hand-off and PROVES the fix by counterfactual replay.

Deterministic by design — no LLM/network — so the on-stage FAIL→PASS flip is reliable.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Callable, Optional

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

TASK = "Pay invoice PO-7781 (Acme Corp) the correct amount by the due date."

# agent that controls a value → the extraction key replay forks/injects on.
REPLAYABLE_AP = {"extractor": "amount"}


@dataclass
class APContext:
    rec: Recorder
    state: dict = field(default_factory=dict)
    last: dict = field(default_factory=dict)        # agent -> recorded step id
    inject_bug: bool = True
    replay_mode: bool = False                       # True → stub the payment side effect


def _rec(ctx: APContext, agent: str, kind: str, output: Any, parents: list[str],
         inputs: Optional[dict] = None, correct_output: Any = None, fault: bool = False) -> str:
    sid = ctx.rec.record(node=agent, agent=agent, kind=kind, inputs=inputs or {},
                         output=output, state=ctx.state, parents=parents,
                         correct_output=correct_output, is_injected_fault=fault)
    ctx.last[agent] = sid
    return sid


# --- the agents (each appends one Step, tagged with its agent) ---------------
def extractor(ctx: APContext) -> None:
    """Reads the raw invoice → structured fields. FAULT SITE: the `amount`."""
    amount = BUG_AMOUNT if ctx.inject_bug else TRUE["amount"]
    out = {"vendor": TRUE["vendor"], "amount": amount,
           "due_date": TRUE["due_date"], "po": TRUE["po"]}
    ctx.state["extraction"] = out
    _rec(ctx, "extractor", "tool_result", out, parents=[],
         inputs={"invoice_text": INVOICE_TEXT},
         correct_output={**out, "amount": TRUE["amount"]},
         fault=ctx.inject_bug)


def matcher(ctx: APContext) -> None:
    """Matches the invoice to a purchase order by PO number + vendor (not amount)."""
    ex = ctx.state["extraction"]
    po = PO_BOOK.get(ex["po"])
    vendor_ok = bool(po and po["vendor"] == ex["vendor"])
    out = {"po": ex["po"], "vendor_ok": vendor_ok, "amount": ex["amount"]}
    ctx.state["match"] = out
    _rec(ctx, "matcher", "decision", out, parents=[ctx.last["extractor"]],
         inputs={"po": ex["po"], "vendor": ex["vendor"]})


def fraud(ctx: APContext) -> None:
    """Runs alongside the matcher: flags vendors that aren't on the allowlist."""
    ex = ctx.state["extraction"]
    risk = "low" if ex["vendor"] in VENDOR_ALLOWLIST else "high"
    out = {"vendor": ex["vendor"], "risk": risk}
    ctx.state["fraud"] = out
    _rec(ctx, "fraud", "decision", out, parents=[ctx.last["extractor"]],
         inputs={"vendor": ex["vendor"]})


def approver(ctx: APContext) -> None:
    """Approves when the amount is under the auto-approval limit and checks pass."""
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


AGENTS: list[Callable[[APContext], None]] = [extractor, matcher, fraud, approver, payment]


def _run(ctx: APContext, trace_id: str, *, fork_agent: Optional[str] = None,
         override: Optional[dict] = None) -> Trace:
    for agent_fn in AGENTS:
        agent_fn(ctx)
        # inject the corrected value right after the forked agent records its (bad) step,
        # so downstream agents read the fix — do(extraction = v*) at the fork point.
        if fork_agent and agent_fn.__name__ == fork_agent and override:
            ctx.state["extraction"].update(override)
    final = ctx.state["final_output"]
    return ctx.rec.finish(final_output=final, success=evaluate_ap(final))


def run_ap(*, inject_bug: bool = True, trace_id: str = "ap_live") -> Trace:
    """One full run of the AP system. inject_bug=True → the misread amount → FAIL."""
    return _run(APContext(rec=Recorder(trace_id, TASK), inject_bug=inject_bug), trace_id)


def replay_ap(fork_agent: str, override: Optional[dict] = None, *,
              trace_id: str = "ap_replay") -> Trace:
    """Re-run with the bug present, optionally injecting a correction right after `fork_agent`.
    override=None → baseline (still broken); override={'amount': v} → the counterfactual fix.
    Payment side effect is stubbed (replay runs N times)."""
    ctx = APContext(rec=Recorder(trace_id, TASK), inject_bug=True, replay_mode=True)
    return _run(ctx, trace_id, fork_agent=fork_agent, override=override)


if __name__ == "__main__":
    t = run_ap()
    print(f"AP run: {len(t.steps)} steps, success={t.success}, paid={t.final_output}")
