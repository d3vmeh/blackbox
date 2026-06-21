// web/src/dashboard/layout.test.ts
import { describe, it, expect } from 'vitest'
import { layout, LANE_X, STEP_Y, TOP } from './layout'
import type { ActionGraph } from './types'

const graph: ActionGraph = {
  nodes: [
    { id: 'a0', stepIds: ['s0'], kind: 'reason', label: 'plan', lane: 'reason' },
    { id: 'a1', stepIds: ['s1'], kind: 'tool_call', label: 'tool', lane: 'tool' },
  ],
  edges: [{ from: 'a0', to: 'a1', longHop: false }],
}

describe('layout', () => {
  it('places nodes by order (y) and lane (x)', () => {
    const l = layout(graph, { a0: 'root', a1: 'blast' })
    expect(l.positions[0]).toEqual({ id: 'a0', x: LANE_X.reason, y: TOP })
    expect(l.positions[1]).toEqual({ id: 'a1', x: LANE_X.tool, y: TOP + STEP_Y })
  })

  it('emits an edge path string and flags poison', () => {
    const l = layout(graph, { a0: 'root', a1: 'blast' })
    expect(l.edges[0].poison).toBe(true)
    expect(l.edges[0].d.startsWith('M')).toBe(true)
  })

  it('reports a positive canvas size', () => {
    const l = layout(graph, { a0: 'neutral', a1: 'neutral' })
    expect(l.width).toBeGreaterThan(0)
    expect(l.height).toBeGreaterThan(0)
  })
})
