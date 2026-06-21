import { describe, it, expect } from 'vitest'
import { nodeStatus, isPoisonEdge } from './nodeStatus'
import type { ActionGraph } from './types'
import type { Attribution } from '../types'

const graph: ActionGraph = {
  nodes: [
    { id: 'a0', stepIds: ['s0'], kind: 'reason', label: 'plan', lane: 'reason', agentId: null },
    { id: 'a1', stepIds: ['s2', 's3'], kind: 'tool_call', label: 'normalize_dates', lane: 'tool', agentId: null },
    { id: 'a2', stepIds: ['s4'], kind: 'reason', label: 'confirm', lane: 'reason', agentId: null },
    { id: 'a3', stepIds: ['s14'], kind: 'reason', label: 'relax', lane: 'reason', agentId: null },
  ],
  edges: [
    { from: 'a1', to: 'a2', longHop: false },
    { from: 'a0', to: 'a1', longHop: false },
  ],
}
const attribution: Attribution = {
  trace_id: 't', root_step_id: 's3', blast_radius: ['s4'],
  candidates: [
    { step_id: 's3', suspicion: 0.91, reason: 'date swap' },
    { step_id: 's14', suspicion: 0.4, reason: 'relaxed constraint' },
  ],
  rationale: 'misread date',
}

describe('nodeStatus', () => {
  it('marks root, blast, decoy, neutral with the right precedence', () => {
    const s = nodeStatus(graph, attribution)
    expect(s).toEqual({ a0: 'neutral', a1: 'root', a2: 'blast', a3: 'decoy' })
  })
})

describe('isPoisonEdge', () => {
  it('is true when poison flows from a blast node into a blast/decoy node', () => {
    const s = nodeStatus(graph, attribution)
    // blast (a2) → decoy (a3): the poison crosses this wire.
    expect(isPoisonEdge({ from: 'a2', to: 'a3', longHop: false }, s)).toBe(true)
  })
  it("does NOT poison the root's own outgoing wires (root is the focal, not a blast source)", () => {
    const s = nodeStatus(graph, attribution)
    // root (a1) → blast (a2): neutral wire — the root card carries the signal, not the edge.
    expect(isPoisonEdge({ from: 'a1', to: 'a2', longHop: false }, s)).toBe(false)
    // neutral (a0) → root (a1): never poison.
    expect(isPoisonEdge({ from: 'a0', to: 'a1', longHop: false }, s)).toBe(false)
  })
})
