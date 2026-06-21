"""P2 smoke test + regression suite.

Run from repo root:
    python -m attribution.main
"""
from __future__ import annotations

import asyncio
from dotenv import load_dotenv
load_dotenv()
import json
from pathlib import Path

from shared.schema import Trace
from attribution.localize import attribute
from attribution.regression import run_regression_suite, run_confirmed_regression_suite

_PRIMARY = "shared/fixtures/benchmark/bench_parse_00.json"
_EXPECTED_ROOT = "s4"
_EXPECTED_BLAST = {"s5", "s6", "s7", "s8", "s9", "s10"}


async def run_primary() -> None:
    data = json.loads(Path(_PRIMARY).read_text())
    trace = Trace.model_validate(data)

    print("=" * 60)
    print(f"PRIMARY TEST: {trace.id}")
    print(f"Task: {trace.task}")
    print("=" * 60)

    result = await attribute(trace)

    verdict = "PASS" if result.root_step_id == _EXPECTED_ROOT else "FAIL"
    blast_ok = set(result.blast_radius) == _EXPECTED_BLAST

    conf_pct = int(result.confidence * 100)
    print(f"\nRoot cause   : {result.root_step_id}  →  {verdict}")
    print(f"Blast radius : {result.blast_radius}")
    print(f"Blast correct: {'YES' if blast_ok else 'NO'}  (expected {sorted(_EXPECTED_BLAST)})")
    print(f"\nWhat went wrong:")
    print(f"  {result.rationale}")
    print(f"\nSuggested fix:")
    print(f"  {result.suggested_fix}")
    print(f"\nConfidence   : {conf_pct}% confident in this fix")
    print("\nTop candidates:")
    for c in result.candidates:
        print(f"  {c.step_id}  suspicion={c.suspicion:.3f}  |  {c.reason}")

    print()
    answer = input("Apply this fix? [y/N]: ").strip().lower()
    if answer == "y":
        from replay.replay import replay as do_replay
        print("\nRunning replay to confirm fix flips FAIL → PASS ...")
        rr = do_replay(trace, result.root_step_id, result.suggested_fix, n=5)
        if rr.flipped:
            print(f"  CONFIRMED  confirmation_rate={rr.confirmation_rate:.0%}  — fix proved, chain heals.")
        else:
            print(f"  NOT CONFIRMED  rate={rr.confirmation_rate:.0%}  — fix did not flip the outcome.")
    else:
        print("Fix not applied.")


def run_suite() -> None:
    from attribution.cache import cache_stats

    print("\n" + "=" * 60)
    print("REGRESSION SUITE  (shared/fixtures/benchmark)")
    print("=" * 60)
    results = run_regression_suite()
    print(f"\n{results['passed']}/{results['total']} correct "
          f"({results['accuracy'] * 100:.1f}%)\n")
    for d in results["details"]:
        mark = "✓" if d["correct"] else "✗"
        print(f"  {mark} {d['id']:<22} expected={d['expected']}  predicted={d['predicted']}")
    stats = cache_stats()
    print(f"\nJudge cache: {stats['hits']} hits, {stats['misses']} misses")


def run_confirmed_suite() -> None:
    print("\n--- Confirmed Regression Suite ---")
    confirmed = run_confirmed_regression_suite()
    if confirmed["total"] == 0:
        print("No human-confirmed cases yet.")
    else:
        print(f"{confirmed['passed']}/{confirmed['total']} correct "
              f"({confirmed['accuracy'] * 100:.1f}%)")
        for d in confirmed["details"]:
            status = "PASS" if d["correct"] else "FAIL"
            print(f"  {status} {d['id']}: expected={d['expected']} "
                  f"predicted={d['predicted']}")


if __name__ == "__main__":
    asyncio.run(run_primary())
    run_suite()
    run_confirmed_suite()
