/** Shared investigation narrative — insurance hero graph + system map. */

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
  { id: 'adjuster', label: 'ADJUSTER', x: 200, y: 198 },
  { id: 'payout', label: 'PAYOUT', x: 200, y: 268 },
]

export const GRAPH_EDGES: GraphEdge[] = [
  { from: 'intake', to: 'coverage' },
  { from: 'intake', to: 'fraud' },
  { from: 'coverage', to: 'adjuster' },
  { from: 'fraud', to: 'adjuster' },
  { from: 'adjuster', to: 'payout' },
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

export const INCIDENT_FEED_SUCCESS: AgentFeedLine[] = [
  { agent: 'INTAKE', status: 'ok', detail: 'Parsed claim M-8842' },
  { agent: 'COVERAGE', status: 'ok', detail: 'Gold tier · within limit' },
  { agent: 'FRAUD', status: 'ok', detail: 'Risk 0.12 · overridden' },
  { agent: 'ADJUSTER', status: 'ok', detail: 'Payout $52,000' },
  { agent: 'PAYOUT', status: 'fail', detail: 'Oracle FAIL · exceeds cap' },
]

export const INCIDENT_CORRUPT: AgentFeedLine = {
  agent: 'INTAKE',
  status: 'warn',
  detail: 'billed_amount = $52,000 (should $5,200)',
}

export function nodeStatusForPhase(phase: InvestigationPhase, nodeId: string): NodeStatus {
  switch (phase) {
    case 'incident':
      return nodeId === 'payout' ? 'fail' : 'muted'
    case 'corrupt':
      return nodeId === 'intake' ? 'root' : 'muted'
    case 'blast':
      if (nodeId === 'intake') return 'root'
      if (['coverage', 'fraud', 'adjuster', 'payout'].includes(nodeId)) return 'blast'
      return 'muted'
    case 'localize':
      if (nodeId === 'intake') return 'root'
      if (['coverage', 'fraud', 'adjuster', 'payout'].includes(nodeId)) return 'blast'
      return 'muted'
    case 'replay':
      if (nodeId === 'intake') return 'healed'
      return 'muted'
    case 'heal':
      return 'healed'
    case 'trust':
      return 'healed'
  }
}

export function edgePoisoned(phase: InvestigationPhase, from: string, to: string): boolean {
  if (phase === 'corrupt') return from === 'intake'
  if (phase === 'blast' || phase === 'localize') {
    const poisonPairs = [
      ['intake', 'coverage'],
      ['intake', 'fraud'],
      ['coverage', 'adjuster'],
      ['fraud', 'adjuster'],
      ['adjuster', 'payout'],
    ]
    return poisonPairs.some(([f, t]) => f === from && t === to)
  }
  return false
}

export function nodeStatusForReplay(t: number, nodeId: string): NodeStatus {
  if (t < 0.15) return nodeStatusForPhase('blast', nodeId)
  if (t < 0.45) {
    if (nodeId === 'intake') return t > 0.25 ? 'healed' : 'root'
    if (['coverage', 'fraud', 'adjuster', 'payout'].includes(nodeId)) return t > 0.35 ? 'muted' : 'blast'
    return 'muted'
  }
  return nodeStatusForPhase('heal', nodeId)
}

export function replayLog(t: number): { level: string; msg: string }[] {
  if (t < 0.2) {
    return [
      { level: 'ERR', msg: 'oracle: payout $52,000 exceeds gold tier cap ($8,000)' },
      { level: 'WRN', msg: 'INTAKE hand-off billed_amount=52000 (expected 5200)' },
      { level: 'INF', msg: 'blast radius: 4 agents downstream' },
    ]
  }
  if (t < 0.6) {
    return [
      { level: 'INF', msg: 'fork @ intake · inject billed_amount=5200.0' },
      { level: 'INF', msg: 're-run 1/5 … payout $5,200' },
      { level: 'INF', msg: 're-run 5/5 … oracle PASS' },
    ]
  }
  return [
    { level: 'OK', msg: 'replay confirmed · fail → pass (5/5)' },
    { level: 'OK', msg: 'trust gate · auto_apply' },
    { level: 'OK', msg: 'payout sent · $5,200 to member M-8842' },
  ]
}

export function replayMetrics(t: number) {
  const payout = t < 0.5 ? '$52,000' : '$5,200'
  const oracle = t < 0.5 ? 'FAIL' : 'PASS'
  const agents = t < 0.3 ? '4 poisoned' : t < 0.7 ? '1 corrected' : '5 healthy'
  return { payout, oracle, agents }
}

export const SYSTEM_MAP_NODES = [
  {
    id: 'intake',
    label: 'INTAKE',
    x: 24,
    y: 18,
    desc: 'Parses claim form → structured hand-off {member_id, procedure, billed_amount, policy_tier}.',
    links: ['coverage', 'root'],
  },
  {
    id: 'coverage',
    label: 'COVERAGE',
    x: 76,
    y: 22,
    desc: 'Verifies procedure against tier limits — trusts INTAKE billed_amount blindly.',
    links: ['intake', 'fraud'],
  },
  {
    id: 'fraud',
    label: 'FRAUD',
    x: 76,
    y: 56,
    desc: 'Parallel anomaly scan; can flag but be overridden downstream.',
    links: ['coverage', 'adjuster'],
  },
  {
    id: 'adjuster',
    label: 'ADJUSTER',
    x: 52,
    y: 64,
    desc: 'Merges coverage + fraud → payout decision. Decoy fix target — replay does not flip.',
    links: ['fraud', 'payout'],
  },
  {
    id: 'payout',
    label: 'PAYOUT',
    x: 30,
    y: 40,
    desc: 'Payment rail + oracle — symptom surfaces here, root lives at INTAKE.',
    links: ['adjuster', 'replay'],
  },
  {
    id: 'root',
    label: 'Root Cause',
    x: 30,
    y: 56,
    desc: 'Earliest agent whose output doesn’t follow from its inputs — INTAKE decimal slip.',
    links: ['intake', 'blast'],
  },
  {
    id: 'blast',
    label: 'Blast Radius',
    x: 52,
    y: 36,
    desc: 'Forward slice — COVERAGE, FRAUD, ADJUSTER, PAYOUT inherited $52k.',
    links: ['root', 'replay'],
  },
  {
    id: 'replay',
    label: 'Replay',
    x: 68,
    y: 46,
    desc: 'LangGraph update_state(as_node="intake") + re-invoke. Fail→pass confirms root.',
    links: ['blast', 'trust'],
  },
  {
    id: 'trust',
    label: 'Trust Gate',
    x: 38,
    y: 56,
    desc: 'Auto-heal proven fixes or escalate with {root_step, blast_radius, replay_rate}.',
    links: ['replay', 'payout'],
  },
] as const

export type SystemMapNodeId = (typeof SYSTEM_MAP_NODES)[number]['id']
