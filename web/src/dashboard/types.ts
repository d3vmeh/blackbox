import type { StepKind } from '../types'

export type NodeStatus = 'neutral' | 'root' | 'blast' | 'decoy'
export type Lane = 'reason' | 'tool' | 'parallel'

export interface ActionNode {
  id: string            // 'a2'
  stepIds: string[]     // underlying Step.id(s), e.g. ['s2','s3']
  kind: StepKind        // representative kind (the call's kind for merged pairs)
  label: string         // short mono label for the chip
  lane: Lane
}

export interface ActionEdge {
  from: string          // action id
  to: string            // action id
  longHop: boolean      // underlying sequence distance > 1
}

export interface ActionGraph {
  nodes: ActionNode[]
  edges: ActionEdge[]
}
