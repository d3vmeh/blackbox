import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Inspector } from './Inspector'
import type { Step, Attribution } from '../../types'
import type { ActionNode } from '../types'
import type { RunMeta } from '../data/loadMeta'

const steps: Step[] = [
  { id: 's2', index: 2, kind: 'tool_call', inputs: { depart_text: 'July 12 2024' },
    output: { call: 'normalize_dates(...)' }, state: {}, parents: ['s1'], tool_name: 'normalize_dates', raw: {} },
  { id: 's3', index: 3, kind: 'tool_result', inputs: { depart_text: 'July 12 2024' },
    output: { depart_date: '2024-12-07', note: 'interpreted as DD-MM' },
    state: { params: { depart_date: '2024-12-07' } }, parents: ['s2'], tool_name: 'normalize_dates', raw: {} },
]
const node: ActionNode = { id: 'a1', stepIds: ['s2', 's3'], kind: 'tool_call', label: 'normalize_dates', lane: 'tool' }
const runMeta: RunMeta = {
  runtime: 'langgraph',
  author: 'test',
  engine: 'StateGraph + MemorySaver',
  apis: ['build_graph', 'run_agent_graph', 'to_trace'],
  graph_nodes: ['plan'],
  checkpoints: 10,
  to_trace_steps: 8,
  recorder_steps: 10,
  capture_path: 'Recorder',
  replay_path: 'update_state',
  fork_node: 'parse_date',
  thread_id: 'flight_run',
}
const attribution: Attribution = {
  trace_id: 't', root_step_id: 's3', blast_radius: ['s4'],
  candidates: [{ step_id: 's3', suspicion: 0.91, reason: 'date swap' }], rationale: 'x',
}

describe('Inspector', () => {
  it('renders telemetry for the focused node including the judge suspicion', () => {
    render(<Inspector node={node} steps={steps} attribution={attribution} runMeta={runMeta} onReplay={() => {}} />)
    expect(screen.getByText('normalize_dates')).toBeInTheDocument()
    expect(screen.getAllByText(/2024-12-07/).length).toBeGreaterThan(0)
    expect(screen.getByText(/0\.91/)).toBeInTheDocument()
  })

  it('fires onReplay with the root step id', () => {
    const onReplay = vi.fn()
    render(<Inspector node={node} steps={steps} attribution={attribution} runMeta={runMeta} onReplay={onReplay} />)
    fireEvent.click(screen.getByRole('button', { name: /replay with fix/i }))
    expect(onReplay).toHaveBeenCalledWith('s3')
  })

  it('shows a prompt when nothing is selected', () => {
    render(<Inspector node={null} steps={steps} attribution={attribution} runMeta={runMeta} onReplay={() => {}} />)
    expect(screen.getByText(/select a node/i)).toBeInTheDocument()
  })
})
