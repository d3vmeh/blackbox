/** Shared investigation narrative — graph topology, phases, copy. */

export type NodeStatus = 'muted' | 'healthy' | 'root' | 'blast' | 'healed' | 'fail'

export interface GraphNode {
  id: string
  label: string
  x: number
  y: number
}

export interface GraphEdge {
  from: string
  to: string
}

export const GRAPH_NODES: GraphNode[] = [
  { id: 'intake', label: 'INTAKE', x: 200, y: 28 },
  { id: 'coverage', label: 'COVERAGE', x: 72, y: 118 },
  { id: 'fraud', label: 'FRAUD', x: 328, y: 118 },
  { id: 'adjudicator', label: 'ADJUDICATOR', x: 200, y: 198 },
  { id: 'payout', label: 'PAYOUT', x: 200, y: 268 },
]

export const GRAPH_EDGES: GraphEdge[] = [
  { from: 'intake', to: 'coverage' },
  { from: 'intake', to: 'fraud' },
  { from: 'coverage', to: 'adjudicator' },
  { from: 'fraud', to: 'adjudicator' },
  { from: 'adjudicator', to: 'payout' },
]

export type InvestigationPhase =
  | 'incident'
  | 'corrupt'
  | 'blast'
  | 'localize'
  | 'replay'
  | 'heal'
  | 'trust'

export const PHASE_LABELS: Record<InvestigationPhase, string> = {
  incident: 'Failure occurs',
  corrupt: 'Bad hand-off detected',
  blast: 'Blast radius mapped',
  localize: 'Root cause localized',
  replay: 'Replay executed',
  heal: 'Fix confirmed',
  trust: 'Trust gate deployed',
}

export const ORBIT_CAPABILITIES = [
  { id: 'record', label: 'Record', tone: 'record' as const, phase: 'incident' as InvestigationPhase },
  { id: 'localize', label: 'Localize', tone: 'root' as const, phase: 'localize' as InvestigationPhase },
  { id: 'blast', label: 'Blast Radius', tone: 'blast' as const, phase: 'blast' as InvestigationPhase },
  { id: 'confirm', label: 'Confirm', tone: 'pass' as const, phase: 'replay' as InvestigationPhase },
  { id: 'supervise', label: 'Supervise', tone: 'trust' as const, phase: 'trust' as InvestigationPhase },
] as const

export interface AgentFeedLine {
  agent: string
  status: 'pending' | 'ok' | 'warn' | 'fail'
  detail: string
}

/** Initial success feed — then the corrupt hand-off lands. */
export const INCIDENT_FEED_SUCCESS: AgentFeedLine[] = [
  { agent: 'Coverage Agent', status: 'ok', detail: 'Approved' },
  { agent: 'Fraud Agent', status: 'ok', detail: 'Passed' },
  { agent: 'Adjudicator', status: 'ok', detail: 'Approved' },
  { agent: 'Payout Agent', status: 'ok', detail: 'Sent $12,500' },
]

export const INCIDENT_CORRUPT: AgentFeedLine = {
  agent: 'Coverage Agent',
  status: 'warn',
  detail: 'vehicle_type = motorcycle',
}

export function nodeStatusForPhase(phase: InvestigationPhase, nodeId: string): NodeStatus {
  switch (phase) {
    case 'incident':
      return nodeId === 'payout' ? 'healthy' : 'muted'
    case 'corrupt':
      return nodeId === 'coverage' ? 'root' : 'muted'
    case 'blast':
      if (nodeId === 'coverage') return 'root'
      if (['adjudicator', 'payout'].includes(nodeId)) return 'blast'
      return 'muted'
    case 'localize':
      if (nodeId === 'coverage') return 'root'
      if (['adjudicator', 'payout'].includes(nodeId)) return 'blast'
      return 'muted'
    case 'replay':
      if (nodeId === 'coverage') return 'healed'
      return 'muted'
    case 'heal':
      return 'healed'
    case 'trust':
      return 'healed'
  }
}

export function edgePoisoned(phase: InvestigationPhase, from: string, to: string): boolean {
  if (phase === 'incident' || phase === 'corrupt') return from === 'coverage' && phase === 'corrupt'
  if (phase === 'blast' || phase === 'localize') {
    const poisonPairs = [
      ['coverage', 'adjudicator'],
      ['adjudicator', 'payout'],
    ]
    return poisonPairs.some(([f, t]) => f === from && t === to)
  }
  return false
}

/** Interpolate replay slider 0 = failure, 1 = fix. */
export function nodeStatusForReplay(t: number, nodeId: string): NodeStatus {
  if (t < 0.15) return nodeStatusForPhase('blast', nodeId)
  if (t < 0.45) {
    if (nodeId === 'coverage') return t > 0.25 ? 'healed' : 'root'
    if (['adjudicator', 'payout'].includes(nodeId)) return t > 0.35 ? 'muted' : 'blast'
    return 'muted'
  }
  return nodeStatusForPhase('heal', nodeId)
}

export function replayLog(t: number): { level: string; msg: string }[] {
  if (t < 0.2) {
    return [
      { level: 'ERR', msg: 'oracle: payout $12,500 exceeds policy limit' },
      { level: 'WRN', msg: 'coverage hand-off vehicle_type=motorcycle (expected sedan)' },
      { level: 'INF', msg: 'blast radius: 2 agents downstream' },
    ]
  }
  if (t < 0.6) {
    return [
      { level: 'INF', msg: 'fork at COVERAGE · inject vehicle_type=sedan' },
      { level: 'INF', msg: 're-run 1/5 … payout $4,200' },
      { level: 'INF', msg: 're-run 5/5 … oracle PASS' },
    ]
  }
  return [
    { level: 'OK', msg: 'replay confirmed · fail → pass (5/5)' },
    { level: 'OK', msg: 'trust gate · auto_apply' },
    { level: 'OK', msg: 'payout sent · $4,200 to Acme Corp' },
  ]
}

export function replayMetrics(t: number) {
  const payout = t < 0.5 ? '$12,500' : '$4,200'
  const oracle = t < 0.5 ? 'FAIL' : 'PASS'
  const agents = t < 0.3 ? '2 poisoned' : t < 0.7 ? '1 corrected' : '5 healthy'
  return { payout, oracle, agents }
}

export const SYSTEM_MAP_NODES = [
  {
    id: 'coverage',
    label: 'Coverage',
    x: 24,
    y: 18,
    desc: 'Verifies policy limits and vehicle class against claim intake.',
    links: ['fraud', 'root'],
  },
  {
    id: 'fraud',
    label: 'Fraud',
    x: 76,
    y: 22,
    desc: 'Risk scoring on hand-offs — trusts upstream values blindly when corrupted.',
    links: ['coverage', 'payout'],
  },
  {
    id: 'payout',
    label: 'Payout',
    x: 76,
    y: 56,
    desc: 'Final oracle check — where symptoms surface, not where cause lives.',
    links: ['fraud', 'audit'],
  },
  {
    id: 'audit',
    label: 'Audit',
    x: 52,
    y: 64,
    desc: 'Immutable trace of every agent hand-off for compliance replay.',
    links: ['payout', 'replay'],
  },
  {
    id: 'root',
    label: 'Root Cause',
    x: 30,
    y: 40,
    desc: 'Earliest agent whose output doesn’t follow from its inputs.',
    links: ['coverage', 'blast'],
  },
  {
    id: 'blast',
    label: 'Blast Radius',
    x: 52,
    y: 36,
    desc: 'Forward slice — every downstream agent that inherited the bad value.',
    links: ['root', 'replay'],
  },
  {
    id: 'replay',
    label: 'Replay',
    x: 68,
    y: 46,
    desc: 'Fork, inject correction, re-run. Fail→pass confirms; no flip rejects.',
    links: ['blast', 'trust'],
  },
  {
    id: 'trust',
    label: 'Trust Gate',
    x: 38,
    y: 56,
    desc: 'Auto-heal proven fixes or escalate to human with structured correction.',
    links: ['replay', 'audit'],
  },
] as const

export type SystemMapNodeId = (typeof SYSTEM_MAP_NODES)[number]['id']
