"""Run the coding pipeline + monitor, with a readable diagnostic view.

    python -m agent.code.run            # offline, deterministic (no key)
    python -m agent.code.run --live     # real Claude for the spec interpreter (needs ANTHROPIC_API_KEY)
    python -m agent.code.run --verbose  # also dump every agent's full output + the final code
"""
from __future__ import annotations

import sys

from .graph import _LLM, CODE_MODEL, run_code
from .monitor import investigate
from .scenarios import AGENTS, DEFAULT
from ..llm import make_think


def _salient(output: dict) -> str:
    """One-line gist of an agent's output (collapse code/test blobs to their key line)."""
    bits = []
    for k, v in output.items():
        if isinstance(v, str) and "\n" in v:
            lines = [ln.strip() for ln in v.splitlines() if ln.strip()]
            v = next((ln for ln in lines if ln.startswith(("return", "assert"))),
                     lines[-1] if lines else "")
        bits.append(f"{k}={v!r}")
    s = "  ".join(bits)
    return s if len(s) <= 90 else s[:87] + "..."


def _diffs(step) -> dict:
    """Fields where the root step's output diverges from its correct reference."""
    correct = step.correct_output or {}
    return {k: (step.output.get(k), correct.get(k))
            for k in correct if step.output.get(k) != correct.get(k)}


def main(argv: list[str]) -> None:
    live = "--live" in argv
    verbose = "--verbose" in argv or "-v" in argv
    think = make_think(use_real_llm=True, model=CODE_MODEL, max_tokens=1500) if live else None  # code needs room

    trace = run_code(DEFAULT, think=think)
    print(f"task   : {trace.task}")
    print("agents : " + ("real Claude — all four agents"
                         if live else "mock / reference (deterministic, no key)"))

    print("\nthe run, top to bottom:")
    for s in trace.steps:
        llm = " [LLM]" if (live and s.raw["agent"] in _LLM) else ""
        tag = "   <-- FAULT" if s.is_injected_fault else ""
        print(f"  {s.id}  {s.raw['agent']:<16}{llm:<6} {_salient(s.output)}{tag}")

    print("\nhidden acceptance test (agents never see it):")
    for line in DEFAULT.acceptance_tests.strip().splitlines():
        print(f"    {line}")
    print(f"\nfinal code passes acceptance tests? {trace.success}")

    # live: replays re-run the real agents too (genuine proof) — keep n small for cost
    v = investigate(trace, DEFAULT, n=2 if live else 3, think=think)
    print("\n" + "-" * 64)
    if not v.failed:
        print("BLACKBOX: no failure detected.")
        return
    root = next(s for s in trace.steps if s.raw["agent"] == v.root_agent)
    blast = AGENTS[AGENTS.index(v.root_agent) + 1:]
    print("BLACKBOX VERDICT")
    print(f"  root cause   : {v.root_agent}  (step {root.id})")
    for field, (wrong, correct) in _diffs(root).items():
        print(f"  what's wrong : {field} = {wrong!r}   should be: {correct!r}")
    print(f"  blast radius : {', '.join(blast)}  (inherited the bad value)")
    proof = "FAIL->PASS confirmed" if v.replay_confirmed else "NOT confirmed"
    print(f"  replay proof : inject the fix -> re-run -> {proof} "
          f"({v.confirmation_rate*100:.0f}%)")

    if verbose:
        print("\n" + "-" * 64 + "\nFULL TRACE")
        for s in trace.steps:
            print(f"\n[{s.id}] {s.raw['agent']}  (parents={s.parents}, kind={s.kind})")
            print(f"  inputs : {s.inputs}")
            print(f"  output : {s.output}")
            if s.correct_output and s.correct_output != s.output:
                print(f"  correct: {s.correct_output}")
        print(f"\nFINAL CODE (what would have shipped):\n{trace.final_output['code']}")


if __name__ == "__main__":
    main(sys.argv[1:])
