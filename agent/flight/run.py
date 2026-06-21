"""Demo entrypoint: capture a failing run, confirm the root cause by replay.

    python -m agent.flight.run               # offline sequential path
    python -m agent.flight.run --langgraph     # LangGraph path (same as dashboard export)
    python -m agent.flight.run --live          # Claude reasoning (needs ANTHROPIC_API_KEY)
    python -m agent.flight.run --browserbase   # real Browserbase web tool
    python -m agent.flight.run --langgraph --arize  # LangGraph FAIL+healed -> Arize AX
    python -m agent.flight.run --arize         # sequential FAIL -> Arize AX
    python -m agent.flight.run --otel          # export spans to local Phoenix
"""
from __future__ import annotations

import sys

from shared.schema import MonitorDecision, Trace
from .export_run import _tag_langgraph
from .faults import inject_fault
from .graph import INTENDED_DATE, REPLAYABLE, replay_run, run_agent, run_agent_graph

_BAD = "2026-12-07"
_FORK = "parse_date"


def make_failing_trace(*, use_real_llm: bool = False, use_browserbase: bool = False,
                       use_langgraph: bool = False, trace_id: str = "flight_live") -> Trace:
    if use_langgraph:
        base, _app = run_agent_graph(use_real_llm=use_real_llm, use_browserbase=use_browserbase,
                                     trace_id=trace_id)
        base = _tag_langgraph(base)
    else:
        base = run_agent(use_real_llm=use_real_llm, use_browserbase=use_browserbase, trace_id=trace_id)
    parse_id = next(s.id for s in base.steps if s.raw.get("node") == _FORK)
    t = inject_fault(base, parse_id, bad_output=f"departure = {_BAD}",
                     propagate=(INTENDED_DATE, _BAD),
                     final_output={"date": _BAD, "flight": "UA-441", "email_date": _BAD})
    t.id = trace_id
    return t


def _healed_from_replay() -> Trace:
    key = REPLAYABLE[_FORK][0]
    t = replay_run(_FORK, {key: INTENDED_DATE})
    t.id = "flight_healed"
    return _tag_langgraph(t)


def main() -> None:
    from replay.replay import replay

    live = "--live" in sys.argv
    bb = "--browserbase" in sys.argv
    lg = "--langgraph" in sys.argv
    use_otel = "--otel" in sys.argv
    use_arize = "--arize" in sys.argv
    t = make_failing_trace(use_real_llm=live, use_browserbase=bb, use_langgraph=lg)
    path = "langgraph" if lg else "sequential"
    print(f"failing trace {t.id!r} ({path}): {len(t.steps)} steps, success={t.success}, gold={t.gold_root_step_id}")
    print(f"  final: {t.final_output}")

    gold = next(s for s in t.steps if s.id == t.gold_root_step_id)
    r = replay(t, t.gold_root_step_id, gold.correct_output, n=5)
    print(f"  replay confirm @ {t.gold_root_step_id}: rate={r.confirmation_rate:.0%} flipped={r.flipped}")
    print("\nOK — capture -> fault -> confirm loop works" if r.flipped else "\nUNEXPECTED")

    if use_arize or use_otel:
        from dotenv import load_dotenv

        load_dotenv()
        backend = "arize" if use_arize else "phoenix"
        label = "Arize AX (https://app.arize.com)" if use_arize else "Phoenix (http://localhost:6006)"
        print(f"\n[trace] exporting flight spans to {label}:")

        if use_arize and lg and r.flipped:
            from .arize_export import emit_flight_pair

            monitor = MonitorDecision(
                trace_id=t.id, root_step_id=t.gold_root_step_id or gold.id,
                replay=r, trusted=r.flipped,
                decision="auto_apply" if r.flipped else "escalate",
            )
            healed = _healed_from_replay()
            if not emit_flight_pair(t, monitor, healed):
                raise SystemExit(1)
        else:
            from ..otel import emit_trace

            monitor_meta = {
                "root_step_id": t.gold_root_step_id or "",
                "root_node": gold.raw.get("node") or "",
                "replay_confirmed": r.flipped,
                "confirmation_rate": r.confirmation_rate,
                "runtime": path,
                "domain": "flight",
            }
            if not emit_trace(t, backend=backend, monitor=monitor_meta):
                raise SystemExit(1)


if __name__ == "__main__":
    main()
