import type { ActionEdge, ActionGraph, NodeStatus } from './types'
import type { Attribution } from '../types'

export type StatusMap = Record<string, NodeStatus>

export function nodeStatus(graph: ActionGraph, attribution: Attribution): StatusMap {
  const blast = new Set(attribution.blast_radius)
  const decoyStepId = attribution.candidates[1]?.step_id
  const map: StatusMap = {}
  for (const node of graph.nodes) {
    if (node.stepIds.includes(attribution.root_step_id)) map[node.id] = 'root'
    else if (node.stepIds.some((s) => blast.has(s))) map[node.id] = 'blast'
    else if (decoyStepId && node.stepIds.includes(decoyStepId)) map[node.id] = 'decoy'
    else map[node.id] = 'neutral'
  }
  return map
}

// An edge is "poisoned" when the root cause / blast flows into a downstream blast
// (or the decoy) node — these connectors carry --blast in the graph view.
const SRC = new Set<NodeStatus>(['root', 'blast'])
const DST = new Set<NodeStatus>(['blast', 'decoy'])

export function isPoisonEdge(edge: ActionEdge, status: StatusMap): boolean {
  return SRC.has(status[edge.from] ?? 'neutral') && DST.has(status[edge.to] ?? 'neutral')
}
