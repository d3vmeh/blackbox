// web/src/dashboard/Topology.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Topology } from './Topology'
import { deriveActions } from './deriveActions'
import { deriveTopology } from './deriveTopology'
import { loadStubMultiAgentTrace, STUB_MULTI_ATTRIBUTION } from './data/stubMultiAgentTrace'
import type { AgentTopology } from './types'

const TOPO: AgentTopology = deriveTopology(
  deriveActions(loadStubMultiAgentTrace()),
  STUB_MULTI_ATTRIBUTION,
)

describe('Topology', () => {
  const POISONED = TOPO.handoffs.filter((h) => h.poisoned).length

  it('renders one node per agent and one edge per handoff (the real wiring)', () => {
    render(<Topology topology={TOPO} phase="blast" />)
    expect(screen.getAllByTestId('topology-node')).toHaveLength(TOPO.agents.length)
    expect(screen.getAllByTestId('topology-edge')).toHaveLength(TOPO.handoffs.length)
  })

  it('gives the root agent node the root treatment once the cascade has run', () => {
    render(<Topology topology={TOPO} phase="analyze" />)
    const nodes = screen.getAllByTestId('topology-node')
    const rootAgent = TOPO.agents.find((a) => a.status === 'root')!
    const rootNode = nodes.find((n) => n.textContent === rootAgent.label)!
    expect(rootNode).toHaveAttribute('data-status', 'root')

    // exactly one root node — the lone focal accent.
    const rootNodes = nodes.filter((n) => n.getAttribute('data-status') === 'root')
    expect(rootNodes).toHaveLength(1)
  })

  it('lights every poisoned handoff wire once blast has run', () => {
    render(<Topology topology={TOPO} phase="blast" />)
    const edges = screen.getAllByTestId('topology-edge')
    const litEdges = edges.filter((e) => e.getAttribute('data-poisoned') === 'true')
    expect(litEdges).toHaveLength(POISONED)
  })

  it('stays fully neutral in the idle phase (no signal before the cascade)', () => {
    render(<Topology topology={TOPO} phase="idle" />)
    for (const node of screen.getAllByTestId('topology-node')) {
      expect(node).toHaveAttribute('data-status', 'neutral')
    }
    for (const edge of screen.getAllByTestId('topology-edge')) {
      expect(edge).toHaveAttribute('data-poisoned', 'false')
    }
  })

  it('drives selection: clicking an agent node calls onSelectAgent', () => {
    const onSelectAgent = vi.fn()
    render(<Topology topology={TOPO} phase="analyze" onSelectAgent={onSelectAgent} />)
    const fraud = screen.getAllByTestId('topology-node').find((n) => n.textContent === 'fraud')!
    fireEvent.click(fraud)
    expect(onSelectAgent).toHaveBeenCalledWith('fraud')
  })

  it('cross-highlights the selected agent and dims the rest', () => {
    render(<Topology topology={TOPO} phase="analyze" selectedAgentId="coverage" onSelectAgent={() => {}} />)
    const nodes = screen.getAllByTestId('topology-node')
    const coverage = nodes.find((n) => n.textContent === 'coverage')!
    const other = nodes.find((n) => n.textContent === 'payout')!
    expect(coverage).toHaveAttribute('data-selected', 'true')
    expect(coverage).not.toHaveAttribute('data-dimmed')
    expect(other).toHaveAttribute('data-dimmed', 'true')
  })

  it('nodes are inert (disabled) when no onSelectAgent handler is given', () => {
    render(<Topology topology={TOPO} phase="analyze" />)
    for (const node of screen.getAllByTestId('topology-node')) {
      expect(node).toBeDisabled()
    }
  })
})
