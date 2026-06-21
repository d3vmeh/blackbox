import { describe, it, expect } from 'vitest'
import { deriveActions } from './deriveActions'
import type { Trace } from '../types'

const mk = (id: string, index: number, kind: Trace['steps'][number]['kind'],
  parents: string[], tool_name: string | null = null): Trace['steps'][number] => ({
  id, index, kind, inputs: {}, output: null, state: {}, parents, tool_name, raw: {},
})

const trace: Trace = {
  id: 't', task: 'x', final_output: null, success: false,
  steps: [
    mk('s0', 0, 'reason', []),
    mk('s1', 1, 'tool_call', ['s0'], 'normalize_dates'),
    mk('s2', 2, 'tool_result', ['s1'], 'normalize_dates'),
    mk('s3', 3, 'decision', ['s2']),
  ],
}

describe('deriveActions', () => {
  it('merges a call+result pair into one tool action node', () => {
    const g = deriveActions(trace)
    expect(g.nodes).toHaveLength(3) // reason, merged tool, decision
    const tool = g.nodes.find((n) => n.kind === 'tool_call' || n.kind === 'tool_result')
    expect(tool?.stepIds).toEqual(['s1', 's2'])
    expect(tool?.lane).toBe('tool')
  })

  it('keeps reason/decision as single nodes and ids are a-prefixed in order', () => {
    const g = deriveActions(trace)
    expect(g.nodes.map((n) => n.id)).toEqual(['a0', 'a1', 'a2'])
    expect(g.nodes[0].lane).toBe('reason')
  })

  it('creates edges between action nodes from underlying parents, flagging long hops', () => {
    const g = deriveActions(trace)
    // a0(reason) -> a1(tool) -> a2(decision)
    expect(g.edges).toEqual(
      expect.arrayContaining([
        { from: 'a0', to: 'a1', longHop: false },
        { from: 'a1', to: 'a2', longHop: false },
      ]),
    )
  })
})
