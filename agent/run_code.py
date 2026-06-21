"""Run the coding pipeline + monitor. Mock by default; --live uses real Claude (Sonnet).

    python -m agent.run_code            # offline, deterministic (no key)
    python -m agent.run_code --live     # real LLM agents (needs ANTHROPIC_API_KEY)
"""
from __future__ import annotations

import sys

from .code_graph import run_code
from .code_monitor import investigate
from .code_scenarios import DEFAULT
from .llm import make_think


def main(argv: list[str]) -> None:
    live = "--live" in argv
    think = make_think(use_real_llm=True) if live else None
    trace = run_code(DEFAULT, think=think)
    print(f"[{trace.task}] agents: {[s.raw['agent'] for s in trace.steps]}")
    print(f"final code passes acceptance tests? {trace.success}")
    v = investigate(trace, DEFAULT)
    if not v.failed:
        print("no failure detected.")
        return
    print(f"guilty agent : {v.root_agent}")
    print(f"replay proof : {'FAIL->PASS confirmed' if v.replay_confirmed else 'unconfirmed'} "
          f"({v.confirmation_rate*100:.0f}%)")


if __name__ == "__main__":
    main(sys.argv[1:])
