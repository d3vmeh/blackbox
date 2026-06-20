"""Generate a labeled eval benchmark of failing agent runs.

Uses programmed fault injection (the AgenTracer technique): take ONE clean run and inject a
fault at several different steps with varied bad values, producing failing traces whose
*gold root-cause step is known*. P2 runs attribution on each; P4 scores predicted-vs-gold
(the "we beat the 14% step-attribution baseline" metric).

    python -m agent.benchmark            # writes shared/fixtures/benchmark/*.json + manifest, self-verifies

Each trace is also confirmed by real counterfactual replay, proving the labels are sound.
"""
from __future__ import annotations

import json
from pathlib import Path

from shared.schema import Trace
from .faults import inject_fault
from .run import run_agent
from .subject_agent import INTENDED_DATE

CHEAPEST = "UA-441"  # the correct (cheapest) flight under the mock tool
OUT_DIR = Path(__file__).parent.parent / "shared" / "fixtures" / "benchmark"

# Bad values per fault site. Each yields one labeled failing trace.
_BAD_DATES = [
    "2026-12-07", "2025-07-12", "2026-07-21", "2026-07-02", "2027-07-12", "2026-06-12",
    "2026-08-12", "2026-07-15", "2026-01-12", "2026-11-30", "2026-07-09", "2026-09-12",
]
_BAD_FLIGHTS = [
    "AA-218", "DL-077", "SW-512", "B6-330", "UA-999", "DL-500", "AA-777", "SW-100",
    "B6-001", "UA-222",
]
_BAD_EMAIL_DATES = [
    "2026-12-07", "2026-07-21", "2025-07-12", "2026-07-02", "2026-08-12", "2026-06-12",
    "2026-07-15", "2026-11-30",
]


def _step_id(trace: Trace, name: str) -> int:
    return next(s.id for s in trace.steps if s.name == name)


def generate_benchmark(use_real_llm: bool = False) -> list[Trace]:
    """One clean base run -> many labeled faults across three fault sites."""
    base = run_agent(
        "Find the cheapest flight to Austin departing Jul 12 under $500 and email the team.",
        use_real_llm=use_real_llm, date=INTENDED_DATE,
    )
    parse_id = _step_id(base, "parse_date")
    select_id = _step_id(base, "select_flight")
    email_id = _step_id(base, "compose_email")

    traces: list[Trace] = []

    for i, bad in enumerate(_BAD_DATES):  # root cause: parse_date
        t = inject_fault(base, parse_id, bad_output=f"departure = {bad}",
                         propagate=(INTENDED_DATE, bad),
                         final_output=f"SENT — itinerary dated {bad} (should be {INTENDED_DATE})")
        t.id = f"bench_parse_{i:02d}"
        traces.append(t)

    for i, bad in enumerate(_BAD_FLIGHTS):  # root cause: select_flight
        t = inject_fault(base, select_id,
                         bad_output=f"selected {bad} @ $999 for {INTENDED_DATE}",
                         propagate=(CHEAPEST, bad),
                         final_output=f"SENT — booked {bad} (should be {CHEAPEST})")
        t.id = f"bench_select_{i:02d}"
        traces.append(t)

    for i, bad in enumerate(_BAD_EMAIL_DATES):  # root cause: compose_email
        t = inject_fault(base, email_id,
                         bad_output=f"Subject: Austin offsite — depart {bad}, flight {CHEAPEST}.",
                         final_output=f"SENT — email says {bad} (should be {INTENDED_DATE})")
        t.id = f"bench_email_{i:02d}"
        traces.append(t)

    return traces


def main() -> None:
    from replay import confirm  # real counterfactual self-check

    traces = generate_benchmark()
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    manifest, confirmed = [], 0
    by_site: dict[str, int] = {}
    for t in traces:
        (OUT_DIR / f"{t.id}.json").write_text(t.model_dump_json(indent=2))
        gold = next(s for s in t.steps if s.id == t.gold_root_step_id)
        manifest.append({"id": t.id, "gold_root_step_id": t.gold_root_step_id,
                         "gold_root_name": gold.name})
        by_site[gold.name] = by_site.get(gold.name, 0) + 1
        # verify the label: injecting gold.correct_output should flip the outcome
        res = confirm(t, t.gold_root_step_id, gold.correct_output, n=1)
        confirmed += int(res.flipped)

    (OUT_DIR / "manifest.json").write_text(json.dumps(manifest, indent=2))

    print(f"Wrote {len(traces)} labeled failing traces -> {OUT_DIR}")
    print(f"  by root-cause site: {by_site}")
    print(f"  counterfactually confirmed: {confirmed}/{len(traces)} "
          f"(replay flips fail->pass at the gold step)")
    print("\nOK — labeled benchmark ready for P2 attribution + P4 metrics"
          if confirmed == len(traces) else "\nWARNING — some labels did not confirm; check fault sites")


if __name__ == "__main__":
    main()
