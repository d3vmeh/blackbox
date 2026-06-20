"""P2 — Localization. Turn a failing Trace into an Attribution.

Pipeline (see ARCHITECTURE.md §Localization):
  1. provenance graph: edges from Step.parents (true data-flow).
  2. backward slice from the failing final_output -> the implicated steps.
  3. parallel node-judges (Haiku): "given ONLY this step's inputs, is the
     output correct?" -> per-step wrongness verdict.
  4. blend node-judge verdict with an earliest-in-graph-order prior -> ranked
     candidates. (Ochiai is intentionally NOT the load-bearing signal on a single
     trace — it degenerates. Optionally feed replay outcomes back in as an
     execution population to make spectrum scoring real later.)
  5. earliest high-suspicion step = root_step_id.
  6. forward slice from root = blast_radius.
"""

from __future__ import annotations

from shared.schema import Attribution, Trace


def attribute(trace: Trace) -> Attribution:
    raise NotImplementedError("P2: build localization against shared/fixtures/flight_fail.json")
