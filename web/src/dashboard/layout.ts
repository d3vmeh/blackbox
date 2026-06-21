// web/src/dashboard/layout.ts
import type { ActionGraph } from './types'
import { isPoisonEdge, type StatusMap } from './nodeStatus'

export const NODE_W = 172
export const NODE_H = 46
export const ROW_GAP = 96   // vertical distance between depth rows (top→down spine)
export const COL_GAP = 36   // horizontal gap between siblings in the same row
export const TOP = 28
export const PAD_X = 28

export interface NodePos { id: string; x: number; y: number }
export interface EdgePath { from: string; to: string; d: string; poison: boolean; longHop: boolean }
export interface GraphLayout { positions: NodePos[]; edges: EdgePath[]; width: number; height: number }

// Longest-path depth from the roots, over TRUE data-flow edges. A linear trace
// collapses to one centered column; fan-out/fan-in (spec → implementer+test_writer
// → reviewer) spreads siblings across a row. Subject-agnostic — no lanes.
function depths(graph: ActionGraph): Map<string, number> {
  const preds = new Map<string, string[]>()
  graph.nodes.forEach((n) => preds.set(n.id, []))
  graph.edges.forEach((e) => preds.get(e.to)?.push(e.from))
  const depth = new Map<string, number>()
  const visit = (id: string): number => {
    const cached = depth.get(id)
    if (cached !== undefined) return cached
    const ps = preds.get(id) ?? []
    const d = ps.length ? Math.max(...ps.map(visit)) + 1 : 0
    depth.set(id, d)
    return d
  }
  graph.nodes.forEach((n) => visit(n.id))
  return depth
}

export function layout(graph: ActionGraph, status: StatusMap): GraphLayout {
  const depth = depths(graph)
  const maxDepth = Math.max(0, ...graph.nodes.map((n) => depth.get(n.id) ?? 0))

  // group node ids into rows by depth, preserving run order within a row
  const rows: string[][] = Array.from({ length: maxDepth + 1 }, () => [])
  graph.nodes.forEach((n) => rows[depth.get(n.id) ?? 0].push(n.id))

  const rowWidth = (k: number) => k * NODE_W + Math.max(0, k - 1) * COL_GAP
  const widest = Math.max(1, ...rows.map((r) => r.length))
  const width = PAD_X * 2 + rowWidth(widest)
  const centerX = width / 2
  const height = TOP + (maxDepth + 1) * ROW_GAP

  const pos = new Map<string, NodePos>()
  rows.forEach((ids, d) => {
    const startX = centerX - rowWidth(ids.length) / 2
    ids.forEach((id, i) => {
      pos.set(id, { id, x: startX + i * (NODE_W + COL_GAP), y: TOP + d * ROW_GAP })
    })
  })

  const cx = (id: string) => pos.get(id)!.x + NODE_W / 2
  const topY = (id: string) => pos.get(id)!.y
  const botY = (id: string) => pos.get(id)!.y + NODE_H
  // edges leave the parent's bottom edge and arrive at the child's top edge
  const edges: EdgePath[] = graph.edges.map((e) => {
    const ax = cx(e.from), ay = botY(e.from), bx = cx(e.to), by = topY(e.to)
    const my = (ay + by) / 2
    return {
      from: e.from, to: e.to, longHop: e.longHop,
      poison: isPoisonEdge(e, status),
      d: `M${ax} ${ay} C ${ax} ${my}, ${bx} ${my}, ${bx} ${by}`,
    }
  })

  return { positions: graph.nodes.map((n) => pos.get(n.id)!), edges, width, height }
}
