import type { ReplayResult } from '../../types'
import map from '../../../../shared/fixtures/claim_run/replay.json'

const REPLAYS = map as unknown as Record<string, ReplayResult>

// Root INTAKE fix flips; decoy ADJUDICATOR replay does not.
export function stubReplay(stepId: string, value: unknown): ReplayResult {
  const hit = REPLAYS[stepId]
  if (hit) return hit
  return {
    trace_id: 'claim_run', step_id: stepId,
    injected_value: value as ReplayResult['injected_value'],
    n: 5, flipped: false, confirmation_rate: 0,
    outcomes: [false, false, false, false, false],
  }
}
