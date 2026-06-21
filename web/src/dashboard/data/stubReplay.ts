import type { ReplayResult } from '../../types'

// Deterministic stub: only correcting the true root (s3) flips the outcome.
export function stubReplay(stepId: string, value: unknown): ReplayResult {
  const flips = stepId === 's3'
  const outcomes = flips ? [true, true, true, true, true] : [false, false, false, false, false]
  return {
    trace_id: 'trace_flight_fail_001',
    step_id: stepId,
    injected_value: value as ReplayResult['injected_value'],
    n: 5,
    flipped: flips,
    confirmation_rate: outcomes.filter(Boolean).length / outcomes.length,
    outcomes,
  }
}
