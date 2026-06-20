"""P1 — CLI demo of the AP system + the Blackbox monitor.

    python -m agent.run_ap

Runs the invoice-paying agents (with the injected misread), shows the company pay the
wrong bill, then the monitor localizes the agent that started it and PROVES the fix by
counterfactual replay (FAIL→PASS). This is the on-stage story, deterministic end-to-end.
"""

from __future__ import annotations

from typing import Any

from . import ap_graph
from .monitor import investigate

LANE = {"extractor": "EXTRACTOR", "matcher": "MATCHER", "fraud": "FRAUD-CHECK",
        "approver": "APPROVER", "payment": "PAYMENT"}


def _money(x: Any) -> str:
    try:
        return f"${float(x):,.2f}"
    except (TypeError, ValueError):
        return str(x)


def main() -> None:
    print("=" * 64)
    print("ACCOUNTS-PAYABLE AGENTS  ·  invoice PO-7781 (Acme Corp)")
    print(f"  correct bill: {_money(ap_graph.TRUE['amount'])} due {ap_graph.TRUE['due_date']}")
    print("=" * 64)

    # 1) Unprotected run — the agents do the job, but one misreads the amount.
    trace = ap_graph.run_ap(inject_bug=True)
    print("\n[1] UNPROTECTED RUN — agents hand the invoice down the line:")
    for s in trace.steps:
        tag = "  ⚠ misread" if s.is_injected_fault else ""
        print(f"     {LANE.get(s.raw.get('agent'), s.raw.get('agent')):<12} {s.output}{tag}")
    paid = trace.final_output
    print(f"\n    → PAID {_money(paid['amount_paid'])} to {paid['vendor']}   VERDICT: "
          f"{'PASS' if trace.success else 'FAIL'}")

    # 2) The monitor investigates the failure.
    v = investigate(trace, n=5)
    print("\n[2] BLACKBOX MONITOR investigates the failure:")
    if not v.failed:
        print("     run passed — nothing to do."); return
    print(f"     localized root cause → {LANE.get(v.root_agent, v.root_agent)} "
          f"(step {v.root_step_id})")
    print(f"     it output {_money(v.wrong_value)} but the invoice says {_money(v.correct_value)}")

    # 3) Prove it: inject the fix at that agent and replay.
    print("\n[3] PROOF BY REPLAY — inject the correct amount at "
          f"{LANE.get(v.root_agent, v.root_agent)} and re-run:")
    print(f"     fix flips FAIL→PASS in {sum(v.outcomes)}/{len(v.outcomes)} replays "
          f"(confirmation rate {v.confirmation_rate:.0%})")
    print(f"     ROOT CAUSE {'CONFIRMED' if v.replay_confirmed else 'NOT confirmed'}: "
          f"{LANE.get(v.root_agent, v.root_agent)} misread the amount.")
    print("=" * 64)


if __name__ == "__main__":
    main()
