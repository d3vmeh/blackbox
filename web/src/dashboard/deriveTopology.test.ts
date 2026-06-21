import { describe, it, expect } from 'vitest'
import { deriveTopology } from './deriveTopology'
import { deriveActions } from './deriveActions'
import { loadStubMultiAgentTrace, STUB_MULTI_ATTRIBUTION } from './data/stubMultiAgentTrace'
import type { ActionGraph } from './types'
import type { Attribution } from '../types'

describe('deriveTopology', () => {
  it('derives the multi-agent wiring DAG with a root agent and a poisoned path', () => {
    const graph = deriveActions(loadStubMultiAgentTrace())
    const topo = deriveTopology(graph, STUB_MULTI_ATTRIBUTION)

    // agents in first-seen order, deduped (intake → coverage → fraud → adjuster → payout).
    expect(topo.agents.map((a) => a.id)).toEqual([
      'intake',
      'coverage',
      'fraud',
      'adjuster',
      'payout',
    ])

    // status: intake owns root s1 ⇒ 'root'; downstream agents on blast path ⇒ 'blast'.
    const status = Object.fromEntries(topo.agents.map((a) => [a.id, a.status]))
    expect(status).toEqual({
      intake: 'root',
      coverage: 'blast',
      fraud: 'blast',
      adjuster: 'blast',
      payout: 'blast',
    })

    // label defaults to the agent id (position + label, never a hue).
    expect(topo.agents.every((a) => a.label === a.id)).toBe(true)

    expect(topo.handoffs).toEqual([
      { from: 'intake', to: 'coverage', poisoned: false },
      { from: 'intake', to: 'fraud', poisoned: false },
      { from: 'coverage', to: 'adjuster', poisoned: true },
      { from: 'fraud', to: 'adjuster', poisoned: true },
      { from: 'adjuster', to: 'payout', poisoned: true },
    ])
  })

  it('dedupes parallel cross-agent edges between the same agent pair', () => {
    // Two distinct nodes from agent A both feed agent B ⇒ a single A→B handoff.
    const graph: ActionGraph = {
      nodes: [
        { id: 'a0', stepIds: ['s0'], kind: 'reason', label: 'a0', lane: 'reason', agentId: 'A' },
        { id: 'a1', stepIds: ['s1'], kind: 'reason', label: 'a1', lane: 'reason', agentId: 'A' },
        { id: 'a2', stepIds: ['s2'], kind: 'reason', label: 'a2', lane: 'reason', agentId: 'B' },
      ],
      edges: [
        { from: 'a0', to: 'a2', longHop: false },
        { from: 'a1', to: 'a2', longHop: false },
      ],
    }
    const attribution: Attribution = {
      trace_id: 't',
      root_step_id: 's0',
      blast_radius: ['s0', 's2'],
      candidates: [{ step_id: 's0', suspicion: 0.9, reason: 'root' }],
      rationale: 'root at s0',
    }
    const topo = deriveTopology(graph, attribution)
    expect(topo.handoffs).toEqual([{ from: 'A', to: 'B', poisoned: true }])
    expect(topo.agents).toEqual([
      { id: 'A', label: 'A', status: 'root' },
      { id: 'B', label: 'B', status: 'blast' },
    ])
  })

  it('handles a single-agent trace: one agent node, zero handoffs', () => {
    const graph: ActionGraph = {
      nodes: [
        { id: 'a0', stepIds: ['s0'], kind: 'reason', label: 'plan', lane: 'reason', agentId: 'solo' },
        { id: 'a1', stepIds: ['s1'], kind: 'decision', label: 'decide', lane: 'reason', agentId: 'solo' },
      ],
      edges: [{ from: 'a0', to: 'a1', longHop: false }],
    }
    const attribution: Attribution = {
      trace_id: 't',
      root_step_id: 's0',
      blast_radius: ['s0', 's1'],
      candidates: [{ step_id: 's0', suspicion: 0.8, reason: 'root' }],
      rationale: 'root at s0',
    }
    const topo = deriveTopology(graph, attribution)
    expect(topo.agents).toEqual([{ id: 'solo', label: 'solo', status: 'root' }])
    expect(topo.handoffs).toEqual([])
  })

  it('ignores untagged (agentId null) nodes — degrades to zero agents/handoffs', () => {
    const graph: ActionGraph = {
      nodes: [
        { id: 'a0', stepIds: ['s0'], kind: 'reason', label: 'plan', lane: 'reason', agentId: null },
        { id: 'a1', stepIds: ['s1'], kind: 'decision', label: 'decide', lane: 'reason', agentId: null },
      ],
      edges: [{ from: 'a0', to: 'a1', longHop: false }],
    }
    const attribution: Attribution = {
      trace_id: 't',
      root_step_id: 's0',
      blast_radius: ['s0'],
      candidates: [{ step_id: 's0', suspicion: 0.8, reason: 'root' }],
      rationale: 'root at s0',
    }
    const topo = deriveTopology(graph, attribution)
    expect(topo.agents).toEqual([])
    expect(topo.handoffs).toEqual([])
  })
})
