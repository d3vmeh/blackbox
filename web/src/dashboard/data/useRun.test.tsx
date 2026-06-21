import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useRun } from './useRun'

describe('useRun', () => {
  it('exposes the multi-agent trace, attribution, monitor decision, and a derived graph', () => {
    const { result } = renderHook(() => useRun())
    expect(result.current.data.trace.id).toBe('claim_adjudication')
    expect(result.current.data.attribution.root_step_id).toBe('s1')
    expect(result.current.data.monitor.root_step_id).toBe('s1')
    expect(result.current.data.graph.nodes.length).toBeGreaterThanOrEqual(4)
    expect(result.current.data.status[result.current.data.graph.nodes[0].id]).toBeDefined()
  })

  it('replays: root step (s2) flips, decoy (s8) does not', async () => {
    const { result } = renderHook(() => useRun())
    let root!: Awaited<ReturnType<typeof result.current.replay>>
    let decoy!: Awaited<ReturnType<typeof result.current.replay>>
    await act(async () => { root = await result.current.replay('s1', { billed_amount: 5200 }) })
    await act(async () => { decoy = await result.current.replay('s4', { payout_amount: 4800 }) })
    expect(root.flipped).toBe(true)
    expect(root.confirmation_rate).toBe(1)
    expect(decoy.flipped).toBe(false)
  })
})
