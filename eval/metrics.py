"""P4 — Localization accuracy of attribute() against labelled fixtures (did we
pick the true root step?). Keeps us honest about the hard part."""

from __future__ import annotations

from shared.schema import Attribution


def localization_hit(attr: Attribution, true_root_step_id: str) -> bool:
    return attr.root_step_id == true_root_step_id
