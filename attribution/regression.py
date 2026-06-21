"""P2 — Save regression cases and run the full benchmark suite."""
from __future__ import annotations

import asyncio
import json
from datetime import datetime
from pathlib import Path

from shared.schema import Attribution, Trace

_REGRESSION_DIR = Path("shared/fixtures/regression")


def save_regression_case(
    trace: Trace,
    attribution: Attribution,
    human_confirmed: bool = False,
    confirmed_root: str | None = None,
) -> None:
    """Persist result alongside gold label. No-op if trace has no gold label."""
    if trace.gold_root_step_id is None:
        return
    _REGRESSION_DIR.mkdir(parents=True, exist_ok=True)
    record = {
        "trace_id": trace.id,
        "expected_root": trace.gold_root_step_id,
        "predicted_root": attribution.root_step_id,
        "correct": attribution.root_step_id == trace.gold_root_step_id,
        "blast_radius": attribution.blast_radius,
        "rationale": attribution.rationale,
        "suggested_fix": attribution.suggested_fix,
        "confidence": attribution.confidence,
        "candidates": [c.model_dump() for c in attribution.candidates],
        "human_confirmed": human_confirmed,
        "confirmed_root": confirmed_root or attribution.root_step_id,
        "timestamp": datetime.utcnow().isoformat(),
        "trace": trace.model_dump(),
    }
    (_REGRESSION_DIR / f"{trace.id}.json").write_text(json.dumps(record, indent=2))


async def _run_one(fixture_path: Path, gold_root: str) -> dict:
    from attribution.localize import attribute

    data = json.loads(fixture_path.read_text())
    trace = Trace.model_validate(data)
    try:
        result = await attribute(trace)
        predicted = result.root_step_id
    except Exception as exc:
        predicted = f"ERROR: {exc}"
    return {
        "id": trace.id,
        "expected": gold_root,
        "predicted": predicted,
        "correct": predicted == gold_root,
    }


async def _run_suite_async(fixture_dir: Path) -> list[dict]:
    manifest = json.loads((fixture_dir / "manifest.json").read_text())
    # Run fixtures sequentially to respect rate limits;
    # per-step judges within each fixture still run in parallel.
    results = []
    for entry in manifest:
        r = await _run_one(
            fixture_dir / f"{entry['id']}.json",
            entry["gold_root_step_id"],
        )
        results.append(r)
    return results


def run_regression_suite(fixture_dir: str = "shared/fixtures/benchmark") -> dict:
    """Run attribute() on every fixture in the manifest and return accuracy report."""
    details = asyncio.run(_run_suite_async(Path(fixture_dir)))
    passed = sum(1 for d in details if d["correct"])
    total = len(details)
    return {
        "total": total,
        "passed": passed,
        "failed": total - passed,
        "accuracy": passed / total if total else 0.0,
        "details": details,
    }


def run_confirmed_regression_suite() -> dict:
    """Re-run attribute() on all human-confirmed cases and check against confirmed_root."""
    from attribution.localize import attribute

    if not _REGRESSION_DIR.exists():
        return {"total": 0, "passed": 0, "failed": 0, "accuracy": 0.0, "details": []}

    cases = [
        json.loads(p.read_text())
        for p in sorted(_REGRESSION_DIR.glob("*.json"))
        if json.loads(p.read_text()).get("human_confirmed") is True
    ]

    if not cases:
        return {"total": 0, "passed": 0, "failed": 0, "accuracy": 0.0, "details": []}

    async def _run_all() -> list[dict]:
        details = []
        for case in cases:
            trace = Trace.model_validate(case["trace"])
            try:
                result = await attribute(trace)
                predicted = result.root_step_id
            except Exception as exc:
                predicted = f"ERROR: {exc}"
            expected = case["confirmed_root"]
            details.append({
                "id": case["trace_id"],
                "expected": expected,
                "predicted": predicted,
                "correct": predicted == expected,
            })
        return details

    details = asyncio.run(_run_all())
    passed = sum(1 for d in details if d["correct"])
    total = len(details)
    return {
        "total": total,
        "passed": passed,
        "failed": total - passed,
        "accuracy": passed / total if total else 0.0,
        "details": details,
    }
