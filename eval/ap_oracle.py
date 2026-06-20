"""P1 — Ground-truth check for the Accounts-Payable subject (additive; sits beside P4's
oracle.py, does not modify it). evaluate_ap() decides whether the agent system produced
the CORRECT outcome for the scenario: pay the right vendor/amount/date, OR correctly
block an over-limit / untrusted invoice. Deterministic."""

from __future__ import annotations

from typing import Any, Optional


def evaluate_ap(final_output: Any, scenario: Optional[Any] = None) -> bool:
    """True iff the outcome matches what the scenario SHOULD have done.
    `scenario` is an ap_scenarios.Scenario; if omitted, falls back to the default invoice."""
    if scenario is None:
        from agent.ap_scenarios import DEFAULT as scenario
    if not isinstance(final_output, dict):
        return False

    if getattr(scenario, "expect", "paid") == "blocked":
        return final_output.get("status") == "blocked"

    return bool(
        final_output.get("status") == "paid"
        and final_output.get("vendor") == scenario.vendor
        and final_output.get("due_date") == scenario.due_date
        and abs(float(final_output.get("amount_paid", 0.0)) - scenario.amount) < 0.005
    )
