"""P1 — The monitoring agent: Blackbox's attribution + replay as a *supervisor*.

On failure it localizes the **earliest corrupted hand-off** and **proves** the fix by
counterfactual replay (FAIL→PASS) before trusting it:

    "The only agent supervisor that proves the root cause by counterfactual replay
     before it lets an agent act or self-heal."

Localization is a deterministic node-judge: for each step, recompute what that agent
SHOULD have output from its (recorded) upstream via `graph.COMPUTE`, and flag the
earliest field that diverges. The originating agent is inconsistent with its inputs;
downstream agents merely propagate, so they stay consistent. (P2's LLM `attribute()` is
the general, model-based version of the same idea.)
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Optional

from eval.ap_oracle import evaluate_ap
from shared.schema import Trace

from . import graph
from .scenarios import Scenario


@dataclass
class Verdict:
    failed: bool
    root_agent: Optional[str] = None
    root_step_id: Optional[str] = None
    field: Optional[str] = None
    wrong_value: Any = None
    correct_value: Any = None
    replay_confirmed: bool = False
    confirmation_rate: float = 0.0
    outcomes: Optional[list[bool]] = None


def _ne(a: Any, b: Any) -> bool:
    if isinstance(a, (int, float)) and isinstance(b, (int, float)):
        return abs(float(a) - float(b)) > 0.005
    return a != b


def _localize(trace: Trace, scn: Scenario):
    """Earliest step whose recorded output diverges from COMPUTE(scenario, recorded-upstream)."""
    up: dict = {}
    for step in trace.steps:
        agent = step.raw.get("agent")
        if agent not in graph.COMPUTE:
            continue
        expected = graph.COMPUTE[agent](scn, up)
        out = step.output if isinstance(step.output, dict) else {}
        for k, ev in expected.items():
            if _ne(out.get(k), ev):
                return step, agent, k, out.get(k), ev
        up[agent] = out
    return None


def investigate(trace: Trace, scn: Scenario, n: int = 5) -> Verdict:
    """Watch a finished run; if it failed, localize + replay-confirm the root cause."""
    if evaluate_ap(trace.final_output, scn):
        return Verdict(failed=False)

    found = _localize(trace, scn)
    if found is None:
        return Verdict(failed=True)
    step, agent, field, wrong, correct = found

    outcomes: list[bool] = []
    for _ in range(n):
        baseline = graph.replay_ap(scn, None, None)              # still broken → must FAIL
        fixed = graph.replay_ap(scn, agent, {field: correct})    # injected fix → must PASS
        outcomes.append(evaluate_ap(fixed.final_output, scn) and not evaluate_ap(baseline.final_output, scn))

    rate = sum(outcomes) / len(outcomes) if outcomes else 0.0
    return Verdict(failed=True, root_agent=agent, root_step_id=step.id, field=field,
                   wrong_value=wrong, correct_value=correct,
                   replay_confirmed=rate >= 0.5, confirmation_rate=rate, outcomes=outcomes)


def auto_heal(verdict: Verdict, scn: Scenario) -> Optional[Trace]:
    """Self-heal: apply the fix — but ONLY after replay has confirmed it."""
    if not (verdict.failed and verdict.replay_confirmed and verdict.root_agent):
        return None
    return graph.replay_ap(scn, verdict.root_agent, {verdict.field: verdict.correct_value},
                              trace_id="ap_healed")


def human_fix(scn: Scenario, agent: str, field: str, corrected_value: Any) -> Trace:
    """Human-in-the-loop: a person messages a specific agent with the right value; re-run
    the system with that correction applied at that agent."""
    return graph.replay_ap(scn, agent, {field: corrected_value}, trace_id="ap_human")
