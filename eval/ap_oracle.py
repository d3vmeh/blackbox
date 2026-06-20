"""P1 — Ground-truth check for the Accounts-Payable subject (additive; sits beside P4's
oracle.py, does not modify it). evaluate_ap() decides whether the agent system paid the
RIGHT vendor the RIGHT amount by the RIGHT due date. Deterministic and total."""

from __future__ import annotations

from typing import Any

# The one correct outcome for invoice PO-7781.
EXPECTED = {"vendor": "Acme Corp", "amount": 4200.00, "due_date": "2026-07-15"}


def evaluate_ap(final_output: Any) -> bool:
    if not isinstance(final_output, dict):
        return False
    return bool(
        final_output.get("status") == "paid"
        and final_output.get("vendor") == EXPECTED["vendor"]
        and final_output.get("due_date") == EXPECTED["due_date"]
        and abs(float(final_output.get("amount_paid", 0.0)) - EXPECTED["amount"]) < 0.005
    )
