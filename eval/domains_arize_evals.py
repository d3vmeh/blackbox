"""Arize AX evaluators for the four demo domains (not legacy AP).

  - domain_oracle          code eval — pipeline oracle on final output
  - primary_fault_agent    code eval — localized fork matches manifest primary fault
  - replay_flipped         code eval — healed trace passes oracle; fail trace does not

Optional LLM (requires ANTHROPIC_API_KEY):
  - clinical_grounding     rubric for prior_auth traces only
"""
from __future__ import annotations

import json
import os
from typing import Any

import pandas as pd
from openinference.instrumentation import suppress_tracing
from phoenix.evals import ClassificationEvaluator, create_evaluator, evaluate_dataframe
from phoenix.evals.llm import LLM

from agent.domains.pipelines import get_spec
from shared.scenarios.manifest import BY_ID, DOMAINS

from eval.arize_evals import log_eval_to_ax, normalize_parent_spans


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


def _output_dict(out: Any) -> dict | None:
    parsed = _parse_json(out)
    return parsed if isinstance(parsed, dict) else None


_TRACE_TO_DOMAIN: dict[str, str] = {}
for _d in DOMAINS:
    _TRACE_TO_DOMAIN[_d.arize.fail_trace_id] = _d.id
    _TRACE_TO_DOMAIN[_d.arize.healed_trace_id] = _d.id


def _meta_from_input(inp: Any) -> dict:
    parsed = _parse_json(inp)
    return parsed if isinstance(parsed, dict) else {}


def _domain_id(meta: dict, inp: Any) -> str | None:
    did = meta.get("domain_id")
    if did:
        return str(did)
    trace = meta.get("trace_name")
    if trace:
        return _TRACE_TO_DOMAIN.get(str(trace))
    if isinstance(inp, str):
        return _TRACE_TO_DOMAIN.get(inp.strip())
    return None


@create_evaluator(name="domain_oracle", kind="code")
def domain_oracle(input, output):
    meta = _meta_from_input(input)
    domain_id = _domain_id(meta, input)
    if domain_id is None:
        return {"label": "unknown", "score": 0, "explanation": "could not resolve domain_id"}

    out = _output_dict(output)
    if out is None:
        return {"label": "unknown", "score": 0, "explanation": "missing output JSON"}

    ok = get_spec(domain_id).oracle(out)
    domain = BY_ID[domain_id]
    if ok:
        return {"label": "correct", "score": 1}
    return {
        "label": "incorrect",
        "score": 0,
        "explanation": domain.primary_fault.symptom,
    }


@create_evaluator(name="primary_fault_agent", kind="code")
def primary_fault_agent(input, output):
    meta = _meta_from_input(input)
    domain_id = _domain_id(meta, input)
    if not domain_id:
        return {"label": "unknown", "score": 0, "explanation": "unknown domain"}
    fork = meta.get("fork_agent")
    expected = BY_ID[domain_id].primary_fault.agent
    if fork == expected:
        return {"label": "correct", "score": 1}
    return {
        "label": "incorrect",
        "score": 0,
        "explanation": f"expected fork at {expected!r}, got {fork!r}",
    }


@create_evaluator(name="replay_flipped", kind="code")
def replay_flipped(input, output):
    meta = _meta_from_input(input)
    domain_id = _domain_id(meta, input)
    if not domain_id:
        return {"label": "unknown", "score": 0, "explanation": "unknown domain"}

    name = str(meta.get("trace_name", ""))
    is_healed = meta.get("healed") is True or name.endswith("_healed")
    out = _output_dict(output)
    if out is None:
        return {"label": "unknown", "score": 0, "explanation": "missing output JSON"}

    ok = get_spec(domain_id).oracle(out)
    if is_healed:
        return {"label": "correct", "score": 1} if ok else {
            "label": "incorrect",
            "score": 0,
            "explanation": "healed trace should pass domain oracle",
        }
    return {"label": "correct", "score": 1} if not ok else {
        "label": "incorrect",
        "score": 0,
        "explanation": "fail trace should not pass oracle before heal",
    }


CLINICAL_GROUNDING_TEMPLATE = """
You are a clinical prior-authorization reviewer. Judge whether the payer outcome
is clinically grounded in the chart facts implied by the trace output.

CORRECT — approval/denial aligns with documented diagnosis, prior treatments, and
payer medical-necessity rules (e.g. 90-day conservative therapy interval).

INCORRECT — denial or approval contradicts chart facts or guideline logic.

<trace_context>
{input}
</trace_context>

<submission_result>
{output}
</submission_result>

Respond with exactly one label: correct or incorrect.
"""


def build_clinical_llm_evaluator() -> ClassificationEvaluator | None:
    if not os.environ.get("ANTHROPIC_API_KEY"):
        return None
    llm = LLM(provider="anthropic", model="claude-sonnet-4-5")
    return ClassificationEvaluator(
        name="clinical_grounding",
        llm=llm,
        prompt_template=CLINICAL_GROUNDING_TEMPLATE,
        choices={"correct": 1.0, "incorrect": 0.0},
    )


def _trace_name(row: pd.Series) -> str:
    for col in ("name", "attributes.name"):
        if col in row.index and pd.notna(row[col]):
            return str(row[col])
    return ""


def _attr(row: pd.Series, key: str) -> Any:
    for col in (f"attributes.blackbox.{key}", f"blackbox.{key}"):
        if col in row.index and pd.notna(row[col]):
            return row[col]
    return None


def enrich_parent_spans(parent_spans: pd.DataFrame) -> pd.DataFrame:
    """Merge span attrs into input JSON so code evaluators can read domain context."""
    df = parent_spans.copy()
    inputs: list[str] = []
    for _, row in df.iterrows():
        base = _parse_json(row.get("input"))
        trace = _trace_name(row)
        meta = {
            "domain_id": _attr(row, "domain_id") or _TRACE_TO_DOMAIN.get(trace),
            "fork_agent": _attr(row, "fork_agent"),
            "healed": _attr(row, "healed"),
            "trace_name": trace,
        }
        if isinstance(base, dict):
            payload = {**base, **meta}
        else:
            payload = {"task": base, **meta}
        inputs.append(json.dumps(payload))
    df["input"] = inputs
    return df


def run_domain_eval_suite(parent_spans: pd.DataFrame, *, run_llm: bool = True) -> dict[str, pd.DataFrame]:
    if parent_spans.empty:
        raise ValueError("no parent spans to evaluate")

    df = enrich_parent_spans(parent_spans)
    results: dict[str, pd.DataFrame] = {}

    with suppress_tracing():
        results["domain_oracle"] = evaluate_dataframe(dataframe=df, evaluators=[domain_oracle])
        results["primary_fault_agent"] = evaluate_dataframe(
            dataframe=df, evaluators=[primary_fault_agent]
        )
        results["replay_flipped"] = evaluate_dataframe(dataframe=df, evaluators=[replay_flipped])

        if run_llm:
            clinical = build_clinical_llm_evaluator()
            if clinical:
                pa_mask = df["input"].str.contains('"domain_id": "prior_auth"', na=False)
                pa_df = df.loc[pa_mask].copy()
                if not pa_df.empty:
                    results["clinical_grounding"] = evaluate_dataframe(
                        dataframe=pa_df, evaluators=[clinical]
                    )
            else:
                print("[arize] skipping clinical_grounding — set ANTHROPIC_API_KEY")

    return results


def _labels_from_results(results: pd.DataFrame, eval_name: str) -> pd.Series:
    col = f"{eval_name}_score"
    if col not in results.columns:
        return pd.Series(dtype=str)
    normalized = pd.json_normalize(results[col])
    return normalized["label"] if "label" in normalized.columns else pd.Series(dtype=str)


def domain_experiment_report(parent_spans: pd.DataFrame, results: dict[str, pd.DataFrame]) -> None:
    oracle_res = results.get("domain_oracle")
    if oracle_res is None:
        return
    labels = _labels_from_results(oracle_res, "domain_oracle")
    names = parent_spans.get("name", parent_spans.get("attributes.name", pd.Series(dtype=str)))

    by_name: dict[str, str] = {}
    for i, lbl in enumerate(labels):
        nm = str(names.iloc[i]) if i < len(names) else ""
        by_name[nm] = lbl

    print("\n" + "=" * 72)
    print("EXPERIMENT — four domains FAIL → healed pairs")
    print("=" * 72)
    for domain in DOMAINS:
        fail_id = domain.arize.fail_trace_id
        heal_id = domain.arize.healed_trace_id
        print(
            f"  {domain.id:<22} {fail_id}={by_name.get(fail_id, '—'):<10} "
            f"{heal_id}={by_name.get(heal_id, '—')}"
        )


__all__ = [
    "normalize_parent_spans",
    "log_eval_to_ax",
    "run_domain_eval_suite",
    "domain_experiment_report",
]
