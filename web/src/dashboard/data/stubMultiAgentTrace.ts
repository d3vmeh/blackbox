import type { Attribution, Step, StepKind, Trace } from '../../types'

/**
 * STUB multi-agent trace for an Accounts-Payable pipeline. Used by downstream
 * dashboard work to exercise the generic multi-agent renderer (agent bands,
 * topology DAG, cross-agent provenance, handoff connectors) before a real
 * backend stream exists. Conforms exactly to the `Trace` contract in types.ts.
 *
 * Pipeline + topology:
 *   extractor → matcher ∥ fraud → approver → payment
 *
 * Root cause: the EXTRACTOR mis-reads the invoice amount ($1,240.00 → $12,400.00).
 * Its poisoned output is carried by handoffs into matcher → approver → payment,
 * so the blast radius crosses agent boundaries. The FRAUD agent runs in PARALLEL
 * with the matcher (same time index) and is the DECOY: its "low risk" verdict
 * looks suspicious but correcting it never flips the run.
 *
 * Agents are tagged ONLY via `raw['agent']` (read by agentOf). They are never
 * distinguished by a per-agent hue — position + label only.
 */

type Agent = 'extractor' | 'matcher' | 'fraud' | 'approver' | 'payment'

interface StepSpec {
  id: string
  agent: Agent
  kind: StepKind
  parents: string[]
  inputs?: Step['inputs']
  output: Step['output']
  tool_name?: string | null
  /** extra raw payload merged alongside the agent tag */
  raw?: Step['raw']
}

function build(spec: StepSpec, index: number): Step {
  return {
    id: spec.id,
    index,
    kind: spec.kind,
    inputs: spec.inputs ?? {},
    output: spec.output,
    state: {},
    parents: spec.parents,
    tool_name: spec.tool_name ?? null,
    raw: { agent: spec.agent, ...(spec.raw ?? {}) },
  }
}

const SPECS: StepSpec[] = [
  // ---- EXTRACTOR: reads the invoice (the root cause lives here) ----
  {
    id: 's0', agent: 'extractor', kind: 'reason', parents: [],
    output: 'parsing invoice INV-4471 (scanned PDF)',
  },
  {
    id: 's1', agent: 'extractor', kind: 'tool_call', parents: ['s0'], tool_name: 'ocr_extract',
    inputs: { document: 'INV-4471.pdf', field: 'total_due' },
    output: 'extracting total_due from line 14',
  },
  {
    id: 's2', agent: 'extractor', kind: 'tool_result', parents: ['s1'], tool_name: 'ocr_extract',
    // ROOT CAUSE: decimal misread — $1,240.00 read as $12,400.00.
    output: { amount: 1240000, currency: 'USD', raw_text: '1,240.00', confidence: 0.71 },
  },
  {
    id: 's3', agent: 'extractor', kind: 'decision', parents: ['s2'],
    output: { invoice_id: 'INV-4471', amount: 1240000, vendor: 'Northwind Tools' },
  },
  // handoff: extractor → matcher (carries the poisoned amount)
  {
    id: 's4', agent: 'extractor', kind: 'handoff', parents: ['s3'],
    output: { invoice_id: 'INV-4471', amount: 1240000, vendor: 'Northwind Tools' },
    raw: { agent: 'extractor', handoff_to: 'matcher' },
  },

  // ---- MATCHER ∥ FRAUD: parallel at the same time index ----
  // MATCHER consumes the poisoned amount → blast.
  {
    id: 's5', agent: 'matcher', kind: 'tool_call', parents: ['s4'], tool_name: 'match_po',
    inputs: { invoice_id: 'INV-4471', amount: 1240000 },
    output: 'matching invoice to PO-8820',
    raw: { agent: 'matcher', time_index: 5 },
  },
  {
    id: 's6', agent: 'matcher', kind: 'tool_result', parents: ['s5'], tool_name: 'match_po',
    output: { po_id: 'PO-8820', po_amount: 124000, variance: 1116000, within_tolerance: false },
    raw: { agent: 'matcher', time_index: 5 },
  },
  // FRAUD runs in parallel (same time index 5) — the DECOY branch.
  {
    id: 's7', agent: 'fraud', kind: 'tool_call', parents: ['s4'], tool_name: 'risk_score',
    inputs: { invoice_id: 'INV-4471', vendor: 'Northwind Tools' },
    output: 'scoring vendor + amount anomaly',
    raw: { agent: 'fraud', time_index: 5 },
  },
  {
    id: 's8', agent: 'fraud', kind: 'tool_result', parents: ['s7'], tool_name: 'risk_score',
    // Decoy: looks wrong ("low" despite a huge amount) but is NOT the root cause.
    output: { risk: 'low', score: 0.18, flags: [] },
    raw: { agent: 'fraud', time_index: 5 },
  },
  {
    id: 's9', agent: 'fraud', kind: 'decision', parents: ['s8'],
    output: { fraud_decision: 'clear', risk: 'low' },
    raw: { agent: 'fraud', time_index: 5 },
  },
  // handoff: matcher → approver (carries the over-tolerance match)
  {
    id: 's10', agent: 'matcher', kind: 'handoff', parents: ['s6', 's9'],
    output: { po_id: 'PO-8820', amount: 1240000, within_tolerance: false, fraud: 'clear' },
    raw: { agent: 'matcher', handoff_to: 'approver' },
  },

  // ---- APPROVER: inherits the poison → blast ----
  {
    id: 's11', agent: 'approver', kind: 'reason', parents: ['s10'],
    output: 'amount over tolerance but fraud-clear; escalating to auto-approve threshold check',
  },
  {
    id: 's12', agent: 'approver', kind: 'decision', parents: ['s11'],
    output: { approved: true, amount: 1240000, approver: 'auto', reason: 'vendor trusted' },
  },
  // handoff: approver → payment
  {
    id: 's13', agent: 'approver', kind: 'handoff', parents: ['s12'],
    output: { invoice_id: 'INV-4471', amount: 1240000, approved: true },
    raw: { agent: 'approver', handoff_to: 'payment' },
  },

  // ---- PAYMENT: the failure surfaces here → blast ----
  {
    id: 's14', agent: 'payment', kind: 'tool_call', parents: ['s13'], tool_name: 'issue_payment',
    inputs: { vendor: 'Northwind Tools', amount: 1240000 },
    output: 'issuing ACH payment',
  },
  {
    id: 's15', agent: 'payment', kind: 'tool_result', parents: ['s14'], tool_name: 'issue_payment',
    output: { paid: 1240000, currency: 'USD', txn: 'ACH-99213' },
  },
  {
    id: 's16', agent: 'payment', kind: 'final', parents: ['s15'],
    output: 'OVERPAID Northwind Tools $12,400.00 (expected $1,240.00) — 10x the invoice total',
  },
]

const STEPS: Step[] = SPECS.map(build)

const STUB_TRACE: Trace = {
  id: 'ap_overpay',
  task: 'Process invoice INV-4471 from Northwind Tools and issue payment',
  steps: STEPS,
  final_output: STEPS[STEPS.length - 1].output,
  success: false,
}

export function loadStubMultiAgentTrace(): Trace {
  return STUB_TRACE
}

/**
 * Matching attribution: root is the extractor's OCR misread (s2); the blast
 * radius is the forward slice carrying that poisoned amount across agents.
 * Candidate[0] is the true root; candidate[1] is the fraud-agent decoy.
 */
export const STUB_MULTI_ATTRIBUTION: Attribution = {
  trace_id: 'ap_overpay',
  root_step_id: 's2',
  blast_radius: ['s2', 's3', 's4', 's5', 's6', 's10', 's11', 's12', 's13', 's14', 's15', 's16'],
  candidates: [
    { step_id: 's2', suspicion: 0.91, reason: 'OCR read total_due as $12,400.00 (raw "1,240.00") — decimal misplaced' },
    { step_id: 's8', suspicion: 0.44, reason: 'fraud risk_score returned "low" despite a 10x amount anomaly' },
    { step_id: 's12', suspicion: 0.22, reason: 'approver auto-approved an over-tolerance amount' },
  ],
  rationale:
    'The extractor mis-read the invoice total at s2 ($1,240.00 → $12,400.00). Every downstream ' +
    'agent inherited the inflated amount through handoffs, leading payment to overpay 10x. The ' +
    'fraud agent’s "low risk" verdict (s8) is a tempting decoy but correcting it does not flip ' +
    'the outcome — the poison originates upstream at s2.',
}
