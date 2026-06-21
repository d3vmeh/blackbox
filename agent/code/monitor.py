"""P1 — The monitoring agent for the coding pipeline. On oracle FAIL it localizes the
root agent by REPLAY EARLIEST-FLIP: sweep agents in graph order; the root is the
earliest one whose corrected (reference) output flips FAIL->PASS. Replay-confirmed
before the verdict is trusted. (P2's attribute() is the general LLM cross-check,
wired in Phase 2.)"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Optional

from eval.code_oracle import evaluate_code
from shared.schema import Trace

from .graph import replay_code
from .scenarios import AGENTS, CodeScenario


@dataclass
class Verdict:
    failed: bool
    root_agent: Optional[str] = None
    replay_confirmed: bool = False
    confirmation_rate: float = 0.0


def _reference_output(scn: CodeScenario, agent: str) -> dict:
    """The correct output for `agent`, computed over corrected upstream references."""
    up: dict = {}
    for a in AGENTS:
        out = scn.reference[a](scn, up)
        up[a] = out
        if a == agent:
            return out
    raise ValueError(f"unknown agent {agent!r} (not in AGENTS)")


def investigate(trace: Trace, scn: CodeScenario, n: int = 3, *, think=None) -> Verdict:
    """Localize + replay-confirm. If `think` is wired, the replays re-run the REAL
    agents too, so the proof is genuinely an LLM counterfactual (slower, costs calls)."""
    if evaluate_code(trace.final_output["code"], scn):
        return Verdict(failed=False)

    for agent in AGENTS:                                   # earliest-in-graph order
        correct = _reference_output(scn, agent)
        outcomes = []
        for _ in range(n):
            fixed = replay_code(scn, agent, correct, think=think)
            base = replay_code(scn, None, None, think=think)
            outcomes.append(fixed.success and not base.success)
        rate = sum(outcomes) / len(outcomes) if outcomes else 0.0
        if rate >= 0.5:                                    # earliest confirmed flip = root
            return Verdict(failed=True, root_agent=agent,
                           replay_confirmed=True, confirmation_rate=rate)
    return Verdict(failed=True)                            # failed but unconfirmed
