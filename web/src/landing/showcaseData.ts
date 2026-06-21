/**
 * Landing-page showcase data — a hand-authored fake run that mirrors the real
 * dashboard (claim_adjudication: insurance-claims multi-agent pipeline with an
 * injected INTAKE decimal-slip fault). All of this is STATIC fake data; the
 * landing showcase never touches the backend. Geometry (node x/y + edge paths)
 * is hand-placed for the fixed trace — no auto-layout engine.
 *
 * Phase / status / trust semantics are reused verbatim from the real dashboard
 * (`../dashboard/phase`, `../dashboard/types`) so the showcase can't drift.
 */
import type { Phase } from '../dashboard/phase'
import type { ActionNode, AgentTopology, NodeStatus } from '../dashboard/types'

// ---- Autoplay beat machine: the same beats the real dashboard scripts -------
// idle → blast → analyze → proving_decoy → proving_root → confirm (rest on PASS).
export const CYCLE: { phase: Phase; hold: number }[] = [
  { phase: 'idle', hold: 1400 },
  { phase: 'blast', hold: 2800 },
  { phase: 'analyze', hold: 1900 },
  { phase: 'proving_decoy', hold: 1200 },
  { phase: 'proving_root', hold: 1200 },
  { phase: 'confirm', hold: 0 },
]
export const LAST_BEAT = CYCLE.length - 1

/** Replay re-runs proven before the fix is trusted (k/n counter). */
export const REPLAY_N = 5

// ---- Run identity (mirrors shared/fixtures/claim_adjudication) ---------------
export const RUN_ID = 'claim_adjudication'
export const RUN_TASK = 'insurance-claims · multi-agent'
export const RUN_RUNTIME = 'insurance-claims'

// ---- Agents roster -----------------------------------------------------------
export interface ShowcaseAgent {
  id: string
  label: string
  status: NodeStatus // base status; 'root' marks the failed agent
}
export const AGENTS: ShowcaseAgent[] = [
  { id: 'intake', label: 'INTAKE', status: 'root' },
  { id: 'coverage', label: 'COVERAGE', status: 'blast' },
  { id: 'fraud', label: 'FRAUD', status: 'blast' },
  { id: 'adjuster', label: 'ADJUSTER', status: 'blast' },
  { id: 'payout', label: 'PAYOUT', status: 'blast' },
]

// ---- Supervise stepper (Localize · Replay · Decide) --------------------------
export interface SuperviseStep {
  key: 'localize' | 'replay' | 'decide'
  label: string
  note: string
}
export const SUPERVISE: SuperviseStep[] = [
  { key: 'localize', label: 'Localize', note: 'rank suspects' },
  { key: 'replay', label: 'Replay', note: 'fork · inject' },
  { key: 'decide', label: 'Decide', note: 'trust · apply' },
]
/** How far the monitor has advanced (index into SUPERVISE that is "active"). */
export const PHASE_REACH: Record<Phase, number> = {
  idle: -1, blast: 0, analyze: 0, proving_decoy: 1, proving_root: 1, rejected: 1, confirm: 2,
}

// ---- Ranked candidates (suspects) -------------------------------------------
export type CandidateKind = 'root' | 'decoy' | 'latent'
export interface ShowcaseCandidate {
  stepId: string
  reason: string
  suspicion: number
  kind: CandidateKind
}
export const CANDIDATES: ShowcaseCandidate[] = [
  { stepId: 'g2', reason: 'decimal slip · earliest corrupted hand-off', suspicion: 0.91, kind: 'root' },
  { stepId: 'g5', reason: 'symptom site · wrong payout assembled', suspicion: 0.46, kind: 'decoy' },
  { stepId: 'g3', reason: 'gold-tier cap applied', suspicion: 0.17, kind: 'latent' },
]

// ---- Provenance graph: hand-placed nodes, agent bands, curved edges ----------
// Node box: 172 × 58. Two lanes (x = 64 / 244) zig-zag down through 5 agent
// bands; lane 0 clears the left band-label gutter. Baked for this 6-node trace.
export const GRAPH_W = 432
export const GRAPH_H = 496

export interface ShowcaseNode extends ActionNode {
  x: number
  y: number
  status: NodeStatus // base status; displayStatus() resolves the live value
}
export const NODE_W = 172
export const NODE_H = 58

function node(
  id: string, agentId: string, kind: ActionNode['kind'], label: string,
  x: number, y: number, status: NodeStatus,
): ShowcaseNode {
  return { id, stepIds: [id], kind, label, lane: 'reason', agentId, x, y, status }
}

export const NODES: ShowcaseNode[] = [
  node('g1', 'intake', 'tool_result', 'parse claim form', 64, 8, 'neutral'),
  node('g2', 'intake', 'tool_result', 'billed_amount = $52,000', 244, 84, 'root'),
  node('g3', 'coverage', 'decision', 'gold tier · cap $8,000', 64, 168, 'blast'),
  node('g4', 'fraud', 'decision', 'risk 0.12 · overridden', 244, 252, 'blast'),
  node('g5', 'adjuster', 'decision', 'merge → payout $52,000', 64, 336, 'blast'),
  node('g6', 'payout', 'final', 'rail · oracle FAIL', 244, 420, 'blast'),
]

/** Agent band labels in the left gutter, vertically centered on the band. */
export const BANDS: { label: string; y: number; isRoot: boolean }[] = [
  { label: 'INTAKE', y: 75, isRoot: true },
  { label: 'COVERAGE', y: 197, isRoot: false },
  { label: 'FRAUD', y: 281, isRoot: false },
  { label: 'ADJUSTER', y: 365, isRoot: false },
  { label: 'PAYOUT', y: 449, isRoot: false },
]
/** Hairline separators between adjacent agent bands. */
export const BAND_SEPS: number[] = [155, 239, 323, 407]

/** Curved connectors between consecutive nodes (bottom-center → top-center). */
export interface ShowcaseEdge {
  from: string
  to: string
  d: string
  /** both endpoints carry the poison (root → blast → … forward slice). */
  poison: boolean
}
export const EDGES: ShowcaseEdge[] = [
  { from: 'g1', to: 'g2', d: 'M150 66 C 150 78 330 72 330 84', poison: true },
  { from: 'g2', to: 'g3', d: 'M330 142 C 330 158 150 152 150 168', poison: true },
  { from: 'g3', to: 'g4', d: 'M150 226 C 150 242 330 236 330 252', poison: true },
  { from: 'g4', to: 'g5', d: 'M330 310 C 330 326 150 320 150 336', poison: true },
  { from: 'g5', to: 'g6', d: 'M150 394 C 150 410 330 404 330 420', poison: true },
]

// ---- Topology (agent-wiring strip) ------------------------------------------
export const TOPOLOGY: AgentTopology = {
  agents: AGENTS.map((a) => ({ id: a.id, label: a.label, status: a.status })),
  handoffs: [
    { from: 'intake', to: 'coverage', poisoned: true },
    { from: 'coverage', to: 'fraud', poisoned: true },
    { from: 'fraud', to: 'adjuster', poisoned: true },
    { from: 'adjuster', to: 'payout', poisoned: true },
  ],
}

// ---- Inspector fields per phase ---------------------------------------------
export interface Field {
  label: string
  value: string
  tone?: 'root' | 'blast' | 'pass'
}

/** The focal step shown in the inspector header pill for each phase. */
export const FOCAL_PILL: Partial<Record<Phase, string>> = {
  blast: 'g6 · final',
  analyze: 'g2 · root',
  proving_decoy: 'g5 · decoy',
  proving_root: 'g2 · root',
  confirm: 'g2 · root',
}

export function inspectorFields(phase: Phase): Field[] {
  switch (phase) {
    case 'idle':
      return [
        { label: 'oracle', value: 'FAIL', tone: 'blast' },
        { label: 'reason', value: 'payout $52,000 exceeds gold tier cap ($8,000)' },
      ]
    case 'blast':
      return [
        { label: 'symptom', value: 'wrong payout at PAYOUT agent' },
        { label: 'blast radius', value: '4 agents · INTAKE → PAYOUT', tone: 'blast' },
      ]
    case 'analyze':
      return [
        { label: 'hand-off', value: 'billed_amount $52,000 (should be $5,200)' },
        { label: 'provenance', value: 'traced to INTAKE parse' },
        { label: 'root cause', value: 'INTAKE decimal slip · policy_tier gold', tone: 'root' },
      ]
    case 'proving_decoy':
      return [
        { label: 'replay', value: 'ADJUSTER merge · candidate' },
        { label: 'result', value: `0 / ${REPLAY_N} · no flip` },
        { label: 'monitor', value: 'decoy rejected · re-targeting' },
      ]
    case 'proving_root':
      return [
        { label: 'replay', value: 'INTAKE billed_amount · root cause' },
        { label: 'inject', value: 'billed_amount = 5200.0' },
        { label: 'monitor', value: 'proving…' },
      ]
    case 'confirm':
      return [
        { label: 'fix', value: 'inject billed_amount = 5200.0 at INTAKE', tone: 'pass' },
        { label: 'replay', value: `n = ${REPLAY_N} re-runs` },
        { label: 'confirmation', value: `${REPLAY_N} / ${REPLAY_N} passed`, tone: 'pass' },
      ]
    case 'rejected':
      return [
        { label: 'replay', value: 'candidate · no flip' },
        { label: 'result', value: `0 / ${REPLAY_N}` },
      ]
  }
}
