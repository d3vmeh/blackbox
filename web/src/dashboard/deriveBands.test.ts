import { describe, expect, it } from 'vitest'
import { deriveActions } from './deriveActions'
import { deriveBands } from './deriveBands'
import { loadStubMultiAgentTrace } from './data/stubMultiAgentTrace'
import type { ActionGraph } from './types'

describe('deriveBands — multi-agent stub', () => {
  const graph = deriveActions(loadStubMultiAgentTrace())
  const bands = deriveBands(graph)

  it('groups consecutive nodes into contiguous bands in time order', () => {
    expect(bands.map((b) => b.agentId)).toEqual([
      'extractor',
      'matcher',
      'fraud',
      'matcher',
      'approver',
      'payment',
    ])
  })

  it('starts a new band when the agent reappears non-contiguously', () => {
    // matcher runs before fraud, then again after — two separate bands, never merged.
    const matcherBands = bands.filter((b) => b.agentId === 'matcher')
    expect(matcherBands).toHaveLength(2)
  })

  it('partitions every node into exactly one band', () => {
    const banded = bands.flatMap((b) => b.nodeIds)
    expect([...banded].sort()).toEqual([...graph.nodes.map((n) => n.id)].sort())
    expect(banded).toHaveLength(graph.nodes.length)
  })

  it('derives short mono UPPERCASE labels from agentId', () => {
    expect(bands.find((b) => b.agentId === 'extractor')?.label).toBe('EXTR')
    expect(bands.find((b) => b.agentId === 'matcher')?.label).toBe('MATCH')
    expect(bands.find((b) => b.agentId === 'payment')?.label).toBe('PAY')
  })
})

describe('deriveBands — parallel pair within a band', () => {
  // Two nodes (a1, a2) fan out from the same parent a0, with no edge between
  // them, all owned by one agent → one band whose parallelGroupIds = [[a1,a2]].
  const graph: ActionGraph = {
    nodes: [
      { id: 'a0', stepIds: ['s0'], kind: 'reason', label: 'start', lane: 'reason', agentId: 'solo' },
      { id: 'a1', stepIds: ['s1'], kind: 'tool_call', label: 'left', lane: 'tool', agentId: 'solo' },
      { id: 'a2', stepIds: ['s2'], kind: 'tool_call', label: 'right', lane: 'tool', agentId: 'solo' },
      { id: 'a3', stepIds: ['s3'], kind: 'decision', label: 'join', lane: 'reason', agentId: 'solo' },
    ],
    edges: [
      { from: 'a0', to: 'a1', longHop: false },
      { from: 'a0', to: 'a2', longHop: false },
      { from: 'a1', to: 'a3', longHop: false },
      { from: 'a2', to: 'a3', longHop: false },
    ],
  }
  const bands = deriveBands(graph)

  it('produces a single band for the single agent', () => {
    expect(bands).toHaveLength(1)
    expect(bands[0].nodeIds).toEqual(['a0', 'a1', 'a2', 'a3'])
  })

  it('detects the sibling fan-out as a parallel group', () => {
    expect(bands[0].parallelGroupIds).toEqual([['a1', 'a2']])
  })

  it('uses the generic first-5-chars uppercased label fallback', () => {
    expect(bands[0].label).toBe('SOLO')
  })
})

describe('deriveBands — degenerate single-agent case', () => {
  // A purely sequential single-agent chain → one band, no parallel groups.
  const graph: ActionGraph = {
    nodes: [
      { id: 'a0', stepIds: ['s0'], kind: 'reason', label: 'one', lane: 'reason', agentId: null },
      { id: 'a1', stepIds: ['s1'], kind: 'tool_call', label: 'two', lane: 'tool', agentId: null },
      { id: 'a2', stepIds: ['s2'], kind: 'final', label: 'three', lane: 'reason', agentId: null },
    ],
    edges: [
      { from: 'a0', to: 'a1', longHop: false },
      { from: 'a1', to: 'a2', longHop: false },
    ],
  }
  const bands = deriveBands(graph)

  it('collapses an untagged single-agent trace into one band', () => {
    expect(bands).toHaveLength(1)
    expect(bands[0].nodeIds).toEqual(['a0', 'a1', 'a2'])
  })

  it('has no parallel groups for a sequential chain', () => {
    expect(bands[0].parallelGroupIds).toBeUndefined()
  })

  it('falls back to a generic label for a null agentId', () => {
    expect(bands[0].label).toBe('AGENT')
  })
})
