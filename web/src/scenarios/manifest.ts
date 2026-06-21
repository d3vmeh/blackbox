/**
 * Scenario registry (UI) — mirrors shared/scenarios/manifest.py.
 * Used by dashboard dropdown labels, topology strip, landing System Map.
 */

export type ScenarioTier = 'hero' | 'research' | 'sponsor' | 'ops'

export interface AgentNode {
  id: string
  label: string
  langgraphNode: string
  role: string
}

export interface TopologyEdge {
  from: string
  to: string
  payload: string
}

export interface ScenarioManifest {
  id: string
  label: string
  tier: ScenarioTier
  tagline: string
  task: string
  agents: AgentNode[]
  edges: TopologyEdge[]
  parallel: string[][]
  /** Primary fault — root replay must flip oracle */
  fault: { agent: string; field: string; symptom: string }
  /** Decoy — replay must NOT flip (demo beat) */
  decoy: { agent: string; field: string; symptom: string }
  arize: { fail: string; healed: string; evaluators: string[] }
}

export const SCENARIO_MANIFEST: ScenarioManifest[] = [
  {
    id: 'claim_adjudication',
    label: 'insurance · claim adjudication',
    tier: 'hero',
    tagline: 'INTAKE decimal slip → $52k payout — fix ADJUSTER first does not flip.',
    task: 'Adjudicate member claim · MRI lumbar · gold tier',
    agents: [
      { id: 'intake', label: 'INTAKE', langgraphNode: 'intake', role: 'Parse claim → structured hand-off' },
      { id: 'coverage', label: 'COVERAGE', langgraphNode: 'coverage', role: 'Tier limits + procedure coverage' },
      { id: 'fraud', label: 'FRAUD', langgraphNode: 'fraud', role: 'Parallel anomaly scan' },
      { id: 'adjuster', label: 'ADJUSTER', langgraphNode: 'adjuster', role: 'Merge → payout decision' },
      { id: 'payout', label: 'PAYOUT', langgraphNode: 'payout', role: 'Execute payment' },
    ],
    edges: [
      { from: 'intake', to: 'coverage', payload: '{member_id, procedure, billed_amount, policy_tier}' },
      { from: 'intake', to: 'fraud', payload: '{member_id, procedure, billed_amount, policy_tier}' },
      { from: 'coverage', to: 'adjuster', payload: '{approved_amount, tier_limit}' },
      { from: 'fraud', to: 'adjuster', payload: '{risk_score, flags[]}' },
      { from: 'adjuster', to: 'payout', payload: '{payout_amount}' },
    ],
    parallel: [['coverage', 'fraud']],
    fault: {
      agent: 'intake',
      field: 'billed_amount',
      symptom: 'Payout $52,000 exceeds gold tier limit',
    },
    decoy: {
      agent: 'adjuster',
      field: 'payout_amount',
      symptom: 'Adjuster trim plausible — replay does not flip',
    },
    arize: {
      fail: 'claim_fail',
      healed: 'claim_healed',
      evaluators: ['payout_within_policy', 'root_step_is_intake_not_adjuster', 'replay_flipped'],
    },
  },
  {
    id: 'prior_auth',
    label: 'clinical · prior authorization',
    tier: 'research',
    tagline: 'Chart reader wrong date → guideline pass → submission denied.',
    task: 'Prior auth lumbar MRI · UHC · chart CH-9921',
    agents: [
      { id: 'chart_reader', label: 'CHART_READER', langgraphNode: 'chart_reader', role: 'Clinical fact extraction' },
      { id: 'guideline_check', label: 'GUIDELINE_CHECK', langgraphNode: 'guideline_check', role: 'Medical necessity rules' },
      { id: 'auth_writer', label: 'AUTH_WRITER', langgraphNode: 'auth_writer', role: 'PA letter + citations' },
      { id: 'submit', label: 'SUBMIT', langgraphNode: 'submit', role: 'Payer portal submission' },
    ],
    edges: [
      { from: 'chart_reader', to: 'guideline_check', payload: '{diagnosis, prior_treatments, contraindications}' },
      { from: 'guideline_check', to: 'auth_writer', payload: '{meets_criteria, rule_ids[]}' },
      { from: 'auth_writer', to: 'submit', payload: '{auth_payload}' },
    ],
    parallel: [],
    fault: {
      agent: 'chart_reader',
      field: 'prior_treatments',
      symptom: 'Denied — insufficient therapy interval (90-day rule)',
    },
    decoy: {
      agent: 'auth_writer',
      field: 'auth_payload',
      symptom: 'Letter wording — replay does not flip denial',
    },
    arize: {
      fail: 'pa_fail',
      healed: 'pa_healed',
      evaluators: ['guideline_grounded_in_chart', 'earliest_fault_before_symptom', 'replay_flipped'],
    },
  },
  {
    id: 'procurement_gpu',
    label: 'procurement · GPU purchase',
    tier: 'sponsor',
    tagline: 'Browser mis-read SKU — cheapest quote is wrong variant.',
    task: '500× H100-80GB under $25k · Browserbase vendor scrape',
    agents: [
      { id: 'spec', label: 'SPEC', langgraphNode: 'spec', role: 'Purchase constraints' },
      { id: 'browser', label: 'BROWSER', langgraphNode: 'browser', role: 'Live page scrape (Browserbase)' },
      { id: 'compare', label: 'COMPARE', langgraphNode: 'compare', role: 'Rank quotes vs spec' },
      { id: 'approver', label: 'APPROVER', langgraphNode: 'approver', role: 'Delegation sign-off' },
      { id: 'po', label: 'PO', langgraphNode: 'po', role: 'Issue purchase order' },
    ],
    edges: [
      { from: 'spec', to: 'browser', payload: '{sku, qty, max_price, vendor_allowlist}' },
      { from: 'browser', to: 'compare', payload: '{sku_selected, unit_price, page_snapshot}' },
      { from: 'compare', to: 'approver', payload: '{best_offer}' },
      { from: 'approver', to: 'po', payload: '{approved, best_offer}' },
    ],
    parallel: [],
    fault: {
      agent: 'browser',
      field: 'sku_selected',
      symptom: 'Oracle FAIL: SKU mismatch (refurb ≠ new)',
    },
    decoy: {
      agent: 'compare',
      field: 'best_offer',
      symptom: 'Gray-market vendor — fix compare alone no flip',
    },
    arize: {
      fail: 'procurement_fail',
      healed: 'procurement_healed',
      evaluators: ['selected_sku_matches_spec', 'replay_flipped'],
    },
  },
  {
    id: 'soc_incident',
    label: 'security · SOC incident',
    tier: 'ops',
    tagline: 'Wrong IOC → contain decoy host — threat still active.',
    task: 'SIEM alert #8812 · suspected C2 beacon',
    agents: [
      { id: 'alert_triage', label: 'ALERT_TRIAGE', langgraphNode: 'alert_triage', role: 'Classify alert + IOC' },
      { id: 'threat_intel', label: 'THREAT_INTEL', langgraphNode: 'threat_intel', role: 'Parallel feed enrichment' },
      { id: 'enrich', label: 'ENRICH', langgraphNode: 'enrich', role: 'Merge → target hosts' },
      { id: 'contain', label: 'CONTAIN', langgraphNode: 'contain', role: 'Isolation playbooks' },
      { id: 'notify', label: 'NOTIFY', langgraphNode: 'notify', role: 'Page + ticket' },
    ],
    edges: [
      { from: 'alert_triage', to: 'enrich', payload: '{severity, ioc, affected_hosts}' },
      { from: 'alert_triage', to: 'threat_intel', payload: '{ioc}' },
      { from: 'threat_intel', to: 'enrich', payload: '{ioc_verdict}' },
      { from: 'enrich', to: 'contain', payload: '{confirmed_hosts}' },
      { from: 'contain', to: 'notify', payload: '{isolated, runbook_id}' },
    ],
    parallel: [['threat_intel']],
    fault: {
      agent: 'alert_triage',
      field: 'ioc',
      symptom: 'Contained wrong host — C2 still beaconing',
    },
    decoy: {
      agent: 'contain',
      field: 'isolated',
      symptom: 'Playbook ran — fix contain alone no flip',
    },
    arize: {
      fail: 'soc_fail',
      healed: 'soc_healed',
      evaluators: ['containment_matches_true_ioc', 'replay_flipped'],
    },
  },
]

export const HERO_SCENARIO_ID = 'claim_adjudication'
export const RESEARCH_SCENARIO_ID = 'prior_auth'

export function manifestById(id: string): ScenarioManifest | undefined {
  return SCENARIO_MANIFEST.find((s) => s.id === id)
}
