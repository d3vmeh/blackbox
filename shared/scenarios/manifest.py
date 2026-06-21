"""Canonical scenario registry — four demo domains replacing legacy AP/claims.

Each domain defines:
  - agent topology (LangGraph nodes + parallel branches)
  - structured hand-off payloads (what the dashboard topology strip renders)
  - injected fault + decoy (for the replay climax: decoy no-flip → root flip)
  - oracle + Arize evaluators (sponsor / research track)

UI labels and graph layout: web/src/scenarios/manifest.ts (kept in sync).
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Literal

Tier = Literal["hero", "research", "sponsor", "ops"]


@dataclass(frozen=True)
class HandoffField:
    name: str
    dtype: str
    example: str
    description: str = ""


@dataclass(frozen=True)
class AgentSpec:
    id: str
    label: str
    langgraph_node: str
    role: str
    emits: tuple[HandoffField, ...]


@dataclass(frozen=True)
class EdgeSpec:
    src: str
    dst: str
    payload: str  # human-readable hand-off name shown in topology


@dataclass(frozen=True)
class FaultSpec:
    agent: str
    field: str
    bad_value: Any
    good_value: Any
    symptom: str  # what the oracle / final agent surfaces


@dataclass(frozen=True)
class LangGraphSpec:
    checkpointer: str
    fork_api: str
    replay_api: str
    state_channels: tuple[str, ...]


@dataclass(frozen=True)
class ArizeSpec:
    fail_trace_id: str
    healed_trace_id: str
    evaluators: tuple[str, ...]
    span_tags: tuple[str, ...]
    improvement_loop: str


@dataclass(frozen=True)
class ScenarioDomain:
    id: str
    label: str
    tier: Tier
    tagline: str
    task_template: str
    agents: tuple[AgentSpec, ...]
    edges: tuple[EdgeSpec, ...]
    parallel_groups: tuple[tuple[str, ...], ...]
    primary_fault: FaultSpec
    decoy_fault: FaultSpec
    oracle: str
    langgraph: LangGraphSpec
    arize: ArizeSpec
    research_notes: str = ""


# ---------------------------------------------------------------------------
# 1. Insurance claim adjudication (HERO — landing + booth default)
# ---------------------------------------------------------------------------
_INSURANCE_AGENTS = (
    AgentSpec(
        "intake", "INTAKE", "intake", "Parse member claim form → structured hand-off",
        (
            HandoffField("member_id", "str", "M-8842", "Unique member identifier"),
            HandoffField("procedure", "str", "MRI lumbar", "CPT / procedure code"),
            HandoffField("billed_amount", "float", "5200.00", "Provider billed amount (USD)"),
            HandoffField("policy_tier", "enum", "gold", "gold | silver | platinum"),
        ),
    ),
    AgentSpec(
        "coverage", "COVERAGE", "coverage", "Verify procedure covered under tier limits",
        (HandoffField("approved_amount", "float", "5200.00", "Tier-adjusted approved cap"),),
    ),
    AgentSpec(
        "fraud", "FRAUD", "fraud", "Parallel anomaly scan (can flag but be overridden)",
        (HandoffField("risk_score", "float", "0.12", "0–1; high triggers review"),),
    ),
    AgentSpec(
        "adjuster", "ADJUSTER", "adjuster", "Merge coverage + fraud → payout decision",
        (HandoffField("payout_amount", "float", "5200.00", "Amount sent to payment rail"),),
    ),
    AgentSpec(
        "payout", "PAYOUT", "payout", "Execute payment + notify member",
        (HandoffField("paid", "bool", "True", "Oracle reads this + policy cap"),),
    ),
)

INSURANCE = ScenarioDomain(
    id="claim_adjudication",
    label="insurance · claim adjudication",
    tier="hero",
    tagline="We almost paid $52k instead of $5.2k — root cause was INTAKE, not ADJUSTER.",
    task_template="Adjudicate member claim M-8842 · MRI lumbar · billed ${amount}",
    agents=_INSURANCE_AGENTS,
    edges=(
        EdgeSpec("intake", "coverage", "{member_id, procedure, billed_amount, policy_tier}"),
        EdgeSpec("intake", "fraud", "{member_id, procedure, billed_amount, policy_tier}"),
        EdgeSpec("coverage", "adjuster", "{approved_amount, tier_limit}"),
        EdgeSpec("fraud", "adjuster", "{risk_score, flags[]}"),
        EdgeSpec("adjuster", "payout", "{payout_amount, member_id}"),
    ),
    parallel_groups=(("coverage", "fraud"),),
    primary_fault=FaultSpec(
        agent="intake",
        field="billed_amount",
        bad_value=52000.00,
        good_value=5200.00,
        symptom="Payout $52,000 exceeds gold tier policy limit ($8,000)",
    ),
    decoy_fault=FaultSpec(
        agent="adjuster",
        field="payout_amount",
        bad_value=4800.00,
        good_value=5200.00,
        symptom="Adjuster trimmed payout — plausible but not root; replay does not flip",
    ),
    oracle="payout_within_policy(member_id, procedure, amount, tier)",
    langgraph=LangGraphSpec(
        checkpointer="MemorySaver",
        fork_api='update_state(as_node="intake", values={"billed_amount": 5200.0})',
        replay_api="graph.invoke(None, config) → re-run from checkpoint",
        state_channels=("claim", "coverage", "fraud", "decision", "payment"),
    ),
    arize=ArizeSpec(
        fail_trace_id="claim_fail",
        healed_trace_id="claim_healed",
        evaluators=(
            "payout_within_policy",
            "root_step_is_intake_not_adjuster",
            "replay_flipped",
        ),
        span_tags=("member_id", "policy_tier", "billed_amount", "payout_amount", "root_step_id"),
        improvement_loop="Eval: adjuster-only fix fails → tune intake extraction prompt → suite pass rate rises",
    ),
)

# ---------------------------------------------------------------------------
# 2. Clinical prior authorization (RESEARCH — Anthropic health + eval suite)
# ---------------------------------------------------------------------------
_CLINICAL_AGENTS = (
    AgentSpec(
        "chart_reader", "CHART_READER", "chart_reader",
        "Extract structured facts from clinical notes (ICD, dates, contraindications)",
        (
            HandoffField("diagnosis", "str", "M54.5", "Primary ICD-10"),
            HandoffField("prior_treatments", "list[date]", "['2025-11-02']", "Prior therapy dates"),
            HandoffField("contraindications", "list[str]", "[]", "Documented contraindications"),
        ),
    ),
    AgentSpec(
        "guideline_check", "GUIDELINE_CHECK", "guideline_check",
        "Map diagnosis + history to payer medical-necessity rules",
        (HandoffField("meets_criteria", "bool", "True", "Payer guideline pass/fail"),),
    ),
    AgentSpec(
        "auth_writer", "AUTH_WRITER", "auth_writer", "Draft prior-auth letter with citations",
        (HandoffField("auth_payload", "json", "{...}", "Structured PA request body"),),
    ),
    AgentSpec(
        "submit", "SUBMIT", "submit", "Submit to payer portal + capture acknowledgment",
        (HandoffField("payer_status", "str", "denied", "approved | denied | pended"),),
    ),
)

CLINICAL = ScenarioDomain(
    id="prior_auth",
    label="clinical · prior authorization",
    tier="research",
    tagline="Wrong prior treatment date poisons guideline approval — symptom at submission, fault at chart extraction.",
    task_template="Prior auth for lumbar MRI · member chart CH-9921 · payer UHC",
    agents=_CLINICAL_AGENTS,
    edges=(
        EdgeSpec("chart_reader", "guideline_check", "{diagnosis, prior_treatments, contraindications}"),
        EdgeSpec("guideline_check", "auth_writer", "{meets_criteria, rule_ids[]}"),
        EdgeSpec("auth_writer", "submit", "{auth_payload}"),
    ),
    parallel_groups=(),
    primary_fault=FaultSpec(
        agent="chart_reader",
        field="prior_treatments",
        bad_value=["2025-01-02"],  # should be 2025-11-02
        good_value=["2025-11-02"],
        symptom="Prior auth denied — insufficient conservative therapy interval (90-day rule)",
    ),
    decoy_fault=FaultSpec(
        agent="auth_writer",
        field="auth_payload",
        bad_value={"wording": "weak"},
        good_value={"wording": "standard"},
        symptom="Letter wording suboptimal — replay at auth_writer does not flip denial",
    ),
    oracle="medical_necessity_justified(chart_facts, payer_rules)",
    langgraph=LangGraphSpec(
        checkpointer="MemorySaver",
        fork_api='update_state(as_node="chart_reader", values={"prior_treatments": ["2025-11-02"]})',
        replay_api="invoke from chart_reader checkpoint",
        state_channels=("chart", "guideline", "auth_draft", "submission"),
    ),
    arize=ArizeSpec(
        fail_trace_id="pa_fail",
        healed_trace_id="pa_healed",
        evaluators=(
            "guideline_grounded_in_chart",
            "earliest_fault_before_symptom",
            "replay_flipped",
        ),
        span_tags=("diagnosis", "prior_treatments", "meets_criteria", "payer_status"),
        improvement_loop="Batch 5–10 fault variants · Arize experiment: chart_reader prompt v1 vs v2",
    ),
    research_notes=(
        "Primary research surface: labeled fault suite + LLM-as-judge evals on clinical grounding. "
        "Optional Deepgram voice intake (speech→JSON fault boundary) for Nintendo track."
    ),
)

# ---------------------------------------------------------------------------
# 3. Procurement / Browserbase (SPONSOR — web tool loop)
# ---------------------------------------------------------------------------
_PROCUREMENT_AGENTS = (
    AgentSpec(
        "spec", "SPEC", "spec", "Normalize purchase request → SKU constraints",
        (
            HandoffField("sku", "str", "H100-80GB", "Required SKU pattern"),
            HandoffField("qty", "int", "500", "Units"),
            HandoffField("max_price", "float", "25000.00", "Budget cap (USD)"),
            HandoffField("vendor_allowlist", "list[str]", "['nvidia.com']", "Approved vendors"),
        ),
    ),
    AgentSpec(
        "browser", "BROWSER", "browser", "Live vendor page scrape via Browserbase/Stagehand",
        (
            HandoffField("page_snapshot", "url", "https://...", "Captured DOM / screenshot ref"),
            HandoffField("sku_selected", "str", "H100-80GB-REF", "SKU read from page"),
            HandoffField("unit_price", "float", "24999.00", "Quoted unit price"),
        ),
    ),
    AgentSpec(
        "compare", "COMPARE", "compare", "Rank quotes against spec",
        (HandoffField("best_offer", "json", "{sku, price, vendor}", "Chosen line item"),),
    ),
    AgentSpec(
        "approver", "APPROVER", "approver", "Policy sign-off under delegation limit",
        (HandoffField("approved", "bool", "True", ""),),
    ),
    AgentSpec(
        "po", "PO", "po", "Issue purchase order",
        (HandoffField("po_id", "str", "PO-4412", "Oracle: SKU must match spec.sku"),),
    ),
)

PROCUREMENT = ScenarioDomain(
    id="procurement_gpu",
    label="procurement · GPU purchase",
    tier="sponsor",
    tagline="Browser read wrong variant — cheapest quote is the wrong SKU.",
    task_template="Purchase 500× H100-80GB under $25k/unit · vendor allowlist",
    agents=_PROCUREMENT_AGENTS,
    edges=(
        EdgeSpec("spec", "browser", "{sku, qty, max_price, vendor_allowlist}"),
        EdgeSpec("browser", "compare", "{sku_selected, unit_price, page_snapshot}"),
        EdgeSpec("compare", "approver", "{best_offer}"),
        EdgeSpec("approver", "po", "{approved, best_offer}"),
    ),
    parallel_groups=(),
    primary_fault=FaultSpec(
        agent="browser",
        field="sku_selected",
        bad_value="H100-80GB-REFURB",
        good_value="H100-80GB",
        symptom="Oracle FAIL: selected SKU mismatch vs spec (refurb ≠ new)",
    ),
    decoy_fault=FaultSpec(
        agent="compare",
        field="best_offer",
        bad_value={"vendor": "gray-market"},
        good_value={"vendor": "nvidia.com"},
        symptom="Compare picked gray-market — fixing compare alone does not flip SKU oracle",
    ),
    oracle="selected_sku_matches_spec(spec.sku, po.line_item.sku)",
    langgraph=LangGraphSpec(
        checkpointer="MemorySaver",
        fork_api='update_state(as_node="browser", values={"sku_selected": "H100-80GB"})',
        replay_api="re-invoke from browser checkpoint with injected SKU",
        state_channels=("spec", "browser_session", "quotes", "approval", "po"),
    ),
    arize=ArizeSpec(
        fail_trace_id="procurement_fail",
        healed_trace_id="procurement_healed",
        evaluators=("selected_sku_matches_spec", "replay_flipped"),
        span_tags=("sku_expected", "sku_selected", "page_url", "unit_price"),
        improvement_loop="LLM-as-judge on span attrs: sku_selected vs sku_expected",
    ),
)

# ---------------------------------------------------------------------------
# 4. SOC incident response (OPS — Sentry + Redis + parallel intel)
# ---------------------------------------------------------------------------
_SOC_AGENTS = (
    AgentSpec(
        "alert_triage", "ALERT_TRIAGE", "alert_triage", "Classify incoming SIEM alert",
        (
            HandoffField("severity", "enum", "medium", "low | medium | high | critical"),
            HandoffField("ioc", "str", "abc123…", "Primary indicator of compromise"),
            HandoffField("affected_hosts", "list[str]", "['srv-12']", "Initial host set"),
        ),
    ),
    AgentSpec(
        "threat_intel", "THREAT_INTEL", "threat_intel", "Parallel enrichment from threat feeds",
        (HandoffField("ioc_verdict", "str", "malicious", "benign | suspicious | malicious"),),
    ),
    AgentSpec(
        "enrich", "ENRICH", "enrich", "Merge triage + intel → target set",
        (HandoffField("confirmed_hosts", "list[str]", "['srv-99']", "Hosts to isolate"),),
    ),
    AgentSpec(
        "contain", "CONTAIN", "contain", "Execute containment playbooks",
        (HandoffField("isolated", "list[str]", "['srv-99']", "Hosts successfully isolated"),),
    ),
    AgentSpec(
        "notify", "NOTIFY", "notify", "Page on-call + ticket",
        (HandoffField("threat_active", "bool", "True", "Oracle: true IOC still beaconing"),),
    ),
)

SOC = ScenarioDomain(
    id="soc_incident",
    label="security · SOC incident",
    tier="ops",
    tagline="Wrong IOC hash → containment targets decoy host — threat still active.",
    task_template="Contain SIEM alert #8812 · suspected C2 beacon",
    agents=_SOC_AGENTS,
    edges=(
        EdgeSpec("alert_triage", "enrich", "{severity, ioc, affected_hosts}"),
        EdgeSpec("alert_triage", "threat_intel", "{ioc}"),
        EdgeSpec("threat_intel", "enrich", "{ioc_verdict, feed_refs[]}"),
        EdgeSpec("enrich", "contain", "{confirmed_hosts}"),
        EdgeSpec("contain", "notify", "{isolated, runbook_id}"),
    ),
    parallel_groups=(("threat_intel",),),  # parallel to enrich path from triage
    primary_fault=FaultSpec(
        agent="alert_triage",
        field="ioc",
        bad_value="deadbeef…",
        good_value="cafebabe…",
        symptom="Containment isolated srv-99 but C2 still active on srv-12 (true IOC)",
    ),
    decoy_fault=FaultSpec(
        agent="contain",
        field="isolated",
        bad_value=["srv-99"],
        good_value=["srv-12"],
        symptom="Contain playbook ran — fixing contain alone doesn't clear oracle",
    ),
    oracle="containment_matches_true_ioc(ioc, isolated_hosts, threat_feed)",
    langgraph=LangGraphSpec(
        checkpointer="MemorySaver",
        fork_api='update_state(as_node="alert_triage", values={"ioc": "<true_hash>"})',
        replay_api="re-run enrich → contain → notify from triage fork",
        state_channels=("alert", "intel", "enrichment", "containment", "comms"),
    ),
    arize=ArizeSpec(
        fail_trace_id="soc_fail",
        healed_trace_id="soc_healed",
        evaluators=("containment_matches_true_ioc", "replay_flipped"),
        span_tags=("severity", "ioc", "confirmed_hosts", "threat_active"),
        improvement_loop="On escalate: Sentry issue auto-filed with root_step + blast_radius + replay_rate",
    ),
)

DOMAINS: tuple[ScenarioDomain, ...] = (INSURANCE, CLINICAL, PROCUREMENT, SOC)
BY_ID: dict[str, ScenarioDomain] = {d.id: d for d in DOMAINS}

HERO_ID = "claim_adjudication"
RESEARCH_ID = "prior_auth"
