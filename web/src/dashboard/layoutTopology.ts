// web/src/dashboard/layoutTopology.ts
// Layered left→right layout for the agent-wiring DAG (the macro lens above the
// spine). Each agent node is placed in a COLUMN by its causal depth (longest
// handoff path from a source agent) and a ROW among its same-depth siblings.
//
// A linear run (A→B→C→…) lays out as a single row of columns — visually the same
// horizontal strip as before. A branch (one agent handing off to two, or two
// feeding one) simply adds rows in a column; the component never changes. That is
// the whole point: topology earns its space the moment the wiring stops being a
// straight line, with no rewrite.
//
// Pure: same AgentTopology in ⇒ same layout out. Carries no color — status rides
// through to the renderer, which applies the three reserved signals per DESIGN.md.
import type { AgentTopology, NodeStatus } from './types'
import type { AgentId } from '../types'

// Node box — fixed so columns align; wide enough for a full agent name (PAYOUT,
// ADJUSTER) in --t-label mono. Must match .topo__node sizing in Topology.css.
export const NODE_W = 132
export const NODE_H = 36
// Column gap leaves room for the handoff edge (the protagonist); row gap keeps
// sibling branches on the 8pt grid.
export const COL_GAP = 56
export const ROW_GAP = 16
export const PAD = 6

export interface TopoNode {
  id: AgentId
  label: string
  status: NodeStatus
  x: number
  y: number
}
export interface TopoEdge {
  from: AgentId
  to: AgentId
  poisoned: boolean
  d: string // SVG cubic-bezier path, left→right
}
export interface TopoLayout {
  nodes: TopoNode[]
  edges: TopoEdge[]
  width: number
  height: number
}

/**
 * Longest-path depth of each agent over the handoff DAG. Source agents (no
 * incoming handoff) sit at depth 0; every other agent sits one past its deepest
 * predecessor. A cycle (retry loop / back-handoff) is broken by an on-stack guard
 * so a back-edge never inflates depth or loops forever.
 */
function depths(agentIds: AgentId[], preds: Map<AgentId, AgentId[]>): Map<AgentId, number> {
  const depth = new Map<AgentId, number>()
  const stack = new Set<AgentId>()

  const visit = (id: AgentId): number => {
    const cached = depth.get(id)
    if (cached !== undefined) return cached
    if (stack.has(id)) return 0 // cycle: treat the back-edge as no deeper
    stack.add(id)
    let d = 0
    for (const p of preds.get(id) ?? []) d = Math.max(d, visit(p) + 1)
    stack.delete(id)
    depth.set(id, d)
    return d
  }

  for (const id of agentIds) visit(id)
  return depth
}

/** Cubic bezier from the right edge of `from` to the left edge of `to`. */
function edgePath(a: TopoNode, b: TopoNode): string {
  const x1 = a.x + NODE_W
  const y1 = a.y + NODE_H / 2
  const x2 = b.x
  const y2 = b.y + NODE_H / 2
  const cx = (x1 + x2) / 2
  return `M${x1},${y1} C${cx},${y1} ${cx},${y2} ${x2},${y2}`
}

export function layoutTopology(topology: AgentTopology): TopoLayout {
  const { agents, handoffs } = topology
  const order = new Map(agents.map((a, i) => [a.id, i]))

  // Predecessor adjacency from handoffs (ignore self-loops for layering).
  const preds = new Map<AgentId, AgentId[]>()
  for (const h of handoffs) {
    if (h.from === h.to) continue
    const list = preds.get(h.to) ?? []
    list.push(h.from)
    preds.set(h.to, list)
  }

  const depth = depths(
    agents.map((a) => a.id),
    preds,
  )

  // Group agents by column (depth), each column ordered by first-seen index so
  // rows are stable across renders.
  const byCol = new Map<number, AgentId[]>()
  for (const a of agents) {
    const d = depth.get(a.id) ?? 0
    const col = byCol.get(d) ?? []
    col.push(a.id)
    byCol.set(d, col)
  }
  for (const col of byCol.values()) col.sort((x, y) => (order.get(x)! - order.get(y)!))

  const maxCol = Math.max(0, ...byCol.keys())
  const maxRows = Math.max(1, ...[...byCol.values()].map((c) => c.length))

  // Vertically center each column's rows within the tallest column.
  const fullHeight = maxRows * NODE_H + (maxRows - 1) * ROW_GAP
  const placed = new Map<AgentId, TopoNode>()
  const nodes: TopoNode[] = agents.map((a) => {
    const d = depth.get(a.id) ?? 0
    const col = byCol.get(d)!
    const row = col.indexOf(a.id)
    const colHeight = col.length * NODE_H + (col.length - 1) * ROW_GAP
    const yStart = PAD + (fullHeight - colHeight) / 2
    const node: TopoNode = {
      id: a.id,
      label: a.label,
      status: a.status,
      x: PAD + d * (NODE_W + COL_GAP),
      y: yStart + row * (NODE_H + ROW_GAP),
    }
    placed.set(a.id, node)
    return node
  })

  const edges: TopoEdge[] = handoffs
    .filter((h) => h.from !== h.to && placed.has(h.from) && placed.has(h.to))
    .map((h) => ({
      from: h.from,
      to: h.to,
      poisoned: h.poisoned,
      d: edgePath(placed.get(h.from)!, placed.get(h.to)!),
    }))

  return {
    nodes,
    edges,
    width: PAD * 2 + (maxCol + 1) * NODE_W + maxCol * COL_GAP,
    height: PAD * 2 + fullHeight,
  }
}
