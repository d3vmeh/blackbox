import type { AgentId, StepKind } from '../types'

export type NodeStatus = 'neutral' | 'root' | 'blast' | 'decoy' | 'pass'
export type Lane = 'reason' | 'tool' | 'parallel'

export interface ActionNode {
  id: string            // 'a2'
  stepIds: string[]     // underlying Step.id(s), e.g. ['s2','s3']
  kind: StepKind        // representative kind (the call's kind for merged pairs)
  label: string         // short mono label for the chip
  lane: Lane
  agentId: AgentId | null // owning agent (raw['agent']) of the representative step; null = single-agent
}

/**
 * A contiguous group of trace rows that belong to one agent — the time-ordered
 * spine is grouped into these bands, separated by a surface-step + --hair
 * hairline (NEVER a 4th hue). `parallelGroupIds` lists sets of node ids that run
 * at the same time index (e.g. MATCHER∥FRAUD) so they can render as adjacent rows.
 */
export interface AgentBand {
  agentId: AgentId
  label: string
  nodeIds: string[]
  parallelGroupIds?: string[][]
}

/**
 * The compact agent-wiring DAG drawn above the spine: agent nodes + handoff
 * edges. The root agent carries --root, the poisoned handoff path carries --blast.
 */
export interface AgentTopology {
  agents: { id: AgentId; label: string; status: NodeStatus }[]
  handoffs: { from: AgentId; to: AgentId; poisoned: boolean }[]
}

/** TrustBadge lifecycle: untrusted (idle/decoy) → proving (replaying) → trusted (flip). */
export type TrustState = 'untrusted' | 'proving' | 'trusted'

export interface ActionEdge {
  from: string          // action id
  to: string            // action id
  longHop: boolean      // underlying sequence distance > 1
}

export interface ActionGraph {
  nodes: ActionNode[]
  edges: ActionEdge[]
}
