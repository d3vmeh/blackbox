// web/src/dashboard/layout.ts
// Node-link layout for the trace graph: nodes stack top→down by time order, with
// an x offset per lane (reason · tool · parallel), and curved bezier connectors
// between sequenced actions. Poisoned edges (root/blast → blast/decoy) and
// long-hop edges are flagged here so the renderer styles them per DESIGN.md.
//
// Band-aware: nodes are grouped into contiguous per-agent AgentBands (deriveBands).
// Within a band nodes keep STEP_Y row spacing; an extra BAND_GAP of whitespace is
// inserted before each band after the first, so same-agent nodes read as a cluster.
// A reserved GUTTER_W left gutter holds the per-agent label. Grouping is expressed
// only by POSITION (gap), a LABEL, and a hairline SEPARATOR — never a 4th hue.
//
// Fork-aware: when a ForkBranch is present (confirmed replay), synthetic corrected
// nodes are positioned in a second column to the right, aligned vertically with
// their original counterparts. A fork edge connects the root to the first fork node.
import type { ActionGraph, ActionNode, ForkBranch, Lane } from './types'
import { isPoisonEdge, type StatusMap } from './nodeStatus'
import { deriveBands } from './deriveBands'

export const LANE_X: Record<Lane, number> = { reason: 14, tool: 200, parallel: 382 }
export const STEP_Y = 44
export const TOP = 24
export const NODE_W = 138
export const NODE_H = 38
// Extra vertical whitespace inserted before each band after the first (8pt grid).
export const BAND_GAP = 24
// Reserved left gutter holding the per-band agent label.
export const GUTTER_W = 28
// The fork column is placed FORK_GAP px to the right of the widest original lane.
export const FORK_GAP = 80
export const FORK_NODE_W = 172

export interface NodePos { id: string; x: number; y: number }
export interface EdgePath { from: string; to: string; d: string; poison: boolean; longHop: boolean; crossAgent: boolean; fork?: boolean }
export interface BandLayout { agentId: string; label: string; top: number; bottom: number; isRoot: boolean }
export interface SeparatorPos { y: number }
export interface GraphLayout {
  positions: NodePos[]
  edges: EdgePath[]
  bands: BandLayout[]
  separators: SeparatorPos[]
  width: number
  height: number
  /** Fork branch positions + edges (only when a confirmed fork is present). */
  forkPositions: NodePos[]
  forkEdges: EdgePath[]
  /** X position of the fork column (for placing the "FIX" label). */
  forkX: number
}

export function layout(graph: ActionGraph, status: StatusMap, forkBranch?: ForkBranch | null): GraphLayout {
  const bands = deriveBands(graph)
  const nodeById = new Map<string, ActionNode>(graph.nodes.map((n) => [n.id, n]))
  const pos = new Map<string, NodePos>()
  const bandLayouts: BandLayout[] = []
  const separators: SeparatorPos[] = []

  let cursor = TOP
  bands.forEach((band, bi) => {
    if (bi > 0) {
      // record a separator at the midpoint of the inter-band gap, then advance.
      separators.push({ y: cursor + BAND_GAP / 2 })
      cursor += BAND_GAP
    }
    const top = cursor
    let lastNodeTop = cursor
    for (const nodeId of band.nodeIds) {
      const n = nodeById.get(nodeId)
      if (!n) continue
      pos.set(nodeId, { id: nodeId, x: GUTTER_W + LANE_X[n.lane], y: cursor })
      lastNodeTop = cursor
      cursor += STEP_Y
    }
    const isRoot = band.nodeIds.some((id) => status[id] === 'root')
    bandLayouts.push({ agentId: band.agentId, label: band.label, top, bottom: lastNodeTop + NODE_H, isRoot })
  })

  const cx = (id: string) => (pos.get(id)!.x) + NODE_W / 2
  const cy = (id: string) => (pos.get(id)!.y) + NODE_H / 2
  const agentOf = (id: string) => nodeById.get(id)?.agentId ?? null
  const kindOf = (id: string) => nodeById.get(id)?.kind
  const edges: EdgePath[] = graph.edges.map((e) => {
    const ax = cx(e.from), ay = cy(e.from), bx = cx(e.to), by = cy(e.to)
    const my = (ay + by) / 2
    const crossAgent =
      agentOf(e.from) !== agentOf(e.to) || kindOf(e.from) === 'handoff' || kindOf(e.to) === 'handoff'
    return {
      from: e.from, to: e.to, longHop: e.longHop, crossAgent,
      poison: isPoisonEdge(e, status),
      d: `M${ax} ${ay} C ${ax} ${my}, ${bx} ${my}, ${bx} ${by}`,
    }
  })

  // ---- Fork branch layout (when a confirmed replay provides one) ----
  const baseWidth = GUTTER_W + LANE_X.parallel + NODE_W + 40
  const forkX = baseWidth + FORK_GAP
  const forkPositions: NodePos[] = []
  const forkEdges: EdgePath[] = []

  if (forkBranch) {
    // Position each fork node at the same Y as its original counterpart,
    // but in the fork column to the right.
    for (const fn of forkBranch.nodes) {
      const origPos = pos.get(fn.originalId)
      if (!origPos) continue
      forkPositions.push({ id: fn.id, x: forkX, y: origPos.y })
    }

    const forkPos = new Map(forkPositions.map((p) => [p.id, p]))

    // Fork connector: horizontal dashed line from root-cause node to the
    // first fork node (the corrected copy of the root).
    if (forkBranch.nodes.length > 0) {
      const originPos = pos.get(forkBranch.originNodeId)
      const firstFork = forkPos.get(forkBranch.nodes[0].id)
      if (originPos && firstFork) {
        const ox = originPos.x + NODE_W
        const oy = originPos.y + NODE_H / 2
        const fx = firstFork.x
        const fy = firstFork.y + NODE_H / 2
        const mx = (ox + fx) / 2
        forkEdges.push({
          from: forkBranch.originNodeId,
          to: forkBranch.nodes[0].id,
          d: `M${ox} ${oy} C ${mx} ${oy}, ${mx} ${fy}, ${fx} ${fy}`,
          poison: false, longHop: false, crossAgent: false, fork: true,
        })
      }
    }

    // Sequential edges between fork nodes (vertical spine)
    for (const e of forkBranch.edges) {
      const fp = forkPos.get(e.from)
      const tp = forkPos.get(e.to)
      if (!fp || !tp) continue
      const ax = fp.x + FORK_NODE_W / 2, ay = fp.y + NODE_H / 2
      const bx = tp.x + FORK_NODE_W / 2, by = tp.y + NODE_H / 2
      const my = (ay + by) / 2
      forkEdges.push({
        from: e.from, to: e.to,
        d: `M${ax} ${ay} C ${ax} ${my}, ${bx} ${my}, ${bx} ${by}`,
        poison: false, longHop: false, crossAgent: false, fork: true,
      })
    }
  }

  const width = forkBranch && forkPositions.length > 0
    ? forkX + FORK_NODE_W + 40
    : baseWidth
  const height = cursor + 20
  return {
    positions: graph.nodes.map((n) => pos.get(n.id)!),
    edges,
    bands: bandLayouts,
    separators,
    width,
    height,
    forkPositions,
    forkEdges,
    forkX,
  }
}
