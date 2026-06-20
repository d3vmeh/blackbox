"""P2 — Localization. Turn a failing Trace into an Attribution.

Pipeline:
  1. provenance graph from Step.parents (true data-flow edges).
  2. backward_slice from the final step -> suspect set.
  3. parallel Haiku node-judges -> per-step correctness scores.
  4. blend correctness + earliest-in-graph-order prior -> ranked Candidates.
  5. top candidate = root_step_id.
  6. blast_radius = forward slice from root.
  7. generate_rationale -> plain-English explanation.
"""
from __future__ import annotations

from shared.schema import Attribution, Candidate, Trace
from attribution.provenance import backward_slice, blast_radius, build_provenance_graph
from attribution.judges import judge_all_suspects
from attribution.rationale import generate_rationale

PASSIVE_KINDS = {"tool_result"}


def _is_passive(step) -> bool:
    """A step that cannot itself be the reasoning fault.

    A ``tool_result`` is passive ONLY when it has no inputs of its own — a raw
    external return the agent didn't reason about (e.g. a flight-search payload,
    whose step-level inputs are empty). Those are scored 0.00 by the judge (empty
    inputs look wrong) yet are never the fault. But a ``tool_result`` that *consumed*
    inputs is an active step — an extraction/OCR-style agent that interpreted those
    inputs and can introduce the fault — so it stays a suspect."""
    return step.kind in PASSIVE_KINDS and not step.inputs


def filter_active_suspects(suspects: set[str], trace: Trace) -> set[str]:
    """Remove passive steps that cannot introduce reasoning errors.

    Empty-input ``tool_result`` steps (raw external returns) are dropped; a
    ``tool_result`` that consumed inputs stays in. Without this, a multi-agent
    system whose extractor is labeled ``tool_result`` could never be localized to
    that extractor — see agent/converge_ap.py."""
    step_map = {s.id: s for s in trace.steps}
    return {sid for sid in suspects if not _is_passive(step_map[sid])}


def position_score(step_id: str, trace: Trace) -> float:
    """Earlier steps get higher suspicion weight. Uses step.index, not list position."""
    step_map = {s.id: s for s in trace.steps}
    step = step_map.get(step_id)
    if step is None:
        return 0.0
    return 1.0 - (step.index / len(trace.steps))


def rank_suspects(
    suspects: set[str],
    judge_scores: dict[str, float],
    trace: Trace,
) -> list[Candidate]:
    """Blend (1-correctness)*0.7 + position*0.3 -> ranked Candidates, descending."""
    results = []
    for step_id in suspects:
        correctness = judge_scores.get(step_id, 0.5)
        pos = position_score(step_id, trace)
        suspicion = (1.0 - correctness) * 0.7 + pos * 0.3
        reason = f"Node-judge correctness {correctness:.2f}; position score {pos:.2f}"
        results.append(Candidate(step_id=step_id, suspicion=suspicion, reason=reason))
    return sorted(results, key=lambda c: c.suspicion, reverse=True)


async def attribute(trace: Trace) -> Attribution:
    """Localize the root cause of a failing trace. Main exported function."""
    from attribution.regression import save_regression_case

    # 1. failing step = first final-kind step from the end, else last step
    failing_step_id = next(
        (s.id for s in reversed(trace.steps) if s.kind == "final"),
        trace.steps[-1].id,
    )

    # 2-4. graph → slice → filter passives → judge → rank
    G = build_provenance_graph(trace)
    suspects = backward_slice(G, failing_step_id)
    active_suspects = filter_active_suspects(suspects, trace)
    judge_scores = await judge_all_suspects(active_suspects, trace)
    candidates = rank_suspects(active_suspects, judge_scores, trace)

    # 5-7. root → blast → rationale
    root_step_id = candidates[0].step_id
    blast = blast_radius(G, root_step_id)
    rationale = await generate_rationale(root_step_id, blast, trace)

    result = Attribution(
        trace_id=trace.id,
        root_step_id=root_step_id,
        blast_radius=blast,
        candidates=candidates[:3],
        rationale=rationale,
    )
    save_regression_case(trace, result)
    return result
