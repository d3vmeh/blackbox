"""Web tool for the subject agent.

MOCK Browserbase for now — deterministic flight results, no account needed.
Swap `mock_browserbase_search` for a real Browserbase/Stagehand session later
(same return shape) to qualify for the Browserbase track.
"""
from __future__ import annotations


def mock_browserbase_search(dest: str, date: str) -> list[dict]:
    """Return canned flight results for (dest, date). The `depart` field echoes the
    requested date so the agent's parse_date step has a real value to (mis)read."""
    return [
        {"flight": "UA-441", "depart": date, "price": 412},
        {"flight": "AA-218", "depart": date, "price": 455},
        {"flight": "DL-077", "depart": date, "price": 503},
    ]


# TODO(P1): real Browserbase web tool — drive a Stagehand session, return the same shape.
# def browserbase_search(dest, date) -> list[dict]: ...
