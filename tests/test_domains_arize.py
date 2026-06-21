"""Tests for four-domain Arize export + code evaluators (no network)."""
from __future__ import annotations

import json

import pandas as pd

from agent.domains.arize_export import emit_domain_pair
from eval.domains_arize_evals import (
    domain_oracle,
    enrich_parent_spans,
    primary_fault_agent,
    replay_flipped,
    run_domain_eval_suite,
)
from shared.scenarios.manifest import DOMAINS


def test_emit_domain_pair_returns_fail_and_healed():
    for domain in DOMAINS:
        ids = emit_domain_pair(domain.id)
        assert domain.arize.fail_trace_id in ids
        assert domain.arize.healed_trace_id in ids
        assert len(ids) == 2


def test_code_evaluators_on_synthetic_spans():
    domain = DOMAINS[0]
    fail_out = {"status": "paid", "payout_amount": 52000.0}  # wrong — intake fault
    heal_out = {"status": "paid", "payout_amount": 5200.0}

    rows = []
    for trace_id, out, healed in (
        (domain.arize.fail_trace_id, fail_out, False),
        (domain.arize.healed_trace_id, heal_out, True),
    ):
        inp = json.dumps({
            "domain_id": domain.id,
            "fork_agent": domain.primary_fault.agent,
            "healed": healed,
            "trace_name": trace_id,
        })
        rows.append({
            "name": trace_id,
            "input": inp,
            "output": json.dumps(out),
            f"attributes.blackbox.domain_id": domain.id,
            f"attributes.blackbox.fork_agent": domain.primary_fault.agent,
            f"attributes.blackbox.healed": healed,
        })

    parent = pd.DataFrame(rows)
    enriched = enrich_parent_spans(parent)

    fail_row = enriched.iloc[0]
    heal_row = enriched.iloc[1]
    assert domain_oracle(fail_row["input"], fail_row["output"])["label"] == "incorrect"
    assert domain_oracle(heal_row["input"], heal_row["output"])["label"] == "correct"
    assert primary_fault_agent(fail_row["input"], fail_row["output"])["label"] == "correct"
    assert replay_flipped(fail_row["input"], fail_row["output"])["label"] == "correct"
    assert replay_flipped(heal_row["input"], heal_row["output"])["label"] == "correct"

    results = run_domain_eval_suite(parent, run_llm=False)
    assert "domain_oracle" in results
    assert len(results["domain_oracle"]) == 2
