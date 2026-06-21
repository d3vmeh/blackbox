import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useRun } from './useRun'

describe('useRun', () => {
  it('exposes the fixture trace, attribution, and a derived graph', () => {
    const { result } = renderHook(() => useRun())
    expect(result.current.data.trace.id).toBe('trace_flight_fail_001')
    expect(result.current.data.attribution.root_step_id).toBe('s3')
    expect(result.current.data.graph.nodes.length).toBeGreaterThan(10)
    expect(result.current.data.status[result.current.data.graph.nodes[0].id]).toBeDefined()
  })

  it('replays: root step flips, decoy does not', async () => {
    const { result } = renderHook(() => useRun())
    let root!: Awaited<ReturnType<typeof result.current.replay>>
    let decoy!: Awaited<ReturnType<typeof result.current.replay>>
    await act(async () => { root = await result.current.replay('s3', '2024-07-12') })
    await act(async () => { decoy = await result.current.replay('s14', true) })
    expect(root.flipped).toBe(true)
    expect(root.confirmation_rate).toBe(1)
    expect(decoy.flipped).toBe(false)
  })
})
