// web/src/dashboard/graph/TraceGraph.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { TraceGraph } from './TraceGraph'
import type { ActionGraph } from '../types'
import type { StatusMap } from '../nodeStatus'

const graph: ActionGraph = {
  nodes: [
    { id: 'a0', stepIds: ['s0'], kind: 'reason', label: 'plan task', lane: 'reason', agentId: 'extractor' },
    { id: 'a1', stepIds: ['s2', 's3'], kind: 'tool_call', label: 'normalize_dates', lane: 'tool', agentId: 'matcher' },
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

  it('renders a per-agent gutter label for each band', () => {
    const { container } = render(
      <TraceGraph graph={graph} status={status} phase="analyze" selectedId={null} onSelect={() => {}} />,
    )
    const labels = container.querySelectorAll('.tg__band-label')
    expect(labels.length).toBe(2)
    const texts = Array.from(labels).map((el) => el.textContent)
    expect(texts).toContain('EXTR')
    expect(texts).toContain('MATCH')
  })

  it('marks the band owning the root node with data-root', () => {
    const { container } = render(
      <TraceGraph graph={graph} status={status} phase="analyze" selectedId={null} onSelect={() => {}} />,
    )
    const labels = Array.from(container.querySelectorAll('.tg__band-label'))
    const matchLabel = labels.find((el) => el.textContent === 'MATCH')
    const extrLabel = labels.find((el) => el.textContent === 'EXTR')
    // a1 (matcher) is the root → matcher band label is --root.
    expect(matchLabel).toHaveAttribute('data-root', 'true')
    expect(extrLabel).toHaveAttribute('data-root', 'false')
  })

  it('renders a cross-agent edge distinctly (dashed) when from/to agents differ', () => {
    // a0 (extractor) -> a1 (matcher) with non-poison status: cross-agent handoff wire.
    const idle: StatusMap = { a0: 'neutral', a1: 'neutral' }
    const { container } = render(
      <TraceGraph graph={graph} status={idle} phase="idle" selectedId={null} onSelect={() => {}} />,
    )
    const path = container.querySelector('.tg__edges path') as SVGPathElement | null
    expect(path).not.toBeNull()
    expect(path).toHaveAttribute('data-cross', 'true')
    expect(path).toHaveAttribute('stroke-dasharray', '5 4')
  })

  it('heals every executed action after the root, including clean parallel siblings', () => {
    vi.useFakeTimers()
    const softwareGraph: ActionGraph = {
      nodes: [
        { id: 'a0', stepIds: ['s1'], kind: 'decision', label: 'architect', lane: 'reason', agentId: 'architect' },
        { id: 'a1', stepIds: ['s2'], kind: 'decision', label: 'tax', lane: 'reason', agentId: 'tax' },
        { id: 'a2', stepIds: ['s3'], kind: 'decision', label: 'integrator', lane: 'reason', agentId: 'integrator' },
        { id: 'a3', stepIds: ['s4'], kind: 'decision', label: 'test_writer', lane: 'reason', agentId: 'test_writer' },
        { id: 'a4', stepIds: ['s5'], kind: 'final', label: 'ci', lane: 'reason', agentId: 'ci' },
      ],
      edges: [
        { from: 'a0', to: 'a1', longHop: false },
        { from: 'a1', to: 'a2', longHop: false },
        { from: 'a0', to: 'a3', longHop: true },
        { from: 'a2', to: 'a4', longHop: true },
        { from: 'a3', to: 'a4', longHop: false },
      ],
    }
    const softwareStatus: StatusMap = {
      a0: 'neutral',
      a1: 'root',
      a2: 'blast',
      a3: 'neutral',
      a4: 'blast',
    }

    render(
      <TraceGraph
        graph={softwareGraph}
        status={softwareStatus}
        phase="confirm"
        selectedId={null}
        onSelect={() => {}}
      />,
    )

    act(() => { vi.advanceTimersByTime(0) })
    expect(screen.getByTestId('node-a1')).toHaveAttribute('data-status', 'pass')
    expect(screen.getByTestId('node-a2')).toHaveAttribute('data-status', 'blast')
    expect(screen.getByTestId('node-a3')).toHaveAttribute('data-status', 'neutral')

    act(() => { vi.advanceTimersByTime(1900) })
    expect(screen.getByTestId('node-a2')).toHaveAttribute('data-status', 'pass')

    act(() => { vi.advanceTimersByTime(1900) })
    expect(screen.getByTestId('node-a3')).toHaveAttribute('data-status', 'pass')

    act(() => { vi.advanceTimersByTime(1900) })
    expect(screen.getByTestId('node-a4')).toHaveAttribute('data-status', 'pass')
    vi.useRealTimers()
  })
})
