"""P4 — Ground-truth success check. evaluate() decides Trace.success and scores
each replay re-run. For the flight demo this is deterministic: did the agent book
the correct date (07-12) for the correct (cheapest) trip, and write that date into
the email? Keep it simple and total.

(Minimal version implemented by P1 so the agent + replay can score; P4 owns/extends it.
Agent final_output is a dict {date, flight, email_date}.)"""

from __future__ import annotations

from typing import Any

EXPECTED = {"date": "2026-07-12", "flight": "UA-441"}


def evaluate(final_output: Any, task: str = "") -> bool:
    if not isinstance(final_output, dict):
        return False
    return bool(
        final_output.get("date") == EXPECTED["date"]
        and final_output.get("flight") == EXPECTED["flight"]
        and final_output.get("email_date") == EXPECTED["date"]
    )
