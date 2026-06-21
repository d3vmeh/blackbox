"""P1 — The subject agent: a multi-step flight-booking run we debug.

Reasoning nodes call Claude (agent/llm.py); the web node uses the Browserbase tool
(agent/tools.py). Each node records itself into a Recorder, producing a canonical Trace
(str step ids, true `parents` edges, a state snapshot per step).

Nodes are plain functions over a RunContext. They run sequentially via `_run` and are
wrapped in a checkpointed LangGraph by `build_graph` / `run_agent_graph` for live
fork/replay (`app.update_state` + resume).
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any

from eval.oracle import evaluate
from shared.schema import Trace

from ..capture import Recorder
from ..llm import Think, make_think
from .tools import browserbase_search, mock_browserbase_search

INTENDED_DATE = "2026-07-12"
CAP = 500
DEFAULT_TASK = "Find the cheapest flight to Austin departing Jul 12 under $500 and email the team."


@dataclass
class RunContext:
    think: Think
    search: Any                       # (dest, date) -> list[dict]
    rec: Recorder
    state: dict = field(default_factory=dict)
    last: dict = field(default_factory=dict)   # node name -> recorded step id (str)
    replay_mode: bool = False                  # True during replay -> stub side effects


def _rec(ctx: RunContext, node: str, kind: str, output: Any, parents: list[str],
         inputs: dict | None = None, tool_name: str | None = None) -> str:
    sid = ctx.rec.record(node=node, kind=kind, inputs=inputs or {}, output=output,
                         state=ctx.state, parents=parents, tool_name=tool_name)
    ctx.last[node] = sid
    return sid


# --- nodes (each appends one or two Steps) -----------------------------------
def plan(ctx: RunContext) -> None:
    out = ctx.think("You are a travel agent. Draft a one-sentence plan for the task.", DEFAULT_TASK) \
        or "Plan: search AUS flights for the date, filter < $500, pick cheapest, book, email."
    _rec(ctx, "plan", "reason", out, parents=[], inputs={"task": DEFAULT_TASK})


def search(ctx: RunContext) -> None:
    dest, date = ctx.state["dest"], ctx.state["date"]
    call = _rec(ctx, "search_flights", "tool_call", f"search_flights(dest={dest}, date={date})",
                parents=[ctx.last["plan"]], inputs={"dest": dest, "date": date}, tool_name="search_flights")
    results = ctx.search(dest, date)
    ctx.state["results"] = results
    _rec(ctx, "search_flights_result", "tool_result", results[0], parents=[call], tool_name="search_flights")


def parse_date(ctx: RunContext) -> None:
    raw = ctx.state["results"][0]["depart"]
    out = ctx.think("Extract the departure date as YYYY-MM-DD.", f"payload depart field: {raw}") or raw
    ctx.state["departure"] = out
    _rec(ctx, "parse_date", "reason", f"departure = {out}",
         parents=[ctx.last["search_flights_result"]], inputs={"raw_depart": raw})


def select_flight(ctx: RunContext) -> None:
    cheapest = min(ctx.state["results"], key=lambda r: r["price"])
    ctx.state["selected_flight"] = cheapest["flight"]
    ctx.state["selected_price"] = cheapest["price"]
    out = f"selected {cheapest['flight']} @ ${cheapest['price']} for {ctx.state['departure']}"
    _rec(ctx, "select_flight", "decision", out,
         parents=[ctx.last["parse_date"], ctx.last["search_flights_result"]],
         inputs={"departure": ctx.state["departure"]})


def check_budget(ctx: RunContext) -> None:
    price = ctx.state["selected_price"]
    call = _rec(ctx, "check_budget", "tool_call", f"check_budget({price}, cap={CAP})",
                parents=[ctx.last["select_flight"]], inputs={"price": price, "cap": CAP}, tool_name="check_budget")
    ok = price < CAP
    ctx.state["budget_ok"] = ok
    _rec(ctx, "check_budget_result", "tool_result", {"ok": ok}, parents=[call], tool_name="check_budget")


def book(ctx: RunContext) -> None:
    flight = ctx.state["selected_flight"]
    # book_flight is a real side effect. During replay we must NOT re-execute it
    # (replay runs N times -> would book N flights) — serve a stub.
    status = "stubbed" if ctx.replay_mode else "confirmed"
    booking = {"booking": "BK-STUB" if ctx.replay_mode else "BK-90X",
               "flight": flight, "date": ctx.state["departure"], "status": status}
    ctx.state["booking"] = booking
    _rec(ctx, "book_flight", "tool_call", booking,
         parents=[ctx.last["select_flight"], ctx.last["check_budget_result"]],
         inputs={"flight": flight, "date": ctx.state["departure"]}, tool_name="book_flight")


def compose_email(ctx: RunContext) -> None:
    date = ctx.state["departure"]
    ctx.state["email_date"] = date
    out = ctx.think("Draft a one-line itinerary email subject that includes the departure date.",
                    f"Booking {ctx.state['booking']['booking']} departs {date}.") \
        or f"Subject: Austin offsite — depart {date}, flight {ctx.state['selected_flight']}."
    _rec(ctx, "compose_email", "reason", out, parents=[ctx.last["book_flight"]],
         inputs={"date": date})


def finalize(ctx: RunContext) -> None:
    out = {"date": ctx.state["departure"], "flight": ctx.state["selected_flight"],
           "email_date": ctx.state["email_date"]}
    ctx.state["final_output"] = out
    _rec(ctx, "send_itinerary", "final", out, parents=[ctx.last["compose_email"]],
         inputs={"recipients": 6})


NODES = [plan, search, parse_date, select_flight, check_budget, book, compose_email, finalize]


def _date(s: Any) -> str:
    m = re.search(r"\d{4}-\d{2}-\d{2}", str(s))
    return m.group(0) if m else str(s).strip()


# node -> (state_key, extract_fn): map a recorded step output back to the state value the
# node controls, so replay can force it (good value or bad value).
REPLAYABLE: dict = {
    "parse_date":    ("departure",       _date),
    "select_flight": ("selected_flight", lambda out: str(out).split()[1] if len(str(out).split()) > 1 else str(out)),
    "compose_email": ("email_date",      _date),
}

# Replayability taxonomy: faithful (safe re-run) | stub (cached/mock read) | side_effect (mocked).
REPLAYABILITY: dict = {
    "plan": "faithful", "search_flights": "stub", "parse_date": "faithful",
    "select_flight": "faithful", "check_budget": "faithful", "book_flight": "side_effect",
    "compose_email": "faithful", "send_itinerary": "side_effect",
}


def _run(ctx: RunContext, trace_id: str, *, fork_node: str | None = None,
         override: dict | None = None) -> Trace:
    ctx.state.setdefault("dest", "AUS")
    ctx.state.setdefault("date", INTENDED_DATE)
    for node in NODES:
        node(ctx)
        if fork_node and node.__name__ == fork_node and override:
            ctx.state.update(override)        # do(state = v*) at the fork point
    final = ctx.state["final_output"]
    return ctx.rec.finish(final_output=final, success=evaluate(final, DEFAULT_TASK))


def run_agent(*, use_real_llm: bool = False, use_browserbase: bool = False,
              dest: str = "AUS", date: str = INTENDED_DATE, trace_id: str = "flight_live") -> Trace:
    search_tool = browserbase_search if use_browserbase else mock_browserbase_search
    ctx = RunContext(think=make_think(use_real_llm), search=search_tool, rec=Recorder(trace_id, DEFAULT_TASK))
    ctx.state.update(dest=dest, date=date)
    return _run(ctx, trace_id)


def replay_run(fork_node: str, override: dict, *, use_real_llm: bool = False) -> Trace:
    """Re-execute the agent, forcing `override` right after `fork_node` runs (side effects
    stubbed). The real counterfactual used by replay/replay.py."""
    ctx = RunContext(think=make_think(use_real_llm), search=mock_browserbase_search,
                     rec=Recorder("flight_replay", DEFAULT_TASK), replay_mode=True)
    return _run(ctx, "flight_replay", fork_node=fork_node, override=override)


# Module-level registry: thread_id → Recorder.
# Recorder is not JSON-serializable so it lives here, outside LangGraph state.
_RUN_REC: dict[str, Recorder] = {}
_REPLAY_THREADS: set[str] = set()


def build_graph(*, use_real_llm: bool = False, use_browserbase: bool = False):
    """LangGraph StateGraph wrapping NODES with MemorySaver checkpoints.

    Replay can fork at any checkpoint via app.update_state() and resume
    forward — no need to re-run from the beginning or repeat side effects."""
    from langgraph.graph import StateGraph, END
    from langgraph.checkpoint.memory import MemorySaver

    think_fn = make_think(use_real_llm)
    search_fn = browserbase_search if use_browserbase else mock_browserbase_search

    def _wrap(node_fn):
        def lg_node(state: dict, config) -> dict:
            cfg = config.get("configurable") or {}
            thread_id = state.get("__thread_id__") or cfg.get("thread_id")
            if not thread_id:
                raise KeyError("__thread_id__ missing from state and config")
            rec = _RUN_REC[thread_id]
            ctx = RunContext(think=think_fn, search=search_fn, rec=rec)
            ctx.state = {k: v for k, v in state.items() if not k.startswith("__")}
            ctx.last = state.get("__last__", {})
            ctx.replay_mode = thread_id in _REPLAY_THREADS
            node_fn(ctx)
            return {**ctx.state, "__last__": ctx.last, "__thread_id__": thread_id}
        lg_node.__name__ = node_fn.__name__
        return lg_node

    builder = StateGraph(dict)
    for fn in NODES:
        builder.add_node(fn.__name__, _wrap(fn))

    names = [fn.__name__ for fn in NODES]
    builder.set_entry_point(names[0])
    for a, b in zip(names, names[1:]):
        builder.add_edge(a, b)
    builder.add_edge(names[-1], END)

    return builder.compile(checkpointer=MemorySaver())


def run_agent_graph(*, use_real_llm: bool = False, use_browserbase: bool = False,
                    dest: str = "AUS", date: str = INTENDED_DATE,
                    trace_id: str = "lg_flight") -> tuple[Trace, Any]:
    """Run the agent through LangGraph. Returns (Trace, app) so the caller can
    fork at any checkpoint: app.update_state(config, {state_key: fix}, as_node=node)."""
    app = build_graph(use_real_llm=use_real_llm, use_browserbase=use_browserbase)
    rec = Recorder(trace_id, DEFAULT_TASK)
    _RUN_REC[trace_id] = rec

    config = {"configurable": {"thread_id": trace_id}}
    try:
        final_state = app.invoke(
            {"dest": dest, "date": date, "__thread_id__": trace_id, "__last__": {}},
            config,
        )
    finally:
        _RUN_REC.pop(trace_id, None)

    final_output = final_state.get("final_output", {})
    trace = rec.finish(final_output=final_output, success=evaluate(final_output, DEFAULT_TASK))
    return trace, app


def graph_fork_outcome(app, config: dict, fork_node: str, override: dict) -> bool:
    """LangGraph checkpoint fork: `update_state(as_node=...)` + resume. Returns oracle pass/fail."""
    tid = config["configurable"]["thread_id"]
    snap = app.get_state(config)
    base = {k: v for k, v in (snap.values or {}).items() if not k.startswith("__")}
    patch = {**base, **override, "__thread_id__": tid, "__last__": (snap.values or {}).get("__last__", {})}
    app.update_state(config, patch, as_node=fork_node)
    _RUN_REC[tid] = Recorder(f"{tid}_fork", DEFAULT_TASK)
    _REPLAY_THREADS.add(tid)
    try:
        final = app.invoke(None, config)
    finally:
        _REPLAY_THREADS.discard(tid)
        _RUN_REC.pop(tid, None)
    return bool(evaluate(final.get("final_output", {})))


def graph_replay_confirm(fork_node: str, bad: dict, good: dict, n: int = 5) -> list[bool]:
    """Counterfactual over n trials via LangGraph fork (sashikumar path)."""
    outcomes = []
    for i in range(n):
        tid = f"lg_replay_{i}"
        _, app = run_agent_graph(trace_id=tid)
        cfg = {"configurable": {"thread_id": tid}}
        base_fail = not graph_fork_outcome(app, cfg, fork_node, bad)
        _, app2 = run_agent_graph(trace_id=f"{tid}b")
        cfg2 = {"configurable": {"thread_id": f"{tid}b"}}
        fixed_pass = graph_fork_outcome(app2, cfg2, fork_node, good)
        outcomes.append(bool(fixed_pass and base_fail))
    return outcomes


if __name__ == "__main__":
    t = run_agent()
    print(f"run: {len(t.steps)} steps, success={t.success}, final={t.final_output}")
