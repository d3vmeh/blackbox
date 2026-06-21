// web/src/dashboard/graph/TraceGraph.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
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
})
