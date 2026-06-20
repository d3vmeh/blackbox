"""Demo entrypoint: capture a failing run, confirm the root cause by replay.

    python -m agent.run               # offline (mock LLM + mock web)
    python -m agent.run --live        # Claude reasoning (needs ANTHROPIC_API_KEY)
    python -m agent.run --browserbase # real Browserbase web tool (needs BROWSERBASE_* keys)
    python -m agent.run --otel        # also emit OpenTelemetry spans to Phoenix (Arize track)
"""
from __future__ import annotations

import sys

from shared.schema import Trace
from .faults import inject_fault
from .graph import INTENDED_DATE, run_agent


def make_failing_trace(use_real_llm: bool = False, use_browserbase: bool = False) -> Trace:
    bad = "2026-12-07"
    base = run_agent(use_real_llm=use_real_llm, use_browserbase=use_browserbase)
    parse_id = next(s.id for s in base.steps if s.raw.get("node") == "parse_date")
    return inject_fault(base, parse_id, bad_output=f"departure = {bad}",
                        propagate=(INTENDED_DATE, bad),
                        final_output={"date": bad, "flight": "UA-441", "email_date": bad})


def main() -> None:
    from replay.replay import replay

    live, bb = "--live" in sys.argv, "--browserbase" in sys.argv
    t = make_failing_trace(use_real_llm=live, use_browserbase=bb)
    if "--otel" in sys.argv:
        from .otel import emit_trace
        emit_trace(t)
    print(f"failing trace {t.id!r}: {len(t.steps)} steps, success={t.success}, gold={t.gold_root_step_id}")
    print(f"  final: {t.final_output}")

    gold = next(s for s in t.steps if s.id == t.gold_root_step_id)
    r = replay(t, t.gold_root_step_id, gold.correct_output, n=5)
    print(f"  replay confirm @ {t.gold_root_step_id}: rate={r.confirmation_rate:.0%} flipped={r.flipped}")
    print("\nOK — capture -> fault -> confirm loop works" if r.flipped else "\nUNEXPECTED")


if __name__ == "__main__":
    main()
