// web/src/dashboard/layout.ts
import type { ActionGraph, Lane } from './types'
import { isPoisonEdge, type StatusMap } from './nodeStatus'

export const LANE_X: Record<Lane, number> = { reason: 14, tool: 200, parallel: 382 }
export const STEP_Y = 44
export const TOP = 24
export const NODE_W = 138
export const NODE_H = 38

export interface NodePos { id: string; x: number; y: number }
export interface EdgePath { from: string; to: string; d: string; poison: boolean; longHop: boolean }
export interface GraphLayout { positions: NodePos[]; edges: EdgePath[]; width: number; height: number }

export function layout(graph: ActionGraph, status: StatusMap): GraphLayout {
  const pos = new Map<string, NodePos>()
  graph.nodes.forEach((n, i) => {
    pos.set(n.id, { id: n.id, x: LANE_X[n.lane], y: TOP + i * STEP_Y })
  })
  const cx = (id: string) => (pos.get(id)!.x) + NODE_W / 2
  const cy = (id: string) => (pos.get(id)!.y) + NODE_H / 2
  const edges: EdgePath[] = graph.edges.map((e) => {
    const ax = cx(e.from), ay = cy(e.from), bx = cx(e.to), by = cy(e.to)
    const my = (ay + by) / 2
    return {
      from: e.from, to: e.to, longHop: e.longHop,
      poison: isPoisonEdge(e, status),
      d: `M${ax} ${ay} C ${ax} ${my}, ${bx} ${my}, ${bx} ${by}`,
    }
  })
  const width = LANE_X.parallel + NODE_W + 40
  const height = TOP + graph.nodes.length * STEP_Y + 20
  return { positions: graph.nodes.map((n) => pos.get(n.id)!), edges, width, height }
}
