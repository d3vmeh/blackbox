import { describe, expect, it } from 'vitest'
import { deriveStats } from './deriveStats'
import { loadStubMultiAgentTrace } from './data/stubMultiAgentTrace'
import type { Step, Trace } from '../types'

describe('deriveStats — multi-agent stub', () => {
  const trace = loadStubMultiAgentTrace()
  const stats = deriveStats(trace)

  it('produces one row per agent in first-appearance order', () => {
    expect(stats.agents.map((a) => a.agentId)).toEqual([
      'extractor', 'matcher', 'fraud', 'approver', 'payment',
    ])
  })

  it('counts steps per agent and the totals partition every step', () => {
    const byId = Object.fromEntries(stats.agents.map((a) => [a.agentId, a.steps]))
    expect(byId).toEqual({ extractor: 5, matcher: 3, fraud: 3, approver: 3, payment: 3 })
    expect(stats.totals.steps).toBe(trace.steps.length)
    expect(stats.totals.agents).toBe(5)
  })

  it('counts tool calls and handoffs across the run', () => {
    expect(stats.totals.toolCalls).toBe(4) // s1, s5, s7, s14
    expect(stats.totals.handoffs).toBe(3)  // s4, s10, s13
  })

  it('estimates positive tokens that split into in + out', () => {
    for (const a of stats.agents) {
      expect(a.tokensTotal).toBe(a.tokensIn + a.tokensOut)
      expect(a.tokensOut).toBeGreaterThan(0)
    }
    expect(stats.totals.tokensTotal).toBe(stats.totals.tokensIn + stats.totals.tokensOut)
  })

  it('aggregate token totals equal the sum of the agent rows', () => {
    const sum = stats.agents.reduce((n, a) => n + a.tokensTotal, 0)
    expect(stats.totals.tokensTotal).toBe(sum)
  })

  it('zero-fills every StepKind in each per-agent breakdown', () => {
    const extractor = stats.agents.find((a) => a.agentId === 'extractor')!
    expect(extractor.kinds).toMatchObject({
      reason: 1, tool_call: 1, tool_result: 1, decision: 1, handoff: 1, final: 0,
    })
  })
})

describe('deriveStats — untagged single-agent trace', () => {
  const steps: Step[] = [
    { id: 's0', index: 0, kind: 'reason', inputs: {}, output: 'think', state: {}, parents: [], raw: {} },
    { id: 's1', index: 1, kind: 'tool_call', inputs: { q: 'go' }, output: 'calling', state: {}, parents: ['s0'], tool_name: 't', raw: {} },
    { id: 's2', index: 2, kind: 'final', inputs: {}, output: 'done', state: {}, parents: ['s1'], raw: {} },
  ]
  const trace: Trace = { id: 't', task: 'x', steps, final_output: 'done', success: false }
  const stats = deriveStats(trace)

  it('collapses untagged steps into one bucket labeled "single"', () => {
    expect(stats.agents).toHaveLength(1)
    expect(stats.agents[0].agentId).toBeNull()
    expect(stats.agents[0].label).toBe('single')
    expect(stats.agents[0].steps).toBe(3)
    expect(stats.agents[0].toolCalls).toBe(1)
  })
})
