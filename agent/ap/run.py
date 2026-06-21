"""P1 — CLI demo of the AP system + the Blackbox monitor (single scenario).

    python -m agent.ap.run
    python -m agent.ap.run --arize   # export spans to Arize AX (https://app.arize.com)
    python -m eval.arize_pipeline    # export + code/LLM evals + meta + experiment report
    python -m agent.ap.run --otel    # export spans to local Phoenix (run `phoenix serve` first)

Runs the invoice-paying agents (with an injected misread), shows the company pay the
wrong bill, then the monitor localizes the agent that started it, PROVES the fix by
counterfactual replay (FAIL→PASS), and self-heals. For the full labeled suite across
different fault sites, see `python -m agent.ap.run_suite`.
"""

from __future__ import annotations

import sys
from typing import Any

from . import graph
from .scenarios import DEFAULT
from .monitor import auto_heal, human_fix, investigate  # noqa: F401  (human_fix shown in [4])

LANE = {"extractor": "EXTRACTOR", "matcher": "MATCHER", "fraud": "FRAUD-CHECK",
        "approver": "APPROVER", "payment": "PAYMENT"}


def _money(x: Any) -> str:
    try:
        return f"${float(x):,.2f}"
    except (TypeError, ValueError):
        return str(x)


def _scenario_meta(scn, v=None, *, healed: bool = False) -> dict:
    meta = {
        "scenario": scn.name,
        "invoice_text": scn.invoice_text(),
        "expected": {
            "vendor": scn.vendor,
            "amount": scn.amount,
            "due_date": scn.due_date,
            "po": scn.po,
            "expect": scn.expect,
        },
    }
    if v and v.root_agent:
        meta.update(
            root_agent=v.root_agent,
            root_step_id=v.root_step_id or "",
            replay_confirmed=v.replay_confirmed,
            confirmation_rate=v.confirmation_rate,
        )
    if healed:
        meta["healed"] = True
    return meta


def main() -> None:
    use_otel = "--otel" in sys.argv
    use_arize = "--arize" in sys.argv
    scn = DEFAULT
    print("=" * 66)
    print(f"ACCOUNTS-PAYABLE AGENTS  ·  invoice {scn.po} ({scn.vendor})")
    print(f"  correct bill: {_money(scn.amount)} due {scn.due_date}")
    print("=" * 66)

    # 1) Unprotected run — the agents do the job, but one misreads the amount.
    trace = graph.run_ap(scn, timed=True)
    print("\n[1] UNPROTECTED RUN — agents hand the invoice down the line:")
    for s in trace.steps:
        tag = "  ⚠ misread" if s.is_injected_fault else ""
        print(f"     {LANE.get(s.raw.get('agent'), s.raw.get('agent')):<12} {s.output}{tag}")
    print("     · MATCHER ∥ FRAUD-CHECK ran concurrently")
    paid = trace.final_output
    print(f"\n    → PAID {_money(paid['amount_paid'])} to {paid['vendor']}   VERDICT: {_verdict(trace)}")

    # 2) The monitor investigates the failure.
    v = investigate(trace, scn, n=5)
    print("\n[2] BLACKBOX MONITOR investigates the failure:")
    if not v.failed:
        print("     run passed — nothing to do."); return
    print(f"     localized root cause → {LANE.get(v.root_agent, v.root_agent)} "
          f"(step {v.root_step_id}, field '{v.field}')")
    print(f"     it output {_money(v.wrong_value)} but should be {_money(v.correct_value)}")

    # 3) Prove it: inject the fix at that agent and replay.
    print(f"\n[3] PROOF BY REPLAY — inject the correct value at {LANE.get(v.root_agent, v.root_agent)} "
          f"and re-run:")
    print(f"     fix flips FAIL→PASS in {sum(v.outcomes)}/{len(v.outcomes)} replays "
          f"(confirmation {v.confirmation_rate:.0%})")
    print(f"     ROOT CAUSE {'CONFIRMED' if v.replay_confirmed else 'NOT confirmed'}.")

    # 4) Resolve — only a replay-confirmed fix is ever applied.
    healed = auto_heal(v, scn)
    print("\n[4] SELF-HEAL — monitor applies the *proven* fix (a human could also message "
          f"{LANE.get(v.root_agent, v.root_agent)} directly):")
    if healed is not None:
        hp = healed.final_output
        print(f"     re-run → PAID {_money(hp['amount_paid'])} to {hp['vendor']}   VERDICT: {_verdict(healed)}")

    if use_arize or use_otel:
        from dotenv import load_dotenv

        load_dotenv()
        from ..otel import emit_trace

        backend = "arize" if use_arize else "phoenix"
        monitor_meta = _scenario_meta(scn, v if v.failed else None)

        label = "Arize AX (https://app.arize.com)" if use_arize else "Phoenix (http://localhost:6006)"
        print(f"\n[trace] exporting AP spans to {label}:")
        emit_trace(trace, backend=backend, monitor=monitor_meta)
        if healed is not None:
            emit_trace(healed, backend=backend, monitor=_scenario_meta(scn, v, healed=True))

    print("=" * 66)


if __name__ == "__main__":
    main()
