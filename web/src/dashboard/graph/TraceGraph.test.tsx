// web/src/dashboard/graph/TraceGraph.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { TraceGraph } from './TraceGraph'
import type { ActionGraph } from '../types'
import type { StatusMap } from '../nodeStatus'

const graph: ActionGraph = {
  nodes: [
    { id: 'a0', stepIds: ['s0'], kind: 'reason', label: 'plan task', lane: 'reason' },
    { id: 'a1', stepIds: ['s2', 's3'], kind: 'tool_call', label: 'normalize_dates', lane: 'tool' },
  ],
  edges: [{ from: 'a0', to: 'a1', longHop: false }],
}
const status: StatusMap = { a0: 'neutral', a1: 'root' }

describe('TraceGraph', () => {
  it('renders a node per action and marks the root', () => {
    render(<TraceGraph graph={graph} status={status} phase="analyze" selectedId={null} onSelect={() => {}} />)
    expect(screen.getByText('normalize_dates')).toBeInTheDocument()
    expect(screen.getByTestId('node-a1')).toHaveAttribute('data-status', 'root')
  })

  it('shows everything neutral during idle', () => {
    render(<TraceGraph graph={graph} status={status} phase="idle" selectedId={null} onSelect={() => {}} />)
    expect(screen.getByTestId('node-a1')).toHaveAttribute('data-status', 'neutral')
  })

  it('calls onSelect with the node id when clicked', () => {
    const onSelect = vi.fn()
    render(<TraceGraph graph={graph} status={status} phase="analyze" selectedId={null} onSelect={onSelect} />)
    fireEvent.click(screen.getByTestId('node-a1'))
    expect(onSelect).toHaveBeenCalledWith('a1')
  })
})
