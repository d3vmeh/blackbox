"""The SUBJECT agent we debug — a multi-step flight-booking task.

Reasoning steps call Claude (via agent/llm.py); the web step uses the mock Browserbase
tool (agent/tools.py). Each node records itself into a TraceRecorder, so a run produces a
canonical `Trace` for P2/P3/P4. The node graph mirrors shared/fixtures/flight_fail.json.

The nodes are plain functions over a RunContext so they run sequentially today (see
agent/run.py) AND can be wrapped into a checkpointed LangGraph later for live replay.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any

from shared.schema import StepKind
from .instrument import TraceRecorder
from .llm import Think


@dataclass
class RunContext:
    task: str
    think: Think
    search: Any                      # (dest, date) -> list[dict]
    recorder: TraceRecorder
    state: dict = field(default_factory=dict)
    last_id: dict = field(default_factory=dict)   # node name -> recorded step id


def _rec(ctx: RunContext, name: str, **kw) -> int:
    sid = ctx.recorder.record(name=name, **kw)
    ctx.last_id[name] = sid
    return sid


def plan(ctx: RunContext) -> None:
    out = ctx.think(
        "You are a travel agent. Draft a one-sentence plan for the task.",
        ctx.task,
    ) or "Plan: search AUS flights for the requested date, filter < $500, pick cheapest, book, email."
    _rec(ctx, "plan", kind=StepKind.llm, inputs={"task": ctx.task}, output=out, parent_ids=[])


def search(ctx: RunContext) -> None:
    dest, date = ctx.state["dest"], ctx.state["date"]
    call = _rec(ctx, "search_flights", kind=StepKind.tool_call,
                inputs={"dest": dest, "date": date},
                output=f"called search_flights(dest={dest}, date={date})",
                parent_ids=[ctx.last_id["plan"]])
    results = ctx.search(dest, date)
    ctx.state["results"] = results
    _rec(ctx, "search_flights_result", kind=StepKind.tool_result,
         output=results[0], parent_ids=[call])


def parse_date(ctx: RunContext) -> None:
    """The fault site: extract the departure date from the tool result."""
    raw = ctx.state["results"][0]["depart"]
    out = ctx.think(
        "Extract the departure date from the payload as YYYY-MM-DD.",
        f"payload depart field: {raw}",
    ) or raw
    ctx.state["departure"] = out
    _rec(ctx, "parse_date", kind=StepKind.llm, inputs={"raw_depart": raw},
         output=f"departure = {out}", parent_ids=[ctx.last_id["search_flights_result"]])


def select_flight(ctx: RunContext) -> None:
    cheapest = min(ctx.state["results"], key=lambda r: r["price"])
    ctx.state["chosen"] = cheapest
    ctx.state["selected_flight"] = cheapest["flight"]
    ctx.state["selected_price"] = cheapest["price"]
    out = f"selected {cheapest['flight']} @ ${cheapest['price']} for {ctx.state['departure']}"
    _rec(ctx, "select_flight", kind=StepKind.llm,
         inputs={"departure": ctx.state["departure"], "candidates": [f"{r['flight']} @ ${r['price']}" for r in ctx.state["results"]]},
         output=out, parent_ids=[ctx.last_id["parse_date"], ctx.last_id["search_flights_result"]])


def check_budget(ctx: RunContext) -> None:
    price, cap = ctx.state["chosen"]["price"], 500
    call = _rec(ctx, "check_budget", kind=StepKind.tool_call,
                inputs={"price": price, "cap": cap},
                output=f"called check_budget({price}, cap={cap})",
                parent_ids=[ctx.last_id["select_flight"]])
    ok = price < cap
    _rec(ctx, "check_budget_result", kind=StepKind.tool_result,
         output={"ok": ok, "note": f"${price} {'<' if ok else '>='} ${cap}"}, parent_ids=[call])


def book(ctx: RunContext) -> None:
    flight = ctx.state["selected_flight"]
    booking = {"booking": "BK-90X", "flight": flight, "date": ctx.state["departure"], "status": "confirmed"}
    ctx.state["booking"] = booking
    _rec(ctx, "book_flight", kind=StepKind.tool_call,
         inputs={"flight": flight, "date": ctx.state["departure"]}, output=booking,
         parent_ids=[ctx.last_id["select_flight"], ctx.last_id["check_budget_result"]])


def compose_email(ctx: RunContext) -> None:
    date = ctx.state["departure"]
    ctx.state["email_date"] = date
    out = ctx.think(
        "Draft a one-line itinerary email subject line that includes the departure date.",
        f"Booking {ctx.state['booking']['booking']} departs {date}.",
    ) or f"Subject: Austin offsite — depart {date}, flight {ctx.state['selected_flight']}."
    ctx.state["email"] = out
    _rec(ctx, "compose_email", kind=StepKind.llm,
         inputs={"booking": ctx.state["booking"]["booking"], "date": date},
         output=out, parent_ids=[ctx.last_id["book_flight"]])


def finalize(ctx: RunContext) -> None:
    date = ctx.state["departure"]
    out = f"SENT — itinerary dated {date}"
    ctx.state["final_output"] = out
    _rec(ctx, "send_itinerary", kind=StepKind.output, inputs={"recipients": 6},
         output=out, parent_ids=[ctx.last_id["compose_email"]])


# The pipeline, in execution order. run.py runs these sequentially.
NODES = [plan, search, parse_date, select_flight, check_budget, book, compose_email, finalize]

DEFAULT_TASK = "Find the cheapest flight to Austin departing Jul 12 under $500 and email the team."
INTENDED_DATE = "2026-07-12"
CAP = 500


def _date(s: Any) -> str:
    m = re.search(r"\d{4}-\d{2}-\d{2}", str(s))
    return m.group(0) if m else str(s).strip()


def is_correct(state: dict) -> bool:
    """The agent succeeded iff the booked date, the chosen flight (the cheapest), the price,
    and the date written into the email are all right. Multiple fields => multiple fault sites."""
    results = state.get("results") or []
    cheapest = min(results, key=lambda r: r["price"])["flight"] if results else None
    return bool(
        state.get("departure") == INTENDED_DATE
        and state.get("email_date") == INTENDED_DATE
        and (cheapest is None or state.get("selected_flight") == cheapest)
        and state.get("selected_price", 10 ** 9) < CAP
    )


# node name -> (state_key, extract_fn): how to map a recorded step output back to the state
# value that node controls, so replay can force it (good value or bad value).
REPLAYABLE: dict = {
    "parse_date":    ("departure",       _date),
    "select_flight": ("selected_flight", lambda out: str(out).split()[1] if len(str(out).split()) > 1 else str(out)),
    "compose_email": ("email_date",      _date),
}


def replay_run(fork_node: str, state_override: dict, *,
               use_real_llm: bool = False, use_browserbase: bool = False,
               dest: str = "AUS", date: str = INTENDED_DATE):
    """Re-execute the agent, forcing `state_override` right after `fork_node` runs — the real
    counterfactual. The prefix runs normally, the fork node's effect is replaced, and every
    downstream node recomputes from it. Returns the resulting Trace (success via is_correct)."""
    from .llm import make_think
    from .tools import browserbase_search, mock_browserbase_search

    search_tool = browserbase_search if use_browserbase else mock_browserbase_search
    rec = TraceRecorder(trace_id="flight_replay", task=DEFAULT_TASK)
    ctx = RunContext(task=DEFAULT_TASK, think=make_think(use_real_llm), search=search_tool, recorder=rec)
    ctx.state.update(dest=dest, date=date)
    for node in NODES:
        node(ctx)
        if node.__name__ == fork_node:
            ctx.state.update(state_override)   # do(state = v*) at the fork point
    return rec.finish(final_output=ctx.state.get("final_output", ""), success=is_correct(ctx.state))


# Upgrade path: a checkpointed LangGraph StateGraph would reuse the unchanged prefix instead
# of re-running it — needed once prefix steps are slow or non-replayable (real side effects).
