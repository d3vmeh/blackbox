"""P1 — The subject agent: a checkpointed LangGraph that books a flight via a
Browserbase/Stagehand web tool. Checkpointing is REQUIRED — it is the mechanism
replay() uses to fork. Hardcoded to this one demo agent (no framework
generalization — that is explicit future work, see ARCHITECTURE.md §Non-goals)."""

from __future__ import annotations


def build_graph():
    raise NotImplementedError("P1: LangGraph agent with a checkpointer")
