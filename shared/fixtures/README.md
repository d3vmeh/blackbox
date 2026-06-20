# Fixtures

`flight_fail.json` — a hand-recorded **failing** `Trace` (conforms to
`shared/schema.py`). This is the **source of truth** for the whole build: P1
(replay), P2 (attribution), P3 (UI), and P4 (API) all develop against it BEFORE
the live agent exists, and it stays the fallback demo path afterward.

Properties the fixture must have:
- ~30 steps, with the root cause at an **early** step: the agent misreads
  `07-12` as `Dec 7`.
- `parents` are **true data-flow edges** — the misread-date output must actually
  flow forward into the booking steps, so the forward slice (blast radius) is real.
- Each `Step.state` is a JSON-serializable snapshot sufficient to fork/replay.
- `final_output` is confidently wrong; `success` is `false`.
- Includes a plausible-but-wrong decoy step so the demo can show a candidate
  being **rejected** by replay before the true root is confirmed.

> Not yet generated. Next deliverable — see ARCHITECTURE.md §Build order.
