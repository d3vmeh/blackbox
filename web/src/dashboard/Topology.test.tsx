// web/src/dashboard/Topology.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
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
  // Edge connectors sit between adjacent agent nodes, so there is one per gap.
  const ADJACENT_POISONED = TOPO.agents.reduce((count, agent, i) => {
    const next = TOPO.agents[i + 1]
    if (!next) return count
    const edge = TOPO.handoffs.find(
      (h) =>
        (h.from === agent.id && h.to === next.id) ||
        (h.from === next.id && h.to === agent.id),
    )
    return edge?.poisoned ? count + 1 : count
  }, 0)

  it('renders one node per agent and a connector between each adjacent pair', () => {
    render(<Topology topology={TOPO} phase="blast" />)
    expect(screen.getAllByTestId('topology-node')).toHaveLength(TOPO.agents.length)
    expect(screen.getAllByTestId('topology-edge')).toHaveLength(TOPO.agents.length - 1)
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

  it('marks poisoned connectors once blast has run', () => {
    render(<Topology topology={TOPO} phase="blast" />)
    const edges = screen.getAllByTestId('topology-edge')
    const litEdges = edges.filter((e) => e.getAttribute('data-poisoned') === 'true')
    expect(litEdges).toHaveLength(ADJACENT_POISONED)
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
})
