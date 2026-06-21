import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Inspector } from './Inspector'
import type { Step, Attribution } from '../../types'
import type { ActionNode } from '../types'

const steps: Step[] = [
  { id: 's2', index: 2, kind: 'tool_call', inputs: { depart_text: 'July 12 2024' },
    output: { call: 'normalize_dates(...)' }, state: {}, parents: ['s1'], tool_name: 'normalize_dates', raw: {} },
  { id: 's3', index: 3, kind: 'tool_result', inputs: { depart_text: 'July 12 2024' },
    output: { depart_date: '2024-12-07', note: 'interpreted as DD-MM' },
    state: { params: { depart_date: '2024-12-07' } }, parents: ['s2'], tool_name: 'normalize_dates', raw: {} },
]
const node: ActionNode = { id: 'a1', stepIds: ['s2', 's3'], kind: 'tool_call', label: 'normalize_dates', lane: 'tool', agentId: null }
const attribution: Attribution = {
  trace_id: 't', root_step_id: 's3', blast_radius: ['s4'],
  candidates: [{ step_id: 's3', suspicion: 0.91, reason: 'date swap' }], rationale: 'x',
}

describe('Inspector', () => {
  it('renders telemetry for the focused node including the judge suspicion', () => {
    render(<Inspector node={node} steps={steps} attribution={attribution} onReplay={() => {}} />)
    expect(screen.getByText('normalize_dates')).toBeInTheDocument()
    expect(screen.getAllByText(/2024-12-07/).length).toBeGreaterThan(0)
    expect(screen.getByText(/0\.91/)).toBeInTheDocument()
  })

  it('fires onReplay with the root step id', () => {
    const onReplay = vi.fn()
    render(<Inspector node={node} steps={steps} attribution={attribution} onReplay={onReplay} />)
    fireEvent.click(screen.getByRole('button', { name: /replay with fix/i }))
    expect(onReplay).toHaveBeenCalledWith('s3')
  })

  it('shows a prompt when nothing is selected', () => {
    render(<Inspector node={null} steps={steps} attribution={attribution} onReplay={() => {}} />)
    expect(screen.getByText(/select a node/i)).toBeInTheDocument()
  })

  it('makes a cross-agent parent clickable and jumps to its owning node', () => {
    const xSteps: Step[] = [
      { id: 's5', index: 5, kind: 'tool_result', inputs: {}, output: { price: 980 },
        state: {}, parents: [], tool_name: 'price', raw: { agent: 'fraud' } },
      { id: 's6', index: 6, kind: 'tool_call', inputs: {}, output: { ok: true },
        state: {}, parents: ['s5'], tool_name: 'approve', raw: { agent: 'matcher' } },
    ]
    const xNode: ActionNode = { id: 'a6', stepIds: ['s6'], kind: 'tool_call', label: 'approve', lane: 'tool', agentId: 'matcher' }
    const xNodes: ActionNode[] = [
      { id: 'a5', stepIds: ['s5'], kind: 'tool_result', label: 'price', lane: 'tool', agentId: 'fraud' },
      xNode,
    ]
    const xAttr: Attribution = { trace_id: 't', root_step_id: 's5', blast_radius: [], candidates: [], rationale: 'x' }
    const onSelect = vi.fn()
    render(<Inspector node={xNode} steps={xSteps} attribution={xAttr} onReplay={() => {}} nodes={xNodes} onSelect={onSelect} />)
    const jump = screen.getByRole('button', { name: /s5/i })
    fireEvent.click(jump)
    expect(onSelect).toHaveBeenCalledWith('a5')
  })
})
