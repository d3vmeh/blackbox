"""The SUBJECT agent we debug.

A LangGraph agent that performs a multi-step web task (flight research) using a
Browserbase-powered browser tool. Checkpointed so `replay/` can fork + re-run it.

SKELETON: node logic + the Browserbase tool are TODOs. The graph shape deliberately
mirrors `shared/fixtures/flight_fail.json`, so P2/P3/P4 can build against the fixture
while this gets fleshed out.
"""
from __future__ import annotations

from typing import Any, TypedDict

try:
    from langgraph.graph import END, StateGraph
    from langgraph.checkpoint.memory import MemorySaver
    _HAS_LANGGRAPH = True
except Exception:  # langgraph not installed yet
    _HAS_LANGGRAPH = False


class AgentState(TypedDict, total=False):
    task: str
    search_results: list[dict]
    departure_date: str
    chosen_flight: dict
    booking: dict
    email: str
    final_output: str


# --- Browserbase web tool -----------------------------------------------------
def browserbase_search(query: str, date: str) -> list[dict]:
    """TODO(P1): drive a Browserbase/Stagehand session to run the search and return
    structured results. Until then, callers should use a recorded fixture."""
    raise NotImplementedError("Wire Browserbase/Stagehand here (see .env.example for keys)")


# --- nodes (skeletons; one per fixture step) ---------------------------------
def plan(state: AgentState) -> AgentState:          # step 1
    raise NotImplementedError("TODO(P1): ask the LLM to draft the plan")


def search(state: AgentState) -> AgentState:        # steps 2-3 (tool call + result)
    raise NotImplementedError("TODO(P1): call browserbase_search(...)")


def parse_date(state: AgentState) -> AgentState:    # step 4  <- the fault site
    raise NotImplementedError("TODO(P1): extract the departure date from the result")


def select_flight(state: AgentState) -> AgentState:  # step 5
    raise NotImplementedError("TODO(P1): pick the cheapest matching flight")


def check_budget(state: AgentState) -> AgentState:  # steps 6-7
    raise NotImplementedError("TODO(P1): verify price under cap")


def book(state: AgentState) -> AgentState:          # step 8
    raise NotImplementedError("TODO(P1): book the flight (mock the side effect for replay)")


def compose_email(state: AgentState) -> AgentState:  # steps 9-10
    raise NotImplementedError("TODO(P1): draft + 'send' the itinerary email")


def build_agent():
    """Compile the LangGraph agent with a checkpointer (required for replay)."""
    if not _HAS_LANGGRAPH:
        raise RuntimeError("Install deps first: pip install -r requirements.txt")
    g = StateGraph(AgentState)
    nodes = [
        ("plan", plan), ("search", search), ("parse_date", parse_date),
        ("select_flight", select_flight), ("check_budget", check_budget),
        ("book", book), ("compose_email", compose_email),
    ]
    for name, fn in nodes:
        g.add_node(name, fn)
    g.set_entry_point("plan")
    for (a, _), (b, _) in zip(nodes, nodes[1:]):
        g.add_edge(a, b)
    g.add_edge("compose_email", END)
    # MemorySaver gives us checkpoints to fork from in replay/.
    return g.compile(checkpointer=MemorySaver())
