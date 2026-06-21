import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useRun } from './useRun'

describe('useRun', () => {
  it('first paint shows the static fallback run + derived graph', () => {
    const { result } = renderHook(() => useRun())
    expect(result.current.data.trace.id).toBe('code_run')
    expect(result.current.data.attribution.root_step_id).toBe('s1')
    expect(result.current.data.graph.nodes.length).toBeGreaterThanOrEqual(4)
    expect(result.current.loading).toBe(false)
  })

  it('replay reads the current run’s replay map: root flips, decoy does not', async () => {
    const { result } = renderHook(() => useRun())
    let root!: Awaited<ReturnType<typeof result.current.replay>>
    let decoy!: Awaited<ReturnType<typeof result.current.replay>>
    await act(async () => { root = await result.current.replay('s1', null) })
    await act(async () => { decoy = await result.current.replay('s3', null) })
    expect(root.flipped).toBe(true)
    expect(decoy.flipped).toBe(false)
  })
})
