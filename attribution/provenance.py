"""P2 — Provenance graph + program slices over a Trace.

backward_slice(): transitive closure over reversed Step.parents from the failing
output = every step that could have causally influenced the failure.
blast_radius(): transitive closure forward from root = poisoned steps.
"""
from __future__ import annotations

import networkx as nx

from shared.schema import Trace


def build_provenance_graph(trace: Trace) -> nx.DiGraph:
    """Each Step is a node; edges run parent -> child (data flows forward)."""
    G = nx.DiGraph()
    for step in trace.steps:
        G.add_node(step.id, step=step)
    for step in trace.steps:
        for parent_id in step.parents:
            if parent_id in G:
                G.add_edge(parent_id, step.id)
    return G


def backward_slice(G: nx.DiGraph, failing_step_id: str) -> set[str]:
    """nx.ancestors(G, failing_step_id) plus the failing step itself — the suspects."""
    return nx.ancestors(G, failing_step_id) | {failing_step_id}


def blast_radius(G: nx.DiGraph, root_step_id: str) -> list[str]:
    """Descendants of root_step_id in topological order, excluding the root itself."""
    descendants = nx.descendants(G, root_step_id)
    topo = list(nx.topological_sort(G))
    return [n for n in topo if n in descendants]
