import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useRun } from './useRun'

describe('useRun', () => {
  it('exposes the claims trace, attribution, and a derived graph', () => {
    const { result } = renderHook(() => useRun())
    expect(result.current.data.trace.id).toBe('claim_run')
    expect(result.current.data.meta.runtime).toBe('multi-agent')
    expect(result.current.data.meta.domain).toBe('insurance-claims')
    expect(result.current.data.monitor.decision).toBe('auto_apply')
    expect(result.current.data.attribution.root_step_id).toBe('s1')
    expect(result.current.data.graph.nodes.length).toBeGreaterThanOrEqual(4)
    expect(result.current.data.status[result.current.data.graph.nodes[0].id]).toBeDefined()
  })

  it('replays: root step (s1) flips, decoy (s4) does not', async () => {
    const { result } = renderHook(() => useRun())
    let root!: Awaited<ReturnType<typeof result.current.replay>>
    let decoy!: Awaited<ReturnType<typeof result.current.replay>>
    await act(async () => { root = await result.current.replay('s1', { amount: 4200 }) })
    await act(async () => { decoy = await result.current.replay('s4', { approved: true }) })
    expect(root.flipped).toBe(true)
    expect(root.confirmation_rate).toBe(1)
    expect(decoy.flipped).toBe(false)
  })
})
