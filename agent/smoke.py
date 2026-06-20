"""Smoke test: prove the P1 plumbing works end-to-end on the fixture, offline.

    python -m agent.smoke

Loads the recorded failing trace and runs counterfactual confirm() on the gold root
step. Demonstrates the Analyze->Confirm loop the demo depends on — no API keys, no agent.
"""
from __future__ import annotations

from replay import confirm
from shared.load import load_fixture


def main() -> None:
    trace = load_fixture("flight_fail")
    print(f"Loaded trace {trace.id!r}: {len(trace.steps)} steps, success={trace.success}")
    print(f"Task: {trace.task}\n")

    root = trace.gold_root_step_id
    step = next(s for s in trace.steps if s.id == root)
    fix = step.correct_output
    print(f"Confirming the (gold) root cause: step {root} = {step.name!r}")
    print(f"  bad output     : {step.output!r}")
    print(f"  inject corrected: {fix!r}")

    result = confirm(trace, root, fix, n=5)
    print(f"\nReplayResult: confirmation_rate={result.confirmation_rate:.0%} "
          f"flipped={result.flipped} (n={result.n})")

    # negative control: fixing a non-root step should NOT flip the outcome
    other = confirm(trace, 6, "anything", n=5)
    print(f"Control (step 6): confirmation_rate={other.confirmation_rate:.0%} flipped={other.flipped}")

    print("\nOK" if result.flipped and not other.flipped else "\nUNEXPECTED — check stub logic")


if __name__ == "__main__":
    main()
