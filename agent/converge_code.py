# agent/converge_code.py
"""P1 — Convergence harness for the coding pipeline. For every labeled scenario, localize
the guilty agent two ways and score each against the gold:

  • deterministic monitor (code_monitor.investigate) — reliable, no key, and
  • P2's general attribute() LLM-judge — needs ANTHROPIC_API_KEY for its Haiku judges.

Run from repo root:  python -m agent.converge_code
(Without a key the P2 column is skipped; the monitor column is the meaningful one.)
"""
from __future__ import annotations

import asyncio
import os
from typing import Optional

from eval.code_oracle import evaluate_code
from shared.schema import Trace

from . import code_monitor
from .code_graph import run_code
from .code_scenarios import SCENARIOS, CodeScenario


def _gold_agent(scn: CodeScenario) -> Optional[str]:
    return scn.fault.agent if scn.fault else None


def _step_to_agent(trace: Trace, step_id: Optional[str]) -> Optional[str]:
    for s in trace.steps:
        if s.id == step_id:
            return s.raw.get("agent")
    return None


def _mark(predicted: Optional[str], gold: Optional[str]) -> str:
    return "✓" if predicted == gold else "✗"


async def _one(scn: CodeScenario, live: bool) -> dict:
    trace = run_code(scn)
    failed = not evaluate_code(trace.final_output["code"], scn)
    gold = _gold_agent(scn)
    if not failed:
        return {"name": scn.name, "failed": False, "gold": gold,
                "monitor": None, "p2": None if live else "—"}

    mon = code_monitor.investigate(trace, scn).root_agent

    if not live:
        return {"name": scn.name, "failed": True, "gold": gold, "monitor": mon, "p2": "—"}

    from attribution.localize import attribute  # lazy: pulls in anthropic
    try:
        attr = await attribute(trace)
        p2 = _step_to_agent(trace, attr.root_step_id)
    except Exception as exc:                       # never let one scenario kill the suite
        p2 = f"ERR:{type(exc).__name__}"
    return {"name": scn.name, "failed": True, "gold": gold, "monitor": mon, "p2": p2}


async def main() -> dict:
    live = bool(os.environ.get("ANTHROPIC_API_KEY"))
    print("=" * 72)
    print("CONVERGENCE — deterministic monitor  vs  P2 attribute()  (coding pipeline)")
    print(f"node-judges: {'LIVE (Claude Haiku)' if live else 'SKIPPED — no ANTHROPIC_API_KEY; monitor column only'}")
    print("=" * 72)
    print(f"{'scenario':<22}{'gold':<18}{'monitor':<18}{'P2 attribute()':<16}")
    print("-" * 72)

    rows = [await _one(scn, live) for scn in SCENARIOS]   # sequential: respect rate limits

    mon_ok = p2_ok = agree = 0
    for r in rows:
        gold, mon, p2 = r["gold"], r["monitor"], r["p2"]
        mon_ok += mon == gold
        if live:
            p2_ok += p2 == gold
            agree += mon == p2
        mon_cell = f"{mon} {_mark(mon, gold)}"
        p2_cell = f"{p2} {_mark(p2, gold)}" if live else str(p2)
        print(f"{r['name']:<22}{str(gold):<18}{mon_cell:<19}{p2_cell:<18}")

    n = len(rows)
    print("-" * 72)
    print(f"monitor vs gold : {mon_ok}/{n}")
    if live:
        print(f"P2 vs gold      : {p2_ok}/{n}")
        print(f"monitor↔P2 agree: {agree}/{n}")
    else:
        print("P2 vs gold      : run with ANTHROPIC_API_KEY to score P2")
    return {"n": n, "monitor_correct": mon_ok, "p2_correct": p2_ok, "agree": agree, "live": live, "rows": rows}


if __name__ == "__main__":
    asyncio.run(main())
