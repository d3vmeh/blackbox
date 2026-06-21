"""P1 — The monitoring agent for the software-team pipeline. Two localization strategies,
both deterministic: (1) DECISION-FIELD compare — the earliest agent whose constrained
decision field (e.g. the architect's op_order) diverges from the reference; code blobs are
never text-compared. (2) REPLAY EARLIEST-FLIP — confirm the root by forking + injecting the
reference output and checking FAIL->PASS. `poisoned_path` is the HONEST blast radius: the
integrator and everything downstream of it (the steps that actually carry the wrong total),
not the independently-correct parallel modules."""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Optional

import networkx as nx

from attribution.provenance import build_provenance_graph
from shared.schema import Trace

from .graph import replay_team
from .scenarios import AGENTS, TeamScenario


@dataclass
class Verdict:
    failed: bool
    root_agent: Optional[str] = None
    replay_confirmed: bool = False
    confirmation_rate: float = 0.0


def _reference_output(scn: TeamScenario, agent: str) -> dict:
    """The correct output for `agent`, computed over corrected upstream references."""
    up: dict = {}
    for a in AGENTS:
        out = scn.reference[a](scn, up)
        up[a] = out
        if a == agent:
            return out
    raise ValueError(f"unknown agent {agent!r}")


def localize(scn: TeamScenario, trace: Trace):
    """Decision-field compare: earliest agent whose constrained decision field diverges from
    the reference. Returns (step, agent, field, bad, good) or None."""
    for step in trace.steps:
        agent = step.raw.get("agent")
        fields = scn.decision_fields.get(agent)
        if not fields:
            continue
        ref = _reference_output(scn, agent)
        out = step.output if isinstance(step.output, dict) else {}
        for f in fields:
            if out.get(f) != ref.get(f):
                return step, agent, f, out.get(f), ref.get(f)
    return None


def investigate(trace: Trace, scn: TeamScenario, n: int = 3, *, think=None) -> Verdict:
    """Localize + replay-confirm. Earliest agent in graph order whose corrected (reference)
    output flips FAIL->PASS is the root. Deterministic when `think` is None (the default for
    artifact-building, even on live runs)."""
    if trace.success:
        return Verdict(failed=False)
    for agent in AGENTS:
        correct = _reference_output(scn, agent)
        outcomes = []
        for _ in range(n):
            fixed = replay_team(scn, agent, correct, think=think)
            base = replay_team(scn, None, None, think=think)
            outcomes.append(fixed.success and not base.success)
        rate = sum(outcomes) / len(outcomes) if outcomes else 0.0
        if rate >= 0.5:
            return Verdict(failed=True, root_agent=agent,
                           replay_confirmed=True, confirmation_rate=rate)
    return Verdict(failed=True)


def poisoned_path(trace: Trace) -> list[str]:
    """Honest blast radius: the integrator step + its descendants (reviewer, ci) in
    topological order. The parallel leaf modules are downstream of the architect but
    independently correct, so they are NOT poisoned."""
    G = build_provenance_graph(trace)
    integ = next(s for s in trace.steps if s.raw.get("agent") == "integrator")
    desc = nx.descendants(G, integ.id)
    topo = list(nx.topological_sort(G))
    return [integ.id] + [n for n in topo if n in desc]
