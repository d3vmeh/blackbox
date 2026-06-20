"""Run the subject agent and produce a captured Trace.

    python -m agent.run                       # offline: mock LLM + mock web (no keys)
    python -m agent.run --live                # Claude reasoning (needs ANTHROPIC_API_KEY)
    python -m agent.run --browserbase         # real Browserbase web tool (needs BROWSERBASE_* keys)
    python -m agent.run --live --browserbase  # full real run
    python -m agent.run --otel                # also emit OpenTelemetry spans to Phoenix (Arize track)

Produces a real failing Trace via programmed fault injection (perturb a successful run),
saves it, and confirms the root cause by replay — the full P1 loop end to end.
"""
from __future__ import annotations

import sys

from shared.schema import Trace
from .faults import inject_fault
from .instrument import TraceRecorder
from .llm import make_think
from .subject_agent import NODES, RunContext, is_correct
from .tools import browserbase_search, mock_browserbase_search


def run_agent(task: str, *, use_real_llm: bool = False, use_browserbase: bool = False,
              dest: str = "AUS", date: str = "2026-07-12") -> Trace:
    """Run the agent once and return the captured (successful) Trace."""
    search = browserbase_search if use_browserbase else mock_browserbase_search
    rec = TraceRecorder(trace_id="flight_live", task=task)
    ctx = RunContext(task=task, think=make_think(use_real_llm), search=search, recorder=rec)
    ctx.state.update(dest=dest, date=date)
    for node in NODES:
        node(ctx)
    return rec.finish(final_output=ctx.state["final_output"], success=is_correct(ctx.state))


def make_failing_trace(use_real_llm: bool = False, use_browserbase: bool = False) -> Trace:
    """Run the agent, then inject the classic date-misread fault at parse_date."""
    correct = "2026-07-12"
    bad = "2026-12-07"
    trace = run_agent(
        "Find the cheapest flight to Austin departing Jul 12 under $500 and email the team.",
        use_real_llm=use_real_llm, use_browserbase=use_browserbase, date=correct,
    )
    parse_step = next(s for s in trace.steps if s.name == "parse_date")
    return inject_fault(
        trace, step_id=parse_step.id,
        bad_output=f"departure = {bad}",
        propagate=(correct, bad),
        final_output=f"SENT — itinerary dated {bad} (should be {correct})",
    )


def main() -> None:
    live = "--live" in sys.argv
    bb = "--browserbase" in sys.argv
    from replay import confirm
    from .store import save_trace

    trace = make_failing_trace(use_real_llm=live, use_browserbase=bb)
    save_trace(trace)
    if "--otel" in sys.argv:
        from .otel import emit_trace
        emit_trace(trace)
    tools = f"LLM={'claude' if live else 'mock'}, web={'browserbase' if bb else 'mock'}"
    print(f"Captured failing trace {trace.id!r} ({tools}): {len(trace.steps)} steps, success={trace.success}")
    print(f"  final: {trace.final_output}")
    print(f"  gold root cause: step {trace.gold_root_step_id} (parse_date)\n")

    root = trace.gold_root_step_id
    fix = next(s for s in trace.steps if s.id == root).correct_output
    result = confirm(trace, root, fix, n=5)
    print(f"Replay confirm @ step {root} (inject {fix!r}): "
          f"rate={result.confirmation_rate:.0%} flipped={result.flipped}")
    print("\nOK — P1 generate→capture→confirm loop works"
          if result.flipped else "\nUNEXPECTED — check pipeline")


if __name__ == "__main__":
    main()
