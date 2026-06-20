"""P1 — Convergence harness: prove P2's general attribution agrees with P1's
deterministic monitor on the generalized AP scenario suite.

"Matching the generalization": P1 generalized the subject to faults-at-ANY-agent
(agent/ap_scenarios.py). Two independent localizers must then agree on the same
generalized run:

  • P1 — monitor._localize: deterministic node-judge. Recompute what each agent
    SHOULD have output (ap_graph.COMPUTE) from its recorded upstream; flag the
    earliest field that diverges.
  • P2 — attribution.attribute(): general, model-based. Provenance slice → parallel
    Claude-Haiku node-judges → ranked candidates. No oracle, no COMPUTE, no labels.

For every labeled scenario we take the GOLD root agent from the injected fault
(None for the clean controls), localize with both, and score agreement with gold —
and with each other.

Run from repo root:
    python -m agent.converge_ap

attribute()'s node-judges call Claude Haiku — set ANTHROPIC_API_KEY for real
semantic judging. WITHOUT a key the judges fall back to 0.5 and P2 degenerates to
position order (earliest active suspect), so only the deterministic `monitor`
column is meaningful; the harness says so in its header.
"""
from __future__ import annotations

import asyncio
import os
from typing import Optional

from eval.ap_oracle import evaluate_ap
from shared.schema import Trace

from . import monitor
from .ap_graph import run_ap
from .ap_scenarios import SCENARIOS, Scenario


def _step_to_agent(trace: Trace, step_id: Optional[str]) -> Optional[str]:
    for s in trace.steps:
        if s.id == step_id:
            return s.raw.get("agent")
    return None


def _gold_agent(scn: Scenario) -> Optional[str]:
    return scn.fault.agent if scn.fault else None


async def _one(scn: Scenario, live: bool) -> dict:
    """Run one scenario through both localizers. Both only fire on an actual failure
    (a clean control should produce no fault from either). P2's attribute() needs a
    live key for its node-judges, so we skip it (column '—') when no key is set."""
    trace = run_ap(scn)
    failed = not evaluate_ap(trace.final_output, scn)
    gold = _gold_agent(scn)

    if not failed:
        return {"name": scn.name, "failed": False, "gold": gold,
                "monitor": None, "p2": None if live else "—"}

    found = monitor._localize(trace, scn)
    mon_agent = found[1] if found else None

    if not live:
        return {"name": scn.name, "failed": True, "gold": gold,
                "monitor": mon_agent, "p2": "—"}

    from attribution.localize import attribute  # imported lazily: pulls in anthropic
    try:
        attr = await attribute(trace)
        p2_agent = _step_to_agent(trace, attr.root_step_id)
    except Exception as exc:                      # never let one scenario kill the suite
        p2_agent = f"ERR:{type(exc).__name__}"

    return {"name": scn.name, "failed": True, "gold": gold,
            "monitor": mon_agent, "p2": p2_agent}


def _mark(predicted: Optional[str], gold: Optional[str]) -> str:
    return "✓" if predicted == gold else "✗"


async def main() -> dict:
    live = bool(os.environ.get("ANTHROPIC_API_KEY"))
    print("=" * 74)
    print("CONVERGENCE — P1 deterministic monitor  vs  P2 general attribute()")
    print(f"node-judges: {'LIVE (Claude Haiku)' if live else 'SKIPPED — no ANTHROPIC_API_KEY; P2 needs one. monitor column only.'}")
    print("=" * 74)
    print(f"{'scenario':<20}{'gold':<11}{'monitor':<13}{'P2 attribute()':<17}{'mon  p2  agree'}")
    print("-" * 74)

    rows = [await _one(scn, live) for scn in SCENARIOS]   # sequential: respect Haiku rate limits

    mon_ok = p2_ok = agree = 0
    for r in rows:
        gold, mon, p2 = r["gold"], r["monitor"], r["p2"]
        mon_ok += mon == gold
        if live:
            p2_ok += p2 == gold
            agree += mon == p2
        p2_cell = _mark(p2, gold) if live else "—"
        agree_cell = ("=" if mon == p2 else "≠") if live else "—"
        print(f"{r['name']:<20}{str(gold):<11}{str(mon):<13}{str(p2):<17}"
              f"{_mark(mon, gold):<5}{p2_cell:<5}{agree_cell}")

    n = len(rows)
    print("-" * 74)
    print(f"monitor vs gold : {mon_ok}/{n}")
    if live:
        print(f"P2 vs gold      : {p2_ok}/{n}")
        print(f"monitor↔P2 agree: {agree}/{n}")
    else:
        print("P2 vs gold      : run with ANTHROPIC_API_KEY to score P2 (Claude Haiku node-judges)")
    return {"n": n, "monitor_correct": mon_ok, "p2_correct": p2_ok,
            "agree": agree, "live": live, "rows": rows}


if __name__ == "__main__":
    asyncio.run(main())
