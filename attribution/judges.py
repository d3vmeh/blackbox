"""P2 — Per-step LLM node-judge (Claude Haiku), run in parallel.

Each judge sees ONLY one step's inputs and output and answers: does this output
follow correctly from these inputs? It must NOT see downstream steps or the final
outcome — that isolation is what makes the verdict a local correctness signal
rather than hindsight. Cheap model, many concurrent calls.
"""

from __future__ import annotations

from shared.schema import Step


def judge_step(step: Step) -> tuple[bool, str]:
    """Return (is_output_correct_given_inputs, short_reason)."""
    raise NotImplementedError("P2: Haiku node-judge")
