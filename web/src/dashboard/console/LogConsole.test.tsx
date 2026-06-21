import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { LogConsole } from './LogConsole'
import { buildLog } from './buildLog'
import type { Step, Attribution } from '../../types'

const steps: Step[] = [
  { id: 's0', index: 0, kind: 'reason', inputs: {}, output: 'plan', state: {}, parents: [], raw: {} },
  { id: 's3', index: 3, kind: 'tool_result', inputs: {}, output: { depart_date: '2024-12-07' },
    state: {}, parents: ['s2'], tool_name: 'normalize_dates', raw: {} },
]
const attribution: Attribution = {
  trace_id: 't', root_step_id: 's3', blast_radius: [], candidates: [], rationale: 'x',
}

describe('buildLog', () => {
  it('produces one line per step with a level and source', () => {
    const log = buildLog(steps)
    expect(log).toHaveLength(2)
    expect(log[1].src).toBe('normalize_dates')
    expect(log[1].level).toBe('TOOL')
  })
})

describe('LogConsole', () => {
  it('flags the root cause line', () => {
    render(<LogConsole steps={steps} attribution={attribution} selectedStepId={null} />)
    expect(screen.getByTestId('log-s3')).toHaveAttribute('data-flag', 'root')
  })
})
