import { describe, it, expect } from 'vitest'
import { nodeStatus } from './nodeStatus'
import type { ActionGraph } from './types'
import type { Attribution } from '../types'

const graph: ActionGraph = {
  nodes: [
    { id: 'a0', stepIds: ['s0'], kind: 'reason', label: 'plan', lane: 'reason' },
    { id: 'a1', stepIds: ['s2', 's3'], kind: 'tool_call', label: 'normalize_dates', lane: 'tool' },
    { id: 'a2', stepIds: ['s4'], kind: 'reason', label: 'confirm', lane: 'reason' },
    { id: 'a3', stepIds: ['s14'], kind: 'reason', label: 'relax', lane: 'reason' },
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
