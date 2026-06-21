import type { ReplayResult } from '../../types'
import data from '../../../../shared/fixtures/claim_adjudication/replay.json'

export function loadFixtureReplays(): Record<string, ReplayResult> {
  return data as unknown as Record<string, ReplayResult>
}
