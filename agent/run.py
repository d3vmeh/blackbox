"""Demo entrypoint: capture a failing run, confirm the root cause by replay.

    python -m agent.run               # offline (mock LLM + mock web)
    python -m agent.run --live        # Claude reasoning (needs ANTHROPIC_API_KEY)
    python -m agent.run --browserbase # real Browserbase web tool (needs BROWSERBASE_* keys)
    python -m agent.run --arize       # export spans to Arize AX (https://app.arize.com)
    python -m agent.run --otel        # export spans to local Phoenix (run `phoenix serve` first)
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

    live = "--live" in sys.argv
    bb = "--browserbase" in sys.argv
    use_otel = "--otel" in sys.argv
    use_arize = "--arize" in sys.argv
    t = make_failing_trace(use_real_llm=live, use_browserbase=bb)
    print(f"failing trace {t.id!r}: {len(t.steps)} steps, success={t.success}, gold={t.gold_root_step_id}")
    print(f"  final: {t.final_output}")

    gold = next(s for s in t.steps if s.id == t.gold_root_step_id)
    r = replay(t, t.gold_root_step_id, gold.correct_output, n=5)
    print(f"  replay confirm @ {t.gold_root_step_id}: rate={r.confirmation_rate:.0%} flipped={r.flipped}")
    print("\nOK — capture -> fault -> confirm loop works" if r.flipped else "\nUNEXPECTED")

    if use_arize or use_otel:
        from dotenv import load_dotenv

        load_dotenv()
        from .otel import emit_trace

        backend = "arize" if use_arize else "phoenix"
        root_node = gold.raw.get("node")
        monitor_meta = {
            "root_step_id": t.gold_root_step_id or "",
            "root_node": root_node or "",
            "replay_confirmed": r.flipped,
            "confirmation_rate": r.confirmation_rate,
        }
        label = "Arize AX (https://app.arize.com)" if use_arize else "Phoenix (http://localhost:6006)"
        print(f"\n[trace] exporting flight spans to {label}:")
        emit_trace(t, backend=backend, monitor=monitor_meta)


if __name__ == "__main__":
    main()
