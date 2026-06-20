"""P4 — File a confirmed root cause as a Sentry issue (the demo's closing beat).

Sends a structured payload (failing trace id, root step, injected fix, n,
confirmation_rate) once replay confirms. ~30 min to wire; fake-but-real. Keep it
off the critical path — it is the closer, not infrastructure."""

from __future__ import annotations

from shared.schema import Attribution, ReplayResult


def file_issue(attribution: Attribution, replay: ReplayResult) -> str:
    """Return the created Sentry issue URL/id."""
    raise NotImplementedError("P4: sentry_sdk capture with structured root-cause payload")
