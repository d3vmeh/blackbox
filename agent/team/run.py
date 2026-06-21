"""Run the software-team pipeline + monitor, with a readable diagnostic view.

    python -m agent.team.run            # offline, deterministic (no key)
    python -m agent.team.run --live     # 3 leaf modules on real Claude (needs ANTHROPIC_API_KEY)
    python -m agent.team.run --verbose  # also dump the assembled package
"""
from __future__ import annotations

import sys

from ..llm import make_think
from .graph import TEAM_MODEL, _assemble, run_team
from .monitor import investigate, poisoned_path
from .scenarios import DEFAULT


def main(argv: list[str]) -> None:
    live = "--live" in argv
    verbose = "--verbose" in argv or "-v" in argv
    think = make_think(use_real_llm=True, model=TEAM_MODEL, max_tokens=600) if live else None

    trace = run_team(DEFAULT, think=think)
    print(f"task   : {DEFAULT.name}")
    print("agents : " + ("Claude Haiku 4.5 (3 leaf modules) + deterministic architect/integrator"
                         if live else "mock / reference (deterministic, no key)"))
    print("\nthe run, top to bottom:")
    for s in trace.steps:
        tag = "   <-- FAULT" if s.is_injected_fault else ""
        gist = s.output.get("op_order") or (s.output.get("code", "") or "").splitlines()[:1]
        print(f"  {s.id}  {s.raw['agent']:<12} {gist}{tag}")
    print(f"\nfinal package passes acceptance tests? {trace.success}")

    v = investigate(trace, DEFAULT, n=3)
    print("\n" + "-" * 60)
    if not v.failed:
        print("BLACKBOX: no failure detected.")
        return
    print("BLACKBOX VERDICT")
    print(f"  root cause   : {v.root_agent}")
    print(f"  blast radius : {poisoned_path(trace)}  (integrator + downstream)")
    proof = "FAIL->PASS confirmed" if v.replay_confirmed else "NOT confirmed"
    print(f"  replay proof : inject the fix -> re-run -> {proof} "
          f"({v.confirmation_rate * 100:.0f}%)")

    if verbose:
        print("\nASSEMBLED PACKAGE:")
        for fname, code in _assemble({s.raw["agent"]: s.output for s in trace.steps}).items():
            print(f"\n--- {fname} ---\n{code}")


if __name__ == "__main__":
    main(sys.argv[1:])
