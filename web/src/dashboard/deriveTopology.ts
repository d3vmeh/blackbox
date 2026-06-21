import type { ActionGraph, ActionNode, AgentTopology, NodeStatus } from './types'
import type { AgentId, Attribution } from '../types'

/**
 * Derive the compact agent-wiring DAG that renders above the trace spine:
 * one node per agent (first-seen order) plus handoff edges inferred from
 * cross-agent data-flow.
 *
 * Pure: same `(graph, attribution)` in ⇒ same topology out. Domain-agnostic —
 * it reads agent identity from `node.agentId` (sourced from `raw['agent']`) and
 * never hardcodes a closed agent set. Agents are differentiated by POSITION +
 * LABEL only; the three reserved signal hues mean exactly one thing each and are
 * applied downstream from the `status` field, never invented here.
 *
 * Status mapping (mirrors the spine's node-status rule, lifted to agent grain):
 *   - root  → the agent that OWNS attribution.root_step_id
 *   - blast → an agent containing any blast_radius step (but not the root agent)
 *   - neutral → everyone else
 *
 * Handoffs: a cross-agent data-flow edge (a node whose parent node belongs to a
 * DIFFERENT agent) becomes an edge from the parent's agent to this node's agent.
 * `poisoned` is true when the SOURCE node carries any blast-radius step — i.e.
 * the poison crosses that wire. Edges are deduped on (from, to).
 */
export function deriveTopology(graph: ActionGraph, attribution: Attribution): AgentTopology {
  const blast = new Set(attribution.blast_radius)

  // node id -> node, for fast parent-agent lookup.
  const nodeById = new Map<string, ActionNode>(graph.nodes.map((n) => [n.id, n]))

  // Which agent owns the root step, and which agents touch the blast set.
  let rootAgent: AgentId | null = null
  const blastAgents = new Set<AgentId>()
  for (const node of graph.nodes) {
    if (node.agentId === null) continue
    if (node.stepIds.includes(attribution.root_step_id)) rootAgent = node.agentId
    if (node.stepIds.some((s) => blast.has(s))) blastAgents.add(node.agentId)
  }

  const statusFor = (agentId: AgentId): NodeStatus => {
    if (agentId === rootAgent) return 'root'
    if (blastAgents.has(agentId)) return 'blast'
    return 'neutral'
  }

  // agents[] in first-seen order, deduped.
  const seen = new Set<AgentId>()
  const agents: AgentTopology['agents'] = []
  for (const node of graph.nodes) {
    const id = node.agentId
    if (id === null || seen.has(id)) continue
    seen.add(id)
    agents.push({ id, label: id, status: statusFor(id) })
  }

  // Does this node touch the blast set? (the wire it feeds carries poison)
  const nodePoisoned = (node: ActionNode): boolean => node.stepIds.some((s) => blast.has(s))

  // handoffs[] from cross-agent edges, deduped on (from, to).
  const handoffs: AgentTopology['handoffs'] = []
  const edgeKeys = new Set<string>()
  for (const edge of graph.edges) {
    const from = nodeById.get(edge.from)
    const to = nodeById.get(edge.to)
    if (!from || !to) continue
    const fromAgent = from.agentId
    const toAgent = to.agentId
    if (fromAgent === null || toAgent === null || fromAgent === toAgent) continue
    const key = `${fromAgent}->${toAgent}`
    if (edgeKeys.has(key)) continue
    edgeKeys.add(key)
    handoffs.push({ from: fromAgent, to: toAgent, poisoned: nodePoisoned(from) })
  }

  return { agents, handoffs }
}
