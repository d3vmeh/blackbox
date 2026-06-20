"""P2 — Provenance graph + program slices over a Trace.

backward_slice(): transitive closure over reversed Step.parents from the failing
output = every step that could have causally influenced the failure.
forward_slice(): transitive closure over Step.parents children from the root =
the blast radius (every step that inherited the root's output).
"""

from __future__ import annotations

from shared.schema import Trace


def backward_slice(trace: Trace, from_step_id: str) -> list[str]:
    raise NotImplementedError("P2")


def forward_slice(trace: Trace, root_step_id: str) -> list[str]:
    raise NotImplementedError("P2")
