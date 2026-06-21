import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useRun } from './useRun'

describe('useRun', () => {
  it('exposes the LangGraph flight trace, attribution, and a derived graph', () => {
    const { result } = renderHook(() => useRun())
    expect(result.current.data.trace.id).toBe('flight_run')
    expect(result.current.data.meta.runtime).toBe('langgraph')
    expect(result.current.data.meta.apis).toContain('run_agent_graph')
    expect(result.current.data.attribution.root_step_id).toBe('s4')
    expect(result.current.data.graph.nodes.length).toBeGreaterThanOrEqual(4)
    expect(result.current.data.status[result.current.data.graph.nodes[0].id]).toBeDefined()
  })

  it('replays: root step (s4) flips, decoy (s5) does not', async () => {
    const { result } = renderHook(() => useRun())
    let root!: Awaited<ReturnType<typeof result.current.replay>>
    let decoy!: Awaited<ReturnType<typeof result.current.replay>>
    await act(async () => { root = await result.current.replay('s4', 'departure = 2026-07-12') })
    await act(async () => { decoy = await result.current.replay('s5', 'selected AA-218 @ $999') })
    expect(root.flipped).toBe(true)
    expect(root.confirmation_rate).toBe(1)
    expect(decoy.flipped).toBe(false)
  })
})
