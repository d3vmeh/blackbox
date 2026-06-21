"""Generate a labeled eval benchmark of failing agent runs (P1 -> P2/P4).

One clean run + programmed fault injection at three different steps with varied bad values,
producing failing traces whose gold root-cause step is known. P2 runs attribution on each;
P4 scores predicted-vs-gold. Each trace is confirmed by real replay, proving the labels.

    python -m agent.benchmark   # writes shared/fixtures/benchmark/*.json + manifest, self-verifies
"""
from __future__ import annotations

import json
from pathlib import Path

from shared.schema import Trace
from .faults import inject_fault
from .graph import INTENDED_DATE, run_agent

CHEAPEST = "UA-441"
OUT_DIR = Path(__file__).parent.parent / "shared" / "fixtures" / "benchmark"

_BAD_DATES = ["2026-12-07", "2025-07-12", "2026-07-21", "2026-07-02", "2027-07-12", "2026-06-12",
              "2026-08-12", "2026-07-15", "2026-01-12", "2026-11-30", "2026-07-09", "2026-09-12"]
_BAD_FLIGHTS = ["AA-218", "DL-077", "SW-512", "B6-330", "UA-999", "DL-500", "AA-777", "SW-100",
                "B6-001", "UA-222"]
_BAD_EMAIL = ["2026-12-07", "2026-07-21", "2025-07-12", "2026-07-02", "2026-08-12", "2026-06-12",
              "2026-07-15", "2026-11-30"]


def _sid(trace: Trace, node: str) -> str:
    return next(s.id for s in trace.steps if s.raw.get("node") == node)


def generate(use_real_llm: bool = False) -> list[Trace]:
    base = run_agent(use_real_llm=use_real_llm)
    parse_id, select_id, email_id = _sid(base, "parse_date"), _sid(base, "select_flight"), _sid(base, "compose_email")
    traces: list[Trace] = []

    for i, bad in enumerate(_BAD_DATES):
        t = inject_fault(base, parse_id, bad_output=f"departure = {bad}",
                         propagate=(INTENDED_DATE, bad),
                         final_output={"date": bad, "flight": CHEAPEST, "email_date": bad})
        t.id = f"bench_parse_{i:02d}"
        traces.append(t)

    for i, bad in enumerate(_BAD_FLIGHTS):
        t = inject_fault(base, select_id, bad_output=f"selected {bad} @ $999 for {INTENDED_DATE}",
                         propagate=(CHEAPEST, bad),
                         final_output={"date": INTENDED_DATE, "flight": bad, "email_date": INTENDED_DATE})
        t.id = f"bench_select_{i:02d}"
        traces.append(t)

    for i, bad in enumerate(_BAD_EMAIL):
        t = inject_fault(base, email_id, bad_output=f"Subject: Austin offsite — depart {bad}, flight {CHEAPEST}.",
                         final_output={"date": INTENDED_DATE, "flight": CHEAPEST, "email_date": bad})
        t.id = f"bench_email_{i:02d}"
        traces.append(t)

    return traces


def main() -> None:
    from replay.replay import replay

    traces = generate()
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    manifest, confirmed, by_node = [], 0, {}
    for t in traces:
        (OUT_DIR / f"{t.id}.json").write_text(t.model_dump_json(indent=2))
        gold = next(s for s in t.steps if s.id == t.gold_root_step_id)
        node = gold.raw.get("node")
        manifest.append({"id": t.id, "gold_root_step_id": t.gold_root_step_id, "gold_root_node": node})
        by_node[node] = by_node.get(node, 0) + 1
        confirmed += int(replay(t, t.gold_root_step_id, gold.correct_output, n=1).flipped)

    (OUT_DIR / "manifest.json").write_text(json.dumps(manifest, indent=2))
    print(f"Wrote {len(traces)} labeled failing traces -> {OUT_DIR}")
    print(f"  by root-cause node: {by_node}")
    print(f"  counterfactually confirmed: {confirmed}/{len(traces)}")
    print("OK — labeled benchmark ready for P2 attribution + P4 metrics"
          if confirmed == len(traces) else "WARNING — some labels did not confirm")


if __name__ == "__main__":
    main()
