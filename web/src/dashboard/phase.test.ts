import { describe, it, expect } from 'vitest'
import {
  displayStatus, phaseForReplay, trustForPhase,
  PHASE_STATUS, PHASE_TRUST, type Phase,
} from './phase'
import type { ReplayResult } from '../types'

const ALL_PHASES: Phase[] = [
  'idle', 'blast', 'analyze', 'proving_decoy', 'proving_root', 'confirm', 'rejected',
]

describe('displayStatus', () => {
  it('shows neutral while idle regardless of base', () => {
    expect(displayStatus('root', 'idle')).toBe('neutral')
    expect(displayStatus('blast', 'idle')).toBe('neutral')
  })
  it('keeps root/blast during blast + analyze', () => {
    expect(displayStatus('root', 'analyze')).toBe('root')
    expect(displayStatus('blast', 'blast')).toBe('blast')
  })
  it('keeps root/blast colored (does not heal) on confirm in split-view', () => {
    expect(displayStatus('root', 'confirm')).toBe('root')
    expect(displayStatus('blast', 'confirm')).toBe('blast')
    expect(displayStatus('neutral', 'confirm')).toBe('neutral')
  })
  it('keeps root/blast colored (not healed) while proving', () => {
    expect(displayStatus('root', 'proving_decoy')).toBe('root')
    expect(displayStatus('blast', 'proving_root')).toBe('blast')
  })
})

describe('trustForPhase', () => {
  it('is untrusted before proving and on rejection', () => {
    expect(trustForPhase('idle')).toBe('untrusted')
    expect(trustForPhase('blast')).toBe('untrusted')
    expect(trustForPhase('analyze')).toBe('untrusted')
    expect(trustForPhase('rejected')).toBe('untrusted')
  })
  it('is proving across both replay sub-states', () => {
    expect(trustForPhase('proving_decoy')).toBe('proving')
    expect(trustForPhase('proving_root')).toBe('proving')
  })
  it('only becomes trusted on the confirmed flip', () => {
    expect(trustForPhase('confirm')).toBe('trusted')
  })
  it('maps every phase to a trust state', () => {
    for (const p of ALL_PHASES) expect(PHASE_TRUST[p]).toBeDefined()
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
    for (const p of ALL_PHASES) expect(PHASE_STATUS[p]).toBeDefined()
  })
})
