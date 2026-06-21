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

/**
 * A synthetic "corrected" copy of an original blast-radius node, shown in the
 * fork branch after a confirmed replay. Visual-only — no real backend trace.
 */
export interface ForkNode {
  id: string            // e.g. 'a1-fix'
  originalId: string    // the blast-radius action node this mirrors
  label: string         // corrected label
  kind: StepKind
  correctedOutput?: Json  // injected_value for root, undefined for blast
}

/**
 * The corrected branch that forks off the root-cause node after a successful
 * replay. Rendered as a parallel column to the right of the original graph.
 */
export interface ForkBranch {
  /** The root-cause action node where the fork originates */
  originNodeId: string
  /** Synthetic corrected nodes, in spine order (root-cause copy first) */
  nodes: ForkNode[]
  /** Sequential edges between fork nodes */
  edges: { from: string; to: string }[]
}
