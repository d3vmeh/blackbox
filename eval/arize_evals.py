"""Arize AX evaluation helpers — notebook-parity eval stack for the AP demo.

Mirrors the Cal Hacks workshop flow (code eval → built-in LLM → custom rubric →
log scores to AX → meta-eval vs oracle):

  - payment_oracle        code eval (deterministic ground truth)
  - payment_correctness   built-in CorrectnessEvaluator (LLM-as-judge)
  - payment_integrity     custom ClassificationEvaluator rubric (domain-specific)
"""
from __future__ import annotations

import json
import os
from typing import Any

import pandas as pd
from openinference.instrumentation import suppress_tracing
from phoenix.evals import ClassificationEvaluator, create_evaluator, evaluate_dataframe
from phoenix.evals.llm import LLM
from phoenix.evals.metrics import CorrectnessEvaluator
from phoenix.evals.utils import to_annotation_dataframe

from eval.ap_oracle import evaluate_ap


def _parse_json(value: Any) -> Any:
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return None
    if isinstance(value, (dict, list)):
        return value
    if isinstance(value, str):
        value = value.strip()
        if not value:
            return None
        try:
            return json.loads(value)
        except json.JSONDecodeError:
            return value
    return value


def _expected_from_input(inp: Any) -> dict | None:
    parsed = _parse_json(inp)
    name: str | None = None
    if isinstance(parsed, dict):
        exp = parsed.get("expected")
        if isinstance(exp, dict):
            return exp
        name = parsed.get("scenario")
    elif isinstance(parsed, str):
        name = parsed.strip()
    if name:
        from agent.ap_scenarios import SCENARIOS

        for scn in SCENARIOS:
            if scn.name == name:
                return {
                    "vendor": scn.vendor,
                    "amount": scn.amount,
                    "due_date": scn.due_date,
                    "po": scn.po,
                    "expect": scn.expect,
                }
    return None


def _payment_from_output(out: Any) -> dict | None:
    parsed = _parse_json(out)
    return parsed if isinstance(parsed, dict) else None


def _scenario_from_input(inp: Any) -> str:
    parsed = _parse_json(inp)
    if isinstance(parsed, dict) and parsed.get("scenario"):
        return str(parsed["scenario"])
    return str(inp)[:80] if inp else "unknown"


@create_evaluator(name="payment_oracle", kind="code")
def payment_oracle(input, output):
    """Code eval: deterministic AP oracle — same ground truth as run_ap_suite."""
    payment = _payment_from_output(output)
    expected = _expected_from_input(input)
    if payment is None or expected is None:
        return {"label": "unknown", "score": 0, "explanation": "missing input.expected or output JSON"}

    # Build a minimal scenario-like object for evaluate_ap
    class _Scn:
        pass

    scn = _Scn()
    scn.vendor = expected.get("vendor")
    scn.amount = float(expected.get("amount", 0))
    scn.due_date = expected.get("due_date")
    scn.expect = expected.get("expect", "paid")

    ok = evaluate_ap(payment, scn)
    if ok:
        return {"label": "correct", "score": 1}
    paid = payment.get("amount_paid", payment.get("amount"))
    return {
        "label": "incorrect",
        "score": 0,
        "explanation": (
            f"expected {scn.expect} ${scn.amount:,.2f} to {scn.vendor}; "
            f"got status={payment.get('status')} amount_paid={paid}"
        ),
    }


PAYMENT_INTEGRITY_TEMPLATE = """
You are an accounts-payable auditor evaluating a multi-agent invoice payment pipeline.

CORRECT — the payment JSON matches the invoice: right vendor, amount, due date, and
status (paid vs blocked) for what the invoice requires.

INCORRECT — wrong amount paid, wrong vendor, wrong date, paid when should be blocked,
or blocked when should be paid.

<invoice_context>
{input}
</invoice_context>

<payment_result>
{output}
</payment_result>

Respond with exactly one label: correct or incorrect.
"""


def build_llm_evaluators():
    """Built-in + custom LLM judges (requires ANTHROPIC_API_KEY in env)."""
    if not os.environ.get("ANTHROPIC_API_KEY"):
        return None, None
    llm = LLM(provider="anthropic", model="claude-sonnet-4-5")
    correctness = CorrectnessEvaluator(llm=llm)
    integrity = ClassificationEvaluator(
        name="payment_integrity",
        llm=llm,
        prompt_template=PAYMENT_INTEGRITY_TEMPLATE,
        choices={"correct": 1.0, "incorrect": 0.0},
    )
    return correctness, integrity


def normalize_parent_spans(spans_df: pd.DataFrame) -> pd.DataFrame:
    """Top-level CHAIN spans with input/output columns for phoenix.evals."""
    parent = spans_df[spans_df["parent_id"].isna()].copy()
    if "input" not in parent.columns and "attributes.input.value" in parent.columns:
        parent = parent.rename(columns={"attributes.input.value": "input"})
    if "output" not in parent.columns and "attributes.output.value" in parent.columns:
        parent = parent.rename(columns={"attributes.output.value": "output"})
    parent = parent.loc[:, ~parent.columns.duplicated()]
    return parent


def log_eval_to_ax(client, *, space_id: str, project_name: str, eval_results_df: pd.DataFrame, eval_name: str):
    """Push phoenix.evals results onto spans in Arize AX (workshop Step 5+ pattern)."""
    annotations = to_annotation_dataframe(dataframe=eval_results_df)
    annotations = annotations.rename(columns={
        "label": f"eval.{eval_name}.label",
        "score": f"eval.{eval_name}.score",
        "explanation": f"eval.{eval_name}.explanation",
    })
    for col in ("name", "metadata", "annotation_name", "annotator_kind"):
        if col in annotations.columns:
            annotations = annotations.drop(columns=[col])
    expl_col = f"eval.{eval_name}.explanation"
    if expl_col in annotations.columns:
        annotations[expl_col] = annotations[expl_col].fillna("").astype(str)
    if annotations.index.name == "context.span_id":
        annotations = annotations.reset_index()
    client.spans.update_evaluations(
        space_id=space_id,
        project_name=project_name,
        dataframe=annotations,
    )
    print(f"[arize] logged {len(annotations)} {eval_name} evaluations -> {project_name}")


def run_eval_suite(parent_spans: pd.DataFrame, *, run_llm: bool = True) -> dict[str, pd.DataFrame]:
    """Run code + optional LLM evals; returns {eval_name: results_df}."""
    if parent_spans.empty:
        raise ValueError("no parent spans to evaluate")

    df = parent_spans.copy()
    results: dict[str, pd.DataFrame] = {}

    with suppress_tracing():
        results["payment_oracle"] = evaluate_dataframe(dataframe=df, evaluators=[payment_oracle])

        if run_llm:
            correctness, integrity = build_llm_evaluators()
            if correctness and integrity:
                results["payment_correctness"] = evaluate_dataframe(
                    dataframe=df, evaluators=[correctness]
                )
                results["payment_integrity"] = evaluate_dataframe(
                    dataframe=df, evaluators=[integrity]
                )
            else:
                print("[arize] skipping LLM evals — set ANTHROPIC_API_KEY")

    return results


def _labels_from_results(results: pd.DataFrame, eval_name: str) -> pd.Series:
    col = f"{eval_name}_score"
    if col not in results.columns:
        return pd.Series(dtype=str)
    normalized = pd.json_normalize(results[col])
    return normalized["label"] if "label" in normalized.columns else pd.Series(dtype=str)


def meta_eval_report(parent_spans: pd.DataFrame, results: dict[str, pd.DataFrame]) -> None:
    """Meta-eval: treat code oracle as ground truth; measure LLM judge agreement."""
    oracle_res = results.get("payment_oracle")
    if oracle_res is None:
        return
    oracle_labels = _labels_from_results(oracle_res, "payment_oracle")
    if oracle_labels.empty:
        return

    print("\n" + "=" * 72)
    print("META-EVAL — code oracle (ground truth) vs LLM judges")
    print("=" * 72)

    for llm_name in ("payment_correctness", "payment_integrity"):
        if llm_name not in results:
            continue
        judge_labels = _labels_from_results(results[llm_name], llm_name)
        n = min(len(oracle_labels), len(judge_labels))
        agree = sum(oracle_labels.iloc[i] == judge_labels.iloc[i] for i in range(n))
        print(f"  {llm_name:<22} agreement with oracle: {agree}/{n} ({agree / n:.0%})" if n else f"  {llm_name}: no rows")

    print("\nPer-trace oracle vs custom integrity:")
    integrity_res = results.get("payment_integrity")
    if integrity_res is not None:
        integrity_labels = _labels_from_results(integrity_res, "payment_integrity")
        names = parent_spans.get("name", parent_spans.get("attributes.name", pd.Series(index=parent_spans.index)))
        for i in range(min(len(oracle_labels), len(integrity_labels))):
            trace_name = names.iloc[i] if i < len(names) else f"row_{i}"
            mark = "✓" if oracle_labels.iloc[i] == integrity_labels.iloc[i] else "✗"
            print(f"  {str(trace_name):<20} oracle={oracle_labels.iloc[i]:<10} judge={integrity_labels.iloc[i]:<10} {mark}")


def experiment_report(parent_spans: pd.DataFrame, results: dict[str, pd.DataFrame]) -> None:
    """Before/after experiment: ap_live (broken) vs ap_healed (self-heal)."""
    oracle_res = results.get("payment_oracle")
    if oracle_res is None:
        return
    labels = _labels_from_results(oracle_res, "payment_oracle")
    names = parent_spans.get("name", parent_spans.get("attributes.name", pd.Series(dtype=str)))

    print("\n" + "=" * 72)
    print("EXPERIMENT — eval feedback drove Blackbox self-heal")
    print("=" * 72)

    by_name: dict[str, str] = {}
    for i, lbl in enumerate(labels):
        nm = str(names.iloc[i]) if i < len(names) else ""
        by_name[nm] = lbl

    live = by_name.get("ap_live")
    healed = by_name.get("ap_healed")
    print(f"  ap_live (unprotected)  oracle={live or '—'}")
    print(f"  ap_healed (self-heal)  oracle={healed or '—'}")
    if live == "incorrect" and healed == "correct":
        print("\n  → FAIL→PASS: eval flagged bad payment; monitor healed; oracle confirms fix.")
        print("  → Booth story: trace → eval → Blackbox localize/replay/heal → re-eval pass.")
    elif live and healed:
        print(f"\n  → Compare traces in AX UI for full eval explanations.")

    fail_count = sum(1 for v in labels if v == "incorrect")
    pass_count = sum(1 for v in labels if v == "correct")
    print(f"\n  Suite summary: {pass_count} correct / {fail_count} incorrect / {len(labels)} traces")
