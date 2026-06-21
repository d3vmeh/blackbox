import type { ReplayResult } from '../../types'
import map from '../../../../shared/fixtures/code_run/replay.json'

export const FALLBACK_REPLAYS = map as unknown as Record<string, ReplayResult>

export function nonFlip(stepId: string): ReplayResult {
  return { trace_id: 'code_run', step_id: stepId, injected_value: null,
           n: 5, flipped: false, confirmation_rate: 0,
           outcomes: [false, false, false, false, false] }
}
