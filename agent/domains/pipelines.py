"""Pipeline definitions for the four demo domains (manifest-aligned)."""
from __future__ import annotations

from typing import Any

from shared.scenarios.manifest import BY_ID, DOMAINS, HERO_ID

from .engine import Fault, PipelineSpec

TIER_LIMITS = {"gold": 8000.0, "silver": 5000.0, "platinum": 15000.0}
TRUE_IOC = "cafebabe0123456789abcdef0123456789abcdef0123456789abcdef01234567"
GOOD_PRIOR = ["2025-11-02"]
SPEC_SKU = "H100-80GB"


def _oracle_insurance(out: Any) -> bool:
    if not isinstance(out, dict):
        return False
    amt = float(out.get("payout_amount", 0))
    return out.get("status") == "paid" and abs(amt - 5200.0) < 0.01


def _oracle_clinical(out: Any) -> bool:
    return isinstance(out, dict) and out.get("payer_status") == "approved"


def _oracle_procurement(out: Any) -> bool:
    if not isinstance(out, dict):
        return False
    return out.get("sku") == SPEC_SKU and out.get("issued") is True


def _oracle_soc(out: Any) -> bool:
    return isinstance(out, dict) and out.get("threat_active") is False


def _insurance_spec() -> PipelineSpec:
    d = BY_ID[HERO_ID]
    f = d.primary_fault
    dec = d.decoy_fault
    labels = {a.id: a.label for a in d.agents}
    return PipelineSpec(
        domain_id=d.id,
        task="Adjudicate member claim M-8842 · MRI lumbar · gold tier",
        domain_tag="insurance-claims",
        engine="5-agent pipeline · COVERAGE ∥ FRAUD concurrent",
        display_labels=labels,
        parents={
            "intake": (),
            "coverage": ("intake",),
            "fraud": ("intake",),
            "adjuster": ("coverage", "fraud"),
            "payout": ("adjuster",),
        },
        kinds={
            "intake": "tool_result",
            "coverage": "decision",
            "fraud": "decision",
            "adjuster": "decision",
            "payout": "final",
        },
        compute={
            "intake": lambda up: {
                "member_id": "M-8842",
                "procedure": "MRI lumbar",
                "billed_amount": 5200.0,
                "policy_tier": "gold",
            },
            "coverage": lambda up: {
                "approved_amount": min(
                    float(up["intake"]["billed_amount"]),
                    TIER_LIMITS[up["intake"]["policy_tier"]],
                ),
                "tier_limit": TIER_LIMITS[up["intake"]["policy_tier"]],
            },
            "fraud": lambda up: {
                "risk_score": 0.12,
                "flags": [],
            },
            "adjuster": lambda up: {
                "payout_amount": float(up["coverage"]["approved_amount"]),
                "member_id": up["intake"]["member_id"],
            },
            "payout": lambda up: {
                "paid": True,
                "payout_amount": float(up["adjuster"]["payout_amount"]),
                "status": "paid",
            },
        },
        oracle=_oracle_insurance,
        primary_fault=Fault(f.agent, f.field, f.bad_value, f.good_value),
        decoy_agent=dec.agent,
        decoy_override={dec.field: dec.bad_value},
        run_order=("intake", ("coverage", "fraud"), "adjuster", "payout"),
    )


def _clinical_spec() -> PipelineSpec:
    d = BY_ID["prior_auth"]
    f, dec = d.primary_fault, d.decoy_fault
    labels = {a.id: a.label for a in d.agents}
    return PipelineSpec(
        domain_id=d.id,
        task="Prior auth lumbar MRI · UHC · chart CH-9921",
        domain_tag="clinical-prior-auth",
        engine="4-agent pipeline · chart → guideline → auth → submit",
        display_labels=labels,
        parents={
            "chart_reader": (),
            "guideline_check": ("chart_reader",),
            "auth_writer": ("guideline_check",),
            "submit": ("auth_writer",),
        },
        kinds={
            "chart_reader": "tool_result",
            "guideline_check": "decision",
            "auth_writer": "decision",
            "submit": "final",
        },
        compute={
            "chart_reader": lambda up: {
                "diagnosis": "M54.5",
                "prior_treatments": list(GOOD_PRIOR),
                "contraindications": [],
            },
            "guideline_check": lambda up: {
                "meets_criteria": True,
                "rule_ids": ["UHC-MRI-90D"],
            },
            "auth_writer": lambda up: {
                "auth_payload": {"wording": "standard", "procedure": "MRI lumbar"},
            },
            "submit": lambda up: {
                "payer_status": "approved"
                if up["chart_reader"]["prior_treatments"] == GOOD_PRIOR
                else "denied",
                "reason": "insufficient conservative therapy interval (90-day rule)",
            },
        },
        oracle=_oracle_clinical,
        primary_fault=Fault(f.agent, f.field, f.bad_value, f.good_value),
        decoy_agent=dec.agent,
        decoy_override={"auth_payload": dec.bad_value},
        run_order=("chart_reader", "guideline_check", "auth_writer", "submit"),
    )


def _procurement_spec() -> PipelineSpec:
    d = BY_ID["procurement_gpu"]
    f, dec = d.primary_fault, d.decoy_fault
    labels = {a.id: a.label for a in d.agents}
    return PipelineSpec(
        domain_id=d.id,
        task="Purchase 500× H100-80GB under $25k/unit · vendor allowlist",
        domain_tag="procurement-gpu",
        engine="5-agent pipeline · Browserbase vendor scrape",
        display_labels=labels,
        parents={
            "spec": (),
            "browser": ("spec",),
            "compare": ("browser",),
            "approver": ("compare",),
            "po": ("approver",),
        },
        kinds={
            "spec": "tool_result",
            "browser": "tool_result",
            "compare": "decision",
            "approver": "decision",
            "po": "final",
        },
        compute={
            "spec": lambda up: {
                "sku": SPEC_SKU,
                "qty": 500,
                "max_price": 25000.0,
                "vendor_allowlist": ["nvidia.com"],
            },
            "browser": lambda up: {
                "sku_selected": SPEC_SKU,
                "unit_price": 24999.0,
                "page_snapshot": "https://shop.nvidia.com/h100-80gb",
            },
            "compare": lambda up: {
                "best_offer": {
                    "sku": up["browser"]["sku_selected"],
                    "price": up["browser"]["unit_price"],
                    "vendor": "nvidia.com",
                },
            },
            "approver": lambda up: {"approved": True},
            "po": lambda up: {
                "sku": up["compare"]["best_offer"]["sku"],
                "po_id": "PO-4412",
                "issued": up["compare"]["best_offer"]["sku"] == up["spec"]["sku"],
            },
        },
        oracle=_oracle_procurement,
        primary_fault=Fault(f.agent, f.field, f.bad_value, f.good_value),
        decoy_agent=dec.agent,
        decoy_override={"best_offer": {"vendor": "gray-market"}},
        run_order=("spec", "browser", "compare", "approver", "po"),
    )


def _soc_spec() -> PipelineSpec:
    d = BY_ID["soc_incident"]
    f, dec = d.primary_fault, d.decoy_fault
    labels = {a.id: a.label for a in d.agents}
    return PipelineSpec(
        domain_id=d.id,
        task="Contain SIEM alert #8812 · suspected C2 beacon",
        domain_tag="security-soc",
        engine="5-agent pipeline · THREAT_INTEL ∥ enrich path",
        display_labels=labels,
        parents={
            "alert_triage": (),
            "threat_intel": ("alert_triage",),
            "enrich": ("alert_triage", "threat_intel"),
            "contain": ("enrich",),
            "notify": ("contain",),
        },
        kinds={
            "alert_triage": "tool_result",
            "threat_intel": "decision",
            "enrich": "decision",
            "contain": "decision",
            "notify": "final",
        },
        compute={
            "alert_triage": lambda up: {
                "severity": "medium",
                "ioc": TRUE_IOC,
                "affected_hosts": ["srv-12"],
            },
            "threat_intel": lambda up: {
                "ioc_verdict": "malicious",
                "feed_refs": ["MISP-8812"],
            },
            "enrich": lambda up: {
                "confirmed_hosts": (
                    ["srv-12"] if up["alert_triage"]["ioc"] == TRUE_IOC else ["srv-99"]
                ),
            },
            "contain": lambda up: {
                "isolated": list(up["enrich"]["confirmed_hosts"]),
            },
            "notify": lambda up: {
                "threat_active": (
                    up["alert_triage"]["ioc"] != TRUE_IOC
                    or "srv-12" not in up["contain"]["isolated"]
                ),
                "contained_ioc": up["alert_triage"]["ioc"],
            },
        },
        oracle=_oracle_soc,
        primary_fault=Fault(f.agent, f.field, f.bad_value, f.good_value),
        decoy_agent=dec.agent,
        decoy_override={"isolated": dec.bad_value},
        run_order=("alert_triage", ("threat_intel",), "enrich", "contain", "notify"),
    )


SPECS: dict[str, PipelineSpec] = {
    HERO_ID: _insurance_spec(),
    "prior_auth": _clinical_spec(),
    "procurement_gpu": _procurement_spec(),
    "soc_incident": _soc_spec(),
}


def get_spec(domain_id: str) -> PipelineSpec:
    if domain_id not in SPECS:
        raise KeyError(f"unknown domain {domain_id!r}")
    return SPECS[domain_id]
