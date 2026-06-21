"""Run the software-team pipeline + monitor, with a readable diagnostic view.

    python -m agent.team.run                  # offline, deterministic injected demo (no key)
    python -m agent.team.run --live           # live modules on real Claude (needs ANTHROPIC_API_KEY)
    python -m agent.team.run --natural --live # the HEADLINE: a natural tax-rounding bug (real Claude)
    python -m agent.team.run --verbose        # also dump the assembled package
"""
from __future__ import annotations

import sys

from ..llm import make_think
from .export_run import build_artifacts
from .graph import TEAM_MODEL, _assemble, run_team
from .monitor import investigate, poisoned_path
from .scenarios import DEFAULT, SCENARIOS

NATURAL = next(s for s in SCENARIOS if s.natural)


def main(argv: list[str]) -> None:
    live = "--live" in argv
    natural = "--natural" in argv
    verbose = "--verbose" in argv or "-v" in argv
    scn = NATURAL if natural else DEFAULT
    if natural and not live:
        print("note: --natural needs --live — the rounding bug only appears when real Claude writes "
              "the module; offline shows the clean control.\n")
    think = make_think(use_real_llm=True, model=TEAM_MODEL, max_tokens=600) if live else None

    trace = run_team(scn, think=think)
    print(f"task   : {scn.name}")
    print("agents : " + ("Claude Haiku 4.5 (live modules) + deterministic architect/integrator"
                         if live else "mock / reference (deterministic, no key)"))
    print("\nthe run, top to bottom:")
    for s in trace.steps:
        tag = "   <-- FAULT" if s.is_injected_fault else ""
        gist = s.output.get("op_order") or (s.output.get("code", "") or "").splitlines()[:1]
        print(f"  {s.id}  {s.raw['agent']:<12} {gist}{tag}")
    print(f"\nfinal package passes acceptance tests? {trace.success}")
    print("\n" + "-" * 60)

    if natural:
        # natural bugs can't be re-derived deterministically -> localize over the recorded trace
        art = build_artifacts(scn, think=think)
        root_id = art["attribution"]["root_step_id"]
        if not root_id:
            print("BLACKBOX: no failure this run (the model rounded correctly) — re-run to surface it.")
            return
        root_agent = next(s["raw"]["agent"] for s in art["trace"]["steps"] if s["id"] == root_id)
        flipped = art["replays"][root_id]["flipped"]
        print("BLACKBOX VERDICT")
        print(f"  root cause   : {root_agent}  (NATURAL — the model's own bug, nothing injected)")
        print(f"  blast radius : {art['attribution']['blast_radius']}  (integrator + downstream)")
        print(f"  replay proof : swap in the reference module -> "
              f"{'FAIL->PASS confirmed' if flipped else 'NOT confirmed'}")
    else:
        v = investigate(trace, scn, n=3)
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
