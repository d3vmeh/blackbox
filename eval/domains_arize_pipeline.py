"""Arize AX pipeline for the four demo domains (claim, prior auth, procurement, SOC).

Not the legacy AP amount pipeline — use eval/arize_pipeline.py for that.

Usage:
    python -m eval.domains_arize_pipeline              # export 4× fail/healed + eval
    python -m eval.domains_arize_pipeline --eval-only  # eval spans already in AX
    python -m eval.domains_arize_pipeline --skip-llm   # code evaluators only
"""
from __future__ import annotations

import argparse
import os
import time
from datetime import datetime, timedelta, timezone

from dotenv import load_dotenv

from agent.domains.arize_export import emit_all_domains
from shared.scenarios.manifest import DOMAINS


def _require_env(*keys: str) -> None:
    missing = [k for k in keys if not os.environ.get(k)]
    if missing:
        raise SystemExit(f"Set in .env: {', '.join(missing)}")


def _domain_trace_ids() -> tuple[str, ...]:
    ids: list[str] = []
    for d in DOMAINS:
        ids.append(d.arize.fail_trace_id)
        ids.append(d.arize.healed_trace_id)
    return tuple(ids)


def fetch_domain_parent_spans(*, space_id: str, project_name: str, hours: int = 6):
    from arize import ArizeClient

    from eval.domains_arize_evals import normalize_parent_spans

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
    name_col = "name" if "name" in parent.columns else "attributes.name"
    if name_col in parent.columns:
        allowed = set(_domain_trace_ids())
        mask = parent[name_col].astype(str).isin(allowed)
        parent = parent[mask].copy()
        if "start_time" in parent.columns:
            parent = parent.sort_values("start_time").drop_duplicates(subset=[name_col], keep="last")
    print(f"[fetch] {len(parent)} domain root spans from {project_name}")
    return client, parent


def run_pipeline(*, eval_only: bool = False, skip_llm: bool = False) -> None:
    load_dotenv()
    _require_env("ARIZE_SPACE_ID", "ARIZE_API_KEY")
    project = os.environ.get("ARIZE_PROJECT_NAME", "blackbox")
    space_id = os.environ["ARIZE_SPACE_ID"]

    if not eval_only:
        emit_all_domains()
        print("[export] waiting 8s for AX ingestion...")
        time.sleep(8)

    from eval.domains_arize_evals import (
        domain_experiment_report,
        log_eval_to_ax,
        run_domain_eval_suite,
    )

    client, parent = fetch_domain_parent_spans(space_id=space_id, project_name=project)
    if parent.empty:
        raise SystemExit(
            "No domain spans in AX — run export first or set ARIZE_PROJECT_NAME to match export."
        )

    results = run_domain_eval_suite(parent, run_llm=not skip_llm)

    for eval_name, res_df in results.items():
        log_eval_to_ax(
            client,
            space_id=space_id,
            project_name=project,
            eval_results_df=res_df,
            eval_name=eval_name,
        )

    domain_experiment_report(parent, results)

    trace_list = ", ".join(_domain_trace_ids())
    print("\n" + "=" * 72)
    print(f"Done — open https://app.arize.com → project {project!r}")
    print(f"  Traces: {trace_list}")
    print("  Evaluations: domain_oracle, primary_fault_agent, replay_flipped")
    if not skip_llm:
        print("  (+ clinical_grounding on prior_auth when ANTHROPIC_API_KEY set)")
    print("=" * 72)


def main() -> None:
    p = argparse.ArgumentParser(description="Blackbox four-domain Arize AX pipeline")
    p.add_argument("--eval-only", action="store_true", help="skip export; eval spans already in AX")
    p.add_argument("--skip-llm", action="store_true", help="code evaluators only")
    args = p.parse_args()
    run_pipeline(eval_only=args.eval_only, skip_llm=args.skip_llm)


if __name__ == "__main__":
    main()
