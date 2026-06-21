import { describe, it, expect } from 'vitest'
import { displayStatus, phaseForReplay, PHASE_STATUS } from './phase'
import type { ReplayResult } from '../types'

describe('displayStatus', () => {
  it('shows neutral while idle regardless of base', () => {
    expect(displayStatus('root', 'idle')).toBe('neutral')
    expect(displayStatus('blast', 'idle')).toBe('neutral')
  })
  it('keeps root/blast during blast + analyze', () => {
    expect(displayStatus('root', 'analyze')).toBe('root')
    expect(displayStatus('blast', 'blast')).toBe('blast')
  })
  it('heals root/blast to pass on confirm', () => {
    expect(displayStatus('root', 'confirm')).toBe('pass')
    expect(displayStatus('blast', 'confirm')).toBe('pass')
    expect(displayStatus('neutral', 'confirm')).toBe('neutral')
  })
})

describe('phaseForReplay', () => {
  const base: Omit<ReplayResult, 'flipped'> = {
    trace_id: 't', step_id: 's3', injected_value: '2024-07-12', n: 5,
    confirmation_rate: 1, outcomes: [true, true, true, true, true],
  }
  it('confirms on a flip and rejects on a non-flip', () => {
    expect(phaseForReplay({ ...base, flipped: true })).toBe('confirm')
    expect(phaseForReplay({ ...base, flipped: false, confirmation_rate: 0, outcomes: [false] }))
      .toBe('rejected')
  })
  it('has a status line for every phase', () => {
    expect(Object.keys(PHASE_STATUS)).toContain('confirm')
  })
})
