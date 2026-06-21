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

    // agents in first-seen order, deduped (extractor → matcher → fraud → approver → payment).
    expect(topo.agents.map((a) => a.id)).toEqual([
      'extractor',
      'matcher',
      'fraud',
      'approver',
      'payment',
    ])

    // status: extractor owns root s2 ⇒ 'root'; agents on the blast path ⇒ 'blast';
    // fraud is the parallel decoy, off the blast set ⇒ 'neutral'.
    const status = Object.fromEntries(topo.agents.map((a) => [a.id, a.status]))
    expect(status).toEqual({
      extractor: 'root',
      matcher: 'blast',
      fraud: 'neutral',
      approver: 'blast',
      payment: 'blast',
    })

    // label defaults to the agent id (position + label, never a hue).
    expect(topo.agents.every((a) => a.label === a.id)).toBe(true)

    // cross-agent edges, deduped on (from, to).
    // fraud→matcher: the matcher's s10 handoff joins the fraud verdict (s9) in;
    // fraud is off the blast set so that wire is not poisoned.
    expect(topo.handoffs).toEqual([
      { from: 'extractor', to: 'matcher', poisoned: true },
      { from: 'extractor', to: 'fraud', poisoned: true },
      { from: 'fraud', to: 'matcher', poisoned: false },
      { from: 'matcher', to: 'approver', poisoned: true },
      { from: 'approver', to: 'payment', poisoned: true },
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
