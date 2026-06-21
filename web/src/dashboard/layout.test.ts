// web/src/dashboard/layout.test.ts
import { describe, it, expect } from 'vitest'
import { layout, ROW_GAP, TOP } from './layout'
import type { ActionGraph } from './types'

// linear: a0 -> a1
const linear: ActionGraph = {
  nodes: [
    { id: 'a0', stepIds: ['s0'], kind: 'reason', label: 'plan', lane: 'reason' },
    { id: 'a1', stepIds: ['s1'], kind: 'decision', label: 'decide', lane: 'reason' },
  ],
  edges: [{ from: 'a0', to: 'a1', longHop: false }],
}

// diamond: a0 -> a1, a0 -> a2, a1 -> a3, a2 -> a3 (spec → impl+test → review)
const diamond: ActionGraph = {
  nodes: [
    { id: 'a0', stepIds: ['s0'], kind: 'decision', label: 'spec', lane: 'reason' },
    { id: 'a1', stepIds: ['s1'], kind: 'decision', label: 'impl', lane: 'reason' },
    { id: 'a2', stepIds: ['s2'], kind: 'decision', label: 'test', lane: 'reason' },
    { id: 'a3', stepIds: ['s3'], kind: 'final', label: 'review', lane: 'reason' },
  ],
  edges: [
    { from: 'a0', to: 'a1', longHop: false },
    { from: 'a0', to: 'a2', longHop: false },
    { from: 'a1', to: 'a3', longHop: false },
    { from: 'a2', to: 'a3', longHop: false },
  ],
}

describe('layout', () => {
  it('stacks a linear trace in one centered column, one row per depth', () => {
    const l = layout(linear, { a0: 'root', a1: 'blast' })
    const [p0, p1] = l.positions
    expect(p0.y).toBe(TOP)
    expect(p1.y).toBe(TOP + ROW_GAP)
    expect(p0.x).toBe(p1.x) // single-node rows share the centerline
  })

  it('spreads siblings across a row and converges them (diamond)', () => {
    const l = layout(diamond, {})
    const by = Object.fromEntries(l.positions.map((p) => [p.id, p]))
    expect(by.a1.y).toBe(by.a2.y)          // impl + test share the middle row
    expect(by.a1.x).toBeLessThan(by.a2.x)  // and sit side by side
    expect(by.a0.x).toBe(by.a3.x)          // spec + review share the centerline
    expect(by.a3.y).toBe(TOP + 2 * ROW_GAP) // review is two rows below spec
  })

  it('emits an edge path string and flags poison', () => {
    const l = layout(linear, { a0: 'root', a1: 'blast' })
    expect(l.edges[0].poison).toBe(true)
    expect(l.edges[0].d.startsWith('M')).toBe(true)
  })

  it('reports a positive canvas size', () => {
    const l = layout(diamond, {})
    expect(l.width).toBeGreaterThan(0)
    expect(l.height).toBeGreaterThan(0)
  })
})
