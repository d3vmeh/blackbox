"""P1 — The monitoring agent: Blackbox's attribution + replay as a *supervisor*.

It watches a multi-agent run. On failure it does the thing a plain self-healing
framework does not: it **localizes the earliest corrupted hand-off** and then **proves**
the fix by counterfactual replay (the outcome flips FAIL→PASS) before trusting it.

    "The only agent supervisor that proves the root cause by counterfactual replay
     before it lets an agent act or self-heal."

Localization here is a deterministic node-judge: the earliest step whose output does
NOT follow from its own inputs is the root. Downstream agents merely transform values
they were handed, so they stay consistent with their (corrupted) inputs — only the
agent that *originated* the bad value is inconsistent with its source. (P2's LLM
node-judge `attribution.attribute()` is the general-purpose version of this same idea.)
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Any, Optional

from eval.ap_oracle import evaluate_ap
from shared.schema import Trace

from . import ap_graph


@dataclass
class Verdict:
    failed: bool
    root_agent: Optional[str] = None
    root_step_id: Optional[str] = None
    wrong_value: Any = None
    correct_value: Any = None
    replay_confirmed: bool = False
    confirmation_rate: float = 0.0
    outcomes: Optional[list[bool]] = None


def _amount_in(invoice_text: str) -> Optional[float]:
    m = re.search(r"\$([\d,]+\.\d{2})", invoice_text or "")
    return float(m.group(1).replace(",", "")) if m else None


def _localize(trace: Trace):
    """Return (step, wrong_value, correct_value) for the earliest inconsistent hand-off."""
    for step in trace.steps:
        if step.raw.get("agent") == "extractor":
            expected = _amount_in(step.inputs.get("invoice_text", ""))
            got = step.output.get("amount") if isinstance(step.output, dict) else None
            if expected is not None and got is not None and abs(got - expected) > 0.005:
                return step, got, expected
        # downstream agents only pass/transform their inputs → consistent by construction
    return None, None, None


def investigate(trace: Trace, n: int = 5) -> Verdict:
    """Watch a finished run; if it failed, localize + replay-confirm the root cause."""
    if evaluate_ap(trace.final_output):
        return Verdict(failed=False)

    step, wrong, correct = _localize(trace)
    if step is None:
        return Verdict(failed=True)        # failed but couldn't localize

    agent = step.raw.get("agent")
    key = ap_graph.REPLAYABLE_AP.get(agent)
    outcomes: list[bool] = []
    for _ in range(n):
        baseline = ap_graph.replay_ap(agent, None)              # still broken → must FAIL
        fixed = ap_graph.replay_ap(agent, {key: correct})       # injected fix → must PASS
        outcomes.append(evaluate_ap(fixed.final_output) and not evaluate_ap(baseline.final_output))

    rate = sum(outcomes) / len(outcomes) if outcomes else 0.0
    return Verdict(failed=True, root_agent=agent, root_step_id=step.id,
                   wrong_value=wrong, correct_value=correct,
                   replay_confirmed=rate >= 0.5, confirmation_rate=rate, outcomes=outcomes)


def auto_heal(verdict: Verdict, n: int = 5) -> Optional[Trace]:
    """Self-heal: the monitor applies the fix — but ONLY after replay has confirmed it.
    An unconfirmed fix is never applied. Returns the healed (now-passing) run, or None."""
    if not (verdict.failed and verdict.replay_confirmed and verdict.root_agent):
        return None
    key = ap_graph.REPLAYABLE_AP[verdict.root_agent]
    return ap_graph.heal_ap(verdict.root_agent, {key: verdict.correct_value})


def human_fix(agent: str, corrected_value: Any) -> Trace:
    """Human-in-the-loop: a person messages a specific agent with the right value; we re-run
    the system with that correction applied at that agent. Same mechanism replay proves."""
    key = ap_graph.REPLAYABLE_AP[agent]
    return ap_graph.heal_ap(agent, {key: corrected_value}, trace_id="ap_human")
