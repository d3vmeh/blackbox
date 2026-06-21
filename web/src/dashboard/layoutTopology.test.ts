import { describe, it, expect } from 'vitest'
import { layoutTopology, NODE_W, NODE_H, COL_GAP, ROW_GAP, PAD } from './layoutTopology'
import { deriveTopology } from './deriveTopology'
import { deriveActions } from './deriveActions'
import { loadStubMultiAgentTrace, STUB_MULTI_ATTRIBUTION } from './data/stubMultiAgentTrace'
import type { AgentTopology } from './types'

const colOf = (x: number) => Math.round((x - PAD) / (NODE_W + COL_GAP))

describe('layoutTopology', () => {
  it('places the diamond wiring in causal columns (the flat strip hid this)', () => {
    const graph = deriveActions(loadStubMultiAgentTrace())
    const layout = layoutTopology(deriveTopology(graph, STUB_MULTI_ATTRIBUTION))
    const col = Object.fromEntries(layout.nodes.map((n) => [n.id, colOf(n.x)]))

    // intake → {coverage, fraud} → adjuster → payout: a diamond, not a line.
    expect(col).toEqual({ intake: 0, coverage: 1, fraud: 1, adjuster: 2, payout: 3 })

    // coverage and fraud share column 1 but sit on different rows.
    const coverage = layout.nodes.find((n) => n.id === 'coverage')!
    const fraud = layout.nodes.find((n) => n.id === 'fraud')!
    expect(coverage.x).toBe(fraud.x)
    expect(coverage.y).not.toBe(fraud.y)

    // one SVG path per handoff, poison flag carried through verbatim.
    expect(layout.edges).toHaveLength(5)
    expect(layout.edges.every((e) => e.d.startsWith('M'))).toBe(true)
    expect(layout.edges.filter((e) => e.poisoned)).toHaveLength(3)
  })

  it('lays a linear chain out as a single row of columns', () => {
    const topo: AgentTopology = {
      agents: [
        { id: 'a', label: 'a', status: 'root' },
        { id: 'b', label: 'b', status: 'blast' },
        { id: 'c', label: 'c', status: 'neutral' },
      ],
      handoffs: [
        { from: 'a', to: 'b', poisoned: true },
        { from: 'b', to: 'c', poisoned: false },
      ],
    }
    const layout = layoutTopology(topo)
    // all three on one row → equal y, increasing x.
    expect(new Set(layout.nodes.map((n) => n.y)).size).toBe(1)
    expect(layout.nodes.map((n) => colOf(n.x))).toEqual([0, 1, 2])
    expect(layout.height).toBe(PAD * 2 + NODE_H)
  })

  it('breaks a handoff cycle without inflating depth or looping forever', () => {
    const topo: AgentTopology = {
      agents: [
        { id: 'a', label: 'a', status: 'neutral' },
        { id: 'b', label: 'b', status: 'neutral' },
      ],
      handoffs: [
        { from: 'a', to: 'b', poisoned: false },
        { from: 'b', to: 'a', poisoned: false }, // back-edge (retry loop)
      ],
    }
    const layout = layoutTopology(topo) // must terminate (no infinite recursion)
    const a = colOf(layout.nodes.find((n) => n.id === 'a')!.x)
    const b = colOf(layout.nodes.find((n) => n.id === 'b')!.x)
    expect(Number.isFinite(a) && Number.isFinite(b)).toBe(true)
    expect(a).not.toBe(b) // distinct columns so the wire still draws
    expect(layout.edges).toHaveLength(2)
  })

  it('centers a shallow column against the tallest one', () => {
    // a → {b, c}: column 0 has one node, column 1 has two. The lone node centers.
    const topo: AgentTopology = {
      agents: [
        { id: 'a', label: 'a', status: 'neutral' },
        { id: 'b', label: 'b', status: 'neutral' },
        { id: 'c', label: 'c', status: 'neutral' },
      ],
      handoffs: [
        { from: 'a', to: 'b', poisoned: false },
        { from: 'a', to: 'c', poisoned: false },
      ],
    }
    const layout = layoutTopology(topo)
    const a = layout.nodes.find((n) => n.id === 'a')!
    const b = layout.nodes.find((n) => n.id === 'b')!
    const c = layout.nodes.find((n) => n.id === 'c')!
    expect(a.y).toBeCloseTo((b.y + c.y) / 2)
    expect(c.y - b.y).toBe(NODE_H + ROW_GAP)
  })
})
