"""Full Arize AX workshop pipeline for Blackbox AP demo.

Workshop parity (adapted to AP, not financial chatbot):
  1. Export traces to AX
  2. Code eval (payment_oracle)
  3. Built-in LLM eval (CorrectnessEvaluator)
  4. Custom LLM rubric (payment_integrity)
  5. Log all scores to AX (visible on Evaluations tab)
  6. Meta-eval (oracle vs LLM judges)
  7. Experiment report (ap_live vs ap_healed)

Usage:
    python -m eval.arize_pipeline              # export demo + suite + eval + report
    python -m eval.arize_pipeline --demo-only  # ap_live + ap_healed only
    python -m eval.arize_pipeline --eval-only  # skip export, eval existing spans
"""
from __future__ import annotations

import argparse
import os
import time
from datetime import datetime, timedelta, timezone

from dotenv import load_dotenv

from agent import ap_graph
from agent.ap_scenarios import DEFAULT, SCENARIOS
from agent.monitor import auto_heal, investigate
from agent.otel import emit_trace
from agent.run_ap import _scenario_meta
from agent import tracing


def _require_env(*keys: str) -> None:
    missing = [k for k in keys if not os.environ.get(k)]
    if missing:
        raise SystemExit(f"Set in .env: {', '.join(missing)}")


def export_demo_traces() -> None:
    """ap_live (FAIL) + ap_healed (PASS) — the booth story pair."""
    scn = DEFAULT
    trace = ap_graph.run_ap(scn, timed=False, trace_id="ap_live")
    v = investigate(trace, scn, n=5)
    healed = auto_heal(v, scn) if v.failed else None

    tracing.setup_tracing()
    meta = _scenario_meta(scn, v if v.failed else None)
    emit_trace(trace, backend="arize", monitor=meta)
    if healed is not None:
        emit_trace(healed, backend="arize", monitor=_scenario_meta(scn, v, healed=True))
    tracing.flush_tracing()
    print("[export] demo: ap_live + ap_healed")


def export_suite_traces() -> None:
    """One trace per labeled scenario — error-analysis dataset (workshop Step 3)."""
    tracing.setup_tracing()
    for scn in SCENARIOS:
        trace = ap_graph.run_ap(scn, trace_id=f"ap_{scn.name}")
        meta = _scenario_meta(scn)
        emit_trace(trace, backend="arize", monitor=meta)
    tracing.flush_tracing()
    print(f"[export] suite: {len(SCENARIOS)} scenario traces (ap_<name>)")


def fetch_parent_spans(*, space_id: str, project_name: str, hours: int = 6):
    from arize import ArizeClient

    from eval.arize_evals import normalize_parent_spans

    client = ArizeClient(api_key=os.environ["ARIZE_API_KEY"])
    end = datetime.now(timezone.utc)
    start = end - timedelta(hours=hours)
    spans_df = client.spans.export_to_df(
        space_id=space_id,
        project_name=project_name,
        start_time=start,
        end_time=end,
    )
    parent = normalize_parent_spans(spans_df)
    # AP demo traces only
    name_col = "name" if "name" in parent.columns else "attributes.name"
    if name_col in parent.columns:
        mask = parent[name_col].astype(str).str.startswith("ap_")
        parent = parent[mask].copy()
        # Keep newest row per trace name (re-exports create duplicates)
        if "start_time" in parent.columns:
            parent = parent.sort_values("start_time").drop_duplicates(subset=[name_col], keep="last")
    print(f"[fetch] {len(parent)} AP root spans from {project_name}")
    return client, parent


def run_pipeline(*, demo_only: bool = False, eval_only: bool = False, skip_llm: bool = False) -> None:
    load_dotenv()
    _require_env("ARIZE_SPACE_ID", "ARIZE_API_KEY")
    project = os.environ.get("ARIZE_PROJECT_NAME", "fuse-breaker")
    space_id = os.environ["ARIZE_SPACE_ID"]

    if not eval_only:
        if demo_only:
            export_demo_traces()
        else:
            export_demo_traces()
            export_suite_traces()
        print("[export] waiting 8s for AX ingestion...")
        time.sleep(8)

    from eval.arize_evals import (
        experiment_report,
        log_eval_to_ax,
        meta_eval_report,
        run_eval_suite,
    )

    client, parent = fetch_parent_spans(space_id=space_id, project_name=project)
    if parent.empty:
        raise SystemExit("No AP spans in AX — run export first or widen time window.")

    results = run_eval_suite(parent, run_llm=not skip_llm)

    for eval_name, res_df in results.items():
        log_eval_to_ax(client, space_id=space_id, project_name=project,
                       eval_results_df=res_df, eval_name=eval_name)

    meta_eval_report(parent, results)
    experiment_report(parent, results)

    print("\n" + "=" * 72)
    print(f"Done — open https://app.arize.com → project {project!r}")
    print("  Traces tab: ap_live / ap_healed / ap_<scenario>")
    print("  Click any trace → Evaluations: payment_oracle, payment_correctness, payment_integrity")
    print("=" * 72)


def main() -> None:
    p = argparse.ArgumentParser(description="Blackbox Arize AX eval pipeline")
    p.add_argument("--demo-only", action="store_true", help="export only ap_live + ap_healed")
    p.add_argument("--eval-only", action="store_true", help="skip export; eval spans already in AX")
    p.add_argument("--skip-llm", action="store_true", help="code eval only (no Anthropic calls)")
    args = p.parse_args()
    run_pipeline(demo_only=args.demo_only, eval_only=args.eval_only, skip_llm=args.skip_llm)


if __name__ == "__main__":
    main()
